// A-F18 — SLA backstop digest job: email ALL admins an identity-free digest of the
// reports that have breached their service-level deadline (D11).
//
// THE EMAIL TWIN of the in-app Alerts screen (A-D-alerts / A-F19). Both surfaces are
// the safety net behind the per-event notifications: if a per-report email bounced or
// a report simply slipped its SLA unactioned, neither the in-app banner NOR this daily
// email lets it pass unseen (NFR-4, ER-D15). CRITICAL: the two surfaces MUST breach on
// the SAME rule, so this job does NOT reimplement the predicate — it imports the SHARED
// buildBreaches from lib/sla.js, the exact function the Alerts onResponse uses. They
// cannot drift.
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Not a button, not interactive. It reads ONLY via the loadReportsForAdmin
// gateway (ER-A3 — the single admin read path; NEVER queries `reports` directly), so the
// rows are identity-free by construction (adminProjection applied in code).
//
// RECURRENCE — SELF-REARM (not repeats). The job-scheduler `repeats: { quantity, unit }`
// option requires a FINITE quantity (docs § repeats: "quantity must be > 0"); there is no
// "repeat forever" value. For an OPEN-ENDED daily sweep we therefore re-arm at the END of
// every run: scheduleMessage(... schedule: now + TIMING.SLA_DIGEST_INTERVAL_MS ...) with a
// DETERMINISTIC jobId (DIGEST_JOB_ID) so a second arming OVERWRITES rather than stacks —
// the chain can never fork into duplicate daily emails. The re-arm is best-effort and
// wrapped: a scheduling failure is logged but does not abort the (already-sent) digest.
//
// BOOTSTRAP / FIRST ARMING (NOT automatic — do not assume this runs by itself). The FIRST
// scheduleMessage must be issued once as an ops/deploy step (or a one-shot app-start
// bootstrap) to start the chain, e.g. from an ops console:
//
//   await state.jobScheduler.scheduleMessage({
//     toUser: <a stable system/admin userId>,
//     jobId: "slaDigest-sweep",                 // === DIGEST_JOB_ID below
//     schedule: Date.now() + TIMING.SLA_DIGEST_INTERVAL_MS,
//     messages: [{ intentId: INTENT.SLA_DIGEST }],
//   });
//
// Thereafter the job re-arms itself. (We do NOT auto-arm from app-start here to avoid every
// admin login spawning a competing chain; arming is an explicit one-time ops action.)
//
// ANONYMITY (rule 16 / rule 30): the digest is IDENTITY-FREE — per breach it lists ONLY
// reportId, status label, the assigned ROLE, and how long overdue. NEVER a reporterId,
// contact channel, recipient address, or any reporter identity. Recipients are the seeded
// admins' own emails (adminUsersCollection.adminEmail) — the admin's identity, not a
// reporter's.
//
// ER-B7 — NEVER SILENT LOSS. Empty breaches ⇒ nothing to send (skip, fine). But if there
// ARE breaches and the admin registry is EMPTY, that is a CRITICAL backstop failure (a
// breach with nowhere to send) — we D.log it LOUDLY rather than drop it silently. When
// breaches exist we ALWAYS attempt the send; each admin email is best-effort (one failure
// never aborts the rest — lib/notifications already swallows + logs).
//
// NO sendResponse — system job, no interactive user. Outcome recorded via D.log (counts).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminUsersCollection } from "../../../lib/collections/admin-users";
import { loadReportsForAdmin, extractRowData } from "../../../lib/access";
import { sendAdminEmail } from "../../../lib/notifications";
import { buildBreaches } from "../../../lib/sla";
import { statusLabel } from "../../../lib/ticket-status";
import { TIMING } from "../../../lib/constants";
import { escapeHtml, formatRelative } from "../../../lib/utils/format";
import { INTENT } from "../constants";

// Deterministic jobId for the self-rearming chain — a second arming overwrites the
// pending one rather than stacking, so the daily chain can never duplicate (rule 19).
const DIGEST_JOB_ID = `${INTENT.SLA_DIGEST}-sweep`;

// Normalise a loaded admin-users row into a plain object using the shared
// lib/access.extractRowData (reads field values by dbName). The admin's OWN identity
// (adminEmail) is fine to read — it is never a reporter's.
const adminEmailOf = (row) => {
  const data = extractRowData(row);
  return (data && data.adminEmail) || "";
};

// Build the identity-free digest HTML: one row per breach (reportId, status label,
// assigned role, overdue age). Every interpolated value is escaped (NFR-2, rule 10).
const buildDigestHtml = (breaches, nowMs) => {
  const rows = breaches
    .map((b) => {
      const overdue = formatRelative(b.sinceOn, nowMs); // e.g. "2 d ago"
      const role = b.assignedTo || "Unassigned";
      return (
        `<li style="margin:0 0 10px;">` +
        `<strong>${escapeHtml(b.reportId)}</strong> — ` +
        `${escapeHtml(statusLabel(b.status))} · ` +
        `assigned to ${escapeHtml(role)} · ` +
        `unactioned since ${escapeHtml(overdue)}` +
        `</li>`
      );
    })
    .join("");
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2937;">` +
    `<p>The following report(s) have breached their compliance SLA and need attention. ` +
    `This digest is identity-free — open each report in the admin console to action it.</p>` +
    `<ul style="list-style:none;margin:0;padding:0;">${rows}</ul>` +
    `</div>`
  );
};

export const slaDigest = Intent.Create({
  intentId: INTENT.SLA_DIGEST,
  prompt: "Email all admins a digest of SLA-breaching reports",
  state,
});

slaDigest.onResolution = async () => {
  const nowMs = Date.now();

  // 1. Read the report set via the SINGLE admin-read gateway (ER-A3). Returns plain,
  //    identity-free, adminProjection-stripped objects. NEVER queries `reports` directly.
  let reports;
  try {
    reports = await loadReportsForAdmin({});
  } catch (error) {
    D.log({
      message: "A-F18: failed to load reports for the SLA digest",
      data: { error: String(error) },
    });
    // Still attempt the re-arm so the chain survives a transient read failure.
    await rearm(nowMs);
    return;
  }

  // 2. The SHARED predicate (lib/sla.js) — identical rule to the in-app A-D-alerts twin.
  const breaches = buildBreaches(reports, nowMs);

  // 3. Empty breaches ⇒ nothing to send (fine — ER-B7 only forbids SILENT LOSS of an
  //    ACTUAL breach). Log the clean sweep and re-arm for tomorrow.
  if (!breaches.length) {
    D.log({
      message: "A-F18: SLA digest sweep — no breaches, no email sent",
      data: { reportsScanned: reports.length },
    });
    await rearm(nowMs);
    return;
  }

  // 4. Load ALL admins (the recipient list). Identity-free of the reporter; the admin's
  //    own adminEmail is the destination.
  let recipients = [];
  try {
    await adminUsersCollection.loadCollectionWithQuery({ query: {} });
    recipients = (adminUsersCollection.rows || [])
      .map(adminEmailOf)
      .filter(Boolean);
  } catch (error) {
    D.log({
      message: "A-F18: failed to load the admin registry for the SLA digest",
      data: { error: String(error), breachCount: breaches.length },
    });
  }

  // 5. ER-B7 — breaches exist but NO recipient: a backstop failure. Log LOUDLY (never a
  //    silent drop) and re-arm. The in-app Alerts twin still surfaces these breaches.
  if (!recipients.length) {
    D.log({
      message:
        "A-F18: SLA BACKSTOP FAILURE — breaches exist but the admin registry is EMPTY; " +
        "digest could not be delivered to anyone (never silent — ER-B7). In-app Alerts " +
        "remain the fallback. Seed the admin-users registry.",
      data: { breachCount: breaches.length },
    });
    await rearm(nowMs);
    return;
  }

  // 6. Build the identity-free email and send to EACH admin best-effort: one failure must
  //    not abort the rest (lib/notifications swallows + D.logs each failure).
  const subject = `Compliance SLA digest — ${breaches.length} report(s) need attention`;
  const html = buildDigestHtml(breaches, nowMs);

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const result = await sendAdminEmail({ to, subject, html });
    if (result && result.ok) sent += 1;
    else failed += 1;
  }

  D.log({
    message: "A-F18: SLA digest sent",
    data: {
      breachCount: breaches.length,
      recipients: recipients.length,
      sent,
      failed,
    },
  });

  // 7. Re-arm the next daily sweep (self-rearm — see header). Best-effort.
  await rearm(nowMs);
};

// Re-arm the next sweep TIMING.SLA_DIGEST_INTERVAL_MS from now, under the deterministic
// jobId so it overwrites any pending arming (no duplicate chains). The message carries NO
// data (the job re-reads everything fresh on the next run — Context B). Fires in this same
// admin's context (job-scheduler delivers to toUser); the next run loads its own data.
const rearm = async (nowMs) => {
  try {
    await state.jobScheduler.scheduleMessage({
      toUser: state.user?.userId,
      jobId: DIGEST_JOB_ID,
      schedule: nowMs + TIMING.SLA_DIGEST_INTERVAL_MS,
      messages: [{ intentId: INTENT.SLA_DIGEST }],
    });
  } catch (error) {
    D.log({
      message: "A-F18: failed to re-arm the next SLA digest sweep",
      data: { error: String(error) },
    });
  }
};

// One-shot kickoff for the self-rearming digest chain — called from admin app-start so
// the sweep is running without a manual ops step. Idempotent: the deterministic
// DIGEST_JOB_ID means re-arming on each app open overwrites the pending sweep rather
// than stacking (rule 19). Best-effort (rearm swallows its own errors).
export const armSlaDigestSweep = async () => {
  await rearm(Date.now());
  D.log({ message: "A-F18: SLA digest sweep armed at app-start" });
};

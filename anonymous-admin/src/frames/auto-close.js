// A-F17 — Auto-close job: RESOLVED -> CLOSED_BY_SYSTEM after the +30d response window.
//
// The RECEIVING half of the "+30d auto-close" flow whose SCHEDULER half lives in
// A-E-resolveReport (frames/resolve-report.js). On a successful resolve that frame arms a
// jobScheduler message:
//
//   state.jobScheduler.scheduleMessage({
//     toUser: state.user.userId,                       // the resolving admin's own id
//     jobId: `${INTENT.AUTO_CLOSE_REPORT}-${reportId}`, // deterministic per report
//     schedule: resolvedOn + TIMING.AUTO_CLOSE_MS,      // +30 days (D2)
//     messages: [{ intentId: INTENT.AUTO_CLOSE_REPORT, data: { reportId } }],
//   });
//
// So this intent fires +30d later IN THE RESOLVING ADMIN'S CONTEXT (job-scheduler delivers
// to toUser). It is an INDEPENDENT INTENT (Context B — object graph EMPTY on entry;
// CLAUDE.md "Invocation Lifecycle"), NOT a button and NOT interactive. Mirror of the user
// app's call-timeout.js (THE job-receiver precedent): read the payload from
// state.messageFromUser.data (the job-scheduler delivery slot; .payload is the defensive
// fallback for a manual invoke during testing), re-read the entity FRESH, and apply the
// transition ONLY behind a GUARD (rule 13). Everything else is a logged no-op.
//
// IDEMPOTENCY IS THE WHOLE GAME (ER-B8 — "duplicate or stale fires are safe no-ops"). A
// scheduled job can fire twice, can fire after the report has already moved on, or can be a
// STALE EARLY fire left over from a resolve->reject(reopen)->re-resolve cycle (the new +30d
// job reuses the same deterministic jobId and overwrites the old timer — but we defend
// anyway). The guard chain, in order, makes every one of these harmless:
//   1. reportId present                          — else nothing to act on.
//   2. report still exists                       — deleted/not-found => no-op.
//   3. current status === RESOLVED               — reporter accepted (CLOSED_BY_USER),
//                                                   rejected (REOPENED), or a prior fire
//                                                   already closed it => NEVER overwrite.
//   4. now >= resolvedOn + AUTO_CLOSE_MS          — a stale EARLY fire (window not yet
//                                                   elapsed against the CURRENT resolvedOn)
//                                                   is a no-op.
//   5. canTransition(current, CLOSED_BY_SYSTEM, SYSTEM) — belt-and-braces legality check.
// Only when ALL pass do we apply CLOSED_BY_SYSTEM (version+1 monotonic, updatedOn=now) and
// append ONE statusHistory row (actorRole = SYSTEM, NEVER an id — anonymity, rule 16), then
// save() with the resolve-report.js abort-detection (errorsBefore / try-catch / error-stack
// length). On any failure we log and return — the report stays RESOLVED and the SLA digest
// backstop (A-F18) can still catch it; the job may also re-fire.
//
// ANONYMITY (rule 30). adminReportDoc binds NO reporterId / contactMethod / contactValue, so
// nothing here can read or write a reporter identity. actorRole is the SYSTEM token (no id).
// The deferred X6 MSG_REPORT_CLOSED payload is identity-free ({ reportId, newStatus }) — see
// the post-save hook below.
//
// NO sendResponse — this is a system job with no interactive user (the admin in whose context
// it fires did not initiate it). The outcome is recorded via D.log only.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  versionField,
  updatedOnField,
  resolvedOnField,
} from "../sections/manual-log";
import { appendStatusHistoryRow } from "./status-history-writer";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import {
  ACTOR_ROLE,
  TRANSITION_ACTOR,
  TIMING,
  MSG,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import {
  broadcastBotMessage,
  resolvePeerBotId,
} from "../../../lib/notifications";
import { INTENT } from "../constants";

const AUTO_CLOSE_NOTE =
  "Automatically closed after the 30-day response window with no reporter action.";

export const autoCloseReport = Intent.Create({
  intentId: INTENT.AUTO_CLOSE_REPORT,
  prompt: "Auto-close a resolved report after the response window",
  state,
});

autoCloseReport.onResolution = async () => {
  // 1. Payload. job-scheduler delivers the scheduled message under .data; .payload is the
  //    defensive fallback (a manual invoke during testing). Missing reportId => nothing to
  //    act on. Silent (no user-facing message — this is a system job).
  const { reportId } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  if (!reportId) {
    D.log({ message: "A-F17: autoCloseReport fired without a reportId" });
    return;
  }

  // 2. Attach to the existing context (Redis buffer) and re-read the report FRESH by
  //    reportId — independent of whose context this fired in.
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 3. Existence — no hydrated reportId means the report was deleted / not found. Safe no-op.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    D.log({
      message: "A-F17: auto-close no-op (report not found)",
      data: { reportId },
    });
    return;
  }

  const current = adminReportDoc.f[statusField.id]?.value || "";

  // 4. GUARD A — status must still be RESOLVED. If the reporter already accepted
  //    (CLOSED_BY_USER), rejected (REOPENED), or a prior duplicate fire already closed it
  //    (CLOSED_BY_SYSTEM), this is a no-op. NEVER overwrite a non-RESOLVED status.
  if (current !== STATUS.RESOLVED) {
    D.log({
      message: "A-F17: auto-close no-op (status no longer RESOLVED)",
      data: { reportId, current },
    });
    return;
  }

  // 5. GUARD B — the +30d window must have genuinely elapsed against the CURRENT resolvedOn.
  //    Defends a STALE EARLY fire left over from a resolve->reopen->re-resolve cycle: the
  //    re-resolve set a later resolvedOn (and re-armed a new timer with the same jobId), so
  //    an old fire that arrives before the new window has closed is harmless.
  const resolvedOn = Number(adminReportDoc.f[resolvedOnField.id]?.value || 0);
  if (Date.now() < resolvedOn + TIMING.AUTO_CLOSE_MS) {
    D.log({
      message:
        "A-F17: auto-close no-op (response window not yet elapsed — stale early fire)",
      data: { reportId, resolvedOn, windowMs: TIMING.AUTO_CLOSE_MS },
    });
    return;
  }

  // 6. GUARD C — belt-and-braces legality against the state machine for the SYSTEM actor.
  //    RESOLVED --(SYSTEM, autoClose)--> CLOSED_BY_SYSTEM (lib/ticket-status.js).
  if (
    !canTransition(current, STATUS.CLOSED_BY_SYSTEM, TRANSITION_ACTOR.SYSTEM)
  ) {
    D.log({
      message: "A-F17: auto-close no-op (transition not permitted for SYSTEM)",
      data: { reportId, current, to: STATUS.CLOSED_BY_SYSTEM },
    });
    return;
  }

  // 7. Apply. version advances monotonically (read -> read+1) so other writers' guards and
  //    the audit trail stay coherent (same reasoning as resolve-report.js).
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = STATUS.CLOSED_BY_SYSTEM;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // 8. One statusHistory row, atomic with the report write (rule 12). actorRole = SYSTEM —
  //    NEVER an id (anonymity, rule 16).
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: STATUS.CLOSED_BY_SYSTEM,
    actorRole: ACTOR_ROLE.SYSTEM,
    note: AUTO_CLOSE_NOTE,
  });

  // 9. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate abort
  //    adds to the error stack WITHOUT throwing — detect it the way resolve-report.js does
  //    and do not claim success. On failure log + return: the report stays RESOLVED and the
  //    SLA digest backstop (A-F18) can catch it; the job may also re-fire harmlessly.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    D.log({
      message: "A-F17: report save failed on auto-close",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return; // save aborted via the error stack — do not claim success
  }

  // 10. Post-save hook (rule 16) — X6 MSG_REPORT_CLOSED. The admin app holds NO reporterId
  //     (rule 30) so it CANNOT address the reporter. We BROADCAST an identity-free
  //     { reportId, closeType: CLOSED_BY_SYSTEM } to the entire user bot; the user-side
  //     receiver (report-closed.js) loads by reportId and notifies ONLY its owning reporter
  //     (reporterId === state.user.userId — the ownership filter). AFTER save(), best-effort;
  //     a broadcast failure NEVER rolls back the (already-closed) report.
  try {
    const userBotId = await resolvePeerBotId(STATIC_DATA_KEYS.USER_BOT_ID);
    await broadcastBotMessage({
      type: MSG.REPORT_CLOSED,
      botId: userBotId,
      payload: { reportId, closeType: STATUS.CLOSED_BY_SYSTEM },
    });
  } catch (error) {
    D.log({
      message: "A-F17: X6 MSG_REPORT_CLOSED broadcast failed (non-fatal)",
      data: { reportId, error: String(error) },
    });
  }

  D.log({
    message: "A-F17: report auto-closed",
    data: { reportId, from: current, to: STATUS.CLOSED_BY_SYSTEM },
  });
};

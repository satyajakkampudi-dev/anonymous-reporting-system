// A-F16 — Auto-escalate job: OPEN -> ESCALATED after the SLA response window.
//
// The RECEIVING half of the "auto-escalate unactioned reports" flow. The SCHEDULER
// half is armed by the X1 receiver (admin app, on MSG_NEW_REPORT) — a LATER task that
// DEPENDS on A-F16 — so this handler is DORMANT until X1 ships and arms it (correct
// dependency order). When X1 lands it will arm a jobScheduler message on each NEW
// report, picking the delay BY SEVERITY:
//
//   const delayMs =
//     severity === SEVERITY.CRITICAL
//       ? TIMING.AUTO_ESCALATE_CRITICAL_MS   // +1 day  (D2)
//       : TIMING.AUTO_ESCALATE_DEFAULT_MS;   // +3 days (D2)
//
//   state.jobScheduler.scheduleMessage({
//     toUser: state.user.userId,                       // an admin's id (job context)
//     jobId: `${INTENT.AUTO_ESCALATE}-${reportId}`,    // deterministic per report
//     schedule: createdOn + delayMs,                   // SLA deadline (D2)
//     messages: [{ intentId: INTENT.AUTO_ESCALATE, data: { reportId } }],
//   });
//
// The scheduling contract X1 must honour: payload is { reportId } ONLY (no identity —
// rule 30); the delay is the CRITICAL/DEFAULT split above; the jobId is deterministic
// per report so a re-arm overwrites the prior timer. This frame defines the intent id
// and the receiving guard; it does NOT schedule anything itself.
//
// This is an INDEPENDENT INTENT (Context B — object graph EMPTY on entry; CLAUDE.md
// "Invocation Lifecycle"), NOT a button and NOT interactive. Mirror of auto-close.js
// (THE job-receiver precedent): read the payload from state.messageFromUser.data (the
// job-scheduler delivery slot; .payload is the defensive fallback for a manual invoke
// during testing), re-read the entity FRESH, and apply the transition ONLY behind a
// GUARD (rule 13). Everything else is a logged no-op.
//
// IDEMPOTENCY IS THE WHOLE GAME (ER-B8 — "duplicate or stale fires are safe no-ops").
// A scheduled job can fire twice or fire after the report has already moved on. The
// guard chain, in order, makes every one of these harmless:
//   1. reportId present                          — else nothing to act on.
//   2. report still exists                       — deleted/not-found => no-op.
//   3. current status === OPEN                   — escalate ONLY if still unactioned.
//        UNDER_REVIEW = an admin TOOK it into review (taking review IS the action that
//        defuses the SLA timer — do NOT also auto-escalate it); ESCALATED = already
//        escalated (duplicate fire); RESOLVED/terminal/WITHDRAWN = moved on. NEVER
//        overwrite a non-OPEN status.
//   4. canTransition(OPEN, ESCALATED, SYSTEM)     — belt-and-braces legality check.
// Only when ALL pass do we apply ESCALATED (assignedTo = SECONDARY_ADMIN, version+1
// monotonic, updatedOn=now) and append ONE statusHistory row (actorRole = SYSTEM,
// NEVER an id — anonymity, rule 16), then save() with auto-close.js abort-detection
// (errorsBefore / try-catch / error-stack length). On any failure we log and return —
// the report stays OPEN and the SLA digest backstop (A-F18) can still catch it; the
// job may also re-fire harmlessly.
//
// assignedTo (rule 14). Escalation ALWAYS routes to the SECONDARY compliance admin —
// identical to the manual escalate (escalate-report.js applyExtra). Stamp the ROLE
// token directly onto assignedTo. That is NOT a "hardcoded role query" (resolving WHICH
// USERS to notify is resolveAssignees' job, used by the deferred A-F15 hook below); it
// is simply stamping the routing target onto the report.
//
// ANONYMITY (rule 30). adminReportDoc binds NO reporterId / contactMethod / contactValue,
// so nothing here can read or write a reporter identity. actorRole is the SYSTEM token
// (no id); assignedTo is a ROLE token. The deferred X5 MSG_REPORT_STATUS_CHANGED payload
// is identity-free ({ reportId, newStatus: ESCALATED }) — see the post-save hook below.
//
// NO sendResponse — this is a system job with no interactive user (the admin in whose
// context it fires did not initiate it). The outcome is recorded via D.log only.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  versionField,
  updatedOnField,
  assignedToField,
} from "../sections/manual-log";
import { appendStatusHistoryRow } from "./status-history-writer";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import { ACTOR_ROLE, TRANSITION_ACTOR, ROLE } from "../../../lib/constants";
import { INTENT } from "../constants";

const AUTO_ESCALATE_NOTE =
  "Automatically escalated — no action taken within the response window.";

export const autoEscalate = Intent.Create({
  intentId: INTENT.AUTO_ESCALATE,
  prompt: "Auto-escalate an unactioned report past its SLA",
  state,
});

autoEscalate.onResolution = async () => {
  // 1. Payload. job-scheduler delivers the scheduled message under .data; .payload is the
  //    defensive fallback (a manual invoke during testing). Missing reportId => nothing to
  //    act on. Silent (no user-facing message — this is a system job).
  const { reportId } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  if (!reportId) {
    D.log({ message: "A-F16: autoEscalate fired without a reportId" });
    return;
  }

  // 2. Attach to the existing context (Redis buffer) and re-read the report FRESH by
  //    reportId — independent of whose context this fired in.
  await Context.Create(state.currentTabId, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 3. Existence — no hydrated reportId means the report was deleted / not found. Safe no-op.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    D.log({
      message: "A-F16: auto-escalate no-op (report not found)",
      data: { reportId },
    });
    return;
  }

  const current = adminReportDoc.f[statusField.id]?.value || "";

  // 4. GUARD A (rule 13 / ER-B8) — status must still be OPEN (still unactioned, nobody
  //    took it into review). If an admin actioned it (UNDER_REVIEW — taking review IS the
  //    action that defuses the SLA timer), it is already escalated (ESCALATED — duplicate
  //    fire), or it moved on (RESOLVED / terminal / WITHDRAWN), this is a no-op. NEVER
  //    overwrite a non-OPEN status.
  if (current !== STATUS.OPEN) {
    D.log({
      message: "A-F16: auto-escalate no-op (status no longer OPEN)",
      data: { reportId, current },
    });
    return;
  }

  // 5. GUARD B — belt-and-braces legality against the state machine for the SYSTEM actor.
  //    OPEN --(SYSTEM, autoEscalate)--> ESCALATED (lib/ticket-status.js).
  if (!canTransition(current, STATUS.ESCALATED, TRANSITION_ACTOR.SYSTEM)) {
    D.log({
      message:
        "A-F16: auto-escalate no-op (transition not permitted for SYSTEM)",
      data: { reportId, current, to: STATUS.ESCALATED },
    });
    return;
  }

  // 6. Apply. Escalation re-routes to the SECONDARY admin (rule 14, same as manual
  //    escalate). version advances monotonically (read -> read+1) so other writers'
  //    guards and the audit trail stay coherent (same reasoning as auto-close.js).
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = STATUS.ESCALATED;
  adminReportDoc.f[assignedToField.id].value = ROLE.SECONDARY_ADMIN;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // 7. One statusHistory row, atomic with the report write (rule 12). actorRole = SYSTEM —
  //    NEVER an id (anonymity, rule 16).
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: STATUS.ESCALATED,
    actorRole: ACTOR_ROLE.SYSTEM,
    note: AUTO_ESCALATE_NOTE,
  });

  // 8. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate
  //    abort adds to the error stack WITHOUT throwing — detect it the way auto-close.js
  //    does and do not claim success. On failure log + return: the report stays OPEN and
  //    the SLA digest backstop (A-F18) can catch it; the job may also re-fire harmlessly.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    D.log({
      message: "A-F16: report save failed on auto-escalate",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return; // save aborted via the error stack — do not claim success
  }

  // 9. DEFERRED hooks (comments only — do NOT invent senders):
  //    - A-F15 (notify the secondary admins): resolveAssignees(report) to find the
  //      SECONDARY admin user(s), then sendAdminEmail / sendAdminWebPush. A-F15 owns the
  //      senders; routing is resolveAssignees' job (rule 14). Payload identity-free.
  //    - X5 (MSG_REPORT_STATUS_CHANGED): identity-free { reportId, newStatus: ESCALATED }
  //      (NO identity, NO actorId — rule 16/30). X5 DEPENDS on A-F16 and owns the sender.

  D.log({
    message: "A-F16: report auto-escalated",
    data: { reportId, from: current, to: STATUS.ESCALATED },
  });
};

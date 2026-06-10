// A-F16 - Auto-escalate job: OPEN -> ESCALATED after the SLA response window.
//
// The RECEIVING half of the "auto-escalate unactioned reports" flow. The SCHEDULER
// half is armed by the X1 receiver (admin app, on MSG_NEW_REPORT) - a LATER task that
// DEPENDS on A-F16 - so this handler is DORMANT until X1 ships and arms it (correct
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
// The scheduling contract X1 must honour: payload is { reportId } ONLY (no identity -
// rule 30); the delay is the CRITICAL/DEFAULT split above; the jobId is deterministic
// per report so a re-arm overwrites the prior timer. This frame defines the intent id
// and the receiving guard; it does NOT schedule anything itself.
//
// This is an INDEPENDENT INTENT (Context B - object graph EMPTY on entry; CLAUDE.md
// "Invocation Lifecycle"), NOT a button and NOT interactive. Mirror of auto-close.js
// (THE job-receiver precedent): read the payload from state.messageFromUser.data (the
// job-scheduler delivery slot; .payload is the defensive fallback for a manual invoke
// during testing), re-read the entity FRESH, and apply the transition ONLY behind a
// GUARD (rule 13). Everything else is a logged no-op.
//
// IDEMPOTENCY IS THE WHOLE GAME (ER-B8 - "duplicate or stale fires are safe no-ops").
// A scheduled job can fire twice or fire after the report has already moved on. The
// guard chain, in order, makes every one of these harmless:
//   1. reportId present                          - else nothing to act on.
//   2. report still exists                       - deleted/not-found => no-op.
//   3. current status === OPEN                   - escalate ONLY if still unactioned.
//        UNDER_REVIEW = an admin TOOK it into review (taking review IS the action that
//        defuses the SLA timer - do NOT also auto-escalate it); ESCALATED = already
//        escalated (duplicate fire); RESOLVED/terminal/WITHDRAWN = moved on. NEVER
//        overwrite a non-OPEN status.
//   4. canTransition(OPEN, ESCALATED, SYSTEM)     - belt-and-braces legality check.
// Only when ALL pass do we apply ESCALATED (assignedTo = SECONDARY_ADMIN, version+1
// monotonic, updatedOn=now) and append ONE statusHistory row (actorRole = SYSTEM,
// NEVER an id - anonymity, rule 16), then save() with auto-close.js abort-detection
// (errorsBefore / try-catch / error-stack length). On any failure we log and return -
// the report stays OPEN and the SLA digest backstop (A-F18) can still catch it; the
// job may also re-fire harmlessly.
//
// assignedTo (rule 14). Escalation ALWAYS routes to the SECONDARY compliance admin -
// identical to the manual escalate (escalate-report.js applyExtra). Stamp the ROLE
// token directly onto assignedTo. That is NOT a "hardcoded role query" (resolving WHICH
// USERS to notify is resolveAssignees' job, used by the A-F15 dispatchAdminNotify hook
// below); it is simply stamping the routing target onto the report.
//
// ANONYMITY (rule 30). adminReportDoc binds NO reporterId / contactMethod / contactValue,
// so nothing here can read or write a reporter identity. actorRole is the SYSTEM token
// (no id); assignedTo is a ROLE token. The deferred X5 MSG_REPORT_STATUS_CHANGED payload
// is identity-free ({ reportId, newStatus: ESCALATED }) - see the post-save hook below.
//
// NO sendResponse - this is a system job with no interactive user (the admin in whose
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
  severityField,
  categoryField,
  urgencyField,
  againstAdminField,
  createdOnField,
} from "../sections/manual-log";
import { appendStatusHistoryRow } from "./status-history-writer";
import { saveDocWithSubCollections } from "../../../lib/persist";
import { dispatchAdminNotify, NOTIFY_EVENT } from "./admin-notify";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import { ACTOR_ROLE, TRANSITION_ACTOR, ROLE } from "../../../lib/constants";
import { INTENT } from "../constants";

const AUTO_ESCALATE_NOTE =
  "Automatically escalated - no action taken within the response window.";

export const autoEscalate = Intent.Create({
  intentId: INTENT.AUTO_ESCALATE,
  prompt: "Auto-escalate an unactioned report past its SLA",
  state,
});

// Shared OPEN -> ESCALATED transition (MP-FIX-ESCALATE-DECOUPLE, framework-mapping rule 34).
// Called by BOTH the scheduled job (autoEscalate.onResolution, timely path) AND the A-F18
// SLA-digest sweep (assignee-independent backstop) - so escalation no longer depends on the
// X1 receiver having armed a timer (which is skipped when no admin is seeded). GUARDED +
// idempotent (rule 13): re-reads the report FRESH and escalates ONLY if still OPEN, so a
// double-fire (job + sweep, or duplicate delivery) is a safe no-op. Returns
// { escalated, reason }. Never throws into the caller. Identity-free (rule 16/30).
export const escalateOpenReport = async (reportId) => {
  if (!reportId) return { escalated: false, reason: "no-reportId" };

  // Attach to the existing context and re-read the report FRESH by reportId - independent
  // of whose context this fired in (job, sweep, or manual invoke).
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  await adminReportDoc.loadDocument({ reportId });

  // Existence - no hydrated reportId means the report was deleted / not found. Safe no-op.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    D.log({
      message: "A-F16: auto-escalate no-op (report not found)",
      data: { reportId },
    });
    return { escalated: false, reason: "not-found" };
  }

  const current = adminReportDoc.f[statusField.id]?.value || "";

  // GUARD A (rule 13 / ER-B8) - status must still be OPEN. UNDER_REVIEW (an admin took it),
  // ESCALATED (already escalated - duplicate fire), RESOLVED/terminal/WITHDRAWN (moved on)
  // are all no-ops. NEVER overwrite a non-OPEN status.
  if (current !== STATUS.OPEN) {
    D.log({
      message: "A-F16: auto-escalate no-op (status no longer OPEN)",
      data: { reportId, current },
    });
    return { escalated: false, reason: "not-open" };
  }

  // GUARD B - belt-and-braces state-machine legality for the SYSTEM actor.
  if (!canTransition(current, STATUS.ESCALATED, TRANSITION_ACTOR.SYSTEM)) {
    D.log({
      message:
        "A-F16: auto-escalate no-op (transition not permitted for SYSTEM)",
      data: { reportId, current, to: STATUS.ESCALATED },
    });
    return { escalated: false, reason: "not-permitted" };
  }

  // Apply. Re-route to SECONDARY (rule 14); version advances monotonically; stamp updatedOn.
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = STATUS.ESCALATED;
  adminReportDoc.f[assignedToField.id].value = ROLE.SECONDARY_ADMIN;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // One statusHistory row, atomic with the report write (rule 12). actorRole = SYSTEM.
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: STATUS.ESCALATED,
    actorRole: ACTOR_ROLE.SYSTEM,
    note: AUTO_ESCALATE_NOTE,
  });

  // Persist (gate-abort detection via the error stack, as auto-close.js does).
  const errorsBefore = (state.errorStack || []).length;
  try {
    await saveDocWithSubCollections(adminReportDoc);
  } catch (error) {
    D.log({
      message: "A-F16: report save failed on auto-escalate",
      data: { reportId, error: String(error) },
    });
    return { escalated: false, reason: "save-failed" };
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return { escalated: false, reason: "save-aborted" };
  }

  D.log({
    message: "A-F16: auto-escalate APPLIED (OPEN -> ESCALATED)",
    data: { reportId },
  });

  // A-F15 admin-notify dispatch (rule 16 - ONLY after a clean save). Notify the SECONDARY
  // admins this report was just routed to. Best-effort - never fails the transition.
  try {
    await dispatchAdminNotify(
      {
        reportId,
        status: STATUS.ESCALATED,
        severity: adminReportDoc.f[severityField.id]?.value,
        category: adminReportDoc.f[categoryField.id]?.value,
        urgency: adminReportDoc.f[urgencyField.id]?.value,
        assignedTo: adminReportDoc.f[assignedToField.id]?.value,
        againstAdmin: !!adminReportDoc.f[againstAdminField.id]?.value,
        createdOn: adminReportDoc.f[createdOnField.id]?.value,
      },
      { event: NOTIFY_EVENT.ESCALATED }
    );
  } catch (error) {
    D.log({
      message:
        "A-F15: dispatchAdminNotify errored after auto-escalate (ignored)",
      data: { reportId, error: String(error) },
    });
  }

  // X5 (MSG_REPORT_STATUS_CHANGED) is owned by its cross-app task - nothing sent here.

  D.log({
    message: "A-F16: report auto-escalated",
    data: { reportId, from: current, to: STATUS.ESCALATED },
  });
  return { escalated: true, reason: "ok" };
};

autoEscalate.onResolution = async () => {
  // job-scheduler delivers the scheduled message under .data; .payload is the manual-invoke
  // fallback. The shared escalateOpenReport does the guarded transition.
  const { reportId } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  D.log({ message: "A-F16: autoEscalate INVOKED", data: { reportId } });
  if (!reportId) {
    D.log({ message: "A-F16: autoEscalate fired without a reportId" });
    return;
  }
  await escalateOpenReport(reportId);
};

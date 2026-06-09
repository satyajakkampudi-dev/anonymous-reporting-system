// A-E-escalateReport — admin "Escalate" transition (A-F10).
//
//   OPEN / UNDER_REVIEW / REOPENED  --(any admin)-->  ESCALATED
//
// Escalation re-routes the report to the SECONDARY compliance admin (rule 14):
// assignedTo = ROLE.SECONDARY_ADMIN. From ESCALATED onward the secondary admin's
// transitions (take-review / resolve) are the only legal admin moves (canTransition).
//
// Per-action transition POPUP (framework-mapping rule 29): like resolve, escalate opens
// a sendQuickFormResponse() to capture an OPTIONAL note (resolve's note is mandatory;
// escalate's is optional — the reporter is not owed an escalation reason). The popup uses
// the SHARED noteCaptureDoc, whose single onSubmit slot is owned by the shared dispatcher
// frames/note-transition.js. This frame does TWO things:
//
//   1. registerNoteTransition(STATUS.ESCALATED, …) at module load — the command-registry
//      entry the dispatcher looks up by target status. successMessage is escalate's
//      confirmation; applyExtra is escalate's ONLY transition-specific write
//      (assignedTo = SECONDARY_ADMIN). All the guard / fresh-read / concurrency /
//      monotonic-version / statusHistory / save discipline lives once in the dispatcher.
//
//   2. escalateReport.onResolution — the trigger intent (independent intent, Context B —
//      object graph EMPTY on entry; CLAUDE.md "Invocation Lifecycle"). Fired by the
//      "Escalate" button in the Manage-actions card (A-D-manageactions): data-action=
//      "intent", intentId = escalateReport, data-payload '{"reportId":"..."}'. It attaches
//      to the existing context (Context.Create — Redis buffer, NO loadDocument: rule 22),
//      runs a CHEAP pre-popup guard off the buffer (defence-in-depth; the AUTHORITATIVE
//      guard re-runs on submit against a fresh MongoDB read in the dispatcher), stashes
//      BOTH the reportId AND the target status (so the shared dispatcher knows which
//      transition armed it), resets the SHARED capture Doc IN PLACE (rule 26 — docId
//      first, then clear values; NEVER cloneAndInit) and opens the note popup.
//
// assignedTo (rule 14). Escalation ALWAYS routes to SECONDARY_ADMIN, so applyExtra writes
// the ROLE token directly to the assignedTo column. That is NOT a "hardcoded role query"
// (which rule 14 forbids for resolving WHICH USERS to notify — that is resolveAssignees'
// job, used later in A-F15); it is simply stamping the routing target onto the report.
//
// ANONYMITY (rule 30). adminReportDoc binds no reporter-identity field; the optional note
// lands in statusHistory.note only; the deferred hooks carry { reportId, newStatus } only.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, noteCaptureDoc } from "../docs/admin-report-doc";
import { statusField, assignedToField } from "../sections/manual-log";
import { registerNoteTransition } from "./note-transition";
import { NOTIFY_EVENT } from "./admin-notify";
import { resolveAdminRole } from "../../../lib/access";
import { canTransition, STATUS, statusLabel } from "../../../lib/ticket-status";
import { ERROR_CODES, ROLE } from "../../../lib/constants";
import { CONTEXT, INTENT, STATE_KEYS } from "../constants";

// Shared copy so the pre-popup guard and the dispatcher's authoritative guard surface
// the SAME message for the same condition (no drift).
const ILLEGAL_MSG =
  "This report can no longer be escalated — its status has changed. Please refresh to see the latest update.";

// --- 1. Register the ESCALATED entry in the shared note-transition registry ---
registerNoteTransition(STATUS.ESCALATED, {
  successMessage: (reportId) =>
    `Report **${reportId}** has been **${statusLabel(STATUS.ESCALATED)}** to the secondary compliance admin. It is now theirs to action — the change has been recorded in the report's timeline.`,
  // rule 14: escalation re-routes to the secondary admin. Stamp the ROLE token directly.
  applyExtra: (doc) => {
    doc.f[assignedToField.id].value = ROLE.SECONDARY_ADMIN;
  },
  // A-F15: after a clean save the dispatcher notifies the SECONDARY admins this report
  // was just routed to (resolveAssignees honours the live assignedTo = SECONDARY_ADMIN).
  // closeRejected (A-F11) deliberately omits notifyEvent — closing-as-rejected does not
  // notify admins.
  notifyEvent: NOTIFY_EVENT.ESCALATED,
});

export const escalateReport = Intent.Create({
  intentId: INTENT.ESCALATE_REPORT,
  prompt: "Escalate a report to the secondary compliance admin",
  state,
});

// --- 2. Trigger intent: cheap pre-popup guard off the buffer, then open the popup ---
escalateReport.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for escalateReport");
    return;
  }

  // 2. Authorise — authoritative role re-resolution (NOT the display stash). A thrown
  //    read (poor maritime link) is a neutral retry, not a deny.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F10: escalateReport role resolution failed (pre-popup)",
      data: { reportId, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to escalate this report."
    );
    return;
  }

  // 3. Attach to the manage tab (stable per-screen id, rule 37 — the re-render via
  //    openManageReport lands in the same tab), then re-read the report fresh (rule 22).
  await Context.CreateAndInit(CONTEXT.MANAGE_REPORT, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 4. Cheap pre-popup guard (defence-in-depth beyond the hidden button). The
  //    AUTHORITATIVE re-read + guard happens on submit (in the shared dispatcher).
  const status = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(status, STATUS.ESCALATED, role)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    return;
  }

  // 5. Stash the id AND the target status for the shared dispatcher (a separate
  //    invocation; both survive via Redis). The dispatcher reads PENDING_NOTE_TARGET to
  //    learn that THIS trigger armed the ESCALATED transition (vs closeRejected, A-F11).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);
  state.setField(STATE_KEYS.PENDING_NOTE_TARGET, STATUS.ESCALATED);

  // 6. Reset the SHARED capture Doc in place (rule 26 — never cloneAndInit). docId FIRST,
  //    then clear values, so the cleared buffer targets the new empty path.
  noteCaptureDoc.docId = state.getUniqueId();
  for (const field of noteCaptureDoc.fields) {
    field.value = null;
  }
  noteCaptureDoc.title = "Escalate report";
  noteCaptureDoc.sendQuickFormResponse();
};

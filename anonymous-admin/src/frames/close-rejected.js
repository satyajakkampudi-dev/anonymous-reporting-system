// A-E-closeRejected — admin "Close as rejected" transition (A-F11).
//
//   REOPENED  --(any admin)-->  CLOSED_REJECTED  (terminal)
//
// When the reporter rejects a resolution the report moves to REOPENED. The admin
// can either re-action it (take-review / escalate) or, when the rejection is itself
// unfounded, force-close it as rejected — ER-B6 "force-close past the reopen cap".
// The reopen cap (ER-B6 / D10) gates ONLY the REPORTER's reject->reopen move; it does
// NOT gate the admin close. So closeRejected needs no cap check — canTransition alone
// authorises the move (REOPENED -> CLOSED_REJECTED for TRANSITION_ACTOR.ADMIN, i.e.
// EITHER the primary or the secondary admin — see lib/ticket-status STATUS_TRANSITIONS).
//
// CLOSED_REJECTED is TERMINAL — no outgoing transitions (lib/ticket-status). There is
// NO closedOn column (SPEC.md): closes are tracked via status + statusHistory.changedOn.
//
// Per-action transition POPUP (framework-mapping rule 29): like escalate, closeRejected
// opens a sendQuickFormResponse() to capture an OPTIONAL note (the reporter is not owed a
// reason for the close beyond the X6 closed contract). The popup uses the SHARED
// noteCaptureDoc, whose single onSubmit slot is owned by the shared dispatcher
// frames/note-transition.js. This frame does TWO things — exactly mirroring escalate:
//
//   1. registerNoteTransition(STATUS.CLOSED_REJECTED, …) at module load — the command-
//      registry entry the dispatcher looks up by target status. successMessage is the
//      close confirmation; applyExtra is a NO-OP — CLOSED_REJECTED has no transition-
//      specific column writes (status/version/updatedOn + statusHistory are written by
//      the shared dispatcher; no closedOn column exists to stamp). The dispatcher calls
//      cfg.applyExtra UNCONDITIONALLY, so the entry MUST supply one even if it does nothing.
//
//   2. closeRejected.onResolution — the trigger intent (independent intent, Context B —
//      object graph EMPTY on entry; CLAUDE.md "Invocation Lifecycle"). Fired by the
//      "Close as rejected" button in the Manage-actions card (A-D-manageactions):
//      data-action="intent", intentId = closeRejected, data-payload '{"reportId":"..."}'.
//      It attaches to the existing context (Context.Create — Redis buffer, NO loadDocument:
//      rule 22), runs a CHEAP pre-popup guard off the buffer (defence-in-depth; the
//      AUTHORITATIVE guard re-runs on submit against a fresh MongoDB read in the
//      dispatcher), stashes BOTH the reportId AND the target status (so the shared
//      dispatcher knows which transition armed it), resets the SHARED capture Doc IN
//      PLACE (rule 26 — docId first, then clear values; NEVER cloneAndInit) and opens
//      the note popup.
//
// ANONYMITY (rule 30). adminReportDoc binds no reporter-identity field; the optional note
// lands in statusHistory.note only; the deferred hooks carry { reportId, newStatus } only.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, noteCaptureDoc } from "../docs/admin-report-doc";
import { statusField } from "../sections/manual-log";
import { registerNoteTransition } from "./note-transition";
import { resolveAdminRole } from "../../../lib/access";
import { canTransition, STATUS, statusLabel } from "../../../lib/ticket-status";
import { ERROR_CODES } from "../../../lib/constants";
import { CONTEXT, INTENT, STATE_KEYS } from "../constants";

// Shared copy so the pre-popup guard and the dispatcher's authoritative guard surface
// the SAME message for the same condition (no drift). Close-specific wording.
const ILLEGAL_MSG =
  "This report can no longer be closed — its status has changed. Please refresh to see the latest update.";

// --- 1. Register the CLOSED_REJECTED entry in the shared note-transition registry ---
registerNoteTransition(STATUS.CLOSED_REJECTED, {
  successMessage: (reportId) =>
    `Report **${reportId}** is now **${statusLabel(STATUS.CLOSED_REJECTED)}**. This is a final, terminal decision — no further changes are possible. The close has been recorded in the report's timeline.`,
  // CLOSED_REJECTED is terminal and has NO transition-specific column writes — status /
  // version / updatedOn + the statusHistory row are all written by the shared dispatcher,
  // and there is no closedOn column to stamp (SPEC.md). The dispatcher calls applyExtra
  // UNCONDITIONALLY, so this entry must supply a function even though it does nothing.
  applyExtra: () => {},
});

export const closeRejected = Intent.Create({
  intentId: INTENT.CLOSE_REJECTED,
  prompt: "Close a reopened report as rejected",
  state,
});

// --- 2. Trigger intent: cheap pre-popup guard off the buffer, then open the popup ---
closeRejected.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for closeRejected");
    return;
  }

  // 2. Authorise — authoritative role re-resolution (NOT the display stash). A thrown
  //    read (poor maritime link) is a neutral retry, not a deny.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F11: closeRejected role resolution failed (pre-popup)",
      data: { reportId, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to close this report."
    );
    return;
  }

  // 3. Attach to the manage tab (stable per-screen id, rule 37 — the re-render via
  //    openManageReport lands in the same tab), then re-read the report fresh (rule 22).
  await Context.CreateAndInit(CONTEXT.MANAGE_REPORT, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 4. Cheap pre-popup guard (defence-in-depth beyond the hidden button). The
  //    AUTHORITATIVE re-read + guard happens on submit (in the shared dispatcher).
  //    Only REOPENED can close-as-rejected, for any admin — canTransition enforces both.
  const status = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(status, STATUS.CLOSED_REJECTED, role)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    return;
  }

  // 5. Stash the id AND the target status for the shared dispatcher (a separate
  //    invocation; both survive via Redis). The dispatcher reads PENDING_NOTE_TARGET to
  //    learn that THIS trigger armed the CLOSED_REJECTED transition (vs escalate, A-F10).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);
  state.setField(STATE_KEYS.PENDING_NOTE_TARGET, STATUS.CLOSED_REJECTED);

  // 6. Reset the SHARED capture Doc in place (rule 26 — never cloneAndInit). docId FIRST,
  //    then clear values, so the cleared buffer targets the new empty path.
  noteCaptureDoc.docId = state.getUniqueId();
  for (const field of noteCaptureDoc.fields) {
    field.value = null;
  }
  noteCaptureDoc.title = "Close as rejected";
  noteCaptureDoc.sendQuickFormResponse();
};

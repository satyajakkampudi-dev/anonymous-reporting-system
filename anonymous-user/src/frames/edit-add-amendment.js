// EDIT frame: addAmendment (U-E-addAmendment / U-F13) — the APPEND-ONLY "Amend" popup.
//
// A reporter adds a timestamped note (+ optional evidence) to a NON-TERMINAL report.
// The original reporter-entered fields stay locked — there is no edit and no delete
// path (D16, framework-mapping rule 25). This file owns BOTH halves of the documented
// "Adding Rows via Popup" flow (collection guide § "Adding Rows via Popup"):
//
//   1. addAmendment.onResolution — the Add intent. Independent intent (Context B):
//      the reportId arrives ONE LEVEL DEEP under state.messageFromUser.payload
//      (CLAUDE.md "Custom HTML Payloads"), never at the top level. It ATTACHES to the
//      existing context (Context.Create — Redis-only, NO loadDocument: rule 22) so the
//      report the reporter is viewing stays in the buffer, then resets the registered
//      amendmentDoc IN PLACE (docId FIRST, then clear values — rule 26; NEVER
//      cloneAndInit) and opens the quick-edit popup.
//
//   2. amendmentDoc.onSubmit — the persist handler. Context A (object graph live on
//      popup-CONFIRM): generate the row primary key, sanitise the note, stamp amendedOn,
//      add the row to the LIVE collection via self.collection (never the module
//      singleton — CLAUDE.md "Collection and parent-Doc access"), persist through the
//      parent report, then re-sign the amendment evidence and re-render the Display Doc
//      so the new row appears in the Amendments table (U-D-amendments).
//
// Doc handlers live in frames/ (AGENTS.md File Organisation) so they can import the
// Field references from sections/. The amendmentDoc confirm/cancel buttons are set on
// its constructor (report-doc.js) so the quick-form has Save/Cancel.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";

import { reportDoc, amendmentDoc } from "../docs/report-doc";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { statusField } from "../sections/report-details";
// Field references only — the rows/collection are reached via self.collection in the
// Context-A onSubmit handler (CLAUDE.md "Collection and parent-Doc access"), never via
// the module-level collection singleton.
import {
  amendmentIdField,
  amendmentNoteField,
  amendedOnField,
} from "../sections/amendments";
import { prepareAmendmentsEvidence } from "../sections/display/amendments";
import { isActionAllowed, ACTION } from "../../../lib/ticket-status";
import { ACTOR_ROLE, ERROR_CODES } from "../../../lib/constants";
import { sanitiseText } from "../../../lib/validation";
import { INTENT } from "../constants";

export const addAmendment = Intent.Create({
  intentId: INTENT.ADD_AMENDMENT,
  prompt: "Add an amendment to a report",
  state,
});

// --- 1. Add intent: open an empty quick-form popup on the registered amendmentDoc ---
addAmendment.onResolution = async () => {
  // Payload field lives under .payload (invoke_intent envelope), not at the top level.
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for addAmendment");
    return;
  }

  // Attach to the EXISTING context (Redis buffer) — NOT loadDocument (rule 22). The
  // report the reporter opened (openReportDetail) is already hydrated in the buffer;
  // re-reading from MongoDB would waste a read and discard any in-flight buffer state.
  await Context.Create(state.currentTabId, { state });

  // Code-enforced non-terminal gate: Amend is legal only when the state machine lists
  // it for the reporter on the report's CURRENT status (the SAME single source of truth
  // the detail-actions card gates the button on). Defence beyond the hidden button —
  // a terminal/illegal status never reaches an append.
  const status = reportDoc.f[statusField.id]?.value || "";
  if (!isActionAllowed(status, ACTOR_ROLE.REPORTER, ACTION.AMEND)) {
    state.addErrorToStack(
      ERROR_CODES.ILLEGAL_TRANSITION,
      "This report can no longer be amended."
    );
    return;
  }

  // Reset the REGISTERED sub-entity Doc in place (rule 26 — never cloneAndInit).
  // Order matters: assign the new docId FIRST so the clear-values buffer unsets target
  // the new (empty) path, not the previous Add's saved entries.
  amendmentDoc.docId = state.getUniqueId();
  for (const field of amendmentDoc.fields) {
    field.value = null;
  }
  amendmentDoc.title = "Add amendment";
  amendmentDoc.sendQuickFormResponse();
};

// --- 2. Persist handler: append the new row and re-render (Context A, graph live) ---
amendmentDoc.onSubmit = async (self) => {
  // Generate the hidden row primary key on confirm (collection guide § "Adding Rows
  // via Popup") — never via a Field.onInit (which would write a phantom partial-row).
  if (!self.f[amendmentIdField.id].value) {
    self.f[amendmentIdField.id].value = state.getUniqueId();
  }

  // Sanitise the free-text note before persist (rule 10 — strip markup so it is safe
  // for the HTML card + any email use). Reject a note that sanitises to empty (markup-
  // only / abuse) — the field is mandatory, but sanitisation can hollow it out.
  const note = sanitiseText(self.f[amendmentNoteField.id].value);
  if (!note) {
    state.addErrorToStack(400, "Please enter an amendment note.");
    return;
  }
  self.f[amendmentNoteField.id].value = note;

  // Append-only audit stamp. Date.now() is the write time of this amendment.
  self.f[amendedOnField.id].value = Date.now();

  // Reach the LIVE collection + parent via self (never the module singletons —
  // CLAUDE.md "Collection and parent-Doc access in sub-entity handlers").
  const isInCollection = self.collection.rows.some((row) => row === self);
  if (!isInCollection) {
    self.collection.addRow(self);
  }

  try {
    await self.collection.parentDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "Could not save the amendment. Please try again."
    );
    D.log({
      message: "addAmendment: parentDoc.save() failed",
      data: {
        amendmentId: self.f[amendmentIdField.id]?.value,
        error: String(error),
      },
    });
    return;
  }

  // Re-sign every amendment's evidence (the new row may carry a file) BEFORE rendering
  // — section.onResponse is synchronous and NOT awaited, so signing must complete here
  // (S3 guide "Signed URLs before sendResponse"). The sub-collection now holds the new
  // row, so prepare() picks it up.
  await prepareAmendmentsEvidence();

  // Re-render the Display Doc so the Amendments table shows the appended row. The
  // amendments table is a CardsSet section on reportDisplayDoc (Two-Doc, rule 4) — the
  // Data Doc (reportDoc) is never sendResponse()d.
  reportDisplayDoc.sendResponse();
};

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
  amendmentsCollection,
  amendmentIdField,
  amendmentNoteField,
  amendmentEvidenceKeyField,
  amendedOnField,
} from "../sections/amendments";
import { prepareAmendmentsEvidence } from "../sections/display/amendments";
import { isActionAllowed, ACTION } from "../../../lib/ticket-status";
import { ACTOR_ROLE, ERROR_CODES } from "../../../lib/constants";
import { sanitiseText } from "../../../lib/validation";
import { saveDocWithSubCollections } from "../../../lib/persist";
import { showScreen, SCREEN } from "./display-nav";
import { CONTEXT, INTENT, STATE_KEYS } from "../constants";

// The LIVE embedded amendments collection on `parentDoc` — reached via the parent's own
// subCollections (the instance the framework loaded rows into + will serialise), never
// the stale module singleton (CLAUDE.md "Collection and parent-Doc access"). Matched by
// the collection's array-property name (rule 19). Falls back to the registered singleton.
const getAmendmentsCollection = (parentDoc) =>
  (parentDoc?.subCollections || []).find(
    (c) => c && c.name === amendmentsCollection.name
  ) || amendmentsCollection;

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

  // Fresh context + re-read the report (with its already-saved amendments) from
  // MongoDB. Context.Create CANNOT be used here — this dispatch carries no usable
  // tabId, so it throws "Cannot set properties of undefined (setting 'currentTabId')".
  // So accumulation does NOT go through the Redis buffer; it goes through MongoDB:
  // loadDocument rehydrates every previously-saved amendment row, onSubmit appends the
  // new one, and saveDocWithSubCollections persists the FULL array (the embedded
  // sub-collection now serialises — see lib/persist.js). That is what makes a 2nd
  // amendment ADD a row instead of overwriting the 1st.
  // Stable detail tab (rule 37): the amend popup overlays the detail tab and the
  // onSubmit re-render lands in the same tab.
  await Context.CreateAndInit(CONTEXT.REPORT_DETAIL, { state });
  await reportDoc.loadDocument({ reportId });
  // Stash the reportId so the popup-CONFIRM invocation (a SEPARATE Lambda call — see
  // onSubmit) can re-load this report and append to its existing amendments.
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);
  D.log({ message: "addAmendment: opening amend popup", data: { reportId } });

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

// --- 2. Persist handler: load existing amendments, append the new one, save, re-render.
//
// CRITICAL — accumulation, not override. The popup CONFIRM is a SEPARATE Lambda
// invocation from the Add intent (onResolution) that opened it. The amendments loaded
// when the popup opened are NOT in memory here, and Context.Create (which would restore
// them from the Redis buffer) CRASHES in this app (no usable tabId). So a naive
// addRow(self) saw an EMPTY collection and overwrote the previously-saved amendment.
// Fix: re-load the report fresh HERE — reportDoc.hasSubDocs is true, so loadDocument
// goes through buildDocumentFromContainer and rehydrates every already-saved amendment
// row — then append the new one as a NEW row and persist the full array via
// saveDocWithSubCollections (lib/persist — Doc.save alone never serialises in-memory
// sub-rows). This makes a 2nd amendment ADD a row instead of replacing the 1st.
// FrontM occasionally fires a popup CONFIRM twice for one click; unguarded, that would
// append the amendment twice. Module-level lock (reset per invocation; cold-start safe)
// — mirrors sailors-cart's variantProcessing guard (sailors-seller add-variant.js).
let amendmentProcessing = false;

amendmentDoc.onSubmit = async (self) => {
  if (amendmentProcessing) {
    D.log({ message: "addAmendment: duplicate onSubmit ignored (in-flight)" });
    return;
  }
  amendmentProcessing = true;
  try {
    // Capture the submitted values up-front — loadDocument below rebuilds the doc graph,
    // so we re-create the row from these locals (nothing is read off `self` afterwards).
    const amendmentId =
      self.f[amendmentIdField.id].value || state.getUniqueId();
    const note = sanitiseText(self.f[amendmentNoteField.id].value);
    if (!note) {
      state.addErrorToStack(400, "Please enter an amendment note.");
      return;
    }
    const evidence = self.f[amendmentEvidenceKeyField.id].value || null;
    const amendedOn = Date.now();

    const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
    if (!reportId) {
      state.addErrorToStack(
        400,
        "We lost track of the report. Please reopen it and try again."
      );
      return;
    }

    // Re-load the report (with all already-saved amendments) into its live embedded
    // collection. clearRows + addRow-per-entry happens inside buildDocumentFromContainer.
    await reportDoc.loadDocument({ reportId });
    const collection = getAmendmentsCollection(reportDoc);
    const existingCount = (collection.rows || []).length;

    // Append the new amendment as a NEW row. cloneDoc() is the framework's own row-creation
    // pattern (buildDocumentFromContainer) — a collection ROW, not an intent dispatch, so
    // the rule-26 cloneAndInit caveat (about popup form Docs) does not apply here.
    const row = collection.document.cloneDoc();
    row.docId = amendmentId;
    row.f[amendmentIdField.id].value = amendmentId;
    row.f[amendmentNoteField.id].value = note;
    if (evidence) {
      row.f[amendmentEvidenceKeyField.id].value = evidence;
    }
    row.f[amendedOnField.id].value = amendedOn;
    collection.addRow(row);
    D.log({
      message: "addAmendment: appending amendment row",
      data: {
        reportId,
        amendmentId,
        existingCount,
        newCount: collection.rows.length,
      },
    });

    try {
      await saveDocWithSubCollections(reportDoc);
    } catch (error) {
      state.addSystemErrorToStack(
        500,
        "Could not save the amendment. Please try again."
      );
      D.log({
        message: "addAmendment: save failed",
        data: { reportId, amendmentId, error: String(error) },
      });
      return;
    }
    D.log({
      message: "addAmendment: amendment saved",
      data: { reportId, amendmentId, total: collection.rows.length },
    });

    // Re-sign every amendment's evidence (the new row may carry a file) BEFORE rendering —
    // section.onResponse is synchronous and NOT awaited (S3 guide "Signed URLs before
    // sendResponse"). The collection now holds existing + new rows, so prepare() covers all.
    await prepareAmendmentsEvidence();

    // Re-render the Display Doc so the Amendments table shows the full, appended list.
    // showScreen(DETAIL) FIRST (rule 37): tabs are reused now, so section visibility is
    // not reset by a fresh tab — without this every screen's sections stack (broken UI).
    showScreen(SCREEN.DETAIL);
    reportDisplayDoc.sendResponse();
  } finally {
    amendmentProcessing = false;
  }
};

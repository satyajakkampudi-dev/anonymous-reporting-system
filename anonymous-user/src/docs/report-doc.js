// Data Doc + sub-entity Docs (constructors only — no event handlers; rule 6).
//
// reportDoc is the SHARED Data Doc (autoSave: true, audit: true) defined once in
// lib/collections/reports.js. It is re-exported here so src/sections/ attach their
// Fields to a single local import. NEVER sendResponse()d in the final architecture
// (framework-mapping rule 4) — the Display Doc (U-DISPLAY-SHELL) renders the screens.
//
// amendmentDoc and statusHistoryDoc are the per-row schema Docs for the two
// embedded sub-collections (forCollection: true on reportDoc). They are app-local
// (NOT shared) — each app declares its own view (admin amendments are read-only).
// docs/ import nothing but state (AGENTS.md dependency tree: docs/ → nothing).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, reportsCollection } from "../../../lib/collections/reports";

export { reportDoc, reportsCollection };

// Amendment sub-entity row. confirm/cancel are set on the constructor so the
// append-only Amend popup (U-E-addAmendment, later task) has Save/Cancel buttons
// when opened via sendQuickFormResponse() (framework checklist; rule 25/26).
export const amendmentDoc = new Doc("amendmentDoc", state, {
  confirm: "Save",
  cancel: "Cancel",
});

// Status-timeline sub-entity row. Written by the transition path only (never a
// popup) — no confirm/cancel needed; display-only on the user side.
export const statusHistoryDoc = new Doc("statusHistoryDoc", state, {});

// Data Doc + sub-entity Docs (constructors only - no event handlers; rule 6).
//
// adminReportDoc is the SHARED Data Doc (autoSave: true, audit: true) defined once
// in lib/collections/reports.js and re-exported here under the admin-local name so
// src/sections/ attach their Fields to a single local import. It binds ONLY the
// adminProjection field set + admin-entered fields - NEVER reporterId / contactMethod
// / contactValue / reporter-create audit (framework-mapping rule 30, C1, ER-A2).
// NEVER sendResponse()d (rule 4/8) - adminDisplayDoc (A-DISPLAY-SHELL) renders screens.
//
// amendmentDoc and statusHistoryDoc are the per-row schema Docs for the two embedded
// sub-collections (forCollection: true on adminReportDoc). They are app-local and
// READ-ONLY on the admin side (the reporter owns amendment appends, U-F13; the
// transition path owns statusHistory). docs/ import nothing but state + the shared
// Doc (AGENTS.md dependency tree: docs/ → nothing app-local).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, reportsCollection } from "../../../lib/collections/reports";

// Re-export the shared Doc + Collection under the admin-local names.
export { reportDoc as adminReportDoc, reportsCollection };

// Amendment sub-entity row schema - READ-ONLY on the admin side (no confirm/cancel,
// no add/edit/delete intent; rule 30). The reporter appends rows (U-F13).
export const amendmentDoc = new Doc("amendmentDoc", state, {});

// Status-timeline sub-entity row schema - written by the transition path only,
// display-only on the admin side.
export const statusHistoryDoc = new Doc("statusHistoryDoc", state, {});

// Per-action transition CAPTURE Doc for the "Resolve report" popup (framework-mapping
// rule 29, MP-FIX-ADMIN-POPUP-CAPTURE-DOCS). A Doc has exactly ONE onSubmit slot - if
// the resolve/escalate/closeRejected/overrideSeverity popups all bound to the shared
// adminReportDoc, their onSubmit handlers would clobber each other and every popup
// field would render together. So each per-action popup gets its OWN capture Doc.
// NOT autoSave (transient - never persisted; its field value is sanitised and copied
// onto adminReportDoc's hidden `resolution` column by frames/resolve-report.js).
// confirm/cancel give the quick-form its buttons. Mirrors the user app's rejectReasonDoc.
export const resolveCaptureDoc = new Doc("resolveCaptureDoc", state, {
  title: "Resolve report",
  autoSave: false,
  confirm: "Resolve",
  cancel: "Cancel",
});

// Per-action capture Doc for the "Override severity" popup (overrideSeverity, A-F12).
// Same rationale as resolveCaptureDoc: an isolated onSubmit + a one-field form. The
// transient capture field (sections/severity-popup.js) is validated and copied onto
// adminReportDoc's hidden `severity` infra column (sections/manual-log.js).
export const severityCaptureDoc = new Doc("severityCaptureDoc", state, {
  title: "Override severity",
  autoSave: false,
  confirm: "Save",
  cancel: "Cancel",
});

// Per-action capture Doc for the "Add a note" popup, SHARED by escalateReport (A-F10)
// and closeRejected (A-F11). Its single transient field carries the optional transition
// note - consumed into the appended statusHistory.note, NEVER persisted as a `reports`
// column (the field has no dbName). Same one-onSubmit-per-Doc rationale as above.
export const noteCaptureDoc = new Doc("noteCaptureDoc", state, {
  title: "Add a note",
  autoSave: false,
  confirm: "Save",
  cancel: "Cancel",
});

// REQUIRED: each capture Doc opened via sendQuickFormResponse() needs a backing
// Collection. The framework's Doc.onResolution (which runs on every quick-form CONFIRM,
// BEFORE onSubmit) unconditionally reads `this.collection.rows.length` (Doc.js debug
// line) - a collection-less capture Doc therefore throws "Cannot read properties of
// undefined (reading 'rows')" on submit, so the popup never persists. These collections
// are TRANSIENT: never queried or saved (the capture value is copied onto the report by
// the frame); they exist solely to give each capture Doc a defined `.collection`.
export const resolveCaptureCollection = new Collection(
  "resolveCaptureCollection",
  { document: resolveCaptureDoc, name: "resolveCapture", state }
);
export const severityCaptureCollection = new Collection(
  "severityCaptureCollection",
  { document: severityCaptureDoc, name: "severityCapture", state }
);
export const noteCaptureCollection = new Collection("noteCaptureCollection", {
  document: noteCaptureDoc,
  name: "noteCapture",
  state,
});

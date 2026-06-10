// resolveCaptureDoc - "Resolve report" capture popup section (rendering: standard, 1 column).
//
// Per-action CAPTURE Doc, NOT the shared adminReportDoc (framework-mapping rule 29,
// MP-FIX-ADMIN-POPUP-CAPTURE-DOCS): a Doc has one onSubmit slot, so binding every
// transition popup to adminReportDoc would make the resolve/escalate/closeRejected/
// overrideSeverity onSubmit handlers clobber each other and render all popup fields
// together. resolveCaptureDoc isolates the resolve popup's single capture field.
//
// Opened via sendQuickFormResponse() by resolveReport (A-E-resolveReport, frames/
// resolve-report.js), which sets resolveCaptureDoc.title before the call (rule 29).
// includeInQuickEdit: true so it appears in the quick-form popup; mandatory + TEXT_AREA.
//
// This is a TRANSIENT capture field - resolveCaptureDoc is never save()d, so the value
// never becomes a `reports` column here. On confirm, frames/resolve-report.js sanitises
// it and copies it onto adminReportDoc's hidden `resolution` column (sections/manual-log.js)
// + statusHistory. Mirror of the user app's transient rejectReasonInputField (rule 29).
//
// dbName is "resolutionInput" (NOT "resolution") and is inert (the Doc is never
// persisted); the persisted `resolution` column lives on adminReportDoc - collision
// with that column is exactly what the per-action capture-Doc design avoids.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { resolveCaptureDoc } from "../docs/admin-report-doc";

export const resolvePopupSection = new Section("resolvePopupSection", {
  title: "Resolve report",
  doc: resolveCaptureDoc,
  columns: 1,
  collapsable: false,
  state,
});

export const resolutionInputField = new Field("resolutionInputField", {
  title:
    "How was this report resolved? This is shared with the reporter and recorded in the report's timeline.",
  doc: resolveCaptureDoc,
  section: resolvePopupSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: true,
  includeInQuickEdit: true,
  dbName: "resolutionInput",
  state,
});

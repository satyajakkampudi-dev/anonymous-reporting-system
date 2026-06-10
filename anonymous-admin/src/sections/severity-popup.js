// severityCaptureDoc - "Override severity" capture popup section (rendering: standard, 1 column).
//
// Per-action CAPTURE Doc, NOT the shared adminReportDoc (framework-mapping rule 29,
// MP-FIX-ADMIN-POPUP-CAPTURE-DOCS): a Doc has one onSubmit slot, so binding every
// transition popup to adminReportDoc would make the resolve/escalate/closeRejected/
// overrideSeverity onSubmit handlers clobber each other and render all popup fields
// together. severityCaptureDoc isolates this popup's single capture field.
//
// Opened via sendQuickFormResponse() by overrideSeverity (A-F12, later task), which sets
// severityCaptureDoc.title before the call (rule 29). includeInQuickEdit: true so it
// appears in the quick-form popup; mandatory + DROPDOWN.
//
// This is a TRANSIENT capture field - severityCaptureDoc is never save()d, so the value
// never becomes a `reports` column here. On confirm, the overrideSeverity frame copies
// the chosen value onto adminReportDoc's hidden `severity` infra column
// (sections/manual-log.js). It therefore has NO dbName (the persisted column lives on
// adminReportDoc - collision with that column is exactly what this design avoids).
// Options are the raw SEVERITY tokens (LOW/MEDIUM/HIGH/CRITICAL) - written directly.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { SEVERITY } from "../../../lib/constants";
import { severityCaptureDoc } from "../docs/admin-report-doc";

export const severityPopupSection = new Section("severityPopupSection", {
  title: "Override severity",
  doc: severityCaptureDoc,
  columns: 1,
  collapsable: false,
  state,
});

export const severityInputField = new Field("severityInputField", {
  title: "Severity",
  doc: severityCaptureDoc,
  section: severityPopupSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  includeInQuickEdit: true,
  options: Object.values(SEVERITY), // LOW · MEDIUM · HIGH · CRITICAL
  state,
});

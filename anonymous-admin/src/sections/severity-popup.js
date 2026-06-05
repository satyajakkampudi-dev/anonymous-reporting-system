// adminReportDoc — "Override severity" popup section (rendering: standard, 1 column).
//
// Opened via sendQuickFormResponse() by overrideSeverity (A-F12, later task), which
// sets adminReportDoc.confirm = "Save" / .cancel = "Cancel" before the call (rule 29).
// `severity` is the editable infrastructure field (its only home is this section);
// the override feeds priority surfacing (A-F5) + auto-escalate timing. Options are the
// raw SEVERITY tokens (LOW/MEDIUM/HIGH/CRITICAL) — written directly, no label mapping.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { SEVERITY } from "../../../lib/constants";
import { adminReportDoc } from "../docs/admin-report-doc";

export const severityPopupSection = new Section("severityPopupSection", {
  title: "Override severity",
  doc: adminReportDoc,
  columns: 1,
  state,
});

export const severityField = new Field("severityField", {
  title: "Severity",
  doc: adminReportDoc,
  section: severityPopupSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  includeInQuickEdit: true,
  options: Object.values(SEVERITY), // LOW · MEDIUM · HIGH · CRITICAL
  dbName: "severity",
  state,
});

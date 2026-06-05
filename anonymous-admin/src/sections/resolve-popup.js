// adminReportDoc — "Resolve report" popup section (rendering: standard, 1 column).
//
// Opened via sendQuickFormResponse() by resolveReport (A-F9, later task), which sets
// adminReportDoc.confirm = "Resolve" / .cancel = "Cancel" before the call (rule 29).
// `resolution` is the ONLY persisted report column edited here; sanitised on save.
// includeInQuickEdit: true so it appears in the quick-form popup (rule 29).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";

export const resolvePopupSection = new Section("resolvePopupSection", {
  title: "Resolve report",
  doc: adminReportDoc,
  columns: 1,
  state,
});

export const resolutionField = new Field("resolutionField", {
  title: "Resolution",
  doc: adminReportDoc,
  section: resolvePopupSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: true,
  includeInQuickEdit: true,
  dbName: "resolution",
  state,
});

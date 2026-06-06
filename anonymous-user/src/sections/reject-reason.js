// rejectReasonDoc — the "Reopen report" reason-capture popup section (U-F11).
//
// A single mandatory free-text field, the ONLY thing the reporter fills in the
// sendQuickFormResponse() popup, so it carries includeInQuickEdit: true (rule:
// only includeInQuickEdit fields render in a quick form). This is a TRANSIENT
// capture field — rejectReasonDoc is never save()d, so the value never becomes a
// `reports` column here. On confirm, frames/reject-resolution.js sanitises it and
// copies it onto reportDoc.rejectReason (the persisted column) + statusHistory.note.
// Mirror of the admin transient `transitionNote` pattern (framework-mapping rule 29).
//
// dbName is given for completeness but is inert (the Doc is never persisted); it must
// NOT be "rejectReason" — that column lives on reportDoc (sections/report-details.js).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { rejectReasonDoc } from "../docs/report-doc";

export const rejectReasonSection = new Section("rejectReasonSection", {
  title: "Reopen report",
  doc: rejectReasonDoc,
  columns: 1,
  collapsable: false,
  state,
});

export const rejectReasonInputField = new Field("rejectReasonInputField", {
  title:
    "Why are you reopening this report? This is shared with the compliance team.",
  doc: rejectReasonDoc,
  section: rejectReasonSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: true,
  includeInQuickEdit: true,
  dbName: "rejectReasonInput",
  state,
});

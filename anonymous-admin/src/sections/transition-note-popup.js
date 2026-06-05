// adminReportDoc — "Add a note" popup section (rendering: standard, 1 column).
//
// Shared by escalateReport (A-F10) and closeRejected (A-F11) — each opens it via
// sendQuickFormResponse() and sets adminReportDoc.confirm/.cancel before the call.
//
// CRITICAL (rule 29): `transitionNote` is TRANSIENT — a working field captured in the
// popup and consumed by the handler into the appended statusHistory.note. It is
// cleared after use and is NEVER persisted as a `reports` column. It has NO dbName so
// the framework does not write it to the report document. Optional (mandatory: false).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";

export const transitionNotePopupSection = new Section(
  "transitionNotePopupSection",
  {
    title: "Add a note",
    doc: adminReportDoc,
    columns: 1,
    state,
  }
);

// TRANSIENT — no dbName (never a report column); consumed into statusHistory.note.
// NOT hidden: it must be visible/editable inside its quick-form popup. It only binds
// to this popup section, so it never appears on the manage/manual-log views anyway.
export const transitionNoteField = new Field("transitionNoteField", {
  title: "Note",
  doc: adminReportDoc,
  section: transitionNotePopupSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  includeInQuickEdit: true,
  state,
});

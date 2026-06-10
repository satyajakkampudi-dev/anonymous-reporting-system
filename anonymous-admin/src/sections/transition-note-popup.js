// noteCaptureDoc - "Add a note" capture popup section (rendering: standard, 1 column).
//
// Per-action CAPTURE Doc, NOT the shared adminReportDoc (framework-mapping rule 29,
// MP-FIX-ADMIN-POPUP-CAPTURE-DOCS): a Doc has one onSubmit slot, so binding every
// transition popup to adminReportDoc would make the sibling onSubmit handlers clobber
// each other. noteCaptureDoc is SHARED by escalateReport (A-F10) and closeRejected
// (A-F11) - both are note-only popups with the SAME single capture field, so one capture
// Doc serves both (each frame sets noteCaptureDoc.title before sendQuickFormResponse()).
//
// CRITICAL (rule 29): `transitionNote` is TRANSIENT - a working field captured in the
// popup and consumed by the handler into the appended statusHistory.note. It is NEVER
// persisted as a `reports` column. It has NO dbName, and noteCaptureDoc is never save()d,
// so the framework does not write it to the report document. Optional (mandatory: false).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { noteCaptureDoc } from "../docs/admin-report-doc";

export const transitionNotePopupSection = new Section(
  "transitionNotePopupSection",
  {
    title: "Add a note",
    doc: noteCaptureDoc,
    columns: 1,
    collapsable: false,
    state,
  }
);

// TRANSIENT - no dbName (never a report column); consumed into statusHistory.note.
// NOT hidden: it must be visible/editable inside its quick-form popup. It only binds
// to this capture Doc, so it never appears on the manage/manual-log views anyway.
export const transitionNoteField = new Field("transitionNoteField", {
  title: "Note",
  doc: noteCaptureDoc,
  section: transitionNotePopupSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  includeInQuickEdit: true,
  state,
});

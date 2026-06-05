// adminReportDoc — "Amendments" embedded sub-collection (display_only, READ-ONLY).
//
// forCollection: true on adminReportDoc → stored as the embedded array `amendments`
// on the parent report. READ-ONLY on the admin side (rule 30): the reporter appends
// rows (U-F13) — there is NO add/edit/delete intent here, and allowEdit/allowDelete
// are false. The read-only table view is a separate Display Doc section (A-D-amendments).
// forCollection sections CANNOT carry a CardsSet (rule 7). All fields hidden (data-only);
// no includeInQuickEdit (no popup on the admin side).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, amendmentDoc } from "../docs/admin-report-doc";

// --- Host section on adminReportDoc (embedding) ---
export const amendmentsSection = new Section("amendmentsSection", {
  title: "Amendments",
  doc: adminReportDoc,
  columns: 1,
  collapsable: false,
  forCollection: true,
  grid: { row: 2, column: 0 },
  state,
});

// --- amendmentDoc row schema ---
export const amendmentRowSection = new Section("amendmentRowSection", {
  title: "Amendment",
  doc: amendmentDoc,
  columns: 1,
  state,
});

export const amendmentIdField = new Field("amendmentIdField", {
  title: "Amendment ID",
  doc: amendmentDoc,
  section: amendmentRowSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "amendmentId",
  state,
});

export const amendmentNoteField = new Field("amendmentNoteField", {
  title: "Note",
  doc: amendmentDoc,
  section: amendmentRowSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  dbName: "amendmentNote",
  state,
});

export const amendmentEvidenceKeyField = new Field(
  "amendmentEvidenceKeyField",
  {
    title: "Evidence",
    doc: amendmentDoc,
    section: amendmentRowSection,
    type: FormFieldTypes.FILE_FIELD,
    mandatory: false,
    hidden: true,
    dbName: "amendmentEvidenceKey",
    state,
  }
);

export const amendedOnField = new Field("amendedOnField", {
  title: "Amended on",
  doc: amendmentDoc,
  section: amendmentRowSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "amendedOn",
  state,
});

// --- Embedded collection: `amendments` array on the parent report document ---
export const amendmentsCollection = new Collection("amendmentsCollection", {
  title: "Amendments",
  document: amendmentDoc,
  name: "amendments", // embedded array property name (NOT a standalone collection)
  allowEdit: false,
  allowDelete: false,
  state,
});

amendmentsSection.addCollection(amendmentsCollection);

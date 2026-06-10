// reportDoc - "Amendments" embedded sub-collection (rendering: custom_card, APPEND-ONLY).
//
// Two parts (collection-embedded-forms-guide):
//   1. amendmentsSection on reportDoc with forCollection: true (+ addCollection) -
//      owns the rows, stored as the embedded array `amendments` on the parent report.
//      forCollection sections CANNOT carry a CardsSet (rule 7) - the read-only table
//      view is a separate Display Doc section (U-D-amendments).
//   2. amendmentDoc field schema (amendmentRowSection) - one row's persisted fields.
//
// Append-only (D16, rule 25): allowEdit/allowDelete: false - no edit/delete intent;
// the add path (U-E-addAmendment) uses sendQuickFormResponse() so the popup fields
// carry includeInQuickEdit: true.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, amendmentDoc } from "../docs/report-doc";

// --- Host section on reportDoc (embedding) ---
export const amendmentsSection = new Section("amendmentsSection", {
  title: "Amendments",
  doc: reportDoc,
  columns: 1,
  collapsable: false,
  forCollection: true,
  // Hidden on the Data-Doc SUBMIT form - a brand-new report has no amendments, and
  // amendments are added only AFTER submission (from the detail view). This is only the
  // embedded sub-collection HOST (persistence is unaffected by hidden); the reporter
  // sees + adds amendments in the DETAIL view via the Display Doc's amendments card.
  hidden: true,
  grid: { row: 3, column: 0 },
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
  mandatory: true,
  includeInQuickEdit: true,
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
    includeInQuickEdit: true,
    // DOMAIN scope so an admin (different conversation) can open amendment evidence too -
    // same rationale as reporter evidence (sections/evidence.js). Anonymity-safe path.
    fileScope: "domain",
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

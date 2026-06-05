// adminReportDoc — "Status timeline" embedded sub-collection (display_only, read-only).
//
// forCollection: true on adminReportDoc → stored as the embedded array `statusHistory`
// on the parent report. WRITTEN BY THE TRANSITION PATH ONLY (lib/ticket-status.js
// transitions) — never a popup; pure display on the admin side (no add/edit/delete,
// rule 25/30). The timeline HTML view is a separate Display Doc section (A-D-statushistory).
// forCollection sections CANNOT carry a CardsSet (rule 7).
//
// actorRole is ROLE ONLY, never an id (anonymity, SPEC.md) — passes through
// adminProjection unchanged. All fields hidden (data-only).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, statusHistoryDoc } from "../docs/admin-report-doc";

// --- Host section on adminReportDoc (embedding) ---
export const statusHistorySection = new Section("statusHistorySection", {
  title: "Status timeline",
  doc: adminReportDoc,
  columns: 1,
  collapsable: false,
  forCollection: true,
  grid: { row: 1, column: 0 },
  state,
});

// --- statusHistoryDoc row schema ---
export const statusHistoryRowSection = new Section("statusHistoryRowSection", {
  title: "Status change",
  doc: statusHistoryDoc,
  columns: 1,
  state,
});

export const historyIdField = new Field("historyIdField", {
  title: "History ID",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "historyId",
  state,
});

export const fromStatusField = new Field("fromStatusField", {
  title: "From status",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "fromStatus",
  state,
});

export const toStatusField = new Field("toStatusField", {
  title: "To status",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "toStatus",
  state,
});

// Role only — NEVER an id (anonymity).
export const actorRoleField = new Field("actorRoleField", {
  title: "Actor role",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "actorRole",
  state,
});

export const changedOnField = new Field("changedOnField", {
  title: "Changed on",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "changedOn",
  state,
});

export const noteField = new Field("noteField", {
  title: "Note",
  doc: statusHistoryDoc,
  section: statusHistoryRowSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  dbName: "note",
  state,
});

// --- Embedded collection: `statusHistory` array on the parent report document ---
export const statusHistoryCollection = new Collection(
  "statusHistoryCollection",
  {
    title: "Status timeline",
    document: statusHistoryDoc,
    name: "statusHistory", // embedded array property name
    allowEdit: false,
    allowDelete: false,
    state,
  }
);

statusHistorySection.addCollection(statusHistoryCollection);

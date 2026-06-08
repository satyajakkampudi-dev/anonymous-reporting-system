// reportDoc — "Status timeline" embedded sub-collection (rendering: display_only, read-only).
//
// forCollection: true on reportDoc → stored as the embedded array `statusHistory`
// on the parent report. WRITTEN BY THE TRANSITION PATH ONLY (lib/ticket-status.js
// transitions in both apps) — never by a reporter popup; pure display on the user
// side (no add/edit/delete intent, rule 25). The timeline HTML view is a separate
// Display Doc section (U-D-statushistory).
//
// actorRole is ROLE ONLY, never an id (anonymity, SPEC.md) — REPORTER /
// PRIMARY_ADMIN / SECONDARY_ADMIN / SYSTEM. All fields hidden (data-only).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, statusHistoryDoc } from "../docs/report-doc";

// --- Host section on reportDoc (embedding) ---
export const statusHistorySection = new Section("statusHistorySection", {
  title: "Status timeline",
  doc: reportDoc,
  columns: 1,
  collapsable: false,
  forCollection: true,
  // Hidden on the Data-Doc SUBMIT form — a report being created has no timeline yet, so
  // showing an empty "Status timeline" section there is noise. This is only the embedded
  // sub-collection HOST (data binding/persistence is unaffected by hidden); the reporter
  // sees the timeline in the DETAIL view via the Display Doc's own status-history card.
  hidden: true,
  grid: { row: 4, column: 0 },
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

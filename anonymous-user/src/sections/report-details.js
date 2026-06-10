// reportDoc - "Report details" submit section (rendering: standard, 2 columns)
// PLUS all hidden infrastructure fields + the admin-written read-only fields.
//
// Field types per the field-spec semantic review (§"Report details"):
//   incidentDate → DATE, againstAdmin → SWITCH, choice fields → DROPDOWN,
//   description → TEXT_AREA. Choice DROPDOWNs render the human LABELS (decision:
//   "show labels, map→token on submit"); U-F8 onSubmit maps label→token before
//   save so MongoDB + lib token logic (severityFromUrgency, etc.) stay token-based.
//
// dbName tokens are deliberate: reporterId / contactMethod / contactValue /
// againstAdmin must match the names lib/access.js reads (adminProjection exclusions,
// ownsReport, assignedRoleFor) - do not rename without updating lib/access.js.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  LOCATION_LABELS,
} from "../../../lib/constants";
import { reportDoc } from "../docs/report-doc";

export const reportDetailsSection = new Section("reportDetailsSection", {
  title: "Report details",
  doc: reportDoc,
  columns: 2,
  collapsable: false,
  borderless: false,
  grid: { row: 0, column: 0 },
  state,
});

// ---------------------------------------------------------------------------
// Infrastructure fields (hidden/system - NON-NEGOTIABLE; field-spec §"Infrastructure")
// Declared on the first section; all hidden so they never render in the form.
// ---------------------------------------------------------------------------

// PK: RPT-+10, generated on first save (U-F8). Without it save() upserts {} and
// the collection dedupes all rows to one (field-spec §2).
export const reportIdField = new Field("reportIdField", {
  title: "Report ID",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "reportId",
  state,
});

// state.user.userId. Sets the My Reports query filter + ownership assertion.
// Reporter-private - EXCLUDED from adminProjection (lib/access.js). NOT the PK.
export const reporterIdField = new Field("reporterIdField", {
  title: "Reporter ID",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "reporterId",
  state,
});

export const statusField = new Field("statusField", {
  title: "Status",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "status",
  state,
});

export const severityField = new Field("severityField", {
  title: "Severity",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "severity",
  state,
});

export const sourceField = new Field("sourceField", {
  title: "Source",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "source",
  state,
});

export const assignedToField = new Field("assignedToField", {
  title: "Assigned to",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "assignedTo",
  state,
});

export const createdOnField = new Field("createdOnField", {
  title: "Created on",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "createdOn",
  state,
});

export const updatedOnField = new Field("updatedOnField", {
  title: "Updated on",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "updatedOn",
  state,
});

// Incremented per write; transitions validate against the read value (ER-B5).
export const versionField = new Field("versionField", {
  title: "Version",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "version",
  state,
});

// Default 0; 0→1 once on reject→reopen (D10).
export const reopenCountField = new Field("reopenCountField", {
  title: "Reopen count",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "reopenCount",
  state,
});

// Priority sort key (MP-FIX-QUEUE-SERVER-PAGINATION). 0 = priority (floats to the
// top of the admin queue), 1 = normal. Derived from severity/urgency/status by the
// SHARED priorityRankFor predicate, written on EVERY save via reportDoc.onSave so it
// can never drift from isPriority. Hidden infra column - enables the server-side
// queue sort { priorityRank: 1, createdOn: -1 } (the framework has no aggregation, so
// the computed priority float must be a stored, sortable field).
export const priorityRankField = new Field("priorityRankField", {
  title: "Priority rank",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "priorityRank",
  state,
});

export const withdrawnOnField = new Field("withdrawnOnField", {
  title: "Withdrawn on",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "withdrawnOn",
  state,
});

export const resolvedOnField = new Field("resolvedOnField", {
  title: "Resolved on",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "resolvedOn",
  state,
});

// Admin-written. HIDDEN on the reporter's submit form - the reporter never enters a
// resolution and the report doesn't exist yet; showing an empty "Resolution" box on
// the submit form was a bug. The reporter sees the resolution in the report DETAIL
// view via the dedicated detail-resolution Display card (which reads .value), NOT via
// this editable form field - so this field is purely the persisted/bound column.
export const resolutionField = new Field("resolutionField", {
  title: "Resolution",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "resolution",
  state,
});

// Reporter's reason on reject (U-F11). Hidden on this form.
export const rejectReasonField = new Field("rejectReasonField", {
  title: "Reject reason",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  dbName: "rejectReason",
  state,
});

// ---------------------------------------------------------------------------
// Reporter-entered content fields (visible). Columns alternate 0,1 in order.
// ---------------------------------------------------------------------------

export const categoryField = new Field("categoryField", {
  title: "Category",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 0,
  options: Object.values(CATEGORY_LABELS),
  dbName: "category",
  state,
});

export const urgencyField = new Field("urgencyField", {
  title: "Urgency",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 1,
  options: Object.values(URGENCY_LABELS),
  dbName: "urgency",
  state,
});

// Free-text incident metadata - NOT a routing key (routing is resolveAssignees, D17).
export const shipNameField = new Field("shipNameField", {
  title: "Ship name",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  column: 0,
  dbName: "shipName",
  state,
});

export const locationField = new Field("locationField", {
  title: "Location",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 1,
  options: Object.values(LOCATION_LABELS),
  dbName: "location",
  state,
});

// DATE picker; validated parseable + not in the future (U-F8).
export const incidentDateField = new Field("incidentDateField", {
  title: "Incident date",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.DATE,
  mandatory: true,
  column: 0,
  dbName: "incidentDate",
  state,
});

// Toggle - if on, routes assignedTo = SECONDARY_ADMIN (D9). Read by
// lib/access.js assignedRoleFor → dbName MUST stay "againstAdmin".
export const againstAdminField = new Field("againstAdminField", {
  title: "This concerns a member of the compliance team",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.SWITCH,
  mandatory: false,
  column: 1,
  dbName: "againstAdmin",
  state,
});

// Full-width (no column). Sanitised before any HTML/email use (U-F8, rule 10).
export const descriptionField = new Field("descriptionField", {
  title: "Description",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: true,
  dbName: "description",
  state,
});

// Full-width, optional. Hint to avoid self-identifying detail (ER-A1) added in the
// Display/submit UX later. Sanitised on submit.
export const accusedPartyField = new Field("accusedPartyField", {
  title: "Accused party",
  doc: reportDoc,
  section: reportDetailsSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  dbName: "accusedParty",
  state,
});

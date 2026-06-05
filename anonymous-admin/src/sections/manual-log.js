// adminReportDoc — "Log a report" form section (rendering: standard, 2 columns)
// PLUS all hidden infrastructure fields and the read-only reporter-written fields.
//
// This single section hosts both (mirrors the user scaffold's report-details.js):
//   • the visible manual-log content fields (A-F13 — source = MANUAL, no reporter to
//     contact, so NO contactMethod / contactValue here, D-L3-5);
//   • the hidden adminProjection infrastructure fields the manage/queue views read.
//
// NON-NEGOTIABLE (rule 30, C1, ER-A2): NO reporterId / contactMethod / contactValue /
// reporter-create audit field is bound anywhere on this Doc. severity lives in
// severityPopup, resolution in resolvePopup, transitionNote in transitionNotePopup —
// each field has exactly one (doc, section) home.
//
// Choice DROPDOWNs render the human LABELS; the manual-log submit handler (A-F13, later
// task) maps label→token before save so MongoDB + lib token logic stay token-based.
// dbName tokens MUST match the shared `reports` schema and lib/access.js readers
// (assignedRoleFor reads `againstAdmin`) — do not rename without updating lib.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  LOCATION_LABELS,
} from "../../../lib/constants";
import { adminReportDoc } from "../docs/admin-report-doc";

export const manualLogSection = new Section("manualLogSection", {
  title: "Log a report",
  doc: adminReportDoc,
  columns: 2,
  collapsable: false,
  borderless: false,
  grid: { row: 0, column: 0 },
  state,
});

// ---------------------------------------------------------------------------
// Infrastructure fields (hidden/system — adminProjection set; field-spec §"adminReportDoc").
// NO reporterId / contactMethod / contactValue (rule 30). severity → severityPopup.
// ---------------------------------------------------------------------------

// PK: RPT-+10, generated only on manual-log first save (A-F13). Without it save()
// upserts {} and the collection dedupes all rows to one.
export const reportIdField = new Field("reportIdField", {
  title: "Report ID",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "reportId",
  state,
});

export const statusField = new Field("statusField", {
  title: "Status",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "status",
  state,
});

// Drives the role filter (A-F4). Set by resolveAssignees / escalate.
export const assignedToField = new Field("assignedToField", {
  title: "Assigned to",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "assignedTo",
  state,
});

// REPORTER / MANUAL / CALL. MANUAL set on manual log.
export const sourceField = new Field("sourceField", {
  title: "Source",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "source",
  state,
});

export const createdOnField = new Field("createdOnField", {
  title: "Created on",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "createdOn",
  state,
});

// Backs optimistic concurrency on transitions (ER-B5).
export const updatedOnField = new Field("updatedOnField", {
  title: "Updated on",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "updatedOn",
  state,
});

// Incremented per write; transition guard.
export const versionField = new Field("versionField", {
  title: "Version",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "version",
  state,
});

// Gates the close-as-rejected force-close (ER-B6, D10).
export const reopenCountField = new Field("reopenCountField", {
  title: "Reopen count",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "reopenCount",
  state,
});

export const resolvedOnField = new Field("resolvedOnField", {
  title: "Resolved on",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "resolvedOn",
  state,
});

export const withdrawnOnField = new Field("withdrawnOnField", {
  title: "Withdrawn on",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "withdrawnOn",
  state,
});

// Reporter's reason on reject (U-F11). Read-only on the admin side; shown on the
// resolution card. Hidden on this form.
export const rejectReasonField = new Field("rejectReasonField", {
  title: "Reject reason",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "rejectReason",
  state,
});

// ---------------------------------------------------------------------------
// Manual-log content fields (visible). Columns alternate 0,1; full-width fields
// omit `column`. Identical shape to the reporter submit form, MINUS contact fields.
// ---------------------------------------------------------------------------

export const categoryField = new Field("categoryField", {
  title: "Category",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 0,
  options: Object.values(CATEGORY_LABELS),
  dbName: "category",
  state,
});

export const urgencyField = new Field("urgencyField", {
  title: "Urgency",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 1,
  options: Object.values(URGENCY_LABELS),
  dbName: "urgency",
  state,
});

// Free-text incident metadata — NOT a routing key (routing is resolveAssignees, D17).
export const shipNameField = new Field("shipNameField", {
  title: "Ship name",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  column: 0,
  dbName: "shipName",
  state,
});

export const locationField = new Field("locationField", {
  title: "Location",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 1,
  options: Object.values(LOCATION_LABELS),
  dbName: "location",
  state,
});

// DATE picker; validated parseable + not in the future (A-F13).
export const incidentDateField = new Field("incidentDateField", {
  title: "Incident date",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.DATE,
  mandatory: true,
  column: 0,
  dbName: "incidentDate",
  state,
});

// Toggle — if on, routes assignedTo = SECONDARY_ADMIN (D9). Read by lib/access.js
// assignedRoleFor → dbName MUST stay "againstAdmin".
export const againstAdminField = new Field("againstAdminField", {
  title: "This concerns a member of the compliance team",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.SWITCH,
  mandatory: false,
  column: 1,
  dbName: "againstAdmin",
  state,
});

// Full-width (no column). Sanitised before any HTML/email use (A-F13, rule 10).
export const descriptionField = new Field("descriptionField", {
  title: "Description",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: true,
  dbName: "description",
  state,
});

// Full-width, optional. Sanitised on submit.
export const accusedPartyField = new Field("accusedPartyField", {
  title: "Accused party",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  dbName: "accusedParty",
  state,
});

// Up to 5 files, ≤ 25 MB each (D1). FILE_FIELD = upload control + S3. Same allow-list
// + size validation as the reporter form (A-F13, lib/validation.js). The .value is an
// envelope { value: <s3-key>, fileName, fileScopeValue } — display signs the key (rule 18).
const makeEvidenceFileField = (index) =>
  new Field(`evidenceFile${index}Field`, {
    title: `Evidence file ${index}`,
    doc: adminReportDoc,
    section: manualLogSection,
    type: FormFieldTypes.FILE_FIELD,
    mandatory: false,
    dbName: `evidenceFile${index}`,
    state,
  });

export const evidenceFile1Field = makeEvidenceFileField(1);
export const evidenceFile2Field = makeEvidenceFileField(2);
export const evidenceFile3Field = makeEvidenceFileField(3);
export const evidenceFile4Field = makeEvidenceFileField(4);
export const evidenceFile5Field = makeEvidenceFileField(5);

export const evidenceNotesField = new Field("evidenceNotesField", {
  title: "Evidence notes",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  dbName: "evidenceNotes",
  state,
});

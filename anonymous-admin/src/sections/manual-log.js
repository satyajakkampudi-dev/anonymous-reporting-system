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
import { Buttons } from "@frontmltd/frontmjs/core/fields/Buttons";
import { state } from "@frontmltd/frontmjs/core/State";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  LOCATION_LABELS,
  SEVERITY,
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

// Admin-written resolution text (A-E-resolveReport). Persisted `reports` column,
// read by the Manage-resolution display renderer (sections/display/manage-resolution
// reads report.resolution) — dbName MUST stay "resolution" for that read to work.
// Captured in the resolve popup via the TRANSIENT resolutionInputField
// (sections/resolve-popup.js); the resolve frame sanitises it and copies it HERE.
// Hidden on the manual-log form, read-only (admins edit it only through the popup).
export const resolutionField = new Field("resolutionField", {
  title: "Resolution",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "resolution",
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

// Persisted `severity` report column — the SINGLE home of severity on adminReportDoc
// (framework-mapping rule 29 / MP-FIX-ADMIN-POPUP-CAPTURE-DOCS). Initialised from
// urgency on manual-log submit (A-F13, D6) and overwritten by overrideSeverity (A-F12,
// which captures input through the TRANSIENT severityInputField on severityCaptureDoc
// — sections/severity-popup.js — then copies the chosen value HERE). Hidden on this
// form; the manage/queue views read report.severity from the loaded projection row, so
// dbName MUST stay "severity". Options are the raw SEVERITY tokens (no label mapping).
export const severityField = new Field("severityField", {
  title: "Severity",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: false,
  hidden: true,
  options: Object.values(SEVERITY), // LOW · MEDIUM · HIGH · CRITICAL
  dbName: "severity",
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
//
// Progressive disclosure (mirror of the user-app evidence.js): only slot 1 is visible
// initially; slots 2–5 start hidden and are revealed one at a time by the "+ Add another
// file" button (frames/evidence-slots.js). The `hidden` flag is a module-level mutable
// that resets on a Lambda cold start, so the live count is persisted in conversation
// state (STATE_KEYS.EVIDENCE_SLOTS_VISIBLE) and re-applied by restoreEvidenceSlotVisibility.
// The onClick handler lives in frames/ (AGENTS.md — handlers belong in frames, not in
// sections), so this file holds definitions only.
const makeEvidenceFileField = (index, hidden) =>
  new Field(`evidenceFile${index}Field`, {
    title: `Evidence file ${index}`,
    doc: adminReportDoc,
    section: manualLogSection,
    type: FormFieldTypes.FILE_FIELD,
    mandatory: false,
    // DOMAIN scope (SPEC.md "Domain-scoped S3 key"): a MANUAL report's evidence must
    // be retrievable by ANY admin (incl. a secondary in a different conversation on
    // escalation) without a conversation prefix. Conversation scope would pin it to
    // the logging admin's conversation and break A-F7 signing. MP-FIX-EVIDENCE-FILESCOPE.
    fileScope: "domain",
    dbName: `evidenceFile${index}`,
    hidden,
    state,
  });

export const evidenceFile1Field = makeEvidenceFileField(1, false);
export const evidenceFile2Field = makeEvidenceFileField(2, true);
export const evidenceFile3Field = makeEvidenceFileField(3, true);
export const evidenceFile4Field = makeEvidenceFileField(4, true);
export const evidenceFile5Field = makeEvidenceFileField(5, true);

// All five slots in display order — used by resetEvidenceSlots (frames/evidence-slots).
export const ATTACHMENT_FIELDS = [
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// The four progressively-revealed slots (2–5) — used by restoreEvidenceSlotVisibility
// and revealNextEvidenceSlot to find the next hidden slot.
export const EXTRA_ATTACHMENT_FIELDS = [
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// "+ Add another file" — reveals the next hidden slot; hidden once all five are
// visible. onClick is wired in frames/evidence-slots.js (handlers live in frames).
export const addEvidenceSlotButtons = Buttons.Create({
  intentId: "addEvidenceSlotButtons",
  title: "Add evidence files",
  doc: adminReportDoc,
  section: manualLogSection,
  hiddenInTables: true,
  state,
});
addEvidenceSlotButtons.addButton({ label: "+ Add another file" });

export const evidenceNotesField = new Field("evidenceNotesField", {
  title: "Evidence notes",
  doc: adminReportDoc,
  section: manualLogSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  dbName: "evidenceNotes",
  state,
});

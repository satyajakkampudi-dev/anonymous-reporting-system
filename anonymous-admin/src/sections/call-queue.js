// callQueueDoc — call-queue field schema (admin answers/claims/ends calls, A-F21/22).
//
// IDENTITY-FREE by construction (SPEC.md): NEVER a reporter id/email/name. `attendedBy`
// is the ADMIN who claimed the call (admin-side only — never a reporter). All fields
// hidden/system; defined here so loadDocument({ callRef }) hydrates the Doc. The
// Incoming-call display card is A-DISPLAY-SHELL; the atomic-claim handler is A-F21.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../docs/call-queue-doc";

export const callQueueSection = new Section("callQueueSection", {
  title: "Incoming call",
  doc: callQueueDoc,
  columns: 1,
  collapsable: false,
  state,
});

// Opaque ref. loadDocument({ callRef }). Identity-free.
export const callRefField = new Field("callRefField", {
  title: "Call reference",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "callRef",
  state,
});

// RINGING / ACTIVE / ENDED / MISSED / ABANDONED. Atomic-claim guarded (A-F21).
export const callStatusField = new Field("callStatusField", {
  title: "Call status",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "status",
  state,
});

// Daily.co meeting id (admin joins via this).
export const meetingIdField = new Field("meetingIdField", {
  title: "Meeting ID",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "meetingId",
  state,
});

// Admin userId/email who claimed (admin-side only; never reporter).
export const attendedByField = new Field("attendedByField", {
  title: "Attended by",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "attendedBy",
  state,
});

export const callCreatedOnField = new Field("callCreatedOnField", {
  title: "Created on",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "createdOn",
  state,
});

export const answeredOnField = new Field("answeredOnField", {
  title: "Answered on",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "answeredOn",
  state,
});

export const endedOnField = new Field("endedOnField", {
  title: "Ended on",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "endedOn",
  state,
});

export const durationMsField = new Field("durationMsField", {
  title: "Duration (ms)",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "durationMs",
  state,
});

// S3 key if voicemail left (MISSED path, set user-side).
export const voicemailKeyField = new Field("voicemailKeyField", {
  title: "Voicemail key",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "voicemailKey",
  state,
});

// Report auto-created from voicemail (source = CALL).
export const linkedReportIdField = new Field("linkedReportIdField", {
  title: "Linked report ID",
  doc: callQueueDoc,
  section: callQueueSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "linkedReportId",
  state,
});

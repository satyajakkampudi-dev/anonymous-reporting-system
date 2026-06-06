// callQueueDoc — call-queue field schema (USER side: U-F15 creates the RINGING
// entry, U-F16 the voicemail/MISSED path, U-F17 the abandon/end transitions).
//
// IDENTITY-FREE by construction (SPEC.md "Anonymous calling data model"): this Doc
// NEVER carries a reporter id/email/name. `attendedBy` is the ADMIN who claimed the
// call (written admin-side only — never a reporter). `dbName` values MUST match the
// shared MongoDB collection (and the admin bundle's schema) since both apps read/write
// the same `call_queue_${systemId}` documents; the JS field intentIds are per-bundle.
// All fields hidden/system — the call has no rendered form (the reporter UI is the
// Daily.co meeting + ring banners), but the fields must exist so callQueueDoc.save()
// serialises them and loadDocument({ callRef }) hydrates the Doc for later transitions.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../docs/call-queue-doc";

export const callQueueSection = new Section("callQueueSection", {
  title: "Anonymous call",
  doc: callQueueDoc,
  columns: 1,
  collapsable: false,
  state,
});

// Opaque ref (PK). save()/loadDocument({ callRef }). Identity-free.
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

// RINGING / ACTIVE / ENDED / MISSED / ABANDONED (lib/constants CALL_STATUS).
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

// Daily.co meeting id (admins join via this; carried in the identity-free ring payload).
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

// Admin userId/email who claimed (admin-side only; NEVER a reporter).
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

// Ring start (set on the RINGING entry, U-F15).
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

// Set on ACTIVE (admin answers, A-F21).
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

// Set on ENDED / MISSED / ABANDONED (U-F16/U-F17).
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

// ENDED − answered (U-F17).
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

// S3 key if a voicemail was left (MISSED path, U-F16).
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

// Report auto-created from voicemail (source = CALL, U-F16).
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

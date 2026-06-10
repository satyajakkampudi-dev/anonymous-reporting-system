// voicemailDoc - voice-message capture section (U-F16).
//
// ONE audio FILE_FIELD, the only thing the reporter supplies in the
// sendQuickFormResponse() popup, so it carries includeInQuickEdit: true (only
// includeInQuickEdit fields render in a quick form - CLAUDE.md "sendQuickFormResponse
// popups"). The reporter records/uploads an audio file; the framework's upload
// control is the ONLY documented file-capture primitive (VideoCall exposes no
// voicemail-recording API - verified against ./docs/, so we do not invent one).
//
// fileScope: "domain" (documented FILE_FIELD constructor option, field-class guide
// § "Media Field Value Shape") stores the recording in DOMAIN-scoped S3, NOT the
// reporter's conversation. Domain scope is REQUIRED here for two reasons:
//   1. Spec: voicemail is stored to "domain S3" (SPEC.md calling model).
//   2. Cross-app access: the auto-created report is read by the admin app (a
//      different conversation/app in the same domain); a conversation-scoped object
//      could not be signed by the admin side. The resolved scope is preserved on the
//      envelope's fileScopeValue so the admin's signed-URL builder knows the scope.
//
// dbName is inert (voicemailDoc is never persisted) but must NOT collide with a
// reports/call_queue column name. Size/duration limits (VOICEMAIL_LIMITS, D7) are
// NOT enforceable server-side from the FILE_FIELD envelope (it carries no byte size
// and no duration, and state.frontmlib has no S3 HEAD call - the same documented
// limitation as evidence files, see report-validation.js / MP-FIX-EVIDENCE-METADATA).
// What IS enforced on submit is the audio EXTENSION allow-list (lib/validation.js).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { voicemailDoc } from "../docs/voicemail-doc";

export const voicemailSection = new Section("voicemailSection", {
  title: "Leave a voice message",
  doc: voicemailDoc,
  columns: 1,
  collapsable: false,
  state,
});

export const voicemailFileField = new Field("voicemailFileField", {
  title:
    "No one was available to take your call. You can record or upload a short voice message (up to 3 minutes) and the compliance team will follow it up. You remain anonymous.",
  doc: voicemailDoc,
  section: voicemailSection,
  type: FormFieldTypes.FILE_FIELD,
  mandatory: false,
  includeInQuickEdit: true,
  fileScope: "domain",
  dbName: "voicemailFile",
  state,
});

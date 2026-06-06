// voicemailDoc — the "leave a voice message" capture popup (U-F16).
//
// Constructor only (no event handlers; rule 6 — the onSubmit lives in
// frames/call-timeout.js so it can import the Field + reportDoc references).
//
// This is a TRANSIENT capture vessel, NOT a persisted entity — it is never save()d
// and registers no `reports`/`call_queue` column. It exists only so the framework
// can render a sendQuickFormResponse() popup with a single audio FILE_FIELD when a
// call goes unanswered; on confirm its onSubmit auto-creates the source=CALL report
// (carrying the uploaded audio as evidence) and stamps voicemailKey/linkedReportId
// onto the call-queue row. Same standalone-popup pattern as rejectReasonDoc (U-F11).
//
// NOT autoSave: the file envelope only needs to survive within the single popup-
// submit invocation (the framework delivers it in the submit payload), and keeping
// it out of the autoSaveBuffer avoids any interference with reportDoc's buffer.
// confirm/cancel give the quick form its action buttons.

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { state } from "@frontmltd/frontmjs/core/State";

export const voicemailDoc = new Doc("voicemailDoc", state, {
  title: "Leave a voice message",
  confirm: "Send voice message",
  cancel: "Cancel",
});

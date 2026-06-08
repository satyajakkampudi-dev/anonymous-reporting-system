// U-F16 — Anonymous call: 30s no-answer -> MISSED -> voicemail -> auto-create report.
//
// Two halves of the "ring timeout -> voicemail -> auto-create" flow (D7; sibling of
// the committed reject-resolution.js "popup -> transition" pattern):
//
//   1. callTimeout.onResolution — the timeout handler. Independent intent (Context B
//      — object graph EMPTY on entry). It is NOT a button: it is fired by the
//      jobScheduler message armed at ring-start in start-anonymous-call.js (U-F15),
//      schedule = now + TIMING.CALL_RING_TIMEOUT_MS, to the reporter's OWN userId, so
//      the popup renders in the reporter's conversation. The scheduled payload arrives
//      under state.messageFromUser.data (job-scheduler guide). It re-reads the
//      call-queue row by callRef and applies the MISSED transition ONLY if the call is
//      still RINGING and unclaimed — if an admin answered (status ACTIVE / attendedBy
//      set, A-F21's atomic claim) or the reporter already abandoned it (U-F17), this is
//      a guarded NO-OP (rule 13). It does NOT cancel the job; the status guard is the
//      idempotency mechanism (and the admin app could not cancel a user-app job anyway).
//      On a genuine MISSED it stashes callRef and opens the voicemail-capture popup.
//
//   2. voicemailDoc.onSubmit — the auto-create. On popup-confirm (a fresh invocation):
//      if the reporter attached an audio file, validate its extension (the audio
//      allow-list; byte-size/duration are NOT server-enforceable from the FILE_FIELD
//      envelope — flagged, same documented limitation as evidence U-F6), then
//      auto-create the source=CALL report via the U-F8 transform shape (reporterId
//      EMPTY — no tracking owner; neutral OTHER/MEDIUM defaults since a voicemail
//      carries no structured fields; the audio as evidenceFile1; first statusHistory
//      row actorRole = SYSTEM, never an id — anonymity). After save() it stamps
//      voicemailKey + linkedReportId onto the call-queue row. If NO file was attached
//      the reporter declined to leave a message — the call stays MISSED, no report is
//      created, and we close calmly (ER-C12 unhappy path).
//
// ANONYMITY (NON-NEGOTIABLE): nothing here writes or sends a reporter identity. The
// call-queue row is identity-free; the report's reporterId is empty; the voicemail is
// domain-scoped (not tied to the reporter's conversation); the statusHistory actor is
// SYSTEM. The DB audit createdBy (reportDoc audit:true) is excluded from adminProjection
// (ER-A2), so the admin never sees who created the row — same guarantee as U-F8.
//
// X1 hook (rule 16): the identity-free MSG_NEW_REPORT send happens AFTER reportDoc.save()
// — built by task X1 (which depends on U-F16), mirroring the X1 hook in submit-report.js.
// Do NOT invent the sender here.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { reportDoc } from "../collections/reports";
import { callQueueDoc } from "../docs/call-queue-doc";
import { voicemailDoc } from "../docs/voicemail-doc";
import { voicemailFileField } from "../sections/voicemail";
import {
  callRefField,
  callStatusField,
  attendedByField,
  endedOnField,
  voicemailKeyField,
  linkedReportIdField,
} from "../sections/call-queue";
import {
  reportIdField,
  reporterIdField,
  statusField,
  severityField,
  sourceField,
  assignedToField,
  createdOnField,
  updatedOnField,
  versionField,
  reopenCountField,
  categoryField,
  urgencyField,
  locationField,
  incidentDateField,
  descriptionField,
} from "../sections/report-details";
import { evidenceFile1Field } from "../sections/evidence";
import {
  getStatusHistoryCollection,
  appendStatusHistoryRow,
} from "./status-history-writer";
import { STATUS } from "../../../lib/ticket-status";
import { assignedRoleFor, resolveAssignees } from "../../../lib/access";
import { sendBotMessage, resolvePeerBotId } from "../../../lib/notifications";
import { validateEvidenceEnvelope } from "../../../lib/validation";
import {
  generateReportId,
  isDuplicateKeyError,
} from "../../../lib/id-generator";
import {
  CALL_STATUS,
  CATEGORY,
  URGENCY,
  LOCATION,
  SOURCE,
  ACTOR_ROLE,
  severityFromUrgency,
  ERROR_CODES,
  MSG,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import { INTENT, STATE_KEYS, VOICEMAIL } from "../constants";

const MAX_SAVE_ATTEMPTS = 3;

export const callTimeout = Intent.Create({
  intentId: INTENT.CALL_TIMEOUT,
  prompt: "Handle a compliance call that no one answered in time",
  state,
});

// X1 — emit the identity-free MSG_NEW_REPORT for the just-saved report to its assigned
// admins in the admin app. `doc` is the LIVE, just-saved reportDoc. Payload carries ONLY
// { reportId, category, urgency, severity, assignedTo, createdOn } — NO reporterId /
// contact (rule 16; the call report's reporterId is empty anyway). Best-effort + logged;
// NEVER throws into the voicemail flow. Sibling of the submit-report.js sender.
const sendNewReportMessage = async (doc) => {
  try {
    const report = {
      reportId: doc.f[reportIdField.id]?.value,
      category: doc.f[categoryField.id]?.value,
      urgency: doc.f[urgencyField.id]?.value,
      severity: doc.f[severityField.id]?.value,
      assignedTo: doc.f[assignedToField.id]?.value,
      createdOn: doc.f[createdOnField.id]?.value,
    };
    if (!report.reportId) {
      D.log({
        message: "X1: MSG_NEW_REPORT skipped — no reportId on saved doc",
      });
      return;
    }
    const assignees = await resolveAssignees(report);
    const userIds = (assignees || []).map((a) => a.adminUserId).filter(Boolean);
    if (!userIds.length) {
      D.log({
        message:
          "X1: MSG_NEW_REPORT — no assignees to deliver to (queued only)",
        data: { reportId: report.reportId, assignedTo: report.assignedTo },
      });
      return;
    }
    const botId = await resolvePeerBotId(STATIC_DATA_KEYS.ADMIN_BOT_ID);
    await sendBotMessage({
      type: MSG.NEW_REPORT,
      payload: report,
      userIds,
      botId,
      userDomain: state.currentUserDomain,
    });
    D.log({
      message: "X1: MSG_NEW_REPORT sent (voicemail report)",
      data: { reportId: report.reportId, recipients: userIds.length },
    });
  } catch (error) {
    D.log({
      message: "X1: MSG_NEW_REPORT send swallowed an error",
      data: { error: String(error) },
    });
  }
};

// --- 1. Timeout handler: guarded MISSED transition, then open the voicemail popup ---
callTimeout.onResolution = async () => {
  // Scheduled-message payload (job-scheduler delivers it under .data). Defensive
  // fallback to .payload covers a manual invoke_intent during testing.
  const { callRef } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  if (!callRef) {
    D.log({ message: "U-F16: callTimeout fired without a callRef" });
    return; // nothing to act on — silent (the reporter sees no spurious message)
  }

  // Fresh context for this dispatch, then re-read the call-queue row.
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await callQueueDoc.loadDocument({ callRef });

  // Guard (rule 13). Proceed to MISSED ONLY if the call is still RINGING AND
  // unclaimed. If an admin answered (ACTIVE / attendedBy set) or the reporter already
  // hung up (ABANDONED/ENDED) or another timeout already fired (MISSED), this is a
  // no-op — never overwrite a claimed/closed call.
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  const attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";
  const loadedRef = callQueueDoc.f[callRefField.id]?.value || "";
  if (loadedRef !== callRef || status !== CALL_STATUS.RINGING || attendedBy) {
    D.log({
      message: "U-F16: timeout no-op (call not in unclaimed RINGING state)",
      data: {
        callRef,
        status,
        claimed: !!attendedBy,
        found: loadedRef === callRef,
      },
    });
    return;
  }

  // Apply MISSED. endedOn marks when the ring window closed.
  callQueueDoc.f[callStatusField.id].value = CALL_STATUS.MISSED;
  callQueueDoc.f[endedOnField.id].value = Date.now();
  const errorsBefore = (state.errorStack || []).length;
  try {
    await callQueueDoc.save();
  } catch (error) {
    D.log({
      message: "U-F16: call-queue MISSED save failed",
      data: { callRef, error: String(error) },
    });
    state.addSystemErrorToStack(
      ERROR_CODES.CALL_RING_FAILED,
      "We could not complete the call just now. Please try again."
    );
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return; // save aborted via the error stack — do not open the popup
  }

  // Stash callRef for the popup-submit invocation (survives via Redis), then open the
  // voicemail-capture popup. Reset the transient capture Doc in place (rule 26 — never
  // cloneAndInit): new docId FIRST, then clear values, so a warm container cannot leak
  // a prior recording's envelope onto this popup.
  state.setField(STATE_KEYS.CURRENT_CALL_REF, callRef);
  voicemailDoc.docId = state.getUniqueId();
  for (const field of voicemailDoc.fields) {
    field.value = null;
  }
  voicemailDoc.sendQuickFormResponse();
};

// --- 2. Popup submit: auto-create the source=CALL report, link the voicemail ---
voicemailDoc.onSubmit = async (self) => {
  // Which call this voicemail belongs to (stashed by onResolution; the submit is a
  // separate invocation). Without it we cannot link the report — fail safe.
  const callRef = state.getField(STATE_KEYS.CURRENT_CALL_REF);
  if (!callRef) {
    state.addSystemErrorToStack(
      500,
      "We lost track of your call. Please call the compliance team again."
    );
    return;
  }

  // The audio envelope: { value:<s3-key>, fileName, fileScopeValue:"domain" } or null.
  const voicemail = self.f[voicemailFileField.id]?.value;

  // No file attached -> the reporter chose not to leave a message. The call already
  // stands as MISSED; create no report. Close calmly and clear the stash.
  if (!voicemail || !voicemail.value) {
    state.clearField(STATE_KEYS.CURRENT_CALL_REF);
    "No problem — no voice message was sent. If you would still like to raise something, you can submit a report or call the compliance team again at any time. You remain anonymous.".sendResponse();
    return;
  }

  // Validate the audio (extension allow-list; byte-size/duration are NOT enforceable
  // from the envelope — documented limitation, see the header + report-validation.js).
  const { valid, reason } = validateEvidenceEnvelope(voicemail);
  if (!valid) {
    state.addErrorToStack(
      ERROR_CODES.INVALID_EVIDENCE_FILE,
      `${reason} Please record or upload an audio message (for example .mp3, .m4a or .wav).`
    );
    return;
  }

  // Build the source=CALL report. reportDoc is the shared autoSave Data Doc — reset it
  // fully so no draft residue from the reporter's buffer leaks in, set the PK + docId
  // FIRST, then populate. Mirrors the U-F8 transform shape but for the voicemail path:
  // reporterId EMPTY (no tracking owner), source=CALL, neutral OTHER/MEDIUM defaults
  // (a voicemail carries no structured category/urgency), the audio as evidenceFile1.
  const now = Date.now();
  let reportId = generateReportId();
  reportDoc.docId = reportId;
  for (const field of reportDoc.fields) {
    field.value = null;
  }
  // Warm-container hygiene: reportDoc is a SHARED singleton and statusHistory /
  // amendments are forCollection sub-collections on it. Clearing reportDoc.fields
  // above does NOT clear sub-collection ROWS — so a prior report handled in the same
  // warm Lambda container would otherwise leave its timeline/amendment rows on the
  // graph and serialise them into THIS CALL report on save(). Empty every embedded
  // collection (covers the live subCollections list) plus the status-history
  // collection via its helper (covers the singleton-fallback path on a cold graph).
  for (const sub of reportDoc.subCollections || []) {
    for (const row of (sub.rows || []).slice()) {
      sub.removeRow(row);
    }
  }
  const historyCollection = getStatusHistoryCollection(reportDoc);
  for (const row of (historyCollection.rows || []).slice()) {
    historyCollection.removeRow(row);
  }
  reportDoc.f[reportIdField.id].value = reportId;
  reportDoc.f[reporterIdField.id].value = ""; // anonymous — no owner (SPEC.md)
  reportDoc.f[sourceField.id].value = SOURCE.CALL;
  reportDoc.f[statusField.id].value = STATUS.OPEN;
  reportDoc.f[createdOnField.id].value = now;
  reportDoc.f[updatedOnField.id].value = now;
  reportDoc.f[versionField.id].value = 1;
  reportDoc.f[reopenCountField.id].value = 0;
  reportDoc.f[categoryField.id].value = CATEGORY.OTHER;
  reportDoc.f[urgencyField.id].value = URGENCY.MEDIUM;
  reportDoc.f[locationField.id].value = LOCATION.OTHER;
  reportDoc.f[severityField.id].value = severityFromUrgency(URGENCY.MEDIUM);
  reportDoc.f[incidentDateField.id].value = now; // call time; isValidIncidentDate ok
  reportDoc.f[descriptionField.id].value = VOICEMAIL.DEFAULT_REPORT_DESCRIPTION;
  reportDoc.f[assignedToField.id].value = assignedRoleFor({
    againstAdmin: false,
  });
  // The voicemail as evidence — store the FULL envelope (preserves fileScopeValue so
  // the admin's signed-URL builder uses domain scope, not conversation).
  reportDoc.f[evidenceFile1Field.id].value = voicemail;

  // First statusHistory row (-> OPEN, SYSTEM) — the transition path (rule 12). The
  // timeline was emptied above, so this is the sole creation row; actorRole = SYSTEM
  // (auto-created, never a reporter id — anonymity).
  appendStatusHistoryRow(reportDoc, {
    toStatus: STATUS.OPEN,
    actorRole: ACTOR_ROLE.SYSTEM,
    note: VOICEMAIL.STATUS_HISTORY_NOTE,
  });

  // Persist with retry-on-collision (ER-B9). save() runs reportDoc.onSave (evidence +
  // contact gate): the single audio file passes the count/extension check, and the
  // unset contact method requires no value, so the gate passes. A gate abort adds to
  // the error stack WITHOUT throwing — detect it and do not claim success.
  let persisted = false;
  for (
    let attempt = 1;
    attempt <= MAX_SAVE_ATTEMPTS && !persisted;
    attempt += 1
  ) {
    const errorsBefore = (state.errorStack || []).length;
    try {
      await reportDoc.save();
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < MAX_SAVE_ATTEMPTS) {
        reportId = generateReportId();
        reportDoc.docId = reportId;
        reportDoc.f[reportIdField.id].value = reportId;
        D.log({
          message: "U-F16: reportId collision, regenerating",
          data: { attempt },
        });
        continue;
      }
      D.log({
        message: "U-F16: voicemail report save failed",
        data: { callRef, error: String(error) },
      });
      state.addSystemErrorToStack(
        500,
        "We could not save your voice message just now. Please try again."
      );
      return;
    }
    if ((state.errorStack || []).length > errorsBefore) {
      return;
    }
    persisted = true;
  }

  // Stamp voicemailKey + linkedReportId onto the call-queue row. Re-read fresh by
  // callRef (separate invocation) and only stamp if the row is still ours and MISSED —
  // a guarded write, idempotent if a retry repeats it.
  try {
    await callQueueDoc.loadDocument({ callRef });
    if (
      callQueueDoc.f[callRefField.id]?.value === callRef &&
      callQueueDoc.f[callStatusField.id]?.value === CALL_STATUS.MISSED
    ) {
      callQueueDoc.f[voicemailKeyField.id].value = voicemail.value;
      callQueueDoc.f[linkedReportIdField.id].value = reportId;
      await callQueueDoc.save();
    }
  } catch (error) {
    // The report IS created and sent — a failure to back-link the call-queue row is
    // non-fatal (logged). Do not fail the reporter's flow over it.
    D.log({
      message: "U-F16: call-queue voicemail back-link failed (non-fatal)",
      data: { callRef, reportId, error: String(error) },
    });
  }

  // Clear the stash so a stale callRef cannot leak into a later popup.
  state.clearField(STATE_KEYS.CURRENT_CALL_REF);

  // X1 (rule 16): emit the identity-free MSG_NEW_REPORT for this auto-created
  // source=CALL report, AFTER save(). Same payload shape + best-effort guarantees as
  // submit-report.js — read off the just-saved reportDoc (a system report; reporterId is
  // empty by construction, never sent). Mirror of the submit-report.js sender.
  await sendNewReportMessage(reportDoc);

  "Thank you. Your voice message has been received securely and passed to the compliance team, who will follow it up. Your identity has remained anonymous throughout.".sendResponse();
};

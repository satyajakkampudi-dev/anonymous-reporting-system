// U-F15 — Anonymous call: start (masked, voice-only).
//
// Independent intent (Context B). Triggered by the Home "Call compliance" CTA
// (data-action="intent" → INTENT.START_ANONYMOUS_CALL). On resolution it:
//   1. Attaches to the existing context (Context.Create — preserves the buffer; the
//      call does not touch reportDoc but the app is contextAware, rule 22).
//   2. Creates a voice-only masked Daily.co meeting and mints the reporter's masked
//      guest token (lib/calling.initiateAnonymousCall — masked/system host, NEVER
//      state.user.userEmail; no recording; startVideoOff). Returns { callRef, meetingId }.
//   3. Persists an IDENTITY-FREE RINGING call-queue entry keyed by callRef
//      (retry-on-collision, ER-B9). The Doc carries NO reporter id/email/name.
//   4. [X3] AFTER save() the MSG_INCOMING_CALL ring fan-out is wired here (rule 16) —
//      payload { callRef, meetingId } only. NOT built in U-F15 (X3 depends on U-F15);
//      the hook is marked below, mirroring the X1 hook in submit-report.js.
//   5. Places the reporter into the meeting as the masked guest, voice-only
//      (videoCall.sendResponse(JOIN_MEETING) — uses the masked-guest token minted in
//      step 2, so the reporter shows as an opaque "Anonymous Reporter", camera off).
//
// ANONYMITY (NON-NEGOTIABLE, ER-A5): nothing here writes or sends a reporter
// identity. The meeting host is masked, the reporter joins as a throwaway guest, the
// queue row is identity-free, and the (future) ring payload carries only callRef +
// meetingId. All masking lives in lib/calling.js; this frame only orchestrates.

import { VideoCall } from "@frontmltd/frontmjs/core/VideoCall";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../docs/call-queue-doc";
import {
  callRefField,
  callStatusField,
  meetingIdField,
  callCreatedOnField,
} from "../sections/call-queue";
import { initiateAnonymousCall, generateCallRef } from "../../../lib/calling";
import { isDuplicateKeyError } from "../../../lib/id-generator";
import { CALL_STATUS, ERROR_CODES } from "../../../lib/constants";
import { INTENT, VIDEO_CALL } from "../constants";

// VideoCall instance — MUST be exported so the framework can route JOIN_MEETING and
// the call-lifecycle responses (docs: "the VideoCall instance must be exported").
// lib/calling.initiateAnonymousCall drives createMeeting/getAccessToken on it; this
// frame drives the JOIN_MEETING response.
export const anonymousVideoCall = new VideoCall(VIDEO_CALL.CONTROL_ID, state);

// Retry bound for the (vanishingly rare) callRef unique-index collision (ER-B9).
const MAX_SAVE_ATTEMPTS = 3;

export const startAnonymousCall = Intent.Create({
  intentId: INTENT.START_ANONYMOUS_CALL,
  prompt: "Call the compliance team anonymously",
  state,
});

startAnonymousCall.onResolution = async () => {
  // 1. Attach to the existing context (preserve the autoSaveBuffer — rule 22).
  await Context.Create(state.currentTabId, { state });

  // 2. Create the masked voice-only meeting + mint the masked guest token. On a
  //    non-200 from the video-call capability, createMeeting pushes a system error
  //    and returns undefined → meetingId is empty; surface a calm message and stop.
  let call;
  try {
    call = await initiateAnonymousCall({ videoCall: anonymousVideoCall });
  } catch (error) {
    D.log({
      message: "U-F15: initiateAnonymousCall failed",
      data: { error: String(error) },
    });
    state.addSystemErrorToStack(
      ERROR_CODES.CALL_RING_FAILED,
      "We could not start the call just now. Please try again."
    );
    return;
  }

  let { callRef } = call || {};
  const meetingId = call && call.meetingId;
  if (!meetingId || !callRef) {
    D.log({
      message: "U-F15: meeting/callRef missing after createMeeting",
      data: { callRef },
    });
    state.addErrorToStack(
      ERROR_CODES.CALL_RING_FAILED,
      "We could not connect you to the compliance team just now. Please try again."
    );
    return;
  }

  // 3. Persist the IDENTITY-FREE RINGING entry. Reset the Doc first so warm-container
  //    residue from an earlier call can never leak onto the new row, then set only the
  //    creation fields. Upsert by callRef; regenerate + retry on a genuine collision.
  for (const field of callQueueDoc.fields) {
    field.value = null;
  }
  const now = Date.now();
  callQueueDoc.f[callRefField.id].value = callRef;
  callQueueDoc.f[callStatusField.id].value = CALL_STATUS.RINGING;
  callQueueDoc.f[meetingIdField.id].value = meetingId;
  callQueueDoc.f[callCreatedOnField.id].value = now;

  let persisted = false;
  for (
    let attempt = 1;
    attempt <= MAX_SAVE_ATTEMPTS && !persisted;
    attempt += 1
  ) {
    const errorsBefore = (state.errorStack || []).length;
    try {
      await callQueueDoc.save();
    } catch (error) {
      if (isDuplicateKeyError(error) && attempt < MAX_SAVE_ATTEMPTS) {
        callRef = generateCallRef();
        callQueueDoc.f[callRefField.id].value = callRef;
        D.log({
          message: "U-F15: callRef collision, regenerating",
          data: { attempt },
        });
        continue;
      }
      D.log({
        message: "U-F15: call-queue save failed",
        data: { error: String(error) },
      });
      state.addSystemErrorToStack(
        ERROR_CODES.CALL_RING_FAILED,
        "We could not start the call just now. Please try again."
      );
      return;
    }
    // save() can abort WITHOUT throwing if a field/onSave gate stacks an error.
    if ((state.errorStack || []).length > errorsBefore) {
      return;
    }
    persisted = true;
  }

  // 4. [X3 hook — rule 16] AFTER save(): ring all available admins via the
  //    identity-free MSG_INCOMING_CALL bot-to-bot message + VoIP push, payload
  //    { callRef, meetingId } ONLY (lib/calling.ringAvailableAdmins). Built by task
  //    X3 (which depends on U-F15) — do NOT invent the sender here.

  // 5. Place the reporter into the meeting as the masked guest (voice-only, camera
  //    off via the meeting's startVideoOff). Uses the masked-guest token minted in
  //    step 2 — the reporter never appears under their real name.
  anonymousVideoCall.sendResponse(
    ALL_CONSTANTS.VIDEO_CALL_ACTIONS.JOIN_MEETING
  );
};

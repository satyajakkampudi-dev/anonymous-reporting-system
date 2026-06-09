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
import {
  initiateAnonymousCall,
  generateCallRef,
  resolveAvailableAdmins,
  ringAvailableAdmins,
} from "../../../lib/calling";
import { resolvePeerBotId } from "../../../lib/notifications";
import { isDuplicateKeyError } from "../../../lib/id-generator";
import {
  CALL_STATUS,
  ERROR_CODES,
  TIMING,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import { INTENT, VIDEO_CALL, VOICEMAIL } from "../constants";

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
  // ENTER — proves the intent actually dispatched from the Home CTA click.
  D.log({
    message: "U-F15: ENTER — Call compliance clicked",
    data: {
      userId: state.user?.userId,
      conversationId: state.conversationId,
      userDomain: state.currentUserDomain,
    },
  });

  // 1. Attach to the existing context (preserve the autoSaveBuffer — rule 22).
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  D.log({ message: "U-F15: context ready" });

  // 2. Create the masked voice-only meeting + mint the masked guest token. On a
  //    non-200 from the video-call capability, createMeeting pushes a system error
  //    and returns undefined → meetingId is empty; surface a calm message and stop.
  let call;
  D.log({ message: "U-F15: → initiateAnonymousCall" });
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
  D.log({
    message: "U-F15: ← initiateAnonymousCall ok",
    data: {
      callRef,
      meetingId,
      hasGuestToken: !!(call && call.guestToken),
      meetingUrl: call && call.meetingUrl,
    },
  });
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
  D.log({
    message: "U-F15: meeting/callRef validated",
    data: { callRef, meetingId },
  });

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
    D.log({ message: "U-F15: → save call-queue", data: { callRef, attempt } });
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
      D.log({
        message: "U-F15: call-queue save aborted by onSave gate (no throw)",
        data: {
          callRef,
          attempt,
          errorsBefore,
          errorsNow: (state.errorStack || []).length,
          stackedErrors: (state.errorStack || [])
            .slice(errorsBefore)
            .map((e) => (e && (e.message || e.errorMessage)) || String(e)),
        },
      });
      return;
    }
    persisted = true;
  }
  D.log({ message: "U-F15: RINGING entry persisted", data: { callRef } });

  // 3b. [U-F16] Arm the 30s no-answer timeout. The jobScheduler delivers a message to
  //    the reporter's OWN conversation after CALL_RING_TIMEOUT_MS that fires
  //    INTENT.CALL_TIMEOUT (frames/call-timeout.js). That handler re-reads THIS
  //    call-queue row and, ONLY if it is still unclaimed-RINGING, transitions it to
  //    MISSED and offers a voicemail. If an admin answers first (A-F21 sets ACTIVE /
  //    attendedBy) the timeout is a guarded no-op — no cancellation needed. The jobId
  //    is deterministic per call so a re-armed timer overwrites rather than stacks.
  //    Best-effort: if scheduling fails, the reporter still joins the meeting; only the
  //    voicemail fallback is lost, which is logged.
  try {
    await state.jobScheduler.scheduleMessage({
      toUser: state.user.userId,
      jobId: `${VOICEMAIL.JOB_ID_PREFIX}${callRef}`,
      schedule: Date.now() + TIMING.CALL_RING_TIMEOUT_MS,
      messages: [
        { intentId: INTENT.CALL_TIMEOUT, data: { callRef, meetingId } },
      ],
    });
    D.log({ message: "U-F15: no-answer timeout armed", data: { callRef } });
  } catch (error) {
    D.log({
      message: "U-F15/16: failed to arm the no-answer timeout",
      data: { callRef, error: String(error) },
    });
  }

  // 4. [X3 — rule 16] AFTER save(): ring all CURRENTLY-AVAILABLE admins via the
  //    identity-free MSG_INCOMING_CALL bot-to-bot message + VoIP push, payload
  //    { callRef, meetingId } ONLY (lib/calling.ringAvailableAdmins builds both).
  //    resolveAvailableAdmins is the single source for "who is on call right now"
  //    (GLOBAL admins whose availability === AVAILABLE) — ONLY those are rung. botId is
  //    the admin app, from deployment static data. Best-effort + logged; a ring fault
  //    must NEVER block the reporter from joining the meeting (step 5) — the no-answer
  //    timeout (step 3b) is the backstop. No available admins → ringAvailableAdmins
  //    logs and rings no one; the timeout still offers voicemail.
  try {
    const admins = await resolveAvailableAdmins();
    D.log({
      message: "U-F15: admins resolved",
      data: { callRef, count: (admins || []).length },
    });
    const toBotId = await resolvePeerBotId(STATIC_DATA_KEYS.ADMIN_BOT_ID);
    D.log({
      message: "U-F15: admin botId resolved",
      data: { callRef, toBotId },
    });
    await ringAvailableAdmins({
      callRef,
      meetingId,
      admins,
      toBotId,
      userDomain: state.currentUserDomain,
    });
    D.log({
      message: "U-F15: ring fan-out done",
      data: { callRef, count: (admins || []).length },
    });
  } catch (error) {
    D.log({
      message:
        "U-F15/X3: ringAvailableAdmins failed (non-fatal — reporter still joins)",
      data: { callRef, error: String(error) },
    });
  }

  // 5. Place the reporter into the meeting as the masked guest (voice-only, camera
  //    off via the meeting's startVideoOff). Uses the masked-guest token minted in
  //    step 2 — the reporter never appears under their real name.
  D.log({ message: "U-F15: → JOIN_MEETING", data: { callRef, meetingId } });
  try {
    anonymousVideoCall.sendResponse(
      ALL_CONSTANTS.VIDEO_CALL_ACTIONS.JOIN_MEETING
    );
    D.log({
      message: "U-F15: ✓ JOIN_MEETING sent",
      data: { callRef, meetingId },
    });
  } catch (error) {
    D.log({
      message: "U-F15: JOIN_MEETING sendResponse threw",
      data: { callRef, meetingId, error: String(error) },
    });
    state.addSystemErrorToStack(
      ERROR_CODES.CALL_RING_FAILED,
      "We could not connect you to the call just now. Please try again."
    );
  }
};

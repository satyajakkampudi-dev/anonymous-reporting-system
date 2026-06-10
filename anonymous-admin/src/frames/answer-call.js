// A-F21 - Answer call: atomic claim (first writer wins) + join + STOP_RING.
//
// Independent intent (Context B - object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Fired by the "Answer" button in the Incoming-call ring banner
// (A-D-incomingcall): data-action="intent", intentId = answerCall, data-payload
// '{"callRef":"...","meetingId":"..."}' - both fields ONE LEVEL DEEP under
// state.messageFromUser.payload (CLAUDE.md "Custom HTML Payloads").
//
// ATOMIC CLAIM (framework-mapping rule 13 - status-conditional transition). Multiple
// admins ring at once; the FIRST to flip RINGING -> ACTIVE (and stamp attendedBy) wins.
// We re-read the call-queue row FRESH by callRef and proceed ONLY if it is still
// RINGING AND unclaimed (!attendedBy). Concurrent answers lose CLEANLY: the loser reads
// a non-RINGING / already-attended row and short-circuits with a calm "already answered"
// message - no join, no STOP_RING, no busy-flip.
//
// TOCTOU RESIDUAL (documented, accepted by ER-B8). The guard is read-then-write, not a
// DB-level compare-and-swap. callQueueDoc is loaded by callRef (its primaryKey), so
// save() is an UPDATE, not an upsert - there is NO save(false, { version }) optimistic-
// concurrency path on this Doc (the call-queue carries no version field; adding one and
// passing a stale version would make save() attempt an INSERT and corrupt the row). The
// residual window is the few milliseconds between the read and the save in two truly
// simultaneous Lambdas: both could read RINGING and both write ACTIVE, the second
// overwriting attendedBy. ER-B8 accepts this - the cost is cosmetic (attendedBy reflects
// the last writer; both admins still land in the SAME meeting, which is harmless for a
// voice call), and the STOP_RING fan-out plus the human reality of "two people answered
// the same call" resolves it. A heavier CAS is explicitly NOT warranted here (D-calling).
//
// ANONYMITY (NON-NEGOTIABLE, ER-A5): attendedBy is the ADMIN'S OWN userId (admin-side
// only - NEVER a reporter). The meeting is voice-only with NO recording (the meeting was
// created startVideoOff + enableRecording:false in U-F15; the admin merely JOINS it). The
// STOP_RING payload carries ONLY { callRef, meetingId } - identity-free (lib/calling).

import { VideoCall } from "@frontmltd/frontmjs/core/VideoCall";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../docs/call-queue-doc";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import {
  callRefField,
  callStatusField,
  attendedByField,
  answeredOnField,
} from "../sections/call-queue";
import { setOwnAvailability } from "./availability-writer";
import {
  resolveAvailableAdmins,
  sendCallStopRing,
  getMeetingLoftHost,
} from "../../../lib/calling";
import {
  CALL_STATUS,
  AVAILABILITY,
  TIMING,
  userTab,
} from "../../../lib/constants";
import { showScreen, SCREEN } from "./display-nav";
import { INTENT, CALL, CONTEXT } from "../constants";

// VideoCall instance - MUST be exported so the framework can route JOIN_MEETING (docs:
// "the VideoCall instance must be exported to be accessible by the framework"; video-call
// ref § getAccessToken/sendResponse). Mirrors the user app's anonymousVideoCall. Distinct
// control id (VIDEO_CALL.CONTROL_ID = "adminVideoCall") - each app exports its own.
export const adminVideoCall = new VideoCall("adminVideoCall", state);

export const answerCall = Intent.Create({
  intentId: INTENT.ANSWER_CALL,
  prompt: "Answer an incoming anonymous compliance call",
  state,
});

answerCall.onResolution = async () => {
  // 1. Payload (one level deep). callRef is mandatory; meetingId is needed to join.
  const { callRef, meetingId } = state.messageFromUser?.payload || {};
  D.log({
    message: "A-F21: ENTER - Answer clicked",
    data: {
      callRef,
      meetingId,
      hasPayload: !!state.messageFromUser?.payload,
      userId: state.user?.userId,
    },
  });
  if (!callRef) {
    state.addErrorToStack(400, "Missing callRef for answerCall");
    return;
  }

  // 2. Attach to the existing context (Redis buffer, no MongoDB-clobbering reload -
  //    rule 22) and re-read THIS call-queue row fresh by callRef.
  // Stable per-user On-call tab (rule 37): the Answer click carries no tabId, so a
  // `getUniqueId()` context spawned a new broken tab on the banner-clear render (step 6b).
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });

  // 2b. Stop the web ring IMMEDIATELY on answer (before the async claim/save below). The
  //     reference (callCentreQueueDataModel.attendCall) calls stopRing() FIRST and AGAIN
  //     before join - one RING_STOP can be missed, and the user reported the ring kept
  //     sounding after answering. Early + late (step 5b) RING_STOP, both on the On-call tab.
  try {
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP);
    D.log({
      message: "A-F21: early RING_STOP sent (ringStop)",
      data: { callRef },
    });
  } catch (error) {
    D.log({
      message: "A-F21: early RING_STOP failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  await callQueueDoc.loadDocument({ callRef });

  const loadedRef = callQueueDoc.f[callRefField.id]?.value || "";
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  const attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";

  // 3. ATOMIC CLAIM guard (rule 13). Proceed ONLY if the row is ours, still RINGING and
  //    unclaimed. Any other state → a concurrent admin won, the reporter abandoned, or
  //    the ring timed out: the LOSER loses cleanly (no join / no STOP_RING / no busy).
  if (loadedRef !== callRef || status !== CALL_STATUS.RINGING || attendedBy) {
    D.log({
      message: "A-F21: answer no-op (call not in unclaimed RINGING state)",
      data: {
        callRef,
        status,
        claimed: !!attendedBy,
        found: loadedRef === callRef,
      },
    });
    "This call has already been answered.".sendResponse();
    return;
  }

  // 4. WIN - claim it. RINGING -> ACTIVE, stamp the answering admin + answer time. (See
  //    the header for the accepted TOCTOU residual: no version/CAS on this Doc.)
  const now = Date.now();
  callQueueDoc.f[callStatusField.id].value = CALL_STATUS.ACTIVE;
  callQueueDoc.f[attendedByField.id].value = state.user.userId;
  callQueueDoc.f[answeredOnField.id].value = now;

  // Persist. save() can abort WITHOUT throwing by stacking an error - detect that the
  // same way the other transition frames do and do not claim the win.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await callQueueDoc.save();
  } catch (error) {
    D.log({
      message: "A-F21: claim save failed",
      data: { callRef, error: String(error) },
    });
    state.addSystemErrorToStack(
      500,
      "We could not answer the call just now. Please try again."
    );
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return; // save aborted via the error stack - do not proceed as the winner
  }

  // 5. Busy-on-answer (OQ-12) via the SHARED writer (rule 14 - no duplication; the
  //    context is already attached so attach:false). BEST-EFFORT: a failure to flip
  //    presence must NOT strand a successfully-claimed call - log and continue.
  const busy = await setOwnAvailability(AVAILABILITY.BUSY, { attach: false });
  if (!busy.ok) {
    D.log({
      message: "A-F21: busy-on-answer failed (non-fatal)",
      data: { callRef, reason: busy.reason },
    });
  }

  // 5b. Silence THIS admin's own audible web ring (started by the X3 receiver via
  //     RING_START) before opening the meeting. RING_STOP = "ringStop"; there is no
  //     "RING_STOP_ACTION" key in VIDEO_CALL_ACTIONS (that's a static method on VideoCall).
  try {
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP);
  } catch (error) {
    D.log({
      message: "A-F21: RING_STOP (own ring) failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  // 6. JOIN the EXISTING meeting (video-call ref § getAccessToken / sendResponse - the
  //    canonical "join an existing meeting by meetingId" pattern: mint an access token
  //    for the already-created meetingId, then sendResponse(JOIN_MEETING)). Voice-only /
  //    no recording is enforced by the MEETING itself (created startVideoOff +
  //    enableRecording:false in U-F15, ER-A5) - the admin only joins it; nothing here
  //    enables video or recording. If the join fails AFTER the claim we DO NOT revert:
  //    reverting to RINGING would re-ring every admin for a call that is already claimed
  //    (worse UX, and the meeting may well be live for the reporter). The call stays
  //    ACTIVE; the inactivity backstop (step 8) will ENDED it if it is truly dead. We
  //    surface a calm message and log. (D-calling: claim is authoritative; join is a
  //    best-effort follow-on.)
  if (!meetingId) {
    D.log({
      message: "A-F21: claimed but no meetingId in payload - cannot join",
      data: { callRef },
    });
    "You have answered the call, but we could not open the meeting automatically. Please try re-joining from your call screen.".sendResponse();
  } else {
    try {
      // useDaily MUST match the meeting (created useDaily:true in U-F15). The framework
      // defaults getAccessToken's useDaily to FALSE - a non-Daily token for a Daily
      // meeting never validates, so the admin client hangs at "connecting" then drops
      // (the symptom observed live). Mirrors the reference answerer (healthMariner
      // queueRouting.joinCall: getAccessToken({ meetingId, guestEmail, useDaily:true })).
      await adminVideoCall.getAccessToken({ meetingId, useDaily: true });
      // serverUrl before JOIN (SeaMedix openMeeting pattern) = bare FrontM "Loft" player
      // HOST (e.g. dailydev.frontm.ai); the client opens https://<lofthost>/<roomId>. NOT
      // the full Daily room URL (that produced the broken double-protocol/dup-room URL).
      adminVideoCall.serverUrl = await getMeetingLoftHost();
      D.log({
        message: "A-F21: access token minted (useDaily)",
        data: {
          callRef,
          meetingId,
          domain: adminVideoCall.domain,
          serverUrl: adminVideoCall.serverUrl,
        },
      });
      adminVideoCall.sendResponse(
        ALL_CONSTANTS.VIDEO_CALL_ACTIONS.JOIN_MEETING
      );
    } catch (error) {
      D.log({
        message: "A-F21: join-meeting failed after claim (call stays ACTIVE)",
        data: { callRef, error: String(error) },
      });
      "You have answered the call, but we could not connect you to the meeting just now. Please try re-joining from your call screen.".sendResponse();
    }
  }

  // 6b. Re-render the admin shell so THIS admin's screen reflects the claim: the
  //    incoming-call section re-gates on status (now ACTIVE, not RINGING) → the ring
  //    banner clears. Without this the banner persists (the JOIN_MEETING response opens
  //    the meeting surface but never refreshes the chat/dashboard view). The dashboard
  //    sections are empty-safe and read persisted state.setField stashes, so re-rendering
  //    here is safe in this Context-B invocation. Mirrors the X3 receiver's render call.
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  D.log({
    message: "A-F21: admin display re-rendered (banner cleared)",
    data: { callRef },
  });

  // 7. STOP_RING (X7) - tell the OTHER currently-available admins to stop ringing. The
  //    available set is the SAME set X3 rang (lib/calling.resolveAvailableAdmins);
  //    exclude SELF. Identity-free payload { callRef, meetingId }. botId/userDomain are
  //    OMITTED: this is an admin->admin message within the SAME bot + domain, and
  //    sendMessageToUserInBot defaults both to the current bot/domain (bot-to-bot guide
  //    § sendMessageToUserInBot). No existing X3 caller exists yet to mirror - the
  //    default is correct here and documented. Best-effort (lib helper logs failures).
  try {
    const others = (await resolveAvailableAdmins())
      .filter((a) => a.adminUserId !== state.user.userId)
      .map((a) => a.adminUserId);
    if (others.length) {
      await sendCallStopRing({ callRef, meetingId, userIds: others });
    }
  } catch (error) {
    D.log({
      message: "A-F21: STOP_RING fan-out failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  // 8. Arm the mid-call inactivity backstop (ER-C12). A jobScheduler message to the
  //    answering admin's OWN userId at now + CALL_INACTIVITY_TIMEOUT_MS, carrying
  //    { callRef }, fires INTENT.CALL_INACTIVITY (frames/end-call.js) which runs the
  //    guarded ACTIVE -> ENDED transition ONLY if the call is still ACTIVE (a clean prior
  //    hang-up makes it a no-op). Deterministic jobId per call so a re-arm overwrites
  //    rather than stacks (ER-B8). Best-effort: a scheduling failure must not strand the
  //    claim - the worst case is a stuck-ACTIVE row, which a manual end still closes.
  try {
    await state.jobScheduler.scheduleMessage({
      toUser: state.user.userId,
      jobId: `${CALL.INACTIVITY_JOB_ID_PREFIX}${callRef}`,
      schedule: Date.now() + TIMING.CALL_INACTIVITY_TIMEOUT_MS,
      messages: [{ intentId: INTENT.CALL_INACTIVITY, data: { callRef } }],
    });
  } catch (error) {
    D.log({
      message: "A-F21: failed to arm the inactivity backstop (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  D.log({
    message: "A-F21: call claimed",
    data: { callRef, from: CALL_STATUS.RINGING, to: CALL_STATUS.ACTIVE },
  });
};

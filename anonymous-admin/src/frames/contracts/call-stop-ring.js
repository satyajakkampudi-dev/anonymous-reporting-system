// X7 RECEIVER - MSG_CALL_STOP_RING (anonymous-admin -> anonymous-admin).
//
// The RECEIVING half of the MSG_CALL_STOP_RING contract. The SENDER is the admin app
// itself (answer-call.js A-F21, via lib/calling.sendCallStopRing) which, AFTER it
// claims a RINGING call (CAS to ACTIVE) and joins, fans an identity-free
// { callRef, meetingId } to every OTHER ringing admin (userIds excludes self;
// botId omitted so sendMessageToUserInBot defaults to the CURRENT bot - correct for
// admin -> admin). This receiver runs in each of those other admins' contexts to
// STOP their ring: another admin already took the call.
//
// INDEPENDENT INTENT (Context B - object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Matched by onMatching === MSG.CALL_STOP_RING and nothing else.
//
// MIRROR OF THE X3 RING-TRIGGER (contracts/incoming-call.js), but in REVERSE: the
// in-app incoming-call banner (sections/display/incoming-call) renders ONLY when the
// loaded callQueueDoc.status === RINGING. By the time this message lands the call has
// been claimed (status ACTIVE), so re-loading callQueueDoc({ callRef }) and re-rendering
// adminDisplayDoc.sendResponse() fires the banner's SYNCHRONOUS onResponse against a
// now-ACTIVE call -> it emits nothing -> the banner DISMISSES. The X3 receiver now also
// starts an audible WEB ring (RING_START = "ringStart"), so this receiver additionally
// issues RING_STOP ("ringStop") to silence it - the banner re-render alone does NOT stop
// the framework's web ring. (Mobile VoIP/CallKit has no documented recall; ring actions
// "do not affect mobile push notifications" per the video-call ref - the banner dismissal
// is its surface.) NOTE: the action values are RING_START / RING_STOP; there is no
// "RING_START_ACTION"/"RING_STOP_ACTION" KEY in VIDEO_CALL_ACTIONS (those are static
// METHODS on VideoCall that return the values). Load BEFORE reading/rendering (rule 21).
//
// IDEMPOTENT / STALE-SAFE. A duplicate or late stop-ring is harmless: if the call has
// already moved on (ENDED / MISSED / not found), the banner was already not RINGING, so
// the re-render is a no-op. Missing callRef -> ignored.
//
// ANONYMITY (rule 16/30, ER-A5). Payload is { callRef, meetingId } ONLY. callQueueDoc is
// identity-free by construction (lib/collections/call-queue.js). Nothing here reads or
// echoes any reporter identity.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { adminVideoCall } from "../answer-call";
import { showScreen, SCREEN } from "../display-nav";
import { MSG, userTab } from "../../../../lib/constants";
import { CONTEXT } from "../../constants";

export const callStopRingReceiver = Intent.Create({
  intentId: "callStopRingReceiver",
  prompt: "Stop ringing - another admin claimed the anonymous call",
  state,
});

callStopRingReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.CALL_STOP_RING;

callStopRingReceiver.onResolution = async () => {
  // 1. Payload - { callRef, meetingId }, identity-free. callRef is the call-queue PK.
  const { callRef } = state.messageFromUser || {};
  if (!callRef) {
    D.log({
      message: "X7 receiver: MSG_CALL_STOP_RING missing callRef - ignored",
    });
    return;
  }

  // 2. Attach to the existing context (Redis buffer), then re-load the call-queue row
  //    FRESH by callRef (rule 21). It is now ACTIVE (claimed by another admin), so the
  //    incoming-call onResponse will read status !== RINGING and emit no banner.
  // Stable per-user On-call tab + On-call screen (rule 37) - mirror the X3 ring-trigger
  // so the dismiss re-renders the SAME tab (no new/broken tab).
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });
  try {
    await callQueueDoc.loadDocument({ callRef });
  } catch (error) {
    D.log({
      message: "X7 receiver: callQueueDoc load failed",
      data: { callRef, error: String(error) },
    });
    return;
  }

  // 3. Re-render the On-call screen - the incoming-call section's synchronous onResponse
  //    reads the now-ACTIVE callQueueDoc and renders nothing, dismissing the banner.
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();

  // 4. Silence the WEB ring this admin started in the X3 receiver (RING_START). The banner
  //    re-render alone does NOT stop the framework's audible web ring - RING_STOP does.
  //    (Mobile VoIP/CallKit has no documented recall; the banner dismissal is its surface.)
  try {
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP);
    D.log({
      message: "X7 receiver: web RING_STOP (ringStop)",
      data: { callRef },
    });
  } catch (error) {
    D.log({
      message: "X7 receiver: RING_STOP failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  D.log({
    message: "X7 receiver: ring stopped (call claimed by another admin)",
    data: { callRef },
  });
};

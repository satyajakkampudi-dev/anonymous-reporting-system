// X7 RECEIVER — MSG_CALL_STOP_RING (anonymous-admin -> anonymous-admin).
//
// The RECEIVING half of the MSG_CALL_STOP_RING contract. The SENDER is the admin app
// itself (answer-call.js A-F21, via lib/calling.sendCallStopRing) which, AFTER it
// claims a RINGING call (CAS to ACTIVE) and joins, fans an identity-free
// { callRef, meetingId } to every OTHER ringing admin (userIds excludes self;
// botId omitted so sendMessageToUserInBot defaults to the CURRENT bot — correct for
// admin -> admin). This receiver runs in each of those other admins' contexts to
// STOP their ring: another admin already took the call.
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Matched by onMatching === MSG.CALL_STOP_RING and nothing else.
//
// MIRROR OF THE X3 RING-TRIGGER (contracts/incoming-call.js), but in REVERSE: the
// in-app incoming-call banner (sections/display/incoming-call) renders ONLY when the
// loaded callQueueDoc.status === RINGING. By the time this message lands the call has
// been claimed (status ACTIVE), so re-loading callQueueDoc({ callRef }) and re-rendering
// adminDisplayDoc.sendResponse() fires the banner's SYNCHRONOUS onResponse against a
// now-ACTIVE call -> it emits nothing -> the banner DISMISSES. This re-render is the
// correct in-app surface for THIS app's ring model. There IS a documented VoIP ring
// action — videoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP_ACTION)
// (video-call ref §Ring Actions) — but it ONLY stops a WEB ring UI that was started
// with RING_START_ACTION, which this app never issues: the admin ring is a VoIP PUSH
// (lib/calling.ringAvailableAdmins -> sendVoipPushNotificationToUser) plus the in-app
// banner. The same doc (§Notes) states ring actions "do not affect mobile push
// notifications (handled separately)", and there is NO documented API to recall an
// already-delivered VoIP push. So RING_STOP_ACTION would be a no-op here (no matching
// RING_START), and the banner re-render is the only meaningful, documented dismissal.
// See FLAGGED. Load BEFORE reading/rendering (rule 21).
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
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { MSG } from "../../../../lib/constants";

export const callStopRingReceiver = Intent.Create({
  intentId: "callStopRingReceiver",
  prompt: "Stop ringing — another admin claimed the anonymous call",
  state,
});

callStopRingReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.CALL_STOP_RING;

callStopRingReceiver.onResolution = async () => {
  // 1. Payload — { callRef, meetingId }, identity-free. callRef is the call-queue PK.
  const { callRef } = state.messageFromUser || {};
  if (!callRef) {
    D.log({
      message: "X7 receiver: MSG_CALL_STOP_RING missing callRef — ignored",
    });
    return;
  }

  // 2. Attach to the existing context (Redis buffer), then re-load the call-queue row
  //    FRESH by callRef (rule 21). It is now ACTIVE (claimed by another admin), so the
  //    incoming-call onResponse will read status !== RINGING and emit no banner.
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  try {
    await callQueueDoc.loadDocument({ callRef });
  } catch (error) {
    D.log({
      message: "X7 receiver: callQueueDoc load failed",
      data: { callRef, error: String(error) },
    });
    return;
  }

  // 3. Re-render the admin shell — the incoming-call section's synchronous onResponse
  //    reads the now-ACTIVE callQueueDoc and renders nothing, dismissing the banner.
  adminDisplayDoc.sendResponse();

  D.log({
    message: "X7 receiver: ring stopped (call claimed by another admin)",
    data: { callRef },
  });
};

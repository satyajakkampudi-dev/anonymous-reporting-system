// RECEIVER - MSG_CALL_CLAIMED (anonymous-user -> anonymous-admin).
//
// Sent by the reporter (owner) app's join-driven claim (contracts/call-lifecycle.js) when an
// admin JOINS the meeting without having used the web Answer button - i.e. the MOBILE path,
// where lifting the native CallKit call doesn't run A-F21. The owner app has already set the
// call ACTIVE + attendedBy; this receiver runs in the answering admin's session and sets
// THEIR presence to busy (the web path already does this in A-F21). Mirrors healthMariner's
// joinMeetingIntent -> setAvailabilityStatus(busy).
//
// INDEPENDENT INTENT (Context B). Matched by onMatching === MSG.CALL_CLAIMED.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { adminVideoCall } from "../answer-call";
import { setOwnAvailability } from "../availability-writer";
import { showScreen, SCREEN } from "../display-nav";
import {
  resolveAvailableAdmins,
  sendCallStopRing,
} from "../../../../lib/calling";
import { AVAILABILITY, MSG, userTab } from "../../../../lib/constants";
import { CONTEXT } from "../../constants";

export const callClaimedReceiver = Intent.Create({
  intentId: "callClaimedReceiver",
  prompt: "Set me busy - I joined the anonymous call",
  state,
});

callClaimedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.CALL_CLAIMED;

callClaimedReceiver.onResolution = async () => {
  const { attendedBy, meetingId, callRef } = state.messageFromUser || {};
  D.log({
    message: "A-CALL-CLAIMED: MSG_CALL_CLAIMED received",
    data: { attendedBy, callRef, me: state.user?.userId },
  });
  // Defensive: targeted to the answering admin; only they go busy.
  if (attendedBy && attendedBy !== state.user?.userId) {
    D.log({
      message: "A-CALL-CLAIMED: not me - ignored",
      data: { attendedBy },
    });
    return;
  }
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });

  // 1. Go busy. On the WEB Answer path A-F21 already did all of this; the MOBILE CallKit
  //    accept does NOT run A-F21, so this receiver is the claimer's ONLY cleanup hook.
  const busy = await setOwnAvailability(AVAILABILITY.BUSY, { attach: false });

  // 2. Silence THIS admin's audible WEB ring. The same admin may have been ringing on a
  //    web session while they lifted the call on mobile - that web session is still showing
  //    the Answer/Dismiss banner and ringing. RING_STOP silences it (the banner re-render in
  //    step 4 dismisses the banner itself).
  try {
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP);
    D.log({ message: "A-CALL-CLAIMED: web RING_STOP", data: { callRef } });
  } catch (error) {
    D.log({
      message: "A-CALL-CLAIMED: RING_STOP failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  // 3. Tell the OTHER available admins to stop ringing too (X7). A-F21 normally fans this
  //    out after a web claim; on the mobile path A-F21 never ran, so do it here. Identity-
  //    free { callRef, meetingId }; botId omitted → current (admin) bot.
  try {
    const others = (await resolveAvailableAdmins())
      .filter((a) => a.adminUserId !== state.user?.userId)
      .map((a) => a.adminUserId);
    if (others.length) {
      await sendCallStopRing({ callRef, meetingId, userIds: others });
      D.log({
        message: "A-CALL-CLAIMED: stop-ring fanned to other admins",
        data: { callRef, others: others.length },
      });
    }
  } catch (error) {
    D.log({
      message: "A-CALL-CLAIMED: stop-ring others failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  // 4. Render the On-call screen - dismisses the Answer/Dismiss banner (the incoming-call
  //    section emits nothing once the call is no longer RINGING for this admin).
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  D.log({
    message: "A-CALL-CLAIMED: busy + ring stopped + on-call rendered",
    data: { ok: busy?.ok, callRef },
  });
};

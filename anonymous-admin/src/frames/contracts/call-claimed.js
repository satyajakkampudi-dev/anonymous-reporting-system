// RECEIVER — MSG_CALL_CLAIMED (anonymous-user -> anonymous-admin).
//
// Sent by the reporter (owner) app's join-driven claim (contracts/call-lifecycle.js) when an
// admin JOINS the meeting without having used the web Answer button — i.e. the MOBILE path,
// where lifting the native CallKit call doesn't run A-F21. The owner app has already set the
// call ACTIVE + attendedBy; this receiver runs in the answering admin's session and sets
// THEIR presence to busy (the web path already does this in A-F21). Mirrors healthMariner's
// joinMeetingIntent -> setAvailabilityStatus(busy).
//
// INDEPENDENT INTENT (Context B). Matched by onMatching === MSG.CALL_CLAIMED.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { setOwnAvailability } from "../availability-writer";
import { showScreen, SCREEN } from "../display-nav";
import { AVAILABILITY, MSG, userTab } from "../../../../lib/constants";
import { CONTEXT } from "../../constants";

export const callClaimedReceiver = Intent.Create({
  intentId: "callClaimedReceiver",
  prompt: "Set me busy — I joined the anonymous call",
  state,
});

callClaimedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.CALL_CLAIMED;

callClaimedReceiver.onResolution = async () => {
  const { attendedBy } = state.messageFromUser || {};
  D.log({
    message: "A-CALL-CLAIMED: MSG_CALL_CLAIMED received",
    data: { attendedBy, me: state.user?.userId },
  });
  // Defensive: targeted to the answering admin; only they go busy.
  if (attendedBy && attendedBy !== state.user?.userId) {
    D.log({
      message: "A-CALL-CLAIMED: not me — ignored",
      data: { attendedBy },
    });
    return;
  }
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });
  const busy = await setOwnAvailability(AVAILABILITY.BUSY, { attach: false });
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  D.log({
    message: "A-CALL-CLAIMED: availability set BUSY",
    data: { ok: busy?.ok },
  });
};

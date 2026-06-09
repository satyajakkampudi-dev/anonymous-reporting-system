// RECEIVER — MSG_CALL_ENDED (anonymous-user -> anonymous-admin).
//
// The reporter app (meeting OWNER) receives the Loft backend's endMeeting/leaveUser
// lifecycle intents (contracts/call-lifecycle.js) and, after ending the call, sends this
// identity-free { meetingId, attendedBy } to the ANSWERING admin's bot. This receiver runs
// in THAT admin's session and frees their on-call presence (busy -> available) — the final
// hop of the healthMariner notifyMedicalMember -> medicalMeetingEnded pattern. This is the
// reliable path: the backend fires lifecycle intents on the owner bot, not the admin bot.
//
// INDEPENDENT INTENT (Context B). Matched by onMatching === MSG.CALL_ENDED.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { setOwnAvailability } from "../availability-writer";
import { showScreen, SCREEN } from "../display-nav";
import { AVAILABILITY, MSG, userTab } from "../../../../lib/constants";
import { CONTEXT } from "../../constants";

export const callEndedReceiver = Intent.Create({
  intentId: "callEndedReceiver",
  prompt: "Free my on-call presence — the anonymous call ended",
  state,
});

callEndedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.CALL_ENDED;

callEndedReceiver.onResolution = async () => {
  // Payload is the sendBotMessage body, delivered AS state.messageFromUser (same shape as
  // the X3/X7 receivers). { meetingId, attendedBy }.
  const { attendedBy } = state.messageFromUser || {};
  D.log({
    message: "A-CALL-ENDED: MSG_CALL_ENDED received",
    data: { attendedBy, me: state.user?.userId },
  });

  // Defensive: the message is targeted to the answering admin; only they free presence.
  if (attendedBy && attendedBy !== state.user?.userId) {
    D.log({ message: "A-CALL-ENDED: not me — ignored", data: { attendedBy } });
    return;
  }

  // Attach to the On-call tab (rule 37), free presence, and re-render so the pill flips to
  // Available in place. Mirrors the X7 stop-ring receiver's tab handling.
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });
  const free = await setOwnAvailability(AVAILABILITY.AVAILABLE, {
    attach: false,
  });
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  D.log({
    message: "A-CALL-ENDED: availability set AVAILABLE",
    data: { ok: free?.ok },
  });
};

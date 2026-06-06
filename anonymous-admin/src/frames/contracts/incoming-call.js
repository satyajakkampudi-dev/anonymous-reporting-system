// X3 RECEIVER — MSG_INCOMING_CALL (anonymous-user -> anonymous-admin).
//
// The RECEIVING half of the MSG_INCOMING_CALL contract. The SENDER is the user app
// (start-anonymous-call.js U-F15) which, AFTER save() of the RINGING call-queue row,
// rings all CURRENTLY-AVAILABLE admins via lib/calling.ringAvailableAdmins — that helper
// performs BOTH the bot-to-bot MSG_INCOMING_CALL fan-out (this receiver) AND a VoIP push
// per admin. Both payloads are identity-free { callRef, meetingId } (rule 16/30).
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry). Matched by
// onMatching === MSG.INCOMING_CALL. The payload arrives under state.messageFromUser.
//
// THIS IS THE RING-TRIGGER FRAME the Incoming-call display section
// (sections/display/incoming-call/index.js) documents: that SYNCHRONOUS onResponse reads
// the loaded callQueueDoc (cross-doc, via the module-imported singleton — there is no
// `self` path from a Display-Doc section to an aux Doc) and shows the banner ONLY for a
// genuinely RINGING call. So this handler MUST, IN THE SAME INVOCATION:
//   1. load callQueueDoc({ callRef }) (rule 21 — load before reading), then
//   2. adminDisplayDoc.sendResponse() — which fires the incoming-call onResponse against
//      the now-hydrated callQueueDoc, surfacing the in-app ring banner.
//
// The VoIP push (the device-level ring) already happened on the SENDER side inside
// ringAvailableAdmins; this receiver surfaces the IN-APP banner for an admin whose app is
// open. The banner's Answer button (A-F21) carries the callRef + meetingId in its
// data-payload — the values travel via the hydrated Doc into the rendered button, never
// as visible text.
//
// ANONYMITY (rule 16/30, ER-A5). The payload is { callRef, meetingId } ONLY. callQueueDoc
// is identity-free by construction (lib/collections/call-queue.js — never a reporter
// id/email/name). The banner is wholly generic ("Incoming anonymous call").
//
// EMPTY-SAFE / GUARDED. Missing callRef → ignored. The display section itself re-gates on
// status === RINGING, so a call already claimed/ended/missed by the time this lands shows
// no banner (no stale resurrection). No notifyAssignees / job here — calling is real-time.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { MSG } from "../../../../lib/constants";

export const incomingCallReceiver = Intent.Create({
  intentId: "incomingCallReceiver",
  prompt: "Receive an incoming anonymous call ring from the reporter app",
  state,
});

incomingCallReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.INCOMING_CALL;

incomingCallReceiver.onResolution = async () => {
  // 1. Payload — { callRef, meetingId }, identity-free. callRef is the call-queue PK.
  const { callRef } = state.messageFromUser || {};
  if (!callRef) {
    D.log({
      message: "X3 receiver: MSG_INCOMING_CALL missing callRef — ignored",
    });
    return;
  }

  // 2. Attach to the existing context (Redis buffer, in-memory in sandbox), then load the
  //    call-queue row FRESH by callRef (rule 21) so the SYNCHRONOUS incoming-call
  //    onResponse can read its callRef/status/meetingId when sendResponse fires below.
  //    Mirrors the job-receiver precedent (auto-close.js / auto-escalate.js).
  await Context.Create(state.currentTabId, { state });
  try {
    await callQueueDoc.loadDocument({ callRef });
  } catch (error) {
    D.log({
      message: "X3 receiver: callQueueDoc load failed",
      data: { callRef, error: String(error) },
    });
    return;
  }

  // 3. Render the admin shell — the incoming-call section's onResponse reads the now-
  //    hydrated callQueueDoc and emits the ring banner (only when status === RINGING).
  adminDisplayDoc.sendResponse();

  D.log({
    message: "X3 receiver: incoming-call banner surfaced",
    data: { callRef },
  });
};

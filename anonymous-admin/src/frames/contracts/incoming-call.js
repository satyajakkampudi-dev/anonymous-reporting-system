// X3 RECEIVER — MSG_INCOMING_CALL (anonymous-user -> anonymous-admin).
//
// The RECEIVING half of the MSG_INCOMING_CALL contract. The SENDER is the user app
// (start-anonymous-call.js U-F15) which, AFTER save() of the RINGING call-queue row,
// rings all CURRENTLY-AVAILABLE admins via lib/calling.ringAvailableAdmins, which sends TWO
// channels: (1) the bot-to-bot MSG_INCOMING_CALL trigger (this receiver → web ring banner +
// RING_START), and (2) a VoIP/CallKit push per admin (reaches MOBILE — confirmed working).
// The VoIP push is fanned out reporter-side because THIS receiver runs server-side where
// state.client is always "web" and cannot platform-gate. The payload is identity-free
// { callRef, meetingId } (rule 16/30).
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
// This receiver surfaces the IN-APP banner AND fires the platform-appropriate ring (step
// 4): web → RING_START_ACTION (in-app ring, no toast); mobile → VoIP/CallKit self-push.
// The banner's Answer button (A-F21) carries the callRef + meetingId in its data-payload —
// the values travel via the hydrated Doc into the rendered button, never as visible text.
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
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { adminVideoCall } from "../answer-call";
import { showScreen, SCREEN } from "../display-nav";
import { ringVoipSelf, getMeetingLoftHost } from "../../../../lib/calling";
import { MSG, userTab, CALL_STATUS } from "../../../../lib/constants";
import { meetingIdField, callStatusField } from "../../sections/call-queue";
import { CONTEXT, VIDEO_CALL } from "../../constants";

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
  // Stable per-user On-call tab (rule 37): a `getUniqueId()` context opened a NEW empty
  // tab per ring, and with no showScreen every section defaulted to visible → stacked,
  // broken UI. Reuse the admin's On-call tab and route to the On-call screen so the ring
  // banner (an always-visible overlay) shows cleanly over the On-call card.
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });
  try {
    await callQueueDoc.loadDocument({ callRef });
  } catch (error) {
    D.log({
      message: "X3 receiver: callQueueDoc load failed",
      data: { callRef, error: String(error) },
    });
    return;
  }

  // 3. Render the On-call screen — the incoming-call section's onResponse reads the now-
  //    hydrated callQueueDoc and emits the ring banner (only when status === RINGING).
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();

  // 4. WEB ring (RING_START). MOBILE is rung by the reporter's VoIP/CallKit fan-out
  //    (lib/calling.ringAvailableAdmins) — not here. Banner (step 3) shows on both.
  const meetingId = callQueueDoc.f[meetingIdField.id]?.value || "";
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  // ONLY ring a call that is still RINGING. A late/duplicate MSG_INCOMING_CALL that lands
  // AFTER the call was claimed (ACTIVE) or ended must NOT re-start the ring — that was the
  // "ring keeps sounding after answer" bug (a second RING_START overrode the answer's
  // RING_STOP). Mirrors the banner's own status gate.
  if (status !== CALL_STATUS.RINGING) {
    D.log({
      message: "X3 receiver: not RINGING — skip ring",
      data: { callRef, status },
    });
    return;
  }
  // WEB ring: RING_START shows the in-app web ring UI. Action value is RING_START
  // ("ringStart") — there is no "RING_START_ACTION" key in VIDEO_CALL_ACTIONS. Harmless on
  // mobile (the mobile client ignores web ring actions).
  try {
    adminVideoCall.meetingId = meetingId; // RING_START carries the meeting context
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_START);
    D.log({
      message: "X3 receiver: web RING_START (ringStart)",
      data: { callRef },
    });
  } catch (error) {
    D.log({
      message: "X3 receiver: RING_START failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  // MOBILE ring: mint THIS admin's meeting token, then send a VoIP/CallKit push carrying
  // the token (videoSessionId) + Loft host (mediasoupHost) so lifting the native call joins
  // the Daily room directly (healthMariner incommingQueueEntryIntent pattern). Device-token
  // push → reaches mobile CallKit, does NOT toast web.
  try {
    await adminVideoCall.getAccessToken({ meetingId, useDaily: true });
    const loftHost = await getMeetingLoftHost();
    const voip = await ringVoipSelf({
      meetingId,
      meetingToken: adminVideoCall.meetingToken,
      loftHost,
      videoControlId: VIDEO_CALL.CONTROL_ID, // binds the mobile join to adminVideoCall
    });
    D.log({
      message: "X3 receiver: mobile VoIP push sent",
      data: { callRef, ok: voip?.ok, hasToken: !!adminVideoCall.meetingToken },
    });
  } catch (error) {
    D.log({
      message: "X3 receiver: mobile VoIP push failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  D.log({
    message: "X3 receiver: incoming-call banner surfaced",
    data: { callRef },
  });
};

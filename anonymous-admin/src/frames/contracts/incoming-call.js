// X3 RECEIVER — MSG_INCOMING_CALL (anonymous-user -> anonymous-admin).
//
// The RECEIVING half of the MSG_INCOMING_CALL contract. The SENDER is the user app
// (start-anonymous-call.js U-F15) which, AFTER save() of the RINGING call-queue row,
// rings all CURRENTLY-AVAILABLE admins via lib/calling.ringAvailableAdmins — that helper
// now sends ONLY the SILENT bot-to-bot MSG_INCOMING_CALL trigger (this receiver). The
// actual ring is delivered PER-PLATFORM here (step 4), because only this receiver — in
// the admin's own session — knows state.client. The reporter no longer fires a VoIP push
// (a blind fan-out landed on WEB sessions as a stray browser toast with no CallKit). The
// payload is identity-free { callRef, meetingId } (rule 16/30).
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
import { ringVoipSelf } from "../../../../lib/calling";
import { isWeb } from "../../../../lib/utils/platform";
import { MSG, userTab } from "../../../../lib/constants";
import { meetingIdField } from "../../sections/call-queue";
import { CONTEXT } from "../../constants";

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

  // 4. PER-PLATFORM ring (reference pattern; F2). The ring is delivered in THIS admin's
  //    own session, where state.client is known — the reporter could not platform-gate.
  //      web    → RING_START_ACTION: the framework's in-app web ring UI (NO browser/system
  //               toast; a VoIP push on web has no CallKit to consume it and surfaces as a
  //               stray toast — the bug being fixed).
  //      mobile → VoIP/CallKit self-push (ringVoipSelf) to wake the device.
  //    Banner (step 3) shows on both. Best-effort: a ring fault must not break delivery.
  const meetingId = callQueueDoc.f[meetingIdField.id]?.value || "";
  try {
    if (isWeb()) {
      adminVideoCall.meetingId = meetingId; // RING_START carries the meeting context
      // NOTE: the action value is RING_START ("ringStart"). VIDEO_CALL_ACTIONS has NO
      // "RING_START_ACTION" key (that is a static METHOD on VideoCall that returns
      // RING_START) — passing the nonexistent key sends `undefined` and the web client
      // never rings. This is the value SeaMedix uses via VideoCall.RING_START_ACTION().
      adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_START);
      D.log({
        message: "X3 receiver: web RING_START (ringStart)",
        data: { callRef },
      });
    } else {
      await ringVoipSelf({ meetingId });
      D.log({
        message: "X3 receiver: mobile VoIP self-push",
        data: { callRef },
      });
    }
  } catch (error) {
    D.log({
      message: "X3 receiver: per-platform ring failed (non-fatal)",
      data: { callRef, error: String(error) },
    });
  }

  D.log({
    message: "X3 receiver: incoming-call banner surfaced",
    data: { callRef },
  });
};

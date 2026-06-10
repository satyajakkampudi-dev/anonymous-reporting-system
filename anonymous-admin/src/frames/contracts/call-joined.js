// RECEIVER - "joinMeeting" lifecycle on the ADMIN bot (join-driven claim).
//
// When THIS admin joins the Daily meeting, the Loft backend fires the framework-convention
// "joinMeeting" intent on the admin's bot. On WEB the Answer button (A-F21) has already
// claimed (attendedBy set) → this is a guarded no-op. On MOBILE, lifting the native CallKit
// call does NOT run A-F21 - so this is where the call gets claimed: RINGING -> ACTIVE, stamp
// the answering admin, go busy, stop the ring (own web ring + other admins). Mirrors
// healthMariner joinMeetingIntent (attendCall + setAvailabilityStatus(busy) on join).
//
// Uses state.user.userId as attendedBy (the joiner IS this admin) - no joiner-detection.
// INDEPENDENT INTENT (Context B). Triggered by the backend dispatching intentId "joinMeeting".

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { ALL_CONSTANTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { adminDisplayDoc } from "../../docs/admin-display-doc";
import { adminVideoCall } from "../answer-call";
import {
  callStatusField,
  attendedByField,
  answeredOnField,
} from "../../sections/call-queue";
import { setOwnAvailability } from "../availability-writer";
import {
  resolveAvailableAdmins,
  sendCallStopRing,
} from "../../../../lib/calling";
import { showScreen, SCREEN } from "../display-nav";
import { CALL_STATUS, AVAILABILITY, userTab } from "../../../../lib/constants";
import { CONTEXT } from "../../constants";

export const callJoinedReceiver = Intent.Create({
  intentId: "joinMeeting",
  prompt: "I joined the anonymous call - claim it (mobile path)",
  state,
});

callJoinedReceiver.onResolution = async () => {
  const meetingId =
    state.messageFromUser?.meetingId ||
    state.messageFromUser?.data?.meetingId ||
    "";
  D.log({
    message: "A-JOIN: joinMeeting on admin bot",
    data: { meetingId, me: state.user?.userId },
  });
  if (!meetingId) return;

  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state });
  try {
    await callQueueDoc.loadDocument({ meetingId });
  } catch (error) {
    D.log({
      message: "A-JOIN: load-by-meetingId failed",
      data: { meetingId, error: String(error) },
    });
    return;
  }

  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  const attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";
  // Already claimed (web A-F21, or a prior fire) → guarded no-op.
  if (status !== CALL_STATUS.RINGING || attendedBy) {
    D.log({
      message: "A-JOIN: no-op (already claimed / not RINGING)",
      data: { meetingId, status, claimed: !!attendedBy },
    });
    return;
  }

  // Claim: RINGING -> ACTIVE, stamp THIS admin.
  const now = Date.now();
  callQueueDoc.f[callStatusField.id].value = CALL_STATUS.ACTIVE;
  callQueueDoc.f[attendedByField.id].value = state.user.userId;
  callQueueDoc.f[answeredOnField.id].value = now;
  try {
    await callQueueDoc.save();
  } catch (error) {
    D.log({
      message: "A-JOIN: claim save failed (non-fatal)",
      data: { meetingId, error: String(error) },
    });
  }

  // Busy + stop the ring (own web ring + other available admins) + re-render.
  await setOwnAvailability(AVAILABILITY.BUSY, { attach: false });
  try {
    adminVideoCall.sendResponse(ALL_CONSTANTS.VIDEO_CALL_ACTIONS.RING_STOP);
  } catch (error) {
    D.log({
      message: "A-JOIN: RING_STOP failed (non-fatal)",
      data: { meetingId },
    });
  }
  try {
    const others = (await resolveAvailableAdmins())
      .filter((a) => a.adminUserId !== state.user.userId)
      .map((a) => a.adminUserId);
    if (others.length) await sendCallStopRing({ meetingId, userIds: others });
  } catch (error) {
    D.log({
      message: "A-JOIN: stop-ring others failed (non-fatal)",
      data: { meetingId },
    });
  }
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  D.log({
    message: "A-JOIN: claimed on join (-> ACTIVE, busy)",
    data: { meetingId, attendedBy: state.user.userId },
  });
};

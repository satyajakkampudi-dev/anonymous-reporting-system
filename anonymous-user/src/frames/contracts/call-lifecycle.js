// Meeting-lifecycle receivers on the USER (reporter) app - the meeting OWNER.
//
// The reporter app CREATES the Daily meeting (U-F15), so the Loft/Daily BACKEND fires its
// framework-convention lifecycle intents on THIS (owner) bot:
//   joinMeeting - a participant joined   → when the ADMIN joins, the call is CONNECTED
//   leaveUser   - a participant left     → the call is over
//   endMeeting  - the whole meeting ended
// This mirrors healthMariner (joinMeeting / leaveUser / endMeeting + medicalMeetingEnded).
//
// Two jobs:
//  1) Free the answering admin on end: end the call ACTIVE->ENDED and send MSG_CALL_ENDED
//     to the attendedBy admin (their bot's call-ended receiver flips them to Available).
//  2) Drive the reporter's Home Call-CTA lifecycle label by re-rendering Home in place on
//     the MAIN_APP tab: CONNECTING (U-F15) → CONNECTED (admin joined) → IDLE (ended/left).
//
// Identity-free (ER-A5): payloads carry { meetingId, attendedBy } only. attendedBy is the
// admin's own userId (admin-written). Re-renders use userTab(MAIN_APP) → in place, no new tab.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { callQueueDoc } from "../../docs/call-queue-doc";
import { reportDisplayDoc } from "../../docs/report-display-doc";
import {
  callRefField,
  callStatusField,
  attendedByField,
  answeredOnField,
  endedOnField,
  durationMsField,
} from "../../sections/call-queue";
import {
  sendBotMessage,
  resolvePeerBotId,
} from "../../../../lib/notifications";
import { resolveAdminByEmail } from "../../../../lib/calling";
import {
  CALL_STATUS,
  MSG,
  STATIC_DATA_KEYS,
  userTab,
} from "../../../../lib/constants";
import { showScreen, SCREEN } from "../display-nav";
import { CONTEXT, STATE_KEYS, CALL_UI } from "../../constants";

// Set the reporter Call-CTA lifecycle state + re-render Home IN PLACE (MAIN_APP tab).
// Caller must already be on the MAIN_APP context.
const renderHomeCallUi = (uiState) => {
  state.setField(STATE_KEYS.CALL_UI_STATE, uiState);
  try {
    showScreen(SCREEN.HOME);
    reportDisplayDoc.sendResponse();
  } catch (error) {
    D.log({
      message: "U-CALL-LIFECYCLE: Home re-render failed (non-fatal)",
      data: { uiState, error: String(error) },
    });
  }
};

// --- joinMeeting: a participant joined. When the ADMIN (attendedBy) is set, the call is
//     CONNECTED → flip the Home CTA to "Connected". The reporter's own join (attendedBy
//     not yet set) stays CONNECTING. ---
export const meetingJoinedReceiver = Intent.Create({
  intentId: "joinMeeting",
  prompt: "A participant joined the anonymous call",
  state,
});
meetingJoinedReceiver.onResolution = async () => {
  const meetingId =
    state.messageFromUser?.meetingId ||
    state.messageFromUser?.data?.meetingId ||
    "";
  D.log({ message: "U-CALL-LIFECYCLE: joinMeeting", data: { meetingId } });
  if (!meetingId) return;
  await Context.CreateAndInit(userTab(CONTEXT.MAIN_APP, state), { state });
  try {
    await callQueueDoc.loadDocument({ meetingId });
  } catch (error) {
    D.log({
      message: "U-CALL-LIFECYCLE: joinMeeting load failed",
      data: { meetingId, error: String(error) },
    });
    return;
  }
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  let attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";
  const callRef = callQueueDoc.f[callRefField.id]?.value || "";

  // Who joined. The "joinMeeting" lifecycle event populates the joiner's EMAIL
  // (state.messageFromUser.userEmail) - NOT a reliable userId. healthMariner's
  // joinMeetingIntent keys off the same userEmail field. We log userId too, but it is
  // typically empty on lifecycle dispatch (the old `if (joinerId && …)` guard never fired,
  // which is why the MOBILE claim silently never happened).
  const joinerId = state.messageFromUser?.userId || ""; // logged only - usually empty here
  const joinerEmail =
    state.messageFromUser?.userEmail ||
    state.messageFromUser?.data?.userEmail ||
    "";
  const reporterEmail = state.user?.userEmail || "";
  D.log({
    message: "U-CALL-LIFECYCLE: joinMeeting joiner",
    data: { meetingId, joinerId, joinerEmail, reporterEmail, attendedBy },
  });

  // JOIN-DRIVEN CLAIM (healthMariner joinMeetingIntent). On WEB the Answer button (A-F21)
  // already claimed (attendedBy set) → guarded no-op. On MOBILE, lifting CallKit does NOT
  // run A-F21, so the claim happens HERE when an ADMIN joins. Identify the admin by EMAIL
  // (the field the lifecycle event actually carries; ≠ the reporter's own email) and map it
  // to the admin's userId via the seeded registry - our queue/notify path is userId-keyed.
  const joinerIsAdmin = joinerEmail && joinerEmail !== reporterEmail;
  if (joinerIsAdmin && !attendedBy) {
    const admin = await resolveAdminByEmail(joinerEmail);
    const adminUserId = admin?.adminUserId || "";
    if (!adminUserId) {
      D.log({
        message: "U-CALL-LIFECYCLE: joiner email not a known admin - no claim",
        data: { meetingId, joinerEmail },
      });
    } else {
      const now = Date.now();
      callQueueDoc.f[callStatusField.id].value = CALL_STATUS.ACTIVE;
      callQueueDoc.f[attendedByField.id].value = adminUserId;
      callQueueDoc.f[answeredOnField.id].value = now;
      try {
        await callQueueDoc.save();
        attendedBy = adminUserId;
        D.log({
          message: "U-CALL-LIFECYCLE: join-driven claim (-> ACTIVE)",
          data: { meetingId, callRef, attendedBy, joinerEmail },
        });
      } catch (error) {
        D.log({
          message: "U-CALL-LIFECYCLE: claim save failed (non-fatal)",
          data: { meetingId, callRef, error: String(error) },
        });
      }
      try {
        const adminBotId = await resolvePeerBotId(
          STATIC_DATA_KEYS.ADMIN_BOT_ID
        );
        await sendBotMessage({
          type: MSG.CALL_CLAIMED,
          payload: { meetingId, attendedBy: adminUserId, callRef },
          userIds: [adminUserId],
          botId: adminBotId,
          userDomain: state.currentUserDomain,
        });
      } catch (error) {
        D.log({
          message:
            "U-CALL-LIFECYCLE: notify-admin (claimed) failed (non-fatal)",
          data: { meetingId, error: String(error) },
        });
      }
    }
  }

  // Connected = the call is claimed/ACTIVE (admin on the call). Flip the Home CTA.
  if (
    attendedBy &&
    callQueueDoc.f[callStatusField.id]?.value === CALL_STATUS.ACTIVE
  ) {
    renderHomeCallUi(CALL_UI.CONNECTED);
    D.log({
      message: "U-CALL-LIFECYCLE: CONNECTED (admin joined)",
      data: { meetingId },
    });
  }
};

// --- endMeeting / leaveUser: call over → end it, free the admin, reset the Home CTA. ---
const handleMeetingLifecycleEnd = async (source) => {
  const meetingId =
    state.messageFromUser?.meetingId ||
    state.messageFromUser?.data?.meetingId ||
    "";
  D.log({
    message: "U-CALL-LIFECYCLE: meeting end signal",
    data: { source, meetingId },
  });
  // Reset the reporter's Home CTA regardless (the call is over for them).
  await Context.CreateAndInit(userTab(CONTEXT.MAIN_APP, state), { state });
  if (!meetingId) {
    renderHomeCallUi(CALL_UI.IDLE);
    return;
  }
  try {
    await callQueueDoc.loadDocument({ meetingId });
  } catch (error) {
    D.log({
      message: "U-CALL-LIFECYCLE: load-by-meetingId failed",
      data: { source, meetingId, error: String(error) },
    });
    renderHomeCallUi(CALL_UI.IDLE);
    return;
  }

  const callRef = callQueueDoc.f[callRefField.id]?.value || "";
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  const attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";

  // End the call if still ACTIVE (records durationMs). Guarded/idempotent.
  if (status === CALL_STATUS.ACTIVE) {
    const now = Date.now();
    const answeredOn = Number(callQueueDoc.f[answeredOnField.id]?.value || 0);
    callQueueDoc.f[callStatusField.id].value = CALL_STATUS.ENDED;
    callQueueDoc.f[endedOnField.id].value = now;
    callQueueDoc.f[durationMsField.id].value =
      answeredOn > 0 ? Math.max(0, now - answeredOn) : 0;
    try {
      await callQueueDoc.save();
      D.log({
        message: "U-CALL-LIFECYCLE: call ACTIVE -> ENDED",
        data: { source, callRef },
      });
    } catch (error) {
      D.log({
        message: "U-CALL-LIFECYCLE: end save failed (non-fatal)",
        data: { source, callRef, error: String(error) },
      });
    }
  }

  // Notify the answering admin to free their presence (busy -> available).
  if (attendedBy) {
    try {
      const adminBotId = await resolvePeerBotId(STATIC_DATA_KEYS.ADMIN_BOT_ID);
      await sendBotMessage({
        type: MSG.CALL_ENDED,
        payload: { meetingId, attendedBy },
        userIds: [attendedBy],
        botId: adminBotId,
        userDomain: state.currentUserDomain,
      });
      D.log({
        message: "U-CALL-LIFECYCLE: MSG_CALL_ENDED sent to admin",
        data: { source, callRef, attendedBy },
      });
    } catch (error) {
      D.log({
        message: "U-CALL-LIFECYCLE: notify-admin failed (non-fatal)",
        data: { source, callRef, error: String(error) },
      });
    }
  }

  // Reset the reporter's Home CTA → "Call compliance".
  renderHomeCallUi(CALL_UI.IDLE);
};

export const meetingEndedReceiver = Intent.Create({
  intentId: "endMeeting",
  prompt: "The anonymous call meeting ended",
  state,
});
meetingEndedReceiver.onResolution = async () => {
  await handleMeetingLifecycleEnd("endMeeting");
};

export const userLeftReceiver = Intent.Create({
  intentId: "leaveUser",
  prompt: "A participant left the anonymous call",
  state,
});
userLeftReceiver.onResolution = async () => {
  await handleMeetingLifecycleEnd("leaveUser");
};

// Anonymous voice-calling helpers (FrontM VideoCall / Daily.co + VoIP).
// See ../REQUIREMENTS.md §7.8, §8 (FR-C*), §3 and ../specs/SPEC.md
// "Anonymous calling data model", plus docs/frontm-ai-video-call-voip-api-reference.md
// and docs/frontm-ai-notification-class-api-reference.md.
//
// ANONYMITY (NON-NEGOTIABLE, §3 / ER-A5): the reporter joins as a throwaway
// masked guest ("Anonymous Reporter"), the meeting host is a masked/system
// account (NEVER state.user.userEmail), recording stays OFF, and every ring /
// VoIP / bot-to-bot payload carries ONLY { callRef, meetingId } — no caller
// name/id/email.
//
// IMPORTANT — VideoCall is an Intent subclass that MUST be instantiated and
// EXPORTED in the app bundle (docs: "the VideoCall instance must be exported to
// be accessible by the framework"). It therefore CANNOT live in pure /lib. So
// the meeting-creating helpers here take the app's exported `videoCall` instance
// as a parameter; the actual `new VideoCall(...)` + `videoCall.sendResponse(
// JOIN_MEETING)` wiring lives in the user-app frame (U-F15). Everything else
// (refs, masking, payloads, ring fan-out) is pure and lives here.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { CALLING, MSG, AVAILABILITY, SCOPE } from "./constants";
import { generateCallRef } from "./id-generator";
import { sendBotMessage } from "./notifications";
import { adminUsersCollection } from "./collections/admin-users";

// Re-export so callers have one calling entry point.
export { generateCallRef };

// Masked/system host for the meeting. Sourced from deployment static data — a
// dedicated bot/system account (D8), NEVER the reporter's email.
// TODO(deploy/U-F15): confirm the static-data key for the system call host once
// names/systemId are decided (D5). Falls back to a non-routable address.
export const maskedHostEmail = async () => {
  try {
    const host = await state.getStaticData("anonCallHostEmail");
    if (host) return host;
  } catch (error) {
    D.log({ message: "maskedHostEmail static-data read failed", data: { error: String(error) } });
  }
  return `host@${CALLING.GUEST_EMAIL_DOMAIN}`;
};

// Per-call throwaway masked guest email — derived from the opaque callRef only,
// on a non-routable domain. Carries no reporter identity.
export const maskedGuestEmail = (callRef) =>
  `${String(callRef || "anon").toLowerCase()}@${CALLING.GUEST_EMAIL_DOMAIN}`;

// Daily.co meeting options enforcing voice-only + no recording (ER-A5).
//   enableRecording: false — documented Daily.co option (video-call ref).
//   startVideoOff: true     — Daily.co standard "join with camera off"; confirm
//                             on the live runtime in U-F15 (🟡, video-call ref
//                             documents meetingOptions generically).
export const voiceOnlyMeetingOptions = () => ({
  enableRecording: false,
  startVideoOff: true,
});

// Build the createMeeting() args for an anonymous voice call — masked host,
// guests allowed, instant join, no recording. NEVER includes the reporter email.
export const buildAnonymousMeetingArgs = async (callRef) => ({
  meetingName: `${CALLING.RING_MESSAGE}`,
  meetingDescription: "",
  instantJoin: true,
  allowGuests: true,
  hostUserEmail: await maskedHostEmail(),
  meetingOptions: voiceOnlyMeetingOptions(),
});

// Identity-free ring/stop payload — the ONLY shape sent over bot-to-bot/VoIP.
export const buildRingPayload = ({ callRef, meetingId }) => ({ callRef, meetingId });

// Reporter side (called from U-F15 with the app's exported VideoCall instance):
// create a voice-only masked meeting and mint the masked guest access token.
// Returns { callRef, meetingId, guestToken, meetingUrl }. Does NOT persist the
// call-queue row or ring — the frame owns those steps (it has the live Docs).
export const initiateAnonymousCall = async ({ videoCall }) => {
  if (!videoCall) {
    throw new Error("initiateAnonymousCall requires the app's exported VideoCall instance");
  }
  const callRef = generateCallRef();
  const meeting = await videoCall.createMeeting(await buildAnonymousMeetingArgs(callRef));
  const meetingId = meeting && meeting.meetingId;
  const tokenData = await videoCall.getAccessToken({
    meetingId,
    guestEmail: maskedGuestEmail(callRef),
  });
  return {
    callRef,
    meetingId,
    guestToken: tokenData && tokenData.token,
    meetingUrl: (meeting && meeting.meetingUrl) || (tokenData && tokenData.meetingUrl),
  };
};

// Ring a set of available admins via bot-to-bot MSG_INCOMING_CALL + VoIP push.
// `admins` is the resolved available-admin list ({ adminUserId, adminEmail });
// `toBotId` is the admin bot. Payloads are identity-free. Best-effort + logged.
export const ringAvailableAdmins = async ({ callRef, meetingId, admins = [], toBotId, userDomain }) => {
  const payload = buildRingPayload({ callRef, meetingId });
  const userIds = admins.map((a) => a.adminUserId).filter(Boolean);
  if (!userIds.length) {
    D.log({ message: "ringAvailableAdmins — no available admins to ring", data: { callRef } });
    return { rung: [] };
  }
  // In-app ring card via bot-to-bot.
  await sendBotMessage({ type: MSG.INCOMING_CALL, payload, userIds, botId: toBotId, userDomain });
  // VoIP push per admin (generic message — no caller identity, ER-A5).
  for (const userId of userIds) {
    try {
      await state.notification.sendVoipPushNotificationToUser(
        state.user?.userId, // caller id (the app/user context) — not surfaced to admin
        userId,
        CALLING.RING_MESSAGE,
        meetingId,
        false, // not a video call (voice-only)
        true, // allow non-contact call (anonymous)
        userDomain,
        meetingId,
        "anonymous-call",
        CALLING.RING_MESSAGE
      );
    } catch (error) {
      D.log({ message: "VoIP ring push failed", data: { userId, callRef, error: String(error) } });
    }
  }
  return { rung: userIds };
};

// Resolve the set of CURRENTLY-AVAILABLE admins — the SAME set the ring fan-out
// (X3 ringAvailableAdmins) targets. This is the single source for "who is on call
// right now": all GLOBAL-scope admins whose availability === AVAILABLE. Returns
// identity-free-of-reporter admin descriptors { adminUserId, adminEmail }. The
// answer-claim (A-F21) uses this to STOP_RING the OTHER available admins after a win
// (excluding self). Reporter-identity-free by construction — admin-users NEVER stores
// a reporter id/email/name (anonymity, ER-A5). Best-effort + logged; an empty list is
// a valid result (no one available → nothing to ring/stop).
export const resolveAvailableAdmins = async () => {
  try {
    await adminUsersCollection.loadCollectionWithQuery({
      query: { availability: AVAILABILITY.AVAILABLE, scope: SCOPE.GLOBAL },
    });
  } catch (error) {
    D.log({
      message: "resolveAvailableAdmins — admin-users query failed",
      data: { error: String(error) },
    });
    return [];
  }
  const rows = adminUsersCollection.rows || [];
  return rows
    .map((r) => {
      // Defensive across framework row shapes (mirror lib/access.extractRowData).
      const data =
        typeof r.getData === "function"
          ? r.getData()
          : r && r.data && typeof r.data === "object"
          ? r.data
          : r;
      return {
        adminUserId: data && data.adminUserId,
        adminEmail: data && data.adminEmail,
      };
    })
    .filter((a) => a.adminUserId);
};

// Admin side: tell the OTHER admins to stop ringing (the call was claimed).
// Identity-free MSG_CALL_STOP_RING fan-out within the admin app.
export const sendCallStopRing = async ({ callRef, meetingId, userIds = [], toBotId, userDomain }) => {
  if (!userIds.length) return { ok: true };
  return sendBotMessage({
    type: MSG.CALL_STOP_RING,
    payload: buildRingPayload({ callRef, meetingId }),
    userIds,
    botId: toBotId,
    userDomain,
  });
};

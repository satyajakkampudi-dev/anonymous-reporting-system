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
import {
  CALLING,
  MSG,
  AVAILABILITY,
  SCOPE,
  STATIC_DATA_KEYS,
} from "./constants";
import { generateCallRef } from "./id-generator";
import { sendBotMessage } from "./notifications";
import { extractRowData } from "./access";
import { adminUsersCollection } from "./collections/admin-users";

// Re-export so callers have one calling entry point.
export { generateCallRef };

// Masked/system host for the meeting. Sourced from deployment static data — a
// dedicated bot/system account (D8), NEVER the reporter's email.
// TODO(deploy/U-F15): confirm the static-data key for the system call host once
// names/systemId are decided (D5). Falls back to a non-routable address.
export const maskedHostEmail = async () => {
  try {
    const host = await state.getStaticData(
      STATIC_DATA_KEYS.ANON_CALL_HOST_EMAIL
    );
    if (host) return host;
  } catch (error) {
    D.log({
      message: "maskedHostEmail static-data read failed",
      data: { error: String(error) },
    });
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
// useDaily: true mirrors the working seamedix/healthMariner createMeetingRoom pattern
// (frontm apps/healthMarinerCommonLib/lib/queueRouting.js) — the Daily backend.
// `participantEmails` are the AVAILABLE ADMINS' emails (NOT the reporter — they stay a
// masked guest). SeaMedix passes the doctors' emails as `participants`; this is what makes
// the Loft/Daily backend TRACK those participants and fire the endMeeting/leaveUser
// lifecycle intents (which free the admin's presence on hang-up). Without it the admin
// stays BUSY until the 2h backstop. Admin identity is not protected (only the reporter is),
// so listing admin emails here does not breach anonymity.
export const buildAnonymousMeetingArgs = async (
  callRef,
  participantEmails = []
) => ({
  meetingName: `${CALLING.RING_MESSAGE}`,
  meetingDescription: "",
  instantJoin: true,
  useDaily: true,
  allowGuests: true,
  participants: participantEmails,
  hostUserEmail: await maskedHostEmail(),
  meetingOptions: voiceOnlyMeetingOptions(),
});

// The FrontM "Loft" meeting-player HOST to set as videoCall.serverUrl before JOIN_MEETING.
// The web client opens the call at https://<lofthost>/<roomId>; serverUrl MUST be the bare
// host (no protocol, no path). Prefer the deployment static data (SeaMedix's "telemedUrl"
// key); fall back to the known onship-dev host (CALLING.LOFT_HOST). Best-effort + logged.
export const getMeetingLoftHost = async () => {
  try {
    const host = await state.getStaticData(STATIC_DATA_KEYS.MEETING_LOFT_HOST);
    if (host) return host;
  } catch (error) {
    D.log({
      message: "getMeetingLoftHost — static-data read failed; using fallback",
      data: { error: String(error) },
    });
  }
  return CALLING.LOFT_HOST;
};

// Identity-free ring/stop payload — the ONLY shape sent over bot-to-bot/VoIP.
export const buildRingPayload = ({ callRef, meetingId }) => ({
  callRef,
  meetingId,
});

// Reporter side (called from U-F15 with the app's exported VideoCall instance):
// create a voice-only masked meeting and mint the masked guest access token.
// Returns { callRef, meetingId, guestToken, meetingUrl }. Does NOT persist the
// call-queue row or ring — the frame owns those steps (it has the live Docs).
export const initiateAnonymousCall = async ({
  videoCall,
  participantEmails = [],
}) => {
  if (!videoCall) {
    throw new Error(
      "initiateAnonymousCall requires the app's exported VideoCall instance"
    );
  }
  const callRef = generateCallRef();
  // Pre-set the meetingId on the instance BEFORE createMeeting — the working
  // seamedix/healthMariner pattern (queueRouting.js: videoCall.meetingId =
  // state.getUniqueId() then createMeeting). This guarantees a meetingId for
  // getAccessToken even if createMeeting's return shape varies, rather than relying
  // on meeting.meetingId.
  videoCall.meetingId = state.getUniqueId();
  D.log({
    message: "calling: → createMeeting",
    data: { callRef, presetMeetingId: videoCall.meetingId, useDaily: true },
  });
  const meeting = await videoCall.createMeeting(
    await buildAnonymousMeetingArgs(callRef, participantEmails)
  );
  const meetingId = videoCall.meetingId || (meeting && meeting.meetingId);
  // returnedType/hasMeeting expose whether the video-call capability actually
  // returned a meeting (undefined ⇒ capability not enabled / non-200 — the likely
  // cause of a silent "nothing happens" on the reporter side).
  D.log({
    message: "calling: ← createMeeting",
    data: {
      callRef,
      meetingId,
      meetingUrl: meeting && meeting.meetingUrl,
      returnedType: typeof meeting,
      hasMeeting: !!meeting,
    },
  });
  D.log({ message: "calling: → getAccessToken", data: { callRef, meetingId } });
  // useDaily MUST match createMeeting (useDaily: true). The framework defaults
  // getAccessToken's useDaily to FALSE — minting a non-Daily token for a Daily
  // meeting yields a token that never validates → the client hangs at "connecting"
  // then drops. The reference (healthMariner queueRouting.js) passes useDaily:true
  // on BOTH the caller and answerer getAccessToken calls.
  //
  // ⚠️⚠️ TEST-ONLY / TEMPORARY — BREAKS ANONYMITY (ER-A5) ⚠️⚠️
  // getAccessToken validates the participant is a REAL FrontM user; the masked
  // guest email (maskedGuestEmail(callRef)) does NOT exist → errorCode 58 "participant
  // does not exist" → no token → reporter never joins. To confirm the media actually
  // connects end-to-end we temporarily mint the token under the reporter's REAL email.
  // This EXPOSES the reporter identity and MUST be reverted to maskedGuestEmail(callRef)
  // once Mukunda confirms the anonymous/guest-token path (or a dedicated anon
  // service-account email is provisioned). See memory: calling-token-anon-constraint.
  const TEST_ONLY_useRealEmailForToken = true; // TODO(anon): revert to masked guest
  const tokenGuestEmail = TEST_ONLY_useRealEmailForToken
    ? state.user?.userEmail
    : maskedGuestEmail(callRef);
  if (TEST_ONLY_useRealEmailForToken) {
    D.warning({
      message:
        "calling: ⚠️ TEST-ONLY token under reporter REAL email (anonymity OFF) — revert before prod",
      data: { callRef },
    });
  }
  await videoCall.getAccessToken({
    meetingId,
    guestEmail: tokenGuestEmail,
    useDaily: true,
  });
  // getAccessToken returns undefined and sets the token/domain on the INSTANCE
  // (videoCall.meetingToken / .domain) — see SDK VideoCall.js. The real success
  // signal is meetingToken being set (and no errorCode 58 warning above), NOT a
  // return value. tokenMinted:false here ⇒ the token genuinely failed.
  const tokenMinted = !!videoCall.meetingToken;
  D.log({
    message: "calling: ← getAccessToken",
    data: {
      callRef,
      meetingId,
      tokenMinted,
      domain: videoCall.domain,
      dailyMeetingName: videoCall.dailyMeetingName,
    },
  });
  D.log({
    message: "calling: initiateAnonymousCall returning",
    data: { callRef, meetingId, tokenMinted },
  });
  return {
    callRef,
    meetingId,
    tokenMinted,
    guestToken: videoCall.meetingToken,
    meetingUrl: videoCall.domain || (meeting && meeting.meetingUrl),
  };
};

// Ring a set of available admins via the SILENT bot-to-bot MSG_INCOMING_CALL trigger.
// `admins` is the resolved available-admin list ({ adminUserId, adminEmail });
// `toBotId` is the admin bot. Payloads are identity-free. Best-effort + logged.
//
// The ring is delivered PER-PLATFORM in each admin's OWN session by the X3 receiver
// (anonymous-admin/src/frames/contracts/incoming-call.js), mirroring the reference
// (healthMariner incommingQueueEntryIntent): web → RING_START_ACTION in-app ring;
// mobile → VoIP/CallKit via ringVoipSelf. We deliberately do NOT fire the VoIP push
// from HERE (the reporter side) any more: the sender can't know each admin's client,
// so a VoIP push blindly fanned out lands on WEB sessions as a stray browser/system
// toast (no CallKit to consume it). Gating in the receiver — which knows its own
// state.client — is the only correct place. (F2: web ring via RING_START_ACTION.)
export const ringAvailableAdmins = async ({
  callRef,
  meetingId,
  admins = [],
  toBotId,
  userDomain,
}) => {
  const payload = buildRingPayload({ callRef, meetingId });
  const userIds = admins.map((a) => a.adminUserId).filter(Boolean);
  if (!userIds.length) {
    D.log({
      message: "ringAvailableAdmins — no available admins to ring",
      data: { callRef },
    });
    return { rung: [] };
  }
  // Silent trigger only — fires each admin's X3 receiver, which rings per-platform.
  await sendBotMessage({
    type: MSG.INCOMING_CALL,
    payload,
    userIds,
    botId: toBotId,
    userDomain,
  });
  return { rung: userIds };
};

// MOBILE-only ring: VoIP/CallKit self-push, called by the X3 receiver in the rung
// admin's OWN session when state.client is mobile (NEVER web — that produces the
// stray toast). Identity-free: no caller name/id is surfaced. Best-effort + logged.
export const ringVoipSelf = async ({ meetingId }) => {
  try {
    await state.notification.sendVoipPushNotificationToUser(
      state.user?.userId, // caller (self context) — not surfaced (anonymous, ER-A5)
      state.user?.userId, // receiver = self (wake this admin's own mobile device)
      CALLING.RING_MESSAGE,
      meetingId,
      false, // voice-only
      true, // allow non-contact call (anonymous)
      state.currentUserDomain,
      meetingId,
      "anonymous-call",
      CALLING.RING_MESSAGE
    );
    return { ok: true };
  } catch (error) {
    D.log({
      message: "ringVoipSelf — VoIP self-push failed",
      data: { meetingId, error: String(error) },
    });
    return { ok: false };
  }
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
      // Read field values off the loaded row via the SHARED extractor (Doc has no
      // getData()/`.data` — the previous inline shape returned all-null, same bug as
      // the empty admin queue). extractRowData reads row.fields keyed by dbName.
      const data = extractRowData(r);
      return {
        adminUserId: data && data.adminUserId,
        adminEmail: data && data.adminEmail,
      };
    })
    .filter((a) => a.adminUserId);
};

// Admin side: tell the OTHER admins to stop ringing (the call was claimed).
// Identity-free MSG_CALL_STOP_RING fan-out within the admin app.
export const sendCallStopRing = async ({
  callRef,
  meetingId,
  userIds = [],
  toBotId,
  userDomain,
}) => {
  if (!userIds.length) return { ok: true };
  return sendBotMessage({
    type: MSG.CALL_STOP_RING,
    payload: buildRingPayload({ callRef, meetingId }),
    userIds,
    botId: toBotId,
    userDomain,
  });
};

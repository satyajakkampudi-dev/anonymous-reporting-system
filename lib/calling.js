// Anonymous voice-calling helpers (FrontM VideoCall / Daily.co + VoIP).
// Modelled on the existing call-centre apps (frontm apps/healthMarinerCommonLib
// queue routing + Vikand-Clinician-Portal). See ../REQUIREMENTS.md §7.8, §8 (FR-C*)
// and ../specs/SPEC.md "Anonymous calling data model".
//
// ANONYMITY: the reporter joins as a masked guest, the meeting host is a masked
// account, and ring/VoIP/bot-to-bot payloads carry NO caller identity (per §3).
// NOTE: skeleton placeholders — implemented during the calling (B3) build.

// Opaque, non-identifying call reference (PK of a call-queue entry).
export const generateCallRef = () => "";

// Masked identities for the meeting (never the reporter's real email/name).
export const maskedHostEmail = () => "";
export const maskedGuestEmail = () => "";

// Reporter side: create a voice-only meeting, join masked, create the RINGING
// call-queue entry, and ring every available admin (identity-free).
export const initiateAnonymousCall = async () => {};

// Ring all available admins via bot-to-bot MSG_INCOMING_CALL + VoIP push.
export const ringAvailableAdmins = async () => {};

// Admin side: first answerer marks ACTIVE and stops ringing the other admins.
export const sendCallStopRing = async () => {};

// No-answer path: store the voicemail to S3 and auto-create a report (source=CALL).
export const recordVoicemailAndCreateReport = async () => {};

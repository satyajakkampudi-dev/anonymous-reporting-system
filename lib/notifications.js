// Notification + cross-app messaging helpers (email, web push, bot-to-bot).
// See ../REQUIREMENTS.md §4, §11, NFR-4 and the notification API
// (docs/frontm-ai-notification-class-api-reference.md).
//
// BEST-EFFORT but LOGGED (NFR-4): a notification failure must never break the
// flow that triggered it (a report still saves even if its email bounces) and
// must never go silent — every failure is caught and D.log'd. The SLA digest
// (A-F18) + Alerts screen are the fallback so a missed email still surfaces.
//
// ANONYMITY (framework-mapping rule 16): bot-to-bot payloads and admin emails
// carry NO reporterId / contactMethod / contactValue / actorId. Callers build
// identity-free payloads; these helpers pass them through verbatim and never add
// identity. Send AFTER save() (rule 16).

import { D, state } from "@frontmltd/frontmjs/core/State";
import { ERROR_CODES, WEB_PUSH_APP_TYPE, STATIC_DATA_KEYS } from "./constants";

// ---------------------------------------------------------------------------
// Peer-bot id resolution (cross-app delivery target)
// ---------------------------------------------------------------------------

// Resolve a PEER bot id from deployment static data (same pattern as the
// conversations bucket / anonCallHostEmail). `key` is one of STATIC_DATA_KEYS.*
// (ADMIN_BOT_ID / USER_BOT_ID). Returns "" (best-effort + logged) when the value
// is unset — the deployment must configure it AND both apps must be deployed for
// cross-app delivery to occur (see STATIC_DATA_KEYS doc). An empty id makes the
// downstream sendBotMessage a logged no-op rather than a throw.
export const resolvePeerBotId = async (key) => {
  try {
    const botId = await state.getStaticData(key);
    if (botId) return botId;
    D.log({
      message:
        "resolvePeerBotId — peer bot id not configured (deployment dependency)",
      data: { key },
    });
  } catch (error) {
    D.log({
      message: "resolvePeerBotId — static-data read failed",
      data: { key, error: String(error) },
    });
  }
  return "";
};

// Run an async notification, swallow + log failures so callers never throw.
// Returns { ok } so a caller can branch (e.g. record a fallback) if needed.
const bestEffort = async (label, code, fn) => {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    D.log({
      message: `Notification best-effort failure: ${label}`,
      data: {
        code,
        error: error && error.message ? error.message : String(error),
      },
    });
    return { ok: false, error };
  }
};

// ---------------------------------------------------------------------------
// Email (AWS SES via state.notification.sendEmail(to, title, body, ...))
// ---------------------------------------------------------------------------

// Generic email. `to` is an email address; `html` is the (already-sanitised /
// escaped) HTML body. No-op (logged ok) when `to` is empty.
export const sendEmail = async ({
  to,
  subject,
  html,
  attachments,
  from,
  cc,
}) => {
  if (!to) {
    D.log({
      message: "sendEmail skipped — no recipient address",
      data: { subject },
    });
    return { ok: false };
  }
  return bestEffort("sendEmail", ERROR_CODES.NOTIFICATION_FAILED, () =>
    state.notification.sendEmail(to, subject, html, attachments, from, cc)
  );
};

// Reporter-facing email. Only sent when the reporter supplied a contact email;
// callers pass that address as `to` (we never look up the reporter's account).
export const sendReporterEmail = async ({ to, subject, html }) =>
  sendEmail({ to, subject, html });

// Admin-facing email (assigned report / escalation). `to` is the admin's
// seeded adminEmail (from resolveAssignees) — never a reporter address.
export const sendAdminEmail = async ({ to, subject, html, attachments }) =>
  sendEmail({ to, subject, html, attachments });

// ---------------------------------------------------------------------------
// Web push (AWS SNS via state.notification.sendWebPush(user, appType, options))
// ---------------------------------------------------------------------------

const sendWebPush = async (
  label,
  { userId, emailAddress, message, title, data }
) => {
  if (!userId) {
    D.log({ message: `${label} skipped — no userId`, data: { title } });
    return { ok: false };
  }
  return bestEffort(label, ERROR_CODES.NOTIFICATION_FAILED, () =>
    state.notification.sendWebPush(
      { userId, emailAddress },
      WEB_PUSH_APP_TYPE,
      { message, title, data }
    )
  );
};

// Reporter web push — addressed by their FrontM userId (= reporterId).
export const sendReporterWebPush = async ({ userId, message, title, data }) =>
  sendWebPush("sendReporterWebPush", { userId, message, title, data });

// Admin web push — addressed by the admin's userId.
export const sendAdminWebPush = async ({ userId, message, title, data }) =>
  sendWebPush("sendAdminWebPush", { userId, message, title, data });

// ---------------------------------------------------------------------------
// Bot-to-bot messaging
// (state.notification.sendMessageToUserInBot(type, message, userIds, botId, domain))
// ---------------------------------------------------------------------------

// Send an identity-free MSG_* event to users in another bot. `payload` is the
// (identity-free) message body; `userIds` the recipients; `botId` the receiver
// micro-app (defaults to current bot when omitted). The receiving side matches
// on state.messageTypeFromUser === type and reads state.messageFromUser.
export const sendBotMessage = async ({
  type,
  payload,
  userIds = [],
  botId,
  userDomain,
}) =>
  bestEffort("sendBotMessage", ERROR_CODES.BOT_MESSAGE_FAILED, () =>
    state.notification.sendMessageToUserInBot(
      type,
      payload,
      userIds,
      botId,
      userDomain
    )
  );

// Broadcast an identity-free MSG_* event to ALL users of a target bot. This is
// the IDENTITY-FREE delivery vehicle for the admin -> user contracts (X4/X5/X6):
// the admin app holds NO reporterId (framework-mapping rule 30 — adminProjection
// strips it), so it CANNOT address the reporter directly. Instead it broadcasts
// blind to the entire user bot; the user-side receiver loads the report by id and
// SILENTLY no-ops unless the loaded report's reporterId === state.user.userId
// (the ownership filter — the only context that legitimately holds reporterId is
// the owning reporter's own session). The admin therefore never learns who the
// reporter is. `payload` MUST be identity-free ({ reportId, ... }).
//
// Signature (docs/frontm-ai-inter-intent-bot-to-bot-messaging-guide.md
// §sendBroadcastNotificationToBot): (botId, userDomain, type, payload). botId /
// userDomain default to the current bot/domain when omitted; we always pass the
// resolved peer (user) bot id. No-op (logged ok) when botId is empty (deployment
// dependency — USER_BOT_ID unset). Best-effort: never throws into the transition.
export const broadcastBotMessage = async ({
  type,
  payload,
  botId,
  userDomain,
}) => {
  if (!botId) {
    D.log({
      message:
        "broadcastBotMessage skipped — no target bot id (deployment dependency)",
      data: { type },
    });
    return { ok: false };
  }
  return bestEffort("broadcastBotMessage", ERROR_CODES.BOT_MESSAGE_FAILED, () =>
    state.notification.sendBroadcastNotificationToBot(
      botId,
      userDomain,
      type,
      payload
    )
  );
};

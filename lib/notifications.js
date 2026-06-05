// Notification + cross-app messaging helpers (email, web push, bot-to-bot).
// See ../REQUIREMENTS.md §4, §11. Bot-to-bot payloads are always identity-free.
// NOTE: skeleton placeholders — implemented during the foundation (B1) build.

// Reporter-facing notifications (received / status change / resolved / closed).
export const sendReporterEmail = async () => {};
export const sendReporterWebPush = async () => {};

// Admin-facing notifications (new assigned report / escalation).
export const sendAdminEmail = async () => {};
export const sendAdminWebPush = async () => {};

// Bot-to-bot event to the other microapp's bot (MSG type + identity-free payload).
export const sendBotMessage = async () => {};

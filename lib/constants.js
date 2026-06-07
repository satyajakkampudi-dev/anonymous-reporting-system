// Shared constants — single source of truth for both microapps.
// See ../REQUIREMENTS.md §5/§11/§15 and ../specs/SPEC.md for the canonical values.
// Every key/enum/error-code/static-data-key is SCREAMING_SNAKE_CASE (framework-mapping rule 19);
// downstream code must never use a magic string/number.
//
// Two role vocabularies exist deliberately and must NOT be conflated:
//   ROLE        — the report's `assignedTo` / routing target / statusHistory actorRole
//                 (PRIMARY_ADMIN | SECONDARY_ADMIN).
//   ADMIN_ROLE  — the seeded `admin-users` registry `role` column (PRIMARY | SECONDARY).
// `roleToAdminRole` / `adminRoleToRole` bridge them in one place.

// ---------------------------------------------------------------------------
// Report content enums (reporter-selected). Values are stable storage tokens;
// *_LABELS carry the human-readable (British English) display text.
// ---------------------------------------------------------------------------

export const CATEGORY = {
  HARASSMENT_ABUSE: "harassment_abuse",
  SAFETY_VIOLATION: "safety_violation",
  FRAUD_ETHICS: "fraud_ethics",
  BULLYING_RETALIATION: "bullying_retaliation",
  OTHER: "other",
};

export const CATEGORY_LABELS = {
  [CATEGORY.HARASSMENT_ABUSE]: "Harassment / abuse",
  [CATEGORY.SAFETY_VIOLATION]: "Safety violation",
  [CATEGORY.FRAUD_ETHICS]: "Fraud / ethics breach",
  [CATEGORY.BULLYING_RETALIATION]: "Bullying / retaliation",
  [CATEGORY.OTHER]: "Other",
};

export const URGENCY = {
  IMMEDIATE: "immediate",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export const URGENCY_LABELS = {
  [URGENCY.IMMEDIATE]: "Immediate risk",
  [URGENCY.HIGH]: "High",
  [URGENCY.MEDIUM]: "Medium",
  [URGENCY.LOW]: "Low",
};

// Admin/system-assessed severity (SPEC.md: LOW | MEDIUM | HIGH | CRITICAL).
export const SEVERITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

export const SEVERITY_LABELS = {
  [SEVERITY.LOW]: "Low",
  [SEVERITY.MEDIUM]: "Medium",
  [SEVERITY.HIGH]: "High",
  [SEVERITY.CRITICAL]: "Critical",
};

// Reporter urgency → initial severity at submit (D6; admin may override in triage).
// Immediate risk → CRITICAL; all others map 1:1 by name.
export const SEVERITY_BY_URGENCY = {
  [URGENCY.IMMEDIATE]: SEVERITY.CRITICAL,
  [URGENCY.HIGH]: SEVERITY.HIGH,
  [URGENCY.MEDIUM]: SEVERITY.MEDIUM,
  [URGENCY.LOW]: SEVERITY.LOW,
};

export const severityFromUrgency = (urgency) =>
  SEVERITY_BY_URGENCY[urgency] || SEVERITY.MEDIUM;

export const LOCATION = {
  ONBOARD_VESSEL: "onboard_vessel",
  OFFICE_SHORE: "office_shore",
  REMOTE_DIGITAL: "remote_digital",
  OTHER: "other",
};

export const LOCATION_LABELS = {
  [LOCATION.ONBOARD_VESSEL]: "Onboard vessel",
  [LOCATION.OFFICE_SHORE]: "Office / shore base",
  [LOCATION.REMOTE_DIGITAL]: "Remote / digital",
  [LOCATION.OTHER]: "Other",
};

// The category / urgency / location DROPDOWNs render the LABELS as their options
// (Object.values(*_LABELS)), so the raw submitted field value is a label string
// ("Harassment / abuse"), not a token ("harassment_abuse"). MongoDB + every lib
// token-mapper (severityFromUrgency, …) AND every Display renderer
// (CATEGORY_LABELS[token] …) are token-based, so U-F8 onSubmit maps label → token
// before save. Mirror of contactMethodFromLabel: already-a-token / unknown / empty
// input passes through unchanged (?? label) so re-saving a token-valued draft is
// idempotent and legacy rows never trip a false conversion.
const CATEGORY_BY_LABEL = Object.fromEntries(
  Object.entries(CATEGORY_LABELS).map(([token, label]) => [label, token])
);
const URGENCY_BY_LABEL = Object.fromEntries(
  Object.entries(URGENCY_LABELS).map(([token, label]) => [label, token])
);
const LOCATION_BY_LABEL = Object.fromEntries(
  Object.entries(LOCATION_LABELS).map(([token, label]) => [label, token])
);

export const categoryFromLabel = (label) => CATEGORY_BY_LABEL[label] ?? label;
export const urgencyFromLabel = (label) => URGENCY_BY_LABEL[label] ?? label;
export const locationFromLabel = (label) => LOCATION_BY_LABEL[label] ?? label;

// Optional reporter contact channel. Reporter-private — excluded from adminProjection.
export const CONTACT_METHOD = {
  NONE: "none",
  EMAIL: "email",
  PHONE: "phone",
  CABIN: "cabin",
};

export const CONTACT_METHOD_LABELS = {
  [CONTACT_METHOD.NONE]: "None",
  [CONTACT_METHOD.EMAIL]: "Email",
  [CONTACT_METHOD.PHONE]: "Phone",
  [CONTACT_METHOD.CABIN]: "Cabin number",
};

// The contactMethod DROPDOWN renders the LABELS as its options, so the stored
// field value is a label string ("Email"), not a CONTACT_METHOD token ("email").
// Validators in lib/validation.js switch on tokens — bridge label → token here
// (single source of truth alongside CONTACT_METHOD_LABELS). Already-a-token or
// unknown/empty input is returned unchanged so callers degrade gracefully (empty
// method ⇒ "no contact required", never a false validation failure on legacy rows).
const CONTACT_METHOD_BY_LABEL = Object.fromEntries(
  Object.entries(CONTACT_METHOD_LABELS).map(([token, label]) => [label, token])
);

export const contactMethodFromLabel = (label) =>
  CONTACT_METHOD_BY_LABEL[label] ?? label;

// ---------------------------------------------------------------------------
// Roles, routing & report origin
// ---------------------------------------------------------------------------

// Report routing target / assignedTo value (D17).
export const ROLE = {
  PRIMARY_ADMIN: "PRIMARY_ADMIN",
  SECONDARY_ADMIN: "SECONDARY_ADMIN",
};

// Seeded admin-users registry `role` column (D3).
export const ADMIN_ROLE = {
  PRIMARY: "sailorscartadmin",
  SECONDARY: "secondaryadmin",
};

// FrontM platform role codes surfaced in state.user.roles (granted via license keys,
// provisioned by the devops team). These gate WHICH APP a user may OPEN and ALSO carry
// the PRIMARY/SECONDARY level — distinct from the report routing token (ROLE) and the
// admin-users registry `role` column (ADMIN_ROLE) above. The admin app opens for any
// admin code below; frontmAdminRole() maps it to ROLE. Mirrors the sailors-cart admin
// access gate (sailors-admin/src/frames/access-gate.js).
export const APP_ROLES = {
  END_USER: "enduser",
  // Production admin entitlements — provisioned by devops via license keys.
  PRIMARY_ADMIN: "quitelineprimaryadmin",
  SECONDARY_ADMIN: "quitelinesecondaryadmin",
  // ⚠️ TEMPORARY dev-test entitlement — REMOVE before production. satya@frontm.com
  // carries `sailorscartadmin` from the sailors-cart bot, reused here to test the
  // admin app before the real quiteline* roles are provisioned. Maps to PRIMARY.
  TEST_ADMIN: "sailorscartadmin",
};

// True when state.user.roles contains the given role code. Defensive against a
// missing/undefined roles array (cold start / no domain match). Mirrors
// sailors-cart lib/constants.js userHasRole.
export const userHasRole = (s, role) =>
  Array.isArray(s?.user?.roles) && s.user.roles.includes(role);

// Map the caller's FrontM roles to their admin ROLE (PRIMARY_ADMIN | SECONDARY_ADMIN),
// or null if they hold no admin entitlement. PRIMARY wins if both are present.
// ⚠️ The TEST_ADMIN branch is TEMPORARY (see APP_ROLES) — delete it before production.
export const frontmAdminRole = (s) => {
  if (userHasRole(s, APP_ROLES.PRIMARY_ADMIN)) return ROLE.PRIMARY_ADMIN;
  if (userHasRole(s, APP_ROLES.SECONDARY_ADMIN)) return ROLE.SECONDARY_ADMIN;
  if (userHasRole(s, APP_ROLES.TEST_ADMIN)) return ROLE.PRIMARY_ADMIN; // TEMP — remove before prod
  return null;
};

export const roleToAdminRole = (role) =>
  role === ROLE.SECONDARY_ADMIN ? ADMIN_ROLE.SECONDARY : ADMIN_ROLE.PRIMARY;

export const adminRoleToRole = (adminRole) =>
  adminRole === ADMIN_ROLE.SECONDARY
    ? ROLE.SECONDARY_ADMIN
    : ROLE.PRIMARY_ADMIN;

// Routing scope (D17). v1 default GLOBAL (single central compliance team);
// fleet/region scopes added later additively.
export const SCOPE = {
  GLOBAL: "GLOBAL",
};

// On-call availability (admin-users; SPEC.md uses lowercase values).
export const AVAILABILITY = {
  AVAILABLE: "available",
  BUSY: "busy",
  UNAVAILABLE: "unavailable",
};

// Report origin.
export const SOURCE = {
  REPORTER: "REPORTER",
  MANUAL: "MANUAL",
  CALL: "CALL",
};

// statusHistory actorRole vocabulary — role only, NEVER an id (anonymity).
export const ACTOR_ROLE = {
  REPORTER: "REPORTER",
  PRIMARY_ADMIN: "PRIMARY_ADMIN",
  SECONDARY_ADMIN: "SECONDARY_ADMIN",
  SYSTEM: "SYSTEM",
};

// Coarser actor used to gate transitions (lib/ticket-status.js STATUS_TRANSITIONS).
// ADMIN means "any admin role"; SECONDARY_ADMIN means specifically the secondary.
export const TRANSITION_ACTOR = {
  REPORTER: "REPORTER",
  ADMIN: "ADMIN",
  SECONDARY_ADMIN: "SECONDARY_ADMIN",
  SYSTEM: "SYSTEM",
};

// ---------------------------------------------------------------------------
// Cross-app (bot-to-bot) message types. Payloads are ALWAYS identity-free.
// ---------------------------------------------------------------------------

export const MSG = {
  NEW_REPORT: "MSG_NEW_REPORT",
  REPORT_REOPENED: "MSG_REPORT_REOPENED",
  REPORT_RESOLVED: "MSG_REPORT_RESOLVED",
  REPORT_STATUS_CHANGED: "MSG_REPORT_STATUS_CHANGED",
  REPORT_CLOSED: "MSG_REPORT_CLOSED",
  INCOMING_CALL: "MSG_INCOMING_CALL",
  CALL_STOP_RING: "MSG_CALL_STOP_RING",
};

// ---------------------------------------------------------------------------
// Anonymous calling
// ---------------------------------------------------------------------------

export const CALL_STATUS = {
  RINGING: "RINGING",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  MISSED: "MISSED",
  ABANDONED: "ABANDONED",
};

// ---------------------------------------------------------------------------
// Evidence & voicemail limits (D1, D7)
// ---------------------------------------------------------------------------

export const EVIDENCE_LIMITS = {
  MAX_FILES: 5,
  MAX_FILE_BYTES: 25 * 1024 * 1024, // 25 MB per file
  ALLOWED_EXTENSIONS: [
    // images
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "heic",
    // documents
    "pdf",
    "doc",
    "docx",
    "txt",
    "rtf",
    // audio
    "mp3",
    "wav",
    "m4a",
    "aac",
    "ogg",
    // video
    "mp4",
    "mov",
    "webm",
    "avi",
    "mkv",
  ],
  // Content-type prefixes accepted server-side (paired with the extension check).
  ALLOWED_CONTENT_TYPE_PREFIXES: ["image/", "audio/", "video/", "text/"],
  // Explicit document content types not covered by a prefix.
  ALLOWED_CONTENT_TYPES: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/rtf",
  ],
};

export const VOICEMAIL_LIMITS = {
  MAX_BYTES: 25 * 1024 * 1024, // 25 MB
  MAX_DURATION_MS: 3 * 60 * 1000, // 3 minutes (D7)
};

// ---------------------------------------------------------------------------
// Timing (D2, D7, D10, D11) — all in milliseconds.
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const TIMING = {
  AUTO_ESCALATE_CRITICAL_MS: 1 * ONE_DAY_MS, // CRITICAL +1 day (D2)
  AUTO_ESCALATE_DEFAULT_MS: 3 * ONE_DAY_MS, // others +3 days (D2)
  AUTO_CLOSE_MS: 30 * ONE_DAY_MS, // resolved +30 days (D2)
  CALL_RING_TIMEOUT_MS: 30 * 1000, // 30 s ring before voicemail (D7)
  // Mid-call inactivity backstop (ER-C12): an ACTIVE call with no clean hang-up is
  // force-ENDED after this window. Armed admin-side when the call is claimed (A-F21);
  // the guarded ACTIVE->ENDED handler (A-F22) makes a clean prior hang-up a no-op. A
  // generous ceiling so a genuine long call is never cut off — it only catches a call
  // that was answered then abandoned without an explicit end (e.g. browser closed).
  CALL_INACTIVITY_TIMEOUT_MS: 2 * 60 * 60 * 1000, // 2 hours
  SLA_OPEN_MS: 1 * ONE_DAY_MS, // OPEN 24 h backstop digest (D11)
  SLA_ESCALATED_MS: 1 * ONE_DAY_MS, // ESCALATED 24 h backstop digest (D11)
  SLA_DIGEST_INTERVAL_MS: 1 * ONE_DAY_MS, // SLA backstop digest sweep cadence (A-F18) — daily
};

// Reporter may reject a resolution once: reopenCount 0 -> 1 (D10).
export const REOPEN_CAP = 1;

// Dashboard small-cell suppression: merge any breakdown cell with FEWER THAN
// this many reports into "Other"/suppressed (ER-A6, D-L3-3, k-anonymity k=5).
export const SMALL_CELL_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Identifiers (lib/id-generator.js)
// ---------------------------------------------------------------------------

export const ID = {
  REPORT_PREFIX: "RPT-",
  CALL_PREFIX: "CALL-",
  REPORT_LENGTH: 10,
  CALL_LENGTH: 10,
  // Collision-resistant alphabet: no 0/O/1/I/L to avoid human/transcription error.
  ALPHABET: "23456789ABCDEFGHJKMNPQRSTUVWXYZ",
};

// ---------------------------------------------------------------------------
// Platform / S3 / static data
// ---------------------------------------------------------------------------

export const STATIC_DATA_KEYS = {
  CONVERSATIONS_BUCKET: "conversationsBucket",
  // PEER bot ids for cross-app (bot-to-bot) delivery. Sourced via
  // state.getStaticData(...) (same pattern as CONVERSATIONS_BUCKET / anonCallHostEmail)
  // and passed as the `botId` arg to sendMessageToUserInBot.
  //   ADMIN_BOT_ID — the anonymous-ADMIN app's bot id; the RECEIVER for the
  //     anonymous-user -> admin contracts (X1 MSG_NEW_REPORT, X2 MSG_REPORT_REOPENED,
  //     X3 MSG_INCOMING_CALL).
  //   USER_BOT_ID  — the anonymous-USER app's bot id; the RECEIVER for the
  //     admin -> user contracts (X4+ MSG_REPORT_RESOLVED / STATUS_CHANGED / CLOSED).
  // ⚠️ DEPLOYMENT DEPENDENCY: these static-data values MUST be set in each app's
  // deployment configuration (the admin deployment.config botId is currently empty),
  // and BOTH apps deployed, for cross-app delivery to actually occur. The code is
  // correct regardless — an unset/empty id makes the best-effort send a logged no-op.
  ADMIN_BOT_ID: "adminBotId",
  USER_BOT_ID: "userBotId",
};

// Short-lived signed URLs for private evidence/voicemail S3 objects (NFR-2).
export const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

// Web-push application type for state.notification.sendWebPush(user, appType, opts).
export const WEB_PUSH_APP_TYPE = "webapp";

// ---------------------------------------------------------------------------
// Calling — masked identities (anonymity; lib/calling.js)
// ---------------------------------------------------------------------------

export const CALLING = {
  // Throwaway masked guest display name shown to admins (NEVER the real name).
  GUEST_DISPLAY_NAME: "Anonymous Reporter",
  // Domain used to mint per-call throwaway guest emails (non-routable .invalid).
  GUEST_EMAIL_DOMAIN: "anonymous.invalid",
  // Generic ring banner copy — no caller name/id/email (ER-A5).
  RING_MESSAGE: "Incoming anonymous call",
};

// ---------------------------------------------------------------------------
// Error codes (NFR-4). Grouped by lib module; numeric for operations logging.
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  // validation 4000-series
  INVALID_EMAIL: 4001,
  INVALID_PHONE: 4002,
  INVALID_CABIN: 4003,
  INVALID_CONTACT_VALUE: 4004,
  INVALID_INCIDENT_DATE: 4005,
  INVALID_EVIDENCE_FILE: 4006,
  // access / anonymity 4100-series
  NOT_AN_ADMIN: 4101,
  NOT_REPORT_OWNER: 4102,
  NO_ASSIGNEE_FOUND: 4103,
  // state machine 4200-series
  ILLEGAL_TRANSITION: 4201,
  STALE_WRITE: 4202,
  REOPEN_CAP_REACHED: 4203,
  // notifications / calling 5000-series (best-effort failures, logged)
  NOTIFICATION_FAILED: 5001,
  BOT_MESSAGE_FAILED: 5002,
  CALL_RING_FAILED: 5003,
};

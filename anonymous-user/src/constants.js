// User-app-specific constants (intent ids, context names, state keys).
// Shared domain enums live in ../../lib/constants.js — do not duplicate them here.
// Every key/value is a SCREAMING_SNAKE_CASE constant (framework-mapping rule 19);
// no magic strings downstream.

// Custom intent ids. The string values MUST match the `data-intent-id` attributes
// the Display cards emit (U-D-* tasks), so they are the public navigation contract.
export const INTENT = {
  OPEN_SUBMIT_REPORT: "openSubmitReport",
  OPEN_MY_REPORTS: "openMyReports",
  OPEN_REPORT_DETAIL: "openReportDetail",
  // Voice path — the handler is built in U-F15; the Home CTA emits it now so the
  // navigation contract (input-schema display_elements) is complete.
  START_ANONYMOUS_CALL: "startAnonymousCall",
  // 30s no-answer timeout target (U-F16). NOT a button/navigation intent — it is
  // fired by the jobScheduler message armed at ring-start (start-anonymous-call.js),
  // so the string value is the scheduled-message intentId contract, not a public CTA.
  CALL_TIMEOUT: "callTimeout",
  // Call end/abandon target (U-F17, input-schema "callEnd"). NOT a navigation CTA — it
  // is fired with a { callRef } by either (a) a hang-up/cancel invoke_intent from the
  // meeting UI (payload one level deep under .payload), or (b) the mid-call inactivity
  // timeout jobScheduler message armed admin-side at ACTIVE/A-F21 (payload under .data).
  // The handler is status-conditional (RINGING->ABANDONED, ACTIVE->ENDED), so the string
  // value is the shared scheduled-message + invoke_intent contract, not a public CTA.
  CALL_END: "callEnd",
  // Reporter detail-actions (input-schema detailActions / U-F10–F13). Handlers are
  // built later; the detail-actions card emits these data-intent-id values now, so
  // the string values ARE the public navigation contract and must match the schema.
  ADD_AMENDMENT: "addAmendment",
  WITHDRAW_REPORT: "withdrawReport",
  ACCEPT_RESOLUTION: "acceptResolution",
  REJECT_RESOLUTION: "rejectResolution",
};

// Context ids (CLAUDE.md "App Entry-Point Bootstrap").
export const CONTEXT = {
  MAIN_APP: "mainApp",
};

// VideoCall control id (U-F15). The VideoCall instance is an Intent subclass and
// needs its own opaque control id, distinct from the START_ANONYMOUS_CALL
// navigation intent that triggers it. The framework keys the JOIN_MEETING response
// (state.messageFromUser.controlId) off this value, so it must be stable.
export const VIDEO_CALL = {
  CONTROL_ID: "anonymousVideoCall",
};

// state.setField keys used to pass data between independent intents (Context B).
export const STATE_KEYS = {
  // reportId stashed by openReportDetail's payload, read after loadDocument.
  CURRENT_REPORT_ID: "CURRENT_REPORT_ID",
  // callRef stashed by the callTimeout intent (U-F16) so the voicemail-capture
  // popup's onSubmit (a separate Lambda invocation) knows which call-queue row to
  // stamp voicemailKey + linkedReportId onto after the report is auto-created.
  CURRENT_CALL_REF: "CURRENT_CALL_REF",
  // Active My Reports filter — { statusGroup, category, search }. The list
  // renderer (U-D-myreports) reads this to highlight the active chip and to
  // filter the rendered rows. The openMyReports loader stashes the chip's
  // data-payload here (loader wiring + search box are deferred to the follow-up
  // fix task — see specs/4 MP-FIX-MYREPORTS-FILTERS).
  MY_REPORTS_FILTER: "MY_REPORTS_FILTER",
  // Number of evidence file slots currently revealed on the submit form (1–5).
  // The progressive "+ Add another file" pattern hides slots 2–5 by default; the
  // count is persisted in conversation state because the Field `hidden` flags are
  // module-level mutables that reset on a Lambda cold start (Context B). Read by
  // restoreEvidenceSlotVisibility / revealNextEvidenceSlot in frames/evidence-slots.
  EVIDENCE_SLOTS_VISIBLE: "EVIDENCE_SLOTS_VISIBLE",
};

// My Reports list — coarse status-group filter chips (wireframe §3:
// [All][Open][In progress][Done]). Group membership is DERIVED from the shared
// status state machine (lib/ticket-status STATUS_META.terminal) inside the list
// renderer, so this enum only fixes the chip VALUES that the chip data-payload
// and the loader agree on (no magic strings — rule 19).
export const MY_REPORTS_STATUS_GROUP = {
  ALL: "all",
  OPEN: "open",
  IN_PROGRESS: "in_progress",
  DONE: "done",
};

// "All categories" sentinel for the category filter chip — distinct from every
// CATEGORY token so an empty/absent filter never collides with a real value.
export const MY_REPORTS_CATEGORY_ALL = "all";

// Reporter-notification events (U-F14). The reusable dispatch helper
// (src/frames/reporter-notify.js notifyReporter) keys its copy off one of
// these. RECEIVED is the submit acknowledgement; the other three mirror the
// inbound cross-app contracts the receivers translate into a notification:
//   STATUS_CHANGED ← MSG_REPORT_STATUS_CHANGED (X5)
//   RESOLVED       ← MSG_REPORT_RESOLVED        (X4)
//   CLOSED         ← MSG_REPORT_CLOSED          (X6)
// The actual status wording always comes from the freshly-loaded report's
// status (statusLabel), so a stale/ambiguous event never misreports state.
export const NOTIFY_EVENT = {
  RECEIVED: "received",
  STATUS_CHANGED: "status_changed",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

// Voicemail / no-answer auto-create copy + job naming (U-F16). The two strings are
// the seed values for the auto-created source=CALL report (which has no reporter-
// entered content — see lib CATEGORY.OTHER / URGENCY.MEDIUM defaults in the frame).
// JOB_ID_PREFIX builds a deterministic, per-call jobScheduler jobId so a re-armed
// timer (e.g. a retried U-F15) overwrites rather than stacks a second timeout.
export const VOICEMAIL = {
  DEFAULT_REPORT_DESCRIPTION:
    "Anonymous voicemail received — please listen to the attached audio recording. This report was created automatically because no compliance officer was available to take the call.",
  STATUS_HISTORY_NOTE:
    "Auto-created from an anonymous voicemail (no compliance officer answered within the ring window).",
  JOB_ID_PREFIX: "call-timeout-",
};

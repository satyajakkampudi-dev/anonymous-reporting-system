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
};

// Context ids (CLAUDE.md "App Entry-Point Bootstrap").
export const CONTEXT = {
  MAIN_APP: "mainApp",
};

// state.setField keys used to pass data between independent intents (Context B).
export const STATE_KEYS = {
  // reportId stashed by openReportDetail's payload, read after loadDocument.
  CURRENT_REPORT_ID: "CURRENT_REPORT_ID",
  // Active My Reports filter — { statusGroup, category, search }. The list
  // renderer (U-D-myreports) reads this to highlight the active chip and to
  // filter the rendered rows. The openMyReports loader stashes the chip's
  // data-payload here (loader wiring + search box are deferred to the follow-up
  // fix task — see specs/4 MP-FIX-MYREPORTS-FILTERS).
  MY_REPORTS_FILTER: "MY_REPORTS_FILTER",
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

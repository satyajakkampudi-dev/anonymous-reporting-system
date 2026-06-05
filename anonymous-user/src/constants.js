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
};

// Context ids (CLAUDE.md "App Entry-Point Bootstrap").
export const CONTEXT = {
  MAIN_APP: "mainApp",
};

// state.setField keys used to pass data between independent intents (Context B).
export const STATE_KEYS = {
  // reportId stashed by openReportDetail's payload, read after loadDocument.
  CURRENT_REPORT_ID: "CURRENT_REPORT_ID",
};

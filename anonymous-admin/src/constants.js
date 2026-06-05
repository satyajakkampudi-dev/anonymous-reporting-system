// Admin-app-specific constants (intent ids, context names, state keys).
// Shared domain enums live in ../../lib/constants.js — do not duplicate them here.
// Every key/value is a SCREAMING_SNAKE_CASE constant (framework-mapping rule 19);
// no magic strings downstream.

// Custom intent ids. The string values MUST match the `data-intent-id` attributes
// the Display cards emit (A-D-* tasks), so they are the public navigation contract.
// Action/popup intents (takeReview, resolveReport, setAvailability, answerCall, …)
// are added by their own EDIT/custom tasks — this scaffold registers navigation only.
export const INTENT = {
  OPEN_DASHBOARD: "openDashboard",
  OPEN_QUEUE: "openQueue",
  OPEN_MANAGE_REPORT: "openManageReport",
  OPEN_MANUAL_LOG: "openManualLog",
  OPEN_ON_CALL: "openOnCall",
};

// Context ids (CLAUDE.md "App Entry-Point Bootstrap").
export const CONTEXT = {
  MAIN_APP: "mainApp",
};

// state.setField keys used to pass data between independent intents (Context B).
export const STATE_KEYS = {
  // Caller's resolved ROLE (PRIMARY_ADMIN | SECONDARY_ADMIN) — stashed by the
  // access gate, read by the queue role-filter (A-F4).
  ADMIN_ROLE: "ADMIN_ROLE",
  // reportId stashed by openManageReport's payload, read after the gateway load.
  CURRENT_REPORT_ID: "CURRENT_REPORT_ID",
};

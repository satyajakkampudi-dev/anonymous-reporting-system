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
  // Dashboard aggregation stash. PRODUCED by A-F2 (aggregate + small-cell
  // suppression over the loadReportsForAdmin set), CONSUMED by the dashboard
  // display renderers (A-D-dashboard). The display NEVER aggregates raw rows
  // itself — per-ship counts must arrive already suppressed (ER-A6, D-L3-3), so
  // the stash is the single contract between the two tasks. Shape (DASHBOARD_STATS):
  //   {
  //     totalReports: number,                         // size of the gateway set
  //     priorityCount: number,                        // CRITICAL || Immediate-risk || ESCALATED
  //     byStatus:   [{ status: STATUS,   count: number }],   // status token → statusPillHtml
  //     bySeverity: [{ severity: SEVERITY, count: number }], // severity token → severity tone
  //     byAge:      [{ bucket: string, label: string, count: number }], // <24h | 1-3d | 3-7d | >7d
  //     perShip:    [{ label: string, count: number }],      // ALREADY small-cell suppressed (<5 → "Other")
  //   }
  // Absent (pre-A-F2) → the renderers show a neutral empty state (empty-safe).
  // Any sub-array may be absent/empty → that group renders a muted "—".
  DASHBOARD_STATS: "DASHBOARD_STATS",
  // Report-queue list stash. PRODUCED by the role-filter + recusal (A-F4) and
  // priority surfacing/sort (A-F5) over the loadReportsForAdmin set; CONSUMED by
  // the queue display renderers (A-D-queue). The display NEVER queries reports
  // itself (ER-A3) and binds NO reporter-identity field (rule 30). Shape
  // (QUEUE_REPORTS): an ARRAY of identity-free, adminProjection report objects,
  // already role-filtered, recused (A-F4) and priority-sorted (A-F5):
  //   [{ reportId, status, severity, category, urgency, createdOn, assignedTo,
  //      againstAdmin }]
  // Until A-F4/A-F5 ship, the stash is absent → the queue renderer falls back to
  // the gateway-loaded reportsCollection.rows (app-start), each stripped through
  // applyAdminProjection as a second anonymity layer. Empty list → empty state.
  QUEUE_REPORTS: "QUEUE_REPORTS",
  // The queue's active quick-filter (one of QUEUE_FILTER.*). SET by A-F4 from the
  // openQueue invoke_intent payload; READ by the queue renderer to highlight the
  // active chip. Absent → QUEUE_FILTER.ALL (no filter applied yet).
  QUEUE_ACTIVE_FILTER: "QUEUE_ACTIVE_FILTER",
};

// Navigation payload contract. The Priority/Escalated dashboard card AND the
// queue's own quick-filter chips emit openQueue carrying { filter: QUEUE_FILTER.* };
// the role-filter/priority tasks (A-F4/A-F5) read the same value back from the
// invoke_intent payload. A shared constant so the emit + consume sides cannot
// drift (rule 19). ALL = the unfiltered view (default active chip). The remaining
// values mirror the quick-filter chips in the queue wireframe (§2).
export const QUEUE_FILTER = {
  ALL: "all",
  PRIORITY: "priority",
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  ESCALATED: "escalated",
};

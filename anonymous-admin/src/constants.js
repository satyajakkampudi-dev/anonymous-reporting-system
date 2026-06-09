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
  // Manage-detail action intents. The buttons in the Manage actions card
  // (A-D-manageactions) emit these data-intent-id values NOW; the handlers that
  // register them are added by their own EDIT/custom tasks (A-E-takeReview,
  // A-E-resolveReport, A-E-escalateReport, A-E-closeRejected, A-E-overrideSeverity,
  // A-F14 export). Defining the ids here keeps the emit + consume sides from
  // drifting (rule 19) — same convention as the user app's action intents. The id
  // strings match the input-schema display_elements `intent:*` sources verbatim.
  TAKE_REVIEW: "takeReview",
  OVERRIDE_SEVERITY: "overrideSeverity",
  RESOLVE_REPORT: "resolveReport",
  ESCALATE_REPORT: "escalateReport",
  CLOSE_REJECTED: "closeRejected",
  EXPORT_REPORT: "exportReport",
  // On-call presence action. The On-call display card (A-D-oncall) emits this
  // data-intent-id NOW on its Available/Busy/Unavailable buttons; the handler
  // that registers it is A-F20 (setAvailability). Defining the id here keeps the
  // emit + consume sides from drifting (rule 19) — matches the schema/wireframe
  // `intent:setAvailability` source verbatim.
  SET_AVAILABILITY: "setAvailability",
  // Incoming-call ring-banner actions. The Incoming-call display card
  // (A-D-incomingcall) emits these data-intent-id values NOW on its Answer /
  // Dismiss buttons; the handlers that register them are A-F21 (answerCall —
  // atomic claim → ACTIVE/attendedBy, first writer wins) and A-F22 (dismissCall
  // — local dismiss only; others keep ringing). Defining the ids here keeps the
  // emit + consume sides from drifting (rule 19) — match the schema
  // `intent:answerCall` / `intent:dismissCall` sources verbatim.
  ANSWER_CALL: "answerCall",
  DISMISS_CALL: "dismissCall",
  // In-call hang-up. The in-call UI (the meeting hang-up control / a "End call"
  // button) emits this data-intent-id with payload { callRef } when the answering
  // admin ends the call; A-F22 (endCall) applies the guarded ACTIVE->ENDED transition
  // (records durationMs) and frees the admin (availability -> available). Defining the
  // id here keeps the emit + consume sides from drifting (rule 19). NOTE: the in-call
  // UI surface that emits this is the meeting client's hang-up — if a bespoke in-app
  // "End call" button is added later it MUST emit this id with { callRef }.
  END_CALL: "endCall",
  // Mid-call inactivity backstop (ER-C12). A-F21 arms a jobScheduler message at claim
  // time (now + TIMING.CALL_INACTIVITY_TIMEOUT_MS, deterministic jobId per call, to the
  // answering admin's OWN userId) carrying { callRef }. This handler (A-F22) moves
  // ACTIVE->ENDED ONLY if the call is still ACTIVE — a clean prior hang-up makes it a
  // guarded no-op (rule 13). Separate id from endCall so the timeout can never be
  // mistaken for a user-initiated hang-up in logs/audit.
  CALL_INACTIVITY: "callInactivity",
  // Meeting-lifecycle intents the Loft/Daily BACKEND fires (framework conventions, the
  // SAME names SeaMedix registers) when the live meeting ends / a participant leaves.
  // These — NOT videoCall.onCallEnd — are the reliable "the admin left the call" signal;
  // their handlers (frames/end-call.js) free the admin's presence (busy -> available) and
  // end the call. Values are fixed by the platform: "endMeeting" / "leaveUser".
  MEETING_ENDED: "endMeeting",
  USER_LEFT: "leaveUser",
  // System-scheduled auto-close. resolveReport (A-E-resolveReport) arms a
  // jobScheduler message for resolvedOn + AUTO_CLOSE_DELAY_MS (D2) carrying
  // payload { reportId } ONLY (no identity). The handler that registers this id
  // is A-F17 (auto-close: RESOLVED -> CLOSED_BY_SYSTEM if still unaccepted).
  // Defining the id here keeps the schedule + consume sides from drifting (rule 19).
  AUTO_CLOSE_REPORT: "autoCloseReport",
  // System-scheduled auto-escalate. The X1 receiver (admin app, on MSG_NEW_REPORT)
  // arms a jobScheduler message on a NEW report for createdOn + the SLA timer, picking
  // the delay by severity: CRITICAL -> TIMING.AUTO_ESCALATE_CRITICAL_MS (+1d, D2),
  // else TIMING.AUTO_ESCALATE_DEFAULT_MS (+3d, D2). The scheduled message carries
  // payload { reportId } ONLY (no identity — rule 30). The handler that registers
  // this id is A-F16 (auto-escalate: OPEN -> ESCALATED if still unactioned). Defining
  // the id here keeps the schedule + consume sides from drifting (rule 19). X1 DEPENDS
  // on A-F16, so this handler is dormant until X1 arms it (correct dependency order).
  AUTO_ESCALATE: "autoEscalate",
  // System-scheduled SLA backstop digest (A-F18). A periodic job sweeps the
  // gateway-loaded reports for OPEN>24h / ESCALATED>24h breaches (the SHARED
  // lib/sla.js predicate, identical to the in-app A-D-alerts twin) and emails ALL
  // admins an identity-free digest. SELF-REARMING: each run re-schedules the next
  // sweep (TIMING.SLA_DIGEST_INTERVAL_MS later) under a deterministic jobId so the
  // chain never duplicates. The FIRST arming is a deploy/ops bootstrap step — see
  // frames/sla-digest.js header.
  SLA_DIGEST: "slaDigest",
};

// Context ids (CLAUDE.md "App Entry-Point Bootstrap").
export const CONTEXT = {
  MAIN_APP: "mainApp",
  // Stable per-screen tab ids (rule 37). The framework keys each UI tab by the
  // contextId STRING, so reusing the SAME string per screen re-renders IN PLACE
  // (no new tab). Background contracts/jobs keep throwaway unique ids (no UI).
  QUEUE: "queue",
  MANAGE_REPORT: "manageReport",
  ON_CALL: "onCall",
  MANUAL_LOG: "manualLog",
};

// VideoCall control id for the admin app's exported VideoCall instance (A-F21). The
// framework routes JOIN_MEETING + the call-lifecycle responses through the instance
// keyed by this id, so it MUST be exported (frames/answer-call.js). Distinct from the
// user app's anonymousVideoCall — each app exports its own instance.
export const VIDEO_CALL = {
  CONTROL_ID: "adminVideoCall",
};

// Deterministic jobScheduler jobId prefix for the mid-call inactivity backstop (A-F21
// arms it; A-F22 receives it). Per-call (`${prefix}${callRef}`) so a re-arm overwrites
// rather than stacks (ER-B8).
export const CALL = {
  INACTIVITY_JOB_ID_PREFIX: "callInactivity-",
};

// state.setField keys used to pass data between independent intents (Context B).
export const STATE_KEYS = {
  // Caller's resolved ROLE (PRIMARY_ADMIN | SECONDARY_ADMIN) — stashed by the
  // access gate, read by the queue role-filter (A-F4).
  ADMIN_ROLE: "ADMIN_ROLE",
  // reportId stashed by openManageReport's payload, read after the gateway load.
  CURRENT_REPORT_ID: "CURRENT_REPORT_ID",
  // Local (per-admin) incoming-call dismissal. The ring banner is gated on the SHARED
  // callQueueDoc status === RINGING, but Dismiss (A-F22) is LOCAL ONLY — it must hide
  // THIS admin's banner WITHOUT changing the shared status (others keep ringing). There
  // is no per-admin field on the shared row to carry that, so dismissCall stashes the
  // dismissed callRef here and the incoming-call section AND-gates on it: a banner shows
  // only while RINGING AND its callRef !== the locally-dismissed one. Per-callRef, so a
  // later NEW call (different callRef) rings normally; survives the autoSaveBuffer
  // rehydrating a stale RINGING status on this conversation (Context B safety).
  DISMISSED_CALL_REF: "DISMISSED_CALL_REF",
  // Count of currently-visible evidence file slots on the manual-log form (1–5).
  // Progressive disclosure: slot 1 always visible; "+ Add another file" reveals the
  // next. The `hidden` Field flags reset on a Lambda cold start (Context B), so the
  // live count is persisted here and re-applied by restoreEvidenceSlotVisibility
  // (frames/evidence-slots.js). Reset to 1 on each fresh manual-log open.
  EVIDENCE_SLOTS_VISIBLE: "EVIDENCE_SLOTS_VISIBLE",
  // Target STATUS armed by a note-popup trigger intent (escalateReport A-F10 /
  // closeRejected A-F11). noteCaptureDoc is SHARED by both transitions and has
  // exactly ONE onSubmit slot, so a single shared dispatcher (frames/note-transition.js)
  // owns that slot and reads THIS key to learn which transition the trigger armed
  // (Context B — the popup submit is a fresh invocation; the target survives via Redis).
  // Lost (warm-container reset / direct submit) → the dispatcher treats it as a
  // neutral 500, never guesses a transition.
  PENDING_NOTE_TARGET: "PENDING_NOTE_TARGET",
  // Evidence signed-URL stash for the opened report. PRODUCED by A-F7 in the
  // openManageReport frame (Context B) — for each evidenceFile* S3 key it calls
  // state.frontmlib.getS3SignedUrl(bucket, "${conversationId}/${key}", expiry)
  // BEFORE sendResponse (signing cannot live in the non-awaited onResponse, rule 11/18).
  // CONSUMED by the Manage-content display renderers (A-D-managecontent), which derive
  // the attached-file list from the loaded projection row's media envelopes and overlay
  // the URL by S3 key. Shape (CURRENT_REPORT_EVIDENCE): a map keyed by the raw S3 key →
  //   { [s3Key]: signedUrl }
  // Absent (pre-A-F7) / a key missing (signing failed or expired) → the renderer shows
  // the filename marked "(link unavailable)", never the raw key. Keys are unique per
  // report, so a stale stash from a previously-opened report cannot surface a wrong link
  // (warm-container safe).
  CURRENT_REPORT_EVIDENCE: "CURRENT_REPORT_EVIDENCE",
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
  // Queue pagination (MP-FIX-QUEUE-PAGINATION, framework-mapping rule 36). The queue is
  // paginated IN-MEMORY (the priority-float sort + free-text recusal don't translate to a
  // Mongo sort/query; the full set is already loaded for dashboard stats). nav-queue slices
  // buildQueueReports' result to LIST_PAGE_SIZE and stashes the current 0-indexed page +
  // whether a next page exists, for the prev/next control.
  QUEUE_PAGE: "QUEUE_PAGE",
  QUEUE_HAS_MORE: "QUEUE_HAS_MORE",
  // Alerts (A-F19) breach-list pagination — in-memory slice of the buildBreaches array.
  ALERTS_PAGE: "ALERTS_PAGE",
  // Notification-failure list for the Alerts / Digest fallback banner (A-D-alerts,
  // ER-D15). A SYNCHRONOUS render stash consumed by the alerts onResponse (which is
  // not awaited and so cannot read the durable sharedField directly — same constraint,
  // same solution as CURRENT_REPORT_EVIDENCE: a Context-B frame reads the durable store
  // and stashes it via state.setField BEFORE sendResponse).
  // PRODUCER (NOT YET BUILT): the notification senders (A-F15/A-F17) record each
  // best-effort email/push failure into a durable, cross-admin sharedField (failures
  // occur in OTHER admins' invocations, so a per-conversation field cannot carry them);
  // the alerts nav frame then reads that sharedField and writes this synchronous stash
  // before adminDisplayDoc.sendResponse(). Until that lands, the stash is ABSENT and the
  // banner is hidden (empty-safe) — flagged for a /frontm-fix-task. The SLA-breach list
  // does NOT depend on this; it is computed live from the gateway-loaded rows.
  // CONSUMER: the alerts display renderers (A-D-alerts). Shape (NOTIFICATION_FAILURES):
  //   an ARRAY of identity-free descriptors → [{ reportId, failedOn }]
  // (reportId only — never a recipient address or reporter id; rule 30). Absent/empty →
  // no banner.
  NOTIFICATION_FAILURES: "NOTIFICATION_FAILURES",
};

// DURABLE cross-admin shared keys (state.setSharedField — Redis, cross-user, TTL).
// Distinct from STATE_KEYS (per-conversation state.setField): these survive ACROSS
// admins' invocations, which is mandatory for data PRODUCED in one admin's Lambda
// and CONSUMED in another's.
export const SHARED_KEYS = {
  // The durable producer behind STATE_KEYS.NOTIFICATION_FAILURES. The notification
  // dispatcher (frames/admin-notify.js, A-F15) APPENDS { reportId, failedOn } here on
  // any best-effort email/push failure — failures happen in whichever admin's context
  // the transition/job fired in, so a per-conversation field cannot carry them across
  // admins. The alerts nav frame (A-D-alerts producer, not yet built) reads THIS durable
  // list and writes the synchronous render stash STATE_KEYS.NOTIFICATION_FAILURES that
  // the alerts onResponse consumes (the onResponse is not awaited and so cannot read the
  // async sharedField directly — same constraint/solution as CURRENT_REPORT_EVIDENCE).
  // Shape MUST match the alerts consumer: an ARRAY of [{ reportId, failedOn }] (reportId
  // only — never a recipient address or reporter id; rule 30).
  NOTIFICATION_FAILURES: "SHARED_NOTIFICATION_FAILURES",
};

// TTL (seconds) for the durable notification-failure list. Generous so a failure is
// not silently dropped before the daily SLA digest / alerts banner can surface it
// (ER-D15) — 14 days, well beyond the daily digest cadence (TIMING.SLA_DIGEST_INTERVAL_MS).
export const NOTIFICATION_FAILURE_TTL_SECONDS = 14 * 24 * 60 * 60;

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
  RESOLVED: "resolved",
};

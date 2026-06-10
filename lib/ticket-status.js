// Report status enum + display metadata + allowed-transition map.
// Single source of truth for the state machine in ../REQUIREMENTS.md §6 and
// ../specs/SPEC.md "Status state machine". Both apps gate every status change
// against this map; status is NEVER written free-form (framework-mapping rule 12).
//
// STATUS_TRANSITIONS is transcribed exactly from SPEC.md's transition table.
// Concurrency (ER-B5) is enforced by callers: re-read the report, confirm the
// move is legal from the CURRENT status via canTransition(), and check the
// `version`/`updatedOn` guard before writing. This module is pure (no DB/state).

import { ROLE, ACTOR_ROLE, TRANSITION_ACTOR } from "./constants";

// All report statuses.
export const STATUS = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  ESCALATED: "ESCALATED",
  RESOLVED: "RESOLVED",
  REOPENED: "REOPENED",
  CLOSED_BY_USER: "CLOSED_BY_USER",
  CLOSED_BY_SYSTEM: "CLOSED_BY_SYSTEM",
  CLOSED_REJECTED: "CLOSED_REJECTED",
  WITHDRAWN: "WITHDRAWN",
};

// Visual tone tokens (resolved to colours in lib/utils/theme.js STATUS_TONES).
export const TONE = {
  NEUTRAL: "neutral",
  INFO: "info",
  PROGRESS: "progress",
  SUCCESS: "success",
  WARNING: "warning",
  DANGER: "danger",
};

// Reporter + admin actions surfaced in the detail/manage action rows.
export const ACTION = {
  // reporter
  AMEND: "amend",
  WITHDRAW: "withdraw",
  ACCEPT: "accept",
  REJECT: "reject",
  // admin
  TAKE_REVIEW: "takeReview",
  RESOLVE: "resolve",
  ESCALATE: "escalate",
  CLOSE_REJECTED: "closeRejected",
  OVERRIDE_SEVERITY: "overrideSeverity",
  EXPORT: "export",
};

// Per-status metadata: { label, tone, terminal, allowedActionsByRole }.
// allowedActionsByRole is keyed by the actor's role:
//   ACTOR_ROLE.REPORTER · ROLE.PRIMARY_ADMIN · ROLE.SECONDARY_ADMIN.
// SECONDARY_ADMIN handles ESCALATED reports and does what PRIMARY does EXCEPT
// escalate - it is the top of the escalation chain (escalation routes PRIMARY → SECONDARY).
// Action VISIBILITY here is status-based; finer runtime guards (reopen cap,
// recusal, ownership, severity-always-on-non-terminal) live in the frames.
export const STATUS_META = {
  [STATUS.OPEN]: {
    label: "Open",
    tone: TONE.INFO,
    terminal: false,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [ACTION.AMEND, ACTION.WITHDRAW],
      [ROLE.PRIMARY_ADMIN]: [
        ACTION.TAKE_REVIEW,
        ACTION.ESCALATE,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
      // The SECONDARY admin is the TOP of the escalation chain (escalation routes
      // PRIMARY → SECONDARY; there is no higher tier) - so they do NOT escalate.
      [ROLE.SECONDARY_ADMIN]: [
        ACTION.TAKE_REVIEW,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
    },
  },
  [STATUS.UNDER_REVIEW]: {
    label: "Under review",
    tone: TONE.PROGRESS,
    terminal: false,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [ACTION.AMEND, ACTION.WITHDRAW],
      [ROLE.PRIMARY_ADMIN]: [
        ACTION.RESOLVE,
        ACTION.ESCALATE,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
      // SECONDARY is the top tier - resolves rather than escalates (no Escalate action).
      [ROLE.SECONDARY_ADMIN]: [
        ACTION.RESOLVE,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
    },
  },
  [STATUS.ESCALATED]: {
    label: "Escalated",
    tone: TONE.WARNING,
    terminal: false,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [ACTION.AMEND],
      // Escalated reports are handled by the secondary admin; the primary can
      // still triage severity / export but cannot take/resolve them.
      [ROLE.PRIMARY_ADMIN]: [ACTION.OVERRIDE_SEVERITY, ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [
        ACTION.TAKE_REVIEW,
        ACTION.RESOLVE,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
    },
  },
  [STATUS.RESOLVED]: {
    label: "Resolved",
    tone: TONE.SUCCESS,
    terminal: false,
    allowedActionsByRole: {
      // Reject is gated additionally on reopenCount < REOPEN_CAP in the frame.
      [ACTOR_ROLE.REPORTER]: [ACTION.ACCEPT, ACTION.REJECT, ACTION.AMEND],
      [ROLE.PRIMARY_ADMIN]: [ACTION.OVERRIDE_SEVERITY, ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [ACTION.OVERRIDE_SEVERITY, ACTION.EXPORT],
    },
  },
  [STATUS.REOPENED]: {
    label: "Reopened",
    tone: TONE.WARNING,
    terminal: false,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [ACTION.AMEND],
      [ROLE.PRIMARY_ADMIN]: [
        ACTION.TAKE_REVIEW,
        ACTION.ESCALATE,
        ACTION.CLOSE_REJECTED,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
      // SECONDARY is the top tier - no Escalate (handles/closes reopened reports itself).
      [ROLE.SECONDARY_ADMIN]: [
        ACTION.TAKE_REVIEW,
        ACTION.CLOSE_REJECTED,
        ACTION.OVERRIDE_SEVERITY,
        ACTION.EXPORT,
      ],
    },
  },
  [STATUS.CLOSED_BY_USER]: {
    label: "Closed (accepted)",
    tone: TONE.NEUTRAL,
    terminal: true,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [],
      [ROLE.PRIMARY_ADMIN]: [ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [ACTION.EXPORT],
    },
  },
  [STATUS.CLOSED_BY_SYSTEM]: {
    label: "Closed (auto)",
    tone: TONE.NEUTRAL,
    terminal: true,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [],
      [ROLE.PRIMARY_ADMIN]: [ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [ACTION.EXPORT],
    },
  },
  [STATUS.CLOSED_REJECTED]: {
    label: "Closed (rejected)",
    tone: TONE.DANGER,
    terminal: true,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [],
      [ROLE.PRIMARY_ADMIN]: [ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [ACTION.EXPORT],
    },
  },
  [STATUS.WITHDRAWN]: {
    label: "Withdrawn",
    tone: TONE.NEUTRAL,
    terminal: true,
    allowedActionsByRole: {
      [ACTOR_ROLE.REPORTER]: [],
      [ROLE.PRIMARY_ADMIN]: [ACTION.EXPORT],
      [ROLE.SECONDARY_ADMIN]: [ACTION.EXPORT],
    },
  },
};

// Allowed transitions: { [fromStatus]: [{ to, actor, action }] }.
// `actor` is a TRANSITION_ACTOR; ADMIN means any admin, SECONDARY_ADMIN means
// specifically the secondary. Transcribed verbatim from SPEC.md's table.
export const STATUS_TRANSITIONS = {
  [STATUS.OPEN]: [
    {
      to: STATUS.UNDER_REVIEW,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.TAKE_REVIEW,
    },
    // Admin may escalate a fresh OPEN report directly (no take-review first) -
    // matches allowedActionsByRole[OPEN] + escalate-report.js. Role split (PRIMARY
    // only) is enforced by allowedActionsByRole + the isActionAllowed gate in
    // note-transition (canTransition's ADMIN actor does not distinguish the two).
    {
      to: STATUS.ESCALATED,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.ESCALATE,
    },
    {
      to: STATUS.ESCALATED,
      actor: TRANSITION_ACTOR.SYSTEM,
      action: "autoEscalate",
    },
    {
      to: STATUS.WITHDRAWN,
      actor: TRANSITION_ACTOR.REPORTER,
      action: ACTION.WITHDRAW,
    },
  ],
  [STATUS.UNDER_REVIEW]: [
    {
      to: STATUS.RESOLVED,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.RESOLVE,
    },
    {
      to: STATUS.ESCALATED,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.ESCALATE,
    },
    {
      to: STATUS.ESCALATED,
      actor: TRANSITION_ACTOR.SYSTEM,
      action: "autoEscalate",
    },
    {
      to: STATUS.WITHDRAWN,
      actor: TRANSITION_ACTOR.REPORTER,
      action: ACTION.WITHDRAW,
    },
  ],
  [STATUS.ESCALATED]: [
    {
      to: STATUS.UNDER_REVIEW,
      actor: TRANSITION_ACTOR.SECONDARY_ADMIN,
      action: ACTION.TAKE_REVIEW,
    },
    {
      to: STATUS.RESOLVED,
      actor: TRANSITION_ACTOR.SECONDARY_ADMIN,
      action: ACTION.RESOLVE,
    },
  ],
  [STATUS.RESOLVED]: [
    {
      to: STATUS.CLOSED_BY_USER,
      actor: TRANSITION_ACTOR.REPORTER,
      action: ACTION.ACCEPT,
    },
    {
      to: STATUS.CLOSED_BY_SYSTEM,
      actor: TRANSITION_ACTOR.SYSTEM,
      action: "autoClose",
    },
    {
      to: STATUS.REOPENED,
      actor: TRANSITION_ACTOR.REPORTER,
      action: ACTION.REJECT,
    },
  ],
  [STATUS.REOPENED]: [
    {
      to: STATUS.UNDER_REVIEW,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.TAKE_REVIEW,
    },
    {
      to: STATUS.ESCALATED,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.ESCALATE,
    },
    {
      to: STATUS.CLOSED_REJECTED,
      actor: TRANSITION_ACTOR.ADMIN,
      action: ACTION.CLOSE_REJECTED,
    },
  ],
  // Terminal states have no outgoing transitions.
  [STATUS.CLOSED_BY_USER]: [],
  [STATUS.CLOSED_BY_SYSTEM]: [],
  [STATUS.CLOSED_REJECTED]: [],
  [STATUS.WITHDRAWN]: [],
};

// True when `caller` (an ACTOR_ROLE value, or TRANSITION_ACTOR.ADMIN/SYSTEM)
// satisfies a transition's `required` actor.
//   - SYSTEM           → only SYSTEM
//   - REPORTER         → only REPORTER
//   - SECONDARY_ADMIN  → only the secondary admin
//   - ADMIN            → any admin (primary or secondary)
export const actorSatisfies = (required, caller) => {
  if (required === TRANSITION_ACTOR.ADMIN) {
    return (
      caller === ROLE.PRIMARY_ADMIN ||
      caller === ROLE.SECONDARY_ADMIN ||
      caller === ACTOR_ROLE.PRIMARY_ADMIN ||
      caller === ACTOR_ROLE.SECONDARY_ADMIN ||
      caller === TRANSITION_ACTOR.ADMIN
    );
  }
  if (required === TRANSITION_ACTOR.SECONDARY_ADMIN) {
    return (
      caller === ROLE.SECONDARY_ADMIN || caller === ACTOR_ROLE.SECONDARY_ADMIN
    );
  }
  return required === caller;
};

// Returns true only for moves present in STATUS_TRANSITIONS where `actor`
// satisfies the entry's required actor. Stale/illegal moves return false.
export const canTransition = (from, to, actor) => {
  const moves = STATUS_TRANSITIONS[from] || [];
  return moves.some((m) => m.to === to && actorSatisfies(m.actor, actor));
};

// Convenience accessors.
export const isTerminal = (status) => !!STATUS_META[status]?.terminal;

export const statusLabel = (status) =>
  STATUS_META[status]?.label || status || "";

export const allowedActions = (status, role) =>
  STATUS_META[status]?.allowedActionsByRole?.[role] || [];

export const isActionAllowed = (status, role, action) =>
  allowedActions(status, role).includes(action);

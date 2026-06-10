// Shared SLA-breach predicate (D11) - the SINGLE source of truth for "which
// reports have slipped their service-level deadline". Extracted VERBATIM from
// anonymous-admin/src/sections/display/alerts/index.js so the in-app Alerts twin
// (A-D-alerts / A-F19) and the email digest backstop job (A-F18) breach on the
// SAME rule and can never drift.
//
// PURE module: depends ONLY on other lib/ modules (STATUS, TIMING). No framework
// state, no app imports, no DB - so both micro-apps can import it freely with no
// circular-dependency risk (lib is the tree root). `nowMs` is injectable for
// testability and deterministic scheduling.
//
// SLA BREACH (D11): OPEN unactioned >= 24h, OR ESCALATED unactioned >= 24h.
// OPEN age runs from createdOn; ESCALATED age runs from the last write (updatedOn -
// the escalation time for a report untouched since; there is no dedicated
// escalatedOn field; falls back to createdOn). Thresholds are the shared
// TIMING.SLA_* constants (rule 19).
//
// ANONYMITY: operates only on already-projected, identity-free report objects (the
// loadReportsForAdmin gateway output, ER-A3). It reads reportId / status /
// assignedTo / createdOn / updatedOn only - NEVER any reporter-identity field - and
// the breach descriptors it emits carry only reportId / status / assignedTo (role) /
// sinceOn (rule 16, rule 30).

import { STATUS } from "./ticket-status";
import { TIMING, SEVERITY } from "./constants";

// The SLA-breach reference timestamp + threshold for a report, or null if its
// status is not SLA-tracked. OPEN ages from createdOn; ESCALATED ages from the last
// write (updatedOn - escalation time for an untouched report; createdOn fallback).
export const slaForReport = (r) => {
  if (r.status === STATUS.OPEN) {
    return { since: Number(r.createdOn) || 0, thresholdMs: TIMING.SLA_OPEN_MS };
  }
  if (r.status === STATUS.ESCALATED) {
    const since = Number(r.updatedOn) || Number(r.createdOn) || 0;
    return { since, thresholdMs: TIMING.SLA_ESCALATED_MS };
  }
  return null;
};

// Build the breach list: SLA-tracked reports whose unactioned age has crossed the
// threshold. Pure - `nowMs` injectable (defaults to now). Most overdue first.
export const buildBreaches = (reports, nowMs = Date.now()) =>
  reports
    .map((r) => {
      const sla = slaForReport(r);
      if (!sla || !sla.since) return null;
      const overdue = nowMs - sla.since >= sla.thresholdMs;
      return overdue
        ? {
            reportId: r.reportId,
            status: r.status,
            assignedTo: r.assignedTo || "",
            sinceOn: sla.since, // age reference → formatRelative in the renderer
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => (Number(a.sinceOn) || 0) - (Number(b.sinceOn) || 0));

// ---------------------------------------------------------------------------
// Escalate-due predicate (MP-FIX-ESCALATE-DECOUPLE, framework-mapping rule 35→34)
// ---------------------------------------------------------------------------

// True when an OPEN report has passed its auto-escalate deadline (createdOn + the
// severity-based delay). Mirrors the delay the scheduled job uses (CRITICAL → +1d/test,
// else +3d/test). Pure + identity-free - reads status / severity / createdOn only. The
// A-F18 sweep uses this to escalate any OPEN report whose timer was never armed (e.g. an
// empty registry skipped the X1 message); the guarded escalateOpenReport then makes a
// duplicate (job + sweep) a no-op.
export const isEscalateDue = (report, nowMs = Date.now()) => {
  if (!report || report.status !== STATUS.OPEN) return false;
  const createdOn = Number(report.createdOn) || 0;
  if (!createdOn) return false;
  const delayMs =
    report.severity === SEVERITY.CRITICAL
      ? TIMING.AUTO_ESCALATE_CRITICAL_MS
      : TIMING.AUTO_ESCALATE_DEFAULT_MS;
  return nowMs - createdOn >= delayMs;
};

// The OPEN reports past their escalate deadline (assignee-independent backstop input).
export const escalateDueReports = (reports, nowMs = Date.now()) =>
  (reports || []).filter((r) => isEscalateDue(r, nowMs));

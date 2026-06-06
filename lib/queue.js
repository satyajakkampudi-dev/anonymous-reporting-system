// Shared report-queue data prep (A-F4 role filter + recusal, A-F5 priority
// surfacing/sort/quick-filter) — the SINGLE source of truth for the identity-free
// list the admin queue renders. Extracted as a pure lib/ module (mirroring lib/sla.js
// and lib/dashboard-stats.js) so the producer (anonymous-admin/src/frames/nav-queue.js)
// stays a thin Context-B wrapper and the filter/recusal/sort logic is testable in
// isolation with no duplication or drift.
//
// PURE module: depends ONLY on other lib/ modules — the shared ROLE / STATUS enums, the
// pure routing helper (resolveTargetRoleFor) and the SHARED priority predicate (isPriority,
// re-exported from lib/dashboard-stats.js so it is byte-identical to the A-F2 dashboard
// 'Priority / Escalated' count). It takes already-loaded, already-projected report objects
// + the resolved viewing role/identity as ARGUMENTS — it never touches framework state, a
// DB, or an app import, so it carries no circular-dependency risk (lib is the tree root).
//
// ROUTING (rule 14): role membership is decided ONLY via resolveTargetRoleFor (lib/access)
// — the report's LIVE assignedTo, falling back to the againstAdmin creation-time default.
// There is NO hardcoded role/status query here. assignedTo is the AUTHORITATIVE routing
// key; the spec's status view (Primary = OPEN/UNDER_REVIEW; Secondary = ESCALATED +
// against-admin + the primary set) is its consequence (see roleSees below for the
// reconciliation). Reads ONLY go through loadReportsForAdmin upstream (rule 15).
//
// RECUSAL (D9 / ER-A4): the PRIMARY mechanism is routing — an againstAdmin report is
// stamped assignedTo = SECONDARY_ADMIN at creation, so it never appears in the PRIMARY's
// role set. The finer "about THIS specific admin" check (isRecusedFor) is a CONSERVATIVE,
// best-effort match of the report's free-text accusedParty against the viewing admin's own
// adminEmail (local-part) — used SOLELY to hide rows, never written or sent (rule 30).
// Accepted residual gap (D9, v1): a report about the SECONDARY admin is still visible to
// them — the secondary is the escalation backstop and v1 has no designated alternate. We
// therefore recuse only the PRIMARY by accusedParty; the secondary's recusal is the
// routing-away of againstAdmin reports plus this same accusedParty heuristic where it
// cleanly matches, never over-hiding.
//
// ANONYMITY: operates only on the identity-free projected set (loadReportsForAdmin output)
// — reportId / status / severity / category / urgency / createdOn / assignedTo /
// againstAdmin / accusedParty only; NEVER a reporterId / contactMethod / contactValue. The
// stash it builds carries exactly the QUEUE_REPORTS contract (anonymous-admin constants).

import { ROLE } from "./constants";
import { STATUS } from "./ticket-status";
import { resolveTargetRoleFor } from "./access";
import { isPriority } from "./dashboard-stats";

// Re-export so consumers share the ONE predicate (no drift with A-F2).
export { isPriority };

// Quick-filter tokens (mirror of anonymous-admin QUEUE_FILTER — kept as local string
// constants here so this pure lib has no app import; nav-queue maps QUEUE_FILTER → these).
export const QUEUE_FILTER_KIND = {
  ALL: "all",
  PRIORITY: "priority",
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  ESCALATED: "escalated",
};

// Map a quick-filter token to the STATUS it narrows to (PRIORITY/ALL handled separately).
const FILTER_STATUS = {
  [QUEUE_FILTER_KIND.OPEN]: STATUS.OPEN,
  [QUEUE_FILTER_KIND.UNDER_REVIEW]: STATUS.UNDER_REVIEW,
  [QUEUE_FILTER_KIND.ESCALATED]: STATUS.ESCALATED,
};

// The identity-free projection the queue renderer binds (QUEUE_REPORTS contract). We
// project explicitly rather than spreading the whole row so a future extra column on the
// loaded object can never leak into the stash by accident (anonymity belt-and-braces).
const toQueueRow = (r) => ({
  reportId: r.reportId,
  status: r.status,
  severity: r.severity,
  category: r.category,
  urgency: r.urgency,
  createdOn: r.createdOn,
  assignedTo: r.assignedTo,
  againstAdmin: !!r.againstAdmin,
});

// ROLE FILTER (A-F4). True if a report belongs in `viewingRole`'s queue.
//   PRIMARY   sees the "primary set": reports routed to PRIMARY_ADMIN.
//   SECONDARY sees everything the primary does PLUS the reports routed to SECONDARY_ADMIN
//             (ESCALATED + against-admin, which resolveTargetRoleFor stamps SECONDARY).
// Routing target comes ONLY from resolveTargetRoleFor (rule 14). Reconciliation with the
// spec's status view: a freshly-created non-against-admin report defaults to PRIMARY_ADMIN
// and is OPEN/UNDER_REVIEW until an admin escalates it; escalation stamps assignedTo =
// SECONDARY_ADMIN, so ESCALATED reports resolve to SECONDARY; an against-admin report is
// stamped SECONDARY at creation. Hence "PRIMARY sees PRIMARY-routed" yields exactly
// OPEN/UNDER_REVIEW (the primary set), and "SECONDARY sees SECONDARY-routed + the primary
// set" yields ESCALATED + against-admin + the primary set — the spec's definition.
export const roleSees = (report, viewingRole) => {
  const target = resolveTargetRoleFor(report);
  if (viewingRole === ROLE.SECONDARY_ADMIN) return true; // superset of the primary set
  // PRIMARY (or any non-secondary viewer): only the PRIMARY-routed set.
  return target === ROLE.PRIMARY_ADMIN;
};

// The local-part of an email ("jane.doe" from "jane.doe@line.com"), lower-cased + trimmed.
const emailLocalPart = (email) =>
  (typeof email === "string" ? email : "").trim().toLowerCase().split("@")[0] ||
  "";

// RECUSAL heuristic (A-F4 / D9). True if `report.accusedParty` (free text) plausibly names
// the viewing admin, so the report must be HIDDEN from them. CONSERVATIVE by design — a
// false hide is worse than a false show (we must never bury a legitimate report) — so we
// match only on a clear signal: the viewing admin's email local-part appearing as a
// whole token in the accusedParty text. We DO NOT fuzzy-match arbitrary substrings (e.g.
// "ali" inside "validation") nor very short local-parts (< 3 chars) that would over-match.
//
// identity = { adminEmail } of the VIEWING admin (resolveAdminIdentity, lib/access).
// Used SOLELY to hide; never written or sent (rule 30). Routing already removes most
// against-admin reports from the primary's view — this catches the case where the accused
// is named in the text but the report was not flagged againstAdmin.
export const isRecusedFor = (report, identity) => {
  const accused =
    report && typeof report.accusedParty === "string"
      ? report.accusedParty.trim().toLowerCase()
      : "";
  if (!accused) return false;
  const local = emailLocalPart(identity && identity.adminEmail);
  if (local.length < 3) return false; // too short → would over-match
  // Whole-token match: split accusedParty on non-alphanumerics and compare tokens.
  const tokens = accused.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes(local);
};

// Secondary sort applied AFTER the priority float: oldest-first (smallest createdOn first)
// so the longest-waiting report surfaces at the top of each band — the busy compliance
// officer works the queue front-to-back and the most-overdue item is never buried. A
// missing createdOn sorts as 0 (oldest) so it is never hidden at the bottom.
const byOldestFirst = (a, b) =>
  (Number(a.createdOn) || 0) - (Number(b.createdOn) || 0);

// PRIORITY SORT (A-F5). Priority reports float to the TOP; within each band, oldest-first.
// Stable, total order — the renderer just lists what we hand it.
export const sortForQueue = (rows) =>
  [...rows].sort((a, b) => {
    const pa = isPriority(a) ? 0 : 1;
    const pb = isPriority(b) ? 0 : 1;
    if (pa !== pb) return pa - pb; // priority band first
    return byOldestFirst(a, b);
  });

// QUICK-FILTER (A-F5). Narrow an already role-filtered + recused list by the active filter.
//   ALL        → unchanged.
//   PRIORITY   → exactly the priority set (the shared isPriority predicate).
//   OPEN/U_R/ESC → exactly that status.
//   unknown/missing → ALL (defensive — never narrows to empty on a bad token).
export const applyQuickFilter = (rows, filter) => {
  if (filter === QUEUE_FILTER_KIND.PRIORITY) return rows.filter(isPriority);
  const status = FILTER_STATUS[filter];
  if (status) return rows.filter((r) => r.status === status);
  return rows; // ALL or unknown
};

// The full producer (A-F4 + A-F5). Pure: takes the gateway-loaded, projection-applied
// report set + the resolved viewing role/identity + the active quick-filter, and returns
// the identity-free QUEUE_REPORTS array — role-filtered, recused, priority-sorted, then
// quick-filtered. Empty/absent input → []. Order of operations is mandated by the spec:
// role filter + recusal FIRST (defines the admin's universe), THEN the quick-filter
// narrows within it, THEN sort floats priority to the top of the visible set.
export const buildQueueReports = ({
  reports,
  viewingRole,
  identity,
  filter,
} = {}) => {
  const rows = Array.isArray(reports) ? reports : [];
  const roleFiltered = rows.filter(
    (r) => roleSees(r, viewingRole) && !isRecusedFor(r, identity)
  );
  const projected = roleFiltered.map(toQueueRow);
  const filtered = applyQuickFilter(projected, filter);
  return sortForQueue(filtered);
};

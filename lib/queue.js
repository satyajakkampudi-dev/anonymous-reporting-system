// Shared report-queue data prep — the SINGLE source of truth for the identity-free,
// SERVER-PAGINATED list the admin queue renders (A-F3/A-F4/A-F5,
// MP-FIX-QUEUE-SERVER-PAGINATION). Pure lib/ module (mirrors lib/sla.js,
// lib/dashboard-stats.js): the role/quick-filter/priority logic that CAN be a Mongo
// query lives in buildQueueQuery; the one thing that can't (free-text recusal) stays an
// in-code page filter in projectQueueRows. It never touches framework state, a DB, or an
// app import, so it carries no circular-dependency risk (lib is the tree root).
//
// WHY SERVER-SIDE (the change from the old load-everything design): the framework caps
// loadCollectionWithQuery at limit 20 and has NO aggregation, so the queue used to load
// the FULL set and filter/sort/paginate in memory — which silently dropped every report
// past the cap once the collection grew. The fix moves role + quick-filter + the priority
// FLOAT into the Mongo query, and pages with skip/limit, so each page click is ONE bounded
// DB read. The priority float is expressed via the STORED priorityRank column (0 = priority,
// 1 = normal), written on every save by reportDoc.onSave (priorityRankFor) — it cannot be a
// computed sort because there is no aggregation. See lib/access.loadReportsForAdmin (the
// skip/limit-aware gateway) and lib/dashboard-stats (priorityRankFor / priorityQueryCriteria).
//
// ROUTING (rule 14): the role query keys on the report's authoritative `assignedTo` (the
// routing chokepoint stamps it at creation; escalate re-stamps SECONDARY_ADMIN). PRIMARY
// sees only PRIMARY-routed reports; SECONDARY sees everything (superset). The legacy
// fallback ($nin + againstAdmin) mirrors resolveTargetRoleFor exactly for any row whose
// assignedTo predates the stamp.
//
// RECUSAL (D9 / ER-A4): the PRIMARY mechanism is routing (an againstAdmin report is stamped
// assignedTo = SECONDARY_ADMIN at creation, so it never enters the PRIMARY's role query). The
// finer "about THIS specific admin" check (isRecusedFor) is a CONSERVATIVE free-text match of
// accusedParty against the viewing admin's own email local-part — it CANNOT be a clean query,
// so it stays an in-code filter applied to the fetched page (projectQueueRows). A page may
// therefore render fewer than LIST_PAGE_SIZE rows in the rare recusal case — accepted (D9, v1).
//
// ANONYMITY: operates only on the identity-free projected set (loadReportsForAdmin output)
// — reportId / status / severity / category / urgency / createdOn / assignedTo /
// againstAdmin / accusedParty only; NEVER a reporterId / contactMethod / contactValue.

import { ROLE } from "./constants";
import { STATUS } from "./ticket-status";
import { isPriority } from "./dashboard-stats";
import { resolveTargetRoleFor } from "./access";

// Re-export so consumers share the ONE predicate (no drift with the A-F2 dashboard count
// and the queue renderer's per-row priority badge).
export { isPriority };

// Quick-filter tokens — byte-identical to the admin app's QUEUE_FILTER values (kept here as
// local string constants so this pure lib has no app import). nav-queue passes the active
// QUEUE_FILTER token straight through; the values match by contract (rule 19 single-sourced
// on the emit side, asserted equal here).
export const QUEUE_FILTER_KIND = {
  ALL: "all",
  PRIORITY: "priority",
  OPEN: "open",
  UNDER_REVIEW: "under_review",
  ESCALATED: "escalated",
  RESOLVED: "resolved",
};

// Map a status quick-filter token to the STATUS it narrows to (ALL/PRIORITY handled
// separately — ALL adds nothing, PRIORITY queries the stored priorityRank).
const FILTER_STATUS = {
  [QUEUE_FILTER_KIND.OPEN]: STATUS.OPEN,
  [QUEUE_FILTER_KIND.UNDER_REVIEW]: STATUS.UNDER_REVIEW,
  [QUEUE_FILTER_KIND.ESCALATED]: STATUS.ESCALATED,
  [QUEUE_FILTER_KIND.RESOLVED]: STATUS.RESOLVED,
};

// ROLE → Mongo query clause (A-F4). PRIMARY sees only PRIMARY-routed reports; SECONDARY
// sees everything (no clause). The PRIMARY clause mirrors resolveTargetRoleFor: assignedTo
// is PRIMARY_ADMIN, OR (legacy) assignedTo is not a valid role token and the report is not
// flagged against an admin (so it defaults to PRIMARY). Returns null for "no restriction".
const roleQueryClause = (viewingRole) => {
  if (viewingRole === ROLE.SECONDARY_ADMIN) return null; // superset — sees all
  return {
    $or: [
      { assignedTo: ROLE.PRIMARY_ADMIN },
      {
        assignedTo: { $nin: [ROLE.PRIMARY_ADMIN, ROLE.SECONDARY_ADMIN] },
        againstAdmin: { $ne: true },
      },
    ],
  };
};

// Build the Mongo { query, sort } for one queue page (A-F4 role + A-F5 priority/quick-filter).
//   - role:   PRIMARY → PRIMARY-routed only; SECONDARY → unrestricted.
//   - filter: OPEN/UNDER_REVIEW/ESCALATED/RESOLVED → { status }; PRIORITY → { priorityRank: 0 }
//             (the stored float key — the SAME set isPriority defines); ALL → no narrowing.
//   - sort:   { priorityRank: 1, createdOn: -1 } — priority (0) floats above normal (1); newest
//             first within each band. After backfill no row is missing priorityRank, so the
//             ascending sort is total and correct.
// Recusal is NOT here (free-text, not a query) — projectQueueRows applies it to the page.
export const buildQueueQuery = ({ viewingRole, filter } = {}) => {
  const query = {};
  const role = roleQueryClause(viewingRole);
  if (role) Object.assign(query, role);

  if (filter === QUEUE_FILTER_KIND.PRIORITY) {
    query.priorityRank = 0;
  } else {
    const status = FILTER_STATUS[filter];
    if (status) query.status = status; // ALL / unknown → no status narrowing
  }

  return { query, sort: { priorityRank: 1, createdOn: -1 } };
};

// The local-part of an email ("jane.doe" from "jane.doe@line.com"), lower-cased + trimmed.
const emailLocalPart = (email) =>
  (typeof email === "string" ? email : "").trim().toLowerCase().split("@")[0] ||
  "";

// RECUSAL heuristic (A-F4 / D9). True if `report.accusedParty` (free text) plausibly names
// the viewing admin, so the report must be HIDDEN from them. CONSERVATIVE by design — a
// false hide is worse than a false show (we must never bury a legitimate report) — so we
// match only on a clear signal: the viewing admin's email local-part appearing as a whole
// token in the accusedParty text. We DO NOT fuzzy-match arbitrary substrings nor very short
// local-parts (< 3 chars) that would over-match. identity = { adminEmail } of the VIEWING
// admin (resolveAdminIdentity). Used SOLELY to hide; never written or sent (rule 30).
export const isRecusedFor = (report, identity) => {
  const accused =
    report && typeof report.accusedParty === "string"
      ? report.accusedParty.trim().toLowerCase()
      : "";
  if (!accused) return false;
  const local = emailLocalPart(identity && identity.adminEmail);
  if (local.length < 3) return false; // too short → would over-match
  const tokens = accused.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.includes(local);
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

// Final in-code step over a server-fetched, already role-filtered + quick-filtered +
// priority-sorted PAGE: drop any row recused for the viewing admin (free-text accusedParty,
// not a query), then project to the identity-free QUEUE_REPORTS shape. Order within the page
// is preserved (the DB sort is authoritative). Empty/absent input → [].
export const projectQueueRows = ({ reports, identity } = {}) => {
  const rows = Array.isArray(reports) ? reports : [];
  return rows.filter((r) => !isRecusedFor(r, identity)).map(toQueueRow);
};

// IN-MEMORY role + recusal filter for the FULL-set consumers that can't paginate — the
// dashboard aggregation (A-F2) and the in-app Alerts breach list (A-F19). They load the whole
// set for counting, so they filter the loaded rows here with the SAME routing rule
// (resolveTargetRoleFor, rule 14) + the SAME recusal predicate the queue uses, so every admin
// surface agrees on "what this admin can see" (REQUIREMENTS §3 / A-F4: dashboard + queue are
// role-filtered). PRIMARY → only PRIMARY-routed reports; SECONDARY → everything (superset);
// recused rows dropped. Pure: operates only on the passed rows + resolved role/identity.
export const roleVisibleReports = ({ reports, viewingRole, identity } = {}) => {
  const rows = Array.isArray(reports) ? reports : [];
  return rows.filter((r) => {
    if (isRecusedFor(r, identity)) return false;
    if (viewingRole === ROLE.SECONDARY_ADMIN) return true; // superset
    return resolveTargetRoleFor(r) === ROLE.PRIMARY_ADMIN;
  });
};

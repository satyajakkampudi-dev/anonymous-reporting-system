// Access control + anonymity enforcement — the CORE of the system's privacy
// guarantee. See ../REQUIREMENTS.md §3, ER-A2/A3/A4, D17 and ../specs/SPEC.md
// "adminProjection" + "Routing".
//
// Anonymity is enforced in TWO layers (defence-in-depth):
//   1. Binding layer — the admin bundle's reportDoc declares NO identity fields
//      (decision Q1; framework-mapping rule 30), so identity never binds admin-side.
//   2. Read layer (this module) — loadReportsForAdmin / loadReportForAdmin are the
//      SINGLE gateway every admin read goes through (ER-A3). Each call (a) passes a
//      best-effort MongoDB projection AND (b) ALWAYS runs every returned row through
//      the pure applyAdminProjection() so the identity fields are stripped IN CODE,
//      independent of whether the storage layer honoured the projection.
// No other admin code path may query `reports` directly.

import { D, state } from "@frontmltd/frontmjs/core/State";
import {
  ROLE,
  ADMIN_ROLE,
  SCOPE,
  adminRoleToRole,
  roleToAdminRole,
} from "./constants";
import { reportsCollection } from "./collections/reports";
import { adminUsersCollection } from "./collections/admin-users";

// ---------------------------------------------------------------------------
// adminProjection — the anonymity field policy
// ---------------------------------------------------------------------------

// Report fields the admin app may NEVER read: the reporter id, the reporter's
// optional contact channel, and the reporter-create audit identity (ER-A2).
// `createdBy`/`modifiedBy` are excluded wholesale — on the reporter-create path
// they would carry the reporter; admin actions are tracked via statusHistory.
export const ADMIN_EXCLUDED_FIELDS = [
  "reporterId",
  "contactMethod",
  "contactValue",
  "createdBy",
  "modifiedBy",
];

// MongoDB exclusion projection — the ONLY projection passed on admin reads.
// (A plain literal so it is import-time pure; createMongoDBProjectionExpression
// would need state.frontmlib which isn't available at module load.)
export const adminProjection = ADMIN_EXCLUDED_FIELDS.reduce((p, f) => {
  p[f] = 0;
  return p;
}, {});

// True if a field (by dbName) is part of the admin-visible set — i.e. NOT in the
// anonymity exclusion list. The SINGLE predicate behind both the read gateway and
// the reporter-facing "what the admin will see" guard (U-F5), so the guard can
// never drift from what the admin app actually reads (ER-A1, provably faithful).
export const isAdminVisibleField = (dbName) =>
  !ADMIN_EXCLUDED_FIELDS.includes(dbName);

// Pure, testable strip: returns a shallow copy of `row` with every excluded
// field removed. This is the GUARANTEED enforcement (verification surface:
// "adminProjection — identity fields absent").
export const applyAdminProjection = (row) => {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const field of ADMIN_EXCLUDED_FIELDS) {
    delete out[field];
  }
  return out;
};

// Normalise a loaded collection row / doc into a plain dbName-keyed object.
// Defensive across framework row shapes; if the live shape differs this is a
// /verify finding → /frontm-fix-task (never a silent edit).
const extractRowData = (row) => {
  if (!row || typeof row !== "object") return {};
  if (typeof row.getData === "function") {
    const d = row.getData();
    if (d && typeof d === "object") return d;
  }
  if (row.data && typeof row.data === "object") return row.data;
  return row;
};

// ---------------------------------------------------------------------------
// Single admin-read gateway (ER-A3)
// ---------------------------------------------------------------------------

// Load reports for the admin app. Returns an array of identity-free plain
// objects (already stripped). `query` is the role/recusal/priority filter the
// caller built; limit/sort optional. NEVER call loadCollectionWithQuery on
// `reports` directly from admin code — use this.
export const loadReportsForAdmin = async ({ query = {}, limit, sort } = {}) => {
  const opts = { query, projection: adminProjection };
  if (limit !== undefined) opts.limit = limit;
  if (sort !== undefined) opts.sort = sort;
  await reportsCollection.loadCollectionWithQuery(opts);
  const rows = reportsCollection.rows || [];
  return rows.map((r) => applyAdminProjection(extractRowData(r)));
};

// Load a single report for the admin app by reportId. Returns an identity-free
// plain object (stripped) or null. Role-gated, NOT owner-gated.
export const loadReportForAdmin = async ({ reportId } = {}) => {
  if (!reportId) return null;
  const rows = await loadReportsForAdmin({ query: { reportId }, limit: 1 });
  return rows[0] || null;
};

// ---------------------------------------------------------------------------
// Role resolution (against the seeded admin-users registry, D3)
// ---------------------------------------------------------------------------

// Load the calling user's admin-users row (or null). Identity here is the
// ADMIN's own identity — not a reporter's — so reading it is fine.
const loadCallerAdminRow = async () => {
  const userId = state.user?.userId;
  if (!userId) return null;
  await adminUsersCollection.loadCollectionWithQuery({
    query: { adminUserId: userId },
    limit: 1,
  });
  const rows = adminUsersCollection.rows || [];
  return rows.length ? extractRowData(rows[0]) : null;
};

// Resolve the caller's ROLE (PRIMARY_ADMIN | SECONDARY_ADMIN), or null if the
// caller is not in the admin registry.
export const resolveAdminRole = async () => {
  const row = await loadCallerAdminRow();
  if (!row || !row.role) return null;
  if (row.role === ADMIN_ROLE.PRIMARY || row.role === ADMIN_ROLE.SECONDARY) {
    return adminRoleToRole(row.role);
  }
  return null;
};

// True if the caller is any kind of admin (used by the access gate, A-F1).
export const isAdmin = async () => (await resolveAdminRole()) !== null;

// Ownership assertion (reporter side). Pure: report is a loaded plain object.
export const ownsReport = (report) =>
  !!report &&
  !!state.user?.userId &&
  report.reporterId === state.user.userId;

// ---------------------------------------------------------------------------
// Routing (D17) — the SINGLE chokepoint. No hardcoded role query anywhere else.
// ---------------------------------------------------------------------------

// The ROLE a report should be assigned to: againstAdmin → SECONDARY, else PRIMARY.
export const assignedRoleFor = (report) =>
  report && report.againstAdmin ? ROLE.SECONDARY_ADMIN : ROLE.PRIMARY_ADMIN;

// Resolve the admin-users who should receive a report (queue + notifications
// call this — never a hardcoded role query). v1: all GLOBAL-scope admins of the
// target role (central team). Returns identity-free-of-reporter admin rows
// { adminUserId, adminEmail, role, scope }. Future: filter by a report→scope
// mapping for fleet/region routing — additive, no schema/queue change.
export const resolveAssignees = async (report) => {
  const targetRole = assignedRoleFor(report);
  const adminRole = roleToAdminRole(targetRole);
  await adminUsersCollection.loadCollectionWithQuery({
    query: { role: adminRole, scope: SCOPE.GLOBAL },
  });
  const rows = (adminUsersCollection.rows || []).map(extractRowData);
  if (!rows.length) {
    D.log({
      message: "resolveAssignees found no GLOBAL admins for role",
      data: { targetRole, adminRole },
    });
  }
  return rows.map((r) => ({
    adminUserId: r.adminUserId,
    adminEmail: r.adminEmail,
    role: r.role,
    scope: r.scope,
  }));
};

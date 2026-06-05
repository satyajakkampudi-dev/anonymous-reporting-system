// Access control + anonymity enforcement helpers.
// See ../REQUIREMENTS.md §3, §7 and ../specs/SPEC.md "adminProjection".
// NOTE: skeleton placeholders — implemented during the foundation (B1) build.

// Resolves the calling user's admin role (or null if not an admin).
export const resolveAdminRole = () => null;

// True if the caller is any kind of admin.
export const isAdmin = () => false;

// True if the report belongs to the calling reporter (ownership assertion).
export const ownsReport = () => false;

// SINGLE routing chokepoint (D17). Returns the admin-users who should receive a
// report (queue + notifications call this — never a hardcoded role query).
// v1: all admins of the report's target role with scope GLOBAL (central team).
// Future: filter by a report→scope mapping for fleet/region-scoped routing —
// additive, no schema/queue change. Skeleton placeholder.
export const resolveAssignees = async () => [];

// The ONLY report field set the Admin app may read — excludes reporterId and all
// reporter contact fields. Every admin query/projection uses this.
export const adminProjection = {};

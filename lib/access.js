// Access control + anonymity enforcement helpers.
// See ../REQUIREMENTS.md §3, §7 and ../specs/SPEC.md "adminProjection".
// NOTE: skeleton placeholders — implemented during the foundation (B1) build.

// Resolves the calling user's admin role (or null if not an admin).
export const resolveAdminRole = () => null;

// True if the caller is any kind of admin.
export const isAdmin = () => false;

// True if the report belongs to the calling reporter (ownership assertion).
export const ownsReport = () => false;

// The ONLY report field set the Admin app may read — excludes reporterId and all
// reporter contact fields. Every admin query/projection uses this.
export const adminProjection = {};

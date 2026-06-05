// Shared "admin-users" collection — the seeded admin registry (decision D3).
// shared: true → MongoDB `admin_users_${systemId}` (suffix applied by the framework).
// Single source for: admin access gating, PRIMARY/SECONDARY role + routing (D17),
// conflict-of-interest recusal, on-call availability, and call ringing.
//
// SEEDED OUT-OF-BAND (D3): rows are provisioned before go-live; this module
// registers the Doc + Collection for READS (gating/routing/availability/ringing)
// and for the admin's own availability write (A-F20). Do NOT build a UI lookup
// field for it (field-spec — it is read in code via lib/access.js / lib/calling.js,
// never a reporter- or admin-facing LOOKUP control).
//
// Fields (../../specs/SPEC.md): adminUserId (PK), adminEmail, role (PRIMARY|SECONDARY),
// scope (default GLOBAL), availability (available|busy|unavailable), updatedOn.
// Field/Section definitions live in the admin app (only `availability` is writable).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { state } from "@frontmltd/frontmjs/core/State";

export const adminUserDoc = new Doc("adminUserDoc", state, {
  autoSave: true,
});

export const adminUsersCollection = new Collection("adminUsersCollection", {
  title: "Admin users",
  document: adminUserDoc,
  name: "admin_users", // → admin_users_${systemId}
  shared: true,
  state,
});

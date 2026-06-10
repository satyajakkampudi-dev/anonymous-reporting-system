// Shared "admin-users" collection - the seeded admin registry (decision D3).
// shared: true → MongoDB `admin_users_${systemId}` (suffix applied by the framework).
// Single source for: admin access gating, PRIMARY/SECONDARY role + routing (D17),
// conflict-of-interest recusal, on-call availability, and call ringing.
//
// SEEDED OUT-OF-BAND (D3): rows are provisioned before go-live; this module
// registers the Doc + Collection for READS (gating/routing/availability/ringing)
// and for the admin's own availability write (A-F20). Do NOT build a UI lookup
// field for it (field-spec - it is read in code via lib/access.js / lib/calling.js,
// never a reporter- or admin-facing LOOKUP control).
//
// Fields (../../specs/SPEC.md): adminUserId (PK), adminEmail, role (PRIMARY|SECONDARY),
// scope (default GLOBAL), availability (available|busy|unavailable), updatedOn.
// Field/Section schema is defined HERE in lib (rule 35) so EVERY app reading the shared
// collection registers it; the admin app re-exports these for its availability/on-call UI.

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { AVAILABILITY } from "../constants";

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

// FIELD SCHEMA - defined HERE in lib (NOT the admin app) so EVERY app that reads the shared
// admin_users collection registers the schema and can extract row values (framework-mapping
// rule 35). Without this, the user app loads rows but reads every value as undefined →
// resolveAssignees returns no usable adminUserId → MSG_NEW_REPORT is skipped → no admin
// notification and no auto-escalate arming. anonymous-admin re-exports these from its
// sections/admin-user.js for the availability writer / on-call UI.
//
// adminUserId/adminEmail/role/scope are seeded + read-only; `availability` is the ONLY
// admin-writable field (A-F20, caller's own row). The Section is structural (field-host;
// adminUserDoc is read-in-code, never rendered as a form).
export const adminUserSection = new Section("adminUserSection", {
  title: "On-call status",
  doc: adminUserDoc,
  columns: 1,
  collapsable: false,
  state,
});

export const adminUserIdField = new Field("adminUserIdField", {
  title: "Admin user ID",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.TEXT_FIELD,
  primaryKey: true,
  mandatory: false,
  hidden: true,
  dbName: "adminUserId",
  state,
});

// Seeded; used to invite to call meetings. Read-only - admin never edits.
export const adminEmailField = new Field("adminEmailField", {
  title: "Admin email",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "adminEmail",
  state,
});

// PRIMARY / SECONDARY. Seeded (D3). Read-only.
export const adminRoleField = new Field("adminRoleField", {
  title: "Role",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "role",
  state,
});

// Routing scope (D17); v1 GLOBAL. Seeded. Read-only.
export const adminScopeField = new Field("adminScopeField", {
  title: "Scope",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  hidden: true,
  readOnly: true,
  dbName: "scope",
  state,
});

// The ONLY admin-writable field here. available / busy / unavailable.
export const availabilityField = new Field("availabilityField", {
  title: "Availability",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  options: Object.values(AVAILABILITY), // available · busy · unavailable
  dbName: "availability",
  state,
});

export const adminUpdatedOnField = new Field("adminUpdatedOnField", {
  title: "Updated on",
  doc: adminUserDoc,
  section: adminUserSection,
  type: FormFieldTypes.NUMBER_FIELD,
  mandatory: false,
  hidden: true,
  dbName: "updatedOn",
  state,
});

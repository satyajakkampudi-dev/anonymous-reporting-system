// adminUserDoc — admin-users registry field schema (on-call availability, A-F20).
//
// The registry is SEEDED OUT-OF-BAND (D3). adminUserId/adminEmail/role/scope are
// read-only (seeded); `availability` is the ONLY admin-writable field, and only for
// the caller's own row (adminUserId === state.user.userId), enforced by setAvailability
// (A-F20, later task). Three mutually-exclusive states → a DROPDOWN driven by buttons,
// NEVER a SWITCH (rule 30 — SWITCH is boolean). Fields defined here so loadDocument
// ({ adminUserId }) hydrates the Doc; the On-call display card is A-DISPLAY-SHELL.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { AVAILABILITY } from "../../../lib/constants";
import { adminUserDoc } from "../docs/admin-user-doc";

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

// Seeded; used to invite to call meetings. Read-only — admin never edits.
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

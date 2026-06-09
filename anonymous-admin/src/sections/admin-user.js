// adminUserDoc — admin-users registry field schema (on-call availability, A-F20).
//
// The field/Section SCHEMA now lives in lib/collections/admin-users.js (framework-mapping
// rule 35) so BOTH apps that read the shared admin_users collection register it — the user
// app needs the schema for resolveAssignees to extract adminUserId/role/scope (without it,
// no assignee → no MSG_NEW_REPORT → no admin notify / no auto-escalate). This module simply
// RE-EXPORTS those refs so the admin-side importers (availability-writer, on-call display,
// the main.js/app-start side-effect imports) keep working unchanged.
//
// SEEDED OUT-OF-BAND (D3): adminUserId/adminEmail/role/scope are read-only; `availability`
// is the ONLY admin-writable field, and only for the caller's own row (A-F20).

export {
  adminUserSection,
  adminUserIdField,
  adminEmailField,
  adminRoleField,
  adminScopeField,
  availabilityField,
  adminUpdatedOnField,
} from "../../../lib/collections/admin-users";

// Aux Data Doc: adminUserDoc (admin-users registry) — on-call availability (A-F20).
//
// Shared Doc registered once in lib/collections/admin-users.js, re-exported here so
// src/sections/admin-user.js attaches the field schema to one local import. The
// registry is SEEDED OUT-OF-BAND (D3): role/scope/adminEmail are read-only; only the
// caller's own `availability` row is admin-writable. Loaded by adminUserId.

import {
  adminUserDoc,
  adminUsersCollection,
} from "../../../lib/collections/admin-users";

export { adminUserDoc, adminUsersCollection };

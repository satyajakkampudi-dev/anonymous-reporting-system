// Side-effect import + re-export of the SHARED reports Doc + Collection.
// The single definition lives in lib/collections/reports.js (registered once,
// consumed by both microapps - SPEC.md "Collection"). This module makes the shared
// instances available under the admin app's own collections/ folder so the rest of
// src/ imports from one local path, and ensures registration at bundle load.
//
// CRITICAL (rule 15): admin code NEVER queries `reports` through this collection
// directly - every admin read flows through lib/access.js loadReportsForAdmin /
// loadReportForAdmin, which apply { projection: adminProjection } (ER-A3). This
// re-export exists so the Doc's Fields can be bound (src/sections/) and the gateway
// has a registered collection to read; it is not a query surface.

import { reportDoc, reportsCollection } from "../../../lib/collections/reports";

export { reportDoc, reportsCollection };

// Side-effect import + re-export of the SHARED reports Doc + Collection.
// The single definition lives in lib/collections/reports.js (registered once,
// consumed by both microapps — SPEC.md "Collection"). This module simply makes
// the shared instances available under the app's own collections/ folder so the
// rest of src/ imports from one local path, and ensures registration at bundle
// load (framework-mapping rule 6: one file per concern).
//
// The user app attaches the FULL field set (incl. reporter-private identity
// fields) in src/sections/; the admin app attaches only the adminProjection set.

import { reportDoc, reportsCollection } from "../../../lib/collections/reports";

export { reportDoc, reportsCollection };

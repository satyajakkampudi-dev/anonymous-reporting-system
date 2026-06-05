// Data Doc + sub-entity Docs (constructors only — no event handlers; rule 6).
//
// adminReportDoc is the SHARED Data Doc (autoSave: true, audit: true) defined once
// in lib/collections/reports.js and re-exported here under the admin-local name so
// src/sections/ attach their Fields to a single local import. It binds ONLY the
// adminProjection field set + admin-entered fields — NEVER reporterId / contactMethod
// / contactValue / reporter-create audit (framework-mapping rule 30, C1, ER-A2).
// NEVER sendResponse()d (rule 4/8) — adminDisplayDoc (A-DISPLAY-SHELL) renders screens.
//
// amendmentDoc and statusHistoryDoc are the per-row schema Docs for the two embedded
// sub-collections (forCollection: true on adminReportDoc). They are app-local and
// READ-ONLY on the admin side (the reporter owns amendment appends, U-F13; the
// transition path owns statusHistory). docs/ import nothing but state + the shared
// Doc (AGENTS.md dependency tree: docs/ → nothing app-local).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, reportsCollection } from "../../../lib/collections/reports";

// Re-export the shared Doc + Collection under the admin-local names.
export { reportDoc as adminReportDoc, reportsCollection };

// Amendment sub-entity row schema — READ-ONLY on the admin side (no confirm/cancel,
// no add/edit/delete intent; rule 30). The reporter appends rows (U-F13).
export const amendmentDoc = new Doc("amendmentDoc", state, {});

// Status-timeline sub-entity row schema — written by the transition path only,
// display-only on the admin side.
export const statusHistoryDoc = new Doc("statusHistoryDoc", state, {});

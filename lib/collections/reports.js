// Shared "reports" collection — the single Doc + Collection definition consumed
// by BOTH microapps. shared: true → MongoDB `reports_${systemId}`; the framework
// applies the systemId suffix automatically. audit: true on the Doc tracks admin
// actions (NFR-3); the reporter-create audit identity is excluded from
// adminProjection (lib/access.js, ER-A2).
//
// One shared Doc, two views (decision Q1): both apps side-effect-import this
// module to register `reportDoc` + `reportsCollection` at bundle load. The user
// app attaches the FULL field set (incl. the reporter-private identity fields)
// in its src/sections/; the admin app attaches only the adminProjection field
// set and NEVER declares reporterId/contactMethod/contactValue (framework-mapping
// rule 30). Because each app bundles separately, identity fields simply do not
// exist on the Doc in the admin bundle — anonymity at the binding layer, with
// the projecting read gateway (lib/access.js) as the second layer.
//
// PK: reportId. Fields/Sections are defined per-app (U-SCAFFOLD / A-SCAFFOLD).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { state } from "@frontmltd/frontmjs/core/State";

// Data Doc: no title (display is handled by each app's Display Doc), autoSave for
// the reporter draft (U-F9) + the admin manage buffer (D-L3-2), audit for NFR-3.
export const reportDoc = new Doc("reportDoc", state, {
  autoSave: true,
  audit: true,
});

export const reportsCollection = new Collection("reportsCollection", {
  title: "Reports",
  document: reportDoc,
  name: "reports", // → reports_${systemId}
  shared: true,
  allowSearch: true,
  state,
});

// App entry logic for main.onResolution (CLAUDE.md "App Entry-Point Bootstrap").
//
// reportDoc is autoSave: true → the Context bootstrap is MANDATORY (rule 17). Missing
// it silently disables every autoSaveBuffer write: loadDocument values survive one
// Lambda invocation only and the next invocation upserts an empty doc.
//
// Order is non-negotiable:
//   1. Context.CreateAndInit("mainApp") FIRST — wipes the buffer, runs onInit, sets
//      state.currentTabId (the gate Field.setAutoSaveFieldValue checks).
//   2. THEN load the reporter's reports (My Reports list scope; data-loading table).
//   3. THEN render. SCAFFOLD: the submit form renders inline via reportDoc.sendResponse().
//      U-DISPLAY-SHELL replaces this with `tabBarHidden = true` + reportDisplayDoc
//      .sendResponse() (the Data Doc is never sent in the final architecture, rule 8) —
//      this is the one transitional render that lets the scaffold's form be verified.

import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc, reportsCollection } from "../collections/reports";
import { CONTEXT } from "../constants";

// Side-effect imports: register every Section + Field on reportDoc and the two
// embedded sub-collections so the form is fully populated before first render.
import "../sections/report-details";
import "../sections/contact";
import "../sections/evidence";
import "../sections/amendments";
import "../sections/status-history";

export const appStart = async () => {
  // 1. Context bootstrap — BEFORE any loadDocument / buffer write.
  await Context.CreateAndInit(CONTEXT.MAIN_APP, { state });

  // 2. Scope the My Reports list to the current reporter (own reports only).
  await reportsCollection.loadCollectionWithQuery({
    query: { reporterId: state.user?.userId },
  });

  // 3. Render. Scaffold: inline submit form (Display Doc arrives in U-DISPLAY-SHELL).
  reportDoc.sendResponse();
};

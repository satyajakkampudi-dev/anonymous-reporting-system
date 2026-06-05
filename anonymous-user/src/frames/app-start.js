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
//   3. THEN render the DISPLAY Doc (Two-Doc, rule 4/8): hide the tab bar, then
//      reportDisplayDoc.sendResponse(). reportDoc (the Data Doc) is NEVER sent — it
//      owns the Fields + persistence; reportDisplayDoc owns the CardsSet screens.

import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportsCollection } from "../collections/reports";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { CONTEXT } from "../constants";

// Side-effect imports: register every Section + Field on reportDoc and the two
// embedded sub-collections so the Data Doc is fully populated.
import "../sections/report-details";
import "../sections/contact";
import "../sections/evidence";
import "../sections/amendments";
import "../sections/status-history";

// Side-effect imports: register every Display Doc CardsSet section so the shell
// is laid out (grid rows 0–7) before sendResponse(). U-D-* tasks fill the cards.
import "../sections/display/home";
import "../sections/display/my-reports";
import "../sections/display/detail-header";
import "../sections/display/detail-content";
import "../sections/display/status-history";
import "../sections/display/detail-resolution";
import "../sections/display/amendments";
import "../sections/display/detail-actions";

export const appStart = async () => {
  // 1. Context bootstrap — BEFORE any loadDocument / buffer write.
  await Context.CreateAndInit(CONTEXT.MAIN_APP, { state });

  // 2. Scope the My Reports list to the current reporter (own reports only).
  await reportsCollection.loadCollectionWithQuery({
    query: { reporterId: state.user?.userId },
  });

  // 3. Render the Display Doc. Single-tab app → hide the (empty) tab bar first.
  reportDisplayDoc.tabBarHidden = true;
  reportDisplayDoc.sendResponse();
};

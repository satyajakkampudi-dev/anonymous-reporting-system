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
import { state, D } from "@frontmltd/frontmjs/core/State";
import { reportsCollection } from "../collections/reports";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { CONTEXT } from "../constants";
import { APP_ROLES, userHasRole } from "../../../lib/constants";
import { sendAccessRefusal } from "../sections/display/access-refusal";

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
  // 0. Access gate (U-F0a, framework-mapping rule 31) — Context B, BEFORE any
  //    bootstrap or read. Pure licence-role check: the reporter app requires the
  //    FrontM `quitelineenduser` role. No registry fallback (no reporter allow-list
  //    collection exists). On DENY: render the standalone refusal CardsSet and STOP —
  //    no Context.CreateAndInit, no reports load, no Display-Doc render (the deny path
  //    must not touch the autoSave buffer or the Display Doc, mirroring admin A-F1).
  D.warning({
    message: "U-F0a: reporter access gate decision",
    data: { client: state.client, roles: state.user && state.user.roles },
  });
  if (!userHasRole(state, APP_ROLES.END_USER)) {
    sendAccessRefusal();
    return;
  }

  // 1. Context bootstrap — BEFORE any loadDocument / buffer write.
  await Context.CreateAndInit(CONTEXT.MAIN_APP, { state });

  // 2. Scope the My Reports list to the current reporter (own reports only).
  await reportsCollection.loadCollectionWithQuery({
    query: { reporterId: state.user?.userId },
  });

  // 3. Render the Display Doc on the Home screen (not all 8 sections stacked).
  //    NOTE: do NOT set tabBarHidden = true. It leaves the conversation with no active
  //    tab, so the framework never sets state.currentTabId — and every subsequent
  //    invoke_intent nav (Context.Create(state.currentTabId)) then crashes with "Cannot
  //    set properties of undefined (setting 'currentTabId')". Sailors-cart keeps the tab
  //    bar visible for exactly this reason; leave it at the framework default.
  showScreen(SCREEN.HOME);
  reportDisplayDoc.sendResponse();
};

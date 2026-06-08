// Navigation intent: openMyReports — load the reporter's own reports.
//
// Independent intent (Context B): the collection graph is empty, so we MUST
// loadCollectionWithQuery before reading (rule 20). Scoped to the current reporter
// (reporterId === userId) — never another user's reports. SCAFFOLD: the list HTML
// card is U-D-myreports; here we load + emit a placeholder confirmation so the load
// path is verifiable.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportsCollection } from "../collections/reports";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { INTENT } from "../constants";

export const openMyReports = Intent.Create({
  intentId: INTENT.OPEN_MY_REPORTS,
  prompt: "Show my submitted reports",
  state,
});

openMyReports.onResolution = async () => {
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportsCollection.loadCollectionWithQuery({
    query: { reporterId: state.user?.userId },
  });
  // Two-Doc: render the My Reports list via the Display Doc.
  showScreen(SCREEN.MY_REPORTS);
  reportDisplayDoc.sendResponse();
};

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
import { INTENT } from "../constants";

export const openMyReports = Intent.Create({
  intentId: INTENT.OPEN_MY_REPORTS,
  prompt: "Show my submitted reports",
  state,
});

openMyReports.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  await reportsCollection.loadCollectionWithQuery({
    query: { reporterId: state.user?.userId },
  });
  const count = (reportsCollection.rows || []).length;
  `You have ${count} report(s). The list view is added in the display task.`.sendResponse();
};

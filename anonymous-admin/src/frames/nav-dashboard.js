// Navigation intent: openDashboard — the admin landing screen.
//
// Independent intent (Context B). Attaches to the existing context via Context.Create
// (preserves the autoSaveBuffer — rule 22; NO re-loadDocument). Loads the queue set
// through the anonymity gateway (rule 15). SCAFFOLD: placeholder render — the
// aggregation stat-cards are A-F2 and the Display Doc is A-DISPLAY-SHELL.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { loadReportsForAdmin } from "../../../lib/access";
import { INTENT } from "../constants";

export const openDashboard = Intent.Create({
  intentId: INTENT.OPEN_DASHBOARD,
  prompt: "Open the compliance dashboard",
  state,
});

openDashboard.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  const reports = await loadReportsForAdmin({});
  `Dashboard: ${reports.length} report(s) in scope. The stat cards are added in the display task.`.sendResponse();
};

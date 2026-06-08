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
import { buildDashboardStats } from "../../../lib/dashboard-stats";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { INTENT, STATE_KEYS } from "../constants";

export const openDashboard = Intent.Create({
  intentId: INTENT.OPEN_DASHBOARD,
  prompt: "Open the compliance dashboard",
  state,
});

openDashboard.onResolution = async () => {
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  const reports = await loadReportsForAdmin({});

  // A-F2: aggregate + small-cell suppress over the SAME gateway set and stash, so the
  // dashboard is correct on nav as well as first paint (app-start), via ONE shared pure
  // helper (no duplicated counting/suppression). The dashboard renderer reads
  // STATE_KEYS.DASHBOARD_STATS (rule 28, ER-A6).
  state.setField(STATE_KEYS.DASHBOARD_STATS, buildDashboardStats(reports));

  // Route to the Dashboard screen (dashboard + alerts/digest visible; all other
  // exclusive sections hidden) and render the Display Doc (rule 4/8). The DASHBOARD_STATS
  // stash above feeds the A-D-dashboard onResponse fired by this sendResponse.
  showScreen(SCREEN.DASHBOARD);
  adminDisplayDoc.sendResponse();
};

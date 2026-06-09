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
  // Stay in the SAME tab when this dispatch came from an already-open tab (framework-mapping
  // rule 37; mirrors the user app's nav-my-reports). The Alerts pagination prev/next re-opens
  // the dashboard via an invoke_intent click that carries the originating tabId — Context.Create
  // re-renders IN PLACE, whereas CreateAndInit always opens a NEW tab (per-click proliferation).
  // Fall back to a new tab only on a genuine cold open (no originating tab).
  const incomingTabId = state.messageFromUser?.tabId;
  if (incomingTabId) {
    await Context.Create(incomingTabId, { state });
  } else {
    await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  }

  // Alerts breach-list page (rule 36). The alerts prev/next control re-opens the dashboard
  // carrying { page }; a plain dashboard open carries none → page 0. Read by the alerts
  // onResponse to slice its breach list in-memory.
  const alertsPage =
    Number(state.messageFromUser?.payload?.page) >= 0
      ? Number(state.messageFromUser.payload.page)
      : 0;
  state.setField(STATE_KEYS.ALERTS_PAGE, alertsPage);

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

// Navigation intent: openDashboard — the admin landing screen.
//
// Independent intent (Context B). Attaches to the existing context via Context.Create
// (preserves the autoSaveBuffer — rule 22; NO re-loadDocument). Loads the queue set
// through the anonymity gateway (rule 15). SCAFFOLD: placeholder render — the
// aggregation stat-cards are A-F2 and the Display Doc is A-DISPLAY-SHELL.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import {
  loadReportsForAdmin,
  resolveAdminRole,
  resolveAdminIdentity,
} from "../../../lib/access";
import { buildDashboardStats } from "../../../lib/dashboard-stats";
import { roleVisibleReports } from "../../../lib/queue";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { userTab } from "../../../lib/constants";
import { CONTEXT, INTENT, STATE_KEYS } from "../constants";

export const openDashboard = Intent.Create({
  intentId: INTENT.OPEN_DASHBOARD,
  prompt: "Open the compliance dashboard",
  state,
});

openDashboard.onResolution = async () => {
  // Stable per-screen tab (rule 37): reuse the SAME contextId so the dashboard
  // re-renders IN PLACE on every Alerts pagination / re-nav click — no new tab.
  await Context.CreateAndInit(userTab(CONTEXT.MAIN_APP, state), { state });

  // Alerts breach-list page (rule 36). The alerts prev/next control re-opens the dashboard
  // carrying { page }; a plain dashboard open carries none → page 0. Read by the alerts
  // onResponse to slice its breach list in-memory.
  const alertsPage =
    Number(state.messageFromUser?.payload?.page) >= 0
      ? Number(state.messageFromUser.payload.page)
      : 0;
  state.setField(STATE_KEYS.ALERTS_PAGE, alertsPage);

  const reports = await loadReportsForAdmin({});

  // A-F2: ROLE-SCOPED dashboard (REQUIREMENTS §3 / A-F4 — dashboard + queue are role-filtered).
  // PRIMARY counts only PRIMARY-routed reports; SECONDARY counts everything (superset). Filter the
  // gateway set through the shared roleVisibleReports (same routing + recusal as the queue), then
  // aggregate. The dashboard renderer reads STATE_KEYS.DASHBOARD_STATS (rule 28, ER-A6).
  const viewingRole = await resolveAdminRole();
  const identity = await resolveAdminIdentity();
  const visible = roleVisibleReports({ reports, viewingRole, identity });
  state.setField(STATE_KEYS.DASHBOARD_STATS, buildDashboardStats(visible));
  // Stash the role-visible set for the Alerts breach renderer (sync — can't role-filter itself).
  state.setField(STATE_KEYS.ALERTS_REPORTS, visible);

  // Route to the Dashboard screen (dashboard + alerts/digest visible; all other
  // exclusive sections hidden) and render the Display Doc (rule 4/8). The DASHBOARD_STATS
  // stash above feeds the A-D-dashboard onResponse fired by this sendResponse.
  showScreen(SCREEN.DASHBOARD);
  adminDisplayDoc.sendResponse();
};

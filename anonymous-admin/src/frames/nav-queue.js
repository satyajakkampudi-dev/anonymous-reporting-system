// Navigation intent: openQueue — the report queue (role-filtered, A-F4/F5).
//
// Independent intent (Context B). Context.Create preserves the buffer (rule 22). Loads
// reports ONLY through the anonymity gateway (rule 15) — never a direct query. The
// role-filter + recusal (A-F4) and priority surfacing (A-F5) are applied to the loaded
// set in their own tasks; SCAFFOLD just loads + placeholder render.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { loadReportsForAdmin } from "../../../lib/access";
import { INTENT } from "../constants";

export const openQueue = Intent.Create({
  intentId: INTENT.OPEN_QUEUE,
  prompt: "Open the report queue",
  state,
});

openQueue.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  const reports = await loadReportsForAdmin({});
  `Queue: ${reports.length} report(s). The list view is added in the display task.`.sendResponse();
};

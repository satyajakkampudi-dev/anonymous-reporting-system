// Navigation intent: openManageReport — load one report for the manage detail view.
//
// Independent intent (Context B). The reportId arrives in the invoke_intent envelope
// ONE LEVEL DEEP under .payload (CLAUDE.md "Custom HTML Payloads") — never at the top
// level. Loads the report ONLY through the anonymity gateway (rule 15) —
// loadReportForAdmin applies { projection: adminProjection } and is role-gated, NOT
// owner-gated (admins manage any report). Stash the reportId for the manage cards +
// transition handlers (A-D-manage* / A-E-*). SCAFFOLD: placeholder render.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { loadReportForAdmin } from "../../../lib/access";
import { INTENT, STATE_KEYS } from "../constants";

export const openManageReport = Intent.Create({
  intentId: INTENT.OPEN_MANAGE_REPORT,
  prompt: "Open a report to manage",
  state,
});

openManageReport.onResolution = async () => {
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for openManageReport");
    return;
  }

  await Context.Create(state.currentTabId, { state });
  const report = await loadReportForAdmin({ reportId });
  if (!report) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // Stash for the manage cards + transition handlers (Context B → B).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  `Managing report ${reportId}. The manage view is added in the display task.`.sendResponse();
};

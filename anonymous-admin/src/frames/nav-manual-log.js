// Navigation intent: openManualLog — open the manual-log form (A-F13).
//
// Independent intent (Context B). Context.Create preserves the buffer (rule 22). The
// fresh-draft reset (new reportId, clear values), the source=MANUAL submit handler, and
// the form render are owned by A-E-manualLog; this scaffold only registers the
// navigation intent so the button has a target. NO contact fields exist on this Doc
// (rule 30, D-L3-5). SCAFFOLD: placeholder render (never sendResponse a Data Doc).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { INTENT } from "../constants";

export const openManualLog = Intent.Create({
  intentId: INTENT.OPEN_MANUAL_LOG,
  prompt: "Manually log a report",
  state,
});

openManualLog.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  "Manual log. The form + submit handler are added in the manual-log task.".sendResponse();
};

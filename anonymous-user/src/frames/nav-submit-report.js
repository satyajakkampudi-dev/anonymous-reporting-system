// Navigation intent: openSubmitReport — show the submission form.
//
// Independent intent (Context B). Attaches to the existing context via
// Context.Create (preserves the autoSaveBuffer — rule 22; NO re-loadDocument).
// SCAFFOLD: renders the Data Doc submit form inline. The fresh-draft reset and the
// Display Doc wiring are later tasks; for now the in-flight draft (autosaved) shows.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import { INTENT } from "../constants";

export const openSubmitReport = Intent.Create({
  intentId: INTENT.OPEN_SUBMIT_REPORT,
  prompt: "Submit an anonymous report",
  state,
});

openSubmitReport.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  reportDoc.sendResponse();
};

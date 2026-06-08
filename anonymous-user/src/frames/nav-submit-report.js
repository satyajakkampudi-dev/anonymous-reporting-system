// Navigation intent: openSubmitReport — show the submission form.
//
// Independent intent (Context B). Attaches to the existing context via
// Context.Create (preserves the autoSaveBuffer — rule 22; NO re-loadDocument).
// Renders the U-F5 anonymity guard immediately above the Data Doc submit form
// ("inline at the top", wireframes §2). The fresh-draft reset is a later task;
// for now the in-flight draft (autosaved) shows.
//
// U-F5: the guard is a STANDALONE CardsSet (it cannot live on reportDoc — Fields
// + CardsSet may not share a Doc). It is sent BEFORE reportDoc.sendResponse() so
// it stacks above the editable form. NOTE (verify on live runtime, /verify): two
// sequential sendResponse() in one resolution. If the runtime does not stack them
// above the form, the documented fallback is a two-step gate (guard card with a
// "Continue" button → a second intent that renders the form) — see U-F5 briefing.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import { sendSubmitGuard } from "../sections/display/submit-guard";
import { resetEvidenceSlots } from "./evidence-slots";
import { INTENT } from "../constants";

export const openSubmitReport = Intent.Create({
  intentId: INTENT.OPEN_SUBMIT_REPORT,
  prompt: "Submit an anonymous report",
  state,
});

openSubmitReport.onResolution = async () => {
  D.log({ message: "openSubmitReport: opening submit form" });
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  sendSubmitGuard(); // U-F5 — anonymity guard, above the form
  // Fresh form → only Evidence file 1 + "+ Add another file" visible (slots 2–5
  // hidden). Resets the persisted slot count BEFORE the form is rendered.
  resetEvidenceSlots();
  reportDoc.title = "Submit a report"; // tab title (Data-Doc form)
  reportDoc.sendResponse(); // editable submit form (Data Doc)
};

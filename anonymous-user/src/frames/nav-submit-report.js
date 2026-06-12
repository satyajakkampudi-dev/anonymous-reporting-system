// Navigation intent: openSubmitReport - show the submission form.
//
// Independent intent (Context B). Attaches to the existing context via
// Context.Create (preserves the autoSaveBuffer - rule 22; NO re-loadDocument).
// Renders the U-F5 anonymity guard immediately above the Data Doc submit form
// ("inline at the top", wireframes §2). Opens a FRESH form on every entry via
// the in-place reset below (MP-FIX-SUBMIT-FRESH-FORM).
//
// U-F5: the guard is a STANDALONE CardsSet (it cannot live on reportDoc - Fields
// + CardsSet may not share a Doc). It is sent BEFORE reportDoc.sendResponse() so
// it stacks above the editable form. NOTE (verify on live runtime, /verify): two
// sequential sendResponse() in one resolution. If the runtime does not stack them
// above the form, the documented fallback is a two-step gate (guard card with a
// "Continue" button → a second intent that renders the form) - see U-F5 briefing.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import { sendSubmitGuard } from "../sections/display/submit-guard";
import { resetEvidenceSlots } from "./evidence-slots";
import { userTab } from "../../../lib/constants";
import { CONTEXT, INTENT } from "../constants";

export const openSubmitReport = Intent.Create({
  intentId: INTENT.OPEN_SUBMIT_REPORT,
  prompt: "Submit an anonymous report",
  state,
});

openSubmitReport.onResolution = async () => {
  D.log({ message: "openSubmitReport: opening submit form" });
  await Context.CreateAndInit(userTab(CONTEXT.SUBMIT_REPORT, state), { state }); // stable submit tab (rule 37)

  // Fresh-form reset (MP-FIX-SUBMIT-FRESH-FORM; mirrors the admin manual-log
  // opener). A WARM Lambda still holds the previous report's field singletons
  // - docId and reportId included. Without this reset the form opens
  // pre-filled with the last report (evidence attachments too), and because
  // submit-report.js mints reportId only when ABSENT (double-submit
  // idempotency), submitting again silently OVERWRITES the previous report
  // row. Cold starts mask the bug. Order matters (rule 26): new docId FIRST
  // so the value-clear unsets target the new buffer path, THEN clear values.
  reportDoc.docId = state.getUniqueId();
  for (const field of reportDoc.fields) {
    field.value = null;
  }

  sendSubmitGuard(); // U-F5 - anonymity guard, above the form
  // Fresh form → only Evidence file 1 + "+ Add another file" visible (slots 2–5
  // hidden). Resets the persisted slot count BEFORE the form is rendered.
  resetEvidenceSlots();
  reportDoc.title = "Submit a report"; // tab title (Data-Doc form)
  reportDoc.sendResponse(); // editable submit form (Data Doc)
};

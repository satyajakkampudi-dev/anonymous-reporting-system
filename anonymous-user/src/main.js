import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";

// --- Shared lib (side-effect: registers the shared Docs + Collections) ---
import "../../lib/collections/reports";
import "../../lib/collections/call-queue";
import "../../lib/collections/admin-users";

// --- Data model: sections register every Field on reportDoc + the sub-collections ---
import "./sections/report-details";
import "./sections/contact";
import "./sections/evidence";
import "./sections/amendments";
import "./sections/status-history";
// Reject-reason capture popup section (U-F11) — registers rejectReasonInputField on
// the standalone rejectReasonDoc. Imported before the reject-resolution frame, which
// reads the field reference.
import "./sections/reject-reason";
// Call-queue field schema (U-F15) — attaches the identity-free fields to the shared
// callQueueDoc so the start-anonymous-call frame can save the RINGING entry. Imported
// before that frame, which reads the field references.
import "./sections/call-queue";
// Voicemail capture popup section (U-F16) — registers the audio FILE_FIELD on the
// transient voicemailDoc. Imported before the call-timeout frame, which reads it.
import "./sections/voicemail";

// --- Validation handlers (side-effect: wire reportDoc.onSave + evidence field
//     onValidation; needs the evidence Field exports above) ---
import "./frames/report-validation";

// --- Submit transforms (side-effect: wire reportDoc.onSubmit + the submit-button
//     label; U-F8. Needs the report-details / evidence / status-history Field
//     exports above) ---
import "./frames/submit-report";

// --- Evidence slot progressive disclosure (side-effect: bind
//     addEvidenceSlotButtons.onClick — "+ Add another file" reveals slots 2–5). ---
import "./frames/evidence-slots";

// --- Navigation intents (side-effect: register the intents) ---
import "./frames/nav-submit-report";
import "./frames/nav-my-reports";
import "./frames/nav-report-detail";

// --- Edit intents (side-effect: register the intent + its sub-entity onSubmit) ---
import "./frames/edit-add-amendment";

// --- Reporter transition intents (side-effect: register the intent) ---
import "./frames/accept-resolution";
import "./frames/reject-resolution";
import "./frames/withdraw-report";

// --- Anonymous call (side-effect: register the startAnonymousCall intent + export
//     the VideoCall instance; U-F15) ---
import "./frames/start-anonymous-call";
// 30s no-answer -> MISSED -> voicemail -> auto-create source=CALL report (U-F16).
// Registers the callTimeout intent + wires voicemailDoc.onSubmit; needs the voicemail
// section + report-details/evidence/status-history Field exports above.
import "./frames/call-timeout";
// Call end/abandon (U-F17) — status-conditional guarded transition handler
// (RINGING->ABANDONED, ACTIVE->ENDED; ER-C12). Registers the callEnd intent; needs the
// call-queue section Field exports above.
import "./frames/call-end";
// Meeting-lifecycle receivers (endMeeting / leaveUser) — the reporter app OWNS the Daily
// meeting, so the Loft backend fires these on THIS bot; they end the call + notify the
// answering admin to go available (MSG_CALL_ENDED). See the frame header.
import "./frames/contracts/call-lifecycle";

// --- Cross-app receivers (side-effect: register the inbound bot-to-bot intents).
//     Admin -> user contracts; each loads the report by id and notifies ONLY the
//     owning reporter (ownership filter — the anonymity linchpin). X4/X5/X6. ---
import "./frames/contracts/report-resolved";
import "./frames/contracts/report-status-changed";
import "./frames/contracts/report-closed";

import { appStart } from "./frames/app-start";

// Shell UI flags — mirror of BRD §8.1 (rule 23). The ONLY non-default row for
// anonymous-user is contextAware, REQUIRED because reportDoc is autoSave: true
// (draft autosave, U-F9). Read by the framework before first render.
state.onConfig = () => {
  state.contextAware = true;
};

export const main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "Anonymous Reporting — submit and track reports",
  state,
});

main.onResolution = appStart;

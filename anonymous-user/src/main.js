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

// --- Validation handlers (side-effect: wire reportDoc.onSave + evidence field
//     onValidation; needs the evidence Field exports above) ---
import "./frames/report-validation";

// --- Navigation intents (side-effect: register the intents) ---
import "./frames/nav-submit-report";
import "./frames/nav-my-reports";
import "./frames/nav-report-detail";

// --- Edit intents (side-effect: register the intent + its sub-entity onSubmit) ---
import "./frames/edit-add-amendment";

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

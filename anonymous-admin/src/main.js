import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";

// --- Shared lib (side-effect: registers the shared Docs + Collections) ---
import "../../lib/collections/reports";
import "../../lib/collections/call-queue";
import "../../lib/collections/admin-users";

// --- Data model: sections register every Field on adminReportDoc + the aux Docs ---
import "./sections/manual-log";
import "./sections/resolve-popup";
import "./sections/severity-popup";
import "./sections/transition-note-popup";
import "./sections/status-history";
import "./sections/amendments";
import "./sections/admin-user";
import "./sections/call-queue";

// --- Navigation intents (side-effect: register the intents) ---
import "./frames/nav-dashboard";
import "./frames/nav-queue";
import "./frames/nav-manage-report";
import "./frames/nav-manual-log";
import "./frames/nav-on-call";

// --- Manage-detail transition intents (side-effect: register the intents) ---
import "./frames/take-review";
import "./frames/resolve-report";

import { appStart } from "./frames/app-start";

// Shell UI flags — mirror of BRD §8.2 (rule 23). The ONLY non-default row for
// anonymous-admin is contextAware, REQUIRED because adminReportDoc is autoSave: true
// (manual-log draft + in-flight triage buffer, D-L3-2). Read by the framework before
// the first render.
state.onConfig = () => {
  state.contextAware = true;
};

export const main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "Anonymous Reporting — admin console",
  state,
});

// main.onResolution = access-gate-then-bootstrap ordering (rule 27). See app-start.js.
main.onResolution = appStart;

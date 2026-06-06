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
// setAvailability (A-F20): the admin toggles THEIR OWN on-call presence (3-state value,
// keyed by their own userId — only-own-row). Registers the SET_AVAILABILITY intent the
// On-call display card's Available/Busy/Unavailable buttons emit.
import "./frames/set-availability";
// answer-call (A-F21): the atomic claim — first admin to flip RINGING -> ACTIVE wins,
// joins the meeting, is marked busy (OQ-12), STOP_RINGs the other available admins (X7),
// and arms the inactivity backstop. Importing it registers the ANSWER_CALL intent the
// Incoming-call banner's Answer button emits AND exports the adminVideoCall instance the
// framework needs to route JOIN_MEETING.
import "./frames/answer-call";
// end-call (A-F22): registers END_CALL (admin hang-up: guarded ACTIVE -> ENDED + free the
// admin), CALL_INACTIVITY (the scheduled mid-call backstop, same guarded transition), and
// DISMISS_CALL (local dismiss only — never mutates the shared call-queue status).
import "./frames/end-call";
// auto-close is the +30d system job (A-F17) armed by resolve-report; importing it
// registers the AUTO_CLOSE_REPORT receiving intent so the scheduled message resolves.
import "./frames/auto-close";
// auto-escalate is the SLA system job (A-F16): OPEN -> ESCALATED if still unactioned.
// Importing it registers the AUTO_ESCALATE receiving intent so the scheduled message
// resolves. It is dormant until the X1 receiver (on MSG_NEW_REPORT) arms the timer.
import "./frames/auto-escalate";
// sla-digest is the SLA backstop digest job (A-F18): emails ALL admins an identity-free
// digest of OPEN>24h / ESCALATED>24h breaches (the SHARED lib/sla.js predicate, identical
// to the in-app A-D-alerts twin). Importing it registers the SLA_DIGEST receiving intent
// so the scheduled message resolves. Self-rearming; the FIRST arming is an ops/deploy step
// (see frames/sla-digest.js header).
import "./frames/sla-digest";
// manualLog owns adminReportDoc.onSubmit (the ONLY owner of that slot — the transition
// popups bind their own capture Docs). Importing it binds the submit handler so the
// manual-log form's "Log report" confirm fires it. nav-manual-log registers the
// openManualLog trigger intent.
import "./frames/manual-log";
// note-transition owns the SINGLE noteCaptureDoc.onSubmit (shared dispatcher); it MUST
// be imported so the slot binds. escalate-report registers its ESCALATED entry into that
// dispatcher's registry at module load. Import order is immaterial — registration happens
// at module load, dispatch at runtime, so both are loaded before any popup submits.
import "./frames/note-transition";
import "./frames/escalate-report";
import "./frames/close-rejected";
// overrideSeverity owns severityCaptureDoc.onSubmit DIRECTLY (single-owner capture Doc —
// no shared dispatcher). Importing it binds both the trigger intent and the submit slot.
import "./frames/override-severity";

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

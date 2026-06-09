// Shared screen-routing helper for the admin Display Doc (MP-FIX-ADMIN-NAV-DISPLAY-
// ROUTING — the admin mirror of the user-side MP-FIX-NAV-DISPLAY-ROUTING). Closes the
// SAME Two-Doc rule-8 gap: the read-screen nav intents (openDashboard / openQueue /
// openManageReport / openOnCall) were scaffold PLACEHOLDERS that sendResponse() a
// string instead of rendering adminDisplayDoc, so every admin read-screen + every A-F*
// stash (DASHBOARD_STATS, QUEUE_REPORTS, CURRENT_REPORT_EVIDENCE) never rendered. Only
// app-start rendered adminDisplayDoc — and with ALL sections stacked.
//
// adminDisplayDoc is the SINGLE Doc sent (rule 4/8); it owns every CardsSet display
// section. This helper sets the documented `section.hidden` property (Common Section
// Properties — frontm-ai-doc-field-section-collection-data-modeling-guide § "Common
// Section Properties": `hidden: false` default; controls section visibility) so that a
// single shared Display Doc shows ONE screen at a time, exclusively.
//
// SCREENS (the exclusive read-screens — each maps to a disjoint set of sections):
//   DASHBOARD → dashboard + alerts/digest (the landing screen's stat cards + the SLA /
//               notification-failure safety-net panel; alerts reads the SAME gateway
//               rows the dashboard does, so it belongs on the dashboard screen).
//   QUEUE     → report-queue.
//   MANAGE    → the report-detail screen: manage-header, manage-content,
//               manage-resolution, manage-actions, status-history, amendments.
//   ON_CALL   → on-call availability.
// MANUAL_LOG is intentionally NOT a screen here — openManualLog renders the Data Doc
// FORM (adminReportDoc.sendResponse(), A-E-manualLog), NOT the Display Doc, so it must
// never be routed through showScreen. nav-manual-log / manual-log are untouched.
//
// INCOMING-CALL is an OVERLAY, never part of the exclusive screen map. Its section
// SELF-GATES in its synchronous onResponse on callQueueDoc.status === RINGING (emits
// NOTHING otherwise — see sections/display/incoming-call/index.js), so it is safe to
// leave VISIBLE (hidden = false) on every screen: a ring shows over whatever screen the
// admin is on, and no banner ever appears when there is no live ringing call. showScreen
// therefore NEVER touches incomingCallDisplaySection.hidden. The X3 ring-trigger and X7
// stop-ring receivers (contracts/incoming-call.js, contracts/call-stop-ring.js) call
// adminDisplayDoc.sendResponse() WITHOUT a showScreen — by design: they only surface /
// dismiss the overlay against whatever screen is current, and because incoming-call is
// never hidden the banner renders (or clears) correctly on any screen.
//
// DEPENDENCY DIRECTION (no cycle — AGENTS.md tree): this frame IMPORTS the display
// Sections; the display Sections NEVER import this frame.

import { dashboardDisplaySection } from "../sections/display/dashboard";
import { reportQueueDisplaySection } from "../sections/display/report-queue";
import { manageHeaderDisplaySection } from "../sections/display/manage-header";
import { manageContentDisplaySection } from "../sections/display/manage-content";
import { manageResolutionDisplaySection } from "../sections/display/manage-resolution";
import { manageActionsDisplaySection } from "../sections/display/manage-actions";
import { statusHistoryDisplaySection } from "../sections/display/status-history";
import { amendmentsDisplaySection } from "../sections/display/amendments";
import { alertsDigestDisplaySection } from "../sections/display/alerts";
import { onCallDisplaySection } from "../sections/display/on-call";
import { accessRefusalSection } from "../sections/display/access-refusal";
import { adminDisplayDoc } from "../docs/admin-display-doc";

// Screen identifiers — SCREAMING_SNAKE_CASE constants (rule 19; no magic strings).
export const SCREEN = {
  DASHBOARD: "DASHBOARD",
  QUEUE: "QUEUE",
  MANAGE: "MANAGE",
  ON_CALL: "ON_CALL",
  // Access-refused wall (A-F1) — shown by the gate when the caller is not an admin.
  REFUSAL: "REFUSAL",
};

// Per-screen tab title (FrontM tab strip; set on the Display Doc before sendResponse —
// the sailors-cart pattern, e.g. dashboardDisplayDoc.title = "Dashboard").
const SCREEN_TITLES = {
  [SCREEN.DASHBOARD]: "Dashboard",
  [SCREEN.QUEUE]: "Report Queue",
  [SCREEN.MANAGE]: "Manage Report",
  [SCREEN.ON_CALL]: "On-call",
  [SCREEN.REFUSAL]: "Restricted",
};

// Every EXCLUSIVE display section showScreen governs (incoming-call is the OVERLAY and
// is deliberately absent — it self-gates and is never hidden by a screen change).
const EXCLUSIVE_SECTIONS = [
  dashboardDisplaySection,
  alertsDigestDisplaySection,
  reportQueueDisplaySection,
  manageHeaderDisplaySection,
  manageContentDisplaySection,
  manageResolutionDisplaySection,
  manageActionsDisplaySection,
  statusHistoryDisplaySection,
  amendmentsDisplaySection,
  onCallDisplaySection,
  accessRefusalSection,
];

// Screen → the sections visible on that screen. Every exclusive section NOT listed for
// the active screen is hidden.
const SCREEN_SECTIONS = {
  [SCREEN.DASHBOARD]: [dashboardDisplaySection, alertsDigestDisplaySection],
  [SCREEN.QUEUE]: [reportQueueDisplaySection],
  [SCREEN.MANAGE]: [
    manageHeaderDisplaySection,
    manageContentDisplaySection,
    manageResolutionDisplaySection,
    manageActionsDisplaySection,
    statusHistoryDisplaySection,
    amendmentsDisplaySection,
  ],
  [SCREEN.ON_CALL]: [onCallDisplaySection],
  [SCREEN.REFUSAL]: [accessRefusalSection],
};

// Pure visibility mutator: hide every exclusive section, then reveal the ones for the
// requested screen. No sendResponse here — the caller renders adminDisplayDoc after.
// incoming-call is never referenced, so its overlay visibility is preserved untouched.
export function showScreen(screen) {
  const visible = SCREEN_SECTIONS[screen] || [];
  for (const section of EXCLUSIVE_SECTIONS) {
    section.hidden = !visible.includes(section);
  }
  // Tab title for this screen (sailors-cart sets <displayDoc>.title before sendResponse).
  if (SCREEN_TITLES[screen]) {
    adminDisplayDoc.title = SCREEN_TITLES[screen];
  }
}

// Display-screen router for the single shared Display Doc (Two-Doc architecture,
// framework-mapping rule 4/8). reportDisplayDoc owns all 8 CardsSet display
// sections stacked in one grid; this helper toggles per-screen visibility via the
// documented `section.hidden` property (data-modeling guide § "Common Section
// Properties"). Pure function — NO sendResponse here; the nav frames call
// showScreen(...) then reportDisplayDoc.sendResponse() themselves.
//
// Dependency direction (AGENTS.md tree): display-nav.js → sections/display/*.
// The display Sections do NOT import this file — no circular import.

import { homeLandingSection } from "../sections/display/home";
import { myReportsListSection } from "../sections/display/my-reports";
import { detailHeaderSection } from "../sections/display/detail-header";
import { detailContentSection } from "../sections/display/detail-content";
import { statusHistoryDisplaySection } from "../sections/display/status-history";
import { detailResolutionSection } from "../sections/display/detail-resolution";
import { amendmentsDisplaySection } from "../sections/display/amendments";
import { detailActionsSection } from "../sections/display/detail-actions";
import { accessRefusalSection } from "../sections/display/access-refusal";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { D } from "@frontmltd/frontmjs/core/State";

// Screen identifiers — SCREAMING_SNAKE_CASE constants (rule 19).
export const SCREEN = {
  HOME: "HOME",
  MY_REPORTS: "MY_REPORTS",
  DETAIL: "DETAIL",
  // Access-refused wall (U-F0a) — shown by the gate on a missing quitelineenduser role.
  REFUSAL: "REFUSAL",
};

// Per-screen tab title (shown on the FrontM tab strip; set on the Display Doc before
// sendResponse — the sailors-cart pattern, e.g. dashboardDisplayDoc.title = "Dashboard").
const SCREEN_TITLES = {
  [SCREEN.HOME]: "Anonymous Reporting",
  [SCREEN.MY_REPORTS]: "My Reports",
  [SCREEN.DETAIL]: "Report",
  [SCREEN.REFUSAL]: "Restricted",
};

// All display sections, in grid order (incl. the access-refusal wall).
const ALL_DISPLAY_SECTIONS = [
  homeLandingSection,
  myReportsListSection,
  detailHeaderSection,
  detailContentSection,
  statusHistoryDisplaySection,
  detailResolutionSection,
  amendmentsDisplaySection,
  detailActionsSection,
  accessRefusalSection,
];

// Screen → the sections that are VISIBLE on that screen. Every other section is
// hidden = true.
const SCREEN_SECTIONS = {
  [SCREEN.HOME]: [homeLandingSection],
  [SCREEN.MY_REPORTS]: [myReportsListSection],
  [SCREEN.DETAIL]: [
    detailHeaderSection,
    detailContentSection,
    statusHistoryDisplaySection,
    detailResolutionSection,
    amendmentsDisplaySection,
    detailActionsSection,
  ],
  [SCREEN.REFUSAL]: [accessRefusalSection],
};

// Pure router: show only the requested screen's sections, hide the rest.
// Caller is responsible for the subsequent reportDisplayDoc.sendResponse().
export const showScreen = (screen) => {
  const visible = SCREEN_SECTIONS[screen];
  if (!visible) {
    D.log({
      message: "showScreen: unknown screen, defaulting to all-hidden",
      data: { screen },
    });
  }
  const visibleSet = new Set(visible || []);
  for (const section of ALL_DISPLAY_SECTIONS) {
    section.hidden = !visibleSet.has(section);
  }
  // Tab title for this screen (sailors-cart sets <displayDoc>.title before sendResponse).
  if (SCREEN_TITLES[screen]) {
    reportDisplayDoc.title = SCREEN_TITLES[screen];
  }
};

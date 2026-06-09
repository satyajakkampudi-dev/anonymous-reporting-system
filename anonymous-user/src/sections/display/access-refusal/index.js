// U-F0a — Access-refused screen (wireframes-anonymous-user §0; framework-mapping
// rule 31). The reporter mirror of the admin app's access-refusal.
//
// A user without the reporter licence (FrontM `quitelineenduser` role) must hit a
// clear, unambiguous wall — never a half-rendered Home screen, never a BLANK screen.
//
// ARCHITECTURE (CORRECTED, MP-FIX-ACCESS-REFUSAL-RENDER) — this is a SECTION on
// reportDisplayDoc rendered through showScreen(SCREEN.REFUSAL) + reportDisplayDoc
// .sendResponse(), exactly like Home / My Reports (and like sailors-cart's
// accessDeniedDisplayDoc.sendResponse()). It is NOT a standalone CardsSet sent on its
// own: a lone CardsSet sent before/without an active Display-Doc screen renders blank.
// The access gate (app-start.js) runs Context.CreateAndInit FIRST (so the tab /
// state.currentTabId exists), then on DENY shows this screen and returns before any
// data load.
//
// ANONYMITY / SAFETY: purely static copy — no field values, no report data, no
// network. onResponse is synchronous (the framework does NOT await it — CLAUDE.md
// "Render handlers are NOT awaited"); nothing async here, so it is safe on a cold
// start and a poor maritime link.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

// The refusal copy (wireframes §0). Static — the renderers only lay it out per
// platform. Kept here (not a magic string in the markup) so both renderers and any
// future copy review read from one place.
const REFUSAL = {
  title: "Restricted",
  body: "You don't have access to Anonymous Reporting yet.",
  redirect:
    "Add the Anonymous Reporting licence to your FrontM profile, then reopen this app.",
};

// Section on reportDisplayDoc (own grid row, distinct from the 8 content sections).
// Hidden on every screen except SCREEN.REFUSAL (display-nav showScreen toggles it).
export const accessRefusalSection = new Section("accessRefusalSection", {
  doc: reportDisplayDoc,
  grid: { row: 8, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const accessRefusalCardsSet = new CardsSet("accessRefusalCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

accessRefusalSection.cardsSet = accessRefusalCardsSet;

export const accessRefusalCard = new Card("accessRefusalCard", {
  type: CARD_TYPES.HTML,
  cardsSet: accessRefusalCardsSet,
  readOnly: true,
  content: '<div class="placeholder">[Access refused]</div>',
  state,
});

// Build the refusal content per platform on every render (synchronous — onResponse is
// not awaited). Static copy, so it is correct for any caller and needs no data.
accessRefusalSection.onResponse = () => {
  accessRefusalCard.content = renderForPlatform(REFUSAL, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

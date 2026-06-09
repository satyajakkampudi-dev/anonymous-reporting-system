// A-F1 — Access-refused screen (wireframes-anonymous-admin §0; framework-mapping rule 27).
//
// A non-admin must hit a clear, unambiguous wall — never a half-rendered console, never a
// BLANK screen.
//
// ARCHITECTURE (CORRECTED, MP-FIX-ACCESS-REFUSAL-RENDER) — this is a SECTION on
// adminDisplayDoc rendered through showScreen(SCREEN.REFUSAL) + adminDisplayDoc
// .sendResponse(), exactly like the Dashboard / Queue screens (and like sailors-cart's
// accessDeniedDisplayDoc.sendResponse()). It is NOT a standalone CardsSet sent on its own:
// a lone CardsSet sent before/without an active Display-Doc screen renders blank. The
// access gate (app-start.js) runs Context.CreateAndInit FIRST (so the tab /
// state.currentTabId exists), then on DENY shows this screen and returns before the
// gateway read.
//
// ANONYMITY / SAFETY: purely static copy — no field values, no report data, no network.
// onResponse is synchronous (the framework does NOT await it); nothing async here.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

// The refusal copy (wireframes §0). Static — the renderers only lay it out per platform.
const REFUSAL = {
  title: "Restricted",
  body: "This console is for the compliance team only.",
  redirect:
    "If you need to report misconduct, use the Anonymous Reporting app instead.",
};

// Section on adminDisplayDoc (own grid row, distinct from the exclusive content sections).
// Hidden on every screen except SCREEN.REFUSAL (display-nav showScreen toggles it).
export const accessRefusalSection = new Section("accessRefusalSection", {
  doc: adminDisplayDoc,
  grid: { row: 11, column: 0 },
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

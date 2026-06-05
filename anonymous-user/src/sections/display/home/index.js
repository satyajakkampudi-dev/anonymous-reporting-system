// Display section: Home / landing (schema id: homeLanding, row 0).
// Section + CardsSet + placeholder Card + grid (DISPLAY-SHELL); U-D-home fills
// the card content in onResponse with the trust banner + anonymity intro + three
// action buttons, dispatched per platform via renderForPlatform(web/mobile).
// readOnly: true so the card surface does not intercept the inline
// data-action="intent" button clicks (cards guide).
//
// Home is display_only and purely navigational — it reads NO reportDoc field
// values, so onResponse is always safe for a brand-new user with no data
// (U-D-home acceptance: "onResponse fires for every sendResponse() including
// new users with no data"). onResponse is synchronous (the framework does NOT
// await it — CLAUDE.md "Render handlers are NOT awaited"); nothing async here.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { INTENT } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const homeLandingSection = new Section("homeLandingSection", {
  doc: reportDisplayDoc,
  grid: { row: 0, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const homeLandingCardsSet = new CardsSet("homeLandingCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

homeLandingSection.cardsSet = homeLandingCardsSet;

export const homeLandingPlaceholderCard = new Card(
  "homeLandingPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: homeLandingCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Home / landing]</div>',
    state,
  }
);

// Build the card content on every render. The renderers stay free of app
// constants — index.js owns the navigation contract and passes the intent ids
// in. The string values are the public data-intent-id contract (constants.js).
homeLandingSection.onResponse = () => {
  const data = {
    intents: {
      submit: INTENT.OPEN_SUBMIT_REPORT,
      myReports: INTENT.OPEN_MY_REPORTS,
      call: INTENT.START_ANONYMOUS_CALL,
    },
  };

  homeLandingPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

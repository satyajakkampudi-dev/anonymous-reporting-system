// Display section: Home / landing (schema id: homeLanding, row 0).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-home replaces
// the placeholder content with the trust banner + three action buttons rendered
// via renderForPlatform(web/mobile). readOnly: true now because the card will
// host inline data-action="intent" buttons (cards guide — readOnly required so
// the card surface does not intercept button clicks).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

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

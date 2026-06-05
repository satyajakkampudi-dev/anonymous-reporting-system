// Display section: Report detail resolution (schema id: detailResolution, row 5).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-detailresolution
// replaces the placeholder with resolution text + resolved-on, shown ONLY when
// present (empty-state otherwise). Display-only → readOnly not required.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const detailResolutionSection = new Section("detailResolutionSection", {
  doc: reportDisplayDoc,
  grid: { row: 5, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailResolutionCardsSet = new CardsSet(
  "detailResolutionCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

detailResolutionSection.cardsSet = detailResolutionCardsSet;

export const detailResolutionPlaceholderCard = new Card(
  "detailResolutionPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailResolutionCardsSet,
    content: '<div class="placeholder">[Report detail resolution]</div>',
    state,
  }
);

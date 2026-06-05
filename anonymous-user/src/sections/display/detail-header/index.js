// Display section: Report detail header (schema id: detailHeader, row 2).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-detailheader
// replaces the placeholder with tracking id + status pill + severity/category/
// urgency/submitted date. Display-only (no buttons) → readOnly not required.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const detailHeaderSection = new Section("detailHeaderSection", {
  doc: reportDisplayDoc,
  grid: { row: 2, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailHeaderCardsSet = new CardsSet("detailHeaderCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailHeaderSection.cardsSet = detailHeaderCardsSet;

export const detailHeaderPlaceholderCard = new Card(
  "detailHeaderPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailHeaderCardsSet,
    content: '<div class="placeholder">[Report detail header]</div>',
    state,
  }
);

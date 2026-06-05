// Display section: Report detail content (schema id: detailContent, row 3).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-detailcontent
// replaces the placeholder with ship/location/incident-date/description/accused
// + evidence rendered as signed-URL download links (signed server-side BEFORE
// sendResponse, NOT in onResponse — S3 rule). Display-only → readOnly not required.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const detailContentSection = new Section("detailContentSection", {
  doc: reportDisplayDoc,
  grid: { row: 3, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailContentCardsSet = new CardsSet("detailContentCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailContentSection.cardsSet = detailContentCardsSet;

export const detailContentPlaceholderCard = new Card(
  "detailContentPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailContentCardsSet,
    content: '<div class="placeholder">[Report detail content]</div>',
    state,
  }
);

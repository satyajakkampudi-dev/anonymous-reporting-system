// Display section: Amendments table (schema id: amendments, row 6).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-amendments
// replaces the placeholder with an HTML table of amendment rows + a header
// "+ Add" (addAmendment) button (append-only — NO edit/delete, D16). readOnly:
// true now because the card hosts the inline +Add button.
//
// Distinct ids from the Data Doc's amendmentsSection (src/sections/amendments.js)
// — framework ids are global; the Data Doc owns the forCollection rows, this
// Display Doc section owns the CardsSet (framework-mapping rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const amendmentsDisplaySection = new Section(
  "amendmentsDisplaySection",
  {
    doc: reportDisplayDoc,
    grid: { row: 6, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const amendmentsDisplayCardsSet = new CardsSet(
  "amendmentsDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

amendmentsDisplaySection.cardsSet = amendmentsDisplayCardsSet;

export const amendmentsDisplayPlaceholderCard = new Card(
  "amendmentsDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: amendmentsDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Amendments table]</div>',
    state,
  }
);

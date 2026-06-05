// Display section: Amendments (schema id: amendments, row 7). A-D-amendments fills the
// card with a READ-ONLY table of amendment rows (note + optional signed-URL evidence) from
// the amendments sub-collection. The admin side is read-only — the reporter appends rows
// (U-F13); NO +Add / edit / delete here (rule 30). Shell only here. Pure display → readOnly
// omitted (no inline buttons).
//
// Distinct ids from the Data Doc's amendmentsSection (src/sections/amendments.js) — the Data
// Doc owns the forCollection rows; this Display Doc section owns the CardsSet (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const amendmentsDisplaySection = new Section(
  "amendmentsDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 7, column: 0 },
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
    content: '<div class="placeholder">[Amendments]</div>',
    state,
  }
);

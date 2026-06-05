// Display section: Status timeline (schema id: statusHistory, row 6). A-D-statushistory
// fills the card with the timeline rows (status label+tone from lib/ticket-status.js,
// changedOn, actorRole — NEVER an id — and optional note) read from the statusHistory
// sub-collection. Shell only here. Pure display, read-only → readOnly omitted.
//
// Distinct ids from the Data Doc's statusHistorySection (src/sections/status-history.js)
// — the Data Doc owns the forCollection rows; this Display Doc section owns the CardsSet
// (framework-mapping rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const statusHistoryDisplaySection = new Section(
  "statusHistoryDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 6, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const statusHistoryDisplayCardsSet = new CardsSet(
  "statusHistoryDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

statusHistoryDisplaySection.cardsSet = statusHistoryDisplayCardsSet;

export const statusHistoryDisplayPlaceholderCard = new Card(
  "statusHistoryDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: statusHistoryDisplayCardsSet,
    content: '<div class="placeholder">[Status timeline]</div>',
    state,
  }
);

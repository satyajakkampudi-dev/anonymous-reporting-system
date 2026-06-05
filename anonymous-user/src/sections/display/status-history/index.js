// Display section: Status timeline (schema id: statusHistory, row 4).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-statushistory
// replaces the placeholder with the timeline rows from the statusHistory
// sub-collection (status label+tone, changedOn, actorRole only — never an id,
// anonymity rule 16). Display-only → readOnly not required.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const statusHistorySection = new Section("statusHistoryDisplaySection", {
  doc: reportDisplayDoc,
  grid: { row: 4, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const statusHistoryCardsSet = new CardsSet(
  "statusHistoryDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

statusHistorySection.cardsSet = statusHistoryCardsSet;

export const statusHistoryPlaceholderCard = new Card(
  "statusHistoryDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: statusHistoryCardsSet,
    content: '<div class="placeholder">[Status timeline]</div>',
    state,
  }
);

// Display section: Report queue (schema id: reportQueue, row 1). A-F5 fills the card
// with the role-filtered, priority-sorted report list via renderForPlatform. Shell
// only here. readOnly: true — every row hosts an inline "Open" button
// (data-action="intent" data-intent-id="openManageReport"); recused reports never
// appear (A-F4). Distinct ids from any Data Doc section (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const reportQueueDisplaySection = new Section(
  "reportQueueDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 1, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const reportQueueDisplayCardsSet = new CardsSet(
  "reportQueueDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

reportQueueDisplaySection.cardsSet = reportQueueDisplayCardsSet;

export const reportQueueDisplayPlaceholderCard = new Card(
  "reportQueueDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: reportQueueDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Report queue]</div>',
    state,
  }
);

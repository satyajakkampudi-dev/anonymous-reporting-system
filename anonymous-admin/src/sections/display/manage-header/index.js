// Display section: Manage detail header (schema id: manageHeader, row 2). A-D-manageheader
// fills the card with tracking id, status pill, severity tone, assigned role, category,
// urgency, created date from the loaded adminReportDoc (gateway projection — NO identity).
// Shell only here. Pure display (no inline buttons) → readOnly omitted. Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const manageHeaderDisplaySection = new Section(
  "manageHeaderDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 2, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageHeaderDisplayCardsSet = new CardsSet(
  "manageHeaderDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageHeaderDisplaySection.cardsSet = manageHeaderDisplayCardsSet;

export const manageHeaderDisplayPlaceholderCard = new Card(
  "manageHeaderDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageHeaderDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail header]</div>',
    state,
  }
);

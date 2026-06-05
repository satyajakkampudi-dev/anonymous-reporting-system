// Display section: Manage detail actions (schema id: manageActions, row 5). A-D-manageactions
// fills the card with the status+role-gated action buttons (Take review / Override severity /
// Resolve / Escalate / Close as rejected / Export) — never rendering an illegal move
// (STATUS_META.allowedActionsByRole). Shell only here. readOnly: true — the card hosts the
// inline data-action="intent" action buttons. Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const manageActionsDisplaySection = new Section(
  "manageActionsDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 5, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageActionsDisplayCardsSet = new CardsSet(
  "manageActionsDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageActionsDisplaySection.cardsSet = manageActionsDisplayCardsSet;

export const manageActionsDisplayPlaceholderCard = new Card(
  "manageActionsDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageActionsDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Manage detail actions]</div>',
    state,
  }
);

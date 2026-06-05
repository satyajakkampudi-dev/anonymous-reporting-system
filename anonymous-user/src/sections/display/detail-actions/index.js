// Display section: Report detail actions (schema id: detailActions, row 7).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-detailactions
// replaces the placeholder with status-gated buttons (Amend / Withdraw / Accept /
// Reject) via STATUS_META.allowedActionsByRole. readOnly: true now because the
// card hosts inline data-action="intent" buttons.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const detailActionsSection = new Section("detailActionsSection", {
  doc: reportDisplayDoc,
  grid: { row: 7, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailActionsCardsSet = new CardsSet("detailActionsCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailActionsSection.cardsSet = detailActionsCardsSet;

export const detailActionsPlaceholderCard = new Card(
  "detailActionsPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailActionsCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Report detail actions]</div>',
    state,
  }
);

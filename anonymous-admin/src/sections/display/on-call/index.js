// Display section: On-call status (schema id: onCall, row 9). A-F20 fills the card with the
// current availability pill + the three mutually-exclusive state buttons (Available / Busy /
// Unavailable) via renderForPlatform; the availability VALUE is read from adminUserDoc in the
// content task, but the SECTION lives here on the only Doc sendResponse()d (rule 4/8). Shell
// only here. readOnly: true — the card hosts the inline data-action="intent" buttons
// (data-payload {availability}). Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const onCallDisplaySection = new Section("onCallDisplaySection", {
  doc: adminDisplayDoc,
  grid: { row: 9, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const onCallDisplayCardsSet = new CardsSet("onCallDisplayCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

onCallDisplaySection.cardsSet = onCallDisplayCardsSet;

export const onCallDisplayPlaceholderCard = new Card(
  "onCallDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: onCallDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[On-call status]</div>',
    state,
  }
);

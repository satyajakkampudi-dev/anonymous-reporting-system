// Display section: Manage detail resolution (schema id: manageResolution, row 4).
// A-D-manageresolution fills the card with resolution text + resolved-on (shown when
// present) and the reporter-written reject reason (read-only here). Shell only here.
// Pure display → readOnly omitted. Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const manageResolutionDisplaySection = new Section(
  "manageResolutionDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 4, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageResolutionDisplayCardsSet = new CardsSet(
  "manageResolutionDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageResolutionDisplaySection.cardsSet = manageResolutionDisplayCardsSet;

export const manageResolutionDisplayPlaceholderCard = new Card(
  "manageResolutionDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageResolutionDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail resolution]</div>',
    state,
  }
);

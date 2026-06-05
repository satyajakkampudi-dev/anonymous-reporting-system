// Display section: Manage detail content (schema id: manageContent, row 3). A-D-managecontent
// fills the card with ship/location/incident-date/description/accused/against-admin and the
// EVIDENCE signed-URL links (built server-side BEFORE sendResponse — A-F7; never the raw S3
// key, never signed inside onResponse). Shell only here. Pure display → readOnly omitted.
// NO reporter-identity element (C1). Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const manageContentDisplaySection = new Section(
  "manageContentDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 3, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageContentDisplayCardsSet = new CardsSet(
  "manageContentDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageContentDisplaySection.cardsSet = manageContentDisplayCardsSet;

export const manageContentDisplayPlaceholderCard = new Card(
  "manageContentDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageContentDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail content]</div>',
    state,
  }
);

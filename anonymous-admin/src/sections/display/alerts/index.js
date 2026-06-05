// Display section: Alerts / Digest (schema id: alertsDigest, row 8). A-F19 fills the card
// with the SLA-breach list + notification-failure fallback banner (the in-app safety net,
// ER-D15) via renderForPlatform. Shell only here. readOnly: true — each breach row hosts an
// inline "Open" button (data-action="intent" data-intent-id="openManageReport"). Distinct
// ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const alertsDigestDisplaySection = new Section(
  "alertsDigestDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 8, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const alertsDigestDisplayCardsSet = new CardsSet(
  "alertsDigestDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

alertsDigestDisplaySection.cardsSet = alertsDigestDisplayCardsSet;

export const alertsDigestDisplayPlaceholderCard = new Card(
  "alertsDigestDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: alertsDigestDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Alerts / Digest]</div>',
    state,
  }
);

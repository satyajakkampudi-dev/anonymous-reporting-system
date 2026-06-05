// Display section: Dashboard (schema id: dashboard, row 0). A-F2 fills the card
// with the status/severity/age/priority stat cards (small-cell suppressed, no Atlas
// Charts — D4) via renderForPlatform in its content task. Shell only here: Section +
// CardsSet + placeholder Card + grid. readOnly: true — the priority card and the
// per-ship cells host inline data-action="intent" clicks (→ openQueue with a filter).
//
// Distinct ids from any Data Doc section — framework ids are global; this Display Doc
// section owns only the CardsSet (framework-mapping rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const dashboardDisplaySection = new Section("dashboardDisplaySection", {
  doc: adminDisplayDoc,
  grid: { row: 0, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const dashboardDisplayCardsSet = new CardsSet(
  "dashboardDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

dashboardDisplaySection.cardsSet = dashboardDisplayCardsSet;

export const dashboardDisplayPlaceholderCard = new Card(
  "dashboardDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: dashboardDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Dashboard]</div>',
    state,
  }
);

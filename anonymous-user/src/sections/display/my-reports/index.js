// Display section: My Reports list (schema id: myReportsList, row 1).
// Shell only — Section + CardsSet + placeholder Card + grid. U-D-myreports
// replaces the placeholder with the reporter-scoped report list (reportsCollection
// rows loaded in app-start). readOnly: true now because each row hosts an inline
// Open (openReportDetail) button.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";

export const myReportsListSection = new Section("myReportsListSection", {
  doc: reportDisplayDoc,
  grid: { row: 1, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const myReportsListCardsSet = new CardsSet("myReportsListCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

myReportsListSection.cardsSet = myReportsListCardsSet;

export const myReportsListPlaceholderCard = new Card(
  "myReportsListPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: myReportsListCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[My Reports list]</div>',
    state,
  }
);

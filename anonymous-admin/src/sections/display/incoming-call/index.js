// Display section: Incoming call (schema id: incomingCall, row 10). A-F21/F22 fill the card
// with the generic ring banner ("Incoming anonymous call" — NO caller name/id/email, ER-A5)
// + Answer / Dismiss buttons; the call VALUES come from callQueueDoc in the content task, but
// the SECTION lives here on the only Doc sendResponse()d (rule 4/8). Shell only here.
// readOnly: true — the card hosts the inline data-action="intent" buttons (data-payload
// {callRef, meetingId}). Distinct ids (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";

export const incomingCallDisplaySection = new Section(
  "incomingCallDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 10, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const incomingCallDisplayCardsSet = new CardsSet(
  "incomingCallDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

incomingCallDisplaySection.cardsSet = incomingCallDisplayCardsSet;

export const incomingCallDisplayPlaceholderCard = new Card(
  "incomingCallDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: incomingCallDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Incoming call]</div>',
    state,
  }
);

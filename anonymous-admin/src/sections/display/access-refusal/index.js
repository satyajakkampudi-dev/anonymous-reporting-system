// A-F1 — Access-refused guard card (wireframes-anonymous-admin §0; access_gate
// on_deny; framework-mapping rule 27).
//
// A non-admin must hit a clear, unambiguous wall — never a half-rendered console.
// This is the surface the access gate (app-start.js) sends on DENY, BEFORE any
// bootstrap or gateway read.
//
// ARCHITECTURE — STANDALONE CardsSet, NOT an adminDisplayDoc section (access_gate:
// "not a display section"). Two reasons it cannot live on adminDisplayDoc:
//   1. Sending adminDisplayDoc is the ALLOW-path render; the gate must show the
//      refusal WITHOUT touching the Display Doc, its onResponse stashes, or the
//      Context bootstrap (rule 27 — no Context.CreateAndInit on deny).
//   2. It imports nothing doc-related, so loading this module pulls in no Data-Doc
//      graph — mirrors the user app's submit-guard standalone CardsSet
//      (docs/frontm-ai-cards-cardsets-comprehensive-guide.md §"Standalone CardsSets").
//
// ANONYMITY / SAFETY: purely static copy — no field values, no report data, no
// network. Safe on a cold start and a poor maritime link (no async work); the card
// is sent synchronously after content is set.

import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

// The refusal copy (wireframes §0). Static — the renderers only lay it out per
// platform. Kept here (not a magic string in the markup) so both renderers and any
// future copy review read from one place, mirroring submit-guard's GUIDANCE const.
const REFUSAL = {
  title: "Restricted",
  body: "This console is for the compliance team only.",
  redirect:
    "If you need to report misconduct, use the Anonymous Reporting app instead.",
};

// Standalone refusal CardsSet + Card (CARD_TYPES.HTML). readOnly — informational,
// no action buttons (the wall is intentional; there is nowhere to navigate to).
export const accessRefusalCardsSet = new CardsSet("accessRefusalCardsSet", {
  type: CARD_TYPES.HTML,
  readOnly: true,
  state,
});

export const accessRefusalCard = new Card("accessRefusalCard", {
  type: CARD_TYPES.HTML,
  cardsSet: accessRefusalCardsSet,
  readOnly: true,
  content: '<div class="placeholder">[Access refused]</div>',
  state,
});

// Render the refusal per platform and send it as a standalone response. Called by
// the access gate (app-start.js) on DENY, then `return` — no bootstrap, no read.
export const sendAccessRefusal = () => {
  accessRefusalCard.content = renderForPlatform(REFUSAL, {
    web: renderWeb,
    mobile: renderMobile,
  });
  accessRefusalCardsSet.sendResponse();
};

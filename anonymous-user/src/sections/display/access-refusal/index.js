// U-F0a — Access-refused guard card (wireframes-anonymous-user §0; framework-mapping
// rule 31). The reporter mirror of the admin app's access-refusal trio.
//
// A user without the reporter licence (FrontM `quitelineenduser` role) must hit a
// clear, unambiguous wall — never a half-rendered Home screen. This is the surface
// the access gate (app-start.js) sends on DENY, BEFORE any Context bootstrap or
// reports load.
//
// ARCHITECTURE — STANDALONE CardsSet, NOT a reportDisplayDoc section. The gate must
// show the refusal WITHOUT touching the Display Doc, its onResponse stashes, or the
// Context bootstrap (rule 31 — no Context.CreateAndInit on deny). Importing this
// module pulls in no Data-Doc graph — mirrors the submit-guard standalone CardsSet
// (docs/frontm-ai-cards-cardsets-comprehensive-guide.md §"Standalone CardsSets").
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
  body: "You don't have access to Anonymous Reporting yet.",
  redirect:
    "Add the Anonymous Reporting licence to your FrontM profile, then reopen this app.",
};

// Standalone refusal CardsSet + Card (CARD_TYPES.HTML). readOnly — informational,
// no action buttons (the wall is intentional; the licence is redeemed in the FrontM
// profile, not in this app).
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

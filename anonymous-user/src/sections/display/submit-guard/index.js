// U-F5 - Pre-submit anonymity guard (schema frame U-F5; wireframes §2; ER-A1).
//
// Shows, BEFORE/above the submit form, a warning + a "what the compliance team
// will / will never see" preview, plus guidance to avoid self-identifying detail
// (small crews can be de-anonymised even with identity keys stripped - ER-A1).
// Read-only; no writes, no mutation.
//
// ARCHITECTURE NOTE - this is a STANDALONE CardsSet, NOT a reportDisplayDoc
// section. The submit form is the Data Doc rendered directly (framework-mapping
// §"the editable submit form is the one exception"), and Fields + CardsSet may
// NOT live on the same Doc (framework-mapping rule, "❌ Fields + CardsSet on the
// same Doc"). So the guard cannot be an HTML card ON reportDoc. Instead it is a
// standalone CardsSet (docs/frontm-ai-cards-cardsets-comprehensive-guide.md
// §"Standalone CardsSets") that nav-submit-report sends immediately before
// reportDoc.sendResponse() - realising the wireframe's "inline at the top".
//
// PROVABLY FAITHFUL: the visible/never-shared partition is derived from
// lib/access.js isAdminVisibleField - the SAME exclusion list the admin read
// gateway (loadReportsForAdmin) applies. A private field can never accidentally
// appear in the "visible" column.
//
// EMPTY-SAFE: the preview is a static field-SET list (field names), not a value
// echo, so it renders correctly for a brand-new reporter with no data and needs
// no async work (no network - safe on a poor maritime link).

import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { isAdminVisibleField } from "../../../../../lib/access";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

// Reporter-facing field descriptors { dbName, label }. dbName MUST match the
// Field dbNames (src/sections/*.js) and the lib/access exclusion list - the
// partition below is what makes the guard faithful. Evidence files collapse to a
// single row (evidenceFile1 is representative; all evidenceFile* are visible).
const GUARD_FIELDS = [
  { dbName: "category", label: "Category" },
  { dbName: "urgency", label: "Urgency" },
  { dbName: "shipName", label: "Ship name" },
  { dbName: "location", label: "Location" },
  { dbName: "incidentDate", label: "Incident date" },
  { dbName: "againstAdmin", label: "Whether it concerns a compliance member" },
  { dbName: "description", label: "Description" },
  { dbName: "accusedParty", label: "Accused party" },
  { dbName: "evidenceFile1", label: "Evidence files" },
  { dbName: "evidenceNotes", label: "Evidence notes" },
  // Reporter-private - these partition into "never shared" via isAdminVisibleField.
  { dbName: "reporterId", label: "Your identity (account)" },
  { dbName: "contactMethod", label: "Contact method" },
  { dbName: "contactValue", label: "Contact details" },
];

const GUIDANCE =
  "Avoid naming yourself, your role or watch, or unique details only you would " +
  "know - on a small crew, even an anonymised report can point back to you.";

// Partition the descriptors using the SINGLE admin-visibility predicate.
const buildGuardData = () => {
  const visible = [];
  const neverShared = [];
  for (const f of GUARD_FIELDS) {
    (isAdminVisibleField(f.dbName) ? visible : neverShared).push(f.label);
  }
  return { visible, neverShared, guidance: GUIDANCE };
};

// Standalone guard CardsSet + Card (CARD_TYPES.HTML). readOnly - purely
// informational, no action buttons.
export const submitGuardCardsSet = new CardsSet("submitGuardCardsSet", {
  type: CARD_TYPES.HTML,
  readOnly: true,
  state,
});

export const submitGuardCard = new Card("submitGuardCard", {
  type: CARD_TYPES.HTML,
  cardsSet: submitGuardCardsSet,
  readOnly: true,
  content: '<div class="placeholder">[Anonymity guard]</div>',
  state,
});

// Render the guard content per platform and send it as a standalone response.
// Called by nav-submit-report (form open) immediately BEFORE reportDoc.sendResponse(),
// and re-usable by the later U-F8 submit-confirm ("again at submit", wireframe §2).
export const sendSubmitGuard = () => {
  submitGuardCard.content = renderForPlatform(buildGuardData(), {
    web: renderWeb,
    mobile: renderMobile,
  });
  submitGuardCardsSet.sendResponse();
};

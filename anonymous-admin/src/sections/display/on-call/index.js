// Display section: On-call status (availability) (schema id: onCall, row 9). A-D-oncall
// fills the card with the caller's current presence pill + the three mutually-exclusive
// state buttons (Available / Busy / Unavailable) via renderForPlatform (wireframe §6).
// The CardsSet + placeholder Card were built in A-DISPLAY-SHELL — content only here.
// readOnly: true (on the shell card) — the card hosts the inline data-action="intent"
// buttons (data-payload {availability}), so the card surface must not swallow the click.
// Distinct framework ids from any Data Doc section (ids are global — rule 7).
//
// DATA SOURCE. Unlike the queue / dashboard / timeline sections (which read the
// gateway-loaded reportsCollection), the On-call card's value comes from the CALLER'S OWN
// admin-users row — adminUserDoc — NOT from `reports` (schema line 248: "custom_card on
// adminUserDoc"; wireframe §6). The openOnCall nav frame (Context B) has already run
// `adminUserDoc.loadDocument({ adminUserId: state.user.userId })` in the SAME invocation,
// so by the time adminDisplayDoc.sendResponse() fires this synchronous onResponse the
// caller's availability is hydrated on the Doc. onResponse is a Context-A render handler
// called SYNCHRONOUSLY (CLAUDE.md "Render handlers are NOT awaited") — it cannot await a
// load, so it only READS the already-loaded value. The section lives on adminDisplayDoc
// (the only Doc sendResponse()d, rule 4/8), so `self` here is NOT adminUserDoc; the
// cross-doc read therefore goes through the module-imported adminUserDoc singleton — the
// same module-import read pattern the status-history / alerts sections use for
// reportsCollection (there is no `self` path from a Display-Doc section to an aux Doc).
//
// ANONYMITY (rule 30 / C1): the only identity touched here is the CALLER'S OWN (their own
// adminUserId), which is theirs to read — never a reporter's (ER-A2/A3). The card binds
// NO reporter-identity field and NEVER queries `reports`. Only the 3-state `availability`
// enum is rendered; adminEmail / role / scope are not surfaced. The value is a closed
// enum (not free text), so no sanitisation is needed beyond the enum allow-list below;
// the renderers still escape every interpolated value at the boundary (rule 10).
//
// EMPTY-SAFE + SCREEN-SCOPED. onResponse fires for EVERY adminDisplayDoc.sendResponse(),
// not just the On-call screen. The card's data (adminUserDoc) is loaded ONLY by the
// openOnCall nav frame — so this section is scoped to that screen exactly as the status-
// timeline section is scoped to an open report. We therefore gate on whether the caller's
// own row is actually loaded (its primary key adminUserId is present): not loaded
// (Dashboard / Queue / a report detail) → hasUser:false → the renderers emit NOTHING, so
// the on-call controls never appear — and never show a misleading "Not set" — outside the
// On-call screen. Loaded but availability not yet chosen (a freshly-seeded admin) →
// hasUser:true, current:"" → a calm "Not set" pill plus all three buttons so presence can
// be set in one tap. The write handler is A-F20.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { adminUserDoc } from "../../../docs/admin-user-doc";
import { availabilityField, adminUserIdField } from "../../admin-user";
import { AVAILABILITY } from "../../../../../lib/constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { INTENT } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

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

// The set of valid 3-state values — used to reject any stale/legacy value so the pill
// never renders an unknown state. Built once from the AVAILABILITY enum (rule 19).
const VALID_AVAILABILITY = Object.values(AVAILABILITY);

// Read the caller's own availability from the loaded adminUserDoc. Defensive: the Doc may
// be unloaded (no field map / no value) on non-on-call screens, and a seeded row may not
// yet carry availability → "" (the "Not set" state). Any value outside the known enum is
// also normalised to "" so the renderer only ever sees a known state or empty.
const readAvailability = () => {
  const raw = adminUserDoc?.f?.[availabilityField.id]?.value;
  return VALID_AVAILABILITY.includes(raw) ? raw : "";
};

// True only when the caller's own admin-users row is loaded — signalled by the primary
// key (adminUserId) carrying a value. Distinguishes "On-call screen, row loaded" from
// "some other screen, Doc unloaded" so the card shows only where it belongs.
const isUserLoaded = () => !!adminUserDoc?.f?.[adminUserIdField.id]?.value;

// Build the card content on every render. Screen-scoped + empty-safe: emits nothing
// unless the caller's own row is loaded (On-call screen).
onCallDisplaySection.onResponse = () => {
  const data = {
    // false on non-On-call screens → renderers emit "" (no stray card, no misleading pill).
    hasUser: isUserLoaded(),
    // "" when the loaded row has no availability yet → "Not set" pill + all three buttons.
    current: readAvailability(),
    // Per-button navigation contract consumed by the renderers' buttons (data-payload
    // {availability}). The handler that registers it is A-F20.
    setIntent: INTENT.SET_AVAILABILITY,
  };

  onCallDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

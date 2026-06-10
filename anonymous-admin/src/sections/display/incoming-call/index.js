// Display section: Incoming call (schema id: incomingCall, row 10). A-D-incomingcall
// fills the card with the GENERIC ring banner ("Incoming anonymous call" - NO caller
// name/id/email, ER-A5) + Answer / Dismiss buttons via renderForPlatform (wireframe §7).
// The CardsSet + placeholder Card were built in A-DISPLAY-SHELL - content only here.
// readOnly: true (on the shell card) - the card hosts the inline data-action="intent"
// buttons (Answer carries data-payload {callRef, meetingId}; Dismiss {callRef}), so the
// card surface must not swallow the click. Distinct framework ids (ids are global, rule 7).
//
// DATA SOURCE. Like the On-call card (and unlike the queue/dashboard sections that read the
// gateway-loaded reportsCollection), the ring banner's value comes from an AUX Doc -
// callQueueDoc - NOT from `reports` (schema line 266: "data_doc: callQueueDoc"; wireframe
// §7). The ring-trigger frame (A-F22, Context B) loads callQueueDoc({ callRef }) in the SAME
// invocation, so by the time adminDisplayDoc.sendResponse() fires this SYNCHRONOUS onResponse
// (CLAUDE.md "Render handlers are NOT awaited") the call's callRef/status/meetingId are
// hydrated on the Doc. onResponse only READS the already-loaded value; it never loads.
// The section lives on adminDisplayDoc (the only Doc sendResponse()d, rule 4/8), so `self`
// here is NOT callQueueDoc - the cross-doc read goes through the module-imported
// callQueueDoc singleton, the same pattern the On-call section uses for adminUserDoc (there
// is no `self` path from a Display-Doc section to an aux Doc).
//
// ANONYMITY (rule 30 / C1, ER-A5/A2/A3). callQueueDoc is IDENTITY-FREE by construction
// (lib/collections/call-queue.js) - it NEVER stores a reporter id/email/name. This card
// binds NO reporter-identity field and NEVER queries `reports`. The banner is wholly
// GENERIC: a static "Incoming anonymous call" line - no caller datum of any kind is read or
// rendered. The ONLY values surfaced are the OPAQUE callRef + Daily meetingId, and those
// travel only inside the Answer button's data-payload (consumed by the A-F21 atomic claim),
// never as visible text. The renderers still escape every interpolated value at the boundary
// (rule 10), though callRef/meetingId are framework-generated opaque tokens, not free text.
//
// EMPTY-SAFE + SCREEN-SCOPED. onResponse fires for EVERY adminDisplayDoc.sendResponse(), not
// just a ring event. We gate on a LIVE ringing call - callRef present AND status === RINGING.
// Not loaded (Dashboard / Queue / a report detail / On-call) → hasCall:false → the renderers
// emit NOTHING, so the ring banner never appears on the wrong screen. A call already claimed
// or ended (status ACTIVE/ENDED/MISSED/ABANDONED) likewise → hasCall:false, so a stale buffer
// value can never resurrect a dead banner. Only a genuinely RINGING call shows the banner.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { callQueueDoc } from "../../../docs/call-queue-doc";
import {
  callRefField,
  callStatusField,
  meetingIdField,
} from "../../call-queue";
import { CALL_STATUS } from "../../../../../lib/constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { INTENT, STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

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

// Read the opaque call ref from the loaded callQueueDoc (defensive: the Doc is unloaded on
// non-ring screens → undefined). The PK carrying a value is the "a call is loaded" signal.
const readCallRef = () => callQueueDoc?.f?.[callRefField.id]?.value || "";

// Read the call status; "" when unloaded. Only RINGING shows the banner (see header).
const readCallStatus = () => callQueueDoc?.f?.[callStatusField.id]?.value || "";

// Daily.co meeting id - passed to the Answer claim so the admin can join. "" when unloaded.
const readMeetingId = () => callQueueDoc?.f?.[meetingIdField.id]?.value || "";

// The callRef this admin locally dismissed (A-F22 dismissCall). "" when none. Used to
// suppress the banner for a call THIS admin dismissed without touching the shared status.
const readDismissedRef = () =>
  state.getField(STATE_KEYS.DISMISSED_CALL_REF) || "";

// Build the card content on every render. Screen-scoped + empty-safe: emits nothing unless a
// genuinely RINGING call is loaded on callQueueDoc.
incomingCallDisplaySection.onResponse = () => {
  const callRef = readCallRef();
  const data = {
    // True only for a live ringing call THIS admin has not locally dismissed → renderers
    // emit the banner; otherwise "" (no banner on Dashboard/Queue/detail/On-call, none for
    // an already-claimed or ended call, and none once this admin pressed Dismiss).
    hasCall:
      !!callRef &&
      readCallStatus() === CALL_STATUS.RINGING &&
      readDismissedRef() !== callRef,
    // Opaque ref + Daily meeting id - travel ONLY inside the Answer button's data-payload
    // (consumed by the A-F21 atomic claim), never shown as text. Identity-free (rule 16/30).
    callRef,
    meetingId: readMeetingId(),
    // Per-button navigation contract. Answer → atomic claim (A-F21); Dismiss → local dismiss
    // only, others keep ringing (A-F22). The ids match the schema verbatim (rule 19).
    answerIntent: INTENT.ANSWER_CALL,
    dismissIntent: INTENT.DISMISS_CALL,
  };

  incomingCallDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

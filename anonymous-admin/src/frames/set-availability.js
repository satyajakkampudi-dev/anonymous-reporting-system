// A-F20 — setAvailability: the admin toggles THEIR OWN on-call presence.
//
//   available  ·  busy  ·  unavailable        (a 3-state value — NEVER a SWITCH; rule 30)
//
// Triggered by the Available / Busy / Unavailable buttons in the On-call display card
// (A-D-oncall): data-action="intent", intentId = setAvailability, data-payload
// '{"availability":"available|busy|unavailable"}'. Each button carries ONLY the target
// state — never an adminUserId. The row written is ALWAYS keyed by the caller's own
// state.user.userId, so "only the caller's own row is writable" is enforced structurally
// by the load, not by trusting any payload field (a forged adminUserId in the payload
// is simply ignored — there is nowhere to read it from).
//
// Independent intent (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Mirrors the load-own-row pattern of the committed nav-on-call.js
// (openOnCall) and the Context-B save discipline of take-review.js (payload guard,
// errorsBefore / try-catch / errorStack-length abort detection):
//   1. Read { availability } from state.messageFromUser?.payload (one level deep under
//      .payload, never the top level — CLAUDE.md "Custom HTML Payloads"); missing → 400.
//   2. Validate the value is a known AVAILABILITY enum member — never write a garbage /
//      unknown state into the registry (the display normalises unknowns to "Not set", so
//      a stray value would silently blank the pill). Invalid → 400, no write.
//   3. Identity: state.user.userId is the ONLY key we ever address. Missing → neutral
//      error (cannot establish who the caller is) — never write.
//   4. Attach to the existing context (Context.Create — Redis-only, preserves the buffer,
//      rule 22; the same attach openOnCall uses) and load the caller's OWN row fresh by
//      { adminUserId: state.user.userId }. This is the ONLY row a caller can address.
//   5. Existence: a hydrated row carries its primary key (adminUserId). Not hydrated →
//      the caller is not in the seeded registry (shouldn't happen post A-F1, but defend):
//      neutral error, do NOT create a row (the registry is seeded out-of-band, D3 — an
//      INSERT here would mint a roleless/scopeless phantom admin).
//   6. Apply: availability = the validated value; stamp updatedOn = now (last-write-wins
//      is fine for a presence flag — no version/CAS; this is not a report transition).
//   7. Persist (adminUserDoc.save()). A save abort adds to the error stack WITHOUT
//      throwing — detect it the same way take-review.js does and do not claim success.
//   8. Confirm. availability now PERSISTS in the caller's own admin-users row; the On-call
//      display card (A-D-oncall) reads adminUserDoc live on its next render (openOnCall),
//      so the presence pill reflects the saved state. (The in-place Display-Doc re-render
//      swap is the separate nav-display-routing fix — openOnCall is itself still a
//      placeholder-string render today; this frame stays consistent with that and
//      confirms via sendResponse.)
//
// ANONYMITY (rule 30 / C1): the only identity touched is the CALLER'S OWN (their own
// userId), which is theirs to read and write — never a reporter's. No reporter-identity
// field exists on adminUserDoc; the payload's adminUserId (if any) is NEVER trusted.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { AVAILABILITY } from "../../../lib/constants";
import { setOwnAvailability } from "./availability-writer";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { INTENT } from "../constants";

// The closed set of writable presence states (rule 19) — anything outside it is rejected.
const VALID_AVAILABILITY = Object.values(AVAILABILITY);

export const setAvailability = Intent.Create({
  intentId: INTENT.SET_AVAILABILITY,
  prompt: "Set my on-call availability",
  state,
});

setAvailability.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { availability } = state.messageFromUser?.payload || {};
  if (!availability) {
    state.addErrorToStack(400, "Missing availability for setAvailability");
    return;
  }

  // 2. Validate against the enum — never write a garbage state.
  if (!VALID_AVAILABILITY.includes(availability)) {
    state.addErrorToStack(400, "Invalid availability.");
    D.log({
      message: "A-F20: setAvailability rejected — invalid availability value",
      data: { availability },
    });
    return;
  }

  // 3. Identity — the ONLY key we ever address is the caller's own userId.
  if (!state.user?.userId) {
    state.addErrorToStack(
      401,
      "We couldn't confirm your identity just now. Please try again in a moment."
    );
    return;
  }

  // 4-7. Attach, load the caller's OWN row, apply + persist via the SHARED writer (the
  //      single chokepoint reused by A-F21/A-F22 — rule 14). It loads keyed by the
  //      caller's own userId (structurally "own row only"), never creates a row (D3),
  //      and detects a save abort. Map its reason to the existing user-facing copy.
  const { ok, reason } = await setOwnAvailability(availability);
  if (!ok) {
    if (reason === "not-found") {
      state.addErrorToStack(
        404,
        "Your on-call record isn't available right now. Please try again in a moment."
      );
    } else if (reason === "no-identity") {
      state.addErrorToStack(
        401,
        "We couldn't confirm your identity just now. Please try again in a moment."
      );
    } else if (reason === "save-aborted") {
      // A field/onSave gate stacked an error — it is already on the stack; do not add a
      // second, contradictory message.
      D.log({ message: "A-F20: setAvailability aborted via error stack" });
    } else {
      state.addSystemErrorToStack(
        500,
        "We couldn't update your availability just now. Please try again."
      );
    }
    return;
  }

  // 8. Re-render the On-call card NOW so the "Current" pill + the active button reflect
  //    the new value immediately. setOwnAvailability set it on the live adminUserDoc in
  //    this invocation, so the on-call onResponse reads the updated value. Without this
  //    the card kept its stale content ("Not set"). showScreen keeps us on the On-call
  //    screen; a brief toast accompanies the visual update.
  D.log({
    message: "A-F20: availability updated",
    data: { availability },
  });

  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
  `You are now ${availability}.`.sendResponse();
};

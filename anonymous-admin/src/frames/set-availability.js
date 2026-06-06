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
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminUserDoc } from "../docs/admin-user-doc";
import {
  adminUserIdField,
  availabilityField,
  adminUpdatedOnField,
} from "../sections/admin-user";
import { AVAILABILITY } from "../../../lib/constants";
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
  const userId = state.user?.userId;
  if (!userId) {
    state.addErrorToStack(
      401,
      "We couldn't confirm your identity just now. Please try again in a moment."
    );
    return;
  }

  // 4. Attach to the existing context (preserve the buffer, rule 22) and load the
  //    caller's OWN row fresh. Keyed by their own userId — structurally "own row only".
  await Context.Create(state.currentTabId, { state });
  await adminUserDoc.loadDocument({ adminUserId: userId });

  // 5. Existence — a hydrated row carries its primary key. Not hydrated → caller is not
  //    in the seeded registry; neutral error, do NOT create a row (D3 — seeded only).
  if (!adminUserDoc.f[adminUserIdField.id]?.value) {
    state.addErrorToStack(
      404,
      "Your on-call record isn't available right now. Please try again in a moment."
    );
    D.log({
      message: "A-F20: setAvailability — caller's admin-users row not found",
      data: { availability },
    });
    return;
  }

  // 6. Apply. Presence is last-write-wins (no version/CAS — not a report transition).
  adminUserDoc.f[availabilityField.id].value = availability;
  adminUserDoc.f[adminUpdatedOnField.id].value = Date.now();

  // 7. Persist. A save abort adds to the error stack WITHOUT throwing — detect it and do
  //    not claim success (mirrors take-review.js).
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminUserDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We couldn't update your availability just now. Please try again."
    );
    D.log({
      message: "A-F20: admin-users save failed on setAvailability",
      data: { availability, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  // 8. Confirm. The value now persists; the On-call display reflects it on next render.
  D.log({
    message: "A-F20: availability updated",
    data: { availability },
  });

  `Your on-call status is now **${availability}**.`.sendResponse();
};

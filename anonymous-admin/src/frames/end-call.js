// A-F22 — End call: hang-up/drop -> ENDED + mid-call inactivity backstop + local dismiss.
//
// THREE independent intents (all Context B — object graph EMPTY on entry; CLAUDE.md
// "Invocation Lifecycle"):
//
//   - endCall (INTENT.END_CALL) — the answering admin hangs up. Fired with { callRef }
//     by the in-call hang-up control / an "End call" button (data-action="intent",
//     payload ONE LEVEL DEEP under state.messageFromUser.payload). Guarded ACTIVE ->
//     ENDED (records durationMs), then frees the admin (availability -> available).
//
//   - callInactivity (INTENT.CALL_INACTIVITY) — the mid-call inactivity backstop
//     (ER-C12). NOT a button: fired by the jobScheduler message A-F21 armed at claim
//     time (now + CALL_INACTIVITY_TIMEOUT_MS, to the answering admin's OWN userId,
//     payload delivered under state.messageFromUser.data — job-scheduler guide). Runs
//     the SAME guarded ACTIVE -> ENDED transition ONLY if the call is still ACTIVE; a
//     clean prior hang-up makes it a no-op (rule 13). No sendResponse (system job).
//
//   - dismissCall (INTENT.DISMISS_CALL) — LOCAL dismiss only (per the A-D-incomingcall
//     display header: "Dismiss -> local dismiss only, others keep ringing"). It MUST NOT
//     mutate the shared call-queue status — dismissing the banner on ONE admin's screen
//     must not end/claim the call for everyone. Minimal: a calm acknowledgement; the
//     banner is removed client-side. NO callQueueDoc write.
//
// SHARED TRANSITION HELPER (rule 14 — single chokepoint). endCall and callInactivity run
// the IDENTICAL guarded ACTIVE -> ENDED transition; `endActiveCall(callRef)` owns it once
// so the two intents cannot drift. It re-reads fresh by callRef, guards on ACTIVE, stamps
// ENDED/endedOn/durationMs, saves with abort detection, and frees the admin. It is a pure
// no-op for any non-ACTIVE state (already ENDED/MISSED/ABANDONED, still RINGING, or not
// found) — so duplicate fires (a hang-up AND the backstop, two backstop deliveries) are
// safe and idempotent.
//
// durationMs = endedOn - answeredOn (the answer time A-F21 stamped). Clamped to >= 0
// against any clock skew. NO recording (ER-A5) — this handler only stamps status/times.
//
// ANONYMITY (NON-NEGOTIABLE, ER-A5): the call-queue row is identity-free; we stamp only
// status/timestamps/duration. The only identity touched is the answering admin's OWN
// availability (theirs to write — never a reporter's, via the shared setOwnAvailability).

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { callQueueDoc } from "../docs/call-queue-doc";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import {
  callRefField,
  callStatusField,
  answeredOnField,
  endedOnField,
  durationMsField,
} from "../sections/call-queue";
import { setOwnAvailability } from "./availability-writer";
import { CALL_STATUS, AVAILABILITY } from "../../../lib/constants";
import { INTENT, STATE_KEYS } from "../constants";

// Shared guarded ACTIVE -> ENDED transition. Returns { ended: boolean } so a caller can
// branch its user-facing copy. `attached` indicates the caller has already Context.Create'd
// in this invocation (so we skip a redundant attach and pass attach:false to the writer).
const endActiveCall = async (callRef, { attached = false } = {}) => {
  if (!callRef) {
    D.log({ message: "A-F22: endActiveCall called without a callRef" });
    return { ended: false };
  }

  // Attach (Redis buffer, no MongoDB-clobbering reload — rule 22) and re-read fresh.
  if (!attached) {
    await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  }
  await callQueueDoc.loadDocument({ callRef });

  const loadedRef = callQueueDoc.f[callRefField.id]?.value || "";
  const status = callQueueDoc.f[callStatusField.id]?.value || "";

  // Guard (rule 13). End ONLY a call that is ours AND currently ACTIVE. Anything else
  // (already terminal, still RINGING/unanswered, or not found) is an idempotent no-op —
  // never overwrite a settled call or end a ringing one.
  if (loadedRef !== callRef || status !== CALL_STATUS.ACTIVE) {
    D.log({
      message: "A-F22: end no-op (call not in ACTIVE state)",
      data: { callRef, status, found: loadedRef === callRef },
    });
    return { ended: false };
  }

  // Apply ACTIVE -> ENDED. durationMs from the answer time (clamp >= 0 vs clock skew).
  const now = Date.now();
  const answeredOn = Number(callQueueDoc.f[answeredOnField.id]?.value || 0);
  callQueueDoc.f[callStatusField.id].value = CALL_STATUS.ENDED;
  callQueueDoc.f[endedOnField.id].value = now;
  callQueueDoc.f[durationMsField.id].value =
    answeredOn > 0 ? Math.max(0, now - answeredOn) : 0;

  // Persist with abort detection (save() can stack an error without throwing).
  const errorsBefore = (state.errorStack || []).length;
  try {
    await callQueueDoc.save();
  } catch (error) {
    D.log({
      message: "A-F22: end save failed",
      data: { callRef, error: String(error) },
    });
    return { ended: false };
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return { ended: false };
  }

  // Free the admin (busy -> available) via the SHARED writer (rule 14 — context already
  // attached, so attach:false). Best-effort: a presence-flip failure must not undo a
  // cleanly-ended call — log and continue.
  const free = await setOwnAvailability(AVAILABILITY.AVAILABLE, {
    attach: false,
  });
  if (!free.ok) {
    D.log({
      message: "A-F22: free-on-end failed (non-fatal)",
      data: { callRef, reason: free.reason },
    });
  }

  D.log({
    message: "A-F22: call ended",
    data: { callRef, from: CALL_STATUS.ACTIVE, to: CALL_STATUS.ENDED },
  });
  return { ended: true };
};

// --- 1. Admin hangs up (button / in-call hang-up control) ---
export const endCall = Intent.Create({
  intentId: INTENT.END_CALL,
  prompt: "End the anonymous compliance call I am on",
  state,
});

endCall.onResolution = async () => {
  const { callRef } = state.messageFromUser?.payload || {};
  if (!callRef) {
    state.addErrorToStack(400, "Missing callRef for endCall");
    return;
  }

  const { ended } = await endActiveCall(callRef);
  if (ended) {
    "The call has ended. The reporter remained anonymous throughout.".sendResponse();
  } else {
    // Already settled (or never ACTIVE) — idempotent. A calm, non-alarming close.
    "This call is no longer active.".sendResponse();
  }
};

// --- 2. Mid-call inactivity backstop (scheduled system job) ---
export const callInactivity = Intent.Create({
  intentId: INTENT.CALL_INACTIVITY,
  prompt: "Close a compliance call that has gone inactive",
  state,
});

callInactivity.onResolution = async () => {
  // Scheduled-message payload arrives under .data; fall back to .payload defensively
  // (mirrors U-F16/U-F17). No sendResponse — this is a silent system job.
  const { callRef } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  if (!callRef) {
    D.log({ message: "A-F22: callInactivity fired without a callRef" });
    return;
  }
  await endActiveCall(callRef);
};

// --- 3. Local dismiss only (banner removed client-side; shared status untouched) ---
export const dismissCall = Intent.Create({
  intentId: INTENT.DISMISS_CALL,
  prompt: "Dismiss the incoming-call banner on my screen only",
  state,
});

dismissCall.onResolution = async () => {
  // Per the A-D-incomingcall header, Dismiss is LOCAL ONLY — others keep ringing. We do
  // NOT touch callQueueDoc status (no end / no claim): a dismiss on one admin's screen
  // must not end or claim the shared call. Instead we stash the dismissed callRef in this
  // admin's own per-conversation state and re-render the shell — the incoming-call section
  // AND-gates on STATE_KEYS.DISMISSED_CALL_REF, so the banner clears HERE while the shared
  // RINGING status (and other admins' banners) are untouched.
  const { callRef } = state.messageFromUser?.payload || {};
  D.log({
    message: "A-F22: ENTER — Dismiss clicked (local dismiss only)",
    data: {
      callRef,
      hasPayload: !!state.messageFromUser?.payload,
      userId: state.user?.userId,
    },
  });
  if (!callRef) {
    state.addErrorToStack(400, "Missing callRef for dismissCall");
    return;
  }

  // Record the local dismissal, then re-render so the banner re-gates and clears on THIS
  // screen. Context attach (preserve the buffer — rule 22) is needed for the render.
  state.setField(STATE_KEYS.DISMISSED_CALL_REF, callRef);
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  adminDisplayDoc.sendResponse();
  D.log({
    message:
      "A-F22: dismissed locally + admin display re-rendered (banner cleared)",
    data: { callRef },
  });
};

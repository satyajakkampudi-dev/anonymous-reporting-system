// U-F17 - Anonymous call: end / abandon (ER-C12).
//
// ONE status-conditional handler for both lifecycle holes (input-schema "callEnd"):
//   - Reporter hangs up BEFORE an admin answers  → RINGING  → ABANDONED
//   - Network drop / inactivity timeout MID-CALL  → ACTIVE   → ENDED (duration recorded)
//
// Independent intent (Context B - object graph EMPTY on entry). Like U-F16's
// callTimeout it is NOT a navigation CTA; it is fired with a { callRef } by one of:
//   (a) a hang-up / "Cancel call" invoke_intent from the meeting/ring UI - the
//       framework delivers the custom field ONE LEVEL DEEP under
//       state.messageFromUser.payload (CLAUDE.md "Custom HTML Payloads"); OR
//   (b) the mid-call inactivity-timeout jobScheduler message - armed admin-side when
//       the call goes ACTIVE (A-F21's atomic claim, rule 13) and delivered under
//       state.messageFromUser.data (job-scheduler guide).
// We read both shapes defensively, exactly as call-timeout.js does, so whichever
// trigger lands works without a separate handler.
//
// The "same guard idea" as U-F16 (the task's WHAT line): the CORRECT terminal state is
// derived from the CURRENT, freshly-loaded status - never from the trigger. So a single
// re-read + switch makes every duplicate or stale fire a safe no-op (rule 13):
//   RINGING (unclaimed) → ABANDONED   (reporter left before answer)
//   ACTIVE              → ENDED        (call was answered then dropped)
//   anything else       → no-op        (already ENDED/MISSED/ABANDONED, claimed mid-ring,
//                                        or not found - never overwrite a settled call)
// This means abandon and end CANNOT race into the wrong state: if an admin answered
// first (status ACTIVE / attendedBy set), a late hang-up signal ENDS rather than wrongly
// ABANDONs; if the ring timed out first (MISSED, U-F16), both are no-ops. No optimistic-
// concurrency version field is needed - the status itself is the guard, and a non-RINGING/
// non-ACTIVE read short-circuits before any write.
//
// ANONYMITY (NON-NEGOTIABLE): the call-queue row is identity-free; this handler only
// stamps status/timestamps/duration. It writes no reporter id/email/name and sends no
// cross-app message - ABANDONED/ENDED have no MSG_* contract in the task graph (the admin
// observes the terminal status on next read). Do NOT invent a sender.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { callQueueDoc } from "../docs/call-queue-doc";
import {
  callRefField,
  callStatusField,
  attendedByField,
  answeredOnField,
  endedOnField,
  durationMsField,
} from "../sections/call-queue";
import { CALL_STATUS, ERROR_CODES } from "../../../lib/constants";
import { INTENT } from "../constants";

export const callEnd = Intent.Create({
  intentId: INTENT.CALL_END,
  prompt: "End or abandon an in-progress compliance call",
  state,
});

callEnd.onResolution = async () => {
  // Trigger payload. Scheduled inactivity timeout delivers it under .data; a hang-up
  // invoke_intent delivers it under .payload - accept either (defensive, mirrors U-F16).
  const { callRef } =
    state.messageFromUser?.data || state.messageFromUser?.payload || {};
  if (!callRef) {
    D.log({ message: "U-F17: callEnd fired without a callRef" });
    return; // nothing to act on - stay silent (no spurious reporter message)
  }

  // Attach to the existing context (Redis buffer, no MongoDB-clobbering reload of the
  // report graph - rule 22) and re-read THIS call-queue row fresh by callRef.
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await callQueueDoc.loadDocument({ callRef });

  const loadedRef = callQueueDoc.f[callRefField.id]?.value || "";
  const status = callQueueDoc.f[callStatusField.id]?.value || "";
  const attendedBy = callQueueDoc.f[attendedByField.id]?.value || "";

  // Not found (empty/different PK) → nothing to settle. No-op.
  if (loadedRef !== callRef) {
    D.log({
      message: "U-F17: callEnd no-op (call-queue row not found)",
      data: { callRef },
    });
    return;
  }

  // Derive the terminal state from the CURRENT status (the guard).
  const now = Date.now();
  let toStatus;
  if (status === CALL_STATUS.RINGING && !attendedBy) {
    // Reporter left before any admin claimed the call.
    toStatus = CALL_STATUS.ABANDONED;
  } else if (status === CALL_STATUS.ACTIVE) {
    // Call was answered, then dropped / went inactive.
    toStatus = CALL_STATUS.ENDED;
  } else {
    // Already terminal (ENDED/MISSED/ABANDONED), or RINGING-but-claimed mid-flight
    // (let the admin's atomic claim win - rule 13). Idempotent no-op.
    D.log({
      message: "U-F17: callEnd no-op (call not in an endable state)",
      data: { callRef, status, claimed: !!attendedBy },
    });
    return;
  }

  // Apply the transition. endedOn marks settlement; duration is recorded only WHERE
  // APPLICABLE - i.e. an ENDED call that has a recorded answeredOn (an ABANDONED call
  // was never answered, so it has no duration).
  callQueueDoc.f[callStatusField.id].value = toStatus;
  callQueueDoc.f[endedOnField.id].value = now;
  if (toStatus === CALL_STATUS.ENDED) {
    const answeredOn = Number(callQueueDoc.f[answeredOnField.id]?.value || 0);
    if (answeredOn > 0) {
      callQueueDoc.f[durationMsField.id].value = Math.max(0, now - answeredOn);
    }
  }

  // Persist. save() can abort WITHOUT throwing by stacking an error - detect that the
  // same way U-F15/U-F16 do (error-stack growth) and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await callQueueDoc.save();
  } catch (error) {
    D.log({
      message: "U-F17: call-queue end/abandon save failed",
      data: { callRef, toStatus, error: String(error) },
    });
    state.addSystemErrorToStack(
      ERROR_CODES.CALL_RING_FAILED,
      "We could not close the call cleanly just now."
    );
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  D.log({
    message: "U-F17: call settled",
    data: { callRef, from: status, to: toStatus },
  });

  // Calm, identity-free confirmation. Harmless if unseen (a dropped reporter is gone),
  // reassuring if the reporter is still in the app after a hang-up.
  "Your call has ended. You remained anonymous throughout. If you would still like to raise something, you can submit a report or call the compliance team again at any time.".sendResponse();
};

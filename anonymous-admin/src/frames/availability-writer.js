// Shared availability writer — the SINGLE place that writes the caller's OWN on-call
// presence to the admin-users registry. Extracted from A-F20 (setAvailability) so the
// call-answer (A-F21, busy-on-answer, OQ-12) and call-end (A-F22, available-on-end)
// frames reuse the EXACT same load-own-row + guarded-save discipline rather than
// duplicating it (rule 14 — single chokepoint).
//
// Context-B safe: the caller MUST already be in an attached context (Context.Create) —
// this helper loads the caller's own row fresh by their userId, applies the validated
// availability, and saves with abort detection. It NEVER creates a row (the registry is
// seeded out-of-band, D3) and NEVER addresses any row but the caller's own (structural
// "own row only" — the key is always state.user.userId, never a payload field).
//
// ANONYMITY (rule 30): the only identity touched is the CALLER'S OWN, which is theirs to
// read/write — never a reporter's. No reporter-identity field exists on adminUserDoc.

import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminUserDoc } from "../docs/admin-user-doc";
import {
  adminUserIdField,
  availabilityField,
  adminUpdatedOnField,
} from "../sections/admin-user";
import { AVAILABILITY } from "../../../lib/constants";

// The closed set of writable presence states (rule 19) — anything outside it is rejected.
const VALID_AVAILABILITY = Object.values(AVAILABILITY);

// Set the CALLER'S OWN availability to `availability` (must be a known AVAILABILITY
// enum member). Returns { ok: boolean, reason?: string }. Logs every non-ok path.
// Best-effort by design for the call frames: a failure to flip presence must not strand
// a successfully-claimed/ended call — the caller decides whether to surface it.
//
// `attach` (default true): when the caller has ALREADY attached the context in this
// invocation (A-F21/A-F22 attach before they load the call-queue row), pass false to
// avoid a redundant Context.Create.
export const setOwnAvailability = async (
  availability,
  { attach = true } = {}
) => {
  if (!VALID_AVAILABILITY.includes(availability)) {
    D.log({
      message: "setOwnAvailability rejected — invalid availability value",
      data: { availability },
    });
    return { ok: false, reason: "invalid" };
  }

  const userId = state.user?.userId;
  if (!userId) {
    D.log({ message: "setOwnAvailability — caller identity unavailable" });
    return { ok: false, reason: "no-identity" };
  }

  // Attach + load the caller's OWN row fresh (keyed by their own userId).
  if (attach) {
    await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  }
  await adminUserDoc.loadDocument({ adminUserId: userId });

  // Existence — a hydrated row carries its primary key. Not hydrated → caller is not in
  // the seeded registry; do NOT create a row (D3 — seeded only).
  if (!adminUserDoc.f[adminUserIdField.id]?.value) {
    D.log({
      message: "setOwnAvailability — caller's admin-users row not found",
      data: { availability },
    });
    return { ok: false, reason: "not-found" };
  }

  // Apply. Presence is last-write-wins (no version/CAS — not a report transition).
  adminUserDoc.f[availabilityField.id].value = availability;
  adminUserDoc.f[adminUpdatedOnField.id].value = Date.now();

  // Persist. A save abort adds to the error stack WITHOUT throwing — detect it the same
  // way the transition frames do and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminUserDoc.save();
  } catch (error) {
    D.log({
      message: "setOwnAvailability — admin-users save failed",
      data: { availability, error: String(error) },
    });
    return { ok: false, reason: "save-failed" };
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return { ok: false, reason: "save-aborted" };
  }

  return { ok: true };
};

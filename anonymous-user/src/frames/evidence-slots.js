// Evidence-slot progressive disclosure - helpers + onClick wiring.
//
// The submit form shows only "Evidence file 1" by default; a "+ Add another file"
// button reveals slots 2–5 one at a time (mirror of the reference user-app
// ticket/hooks/evidenceSlots.js). Handlers live in frames/ (AGENTS.md) so they can
// import the Field/Button refs from sections/evidence - the section must NOT import
// this frame (one-way: frames/evidence-slots → sections/evidence; no circular dep).
//
// The Field `hidden` flags are module-level mutables that reset on a Lambda cold
// start (Context B), so the live count of revealed slots is persisted in conversation
// state under STATE_KEYS.EVIDENCE_SLOTS_VISIBLE and re-applied by
// restoreEvidenceSlotVisibility before any slot-dependent logic runs.
//
// Two-Doc note: unlike the reference app, this app NEVER renders reportDoc in a
// tracking/detail view - the report DETAIL is rendered by the Display Doc
// (detail-content card) reading the loaded projection. So there is no
// hideEmptyEvidenceSlots equivalent here; only reset (on submit-form open) and reveal
// (button click) are required. revealNextEvidenceSlot re-renders the submit form via
// reportDoc.sendResponse() (the same Doc openSubmitReport sends - nav-submit-report.js).

import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../docs/report-doc";
import {
  ATTACHMENT_FIELDS,
  EXTRA_ATTACHMENT_FIELDS,
  addEvidenceSlotButtons,
} from "../sections/evidence";
import { STATE_KEYS } from "../constants";

function getVisibleCount() {
  return Number(state.getField(STATE_KEYS.EVIDENCE_SLOTS_VISIBLE)) || 1;
}

function setVisibleCount(n) {
  state.setField(STATE_KEYS.EVIDENCE_SLOTS_VISIBLE, n);
}

// Re-apply field visibility from the persisted slot count. Call at the start of any
// handler that depends on slot visibility (the `hidden` mutables reset on cold start).
export function restoreEvidenceSlotVisibility() {
  const visible = getVisibleCount();
  EXTRA_ATTACHMENT_FIELDS.forEach((slot, i) => {
    // slot at array index i is "Evidence file (i + 2)"; hidden when its number
    // exceeds the revealed count.
    slot.hidden = i + 2 > visible;
  });
  addEvidenceSlotButtons.hidden = visible > EXTRA_ATTACHMENT_FIELDS.length;
}

// Reveal the next hidden slot, persist the new count, refresh the form.
// Returns false if all slots are already visible.
export function revealNextEvidenceSlot() {
  restoreEvidenceSlotVisibility();
  const next = EXTRA_ATTACHMENT_FIELDS.find((f) => f.hidden);
  if (!next) return false;

  next.hidden = false;
  setVisibleCount(getVisibleCount() + 1);

  // Hide the "+ Add another file" button once every slot is visible.
  if (EXTRA_ATTACHMENT_FIELDS.every((f) => !f.hidden)) {
    addEvidenceSlotButtons.hidden = true;
  }

  // Null the button's autoSave buffer entry so a subsequent Submit click is not
  // mistaken for another "+" press.
  addEvidenceSlotButtons.value = null;
  reportDoc.sendResponse();
  return true;
}

// Reset to "only slot 1 visible, + button visible" - for a fresh submission.
export function resetEvidenceSlots() {
  setVisibleCount(1);
  ATTACHMENT_FIELDS[0].hidden = false;
  EXTRA_ATTACHMENT_FIELDS.forEach((f) => {
    f.hidden = true;
  });
  addEvidenceSlotButtons.hidden = false;
}

// ── Buttons-field click ──────────────────────────────────────────────────────
addEvidenceSlotButtons.onClick = () => {
  revealNextEvidenceSlot();
};

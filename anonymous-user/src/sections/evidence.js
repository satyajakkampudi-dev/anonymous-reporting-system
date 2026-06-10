// reportDoc - "Evidence (optional)" section (rendering: standard, 1 column).
//
// Up to 5 files, ≤ 25 MB each (D1). FILE_FIELD = upload control + S3 (NEVER TEXT
// with a pasted URL; field-spec semantic review). The .value is an envelope
// { value: <s3-key>, fileName, fileScopeValue } - admin/detail display signs the
// key (rule 18). Type+size validation is server-side in lib/validation.js, called
// from onSubmit (U-F6), atomic with save (ER-C10) - added in the U-F6 task.
//
// The "Up to 5 files, 25 MB each…" instruction is presented in the Display card
// (U-D-* tasks); Section has no documented `instruction` property, so it is not set
// here (do not invent APIs).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { Buttons } from "@frontmltd/frontmjs/core/fields/Buttons";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../docs/report-doc";

export const evidenceSection = new Section("evidenceSection", {
  title: "Evidence (optional)",
  doc: reportDoc,
  columns: 1,
  collapsable: true,
  grid: { row: 2, column: 0 },
  state,
});

// Progressive disclosure (mirror of the reference user-app evidenceFields.js): only
// slot 1 is visible initially; slots 2–5 start hidden and are revealed one at a time
// by the "+ Add another file" button (frames/evidence-slots.js). The `hidden` flag is
// a module-level mutable that resets on a Lambda cold start, so the live count is
// persisted in conversation state (STATE_KEYS.EVIDENCE_SLOTS_VISIBLE) and re-applied
// by restoreEvidenceSlotVisibility. The onClick handler lives in frames/ (AGENTS.md -
// handlers belong in frames, not in sections), so this file holds definitions only.
const makeEvidenceFileField = (index, hidden) =>
  new Field(`evidenceFile${index}Field`, {
    title: `Evidence file ${index}`,
    doc: reportDoc,
    section: evidenceSection,
    type: FormFieldTypes.FILE_FIELD,
    mandatory: false,
    // DOMAIN scope (per FrontM platform team - Jaswanth, 2026-06-10): a FILE_FIELD must
    // be DOMAIN-scoped so the bytes land at a domain-shared S3 path readable by ANY user
    // in the domain - which is exactly what we need (a reporter uploads; a compliance
    // admin in a DIFFERENT conversation must open it). The object lives at
    // `${currentUserDomain}/${key}`; readers sign that path (detail-content +
    // nav-manage-report). Anonymity-safe: the path carries the domain + a random key, NO
    // reporter conversationId/identity (rule 30). (Supersedes the earlier conversation
    // revert; the prior "domain NoSuchKey" was a stale/conversation-scoped test file.)
    fileScope: "domain",
    dbName: `evidenceFile${index}`,
    hidden,
    state,
  });

export const evidenceFile1Field = makeEvidenceFileField(1, false);
export const evidenceFile2Field = makeEvidenceFileField(2, true);
export const evidenceFile3Field = makeEvidenceFileField(3, true);
export const evidenceFile4Field = makeEvidenceFileField(4, true);
export const evidenceFile5Field = makeEvidenceFileField(5, true);

// All five slots in display order - used by resetEvidenceSlots (frames/evidence-slots).
export const ATTACHMENT_FIELDS = [
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// The four progressively-revealed slots (2–5) - used by restoreEvidenceSlotVisibility
// and revealNextEvidenceSlot to find the next hidden slot.
export const EXTRA_ATTACHMENT_FIELDS = [
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// "+ Add another file" - reveals the next hidden slot; hidden once all five are
// visible. onClick is wired in frames/evidence-slots.js (handlers live in frames).
export const addEvidenceSlotButtons = Buttons.Create({
  intentId: "addEvidenceSlotButtons",
  title: "Add evidence files",
  doc: reportDoc,
  section: evidenceSection,
  hiddenInTables: true,
  state,
});
addEvidenceSlotButtons.addButton({ label: "+ Add another file" });

export const evidenceNotesField = new Field("evidenceNotesField", {
  title: "Evidence notes",
  doc: reportDoc,
  section: evidenceSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  dbName: "evidenceNotes",
  state,
});

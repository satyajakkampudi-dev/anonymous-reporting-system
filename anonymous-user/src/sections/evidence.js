// reportDoc — "Evidence (optional)" section (rendering: standard, 1 column).
//
// Up to 5 files, ≤ 25 MB each (D1). FILE_FIELD = upload control + S3 (NEVER TEXT
// with a pasted URL; field-spec semantic review). The .value is an envelope
// { value: <s3-key>, fileName, fileScopeValue } — admin/detail display signs the
// key (rule 18). Type+size validation is server-side in lib/validation.js, called
// from onSubmit (U-F6), atomic with save (ER-C10) — added in the U-F6 task.
//
// The "Up to 5 files, 25 MB each…" instruction is presented in the Display card
// (U-D-* tasks); Section has no documented `instruction` property, so it is not set
// here (do not invent APIs).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
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

const makeEvidenceFileField = (index) =>
  new Field(`evidenceFile${index}Field`, {
    title: `Evidence file ${index}`,
    doc: reportDoc,
    section: evidenceSection,
    type: FormFieldTypes.FILE_FIELD,
    mandatory: false,
    dbName: `evidenceFile${index}`,
    state,
  });

export const evidenceFile1Field = makeEvidenceFileField(1);
export const evidenceFile2Field = makeEvidenceFileField(2);
export const evidenceFile3Field = makeEvidenceFileField(3);
export const evidenceFile4Field = makeEvidenceFileField(4);
export const evidenceFile5Field = makeEvidenceFileField(5);

export const evidenceNotesField = new Field("evidenceNotesField", {
  title: "Evidence notes",
  doc: reportDoc,
  section: evidenceSection,
  type: FormFieldTypes.TEXT_AREA,
  mandatory: false,
  dbName: "evidenceNotes",
  state,
});

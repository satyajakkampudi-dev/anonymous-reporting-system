// reportDoc — "How we can reach you (optional)" section (rendering: standard, 2 cols).
//
// Reporter-PRIVATE: contactMethod + contactValue are EXCLUDED from adminProjection
// (lib/access.js ADMIN_EXCLUDED_FIELDS) — dbNames MUST stay "contactMethod" /
// "contactValue". contactValue is encrypted: true (client-level encryption; sensitive).
//
// Conditional reveal/require by method (None hides value; Email/Phone/Cabin
// validated) is enforced in code (U-F7 onValidation/onSave) — the framework has no
// declarative "show-if" (rule 24). Here contactValue is mandatory: false; U-F7 makes
// it conditionally required when method ≠ None.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Field } from "@frontmltd/frontmjs/core/Field";
import { FormFieldTypes } from "@frontmltd/frontmjs/core/FormFieldTypes";
import { state } from "@frontmltd/frontmjs/core/State";
import { CONTACT_METHOD_LABELS } from "../../../lib/constants";
import { reportDoc } from "../docs/report-doc";

export const contactSection = new Section("contactSection", {
  title: "How we can reach you (optional)",
  doc: reportDoc,
  columns: 2,
  collapsable: true,
  grid: { row: 1, column: 0 },
  state,
});

export const contactMethodField = new Field("contactMethodField", {
  title: "Contact method",
  doc: reportDoc,
  section: contactSection,
  type: FormFieldTypes.DROPDOWN,
  mandatory: true,
  column: 0,
  options: Object.values(CONTACT_METHOD_LABELS),
  dbName: "contactMethod",
  state,
});

export const contactValueField = new Field("contactValueField", {
  title: "Contact details",
  doc: reportDoc,
  section: contactSection,
  type: FormFieldTypes.TEXT_FIELD,
  mandatory: false,
  column: 1,
  encrypted: true,
  dbName: "contactValue",
  state,
});

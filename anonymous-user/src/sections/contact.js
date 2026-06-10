// reportDoc - "How we can reach you (optional)" section (rendering: standard, 2 cols).
//
// OPEN-REPORTING (MP-FIX-CONTACT-OPEN-REPORTING): contactMethod + contactValue are now
// ADMIN-VISIBLE - the reporter optionally CHOOSES to be identifiable, and the compliance team
// sees these in the admin report view (the `info` hint below is the informed-consent disclosure).
// They are NO LONGER in lib/access.js ADMIN_EXCLUDED_FIELDS; the admin bundle binds them too.
// The reporter's PLATFORM identity (reporterId) stays excluded regardless. dbNames MUST stay
// "contactMethod" / "contactValue". contactValue stays encrypted: true (client-level encryption).
//
// Conditional reveal/require by method (None hides value; Email/Phone/Cabin
// validated) is enforced in code (U-F7 onValidation/onSave) - the framework has no
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
  // Reporter-facing hint - OPEN-REPORTING consent (MP-FIX-CONTACT-OPEN-REPORTING). Providing
  // contact is the reporter CHOOSING to be identifiable: contactMethod + contactValue are now
  // admin-visible (removed from ADMIN_EXCLUDED_FIELDS) and shown in the admin report view. This
  // copy is the informed-consent disclosure and MUST stay in lock-step with that visibility -
  // if contact is ever re-hidden from admins, change this line in the same commit. The reporter's
  // platform identity (reporterId) stays hidden regardless; only what they type here is revealed.
  info: "Optional. Leave blank to report anonymously. If you add your contact details here, the compliance team will be able to see them and may use them to follow up with you directly - choose this only if you're comfortable being identified.",
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

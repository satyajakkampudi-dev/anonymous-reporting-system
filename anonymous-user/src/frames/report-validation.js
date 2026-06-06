// U-F6 — Evidence upload validation + atomicity.
// U-F7 — Contact-method conditional require/validate (added below the evidence
//        layers; shares the same authoritative reportDoc.onSave gate).
//
// Context A (framework events on reportDoc / its evidence Fields — object graph is
// live; rule 6 puts handlers in frames/, not docs/). Two layers:
//
//   1. Per-field `onValidation` — on-attach feedback. When a reporter attaches a
//      single evidence file with a disallowed extension, reject it immediately via
//      `sendValidationResponse` so they see the error before submitting. Best-effort
//      UX only; NOT the authority.
//
//   2. `reportDoc.onSave` — the AUTHORITATIVE atomic gate (ER-C10). Fires before
//      every persist of reportDoc (form submit via U-F8 onSubmit → self.save(); the
//      amendment append via self.collection.parentDoc.save()). On any failure it
//      calls addErrorToStack + returns, which aborts the save so nothing partial
//      persists. This is the documented before-save validation pattern
//      (frontm-ai-doc-field-section-collection-data-modeling-guide § Doc events).
//
// DOCUMENTED-API LIMITATION (flagged, not worked around — see specs/4 task
// MP-FIX-EVIDENCE-METADATA and SPEC.md § "Validation rules"): the FILE_FIELD value
// envelope is exactly { value:<s3-key>, fileName, fileScopeValue } — it carries NO
// content type and NO byte size — and `state.frontmlib` has no S3 HEAD/metadata
// call. So content-type and 25 MB size enforcement are NOT achievable server-side
// here with documented APIs. What IS enforced: file count ≤ MAX_FILES and the
// extension allow-list (lib/validation.js). Inventing a HEAD call or a metadata
// field that does not appear in ./docs/ is forbidden (CLAUDE.md "Do Not Hallucinate
// APIs"), hence the deferral.
//
// U-F7 (contact-method conditional validation) adds its per-method checks to
// this same reportDoc.onSave handler (see the "U-F7" block below).

import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import {
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
} from "../sections/evidence";
import { contactMethodField, contactValueField } from "../sections/contact";
import {
  validateEvidenceEnvelope,
  isWithinEvidenceFileCount,
  isValidContactValue,
  contactValueRequired,
} from "../../../lib/validation";
import {
  ERROR_CODES,
  EVIDENCE_LIMITS,
  CONTACT_METHOD,
  contactMethodFromLabel,
} from "../../../lib/constants";

const evidenceFields = [
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// Layer 1 — on-attach feedback (field-level). self.value is the media envelope
// (or null when nothing is attached — an optional field, so silence is valid).
for (const field of evidenceFields) {
  field.onValidation = async (self) => {
    if (!self.value) return;
    const { valid, reason } = validateEvidenceEnvelope(self.value);
    if (!valid) {
      self.sendValidationResponse({ result: false, message: reason });
    }
  };
}

// ── U-F7: contact-method conditional require/validate ──────────────────────
//
// "Show/require-by-method" is CODE, not a declarative show-if (rule 24). The
// contactMethod DROPDOWN stores LABELS, so map label → token before delegating
// the per-method check to lib/validation.js. Pure evaluator shared by the
// field-level feedback handler and the authoritative onSave gate.

const CONTACT_INVALID_MESSAGE = {
  [CONTACT_METHOD.EMAIL]: "Please enter a valid email address.",
  [CONTACT_METHOD.PHONE]:
    "Please enter a valid phone number (7–15 digits, optional ‘+’).",
  [CONTACT_METHOD.CABIN]:
    "Please enter a valid cabin number (letters and numbers, max 20 characters).",
};

const CONTACT_INVALID_CODE = {
  [CONTACT_METHOD.EMAIL]: ERROR_CODES.INVALID_EMAIL,
  [CONTACT_METHOD.PHONE]: ERROR_CODES.INVALID_PHONE,
  [CONTACT_METHOD.CABIN]: ERROR_CODES.INVALID_CABIN,
};

// Returns { ok, code, message }. ok:true ⇒ nothing to report (None / unset /
// valid). None and legacy-empty methods require no value and never fail here.
const evaluateContact = (methodLabel, rawValue) => {
  const method = contactMethodFromLabel(methodLabel);
  if (!contactValueRequired(method)) return { ok: true };

  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!trimmed) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_CONTACT_VALUE,
      message: `Please provide your ${String(
        methodLabel
      ).toLowerCase()} details so we can reach you, or set Contact method to “None”.`,
    };
  }
  if (!isValidContactValue(method, trimmed)) {
    return {
      ok: false,
      code: CONTACT_INVALID_CODE[method] || ERROR_CODES.INVALID_CONTACT_VALUE,
      message:
        CONTACT_INVALID_MESSAGE[method] ||
        "Please enter valid contact details.",
    };
  }
  return { ok: true };
};

// Layer 1 (contact) — on-edit feedback. Read the sibling method via self.doc
// (cross-field access in a Field handler; CLAUDE.md "Field Access Patterns").
contactValueField.onValidation = async (self) => {
  const methodLabel = self.doc.f[contactMethodField.id].value;
  const { ok, message } = evaluateContact(methodLabel, self.value);
  if (!ok) {
    self.sendValidationResponse({ result: false, message });
  }
};

// Layer 2 — authoritative atomic gate (before persist).
reportDoc.onSave = async (self) => {
  // Collect populated evidence envelopes (envelope present AND has an S3 key).
  const attached = evidenceFields
    .map((field) => self.f[field.id].value)
    .filter((envelope) => envelope && envelope.value);

  if (!isWithinEvidenceFileCount(attached.length)) {
    state.addErrorToStack(
      ERROR_CODES.INVALID_EVIDENCE_FILE,
      `Please attach no more than ${EVIDENCE_LIMITS.MAX_FILES} evidence files.`
    );
    return;
  }

  for (const envelope of attached) {
    const { valid, reason } = validateEvidenceEnvelope(envelope);
    if (!valid) {
      state.addErrorToStack(ERROR_CODES.INVALID_EVIDENCE_FILE, reason);
      return;
    }
  }

  // U-F7 — contact channel. Require + validate by method; abort on failure so
  // nothing partial persists (same atomic-gate contract as evidence above).
  const contactMethodLabel = self.f[contactMethodField.id].value;
  const contact = evaluateContact(
    contactMethodLabel,
    self.f[contactValueField.id].value
  );
  if (!contact.ok) {
    state.addErrorToStack(contact.code, contact.message);
    return;
  }

  // "None" (or unset) hides the value — clear any stray entry so nothing
  // reporter-private persists; otherwise persist the trimmed form. contactValue
  // is encrypted + excluded from adminProjection, so clearing also guarantees a
  // method-switch to None leaves no leaked detail behind.
  if (contactMethodFromLabel(contactMethodLabel) === CONTACT_METHOD.NONE) {
    self.f[contactValueField.id].value = null;
  } else {
    const v = self.f[contactValueField.id].value;
    if (typeof v === "string") {
      self.f[contactValueField.id].value = v.trim();
    }
  }
};

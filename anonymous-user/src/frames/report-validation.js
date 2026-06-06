// U-F6 — Evidence upload validation + atomicity.
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
// EXTENSION POINT: U-F7 (contact-method conditional validation) adds its
// per-method checks to this same reportDoc.onSave handler.

import { state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import {
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
} from "../sections/evidence";
import {
  validateEvidenceEnvelope,
  isWithinEvidenceFileCount,
} from "../../../lib/validation";
import { ERROR_CODES, EVIDENCE_LIMITS } from "../../../lib/constants";

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
};

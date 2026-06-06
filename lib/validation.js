// Input validation + sanitisation — enforced server-side before persist / email /
// HTML-card rendering. See ../REQUIREMENTS.md NFR-2, ER-C10 and ../specs/SPEC.md
// "Validation rules". Pure functions (no state/DB) so they verify on the live
// runtime via a mock-data toggle.

import { CONTACT_METHOD, EVIDENCE_LIMITS } from "./constants";

// RFC-pragmatic email: one @, no spaces, a dot in the domain. Not RFC-5322
// exhaustive on purpose (those regexes are unreadable and reject valid mail).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// E.164-tolerant phone: optional +, then 7–15 digits after stripping spaces,
// dashes, dots and parentheses.
const PHONE_STRIP_RE = /[\s\-().]/g;
const PHONE_RE = /^\+?\d{7,15}$/;

// Cabin: alphanumeric with optional single spaces/dashes, 1–20 chars.
const CABIN_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/;

export const isValidEmail = (value) =>
  typeof value === "string" && EMAIL_RE.test(value.trim());

export const isValidPhone = (value) => {
  if (typeof value !== "string") return false;
  return PHONE_RE.test(value.replace(PHONE_STRIP_RE, ""));
};

export const isValidCabin = (value) =>
  typeof value === "string" && CABIN_RE.test(value.trim());

// Validate the reporter's contactValue against the selected contactMethod (U-F7).
// None → no value required (true). Other methods → run the matching validator.
export const isValidContactValue = (method, value) => {
  switch (method) {
    case CONTACT_METHOD.NONE:
    case undefined:
    case null:
      return true;
    case CONTACT_METHOD.EMAIL:
      return isValidEmail(value);
    case CONTACT_METHOD.PHONE:
      return isValidPhone(value);
    case CONTACT_METHOD.CABIN:
      return isValidCabin(value);
    default:
      return false;
  }
};

// True when contactValue is required (method is set and not None).
export const contactValueRequired = (method) =>
  !!method && method !== CONTACT_METHOD.NONE;

// Incident date: parseable AND not in the future. `nowMs` injectable for tests.
// Tolerant of however the DATE picker surfaces its value: an ISO string
// (YYYY-MM-DD) or any Date-parseable string, a ms-epoch number, or a Date — so a
// genuinely valid date is never wrongly rejected because of the value shape.
export const isValidIncidentDate = (value, nowMs = Date.now()) => {
  if (value === null || value === undefined || value === "") return false;
  let t;
  if (typeof value === "number") {
    t = value;
  } else if (value instanceof Date) {
    t = value.getTime();
  } else if (typeof value === "string") {
    t = Date.parse(value);
  } else {
    return false;
  }
  if (Number.isNaN(t)) return false;
  return t <= Number(nowMs);
};

// Lowercased file extension (no dot) from a filename, or "".
const extensionOf = (fileName) => {
  if (typeof fileName !== "string") return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
};

// True when a content type is allowed (by prefix OR explicit allow-list).
const isAllowedContentType = (contentType) => {
  if (typeof contentType !== "string" || !contentType) return false;
  const ct = contentType.toLowerCase();
  if (EVIDENCE_LIMITS.ALLOWED_CONTENT_TYPES.includes(ct)) return true;
  return EVIDENCE_LIMITS.ALLOWED_CONTENT_TYPE_PREFIXES.some((p) =>
    ct.startsWith(p)
  );
};

// Evidence file validator — extension AND content type AND size ≤ limit
// (D1, ER-C10). Returns { valid, reason } so callers can surface a clear error.
// `file` = { fileName, contentType, sizeBytes }.
export const validateEvidenceFile = (file) => {
  if (!file) return { valid: false, reason: "No file provided." };
  const { fileName, contentType, sizeBytes } = file;
  const ext = extensionOf(fileName);
  if (!ext || !EVIDENCE_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, reason: `File type .${ext || "?"} is not allowed.` };
  }
  if (!isAllowedContentType(contentType)) {
    return { valid: false, reason: `Content type ${contentType || "?"} is not allowed.` };
  }
  if (typeof sizeBytes !== "number" || sizeBytes <= 0) {
    return { valid: false, reason: "File size could not be determined." };
  }
  if (sizeBytes > EVIDENCE_LIMITS.MAX_FILE_BYTES) {
    return { valid: false, reason: "File exceeds the 25 MB limit." };
  }
  return { valid: true, reason: "" };
};

// Boolean convenience wrapper.
export const isValidEvidenceFile = (file) => validateEvidenceFile(file).valid;

// Validate an evidence FILE_FIELD value ENVELOPE as surfaced by the framework at
// submit time: { value: <s3-key>, fileName, fileScopeValue }. The envelope carries
// NO content type and NO byte size (docs: frontm-ai-field-class-comprehensive-guide
// § "Media Field Value Shape"), and `state.frontmlib` exposes no S3 HEAD/metadata
// call (only getS3SignedUrl / getS3UploadSignedUrl). So the only evidence check
// ENFORCEABLE server-side from a Doc handler is the extension allow-list. Content
// type + size enforcement is DEFERRED — see specs/4 task MP-FIX-EVIDENCE-METADATA
// and SPEC.md § "Validation rules". For callers that DO have full metadata (e.g. a
// server-mediated upload pipeline that knows contentType + sizeBytes) use
// validateEvidenceFile instead, which checks all three (D1, ER-C10).
export const validateEvidenceEnvelope = (envelope) => {
  if (!envelope || !envelope.value) {
    return { valid: false, reason: "No file attached." };
  }
  const ext = extensionOf(envelope.fileName);
  if (!ext || !EVIDENCE_LIMITS.ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, reason: `File type .${ext || "?"} is not allowed.` };
  }
  return { valid: true, reason: "" };
};

// True when the number of attached evidence files is within the allowed maximum
// (D1). `count` is the number of populated evidenceFile* fields.
export const isWithinEvidenceFileCount = (count) =>
  typeof count === "number" && count >= 0 && count <= EVIDENCE_LIMITS.MAX_FILES;

// Strip HTML from free-text before persisting / using in email or HTML cards.
// Removes tags and decodes nothing (we never want raw markup stored). For
// HTML-card *rendering* of already-stored text, also pass through escapeHtml
// (lib/utils/format.js) — defence in depth.
export const sanitiseText = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/<[^>]*>/g, "") // strip tags
    .replace(/[<>]/g, "") // strip any stray angle brackets
    .trim();
};

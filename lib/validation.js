// Input validation + sanitisation — enforced server-side before persist / email /
// HTML-card rendering. See ../REQUIREMENTS.md NFR-2 and ../specs/SPEC.md.
// NOTE: skeleton placeholders — implemented during the foundation (B1) build.

// Field validators — return true when valid.
export const isValidEmail = () => false;
export const isValidPhone = () => false;
export const isValidCabin = () => false;

// Incident date must parse and not be in the future.
export const isValidIncidentDate = () => false;

// Evidence file validator (extension + content type + size limit).
export const isValidEvidenceFile = () => false;

// Escapes/strips HTML from free-text before any email or HTML-card use.
export const sanitiseText = (value) => value;

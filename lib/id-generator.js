// Collision-resistant identifier generation for reports (RPT-) and calls (CALL-).
// See ../specs/SPEC.md. Single module for both apps (zero duplication).
//
// Uniqueness strategy: a reasonably long random suffix over a 31-char ambiguity-
// free alphabet (~31^10 ≈ 8.2e14 report-id space) makes collisions vanishingly
// rare; callers MUST still retry on a unique-index violation (ER-B9) — id
// generation alone never guarantees DB uniqueness.

import { ID } from "./constants";

// Pick `length` chars uniformly from `alphabet`. Math.random is sufficient for
// non-secret, collision-resistant references (these are not security tokens).
const randomChars = (length, alphabet) => {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
};

// Generic prefixed id, e.g. generateId("RPT-", 10) -> "RPT-AB23CD45EF".
export const generateId = (prefix, length, alphabet = ID.ALPHABET) =>
  `${prefix}${randomChars(length, alphabet)}`;

// Report tracking id, e.g. "RPT-AB23CD45EF". Retry on unique-index collision.
export const generateReportId = () =>
  generateId(ID.REPORT_PREFIX, ID.REPORT_LENGTH);

// Opaque, non-identifying call reference (call-queue PK), e.g. "CALL-7K2M9PQR3T".
export const generateCallRef = () =>
  generateId(ID.CALL_PREFIX, ID.CALL_LENGTH);

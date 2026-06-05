// Shared "admin-availability" collection — per-admin on-call status.
// shared: true → admin_availability_${systemId}. Calling reads `available` rows
// to ring; the Admin app writes the caller's own status.
// See ../../REQUIREMENTS.md §8 (FR-C2) and ../../specs/SPEC.md.
//
// Both apps side-effect-import this to register the Doc + Collection at bundle load.
// NOTE: skeleton placeholder — no Doc/Collection instantiated yet.
export {};

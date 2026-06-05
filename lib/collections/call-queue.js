// Shared "call-queue" collection — one entry per anonymous call attempt.
// shared: true → call_queue_${systemId}. IDENTITY-FREE (no reporter id/email/name).
// See ../../REQUIREMENTS.md §7.8 and ../../specs/SPEC.md.
//
// Both apps side-effect-import this to register the Doc + Collection at bundle load.
// NOTE: skeleton placeholder — no Doc/Collection instantiated yet.
export {};

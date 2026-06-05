// Shared "admin-users" collection — the seeded admin registry (decision D3).
// shared: true → admin_users_${systemId}. Single source for: admin access gating,
// PRIMARY/SECONDARY role + routing, conflict-of-interest recusal, on-call
// availability, and call ringing. Replaces the earlier separate availability store.
// Fields (see ../../specs/SPEC.md): adminUserId (PK), adminEmail, role, availability, updatedOn.
//
// Both apps side-effect-import this to register the Doc + Collection at bundle load.
// NOTE: skeleton placeholder — no Doc/Collection instantiated yet.
export {};

// Shared "reports" collection — the single Doc + Collection definition consumed
// by BOTH microapps (shared: true → reports_${systemId}, audit: true).
// See ../../REQUIREMENTS.md §4–§5 and ../../specs/SPEC.md.
//
// Both apps side-effect-import this module from their src/main.js to register the
// Doc + Collection at bundle load. The Doc, its Fields, and the Collection are
// defined here during the foundation (B1) build.
//
// NOTE: skeleton placeholder — no Doc/Collection instantiated yet.
export {};

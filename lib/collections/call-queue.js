// Shared "call-queue" collection — one entry per anonymous call attempt.
// shared: true → MongoDB `call_queue_${systemId}` (suffix applied by the framework).
// IDENTITY-FREE by construction: this collection NEVER stores reporter id/email/
// name. PK: callRef (opaque, from lib/id-generator.generateCallRef).
// See ../../REQUIREMENTS.md §7.8 and ../../specs/SPEC.md "Anonymous calling data model".
//
// Both apps side-effect-import this to register the Doc + Collection at bundle load.
// Fields/Sections are defined per-app (admin answers calls; user side creates the
// RINGING entry + voicemail path).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { Collection } from "@frontmltd/frontmjs/core/Collection";
import { state } from "@frontmltd/frontmjs/core/State";

export const callQueueDoc = new Doc("callQueueDoc", state, {
  autoSave: true,
});

export const callQueueCollection = new Collection("callQueueCollection", {
  title: "Call queue",
  document: callQueueDoc,
  name: "call_queue", // → call_queue_${systemId}
  shared: true,
  state,
});

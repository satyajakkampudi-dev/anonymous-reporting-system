// Aux Data Doc: callQueueDoc (call-queue) — admin answers/claims/ends calls (A-F21/22).
//
// Shared Doc registered once in lib/collections/call-queue.js, re-exported here so
// src/sections/call-queue.js attaches the field schema to one local import. The
// collection is IDENTITY-FREE by construction — it NEVER stores reporter id/email/name
// (SPEC.md "Anonymous calling data model"). Loaded by callRef.

import {
  callQueueDoc,
  callQueueCollection,
} from "../../../lib/collections/call-queue";

export { callQueueDoc, callQueueCollection };

// Aux Data Doc: callQueueDoc (call-queue) - user side creates the RINGING entry
// (U-F15), the voicemail/MISSED path (U-F16) and the abandon/end transitions (U-F17).
//
// Shared Doc registered once in lib/collections/call-queue.js, re-exported here so
// src/sections/call-queue.js attaches the field schema to one local import (rule 6).
// The collection is IDENTITY-FREE by construction - it NEVER stores reporter
// id/email/name (SPEC.md "Anonymous calling data model"). Loaded/saved by callRef.

import {
  callQueueDoc,
  callQueueCollection,
} from "../../../lib/collections/call-queue";

export { callQueueDoc, callQueueCollection };

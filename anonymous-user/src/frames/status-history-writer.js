// Status-history writer - the append half of "the transition path" (rule 12).
//
// statusHistory is an APPEND-ONLY embedded sub-collection on reportDoc (rule 25):
// written ONLY in code, never via a popup. Every status change (creation → OPEN
// here in U-F8; the reporter transitions U-F10/F11/F12; the admin transitions) adds
// exactly ONE row recording { fromStatus, toStatus, actorRole, changedOn, note }.
// actorRole is a ROLE token only - NEVER an id (anonymity, SPEC.md / rule 16).
//
// Two exports:
//   - getStatusHistoryCollection(parentDoc) - the LIVE embedded collection. Reached
//     via the parent's own subCollections (doc-modeling guide § "Working with
//     Sub-collections": parentDoc.subCollections) so we operate on the instance the
//     framework will serialise on parentDoc.save(), NOT a stale module singleton
//     (CLAUDE.md "Collection and parent-Doc access"). Falls back to the registered
//     singleton if the live array is unavailable (cold-graph defence).
//   - appendStatusHistoryRow(parentDoc, {...}) - generates the hidden row PK on the
//     registered statusHistoryDoc, stamps changedOn, and addRow()s it to the live
//     collection. The CALLER is responsible for idempotency (don't append a row that
//     already exists) - see submit-report.js, which only appends the creation row
//     when no OPEN/REPORTER row is present yet.
//
// One append per Lambda invocation: the registered statusHistoryDoc instance is
// reused as the new row (the same pattern the framework uses for popup-add rows -
// addRow(self) on the registered Doc). Across invocations the previously-saved rows
// come back from MongoDB as their own instances, so the singleton is free again.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { statusHistoryDoc } from "../docs/report-doc";
import {
  statusHistoryCollection,
  historyIdField,
  fromStatusField,
  toStatusField,
  actorRoleField,
  changedOnField,
  noteField,
} from "../sections/status-history";

// The live embedded statusHistory collection on `parentDoc` (reportDoc). Matched by
// the collection's array-property name so we never hardcode "statusHistory" (rule 19).
export const getStatusHistoryCollection = (parentDoc) => {
  const live = (parentDoc?.subCollections || []).find(
    (c) => c && c.name === statusHistoryCollection.name
  );
  return live || statusHistoryCollection;
};

// Append a single status-history row to parentDoc's live embedded collection.
// Does NOT persist - the caller saves the parent (parentDoc.save()) so the append is
// atomic with the rest of the report write. Returns the appended row.
export const appendStatusHistoryRow = (
  parentDoc,
  { fromStatus = "", toStatus, actorRole, note = "" }
) => {
  const id = state.getUniqueId();
  const row = statusHistoryDoc; // registered row instance; one append per invocation.
  row.docId = id;
  row.f[historyIdField.id].value = id;
  row.f[fromStatusField.id].value = fromStatus || "";
  row.f[toStatusField.id].value = toStatus;
  row.f[actorRoleField.id].value = actorRole;
  row.f[changedOnField.id].value = Date.now();
  row.f[noteField.id].value = note || "";

  const collection = getStatusHistoryCollection(parentDoc);
  if (!collection.rows.some((r) => r === row)) {
    collection.addRow(row);
  }
  // DIAGNOSTIC - confirm the row landed on the LIVE sub-collection that
  // saveDocWithSubCollections serialises (parentDoc.subCollections). isLive=false means
  // it went to the stale module singleton → the timeline row will NOT persist.
  const isLive = (parentDoc?.subCollections || []).some(
    (c) => c === collection
  );
  D.log({
    message: "appendStatusHistoryRow: row appended",
    data: { toStatus, actorRole, isLive, rows: collection.rows.length },
  });
  return row;
};

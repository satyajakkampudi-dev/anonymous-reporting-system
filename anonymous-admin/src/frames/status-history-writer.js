// Status-history writer (admin side) — the append half of "the transition path"
// (framework-mapping rule 12). The admin analogue of the committed user-side
// src/frames/status-history-writer.js; same contract, admin-local imports.
//
// statusHistory is an APPEND-ONLY embedded sub-collection on adminReportDoc
// (rule 25/30): written ONLY in code by the transition path, never via a popup,
// display-only on the admin side. Every admin transition (takeReview / resolve /
// escalate / closeRejected) adds exactly ONE row recording
// { fromStatus, toStatus, actorRole, changedOn, note }. actorRole is a ROLE token
// only — NEVER an id (anonymity; SPEC.md / rule 16). It passes through
// adminProjection unchanged.
//
// WHY the live sub-collection (rule 21 / CLAUDE.md "Collection and parent-Doc
// access"): adminReportDoc.save() persists the embedded array via a MongoDB
// `$set` of the WHOLE `statusHistory` array (Doc.js _dbDocument →
// updateDataInCollection updateOperator "$set"). So a transition MUST first
// loadDocument({ reportId }) to hydrate the prior rows into the live
// sub-collection, then append to THAT instance — otherwise the $set would
// replace the timeline with just the new row. We reach the live collection via
// the loaded parent's own `subCollections` (the instance the framework will
// serialise), NOT the module-singleton, falling back to the singleton only if the
// live array is unavailable (cold-graph defence).
//
// One append per Lambda invocation: the registered statusHistoryDoc instance is
// reused as the new row (the same pattern the framework uses for popup-add rows).
// Across invocations the previously-saved rows return from MongoDB as their own
// instances, so the singleton is free again.

import { state } from "@frontmltd/frontmjs/core/State";
import { statusHistoryDoc } from "../docs/admin-report-doc";
import {
  statusHistoryCollection,
  historyIdField,
  fromStatusField,
  toStatusField,
  actorRoleField,
  changedOnField,
  noteField,
} from "../sections/status-history";

// The live embedded statusHistory collection on `parentDoc` (adminReportDoc).
// Matched by the collection's array-property name so we never hardcode
// "statusHistory" (rule 19).
export const getStatusHistoryCollection = (parentDoc) => {
  const live = (parentDoc?.subCollections || []).find(
    (c) => c && c.name === statusHistoryCollection.name
  );
  return live || statusHistoryCollection;
};

// Append a single status-history row to parentDoc's live embedded collection.
// Does NOT persist — the caller saves the parent (adminReportDoc.save()) so the
// append is atomic with the rest of the report write. Returns the appended row.
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
  return row;
};

// Persist a Doc whose embedded sub-collections were mutated IN CODE this invocation
// (the append-only statusHistory timeline and the amendments collection).
//
// THE BUG THIS FIXES: Doc.save() serialises `this._dbDocument`. Adding a row via
// Collection.addRow updates only the ROW's own `_dbDocument` - it NEVER refreshes the
// PARENT's `_dbDocument[<collectionName>]` array. The framework normally refreshes that
// array from the Redis autoSaveBuffer inside Doc.loadDocFromAutoSaveBuffer
// (`this._dbDocument[child._collectionName] = child.rowAsDBDocumentsArray()`), but that
// buffer-accumulation path requires Context.Create - which THIS app cannot use: its
// popup-trigger / button dispatches carry no usable tabId, so Context.Create throws
// "Cannot set properties of undefined (setting 'currentTabId')". As a result every
// in-code sub-row (statusHistory creation row, each amendment) was dropped on save and
// the embedded arrays persisted as [].
//
// THE FIX: replicate the framework's OWN sync line explicitly for every sub-collection
// immediately before save(). `rowAsDBDocumentsArray()` returns each row's live,
// dbName-keyed `_dbDocument`; we write it under the collection's `name` (the same key
// buildDocumentFromContainer reads back), so the rows round-trip on the next load and
// genuinely accumulate in MongoDB (no override, full timeline). Pure: operates only on
// the passed Doc + its own collections, no app imports.
import { D } from "@frontmltd/frontmjs/core/State";

export const saveDocWithSubCollections = async (doc) => {
  if (!doc) return;
  const synced = [];
  for (const coll of doc.subCollections || []) {
    if (coll && typeof coll.rowAsDBDocumentsArray === "function") {
      // Use the RAW array-property name (_collectionName, e.g. "statusHistory"), NOT
      // coll.name - the `name` getter returns the SUFFIXED MongoDB storage name
      // (`statusHistory_<botId>`). The embedded array lives under the raw key, and
      // buildDocumentFromContainer reads it back via `child._collectionName`. This is
      // exactly the framework's own sync line (Doc.loadDocFromAutoSaveBuffer). Writing
      // under coll.name put the rows under a junk key → timeline empty + amend override.
      const key = coll._collectionName || coll.name;
      if (!key) continue;
      const arr = coll.rowAsDBDocumentsArray();
      doc._dbDocument[key] = arr;
      synced.push({ key, rows: arr.length });
    }
  }
  // DIAGNOSTIC - which sub-collections + how many rows are being persisted. If a
  // sub-collection (e.g. statusHistory) is absent here, it was never registered on
  // doc.subCollections; if rows is 0 the append landed on a different instance.
  D.log({
    message: "saveDocWithSubCollections: syncing sub-collections before save",
    data: { docId: doc.docId, synced },
  });
  await doc.save();
};

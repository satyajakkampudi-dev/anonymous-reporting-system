// Display Doc - the ONLY Doc sendResponse()d in the Two-Doc architecture
// (framework-mapping rule 4/8). reportDoc (Data Doc) owns the Fields, the
// sub-collections and persistence; this Doc owns ONLY the CardsSet display
// sections (Home, My Reports, the detail cards, timeline). HTML cards read
// field values from reportDoc.
//
// NO title - single-tab app; a title here would stack with the tab title and
// the card heading (framework-mapping "Display Doc, single-tab app: no title").
// autoSave: false - display state is never persisted (only reportDoc autosaves).
//
// docs/ import nothing but state (AGENTS.md dependency tree: docs/ → nothing).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { state } from "@frontmltd/frontmjs/core/State";

export const reportDisplayDoc = new Doc("reportDisplayDoc", state, {
  autoSave: false,
});

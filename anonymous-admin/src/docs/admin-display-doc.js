// Display Doc — the ONLY Doc sendResponse()d in the Two-Doc architecture
// (framework-mapping rule 4/8). adminReportDoc (Data Doc) owns the adminProjection
// Fields, the two embedded sub-collections and persistence; this Doc owns ONLY the
// CardsSet display sections (Dashboard, Queue, the Manage detail cards, timeline,
// amendments, alerts, on-call, incoming-call). HTML cards read field values from
// adminReportDoc (and, for onCall / incomingCall, from adminUserDoc / callQueueDoc
// in their A-D-* content tasks) — the SECTION always lives here, on the only Doc sent.
//
// NO title — single-tab app; a title here would stack with the tab title and the
// card heading (framework-mapping "Display Doc, single-tab app: no title").
// autoSave: false — display state is never persisted (only adminReportDoc autosaves).
//
// docs/ import nothing but state (AGENTS.md dependency tree: docs/ → nothing app-local).

import { Doc } from "@frontmltd/frontmjs/core/Doc";
import { state } from "@frontmltd/frontmjs/core/State";

export const adminDisplayDoc = new Doc("adminDisplayDoc", state, {
  autoSave: false,
});

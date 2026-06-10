// Navigation intent: openQueue - the report queue (role-filtered + recused + priority),
// SERVER-PAGINATED (MP-FIX-QUEUE-SERVER-PAGINATION).
//
// Independent intent (Context B). Loads reports ONLY through the anonymity gateway
// (rule 15) - never a direct query.
//
// PRODUCER (A-F4 role filter + recusal, A-F5 priority surfacing/sort/quick-filter). This
// frame is the SINGLE producer of the queue stashes the Display-Doc renderer consumes:
//   STATE_KEYS.QUEUE_REPORTS       - the identity-free, recused, projected ROW of the
//                                    current page (role + filter + priority sort applied
//                                    server-side in the Mongo query).
//   STATE_KEYS.QUEUE_ACTIVE_FILTER - the active quick-filter chip (renderer highlights it).
//   STATE_KEYS.QUEUE_PAGE / QUEUE_HAS_MORE - the prev/next control state.
// The query + sort builders live in the PURE, testable lib/queue.js (buildQueueQuery), the
// recusal page-filter + projection in projectQueueRows. Role → assignedTo query and the
// priority float → the STORED priorityRank sort key (reportDoc.onSave / priorityRankFor) -
// the SAME isPriority the A-F2 dashboard uses, so no drift. Each page click is ONE bounded
// DB read (limit PAGE_SIZE+1, skip) - the queue never loads the full set.
//
// Free-text recusal (accusedParty) is NOT a query, so it trims the fetched page in-code;
// a page may therefore render < PAGE_SIZE rows in the rare recusal case (D9).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import {
  loadReportsForAdmin,
  resolveAdminRole,
  resolveAdminIdentity,
} from "../../../lib/access";
import { buildQueueQuery, projectQueueRows } from "../../../lib/queue";
import { LIST_PAGE_SIZE, userTab } from "../../../lib/constants";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { CONTEXT, INTENT, STATE_KEYS, QUEUE_FILTER } from "../constants";

export const openQueue = Intent.Create({
  intentId: INTENT.OPEN_QUEUE,
  prompt: "Open the report queue",
  state,
});

// Coerce an inbound filter token (invoke_intent payload, one level deep) to a known
// QUEUE_FILTER value; anything missing/unknown falls back to ALL (never narrows wrongly).
const normaliseFilter = (raw) =>
  Object.values(QUEUE_FILTER).includes(raw) ? raw : QUEUE_FILTER.ALL;

openQueue.onResolution = async () => {
  // Stable per-screen tab (rule 37): reuse the SAME contextId so the queue
  // re-renders IN PLACE on every quick-filter chip / pagination click - no new tab.
  await Context.CreateAndInit(userTab(CONTEXT.QUEUE, state), { state });

  // Active quick-filter from the chip / dashboard card click (Context-B payload is one
  // level deep under .payload - rule "Custom HTML Payloads").
  const activeFilter = normaliseFilter(state.messageFromUser?.payload?.filter);

  // Resolve the viewing admin's role (role filter) + own identity (recusal). Both come
  // from lib/access (the single gating source); identity.adminEmail is used SOLELY to
  // recuse and is never written or sent (rule 30). A caller who is somehow not in the
  // admin registry (the access gate A-F1 should have stopped them) resolves to null →
  // buildQueueQuery treats the role as "not secondary" (PRIMARY-routed set only) and
  // recusal is a no-op, so we fail closed to the narrowest non-erroring view.
  const viewingRole = await resolveAdminRole();
  const identity = await resolveAdminIdentity();

  // SERVER-SIDE pagination (MP-FIX-QUEUE-SERVER-PAGINATION). Build the Mongo query + sort
  // for this role + quick-filter (priority float = the stored priorityRank sort), then read
  // ONE bounded page through the gateway (rule 15) - over-fetch by 1 to detect a next page.
  // Every page click is its own DB read; the queue never loads the full set.
  const { query, sort } = buildQueueQuery({
    viewingRole,
    filter: activeFilter,
  });
  const page =
    Number(state.messageFromUser?.payload?.page) >= 0
      ? Number(state.messageFromUser.payload.page)
      : 0;
  const skip = page * LIST_PAGE_SIZE;
  const fetched = await loadReportsForAdmin({
    query,
    sort,
    skip,
    limit: LIST_PAGE_SIZE + 1, // over-fetch by 1 → hasMore without a count query
  });

  // hasMore from the raw DB over-fetch (before recusal - recusal only trims the displayed
  // page, it does not change whether more rows exist in the DB beyond this page).
  const hasMore = fetched.length > LIST_PAGE_SIZE;
  // Recuse + project the page IN-CODE (free-text accusedParty match is not a query). The
  // page therefore renders ≤ LIST_PAGE_SIZE rows - fewer in the rare recusal case (D9).
  const pageReports = projectQueueRows({
    reports: fetched.slice(0, LIST_PAGE_SIZE),
    identity,
  });

  // Stash the PAGE (+ page/hasMore for the control) BEFORE the render (the renderer's
  // onResponse is not awaited and cannot load - rule 11/18). Empty → empty state.
  state.setField(STATE_KEYS.QUEUE_REPORTS, pageReports);
  state.setField(STATE_KEYS.QUEUE_ACTIVE_FILTER, activeFilter);
  state.setField(STATE_KEYS.QUEUE_PAGE, page);
  state.setField(STATE_KEYS.QUEUE_HAS_MORE, hasMore);

  D.log({
    message: "openQueue produced queue stash (server-paginated)",
    data: {
      // The actual Mongo query + sort sent this page click (TRACE - confirms server-side
      // paging: a per-page skip/limit read, role/filter in the query, priorityRank float).
      query,
      sort,
      limit: LIST_PAGE_SIZE + 1,
      fetched: fetched.length,
      page,
      skip,
      shown: pageReports.length,
      hasMore,
      filter: activeFilter,
      // identity-free reportIds returned this page (no reporterId/contact - anonymity).
      reportIds: pageReports.map((r) => r.reportId),
      // role token only - never an email/id (anonymity; identity used solely to recuse).
      viewingRole: viewingRole || "UNKNOWN",
    },
  });

  // Route to the Queue screen (only the report-queue section visible) and render the
  // Display Doc (rule 4/8). The QUEUE_REPORTS / QUEUE_ACTIVE_FILTER stashes above feed
  // the A-D-queue onResponse fired by this sendResponse.
  showScreen(SCREEN.QUEUE);
  adminDisplayDoc.sendResponse();
};

// Navigation intent: openQueue — the report queue (role-filtered + recused + priority).
//
// Independent intent (Context B). Context.Create preserves the buffer (rule 22). Loads
// reports ONLY through the anonymity gateway (rule 15) — never a direct query.
//
// PRODUCER (A-F4 role filter + recusal, A-F5 priority surfacing/sort/quick-filter). This
// frame is the SINGLE producer of the two queue stashes the Display-Doc renderer consumes:
//   STATE_KEYS.QUEUE_REPORTS       — the identity-free, role-filtered, recused,
//                                    priority-sorted, quick-filtered report list.
//   STATE_KEYS.QUEUE_ACTIVE_FILTER — the active quick-filter chip (so the renderer
//                                    highlights it).
// The filter/recusal/sort logic lives in the PURE, testable lib/queue.js (mirroring
// lib/sla.js / lib/dashboard-stats.js) so it is single-sourced and verifiable. Routing/role
// come ONLY from lib/access (resolveTargetRoleFor inside lib/queue, rule 14); the priority
// predicate is the SHARED isPriority (lib/dashboard-stats, identical to the A-F2 dashboard
// 'Priority / Escalated' count — no drift).
//
// The Display-Doc render swap (showing the queue section instead of this placeholder) is
// the SEPARATE nav-display-routing fix — this frame ONLY produces the stashes, then keeps
// the existing placeholder sendResponse. The queue renderer (A-D-queue) reads the stashes.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import {
  loadReportsForAdmin,
  resolveAdminRole,
  resolveAdminIdentity,
} from "../../../lib/access";
import { buildQueueReports } from "../../../lib/queue";
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
  // re-renders IN PLACE on every quick-filter chip / pagination click — no new tab.
  await Context.CreateAndInit(userTab(CONTEXT.QUEUE, state), { state });

  // Active quick-filter from the chip / dashboard card click (Context-B payload is one
  // level deep under .payload — rule "Custom HTML Payloads").
  const activeFilter = normaliseFilter(state.messageFromUser?.payload?.filter);

  // Read ONLY through the gateway (rule 15) — identity-free, projection-applied.
  const reports = await loadReportsForAdmin({});

  // Resolve the viewing admin's role (role filter) + own identity (recusal). Both come
  // from lib/access (the single gating source); identity.adminEmail is used SOLELY to
  // recuse and is never written or sent (rule 30). A caller who is somehow not in the
  // admin registry (the access gate A-F1 should have stopped them) resolves to null →
  // buildQueueReports treats the role as "not secondary" (primary set only) and recusal
  // as a no-op, so we fail closed to the narrowest non-erroring view.
  const viewingRole = await resolveAdminRole();
  const identity = await resolveAdminIdentity();

  const queueReports = buildQueueReports({
    reports,
    viewingRole,
    identity,
    filter: activeFilter,
  });

  // Pagination (rule 36) — IN-MEMORY slice of the role-filtered + recused + priority-sorted
  // list (the priority-float sort + free-text recusal can't be a Mongo sort/query, and the
  // full set is already loaded for the dashboard, so we slice here). A filter chip emits
  // { filter } (no page) → page 0; the prev/next control emits { page, filter }.
  const page =
    Number(state.messageFromUser?.payload?.page) >= 0
      ? Number(state.messageFromUser.payload.page)
      : 0;
  const start = page * LIST_PAGE_SIZE;
  const pageReports = queueReports.slice(start, start + LIST_PAGE_SIZE);
  const hasMore = queueReports.length > start + LIST_PAGE_SIZE;

  // Stash the PAGE (+ page/hasMore for the control) BEFORE the render (the renderer's
  // onResponse is not awaited and cannot load — rule 11/18). Empty → empty state.
  state.setField(STATE_KEYS.QUEUE_REPORTS, pageReports);
  state.setField(STATE_KEYS.QUEUE_ACTIVE_FILTER, activeFilter);
  state.setField(STATE_KEYS.QUEUE_PAGE, page);
  state.setField(STATE_KEYS.QUEUE_HAS_MORE, hasMore);

  D.log({
    message: "openQueue produced queue stash",
    data: {
      loaded: reports.length,
      total: queueReports.length,
      page,
      shown: pageReports.length,
      hasMore,
      filter: activeFilter,
      // role token only — never an email/id (anonymity; identity used solely to recuse).
      viewingRole: viewingRole || "UNKNOWN",
    },
  });

  // Route to the Queue screen (only the report-queue section visible) and render the
  // Display Doc (rule 4/8). The QUEUE_REPORTS / QUEUE_ACTIVE_FILTER stashes above feed
  // the A-D-queue onResponse fired by this sendResponse.
  showScreen(SCREEN.QUEUE);
  adminDisplayDoc.sendResponse();
};

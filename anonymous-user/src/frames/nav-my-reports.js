// Navigation intent: openMyReports — load the reporter's own reports.
//
// Independent intent (Context B): the collection graph is empty, so we MUST
// loadCollectionWithQuery before reading (rule 20). Scoped to the current reporter
// (reporterId === userId) — never another user's reports. SCAFFOLD: the list HTML
// card is U-D-myreports; here we load + emit a placeholder confirmation so the load
// path is verifiable.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportsCollection } from "../collections/reports";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import {
  CONTEXT,
  INTENT,
  STATE_KEYS,
  MY_REPORTS_STATUS_GROUP,
  MY_REPORTS_CATEGORY_ALL,
} from "../constants";
import { LIST_PAGE_SIZE, userTab } from "../../../lib/constants";
import { statusesForGroup } from "../sections/display/my-reports";

export const openMyReports = Intent.Create({
  intentId: INTENT.OPEN_MY_REPORTS,
  prompt: "Show my submitted reports",
  state,
});

openMyReports.onResolution = async () => {
  // Stable per-screen tab (rule 37): the framework keys each tab by the contextId
  // STRING, and an invoke_intent click carries NO tabId (messageFromUser has only
  // intentId + payload; state.currentTabId is null) — so Context.Create is unusable and
  // a `user_${getUniqueId()}` id opens a new tab per click. Reusing the stable MY_REPORTS
  // id re-renders the list IN PLACE on every filter chip.
  await Context.CreateAndInit(userTab(CONTEXT.MY_REPORTS, state), { state });
  // MP-FIX-NAV — stash the active filter so the render handler (my-reports/index.js
  // onResponse) can apply it. The status/category chips are intent buttons that emit
  // openMyReports with a { statusGroup, category } data-payload — delivered ONE level
  // deep under state.messageFromUser.payload (CLAUDE.md invoke_intent envelope). A
  // chip-less open (Home nav, or the post-submit continueWithIntent which drops
  // messageFromUser) carries no payload → reset to ALL/ALL so the full list shows.
  // A filter chip emits { statusGroup, category } (no page) → reset to page 0. The prev/next
  // pagination control emits { page, statusGroup, category } → use that page. A chip-less open
  // (Home nav / post-submit continueWithIntent) carries no payload → ALL/ALL, page 0.
  const payload = state.messageFromUser?.payload || {};
  const statusGroup = payload.statusGroup || MY_REPORTS_STATUS_GROUP.ALL;
  const category = payload.category || MY_REPORTS_CATEGORY_ALL;
  const page = Number(payload.page) >= 0 ? Number(payload.page) : 0;
  state.setField(STATE_KEYS.MY_REPORTS_FILTER, { statusGroup, category, page });

  // Build the SERVER-SIDE query (rule 36): reporter-scoped + status-group + category, sorted
  // newest-first, paged via skip/limit. Over-fetch by 1 so the renderer can detect "more".
  const query = { reporterId: state.user?.userId };
  const statuses = statusesForGroup(statusGroup);
  if (statuses) query.status = { $in: statuses };
  if (category !== MY_REPORTS_CATEGORY_ALL) query.category = category;

  D.log({
    message: "openMyReports: start",
    data: { statusGroup, category, page },
  });
  await reportsCollection.loadCollectionWithQuery({
    query,
    sort: { createdOn: -1 },
    limit: LIST_PAGE_SIZE + 1,
    skip: page * LIST_PAGE_SIZE,
  });
  D.log({
    message: "openMyReports: reports loaded",
    data: {
      statusGroup,
      category,
      page,
      count: reportsCollection.rows?.length || 0,
    },
  });
  // Two-Doc: render the My Reports list via the Display Doc.
  showScreen(SCREEN.MY_REPORTS);
  reportDisplayDoc.sendResponse();
};

// Display section: My Reports list (schema id: myReportsList, row 1).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-myreports fills the card content. readOnly: true because each row hosts an
// inline Open (openReportDetail) button — the card surface must not swallow clicks.
//
// This section is a custom_card collection list (framework-mapping § "custom_card
// (regular section)" + rule 8). onResponse runs as a Context-A render handler
// during reportDisplayDoc.sendResponse() — the same invocation in which app-start
// (and, post MP-FIX-NAV, the openMyReports loader) called
// reportsCollection.loadCollectionWithQuery({ reporterId }), so reportsCollection.rows
// is populated and reporter-scoped. It is ALSO empty-safe: a brand-new reporter has
// zero rows and gets the empty state. onResponse is SYNCHRONOUS (the framework does
// NOT await it — CLAUDE.md "Render handlers are NOT awaited"); nothing async here.
//
// Filters: the status-group and category chips are intent buttons that emit
// openMyReports with a { statusGroup, category } data-payload; the active filter is
// read back from state.getField(MY_REPORTS_FILTER) and applied to the rows here, so
// once the loader stashes the payload (follow-up fix task) filtering is end-to-end.
// The search:reportId box is deferred to that same fix task (a text input needs an
// intent round-trip the nav frame does not yet provide).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportsCollection } from "../../../collections/reports";
import {
  reportIdField,
  statusField,
  categoryField,
  urgencyField,
  createdOnField,
} from "../../report-details";
import {
  INTENT,
  STATE_KEYS,
  MY_REPORTS_STATUS_GROUP,
  MY_REPORTS_CATEGORY_ALL,
} from "../../../constants";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  LIST_PAGE_SIZE,
} from "../../../../../lib/constants";
import { STATUS, isTerminal } from "../../../../../lib/ticket-status";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderPaginationControls } from "../../../../../lib/utils/pagination";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const myReportsListSection = new Section("myReportsListSection", {
  doc: reportDisplayDoc,
  grid: { row: 1, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const myReportsListCardsSet = new CardsSet("myReportsListCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

myReportsListSection.cardsSet = myReportsListCardsSet;

export const myReportsListPlaceholderCard = new Card(
  "myReportsListPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: myReportsListCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[My Reports list]</div>',
    state,
  }
);

// Coarse status group for the filter chips, DERIVED from the shared state machine
// so the user app never re-encodes status semantics: terminal → Done; the two
// not-yet-triaged statuses → Open; every other live status → In progress.
export const statusGroupOf = (status) => {
  if (isTerminal(status)) return MY_REPORTS_STATUS_GROUP.DONE;
  if (status === STATUS.OPEN || status === STATUS.REOPENED) {
    return MY_REPORTS_STATUS_GROUP.OPEN;
  }
  // RESOLVED has its own chip (admin resolved it; awaiting the reporter's accept/reject).
  if (status === STATUS.RESOLVED) return MY_REPORTS_STATUS_GROUP.RESOLVED;
  // Remaining live states (UNDER_REVIEW / ESCALATED) → In progress.
  return MY_REPORTS_STATUS_GROUP.IN_PROGRESS;
};

// INVERSE of statusGroupOf — the STATUS tokens in a chip group, for the server-side
// query (`status: { $in: statusesForGroup(group) }`). Derived from statusGroupOf so the
// query and the chip semantics can never drift. Returns null for ALL (no status filter).
export const statusesForGroup = (group) => {
  if (!group || group === MY_REPORTS_STATUS_GROUP.ALL) return null;
  return Object.values(STATUS).filter((s) => statusGroupOf(s) === group);
};

// Status-group chips, in wireframe order: All · Open · In progress · Resolved · Done.
// Each carries the data-payload it will emit (its own group + the currently-active
// category, so toggling status preserves the category filter).
const buildStatusChips = (activeGroup, activeCategory) => {
  const G = MY_REPORTS_STATUS_GROUP;
  const defs = [
    { group: G.ALL, label: "All" },
    { group: G.OPEN, label: "Open" },
    { group: G.IN_PROGRESS, label: "In progress" },
    { group: G.RESOLVED, label: "Resolved" },
    { group: G.DONE, label: "Done" },
  ];
  return defs.map((d) => ({
    label: d.label,
    active: d.group === activeGroup,
    payload: { statusGroup: d.group, category: activeCategory },
  }));
};

// Category chips: "All categories" + one per CATEGORY_LABELS entry. Each preserves
// the currently-active status group in its payload.
const buildCategoryChips = (activeGroup, activeCategory) => {
  const chips = [
    {
      label: "All categories",
      value: MY_REPORTS_CATEGORY_ALL,
      active: activeCategory === MY_REPORTS_CATEGORY_ALL,
      payload: { statusGroup: activeGroup, category: MY_REPORTS_CATEGORY_ALL },
    },
  ];
  for (const [token, label] of Object.entries(CATEGORY_LABELS)) {
    chips.push({
      label,
      value: token,
      active: token === activeCategory,
      payload: { statusGroup: activeGroup, category: token },
    });
  }
  return chips;
};

// Build the card content on every render (reporter-scoped, empty-safe). The status/
// category filtering + ordering + paging are done SERVER-SIDE by the openMyReports loader
// (nav-my-reports.js) — `reportsCollection.rows` here is already the filtered, newest-first
// page (over-fetched by 1 to detect "more"). This handler maps the page, slices the
// over-fetch, and appends the prev/next control (framework-mapping rule 36).
myReportsListSection.onResponse = () => {
  const activeFilter = state.getField(STATE_KEYS.MY_REPORTS_FILTER) || {};
  const activeGroup = activeFilter.statusGroup || MY_REPORTS_STATUS_GROUP.ALL;
  const activeCategory = activeFilter.category || MY_REPORTS_CATEGORY_ALL;
  const page = Number(activeFilter.page) >= 0 ? Number(activeFilter.page) : 0;

  // reportsCollection.rows are Doc objects (collection guide § "What is
  // collection.rows") — read each field via row.f[field.id].value.
  const loaded = (reportsCollection.rows || []).map((row) => {
    const statusToken = row.f[statusField.id]?.value || "";
    const categoryToken = row.f[categoryField.id]?.value || "";
    const urgencyToken = row.f[urgencyField.id]?.value || "";
    return {
      reportId: row.f[reportIdField.id]?.value || "",
      status: statusToken,
      group: statusGroupOf(statusToken),
      categoryToken,
      category: CATEGORY_LABELS[categoryToken] || categoryToken || "—",
      urgency: URGENCY_LABELS[urgencyToken] || urgencyToken || "—",
      createdOn: row.f[createdOnField.id]?.value || null,
    };
  });

  // Defensive newest-first (the query already sorts); then split the over-fetch row off
  // to learn whether a next page exists.
  loaded.sort(
    (a, b) => (Number(b.createdOn) || 0) - (Number(a.createdOn) || 0)
  );
  const hasMore = loaded.length > LIST_PAGE_SIZE;
  const pageRows = loaded.slice(0, LIST_PAGE_SIZE);

  const isFiltered =
    activeGroup !== MY_REPORTS_STATUS_GROUP.ALL ||
    activeCategory !== MY_REPORTS_CATEGORY_ALL;

  const paginationHtml = renderPaginationControls({
    page,
    hasMore,
    intentId: INTENT.OPEN_MY_REPORTS,
    payloadExtra: { statusGroup: activeGroup, category: activeCategory },
  });

  const data = {
    intents: {
      detail: INTENT.OPEN_REPORT_DETAIL,
      filter: INTENT.OPEN_MY_REPORTS,
      submit: INTENT.OPEN_SUBMIT_REPORT,
    },
    reports: pageRows,
    // "Any reports at all" can't be derived from a single paged/filtered query without a
    // second count; treat a filtered or non-first page as "has reports" so an empty result
    // shows the "no match" body rather than the first-time empty state.
    hasAnyReports: pageRows.length > 0 || isFiltered || page > 0,
    isFiltered,
    statusChips: buildStatusChips(activeGroup, activeCategory),
    categoryChips: buildCategoryChips(activeGroup, activeCategory),
    paginationHtml,
  };

  myReportsListPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

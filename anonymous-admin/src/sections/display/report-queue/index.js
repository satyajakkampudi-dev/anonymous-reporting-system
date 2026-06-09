// Display section: Report queue (schema id: reportQueue, row 1).
//
// Shell (Section + CardsSet + placeholder Card + grid) was built in A-DISPLAY-SHELL;
// A-D-queue fills the card content. readOnly: true — every row hosts an inline
// "Open" button (data-action="intent" data-intent-id="openManageReport") and the
// quick-filter chips re-invoke openQueue, so the card surface must not swallow them.
//
// ANONYMITY (the dominant constraint): this section binds NO reporter-identity
// field (rule 30) and NEVER queries `reports` itself (ER-A3). Its data is the
// loadReportsForAdmin set — identity-free by construction (the admin bundle's Doc
// declares no identity fields) and stripped again here through applyAdminProjection
// as a second defence layer.
//
// DATA SOURCE. onResponse is a Context-A render handler called SYNCHRONOUSLY during
// adminDisplayDoc.sendResponse() (CLAUDE.md "Render handlers are NOT awaited"), so it
// cannot await a load. It reads a prepared stash (STATE_KEYS.QUEUE_REPORTS) that the
// role-filter + recusal (A-F4) and priority surfacing/sort (A-F5) tasks will fill —
// exactly the A-F2 → DASHBOARD_STATS contract used by the dashboard. Until those ship,
// the stash is absent and the renderer FALLS BACK to the gateway-loaded
// reportsCollection.rows (populated by app-start's loadReportsForAdmin call), so the
// queue is verifiable on the live runtime now.
//
// SCOPE. This task renders the list, the derived priority badge (presentation only),
// and the quick-filter chips as openQueue{filter} navigation. The actual filtering,
// recusal and priority SORT are owned by A-F4/A-F5 (they feed this render). The chips
// emit QUEUE_FILTER.* values; A-F4 consumes them from the invoke_intent payload.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-reports
// case (empty list → "No reports match this view."). Distinct framework ids from any
// Data Doc section — ids are global (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { reportsCollection } from "../../../docs/admin-report-doc";
import {
  applyAdminProjection,
  extractRowData,
} from "../../../../../lib/access";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderPaginationControls } from "../../../../../lib/utils/pagination";
import { STATUS } from "../../../../../lib/ticket-status";
import { SEVERITY, URGENCY, ROLE } from "../../../../../lib/constants";
import { INTENT, STATE_KEYS, QUEUE_FILTER } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const reportQueueDisplaySection = new Section(
  "reportQueueDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 1, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const reportQueueDisplayCardsSet = new CardsSet(
  "reportQueueDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

reportQueueDisplaySection.cardsSet = reportQueueDisplayCardsSet;

export const reportQueueDisplayPlaceholderCard = new Card(
  "reportQueueDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: reportQueueDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Report queue]</div>',
    state,
  }
);

// The quick-filter chips, in wireframe order (§2). Each emits openQueue with its
// QUEUE_FILTER value; A-F4/A-F5 apply the filter. ALL is the default active chip.
const QUEUE_FILTER_CHIPS = [
  { key: QUEUE_FILTER.ALL, label: "All" },
  { key: QUEUE_FILTER.PRIORITY, label: "Priority / Esc" },
  { key: QUEUE_FILTER.OPEN, label: "Open" },
  { key: QUEUE_FILTER.UNDER_REVIEW, label: "U/Review" },
  { key: QUEUE_FILTER.ESCALATED, label: "Escalated" },
  { key: QUEUE_FILTER.RESOLVED, label: "Resolved" },
];

// Role-aware chip set. ESCALATED reports are routed to the SECONDARY admin and HIDDEN
// from the PRIMARY's queue by the A-F4 role filter (roleSees) — so the "Escalated" chip
// is dead for the primary (always empty). Show it only to the secondary; everyone else
// gets the rest.
const chipsForRole = (role) =>
  QUEUE_FILTER_CHIPS.filter(
    (c) => c.key !== QUEUE_FILTER.ESCALATED || role === ROLE.SECONDARY_ADMIN
  );

// Derived priority flag (display_elements "Priority" → badge). Pure presentation —
// the SORT that floats these to the top is A-F5's job; we only tag the row.
const isPriorityReport = (r) =>
  r.severity === SEVERITY.CRITICAL ||
  r.urgency === URGENCY.IMMEDIATE ||
  r.status === STATUS.ESCALATED;

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer.
const toPlainReport = (row) => applyAdminProjection(extractRowData(row));

// Resolve the report set: prefer the A-F4/A-F5 stash; else fall back to the
// gateway-loaded rows. Every row is stripped through applyAdminProjection.
const readReports = () => {
  const stash = state.getField(STATE_KEYS.QUEUE_REPORTS);
  const source = Array.isArray(stash) ? stash : reportsCollection.rows || [];
  return source.map(toPlainReport).filter((r) => r && r.reportId);
};

// Build the card content on every render (empty-safe).
reportQueueDisplaySection.onResponse = () => {
  const reports = readReports().map((r) => ({
    ...r,
    isPriority: isPriorityReport(r),
  }));

  const activeFilter =
    state.getField(STATE_KEYS.QUEUE_ACTIVE_FILTER) || QUEUE_FILTER.ALL;
  const role = state.getField(STATE_KEYS.ADMIN_ROLE) || "";
  const page = Number(state.getField(STATE_KEYS.QUEUE_PAGE)) || 0;
  const hasMore = !!state.getField(STATE_KEYS.QUEUE_HAS_MORE);

  const data = {
    reports,
    chips: chipsForRole(role),
    activeFilter,
    // Navigation contract consumed by the renderers' buttons.
    openIntent: INTENT.OPEN_MANAGE_REPORT, // per-row Open → manage/detail
    filterIntent: INTENT.OPEN_QUEUE, // chip → re-run the queue with a filter
    // Prev/next control (rule 36) — carries the active filter so paging preserves it.
    paginationHtml: renderPaginationControls({
      page,
      hasMore,
      intentId: INTENT.OPEN_QUEUE,
      payloadExtra: { filter: activeFilter },
    }),
  };

  reportQueueDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

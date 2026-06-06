// Display section: Dashboard (schema id: dashboard, row 0).
//
// Shell (Section + CardsSet + placeholder Card + grid) was built in A-DISPLAY-SHELL;
// A-D-dashboard fills the card content. readOnly: true because the priority card and
// the per-ship cells host inline data-action="intent" clicks (→ openQueue with a
// filter) — the card surface must not swallow them.
//
// ANONYMITY (the dominant constraint): this section binds NO reporter-identity field
// (rule 30) and NEVER aggregates raw report rows itself. It reads ONLY the A-F2
// aggregation stash (STATE_KEYS.DASHBOARD_STATS) — A-F2 owns the counting AND the
// small-cell suppression (<5 → "Other", ER-A6/D-L3-3). Aggregating per-ship here would
// risk surfacing a single-report vessel before suppression, so the stash is the sole
// data source. No Atlas Charts (D4) — plain custom-HTML stat cards.
//
// onResponse runs as a Context-A render handler during adminDisplayDoc.sendResponse(),
// SYNCHRONOUSLY (the framework does NOT await it — CLAUDE.md "Render handlers are NOT
// awaited"); state.getField is synchronous, so there is no async work here.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including before A-F2 ships
// (stash undefined → neutral empty state) and for an admin whose scope has zero reports
// (stash present, totalReports 0 → "no reports" state). Distinct framework ids from any
// Data Doc section — ids are global (rule 7).

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { INTENT, STATE_KEYS, QUEUE_FILTER } from "../../../constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const dashboardDisplaySection = new Section("dashboardDisplaySection", {
  doc: adminDisplayDoc,
  grid: { row: 0, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const dashboardDisplayCardsSet = new CardsSet(
  "dashboardDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

dashboardDisplaySection.cardsSet = dashboardDisplayCardsSet;

export const dashboardDisplayPlaceholderCard = new Card(
  "dashboardDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: dashboardDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Dashboard]</div>',
    state,
  }
);

// Defensive read of the A-F2 stash. Returns a normalised object with every
// sub-array guaranteed present (so renderers never guard each access) plus a
// `hasStash` flag distinguishing "aggregation not run yet" (pre-A-F2) from
// "ran, zero reports". A-F2 may fill the stash incrementally; absent sub-arrays
// simply render as a muted "—" in their group.
const readStats = () => {
  const raw = state.getField(STATE_KEYS.DASHBOARD_STATS);
  const hasStash = !!raw && typeof raw === "object";
  return {
    hasStash,
    totalReports: hasStash ? Number(raw.totalReports) || 0 : 0,
    priorityCount: hasStash ? Number(raw.priorityCount) || 0 : 0,
    byStatus: hasStash && Array.isArray(raw.byStatus) ? raw.byStatus : [],
    bySeverity: hasStash && Array.isArray(raw.bySeverity) ? raw.bySeverity : [],
    byAge: hasStash && Array.isArray(raw.byAge) ? raw.byAge : [],
    perShip: hasStash && Array.isArray(raw.perShip) ? raw.perShip : [],
  };
};

// Build the card content on every render (stash-driven, empty-safe).
dashboardDisplaySection.onResponse = () => {
  const stats = readStats();

  const data = {
    ...stats,
    // The priority card's click target + payload (consumed by A-F4/A-F5).
    priorityIntent: INTENT.OPEN_QUEUE,
    priorityPayload: { filter: QUEUE_FILTER.PRIORITY },
  };

  dashboardDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

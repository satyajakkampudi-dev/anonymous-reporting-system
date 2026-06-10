// Display section: Status timeline (schema id: statusHistory, row 6). A-D-statushistory
// fills the card with the timeline rows (status label+tone from lib/ticket-status.js via
// statusPillHtml, changedOn, actorRole - NEVER an id - and an optional transition note)
// read from the report's embedded statusHistory array. The CardsSet + placeholder were
// built in DISPLAY-SHELL - content only here. Pure display, read-only → readOnly omitted.
// Distinct ids from the Data Doc's statusHistorySection (src/sections/status-history.js):
// the Data Doc owns the forCollection rows; this Display Doc section owns the CardsSet
// (framework-mapping rule 7).
//
// DATA SOURCE (same gateway contract as manage-header / manage-content / manage-resolution).
// onResponse is a Context-A render handler called SYNCHRONOUSLY during
// adminDisplayDoc.sendResponse() (CLAUDE.md "Render handlers are NOT awaited"), so it cannot
// await a load. The openManageReport nav frame (Context B) has already run the anonymity
// gateway - loadReportForAdmin({ reportId }) → loadReportsForAdmin, which populates
// reportsCollection.rows - and stashed the reportId (STATE_KEYS.CURRENT_REPORT_ID) in the
// SAME invocation. This handler reads that id, finds the matching loaded row, re-strips it
// through applyAdminProjection (second anonymity layer), and reads its embedded
// `statusHistory` array. No async work, no S3 - so unlike detail-content / amendments the
// handler stays synchronous (no prepare() helper).
//
// ANONYMITY (the dominant constraint, C1 / rule 30 / ER-A2/A3): this section binds NO
// reporter-identity field and NEVER queries `reports` itself - its only source is the
// gateway-loaded rows, identity-free by construction and stripped again here. Each
// statusHistory row carries actorRole (a ROLE, never an id) - mapped to a friendly,
// identity-free label below (Reporter / Compliance / System); the primary/secondary
// distinction is deliberately collapsed so even the role granularity leaks nothing.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case
// (Dashboard / Queue screens, or a report not found) → hasReport:false → renderers emit
// nothing. When a report IS open it always has at least the OPEN transition, but a
// zero-row array falls back to the empty state.

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
import { ACTOR_ROLE } from "../../../../../lib/constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const statusHistoryDisplaySection = new Section(
  "statusHistoryDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 6, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const statusHistoryDisplayCardsSet = new CardsSet(
  "statusHistoryDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

statusHistoryDisplaySection.cardsSet = statusHistoryDisplayCardsSet;

export const statusHistoryDisplayPlaceholderCard = new Card(
  "statusHistoryDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: statusHistoryDisplayCardsSet,
    content: '<div class="placeholder">[Status timeline]</div>',
    state,
  }
);

// Friendly, role-ONLY actor label (anonymity, rule 30). Both admin roles collapse to a
// single "Compliance" label - the officer never needs (and the audit must never expose)
// the primary/secondary distinction or any id. Unknown/missing role degrades to "".
const ACTOR_LABEL = {
  [ACTOR_ROLE.REPORTER]: "Reporter",
  [ACTOR_ROLE.PRIMARY_ADMIN]: "Compliance",
  [ACTOR_ROLE.SECONDARY_ADMIN]: "Compliance",
  [ACTOR_ROLE.SYSTEM]: "System",
};

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer
// (same approach as manage-header / manage-content / manage-resolution).
const toPlainReport = (row) => applyAdminProjection(extractRowData(row));

// Resolve the opened report: the gateway-loaded row whose reportId matches the
// CURRENT_REPORT_ID stash. Returns null when no report is open or none matches
// (empty-safe). Every candidate is stripped through applyAdminProjection.
const readOpenedReport = () => {
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) return null;
  const rows = (reportsCollection.rows || []).map(toPlainReport);
  return rows.find((r) => r && r.reportId === reportId) || null;
};

// Build the card content on every render (empty-safe - no report open → no card).
statusHistoryDisplaySection.onResponse = () => {
  const report = readOpenedReport();

  // The transition log is the embedded `statusHistory` array on the report (dbName-keyed
  // rows, written by the transition path only). Defensive against a missing/non-array
  // value. Each row carries ROLE only - mapped to a friendly label (never an id).
  const history = Array.isArray(report?.statusHistory)
    ? report.statusHistory
    : [];
  const rows = history.map((row) => ({
    toStatus: row?.toStatus || "",
    changedOn: row?.changedOn ?? null,
    actorLabel: ACTOR_LABEL[row?.actorRole] || "",
    note: row?.note || "",
  }));

  // Newest first - the most recent transition leads the timeline (wireframe §4).
  rows.sort((a, b) => (Number(b.changedOn) || 0) - (Number(a.changedOn) || 0));

  const data = {
    // No report open (Dashboard / Queue screens, or not found) → renderer emits nothing.
    hasReport: !!report,
    rows,
  };

  statusHistoryDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

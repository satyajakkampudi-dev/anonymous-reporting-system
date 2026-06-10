// Display section: Alerts / Digest (schema id: alertsDigest, row 8). A-D-alerts fills
// the card with the in-app safety net (A-F19, ER-D15): a notification-failure fallback
// banner + a list of SLA-breaching reports, so a missed email or a slipped SLA is never
// an unseen report. The CardsSet + placeholder Card were built in A-DISPLAY-SHELL —
// content only here. readOnly: true (set on the shell card) — every breach row hosts an
// inline "Open →" button (data-action="intent" data-intent-id="openManageReport"), so
// the card surface must not swallow the click. Distinct framework ids from any Data Doc
// section (ids are global — rule 7).
//
// THIS IS FRAME A-F19. The digest content is computed entirely in this synchronous
// onResponse render handler; there is no separate intent that aggregates the data.
//
// DATA SOURCE — same gateway contract as the queue/dashboard. onResponse is a Context-A
// render handler called SYNCHRONOUSLY during adminDisplayDoc.sendResponse() (CLAUDE.md
// "Render handlers are NOT awaited"), so it cannot await a load. It reads the
// gateway-loaded reportsCollection.rows (populated by app-start's loadReportsForAdmin —
// rule 15; the SINGLE admin read path) and computes the SLA-breach set in code. Every
// row is re-stripped through applyAdminProjection as a second anonymity layer.
//
// SLA BREACH (D11): OPEN unactioned ≥ 24h, OR ESCALATED unactioned ≥ 24h. OPEN age runs
// from createdOn; ESCALATED age runs from the last write (updatedOn, the escalation
// time for a report untouched since — there is no dedicated escalatedOn field; falls
// back to createdOn). Thresholds are the shared TIMING.SLA_* constants (rule 19), so the
// in-app twin and the email digest job (A-F18) breach on the SAME rule.
//
// The breach predicate itself (slaForReport + buildBreaches) now lives in the shared
// lib/sla.js — extracted (A-F18) so the email digest backstop and this in-app twin use
// ONE identical rule and cannot drift. This section imports buildBreaches and computes
// the breach set over the gateway-loaded rows; behaviour is unchanged from when the
// predicate lived inline here.
//
// NOTIFICATION-FAILURE BANNER (ER-D15). The durable, cross-admin failure store does NOT
// exist yet — lib/notifications.js currently only D.log's best-effort failures, and the
// senders (A-F15/A-F17) are unbuilt. A failure occurs in ANOTHER admin's invocation, so
// it must live in a sharedField, which this synchronous, non-awaited handler cannot read
// directly. We therefore consume a SYNCHRONOUS state stash (STATE_KEYS.NOTIFICATION_
// FAILURES) — exactly the CURRENT_REPORT_EVIDENCE pattern: a future Context-B alerts nav
// frame reads the sharedField and stashes it before sendResponse. Until that lands the
// stash is absent → no banner (empty-safe). Flagged for a /frontm-fix-task; this display
// lights the banner up automatically once the stash is produced. The SLA-breach list is
// independent of this and verifiable on the live runtime now.
//
// ANONYMITY (the dominant constraint — C1 / rule 30 / ER-A2/A3): this section binds NO
// reporter-identity field and NEVER queries `reports` itself; its only source is the
// gateway-loaded rows (identity-free by construction, stripped again here). The
// notification-failure descriptors carry only reportId + failedOn — never a recipient
// address or reporter id.
//
// EMPTY-SAFE: this is a screen-level card (like the queue/dashboard), so it always
// renders its panel. onResponse fires for every sendResponse(); no breaches AND no
// failures → the schema empty state "No SLA breaches or notification failures."

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
import { buildBreaches } from "../../../../../lib/sla";
import { LIST_PAGE_SIZE } from "../../../../../lib/constants";
import { INTENT, STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const alertsDigestDisplaySection = new Section(
  "alertsDigestDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 8, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const alertsDigestDisplayCardsSet = new CardsSet(
  "alertsDigestDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

alertsDigestDisplaySection.cardsSet = alertsDigestDisplayCardsSet;

export const alertsDigestDisplayPlaceholderCard = new Card(
  "alertsDigestDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: alertsDigestDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Alerts / Digest]</div>',
    state,
  }
);

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer (same
// approach as the queue / manage-content / amendments display sections).
const toPlainReport = (row) => applyAdminProjection(extractRowData(row));

// Read the ROLE-VISIBLE report set the dashboard producer stashed (app-start /
// nav-dashboard → roleVisibleReports, MP-FIX-DASHBOARD-ALERTS-ROLE-SCOPE) so breaches are
// scoped to what THIS admin can see (PRIMARY ≠ SECONDARY). Those stashed rows are already
// identity-free, plain objects. Falls back to the gateway-loaded collection (full set,
// stripped) if the stash is absent, so the panel never renders empty. NEVER queries
// `reports` directly (ER-A3). Empty-safe.
const readReports = () => {
  const stash = state.getField(STATE_KEYS.ALERTS_REPORTS);
  if (Array.isArray(stash)) return stash.filter((r) => r && r.reportId);
  return (reportsCollection.rows || [])
    .map(toPlainReport)
    .filter((r) => r && r.reportId);
};

// The SLA-breach predicate (slaForReport + buildBreaches) now lives in the shared
// lib/sla.js (imported above), so the email digest job (A-F18) and this in-app twin
// breach on the SAME rule. buildBreaches is pure and identity-free.

// Read the synchronous notification-failure stash (see header + STATE_KEYS doc). Absent
// today (no producer) → empty → no banner. Defensive against a non-array value.
const readNotificationFailures = () => {
  const stash = state.getField(STATE_KEYS.NOTIFICATION_FAILURES);
  return Array.isArray(stash) ? stash : [];
};

// Build the card content on every render (screen-level → always renders; empty-safe).
alertsDigestDisplaySection.onResponse = () => {
  const reports = readReports();
  const allBreaches = buildBreaches(reports);
  const failures = readNotificationFailures();

  // In-memory pagination (rule 36) — slice the computed breach list; the failure-banner
  // count stays over the FULL set (not the page). Page-change re-renders the dashboard via
  // OPEN_DASHBOARD (the alerts panel lives on the Dashboard screen).
  const page = Number(state.getField(STATE_KEYS.ALERTS_PAGE)) || 0;
  const start = page * LIST_PAGE_SIZE;
  const breaches = allBreaches.slice(start, start + LIST_PAGE_SIZE);
  const hasMore = allBreaches.length > start + LIST_PAGE_SIZE;

  const data = {
    breaches,
    // Banner: count of reports that could not be notified (ER-D15). 0 → no banner.
    // Counts the FULL failure set, not the current page.
    notificationFailureCount: failures.length,
    // Per-row navigation contract consumed by the renderers' Open buttons.
    openIntent: INTENT.OPEN_MANAGE_REPORT,
    paginationHtml: renderPaginationControls({
      page,
      hasMore,
      intentId: INTENT.OPEN_DASHBOARD,
      payloadExtra: {},
    }),
  };

  alertsDigestDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

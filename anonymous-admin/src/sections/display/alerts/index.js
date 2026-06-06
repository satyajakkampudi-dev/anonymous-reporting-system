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
import { applyAdminProjection } from "../../../../../lib/access";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { STATUS } from "../../../../../lib/ticket-status";
import { TIMING } from "../../../../../lib/constants";
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

// Normalise a loaded collection row into a plain, identity-free object. Mirrors
// lib/access.js's defensive extraction (the framework row shape is not part of the
// documented surface) and re-applies applyAdminProjection as a second layer (same
// approach as the queue / manage-content / amendments display sections).
const toPlainReport = (row) => {
  if (!row || typeof row !== "object") return {};
  const data =
    typeof row.getData === "function"
      ? row.getData()
      : row.data && typeof row.data === "object"
        ? row.data
        : row;
  return applyAdminProjection(data && typeof data === "object" ? data : {});
};

// Read the gateway-loaded report set (app-start's loadReportsForAdmin), stripped again.
// NEVER queries `reports` directly (ER-A3). Empty when nothing is loaded (empty-safe).
const readReports = () =>
  (reportsCollection.rows || [])
    .map(toPlainReport)
    .filter((r) => r && r.reportId);

// The SLA-breach reference timestamp + threshold for a report, or null if its status is
// not SLA-tracked. OPEN ages from createdOn; ESCALATED ages from the last write
// (updatedOn — escalation time for an untouched report; createdOn fallback). D11.
const slaForReport = (r) => {
  if (r.status === STATUS.OPEN) {
    return { since: Number(r.createdOn) || 0, thresholdMs: TIMING.SLA_OPEN_MS };
  }
  if (r.status === STATUS.ESCALATED) {
    const since = Number(r.updatedOn) || Number(r.createdOn) || 0;
    return { since, thresholdMs: TIMING.SLA_ESCALATED_MS };
  }
  return null;
};

// Build the breach list: SLA-tracked reports whose unactioned age has crossed the
// threshold. Pure — `nowMs` injectable (defaults to now). Most overdue first.
const buildBreaches = (reports, nowMs = Date.now()) =>
  reports
    .map((r) => {
      const sla = slaForReport(r);
      if (!sla || !sla.since) return null;
      const overdue = nowMs - sla.since >= sla.thresholdMs;
      return overdue
        ? {
            reportId: r.reportId,
            status: r.status,
            assignedTo: r.assignedTo || "",
            sinceOn: sla.since, // age reference → formatRelative in the renderer
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => (Number(a.sinceOn) || 0) - (Number(b.sinceOn) || 0));

// Read the synchronous notification-failure stash (see header + STATE_KEYS doc). Absent
// today (no producer) → empty → no banner. Defensive against a non-array value.
const readNotificationFailures = () => {
  const stash = state.getField(STATE_KEYS.NOTIFICATION_FAILURES);
  return Array.isArray(stash) ? stash : [];
};

// Build the card content on every render (screen-level → always renders; empty-safe).
alertsDigestDisplaySection.onResponse = () => {
  const reports = readReports();
  const breaches = buildBreaches(reports);
  const failures = readNotificationFailures();

  const data = {
    breaches,
    // Banner: count of reports that could not be notified (ER-D15). 0 → no banner.
    notificationFailureCount: failures.length,
    // Per-row navigation contract consumed by the renderers' Open buttons.
    openIntent: INTENT.OPEN_MANAGE_REPORT,
  };

  alertsDigestDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

// Display section: Manage detail resolution (schema id: manageResolution, row 4).
// A-D-manageresolution fills the card with the admin-written resolution text + the
// "Resolved on" date (shown when present) and the reporter-written reject reason
// (read-only context here — the reporter wrote it when rejecting an earlier
// resolution, ER-B5/D10). The CardsSet + placeholder were built in DISPLAY-SHELL —
// content only here. Pure display (no buttons — Resolve/Close-as-rejected live in
// manage-actions) → readOnly omitted. Distinct ids (rule 7).
//
// DATA SOURCE (same gateway contract as manage-header / manage-content). onResponse is
// a Context-A render handler called SYNCHRONOUSLY during adminDisplayDoc.sendResponse()
// (CLAUDE.md "Render handlers are NOT awaited"), so it cannot await a load. The
// openManageReport nav frame (Context B) has already run the anonymity gateway —
// loadReportForAdmin({ reportId }) → loadReportsForAdmin, which populates
// reportsCollection.rows — and stashed the reportId (STATE_KEYS.CURRENT_REPORT_ID) in
// the SAME invocation. This handler reads that id, finds the matching loaded row, and
// re-strips it through applyAdminProjection as a second anonymity layer.
//
// ANONYMITY (the dominant constraint, C1 / rule 30 / ER-A2/A3): this section binds NO
// reporter-identity field and NEVER queries `reports` itself — its only source is the
// gateway-loaded rows, identity-free by construction and stripped again here. resolution,
// resolvedOn and rejectReason all survive adminProjection (none are excluded) and carry
// zero reporter identity.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case
// (Dashboard / Queue screens, or a report not found) → hasReport:false → renderers emit
// nothing. When a report IS open the card always renders (wireframes §4 shows the
// "Resolution / (none yet)" card present on the manage detail), with an empty-state body
// until an admin records a resolution.
//
// SANITISATION (rule 10): the resolution text is admin free-text and the reject reason is
// reporter free-text; both are escaped at the format-primitive boundary (escapeHtml in the
// renderers), which is the full HTML-injection defence for display.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { reportsCollection } from "../../../docs/admin-report-doc";
import { applyAdminProjection } from "../../../../../lib/access";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { formatDate, formatIsoDate } from "../../../../../lib/utils/format";
import { STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const manageResolutionDisplaySection = new Section(
  "manageResolutionDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 4, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageResolutionDisplayCardsSet = new CardsSet(
  "manageResolutionDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageResolutionDisplaySection.cardsSet = manageResolutionDisplayCardsSet;

export const manageResolutionDisplayPlaceholderCard = new Card(
  "manageResolutionDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageResolutionDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail resolution]</div>',
    state,
  }
);

// Normalise a loaded collection row into a plain, identity-free object. Mirrors
// lib/access.js's defensive extraction (the framework row shape is not part of the
// documented surface) and re-applies applyAdminProjection as a second layer
// (same approach as manage-header / manage-content).
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

// Resolve the opened report: the gateway-loaded row whose reportId matches the
// CURRENT_REPORT_ID stash. Returns null when no report is open or none matches
// (empty-safe). Every candidate is stripped through applyAdminProjection.
const readOpenedReport = () => {
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) return null;
  const rows = (reportsCollection.rows || []).map(toPlainReport);
  return rows.find((r) => r && r.reportId === reportId) || null;
};

// resolvedOn is a NUMBER_FIELD (epoch-ms set by the admin RESOLVE transition), but
// format defensively for either epoch-ms or an ISO string via the shared primitives
// (compose, do not reinvent) — same helper as the reporter-side resolution renderer.
// Empty → "".
const formatResolvedOn = (value) => {
  if (value === null || value === "" || typeof value === "undefined") return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    return formatDate(Number(value));
  }
  return formatIsoDate(value);
};

// Build the card content on every render (empty-safe — no report open → no card).
manageResolutionDisplaySection.onResponse = () => {
  const report = readOpenedReport();
  const resolution = report?.resolution || "";
  const rejectReason = report?.rejectReason || "";

  const data = {
    // No report open (Dashboard / Queue screens, or not found) → renderer emits nothing.
    hasReport: !!report,
    // Resolution text + date shown ONLY when an admin has recorded a resolution;
    // otherwise the card renders an empty-state body for the open report.
    resolution,
    resolvedOn: formatResolvedOn(report?.resolvedOn),
    // Reporter-written reject reason for an earlier resolution (ER-B5/D10). Read-only
    // context for the officer; shown only when present. Trimmed for the empty check.
    rejectReason: rejectReason.trim() ? rejectReason : "",
  };

  manageResolutionDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

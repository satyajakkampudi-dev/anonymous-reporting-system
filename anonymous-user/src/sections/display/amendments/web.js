// Amendments — WEB renderer (wireframes §4 amendments card): a titled card whose
// header carries a "+ Add" intent button, then a dense table — one row per amendment
// (When · Note · Evidence). APPEND-ONLY (D16, rule 25): no edit/delete affordance.
// Composes shared theme tokens (theme.js) and the escapeHtml / intentButtonHtml /
// emptyStateHtml / formatDateTime primitives (format.js) — every interpolated value
// is escaped at the primitive boundary (NFR-2, rule 10). Evidence URLs are PRE-SIGNED
// in index.js before sendResponse; this renderer never sees an S3 key (rule 11/18).
// Pure presentation: index.js owns the data + sort logic.

import {
  escapeHtml,
  intentButtonHtml,
  emptyStateHtml,
  formatDateTime,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const addButtonHtml = (data) =>
  intentButtonHtml(
    data.addIntent,
    "✚  Add",
    { reportId: data.reportId },
    `padding:${SPACING.XS}px ${SPACING.MD}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
      `border:1px solid ${COLORS.PRIMARY_DARK};background:${COLORS.PRIMARY};` +
      `color:${COLORS.PRIMARY_CONTRAST};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`
  );

const headerHtml = (data) =>
  `<div style="display:flex;justify-content:space-between;align-items:center;` +
  `padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};">Amendments</div>` +
  addButtonHtml(data) +
  `</div>`;

const headerCell = (label) =>
  `<th style="text-align:left;padding:${SPACING.SM}px ${SPACING.MD}px;` +
  `font-size:${TYPOGRAPHY.SIZE_XS}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
  `color:${COLORS.TEXT_FAINT};text-transform:uppercase;letter-spacing:0.04em;` +
  `border-bottom:1px solid ${COLORS.BORDER};">${escapeHtml(label)}</th>`;

const bodyCell = (inner, extra = "") =>
  `<td style="text-align:left;padding:${SPACING.MD}px;vertical-align:top;` +
  `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
  `border-bottom:1px solid ${COLORS.SURFACE_ALT};${extra}">${inner}</td>`;

// Evidence cell: a signed download link, a degraded plain name, or an em-dash.
const evidenceCell = (evidence) => {
  if (!evidence) return `<span style="color:${COLORS.TEXT_FAINT};">—</span>`;
  const name = escapeHtml(evidence.fileName || "Evidence");
  if (evidence.url) {
    return (
      `<a href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:${COLORS.PRIMARY};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
      `text-decoration:none;word-break:break-word;">⬇ ${name}</a>`
    );
  }
  // Signing failed / no bucket — show the name, never a broken link.
  return (
    `<span style="color:${COLORS.TEXT_MUTED};word-break:break-word;">${name} ` +
    `<span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span></span>`
  );
};

const rowHtml = (a) =>
  `<tr>` +
  bodyCell(
    `<span style="color:${COLORS.TEXT_MUTED};white-space:nowrap;">${escapeHtml(formatDateTime(a.amendedOn))}</span>`,
    "white-space:nowrap;"
  ) +
  bodyCell(
    `<span style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(a.note || "—")}</span>`
  ) +
  bodyCell(evidenceCell(a.evidence)) +
  `</tr>`;

const tableHtml = (data) =>
  `<table style="width:100%;border-collapse:collapse;">` +
  `<thead><tr>` +
  headerCell("When") +
  headerCell("Note") +
  headerCell("Evidence") +
  `</tr></thead>` +
  `<tbody>${data.amendments.map(rowHtml).join("")}</tbody>` +
  `</table>`;

export const renderWeb = (data) => {
  // No report loaded (Home / My-Reports screens) — emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const shell = (inner) =>
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    headerHtml(data) +
    inner +
    `</div>`;

  const body = data.amendments.length
    ? tableHtml(data)
    : emptyStateHtml(
        "No amendments yet. Use “Add” to attach further information."
      );

  return shell(body);
};

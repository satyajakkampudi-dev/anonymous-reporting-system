// My Reports — WEB renderer (wireframes §3 "Web"): a dense table. Header row with
// the filter chips, then one table row per report (Tracking ID · Status pill ·
// Category · Urgency · Date · Open). Composes shared theme tokens (theme.js) and the
// escapeHtml / statusPillHtml / intentButtonHtml / emptyStateHtml primitives
// (format.js) — every interpolated value is escaped at the primitive boundary
// (NFR-2, rule 10). Pure presentation: index.js owns the data + filter logic.

import {
  escapeHtml,
  statusPillHtml,
  intentButtonHtml,
  emptyStateHtml,
  formatDate,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

// One filter chip = an intent button (emits openMyReports + the chip's payload).
// Active chips read as filled primary; inactive as neutral outline.
const chipHtml = (filterIntent, chip) => {
  const style = chip.active
    ? `padding:${SPACING.XS}px ${SPACING.MD}px;border-radius:999px;` +
      `border:1px solid ${COLORS.PRIMARY_DARK};background:${COLORS.PRIMARY};` +
      `color:${COLORS.PRIMARY_CONTRAST};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`
    : `padding:${SPACING.XS}px ${SPACING.MD}px;border-radius:999px;` +
      `border:1px solid ${COLORS.BORDER};background:${COLORS.SURFACE};` +
      `color:${COLORS.TEXT_MUTED};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_REGULAR};`;
  return intentButtonHtml(filterIntent, chip.label, chip.payload, style);
};

const filterBarHtml = (data) => {
  const statusChips = data.statusChips
    .map((c) => chipHtml(data.intents.filter, c))
    .join("");
  const categoryChips = data.categoryChips
    .map((c) => chipHtml(data.intents.filter, c))
    .join("");
  return (
    `<div style="display:flex;flex-direction:column;gap:${SPACING.SM}px;` +
    `padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;align-items:center;">` +
    statusChips +
    `</div>` +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;align-items:center;">` +
    categoryChips +
    `</div>` +
    `</div>`
  );
};

const headerCell = (label, align = "left") =>
  `<th style="text-align:${align};padding:${SPACING.SM}px ${SPACING.MD}px;` +
  `font-size:${TYPOGRAPHY.SIZE_XS}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
  `color:${COLORS.TEXT_FAINT};text-transform:uppercase;letter-spacing:0.04em;` +
  `border-bottom:1px solid ${COLORS.BORDER};">${escapeHtml(label)}</th>`;

const bodyCell = (inner, align = "left", extra = "") =>
  `<td style="text-align:${align};padding:${SPACING.MD}px;` +
  `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
  `border-bottom:1px solid ${COLORS.SURFACE_ALT};${extra}">${inner}</td>`;

const reportRowHtml = (data, r) => {
  const openBtn = intentButtonHtml(
    data.intents.detail,
    "Open ›",
    { reportId: r.reportId },
    `padding:${SPACING.XS}px ${SPACING.MD}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
      `border:1px solid ${COLORS.PRIMARY};background:${COLORS.SURFACE};` +
      `color:${COLORS.PRIMARY};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`
  );
  return (
    `<tr>` +
    bodyCell(
      `<span style="font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">` +
        `${escapeHtml(r.reportId)}</span>`
    ) +
    bodyCell(statusPillHtml(r.status)) +
    bodyCell(escapeHtml(r.category)) +
    bodyCell(escapeHtml(r.urgency)) +
    bodyCell(
      `<span style="color:${COLORS.TEXT_MUTED};white-space:nowrap;">${escapeHtml(formatDate(r.createdOn))}</span>`
    ) +
    bodyCell(openBtn, "right") +
    `</tr>`
  );
};

const tableHtml = (data) =>
  `<table style="width:100%;border-collapse:collapse;">` +
  `<thead><tr>` +
  headerCell("Tracking ID") +
  headerCell("Status") +
  headerCell("Category") +
  headerCell("Urgency") +
  headerCell("Date") +
  headerCell("", "right") +
  `</tr></thead>` +
  `<tbody>${data.reports.map((r) => reportRowHtml(data, r)).join("")}</tbody>` +
  `</table>`;

export const renderWeb = (data) => {
  const shell = (inner) =>
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;font-size:${TYPOGRAPHY.SIZE_LG}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">My Reports</div>` +
    inner +
    `</div>`;

  // No reports at all — first-time reporter. Empty state + a way forward.
  if (!data.hasAnyReports) {
    const submit = intentButtonHtml(
      data.intents.submit,
      "✚  Submit a report",
      {},
      `margin-top:${SPACING.MD}px;padding:${SPACING.SM}px ${SPACING.XL}px;` +
        `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY_DARK};` +
        `background:${COLORS.PRIMARY};color:${COLORS.PRIMARY_CONTRAST};` +
        `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
        `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`
    );
    return shell(
      `<div style="padding:0 ${SPACING.XL}px ${SPACING.XL}px;text-align:center;">` +
        emptyStateHtml("You have not submitted any reports yet.") +
        submit +
        `</div>`
    );
  }

  // Has reports, but the active filter matched none.
  const body =
    data.reports.length === 0
      ? emptyStateHtml("No reports match the selected filters.")
      : tableHtml(data);

  return shell(filterBarHtml(data) + body);
};

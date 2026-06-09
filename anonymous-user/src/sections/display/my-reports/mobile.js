// My Reports — MOBILE renderer (wireframes §3 "Mobile"): stacked cards, large tap
// targets. Each card shows tracking id + status pill on top, category · urgency,
// submitted date, and a full-width Open button. Filter chips wrap above the list.
// Composes shared theme tokens (theme.js) + the escapeHtml / statusPillHtml /
// intentButtonHtml / emptyStateHtml primitives (format.js); every interpolated
// value is escaped at the primitive boundary (NFR-2, rule 10). Pure presentation —
// index.js owns the data + filter logic.

import {
  escapeHtml,
  statusPillHtml,
  intentButtonHtml,
  emptyStateHtml,
  formatDate,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

// One filter chip = an intent button (emits openMyReports + the chip's payload).
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
    `padding:${SPACING.LG}px;border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">${statusChips}</div>` +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">${categoryChips}</div>` +
    `</div>`
  );
};

const reportCardHtml = (data, r) => {
  const openBtn = intentButtonHtml(
    data.intents.detail,
    "Open ›",
    { reportId: r.reportId },
    `display:block;width:100%;margin-top:${SPACING.MD}px;padding:${SPACING.MD}px;` +
      `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY};` +
      `background:${COLORS.SURFACE};color:${COLORS.PRIMARY};` +
      `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
      `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-align:center;`
  );
  return (
    `<div style="padding:${SPACING.LG}px;border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;background:${COLORS.SURFACE};` +
    `margin:0 0 ${SPACING.MD}px;">` +
    // Top line: tracking id + status pill.
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:${SPACING.SM}px;">` +
    `<span style="font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:${COLORS.TEXT};` +
    `word-break:break-all;">${escapeHtml(r.reportId)}</span>` +
    statusPillHtml(r.status) +
    `</div>` +
    // Category · urgency.
    `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">` +
    `${escapeHtml(r.category)} · ${escapeHtml(r.urgency)}</div>` +
    // Submitted date.
    `<div style="margin-top:${SPACING.XS}px;font-size:${TYPOGRAPHY.SIZE_XS}px;color:${COLORS.TEXT_FAINT};">` +
    `Submitted ${escapeHtml(formatDate(r.createdOn))}</div>` +
    openBtn +
    `</div>`
  );
};

export const renderMobile = (data) => {
  // "Create report" CTA — top-right of the header (emits openSubmitReport).
  const createBtn = intentButtonHtml(
    data.intents.submit,
    "✚  Create",
    {},
    `padding:${SPACING.SM}px ${SPACING.MD}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
      `border:1px solid ${COLORS.PRIMARY_DARK};background:${COLORS.PRIMARY};` +
      `color:${COLORS.PRIMARY_CONTRAST};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};white-space:nowrap;`
  );
  const shell = (inner) =>
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px;display:flex;justify-content:space-between;` +
    `align-items:center;gap:${SPACING.MD}px;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">My Reports</span>` +
    createBtn +
    `</div>` +
    inner +
    `</div>`;

  // No reports at all — first-time reporter. Empty state + a way forward.
  if (!data.hasAnyReports) {
    const submit = intentButtonHtml(
      data.intents.submit,
      "✚  Submit a report",
      {},
      `display:block;width:100%;margin-top:${SPACING.MD}px;padding:${SPACING.LG}px;` +
        `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY_DARK};` +
        `background:${COLORS.PRIMARY};color:${COLORS.PRIMARY_CONTRAST};` +
        `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
        `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-align:center;`
    );
    return shell(
      `<div style="padding:0 ${SPACING.LG}px ${SPACING.LG}px;text-align:center;">` +
        emptyStateHtml("You have not submitted any reports yet.") +
        submit +
        `</div>`
    );
  }

  // Has reports, but the active filter matched none.
  const list =
    data.reports.length === 0
      ? emptyStateHtml("No reports match the selected filters.")
      : data.reports.map((r) => reportCardHtml(data, r)).join("");

  return shell(
    filterBarHtml(data) + `<div style="padding:${SPACING.LG}px;">${list}</div>`
  );
};

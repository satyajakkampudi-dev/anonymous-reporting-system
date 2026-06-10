// Report detail header - WEB renderer (wireframes §4 "Web" header card): the
// tracking id as the title anchor, status pill + severity pill on the same line,
// then a compact meta row (Category · Urgency · Submitted). Composes shared theme
// tokens (theme.js) and the escapeHtml / statusPillHtml / tonePillHtml / formatDate
// primitives (format.js) - every interpolated value is escaped at the primitive
// boundary (NFR-2, rule 10). Pure presentation: index.js owns the data + label maps.

import {
  escapeHtml,
  statusPillHtml,
  tonePillHtml,
  formatDate,
} from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  severityColors,
} from "../../../../../lib/utils/theme";

// One "label: value" meta item for the bottom row.
const metaItem = (label, value) =>
  `<span style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">` +
  `<span style="color:${COLORS.TEXT_FAINT};">${escapeHtml(label)}:</span> ` +
  `<span style="color:${COLORS.TEXT};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">${escapeHtml(value)}</span>` +
  `</span>`;

export const renderWeb = (data) => {
  // No report loaded (Home / My-Reports screens) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px ${SPACING.XL}px;">` +
    // Top line: tracking id + status / severity pills.
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `gap:${SPACING.MD}px;flex-wrap:wrap;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">` +
    `${escapeHtml(data.reportId)}</span>` +
    `<span style="display:flex;gap:${SPACING.SM}px;align-items:center;flex-wrap:wrap;">` +
    statusPillHtml(data.status) +
    tonePillHtml(
      `Severity: ${data.severityLabel}`,
      severityColors(data.severity)
    ) +
    `</span>` +
    `</div>` +
    // Meta row: category · urgency · submitted date.
    `<div style="margin-top:${SPACING.MD}px;display:flex;gap:${SPACING.LG}px;` +
    `flex-wrap:wrap;align-items:center;">` +
    metaItem("Category", data.category) +
    metaItem("Urgency", data.urgency) +
    metaItem("Submitted", formatDate(data.createdOn) || "-") +
    `</div>` +
    `</div>`
  );
};

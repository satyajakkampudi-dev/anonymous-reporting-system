// Manage detail header — MOBILE renderer (wireframes §4 header card, admin side):
// tracking id on its own line (it can be long — wraps/breaks), status pill + severity
// pill beneath it, then the meta facts (Assigned · Category · Urgency · Created)
// stacked for narrow widths. Composes shared theme tokens (theme.js) and the
// escapeHtml / statusPillHtml / tonePillHtml / formatDate primitives (format.js) —
// every interpolated value is escaped at the primitive boundary (NFR-2, rule 10).
// Pure presentation: index.js owns the data + label maps.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3) — the header binds
// only the report's own id / triage tokens / dates.

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

// One "label: value" meta line.
const metaLine = (label, value) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};` +
  `margin-top:${SPACING.XS}px;">` +
  `<span style="color:${COLORS.TEXT_FAINT};">${escapeHtml(label)}:</span> ` +
  `<span style="color:${COLORS.TEXT};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">${escapeHtml(value)}</span>` +
  `</div>`;

export const renderMobile = (data) => {
  // No report open (Dashboard / Queue screens, or not found) — emit nothing (empty-safe).
  if (!data.hasReport) return "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    // Tracking id — full-width, can break on small screens.
    `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;` +
    `word-break:break-all;">${escapeHtml(data.reportId)}</div>` +
    // Status + severity pills.
    `<div style="margin-top:${SPACING.SM}px;display:flex;gap:${SPACING.SM}px;` +
    `flex-wrap:wrap;align-items:center;">` +
    statusPillHtml(data.status) +
    tonePillHtml(
      `Severity: ${data.severityLabel}`,
      severityColors(data.severity)
    ) +
    `</div>` +
    // Meta facts, stacked.
    `<div style="margin-top:${SPACING.MD}px;">` +
    metaLine("Assigned", data.assigned) +
    metaLine("Category", data.category) +
    metaLine("Urgency", data.urgency) +
    metaLine("Created", formatDate(data.createdOn) || "—") +
    `</div>` +
    `</div>`
  );
};

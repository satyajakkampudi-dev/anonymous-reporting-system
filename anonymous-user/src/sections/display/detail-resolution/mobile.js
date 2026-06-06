// Report detail resolution — MOBILE renderer (wireframes §4 "Resolution" card,
// stacked full-width below the status timeline). Same data as web — the admin-
// written resolution text and the "Resolved on" date — restacked for narrow
// widths. Shown ONLY when a resolution is present (display_only, schema id
// detailResolution); absent → the renderer emits nothing (empty-safe). Pure
// presentation: composes shared theme tokens (theme.js) and the escapeHtml
// primitive (format.js); every interpolated value is escaped at the boundary
// (NFR-2, rule 10). No buttons — Accept/Reject live in the detailActions card.

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const sectionTitle = (text) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">${escapeHtml(text)}</div>`;

export const renderMobile = (data) => {
  // No resolution yet (or no report loaded) — emit nothing (empty-safe).
  if (!data.hasResolution) return "";

  const resolvedOn = data.resolvedOn
    ? `<div style="margin-top:${SPACING.MD}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
      `text-transform:uppercase;letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">` +
      `Resolved on <span style="color:${COLORS.TEXT_MUTED};">${escapeHtml(data.resolvedOn)}</span></div>`
    : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("Resolution") +
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
    `line-height:1.55;white-space:pre-wrap;word-break:break-word;">` +
    `${escapeHtml(data.resolution)}</div>` +
    resolvedOn +
    `</div>`
  );
};

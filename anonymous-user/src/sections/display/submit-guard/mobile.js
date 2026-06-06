// U-F5 anonymity guard — MOBILE renderer (REQUIREMENTS §9.1; wireframes §2 "Mobile").
// Single-column, stacked: heading, the two field lists, then the ER-A1 guidance.
// Tighter type than web (small screen). Composes shared theme tokens
// (lib/utils/theme.js) and escapeHtml (lib/utils/format.js) — every label is
// escaped before HTML use (rule 10).

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const labelList = (labels) => labels.map((l) => escapeHtml(l)).join(" · ");

export const renderMobile = (data) => {
  const { visible, neverShared, guidance } = data;

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};` +
    `background:${COLORS.SURFACE};border:1px solid ${COLORS.WARNING};` +
    `border-left:4px solid ${COLORS.WARNING};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;">` +
    // Heading line.
    `<div style="display:flex;align-items:flex-start;gap:${SPACING.SM}px;` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
    `color:${COLORS.WARNING};margin-bottom:${SPACING.SM}px;line-height:1.4;">` +
    `<span style="line-height:1.2;">⚠</span>` +
    `<span>What the compliance team will see</span>` +
    `</div>` +
    // Visible set.
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;line-height:1.6;` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.XS}px;">` +
    `<strong>Visible:</strong> ${labelList(visible)}` +
    `</div>` +
    // Never-shared set.
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;line-height:1.6;` +
    `color:${COLORS.SUCCESS};margin-bottom:${SPACING.SM}px;">` +
    `<strong>Never shared:</strong> ${labelList(neverShared)}` +
    `</div>` +
    // Guidance.
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;line-height:1.5;` +
    `color:${COLORS.TEXT_MUTED};">${escapeHtml(guidance)}</div>` +
    `</div>`
  );
};

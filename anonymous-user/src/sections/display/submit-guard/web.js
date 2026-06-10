// U-F5 anonymity guard - WEB renderer (REQUIREMENTS §9.1; wireframes §2 "Web").
// A compact warning banner above the form: a single faithful line of what the
// compliance team sees vs never sees, the two field lists, and the ER-A1
// guidance. Composes shared theme tokens (lib/utils/theme.js) and escapeHtml
// (lib/utils/format.js) - every label is escaped before HTML use (rule 10).

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

// Inline list of field labels separated by middots.
const labelList = (labels, color) =>
  `<span style="color:${color};">` +
  labels.map((l) => escapeHtml(l)).join(" · ") +
  `</span>`;

export const renderWeb = (data) => {
  const { visible, neverShared, guidance } = data;

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};` +
    `background:${COLORS.SURFACE};border:1px solid ${COLORS.WARNING};` +
    `border-left:4px solid ${COLORS.WARNING};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;">` +
    // Heading line.
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;` +
    `font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
    `color:${COLORS.WARNING};margin-bottom:${SPACING.SM}px;">` +
    `<span>⚠</span><span>What the compliance team will see</span>` +
    `</div>` +
    // Visible set.
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.6;` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.XS}px;">` +
    `<strong>Visible:</strong> ${labelList(visible, COLORS.TEXT)}` +
    `</div>` +
    // Never-shared set.
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.6;` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.SM}px;">` +
    `<strong style="color:${COLORS.SUCCESS};">Never shared:</strong> ` +
    `${labelList(neverShared, COLORS.SUCCESS)}` +
    `</div>` +
    // Guidance.
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.5;` +
    `color:${COLORS.TEXT_MUTED};">${escapeHtml(guidance)}</div>` +
    `</div>`
  );
};

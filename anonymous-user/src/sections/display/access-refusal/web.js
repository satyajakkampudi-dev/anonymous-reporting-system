// U-F0a access-refused guard — WEB renderer (wireframes-anonymous-user §0;
// "Mobile / Web (identical, single card)"). Content is identical to mobile; web
// constrains the card to a centred, narrow column so it reads as a deliberate wall
// rather than a stretched banner on a wide screen. Composes shared theme tokens
// (lib/utils/theme.js) + escapeHtml (lib/utils/format.js) — the copy is static but
// still escaped at the boundary (NFR-2, rule 10).

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

export const renderWeb = (data) => {
  const { title, body, redirect } = data;

  return (
    // Centred wrapper — narrow card, not full-width.
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};display:flex;` +
    `justify-content:center;padding:${SPACING.XL}px ${SPACING.LG}px;">` +
    `<div style="max-width:420px;width:100%;background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-top:4px solid ${COLORS.PRIMARY};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.XL}px;` +
    `text-align:center;">` +
    // Lock heading.
    `<div style="display:flex;align-items:center;justify-content:center;` +
    `gap:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_LG}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.PRIMARY};` +
    `margin-bottom:${SPACING.LG}px;">` +
    `<span aria-hidden="true">🔒</span><span>${escapeHtml(title)}</span>` +
    `</div>` +
    // Primary message.
    `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;line-height:1.5;` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">` +
    `${escapeHtml(body)}</div>` +
    // Redirect guidance.
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.5;` +
    `color:${COLORS.TEXT_MUTED};">${escapeHtml(redirect)}</div>` +
    `</div>` +
    `</div>`
  );
};

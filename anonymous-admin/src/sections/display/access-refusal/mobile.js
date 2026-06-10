// A-F1 access-refused guard - MOBILE renderer (wireframes-anonymous-admin §0;
// "Mobile / Web (identical, single card)"). Same copy as web; mobile fills the
// available width (no centring wrapper, no max-width) and uses tighter padding for
// the small screen. Composes shared theme tokens (lib/utils/theme.js) + escapeHtml
// (lib/utils/format.js) - copy is static but still escaped at the boundary
// (NFR-2, rule 10).

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

export const renderMobile = (data) => {
  const { title, body, redirect } = data;

  return (
    // Full-width single card - no centring wrapper on the small screen.
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-top:4px solid ${COLORS.PRIMARY};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.LG}px;` +
    `text-align:center;">` +
    // Lock heading.
    `<div style="display:flex;align-items:center;justify-content:center;` +
    `gap:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.PRIMARY};` +
    `margin-bottom:${SPACING.MD}px;">` +
    `<span aria-hidden="true">🔒</span><span>${escapeHtml(title)}</span>` +
    `</div>` +
    // Primary message.
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.5;` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.SM}px;">` +
    `${escapeHtml(body)}</div>` +
    // Redirect guidance.
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;line-height:1.5;` +
    `color:${COLORS.TEXT_MUTED};">${escapeHtml(redirect)}</div>` +
    `</div>`
  );
};

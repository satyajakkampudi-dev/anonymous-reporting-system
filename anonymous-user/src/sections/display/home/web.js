// Home / landing — WEB renderer (REQUIREMENTS §9.1; wireframes §1 "Web").
// Trust banner pinned top, anonymity intro, then three CTAs side-by-side.
// Purely navigational (display_only) — no reportDoc field reads, so always
// safe for a brand-new user with no data. Composes the shared theme tokens
// (lib/utils/theme.js) and the intent-button primitive (lib/utils/format.js).

import { intentButtonHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

// One CTA button. `tone` picks the visual weight (primary / neutral / voice).
const ctaButton = (intentId, label, tone) => {
  const palette = {
    primary: {
      bg: COLORS.PRIMARY,
      fg: COLORS.PRIMARY_CONTRAST,
      border: COLORS.PRIMARY_DARK,
    },
    neutral: { bg: COLORS.SURFACE, fg: COLORS.PRIMARY, border: COLORS.BORDER },
    voice: { bg: COLORS.SURFACE, fg: COLORS.SUCCESS, border: COLORS.BORDER },
  }[tone] || { bg: COLORS.SURFACE, fg: COLORS.TEXT, border: COLORS.BORDER };

  const style =
    `flex:1 1 0;min-width:180px;padding:${SPACING.LG}px ${SPACING.XL}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${palette.border};` +
    `background:${palette.bg};color:${palette.fg};` +
    `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-align:center;`;

  return intentButtonHtml(intentId, label, {}, style);
};

export const renderWeb = (data) => {
  const { intents } = data;

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    // Trust banner — pinned top, trust tone.
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;` +
    `padding:${SPACING.MD}px ${SPACING.XL}px;background:${COLORS.PRIMARY};` +
    `color:${COLORS.PRIMARY_CONTRAST};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;">🛡</span>` +
    `<span>Your identity is never shown to the compliance team.</span>` +
    `</div>` +
    // Body — intro copy + CTAs.
    `<div style="padding:${SPACING.XL}px;">` +
    `<p style="margin:0 0 ${SPACING.XL}px;color:${COLORS.TEXT_MUTED};` +
    `font-size:${TYPOGRAPHY.SIZE_MD}px;line-height:1.6;">` +
    `Report misconduct safely — anonymous by design, enforced in code. ` +
    `Harassment · safety · fraud/ethics · bullying.` +
    `</p>` +
    `<div style="display:flex;gap:${SPACING.LG}px;flex-wrap:wrap;">` +
    ctaButton(intents.submit, "✚  Submit a report", "primary") +
    ctaButton(intents.myReports, "📋  My Reports", "neutral") +
    ctaButton(intents.call, "📞  Call compliance (anonymous)", "voice") +
    `</div>` +
    `</div>` +
    `</div>`
  );
};

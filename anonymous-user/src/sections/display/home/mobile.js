// Home / landing — MOBILE renderer (REQUIREMENTS §9.1; wireframes §1 "Mobile").
// Trust banner pinned top, anonymity intro, then three full-width CTAs stacked
// vertically (large tap targets). Purely navigational (display_only) — no
// reportDoc field reads, so always safe for a brand-new user with no data.

import { intentButtonHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

// One full-width CTA. `tone` picks the visual weight (primary / neutral / voice).
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
    `display:block;width:100%;padding:${SPACING.LG}px;` +
    `margin:0 0 ${SPACING.MD}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${palette.border};` +
    `background:${palette.bg};color:${palette.fg};` +
    `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-align:center;`;

  return intentButtonHtml(intentId, label, {}, style);
};

export const renderMobile = (data) => {
  const { intents } = data;

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    // Trust banner — pinned top, trust tone.
    `<div style="display:flex;align-items:flex-start;gap:${SPACING.SM}px;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;background:${COLORS.PRIMARY};` +
    `color:${COLORS.PRIMARY_CONTRAST};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};line-height:1.5;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;line-height:1.2;">🛡</span>` +
    `<span>Your identity is never shown to the compliance team.</span>` +
    `</div>` +
    // Body — intro copy + stacked CTAs.
    `<div style="padding:${SPACING.LG}px;">` +
    `<p style="margin:0 0 ${SPACING.LG}px;color:${COLORS.TEXT_MUTED};` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;line-height:1.6;">` +
    `Report misconduct safely. This channel is anonymous by design — enforced in code.` +
    `</p>` +
    ctaButton(intents.submit, "✚  Submit a report", "primary") +
    ctaButton(intents.myReports, "📋  My Reports", "neutral") +
    ctaButton(intents.call, data.callLabel, data.callTone) +
    `</div>` +
    `</div>`
  );
};

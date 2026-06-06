// Incoming call (ring banner) — MOBILE renderer (wireframes §7: same content as web,
// restacked for narrow widths — a 📞 icon + the GENERIC "Incoming anonymous call" line, then
// the Answer and Dismiss buttons full-width stacked for one-handed, on-deck use). Composes the
// shared theme tokens (theme.js) + the intentButtonHtml primitive (format.js). Pure
// presentation — index.js owns the read of the loaded call + the RINGING gate.
//
// ANONYMITY (rule 30, ER-A5/A2/A3, C1): the banner reveals NOTHING about the caller — the
// title is a STATIC string and there is no caller datum on this card. The only values present
// are the opaque callRef + Daily meetingId, carried ONLY inside the Answer button's
// data-payload (consumed by the A-F21 atomic claim), never shown as text. Every interpolated
// value is still escaped at the boundary by intentButtonHtml (rule 10).
//
// Answer → atomic claim (A-F21): first admin to write ACTIVE/attendedBy wins; the rest stop
// ringing. Dismiss → local dismiss only (A-F22): this admin's banner clears, others keep
// ringing. Answer is the prominent (success-filled) action; Dismiss is a calm neutral outline.

import { intentButtonHtml } from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  toneColors,
} from "../../../../../lib/utils/theme";
import { TONE } from "../../../../../lib/ticket-status";

const FONT = TYPOGRAPHY.FONT_FAMILY;

// Full-width Answer button — success-toned (claim the call). Carries {callRef, meetingId}.
const answerButtonHtml = (data) => {
  const c = toneColors(TONE.SUCCESS);
  const style =
    `display:block;width:100%;text-align:center;box-sizing:border-box;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;margin-bottom:${SPACING.SM}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};border:1px solid ${c.border};` +
    `background:${c.bg};color:${c.fg};`;
  return intentButtonHtml(
    data.answerIntent,
    "Answer",
    { callRef: data.callRef, meetingId: data.meetingId },
    style
  );
};

// Full-width Dismiss button — neutral outline (local dismiss; others keep ringing).
const dismissButtonHtml = (data) => {
  const style =
    `display:block;width:100%;text-align:center;box-sizing:border-box;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;font-size:${TYPOGRAPHY.SIZE_MD}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};border:1px solid ${COLORS.BORDER};` +
    `background:${COLORS.SURFACE};color:${COLORS.TEXT};`;
  return intentButtonHtml(
    data.dismissIntent,
    "Dismiss",
    { callRef: data.callRef },
    style
  );
};

export const renderMobile = (data) => {
  // Screen-scoped: nothing to show unless a live RINGING call is loaded (ring event).
  if (!data.hasCall) return "";

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-left:4px solid ${COLORS.SUCCESS};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px;">` +
    // Generic banner — NO caller identity, ever (ER-A5).
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;` +
    `margin-bottom:${SPACING.XS}px;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_XL}px;line-height:1;">📞</span>` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">Incoming anonymous call</span>` +
    `</div>` +
    `<div style="margin-bottom:${SPACING.LG}px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `color:${COLORS.TEXT_MUTED};">No caller details are shared. ` +
    `Voice only — the call is not recorded.</div>` +
    `<div>` +
    answerButtonHtml(data) +
    dismissButtonHtml(data) +
    `</div>` +
    `</div>` +
    `</div>`
  );
};

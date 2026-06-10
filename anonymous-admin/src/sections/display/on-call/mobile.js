// On-call status (availability) - MOBILE renderer (wireframes §6: same content as web,
// restacked for narrow widths - a titled card, the current presence pill, then the three
// state buttons full-width stacked, and the one-line "only available admins are rung"
// note). Composes the shared theme tokens (theme.js) + the tonePillHtml / intentButtonHtml
// primitives (format.js). Pure presentation - index.js owns the read.
//
// Three states, NEVER a boolean toggle (rule 30): the button matching the current state is
// rendered "active" (filled with the state's tone); the others are calm outlines. Full-
// width tap targets suit a one-handed, on-deck admin. Every button carries data-payload
// {availability} for the setAvailability handler (A-F20).
//
// NO reporter identity is present (rule 30, ER-A2/A3, C1): the only datum is the caller's
// own 3-state presence; `current` is a closed enum and labels are static, yet every
// interpolated value is still escaped at the boundary by the primitives (rule 10).

import {
  tonePillHtml,
  intentButtonHtml,
} from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  toneColors,
} from "../../../../../lib/utils/theme";
import { TONE } from "../../../../../lib/ticket-status";
import { AVAILABILITY } from "../../../../../lib/constants";

const FONT = TYPOGRAPHY.FONT_FAMILY;

// AVAILABLE = success (on-duty), BUSY = warning (occupied), UNAVAILABLE = neutral (off-duty).
const AVAIL_META = {
  [AVAILABILITY.AVAILABLE]: { label: "Available", tone: TONE.SUCCESS },
  [AVAILABILITY.BUSY]: { label: "Busy", tone: TONE.WARNING },
  [AVAILABILITY.UNAVAILABLE]: { label: "Unavailable", tone: TONE.NEUTRAL },
};

const ORDER = [
  AVAILABILITY.AVAILABLE,
  AVAILABILITY.BUSY,
  AVAILABILITY.UNAVAILABLE,
];

// "Current:" + tone pill. "" → a calm "Not set" pill.
const currentHtml = (current) => {
  const meta = AVAIL_META[current];
  const pill = meta
    ? tonePillHtml(meta.label, toneColors(meta.tone))
    : tonePillHtml("Not set", toneColors(TONE.NEUTRAL));
  return (
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;` +
    `margin-bottom:${SPACING.LG}px;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">Current:</span>` +
    pill +
    `</div>`
  );
};

// One full-width state button. Active (matches `current`) → filled tone; else outline.
const buttonHtml = (value, current, setIntent) => {
  const meta = AVAIL_META[value];
  const active = value === current;
  const c = toneColors(meta.tone);
  const base =
    `display:block;width:100%;text-align:center;box-sizing:border-box;` +
    `padding:${SPACING.MD}px ${SPACING.LG}px;margin-bottom:${SPACING.SM}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;font-size:${TYPOGRAPHY.SIZE_MD}px;`;
  const style = active
    ? base +
      `border:1px solid ${c.border};background:${c.bg};color:${c.fg};` +
      `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};`
    : base +
      `border:1px solid ${COLORS.BORDER};background:${COLORS.SURFACE};` +
      `color:${COLORS.TEXT};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`;
  return intentButtonHtml(
    setIntent,
    meta.label,
    { availability: value },
    style
  );
};

export const renderMobile = (data) => {
  // Screen-scoped: nothing to show unless the caller's own row is loaded (On-call screen).
  if (!data.hasUser) return "";

  const current = data.current || "";
  const buttons = ORDER.map((v) => buttonHtml(v, current, data.setIntent)).join(
    ""
  );

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px;border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">On-call status</div>` +
    `</div>` +
    `<div style="padding:${SPACING.LG}px;">` +
    currentHtml(current) +
    `<div>${buttons}</div>` +
    `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
    `color:${COLORS.TEXT_FAINT};">Only ‘Available’ admins receive incoming calls. ` +
    `Answering a call sets you to ‘Busy’.</div>` +
    `</div>` +
    `</div>`
  );
};

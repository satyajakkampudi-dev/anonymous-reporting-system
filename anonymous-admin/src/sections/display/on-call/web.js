// On-call status (availability) - WEB renderer (wireframes §6: a titled card, the current
// presence shown as a pill, then the three mutually-exclusive state buttons, and a one-
// line note that only `available` admins are rung). Composes the shared theme tokens
// (theme.js) + the tonePillHtml / intentButtonHtml / escapeHtml primitives (format.js).
// Pure presentation - index.js owns the read of the caller's own availability.
//
// Three states, NEVER a boolean toggle (rule 30): the buttons are radio-like - the button
// matching the current state is rendered "active" (filled with the state's tone) so the
// selection is unmistakable; the others are calm outlines. Every button carries
// data-payload {availability} for the setAvailability handler (A-F20).
//
// NO reporter identity is present (rule 30, ER-A2/A3, C1): the only datum is the caller's
// own 3-state presence. `current` is a closed enum from index.js; the button labels are
// static; every interpolated value is still escaped at the boundary (rule 10).

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

// Presentation metadata per availability state: the human label + the pill/active-button
// tone. AVAILABLE = success (green, on-duty), BUSY = warning (amber, on a call / occupied),
// UNAVAILABLE = neutral (grey, off-duty - never rung).
const AVAIL_META = {
  [AVAILABILITY.AVAILABLE]: { label: "Available", tone: TONE.SUCCESS },
  [AVAILABILITY.BUSY]: { label: "Busy", tone: TONE.WARNING },
  [AVAILABILITY.UNAVAILABLE]: { label: "Unavailable", tone: TONE.NEUTRAL },
};

// Fixed button order (wireframe §6).
const ORDER = [
  AVAILABILITY.AVAILABLE,
  AVAILABILITY.BUSY,
  AVAILABILITY.UNAVAILABLE,
];

const headerHtml = () =>
  `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};">On-call status</div>` +
  `</div>`;

// The current-presence line: "Current:" + a tone pill. "" → a calm "Not set" pill.
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

// One state button. The button matching `current` is filled with its tone (active); the
// others are neutral outlines. Carries data-payload {availability} (A-F20).
const buttonHtml = (value, current, setIntent) => {
  const meta = AVAIL_META[value];
  const active = value === current;
  const c = toneColors(meta.tone);
  const base =
    `flex:1 1 auto;text-align:center;padding:${SPACING.SM}px ${SPACING.LG}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;font-size:${TYPOGRAPHY.SIZE_SM}px;`;
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

export const renderWeb = (data) => {
  // Screen-scoped: nothing to show unless the caller's own row is loaded (On-call screen).
  if (!data.hasUser) return "";

  const current = data.current || "";
  const buttons = ORDER.map((v) => buttonHtml(v, current, data.setIntent)).join(
    ""
  );

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    headerHtml() +
    `<div style="padding:${SPACING.XL}px;">` +
    currentHtml(current) +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">${buttons}</div>` +
    `<div style="margin-top:${SPACING.MD}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
    `color:${COLORS.TEXT_FAINT};">Only ‘Available’ admins receive incoming calls. ` +
    `Answering a call sets you to ‘Busy’.</div>` +
    `</div>` +
    `</div>`
  );
};

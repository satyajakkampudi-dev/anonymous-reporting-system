// Report detail actions - MOBILE renderer (wireframes §4 "Actions" card, stacked
// full-width below the resolution card). A titled card: lifecycle actions (Amend /
// Withdraw) on the first row, resolution responses (Accept / Reject) on the second,
// each wrapping for narrow widths with comfortable tap targets. Buttons are pre-gated
// upstream (index.js, via STATUS_META) - this renderer only lays out what it is
// handed; an empty set → it emits nothing (empty-safe). Pure presentation: composes
// the shared intentButtonHtml primitive (format.js - escapes the label + JSON-escapes
// the data-payload, NFR-2 / rule 10) and theme tokens (theme.js). No buttons invented.

import { intentButtonHtml, escapeHtml } from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  toneColors,
} from "../../../../../lib/utils/theme";
import { TONE } from "../../../../../lib/ticket-status";

const sectionTitle = (text) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">${text}</div>`;

// Variant → inline button style (theme tokens only). Mobile uses a taller vertical
// pad for finger targets. "primary" = filled positive (Accept), "danger" = soft red
// (Reject), "neutral" = outline (Amend / Withdraw).
const buttonStyle = (variant) => {
  const base =
    `padding:${SPACING.MD}px ${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};line-height:1.4;`;
  if (variant === "primary") {
    return (
      base +
      `background:${COLORS.SUCCESS};color:${COLORS.PRIMARY_CONTRAST};border:1px solid ${COLORS.SUCCESS};`
    );
  }
  if (variant === "danger") {
    const d = toneColors(TONE.DANGER);
    return (
      base + `background:${d.bg};color:${d.fg};border:1px solid ${d.border};`
    );
  }
  return (
    base +
    `background:${COLORS.SURFACE};color:${COLORS.TEXT};border:1px solid ${COLORS.BORDER};`
  );
};

const renderButton = (reportId, btn) =>
  intentButtonHtml(
    btn.intentId,
    btn.label,
    { reportId },
    buttonStyle(btn.variant)
  );

const buttonRow = (reportId, buttons, marginBottom) => {
  if (!buttons.length) return "";
  return (
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;` +
    `${marginBottom ? `margin-bottom:${SPACING.SM}px;` : ""}">` +
    buttons.map((b) => renderButton(reportId, b)).join("") +
    `</div>`
  );
};

export const renderMobile = (data) => {
  // No legal action AND no hint (no report loaded, or terminal status) - emit nothing.
  if (!data.hasActions && !data.reopenCapNote) return "";

  // Reopen-cap hint (D10): RESOLVED but already reopened once → Reject withheld; explain.
  const note = data.reopenCapNote
    ? `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
      `color:${COLORS.TEXT_MUTED};margin-top:${SPACING.SM}px;line-height:1.4;">` +
      `${escapeHtml(data.reopenCapNote)}</div>`
    : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("Actions") +
    // Lifecycle row keeps its bottom margin only when a resolution row follows.
    buttonRow(data.reportId, data.lifecycle, data.resolution.length > 0) +
    buttonRow(data.reportId, data.resolution, false) +
    note +
    `</div>`
  );
};

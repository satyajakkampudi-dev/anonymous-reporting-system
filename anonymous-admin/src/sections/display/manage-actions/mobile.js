// Manage detail actions — MOBILE renderer (wireframes §4 "Actions" card, admin side, stacked
// full-width below the resolution card). A titled card: forward transitions (Take review / Resolve
// / Escalate / Close as rejected) on the first row, triage/export tools (Override severity / Export)
// on the second, each wrapping for narrow widths with comfortable tap targets. Buttons are pre-gated
// upstream (index.js, via STATUS_META.allowedActionsByRole) — this renderer only lays out what it is
// handed; an empty set → it emits nothing (empty-safe). Pure presentation: composes the shared
// intentButtonHtml primitive (format.js — escapes the label + JSON-escapes the data-payload, NFR-2 /
// rule 10) and theme tokens (theme.js). No buttons are invented here.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1) — buttons carry only reportId.

import { intentButtonHtml } from "../../../../../lib/utils/format";
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

// Variant → inline button style (theme tokens only). Mobile uses a taller vertical pad
// for finger targets. "primary" = filled positive (Take review / Resolve), "warning" =
// soft amber (Escalate), "danger" = soft red (Close as rejected), "neutral" = outline
// (Override severity / Export).
const buttonStyle = (variant) => {
  const base =
    `padding:${SPACING.MD}px ${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};line-height:1.4;`;
  if (variant === "primary") {
    return (
      base +
      `background:${COLORS.PRIMARY};color:${COLORS.PRIMARY_CONTRAST};border:1px solid ${COLORS.PRIMARY};`
    );
  }
  if (variant === "warning") {
    const w = toneColors(TONE.WARNING);
    return (
      base + `background:${w.bg};color:${w.fg};border:1px solid ${w.border};`
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
  // No legal action (no report open, no role, or terminal status) — emit nothing.
  if (!data.hasActions) return "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("Actions") +
    // Transitions row keeps its bottom margin only when a tools row follows.
    buttonRow(data.reportId, data.transitions, data.tools.length > 0) +
    buttonRow(data.reportId, data.tools, false) +
    `</div>`
  );
};

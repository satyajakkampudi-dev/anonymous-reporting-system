// Manage detail actions - WEB renderer (wireframes §4 "Actions" bar, admin side, spanning the
// full width below the resolution card). A titled card: forward transitions (Take review / Resolve
// / Escalate / Close as rejected) on the left, triage/export tools (Override severity / Export) on
// the right. Buttons are pre-gated upstream (index.js, via STATUS_META.allowedActionsByRole) - this
// renderer only lays out whatever it is handed; an empty set → it emits nothing (empty-safe). Pure
// presentation: composes the shared intentButtonHtml primitive (format.js - escapes the label and
// JSON-escapes the data-payload, NFR-2 / rule 10) and theme tokens (theme.js). No buttons are
// invented here; the legal set is decided in index.js.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1) - buttons carry only reportId.

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

// Variant → inline button style. Composed from theme tokens only (no hardcoded colours):
//   "primary" = filled positive (Take review / Resolve - advance the case)
//   "warning" = soft amber (Escalate)
//   "danger"  = soft red (Close as rejected)
//   "neutral" = outline (Override severity / Export)
const buttonStyle = (variant) => {
  const base =
    `padding:${SPACING.SM}px ${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
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

// A disabled action: rendered as a non-clickable, greyed pill (no data-action intent),
// so e.g. Override severity is visibly present-but-inactive on a resolved/closed report.
const renderButton = (reportId, btn) =>
  btn.disabled
    ? `<span style="${buttonStyle(btn.variant)}opacity:0.45;cursor:not-allowed;` +
      `display:inline-block;" title="Not available once the report is resolved">` +
      `${escapeHtml(btn.label)}</span>`
    : intentButtonHtml(
        btn.intentId,
        btn.label,
        { reportId },
        buttonStyle(btn.variant)
      );

const buttonGroup = (reportId, buttons) =>
  `<div style="display:flex;gap:${SPACING.MD}px;flex-wrap:wrap;align-items:center;">` +
  buttons.map((b) => renderButton(reportId, b)).join("") +
  `</div>`;

// Disabled status chip (e.g. green "Resolved") shown where the forward-transition
// buttons would be - the case outcome, not an action.
const completedChipHtml = (chip) => {
  if (!chip) return "";
  const t =
    chip.tone === "success"
      ? toneColors(TONE.SUCCESS)
      : toneColors(TONE.NEUTRAL);
  return (
    `<span style="padding:${SPACING.SM}px ${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `font-family:${TYPOGRAPHY.FONT_FAMILY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};background:${t.bg};color:${t.fg};` +
    `border:1px solid ${t.border};opacity:0.85;cursor:default;display:inline-block;">` +
    `${escapeHtml(chip.label)}</span>`
  );
};

export const renderWeb = (data) => {
  // No legal action and no completed chip - emit nothing.
  if (!data.hasActions) return "";

  const left =
    `<div style="display:flex;gap:${SPACING.MD}px;flex-wrap:wrap;align-items:center;">` +
    data.transitions.map((b) => renderButton(data.reportId, b)).join("") +
    completedChipHtml(data.completedChip) +
    `</div>`;

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px ${SPACING.XL}px;">` +
    sectionTitle("Actions") +
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `gap:${SPACING.LG}px;flex-wrap:wrap;">` +
    left +
    buttonGroup(data.reportId, data.tools) +
    `</div></div>`
  );
};

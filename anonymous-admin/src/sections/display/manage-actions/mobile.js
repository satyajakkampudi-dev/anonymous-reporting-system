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

// Disabled action → non-clickable greyed pill (no intent), e.g. Override severity on a
// resolved/closed report.
const renderButton = (reportId, btn) =>
  btn.disabled
    ? `<span style="${buttonStyle(btn.variant)}opacity:0.45;cursor:not-allowed;` +
      `display:inline-block;">${escapeHtml(btn.label)}</span>`
    : intentButtonHtml(
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

// Disabled status chip (e.g. green "Resolved") shown in place of forward transitions.
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
    `border:1px solid ${t.border};display:inline-block;">${escapeHtml(chip.label)}</span>`
  );
};

export const renderMobile = (data) => {
  // No legal action and no completed chip — emit nothing.
  if (!data.hasActions) return "";

  // First row: forward transitions + the disabled status chip (Resolved / closed).
  const firstRow =
    data.transitions.length || data.completedChip
      ? `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;align-items:center;` +
        `${data.tools.length ? `margin-bottom:${SPACING.SM}px;` : ""}">` +
        data.transitions.map((b) => renderButton(data.reportId, b)).join("") +
        completedChipHtml(data.completedChip) +
        `</div>`
      : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("Actions") +
    firstRow +
    buttonRow(data.reportId, data.tools, false) +
    `</div>`
  );
};

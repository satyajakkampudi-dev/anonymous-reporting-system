// Report detail actions — WEB renderer (wireframes §4 footer action bar, spanning
// the full width below the main/timeline split). A title-less bar: lifecycle actions
// (Amend / Withdraw) on the left, resolution responses (Accept / Reject) on the right.
// Buttons are pre-gated upstream (index.js, via STATUS_META) — this renderer only
// lays out whatever it is handed; an empty set → it emits nothing (empty-safe). Pure
// presentation: composes the shared intentButtonHtml primitive (format.js — which
// escapes the label and JSON-escapes the data-payload, NFR-2 / rule 10) and theme
// tokens (theme.js). No buttons are invented here; the legal set is decided in index.js.

import { intentButtonHtml } from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  toneColors,
} from "../../../../../lib/utils/theme";
import { TONE } from "../../../../../lib/ticket-status";

// Variant → inline button style. Composed from theme tokens only (no hardcoded
// colours): "primary" = filled positive (Accept), "danger" = soft red (Reject),
// "neutral" = outline (Amend / Withdraw).
const buttonStyle = (variant) => {
  const base =
    `padding:${SPACING.SM}px ${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
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

const buttonGroup = (reportId, buttons) =>
  `<div style="display:flex;gap:${SPACING.MD}px;flex-wrap:wrap;align-items:center;">` +
  buttons.map((b) => renderButton(reportId, b)).join("") +
  `</div>`;

export const renderWeb = (data) => {
  // No legal action (no report loaded, or terminal status) — emit nothing.
  if (!data.hasActions) return "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.MD}px ${SPACING.XL}px;display:flex;justify-content:space-between;` +
    `align-items:center;gap:${SPACING.LG}px;flex-wrap:wrap;">` +
    buttonGroup(data.reportId, data.lifecycle) +
    buttonGroup(data.reportId, data.resolution) +
    `</div>`
  );
};

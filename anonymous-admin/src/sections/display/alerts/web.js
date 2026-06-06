// Alerts / Digest — WEB renderer (wireframes §5: a titled card, an optional amber
// fallback banner, then a list of SLA-breach rows — status pill · tracking id · age ·
// assigned role · "Open →"). Composes the shared theme tokens (theme.js) + the
// escapeHtml / payloadAttr / statusPillHtml / emptyStateHtml / formatRelative primitives
// (format.js); every interpolated value is escaped at the boundary (NFR-2, rule 10).
// Pure presentation — index.js owns the read, the breach computation, and the sort.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1): a breach row
// carries only reportId, status, the SLA-age reference, and the assigned ROLE.

import {
  escapeHtml,
  payloadAttr,
  statusPillHtml,
  emptyStateHtml,
  formatRelative,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";
import { ROLE } from "../../../../../lib/constants";

const FONT = TYPOGRAPHY.FONT_FAMILY;

// Short assigned-role label ("PRIMARY" / "SECONDARY"); "—" if unset (matches the queue).
const ASSIGNED_SHORT = {
  [ROLE.PRIMARY_ADMIN]: "PRIMARY",
  [ROLE.SECONDARY_ADMIN]: "SECONDARY",
};
const assignedLabel = (assignedTo) => ASSIGNED_SHORT[assignedTo] || "—";

const headerHtml = () =>
  `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};">Alerts</div>` +
  `</div>`;

// Amber fallback banner — only when ≥1 report could not be notified (ER-D15). The count
// is a number from index.js (no interpolated user text); pluralised.
const bannerHtml = (count) => {
  if (!count) return "";
  const noun = count === 1 ? "report" : "reports";
  return (
    `<div style="display:flex;gap:${SPACING.SM}px;align-items:flex-start;` +
    `padding:${SPACING.MD}px ${SPACING.XL}px;background:${COLORS.SURFACE_ALT};` +
    `border-bottom:1px solid ${COLORS.BORDER};color:${COLORS.WARNING};` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
    `<span aria-hidden="true">⚠</span>` +
    `<span>Could not notify ${count} ${noun} — review the queue below so a missed ` +
    `email never means an unseen report.</span>` +
    `</div>`
  );
};

// One SLA-breach row: status pill + tracking id, age + assigned role, and an Open button.
const rowHtml = (r, openIntent) =>
  `<div style="display:flex;align-items:center;justify-content:space-between;` +
  `gap:${SPACING.MD}px;padding:${SPACING.MD}px ${SPACING.LG}px;` +
  `border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="display:flex;flex-direction:column;gap:${SPACING.XS}px;min-width:0;">` +
  `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
  statusPillHtml(r.status) +
  `<span style="font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">` +
  `${escapeHtml(r.reportId)}</span>` +
  `</div>` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;color:${COLORS.TEXT_FAINT};">` +
  `${escapeHtml(formatRelative(r.sinceOn))} · ${escapeHtml(assignedLabel(r.assignedTo))}</div>` +
  `</div>` +
  `<button type="button" data-action="intent" ` +
  `data-intent-id="${escapeHtml(openIntent)}" ` +
  `data-payload='${payloadAttr({ reportId: r.reportId })}' ` +
  `style="cursor:pointer;flex:0 0 auto;padding:${SPACING.SM}px ${SPACING.LG}px;` +
  `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY};` +
  `background:${COLORS.SURFACE};color:${COLORS.PRIMARY};` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};font-size:${TYPOGRAPHY.SIZE_SM}px;">` +
  `<span style="pointer-events:none;">Open →</span>` +
  `</button>` +
  `</div>`;

export const renderWeb = (data) => {
  const breaches = data.breaches || [];

  // Both empty → the schema empty state. The banner already covers the failure case, so
  // the empty state shows only when there is genuinely nothing to surface.
  const hasContent = breaches.length || data.notificationFailureCount;

  const breachBlock = breaches.length
    ? `<div style="padding:${SPACING.SM}px ${SPACING.XL}px ${SPACING.XS}px;` +
      `font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;letter-spacing:0.04em;` +
      `color:${COLORS.TEXT_FAINT};">SLA breaches</div>` +
      `<div>${breaches.map((r) => rowHtml(r, data.openIntent)).join("")}</div>`
    : "";

  const body = hasContent
    ? bannerHtml(data.notificationFailureCount) + breachBlock
    : emptyStateHtml("No SLA breaches or notification failures.");

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    headerHtml() +
    body +
    `</div>`
  );
};

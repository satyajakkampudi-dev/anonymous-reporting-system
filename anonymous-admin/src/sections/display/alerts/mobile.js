// Alerts / Digest - MOBILE renderer (wireframes §5: same list shape as web, restacked
// for narrow widths). A titled card, an optional amber fallback banner, then one stacked
// bordered block per SLA-breach (status pill + tracking id on top, then age · assigned
// role and an "Open →" button). Composes the shared theme tokens (theme.js) + the
// escapeHtml / payloadAttr / statusPillHtml / emptyStateHtml / formatRelative primitives
// (format.js); every value is escaped at the boundary (NFR-2, rule 10). Pure
// presentation - index.js owns the read, the breach computation, and the sort.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1).

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

const ASSIGNED_SHORT = {
  [ROLE.PRIMARY_ADMIN]: "PRIMARY",
  [ROLE.SECONDARY_ADMIN]: "SECONDARY",
};
const assignedLabel = (assignedTo) => ASSIGNED_SHORT[assignedTo] || "-";

// Amber fallback banner - only when ≥1 report could not be notified (ER-D15).
const bannerHtml = (count) => {
  if (!count) return "";
  const noun = count === 1 ? "report" : "reports";
  return (
    `<div style="display:flex;gap:${SPACING.SM}px;align-items:flex-start;` +
    `padding:${SPACING.MD}px;border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;background:${COLORS.SURFACE_ALT};` +
    `margin-bottom:${SPACING.MD}px;color:${COLORS.WARNING};` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
    `<span aria-hidden="true">⚠</span>` +
    `<span>Could not notify ${count} ${noun} - review below so a missed email never ` +
    `means an unseen report.</span>` +
    `</div>`
  );
};

// One stacked breach block.
const cardHtml = (r, openIntent) =>
  `<div style="border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
  `padding:${SPACING.MD}px;margin-bottom:${SPACING.MD}px;display:flex;` +
  `flex-direction:column;gap:${SPACING.XS}px;">` +
  `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
  statusPillHtml(r.status) +
  `<span style="font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">` +
  `${escapeHtml(r.reportId)}</span>` +
  `</div>` +
  `<div style="display:flex;align-items:center;justify-content:space-between;gap:${SPACING.SM}px;">` +
  `<span style="font-size:${TYPOGRAPHY.SIZE_XS}px;color:${COLORS.TEXT_FAINT};">` +
  `${escapeHtml(formatRelative(r.sinceOn))} · ${escapeHtml(assignedLabel(r.assignedTo))}</span>` +
  `<button type="button" data-action="intent" ` +
  `data-intent-id="${escapeHtml(openIntent)}" ` +
  `data-payload='${payloadAttr({ reportId: r.reportId })}' ` +
  `style="cursor:pointer;flex:0 0 auto;padding:${SPACING.XS}px ${SPACING.MD}px;` +
  `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY};` +
  `background:${COLORS.SURFACE};color:${COLORS.PRIMARY};` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};font-size:${TYPOGRAPHY.SIZE_SM}px;">` +
  `<span style="pointer-events:none;">Open →</span>` +
  `</button>` +
  `</div>` +
  `</div>`;

export const renderMobile = (data) => {
  const breaches = data.breaches || [];
  const hasContent = breaches.length || data.notificationFailureCount;

  const breachBlock = breaches.length
    ? `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
      `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};margin-bottom:${SPACING.SM}px;">` +
      `SLA breaches</div>` +
      breaches.map((r) => cardHtml(r, data.openIntent)).join("")
    : "";

  const body = hasContent
    ? bannerHtml(data.notificationFailureCount) + breachBlock
    : emptyStateHtml("No SLA breaches or notification failures.");

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px;border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">Alerts</div>` +
    `</div>` +
    `<div style="padding:${SPACING.MD}px;">${body}</div>` +
    (data.paginationHtml || "") +
    `</div>`
  );
};

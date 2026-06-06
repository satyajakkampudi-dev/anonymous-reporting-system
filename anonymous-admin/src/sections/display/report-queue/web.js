// Report queue — WEB renderer (wireframes §2 "Web": table-style cards + filter bar).
// A scan-and-triage list: a quick-filter chip row, then one card per report showing
// priority badge + severity tone + status pill + category · urgency · age, the
// assigned role, and an "Open →" button. Composes shared theme tokens (theme.js) +
// the escapeHtml / statusPillHtml / tonePillHtml / payloadAttr / emptyStateHtml /
// formatRelative primitives (format.js); every interpolated value is escaped at the
// boundary (NFR-2, rule 10). Pure presentation — index.js owns the read.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3). Priority SORT is
// A-F5's job; this file renders rows in the order index.js supplies them.

import {
  escapeHtml,
  payloadAttr,
  statusPillHtml,
  tonePillHtml,
  emptyStateHtml,
  formatRelative,
} from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  severityColors,
} from "../../../../../lib/utils/theme";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  SEVERITY_LABELS,
  ROLE,
} from "../../../../../lib/constants";

const FONT = TYPOGRAPHY.FONT_FAMILY;

// Short assigned-role label for the queue ("PRIMARY" / "SECONDARY"); "—" if unset.
const ASSIGNED_SHORT = {
  [ROLE.PRIMARY_ADMIN]: "PRIMARY",
  [ROLE.SECONDARY_ADMIN]: "SECONDARY",
};
const assignedLabel = (assignedTo) => ASSIGNED_SHORT[assignedTo] || "—";

// A quick-filter chip — an openQueue intent button. The active chip is filled.
const chipHtml = (chip, activeFilter, filterIntent) => {
  const active = chip.key === activeFilter;
  return (
    `<button type="button" data-action="intent" ` +
    `data-intent-id="${escapeHtml(filterIntent)}" ` +
    `data-payload='${payloadAttr({ filter: chip.key })}' ` +
    `style="cursor:pointer;padding:${SPACING.XS}px ${SPACING.MD}px;` +
    `border-radius:999px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
    `border:1px solid ${active ? COLORS.PRIMARY : COLORS.BORDER};` +
    `background:${active ? COLORS.PRIMARY : COLORS.SURFACE};` +
    `color:${active ? COLORS.PRIMARY_CONTRAST : COLORS.TEXT_MUTED};">` +
    `<span style="pointer-events:none;">${escapeHtml(chip.label)}</span>` +
    `</button>`
  );
};

// The priority badge — a small flagged pill, only for priority/escalated rows.
const priorityBadgeHtml = () =>
  `<span style="display:inline-block;padding:2px 8px;border-radius:999px;` +
  `font-size:${TYPOGRAPHY.SIZE_XS}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `background:${COLORS.CRITICAL};color:${COLORS.PRIMARY_CONTRAST};">⚑ Priority</span>`;

// One report row (table-style card).
const rowHtml = (r, openIntent) => {
  const category = CATEGORY_LABELS[r.category] || r.category || "—";
  const urgency = URGENCY_LABELS[r.urgency] || r.urgency || "—";
  const severity = SEVERITY_LABELS[r.severity] || r.severity;
  const meta = [category, urgency, formatRelative(r.createdOn)]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  return (
    `<div style="display:flex;align-items:center;justify-content:space-between;` +
    `gap:${SPACING.MD}px;padding:${SPACING.MD}px ${SPACING.LG}px;` +
    `border-bottom:1px solid ${COLORS.BORDER};">` +
    // Left: badges + tracking id + meta + assigned
    `<div style="display:flex;flex-direction:column;gap:${SPACING.XS}px;min-width:0;">` +
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
    (r.isPriority ? priorityBadgeHtml() : "") +
    (r.severity ? tonePillHtml(severity, severityColors(r.severity)) : "") +
    statusPillHtml(r.status) +
    `<span style="font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">` +
    `${escapeHtml(r.reportId)}</span>` +
    `</div>` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">${meta}</div>` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;color:${COLORS.TEXT_FAINT};">` +
    `Assigned: ${escapeHtml(assignedLabel(r.assignedTo))}</div>` +
    `</div>` +
    // Right: Open button
    `<button type="button" data-action="intent" ` +
    `data-intent-id="${escapeHtml(openIntent)}" ` +
    `data-payload='${payloadAttr({ reportId: r.reportId })}' ` +
    `style="cursor:pointer;flex:0 0 auto;padding:${SPACING.SM}px ${SPACING.LG}px;` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;border:1px solid ${COLORS.PRIMARY};` +
    `background:${COLORS.SURFACE};color:${COLORS.PRIMARY};` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};font-size:${TYPOGRAPHY.SIZE_SM}px;">` +
    `<span style="pointer-events:none;">Open →</span>` +
    `</button>` +
    `</div>`
  );
};

export const renderWeb = (data) => {
  const chips = (data.chips || [])
    .map((c) => chipHtml(c, data.activeFilter, data.filterIntent))
    .join("");

  const header =
    `<div style="display:flex;align-items:center;justify-content:space-between;` +
    `gap:${SPACING.LG}px;flex-wrap:wrap;padding:${SPACING.LG}px ${SPACING.XL}px;` +
    `border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">Reports</div>` +
    `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">${chips}</div>` +
    `</div>`;

  const body = data.reports.length
    ? data.reports.map((r) => rowHtml(r, data.openIntent)).join("")
    : emptyStateHtml("No reports match this view.");

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    header +
    `<div>${body}</div>` +
    `</div>`
  );
};

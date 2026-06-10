// Report queue - MOBILE renderer (wireframes §2 "Mobile": stacked cards, chips on a
// horizontal-scroll row). Each report is a bordered card: priority badge + severity
// tone + status pill on top, tracking id, category · urgency, then age · assigned and
// an "Open →" button. Composes the shared theme tokens (theme.js) + the escapeHtml /
// statusPillHtml / tonePillHtml / payloadAttr / emptyStateHtml / formatRelative
// primitives (format.js); every value is escaped at the boundary (NFR-2, rule 10).
// Pure presentation - index.js owns the read.
//
// NO reporter identity is present (rule 30, ER-A2/A3). Priority SORT is A-F5's job.

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

const ASSIGNED_SHORT = {
  [ROLE.PRIMARY_ADMIN]: "PRIMARY",
  [ROLE.SECONDARY_ADMIN]: "SECONDARY",
};
const assignedLabel = (assignedTo) => ASSIGNED_SHORT[assignedTo] || "-";

// A quick-filter chip - an openQueue intent button (active chip filled).
const chipHtml = (chip, activeFilter, filterIntent) => {
  const active = chip.key === activeFilter;
  return (
    `<button type="button" data-action="intent" ` +
    `data-intent-id="${escapeHtml(filterIntent)}" ` +
    `data-payload='${payloadAttr({ filter: chip.key })}' ` +
    `style="cursor:pointer;flex:0 0 auto;padding:${SPACING.XS}px ${SPACING.MD}px;` +
    `border-radius:999px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};white-space:nowrap;` +
    `border:1px solid ${active ? COLORS.PRIMARY : COLORS.BORDER};` +
    `background:${active ? COLORS.PRIMARY : COLORS.SURFACE};` +
    `color:${active ? COLORS.PRIMARY_CONTRAST : COLORS.TEXT_MUTED};">` +
    `<span style="pointer-events:none;">${escapeHtml(chip.label)}</span>` +
    `</button>`
  );
};

const priorityBadgeHtml = () =>
  `<span style="display:inline-block;padding:2px 8px;border-radius:999px;` +
  `font-size:${TYPOGRAPHY.SIZE_XS}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `background:${COLORS.CRITICAL};color:${COLORS.PRIMARY_CONTRAST};">⚑ Priority</span>`;

// One stacked report card.
const cardHtml = (r, openIntent) => {
  const category = CATEGORY_LABELS[r.category] || r.category || "-";
  const urgency = URGENCY_LABELS[r.urgency] || r.urgency || "-";
  const severity = SEVERITY_LABELS[r.severity] || r.severity;
  const meta = [category, urgency].filter(Boolean).map(escapeHtml).join(" · ");
  const ageAssigned = [formatRelative(r.createdOn), assignedLabel(r.assignedTo)]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");

  return (
    `<div style="border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.MD}px;margin-bottom:${SPACING.MD}px;display:flex;` +
    `flex-direction:column;gap:${SPACING.XS}px;">` +
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
    (r.isPriority ? priorityBadgeHtml() : "") +
    (r.severity ? tonePillHtml(severity, severityColors(r.severity)) : "") +
    statusPillHtml(r.status) +
    `</div>` +
    `<div style="font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">` +
    `${escapeHtml(r.reportId)}</div>` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">${meta}</div>` +
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:${SPACING.SM}px;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_XS}px;color:${COLORS.TEXT_FAINT};">${ageAssigned}</span>` +
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
    `</div>`
  );
};

export const renderMobile = (data) => {
  const chips = (data.chips || [])
    .map((c) => chipHtml(c, data.activeFilter, data.filterIntent))
    .join("");

  const header =
    `<div style="padding:${SPACING.LG}px;border-bottom:1px solid ${COLORS.BORDER};">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.SM}px;">Reports</div>` +
    `<div style="display:flex;gap:${SPACING.SM}px;overflow-x:auto;` +
    `-webkit-overflow-scrolling:touch;">${chips}</div>` +
    `</div>`;

  const body = data.reports.length
    ? data.reports.map((r) => cardHtml(r, data.openIntent)).join("")
    : emptyStateHtml("No reports match this view.");

  return (
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    header +
    `<div style="padding:${SPACING.MD}px;">${body}</div>` +
    (data.paginationHtml || "") +
    `</div>`
  );
};

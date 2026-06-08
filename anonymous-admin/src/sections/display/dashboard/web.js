// Dashboard — WEB renderer (wireframes §1 "Web": multi-column grid). Priority/
// Escalated card leads (highlighted, clickable → priority queue); then By status /
// By severity side by side; then By age / Per ship. Plain stat cards — NO charts
// (D4). Composes shared theme tokens (theme.js) + the escapeHtml / emptyStateHtml /
// payloadAttr primitives (format.js); every interpolated value is escaped at the
// boundary (NFR-2, rule 10). Pure presentation — index.js owns the stash read.
//
// Counts come pre-aggregated and per-ship-suppressed from the A-F2 stash; this file
// only lays them out. No reporter identity is present in the stash (rule 30).

import {
  escapeHtml,
  emptyStateHtml,
  payloadAttr,
  intentButtonHtml,
} from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  STATUS_TONES,
  severityColors,
} from "../../../../../lib/utils/theme";
import { statusLabel } from "../../../../../lib/ticket-status";
import { SEVERITY_LABELS } from "../../../../../lib/constants";

const FONT = TYPOGRAPHY.FONT_FAMILY;

// One stat cell: a small white box with a coloured accent bar, the count large,
// and the label beneath. `accent` is a { bg, fg, border } tone (or undefined → neutral).
const statCell = (label, count, accent) => {
  const a = accent || {
    bg: COLORS.SURFACE_ALT,
    fg: COLORS.TEXT,
    border: COLORS.BORDER,
  };
  return (
    `<div style="min-width:96px;flex:0 0 auto;background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-top:3px solid ${a.fg};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.MD}px ${SPACING.LG}px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_XXL}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${a.fg};line-height:1.1;">${escapeHtml(String(count))}</div>` +
    `<div style="margin-top:${SPACING.XS}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};color:${COLORS.TEXT_MUTED};` +
    `text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(label)}</div>` +
    `</div>`
  );
};

// A titled group of stat cells, laid out as a wrapping flex row. Empty → muted "—".
const statGroup = (title, cells, extraNote = "") =>
  `<div style="margin-bottom:${SPACING.XL}px;">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
  `color:${COLORS.TEXT_FAINT};text-transform:uppercase;letter-spacing:0.04em;` +
  `margin-bottom:${SPACING.SM}px;">${escapeHtml(title)}` +
  (extraNote
    ? `<span style="margin-left:${SPACING.SM}px;font-weight:${TYPOGRAPHY.WEIGHT_REGULAR};` +
      `text-transform:none;letter-spacing:0;color:${COLORS.TEXT_FAINT};">${escapeHtml(extraNote)}</span>`
    : "") +
  `</div>` +
  (cells.length
    ? `<div style="display:flex;gap:${SPACING.MD}px;flex-wrap:wrap;">${cells.join("")}</div>`
    : `<div style="color:${COLORS.TEXT_FAINT};font-size:${TYPOGRAPHY.SIZE_SM}px;">—</div>`) +
  `</div>`;

// The highlighted, clickable Priority / Escalated card — a single intent button so
// the whole surface navigates to the priority-filtered queue. Inner content carries
// pointer-events:none so nested nodes never swallow the click (format.js convention).
const priorityCardHtml = (data) =>
  `<button type="button" data-action="intent" ` +
  `data-intent-id="${escapeHtml(data.priorityIntent)}" ` +
  `data-payload='${payloadAttr(data.priorityPayload)}' ` +
  `style="cursor:pointer;display:flex;align-items:center;gap:${SPACING.LG}px;` +
  `width:100%;text-align:left;margin-bottom:${SPACING.XL}px;` +
  `padding:${SPACING.LG}px ${SPACING.XL}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
  `border:1px solid ${COLORS.DANGER};background:${COLORS.CRITICAL};color:${COLORS.PRIMARY_CONTRAST};">` +
  `<span style="pointer-events:none;font-size:28px;line-height:1;">⚑</span>` +
  `<span style="pointer-events:none;font-size:${TYPOGRAPHY.SIZE_XXL}px;` +
  `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};">${escapeHtml(String(data.priorityCount))}</span>` +
  `<span style="pointer-events:none;display:flex;flex-direction:column;">` +
  `<span style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">Priority / Escalated</span>` +
  `<span style="font-size:${TYPOGRAPHY.SIZE_XS}px;opacity:0.85;">Open the priority queue ›</span>` +
  `</span>` +
  `</button>`;

export const renderWeb = (data) => {
  // Top navigation bar (wireframes §1) — the dashboard is the nav hub. Each button
  // opens that screen (in its own tab; the tab strip lets the admin switch back).
  // Rendered in EVERY shell state so navigation never depends on there being reports.
  const navBtnStyle =
    `background:${COLORS.SURFACE};border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.SM}px ${SPACING.LG}px;` +
    `font-family:${FONT};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};color:${COLORS.TEXT};`;
  const navBarHtml = (nav) =>
    nav
      ? `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
        intentButtonHtml(nav.queue, "Queue", {}, navBtnStyle) +
        intentButtonHtml(nav.onCall, "On-call", {}, navBtnStyle) +
        intentButtonHtml(nav.manualLog, "Manual log", {}, navBtnStyle) +
        `</div>`
      : "";

  const shell = (inner) =>
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};` +
    `display:flex;align-items:center;justify-content:space-between;gap:${SPACING.LG}px;flex-wrap:wrap;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">Anonymous Reporting — Admin</span>` +
    navBarHtml(data.nav) +
    `</div>` +
    `<div style="padding:${SPACING.XL}px;">${inner}</div>` +
    `</div>`;

  // Pre-A-F2 (no stash yet): neutral empty state, not misleading zeroes.
  if (!data.hasStash) {
    return shell(
      emptyStateHtml(
        "Dashboard statistics will appear here once reports are loaded."
      )
    );
  }
  // Aggregation ran but the scope is empty.
  if (data.totalReports === 0) {
    return shell(emptyStateHtml("No reports in scope yet."));
  }

  const statusCells = data.byStatus.map((s) =>
    statCell(statusLabel(s.status), s.count, STATUS_TONES[s.status])
  );
  const severityCells = data.bySeverity.map((s) =>
    statCell(
      SEVERITY_LABELS[s.severity] || s.severity,
      s.count,
      severityColors(s.severity)
    )
  );
  const ageCells = data.byAge.map((a) =>
    statCell(a.label || a.bucket, a.count)
  );
  const shipCells = data.perShip.map((p) => statCell(p.label, p.count));

  // Two-column rows mirroring the wireframe grid.
  const twoCol = (left, right) =>
    `<div style="display:flex;gap:${SPACING.XXL}px;flex-wrap:wrap;">` +
    `<div style="flex:1 1 280px;">${left}</div>` +
    `<div style="flex:1 1 280px;">${right}</div>` +
    `</div>`;

  return shell(
    priorityCardHtml(data) +
      twoCol(
        statGroup("By status", statusCells),
        statGroup("By severity", severityCells)
      ) +
      twoCol(
        statGroup("By age", ageCells),
        statGroup("Per ship", shipCells, "small cells (<5) merged to “Other”")
      )
  );
};

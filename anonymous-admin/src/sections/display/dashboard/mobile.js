// Dashboard — MOBILE renderer (wireframes §1 "Mobile": single column, priority
// pinned top). Compact chip rows instead of the web grid: a full-width priority
// card, then By status / By severity / By age / Per ship as wrapping chips. Plain
// stat chips — NO charts (D4). Composes shared theme tokens (theme.js) + the
// escapeHtml / emptyStateHtml / payloadAttr primitives (format.js); every value is
// escaped at the boundary (NFR-2, rule 10). Pure presentation — index.js owns the
// stash read. Counts arrive pre-aggregated + per-ship-suppressed (A-F2); no reporter
// identity is present (rule 30).

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

// A compact "label count" chip with a tone accent. `accent` is { bg, fg, border }.
const statChip = (label, count, accent) => {
  const a = accent || {
    bg: COLORS.SURFACE_ALT,
    fg: COLORS.TEXT,
    border: COLORS.BORDER,
  };
  return (
    `<span style="display:inline-flex;align-items:baseline;gap:${SPACING.XS}px;` +
    `padding:${SPACING.XS}px ${SPACING.MD}px;border-radius:999px;` +
    `background:${a.bg};border:1px solid ${a.border};">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
    `color:${a.fg};">${escapeHtml(label)}</span>` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${a.fg};">${escapeHtml(String(count))}</span>` +
    `</span>`
  );
};

// A titled group of chips on one wrapping row. Empty → muted "—".
const chipGroup = (title, chips, extraNote = "") =>
  `<div style="margin-bottom:${SPACING.LG}px;">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
  `color:${COLORS.TEXT_FAINT};text-transform:uppercase;letter-spacing:0.04em;` +
  `margin-bottom:${SPACING.SM}px;">${escapeHtml(title)}` +
  (extraNote
    ? ` <span style="font-weight:${TYPOGRAPHY.WEIGHT_REGULAR};text-transform:none;` +
      `letter-spacing:0;">${escapeHtml(extraNote)}</span>`
    : "") +
  `</div>` +
  (chips.length
    ? `<div style="display:flex;gap:${SPACING.SM}px;flex-wrap:wrap;">${chips.join("")}</div>`
    : `<div style="color:${COLORS.TEXT_FAINT};font-size:${TYPOGRAPHY.SIZE_SM}px;">—</div>`) +
  `</div>`;

// Full-width clickable priority card; inner nodes carry pointer-events:none.
const priorityCardHtml = (data) =>
  `<button type="button" data-action="intent" ` +
  `data-intent-id="${escapeHtml(data.priorityIntent)}" ` +
  `data-payload='${payloadAttr(data.priorityPayload)}' ` +
  `style="cursor:pointer;display:flex;align-items:center;gap:${SPACING.MD}px;` +
  `width:100%;text-align:left;margin-bottom:${SPACING.LG}px;` +
  `padding:${SPACING.LG}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
  `border:1px solid ${COLORS.DANGER};background:${COLORS.CRITICAL};color:${COLORS.PRIMARY_CONTRAST};">` +
  `<span style="pointer-events:none;font-size:24px;line-height:1;">⚑</span>` +
  `<span style="pointer-events:none;font-size:${TYPOGRAPHY.SIZE_XL}px;` +
  `font-weight:${TYPOGRAPHY.WEIGHT_BOLD};">${escapeHtml(String(data.priorityCount))}</span>` +
  `<span style="pointer-events:none;font-size:${TYPOGRAPHY.SIZE_MD}px;` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">Priority / Escalated ›</span>` +
  `</button>`;

export const renderMobile = (data) => {
  // Nav buttons (wireframes §1 mobile ☰) — full-width stacked row; each opens that
  // screen in its own tab. Always rendered so navigation never depends on reports.
  const navBtnStyle =
    `flex:1 1 auto;background:${COLORS.SURFACE};border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `font-family:${FONT};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};color:${COLORS.TEXT};`;
  const navBarHtml = (nav) =>
    nav
      ? `<div style="display:flex;gap:${SPACING.SM}px;margin-bottom:${SPACING.LG}px;flex-wrap:wrap;">` +
        intentButtonHtml(nav.queue, "Queue", {}, navBtnStyle) +
        intentButtonHtml(nav.onCall, "On-call", {}, navBtnStyle) +
        intentButtonHtml(nav.manualLog, "Manual log", {}, navBtnStyle) +
        `</div>`
      : "";

  const shell = (inner) =>
    `<div style="font-family:${FONT};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    `<div style="padding:${SPACING.LG}px;border-bottom:1px solid ${COLORS.BORDER};` +
    `font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};color:${COLORS.TEXT};">` +
    `Admin · Dashboard</div>` +
    `<div style="padding:${SPACING.LG}px;">${navBarHtml(data.nav)}${inner}</div>` +
    `</div>`;

  if (!data.hasStash) {
    return shell(
      emptyStateHtml(
        "Dashboard statistics will appear here once reports are loaded."
      )
    );
  }
  if (data.totalReports === 0) {
    return shell(emptyStateHtml("No reports in scope yet."));
  }

  const statusChips = data.byStatus.map((s) =>
    statChip(statusLabel(s.status), s.count, STATUS_TONES[s.status])
  );
  const severityChips = data.bySeverity.map((s) =>
    statChip(
      SEVERITY_LABELS[s.severity] || s.severity,
      s.count,
      severityColors(s.severity)
    )
  );
  const ageChips = data.byAge.map((a) =>
    statChip(a.label || a.bucket, a.count)
  );
  const shipChips = data.perShip.map((p) => statChip(p.label, p.count));

  return shell(
    priorityCardHtml(data) +
      chipGroup("By status", statusChips) +
      chipGroup("By severity", severityChips) +
      chipGroup("By age", ageChips) +
      chipGroup("Per ship", shipChips, "<5 → “Other”")
  );
};

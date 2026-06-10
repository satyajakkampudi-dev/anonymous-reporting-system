// Status timeline - MOBILE renderer (wireframes §4 "Status timeline"): same data as
// web, restacked for narrow widths. A titled card, then one stacked block per status
// change (pill, then change time + actor role on its own line, then the optional
// note), newest first. Generous vertical rhythm for touch. Each block carries the
// status pill (label+tone from ticket-status meta), the actor ROLE label only (never
// an id - anonymity, rule 16), and the note. Composes the shared statusPillHtml /
// escapeHtml / formatDateTime / emptyStateHtml primitives (format.js) with theme
// tokens (theme.js) - every interpolated value is escaped at the boundary (NFR-2,
// rule 10). Pure presentation: index.js owns the data, the role mapping, and the sort.

import {
  escapeHtml,
  formatDateTime,
  statusPillHtml,
  emptyStateHtml,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const entryBlock = (r) => {
  const when = formatDateTime(r.changedOn);
  const meta =
    `<div style="margin-top:${SPACING.XS}px;color:${COLORS.TEXT_FAINT};` +
    `font-size:${TYPOGRAPHY.SIZE_XS}px;">` +
    `${escapeHtml(when)}` +
    (r.actorLabel ? ` · ${escapeHtml(r.actorLabel)}` : "") +
    `</div>`;

  const note = r.note
    ? `<div style="margin-top:${SPACING.SM}px;color:${COLORS.TEXT};` +
      `font-size:${TYPOGRAPHY.SIZE_MD}px;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(r.note)}</div>`
    : "";

  return (
    `<div style="padding:${SPACING.MD}px;border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;margin-bottom:${SPACING.SM}px;background:${COLORS.SURFACE};">` +
    statusPillHtml(r.toStatus) +
    meta +
    note +
    `</div>`
  );
};

export const renderMobile = (data) => {
  // No report loaded (Home / My-Reports screens) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.rows.length
    ? data.rows.map(entryBlock).join("")
    : emptyStateHtml("No status changes yet.");

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.LG}px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">Status timeline</div>` +
    body +
    `</div>`
  );
};

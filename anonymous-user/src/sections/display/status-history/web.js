// Status timeline - WEB renderer (wireframes §4 "Status timeline"): a titled card,
// then a vertical timeline - one entry per status change (dot + connecting rail),
// newest first. Each entry shows the status pill (label+tone from ticket-status meta),
// the change time, the actor ROLE label (never an id - anonymity, rule 16), and the
// optional note. Composes the shared statusPillHtml / escapeHtml / formatDateTime /
// emptyStateHtml primitives (format.js) with theme tokens (theme.js) - every
// interpolated value is escaped at the primitive boundary (NFR-2, rule 10). Pure
// presentation: index.js owns the data, the role mapping, and the sort.

import {
  escapeHtml,
  formatDateTime,
  statusPillHtml,
  emptyStateHtml,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const headerHtml = () =>
  `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};">Status timeline</div>` +
  `</div>`;

// One timeline entry: a dot on a left rail, then the pill + meta + optional note.
// `isLast` drops the rail below the final dot so the line does not dangle.
const entryHtml = (r, isLast) => {
  const rail = isLast
    ? ""
    : `<div style="position:absolute;left:5px;top:14px;bottom:-${SPACING.LG}px;` +
      `width:2px;background:${COLORS.BORDER};"></div>`;

  const when = formatDateTime(r.changedOn);
  const meta =
    `<span style="color:${COLORS.TEXT_FAINT};font-size:${TYPOGRAPHY.SIZE_XS}px;">` +
    `${escapeHtml(when)}` +
    (r.actorLabel ? ` · ${escapeHtml(r.actorLabel)}` : "") +
    `</span>`;

  const note = r.note
    ? `<div style="margin-top:${SPACING.XS}px;color:${COLORS.TEXT_MUTED};` +
      `font-size:${TYPOGRAPHY.SIZE_SM}px;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(r.note)}</div>`
    : "";

  return (
    `<li style="position:relative;padding:0 0 ${SPACING.LG}px ${SPACING.XL}px;">` +
    rail +
    `<div style="position:absolute;left:0;top:3px;width:12px;height:12px;border-radius:50%;` +
    `background:${COLORS.PRIMARY};border:2px solid ${COLORS.SURFACE};box-shadow:0 0 0 1px ${COLORS.BORDER};"></div>` +
    `<div style="display:flex;align-items:center;gap:${SPACING.SM}px;flex-wrap:wrap;">` +
    `${statusPillHtml(r.toStatus)}${meta}</div>` +
    note +
    `</li>`
  );
};

export const renderWeb = (data) => {
  // No report loaded (Home / My-Reports screens) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.rows.length
    ? `<ul style="list-style:none;margin:0;padding:${SPACING.LG}px ${SPACING.XL}px;">` +
      data.rows
        .map((r, i) => entryHtml(r, i === data.rows.length - 1))
        .join("") +
      `</ul>`
    : emptyStateHtml("No status changes yet.");

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    headerHtml() +
    body +
    `</div>`
  );
};

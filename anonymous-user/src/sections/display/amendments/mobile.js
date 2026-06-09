// Amendments — MOBILE renderer (wireframes §4 amendments card): same data as web,
// restacked for narrow widths. A titled card header with a full-width "+ Add" intent
// button, then one stacked block per amendment (When, Note, then a generous-tap
// evidence link). APPEND-ONLY (D16, rule 25): no edit/delete affordance. Composes
// shared theme tokens (theme.js) and the escapeHtml / intentButtonHtml /
// emptyStateHtml / formatDateTime primitives (format.js) — every interpolated value is
// escaped at the boundary (NFR-2, rule 10). Evidence URLs are PRE-SIGNED in index.js
// before sendResponse; this renderer never sees an S3 key (rule 11/18). Pure presentation.

import {
  escapeHtml,
  intentButtonHtml,
  emptyStateHtml,
  formatDateTime,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const addButtonHtml = (data) =>
  intentButtonHtml(
    data.addIntent,
    "✚  Add amendment",
    { reportId: data.reportId },
    `display:block;width:100%;box-sizing:border-box;text-align:center;` +
      `padding:${SPACING.SM}px ${SPACING.MD}px;border-radius:${TYPOGRAPHY.RADIUS}px;` +
      `border:1px solid ${COLORS.PRIMARY_DARK};background:${COLORS.PRIMARY};` +
      `color:${COLORS.PRIMARY_CONTRAST};font-family:${TYPOGRAPHY.FONT_FAMILY};` +
      `font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};`
  );

const label = (text) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
  `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">${escapeHtml(text)}</div>`;

// Evidence block: a large-tap signed download link, a degraded plain name, or nothing.
const evidenceBlock = (evidence) => {
  if (!evidence) return "";
  const name = escapeHtml(evidence.fileName || "Evidence");
  if (evidence.url) {
    return (
      `<a href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer" ` +
      `style="display:block;margin-top:${SPACING.SM}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
      `background:${COLORS.SURFACE_ALT};border:1px solid ${COLORS.BORDER};border-radius:6px;` +
      `color:${COLORS.PRIMARY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
      `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-decoration:none;word-break:break-word;">` +
      `⬇ ${name}</a>`
    );
  }
  return (
    `<div style="margin-top:${SPACING.SM}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};word-break:break-word;">` +
    `${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span></div>`
  );
};

const amendmentBlock = (a) =>
  `<div style="padding:${SPACING.MD}px;border:1px solid ${COLORS.BORDER};` +
  `border-radius:${TYPOGRAPHY.RADIUS}px;margin-bottom:${SPACING.SM}px;background:${COLORS.SURFACE};">` +
  label("When") +
  `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};margin-top:2px;">` +
  `${escapeHtml(formatDateTime(a.amendedOn))}</div>` +
  `<div style="margin-top:${SPACING.SM}px;">` +
  label("Note") +
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;color:${COLORS.TEXT};margin-top:2px;` +
  `white-space:pre-wrap;word-break:break-word;">${escapeHtml(a.note || "—")}</div>` +
  `</div>` +
  evidenceBlock(a.evidence) +
  `</div>`;

export const renderMobile = (data) => {
  // No report loaded (Home / My-Reports screens) — emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.amendments.length
    ? data.amendments.map(amendmentBlock).join("")
    : emptyStateHtml(
        data.canAmend
          ? "No amendments yet. Use “Add amendment” to attach further information."
          : "No amendments."
      );

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.LG}px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">Amendments</div>` +
    // "+ Add amendment" only while amending is legal (non-terminal); withheld once closed.
    (data.canAmend ? addButtonHtml(data) : "") +
    `<div style="margin-top:${SPACING.MD}px;">${body}</div>` +
    `</div>`
  );
};

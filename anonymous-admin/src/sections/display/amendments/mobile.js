// Amendments - MOBILE renderer (wireframes §4 "Amendments [RO]", admin side): same data
// as web, restacked for narrow widths. A titled card, then one stacked block per
// amendment (when, then the free-text note, then the optional evidence link), newest
// first. NO +Add / edit / delete control (admin is read-only - the reporter appends,
// U-F13; rule 30). Composes the shared escapeHtml / formatDateTime / emptyStateHtml
// primitives (format.js) with theme tokens (theme.js) - every interpolated value is
// escaped at the boundary (NFR-2, rule 10). Pure presentation: index.js owns the data,
// the evidence overlay, and the sort.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1).
//
// EVIDENCE: signed URL → a download link; key-but-unsigned → filename "(link
// unavailable)"; no key → omitted. The raw S3 key is NEVER embedded.

import {
  escapeHtml,
  formatDateTime,
  emptyStateHtml,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const evidenceLine = (evidence) => {
  if (!evidence) return "";
  const name = escapeHtml(evidence.fileName || "Attachment");
  const inner = evidence.url
    ? `<a href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:${COLORS.PRIMARY};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-decoration:none;">` +
      `⬇ ${name}</a>`
    : `${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span>`;
  return (
    `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_SM}px;">` +
    inner +
    `</div>`
  );
};

const entryBlock = (r) => {
  const when = formatDateTime(r.amendedOn);
  const meta =
    `<div style="color:${COLORS.TEXT_FAINT};font-size:${TYPOGRAPHY.SIZE_XS}px;">` +
    `${escapeHtml(when)}</div>`;

  const note = r.note
    ? `<div style="margin-top:${SPACING.XS}px;color:${COLORS.TEXT};` +
      `font-size:${TYPOGRAPHY.SIZE_MD}px;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(r.note)}</div>`
    : "";

  return (
    `<div style="padding:${SPACING.MD}px;border:1px solid ${COLORS.BORDER};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;margin-bottom:${SPACING.SM}px;background:${COLORS.SURFACE};">` +
    meta +
    note +
    evidenceLine(r.evidence) +
    `</div>`
  );
};

export const renderMobile = (data) => {
  // No report open (Dashboard / Queue screens, or not found) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.rows.length
    ? data.rows.map(entryBlock).join("")
    : emptyStateHtml("No amendments yet.");

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;padding:${SPACING.LG}px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">Amendments</div>` +
    body +
    `</div>`
  );
};

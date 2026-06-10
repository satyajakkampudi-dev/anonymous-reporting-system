// Amendments - WEB renderer (wireframes §4 "Amendments [RO]", admin side): a titled card
// then a read-only HTML table - one row per amendment (When · Note · Evidence), newest
// first. NO +Add / edit / delete control (admin is read-only - the reporter appends,
// U-F13; rule 30). Composes the shared escapeHtml / formatDateTime / emptyStateHtml
// primitives (format.js) with theme tokens (theme.js) - every interpolated value is
// escaped at the boundary (NFR-2, rule 10). Pure presentation: index.js owns the data,
// the evidence overlay, and the sort.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1): an amendment row
// carries only its timestamp, free-text note, and an optional evidence descriptor.
//
// EVIDENCE cell: signed URL → a download link; key-but-unsigned → filename "(link
// unavailable)"; no key → "-". The raw S3 key is NEVER embedded (index.js overlays the
// pre-signed URL by key).

import {
  escapeHtml,
  formatDateTime,
  emptyStateHtml,
} from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const headerHtml = () =>
  `<div style="padding:${SPACING.LG}px ${SPACING.XL}px;border-bottom:1px solid ${COLORS.BORDER};">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};">Amendments</div>` +
  `</div>`;

const thStyle =
  `text-align:left;padding:${SPACING.SM}px ${SPACING.MD}px;` +
  `font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;letter-spacing:0.04em;` +
  `color:${COLORS.TEXT_FAINT};border-bottom:1px solid ${COLORS.BORDER};white-space:nowrap;`;

const tdStyle =
  `padding:${SPACING.MD}px;font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
  `border-bottom:1px solid ${COLORS.BORDER};vertical-align:top;`;

// Evidence cell content. Signed URL → download link; unsigned key → name "(link
// unavailable)"; no key → "-". Never embeds a raw S3 key.
const evidenceCell = (evidence) => {
  if (!evidence) return `<span style="color:${COLORS.TEXT_FAINT};">-</span>`;
  const name = escapeHtml(evidence.fileName || "Attachment");
  if (evidence.url) {
    return (
      `<a href="${escapeHtml(evidence.url)}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:${COLORS.PRIMARY};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-decoration:none;">` +
      `⬇ ${name}</a>`
    );
  }
  return `${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span>`;
};

const rowHtml = (r) => {
  const when = escapeHtml(formatDateTime(r.amendedOn));
  const note = r.note
    ? `<span style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(r.note)}</span>`
    : `<span style="color:${COLORS.TEXT_FAINT};">-</span>`;
  return (
    `<tr>` +
    `<td style="${tdStyle}white-space:nowrap;color:${COLORS.TEXT_MUTED};">${when}</td>` +
    `<td style="${tdStyle}">${note}</td>` +
    `<td style="${tdStyle}white-space:nowrap;">${evidenceCell(r.evidence)}</td>` +
    `</tr>`
  );
};

export const renderWeb = (data) => {
  // No report open (Dashboard / Queue screens, or not found) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.rows.length
    ? `<table style="width:100%;border-collapse:collapse;">` +
      `<thead><tr>` +
      `<th style="${thStyle}">When</th>` +
      `<th style="${thStyle}">Note</th>` +
      `<th style="${thStyle}">Evidence</th>` +
      `</tr></thead>` +
      `<tbody>${data.rows.map(rowHtml).join("")}</tbody>` +
      `</table>`
    : emptyStateHtml("No amendments yet.");

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;overflow:hidden;">` +
    headerHtml() +
    body +
    `</div>`
  );
};

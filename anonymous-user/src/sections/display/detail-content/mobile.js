// Report detail content - MOBILE renderer ("What you reported", wireframes §4
// content card). Same data as web, restacked for narrow widths: the meta facts
// stack one-per-line, the description and evidence follow full-width, and tap
// targets are generous for touch. Composes shared theme tokens (theme.js) and the
// escapeHtml primitive (format.js) - every interpolated value is escaped at the
// boundary (NFR-2, rule 10). Evidence URLs are PRE-SIGNED in index.js before
// sendResponse; this renderer never sees an S3 key (rule 11/18). Pure presentation.

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const sectionTitle = (text) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">${escapeHtml(text)}</div>`;

// One stacked "Label / value" line.
const metaLine = (label, value) =>
  `<div style="margin-bottom:${SPACING.MD}px;">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
  `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">${escapeHtml(label)}</div>` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;color:${COLORS.TEXT};` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};margin-top:2px;word-break:break-word;">` +
  `${escapeHtml(value || "-")}</div>` +
  `</div>`;

// Evidence list: signed download links (large tap targets), degraded entries, or
// an empty-state line.
const evidenceBlock = (evidence) => {
  const heading =
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
    `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};margin-bottom:${SPACING.SM}px;">Evidence</div>`;

  if (!evidence || !evidence.length) {
    return (
      heading +
      `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">No evidence attached.</div>`
    );
  }

  const items = evidence
    .map((file, i) => {
      const name = escapeHtml(file.fileName || `Evidence file ${i + 1}`);
      if (file.url) {
        return (
          `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer" ` +
          `style="display:block;padding:${SPACING.SM}px ${SPACING.MD}px;margin-bottom:${SPACING.SM}px;` +
          `background:${COLORS.SURFACE_ALT};border:1px solid ${COLORS.BORDER};border-radius:6px;` +
          `color:${COLORS.PRIMARY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
          `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-decoration:none;word-break:break-word;">` +
          `⬇ ${name}</a>`
        );
      }
      return (
        `<div style="padding:${SPACING.SM}px ${SPACING.MD}px;margin-bottom:${SPACING.SM}px;` +
        `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};word-break:break-word;">` +
        `${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span></div>`
      );
    })
    .join("");

  return heading + items;
};

export const renderMobile = (data) => {
  // No report loaded (Home / My-Reports screens) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const description = data.description
    ? `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
      `line-height:1.55;white-space:pre-wrap;word-break:break-word;">${escapeHtml(data.description)}</div>`
    : `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">-</div>`;

  const notes = data.evidenceNotes
    ? `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
      `color:${COLORS.TEXT_MUTED};font-style:italic;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(data.evidenceNotes)}</div>`
    : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("What you reported") +
    // Meta facts, stacked.
    metaLine("Ship", data.ship) +
    metaLine("Location", data.location) +
    metaLine("Incident date", data.incidentDate) +
    metaLine("Accused party", data.accusedParty) +
    // Description.
    `<div style="margin-top:${SPACING.SM}px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
    `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};margin-bottom:${SPACING.XS}px;">Description</div>` +
    description +
    `</div>` +
    // Evidence.
    `<div style="margin-top:${SPACING.LG}px;border-top:1px solid ${COLORS.BORDER};padding-top:${SPACING.MD}px;">` +
    evidenceBlock(data.evidence) +
    notes +
    `</div>` +
    `</div>`
  );
};

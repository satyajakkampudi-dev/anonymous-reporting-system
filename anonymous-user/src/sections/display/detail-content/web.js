// Report detail content - WEB renderer ("What you reported", wireframes §4 content
// card). A titled card: a two-column meta grid (Ship · Location · Incident date ·
// Accused party), the full description block, then an evidence list of signed-URL
// download links. Composes shared theme tokens (theme.js) and the escapeHtml
// primitive (format.js) - every interpolated value is escaped at the boundary
// (NFR-2, rule 10). Evidence URLs are PRE-SIGNED in index.js before sendResponse;
// this renderer never sees an S3 key (rule 11/18). Pure presentation.

import { escapeHtml } from "../../../../../lib/utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../../lib/utils/theme";

const sectionTitle = (text) =>
  `<div style="font-size:${TYPOGRAPHY.SIZE_MD}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
  `color:${COLORS.TEXT};margin-bottom:${SPACING.MD}px;">${escapeHtml(text)}</div>`;

// One "Label / value" cell in the meta grid.
const metaCell = (label, value) =>
  `<div style="min-width:0;">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
  `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">${escapeHtml(label)}</div>` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};margin-top:2px;word-break:break-word;">` +
  `${escapeHtml(value || "-")}</div>` +
  `</div>`;

// Evidence list: signed download links, or a degraded plain entry when a link
// could not be signed, or an empty-state line when nothing is attached.
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
          `<li style="margin-bottom:${SPACING.XS}px;">` +
          `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer" ` +
          `style="color:${COLORS.PRIMARY};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
          `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};text-decoration:none;">` +
          `⬇ ${name}</a></li>`
        );
      }
      // Degraded: signing failed / no bucket - show the name, never a broken link.
      return (
        `<li style="margin-bottom:${SPACING.XS}px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
        `color:${COLORS.TEXT_MUTED};">${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span></li>`
      );
    })
    .join("");

  return (
    heading + `<ul style="list-style:none;margin:0;padding:0;">${items}</ul>`
  );
};

export const renderWeb = (data) => {
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
    `padding:${SPACING.LG}px ${SPACING.XL}px;">` +
    sectionTitle("What you reported") +
    // Meta grid - two columns on web.
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.MD}px ${SPACING.LG}px;">` +
    metaCell("Ship", data.ship) +
    metaCell("Location", data.location) +
    metaCell("Incident date", data.incidentDate) +
    metaCell("Accused party", data.accusedParty) +
    `</div>` +
    // Description.
    `<div style="margin-top:${SPACING.LG}px;">` +
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

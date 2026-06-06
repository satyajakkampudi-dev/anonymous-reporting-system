// Manage detail content — MOBILE renderer (wireframes §4 content card, admin side): same data
// as web, restacked for narrow widths — the meta facts stack one-per-line, the against-admin
// banner, description and evidence follow full-width, and evidence links are generous tap
// targets. Composes shared theme tokens (theme.js) and the escapeHtml / toneColors primitives —
// every interpolated value is escaped at the primitive boundary (NFR-2, rule 10). Evidence URLs
// are PRE-SIGNED by A-F7 before sendResponse; this renderer never sees an S3 key (rule 11/18).
// Pure presentation: index.js owns the data.
//
// NO reporter identity is present in the data (rule 30, ER-A2/A3, C1).

import { escapeHtml } from "../../../../../lib/utils/format";
import {
  COLORS,
  SPACING,
  TYPOGRAPHY,
  toneColors,
} from "../../../../../lib/utils/theme";
import { TONE } from "../../../../../lib/ticket-status";

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
  `${escapeHtml(value || "—")}</div>` +
  `</div>`;

// Against-admin recusal banner — shown ONLY when the report concerns a compliance-team
// member (D9). Amber WARNING tone.
const againstAdminBanner = (against) => {
  if (!against) return "";
  const c = toneColors(TONE.WARNING);
  return (
    `<div style="margin-bottom:${SPACING.MD}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `background:${c.bg};border:1px solid ${c.border};border-radius:6px;` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${c.fg};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
    `⚠ This report concerns a member of the compliance team.</div>`
  );
};

// Evidence list: signed download links (large tap targets), degraded entries, or an
// empty-state line. Followed by the D13 'at your own risk' note when files exist.
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

  // D13 — files are reporter-supplied; warn the officer.
  const riskNote =
    `<div style="margin-top:${SPACING.XS}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
    `color:${COLORS.WARNING};">Evidence files are uploaded by the reporter — download at your own risk.</div>`;

  return heading + items + riskNote;
};

export const renderMobile = (data) => {
  // No report open (Dashboard / Queue screens, or not found) — emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const description = data.description
    ? `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
      `line-height:1.55;white-space:pre-wrap;word-break:break-word;">${escapeHtml(data.description)}</div>`
    : `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">—</div>`;

  const notes = data.evidenceNotes
    ? `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
      `color:${COLORS.TEXT_MUTED};font-style:italic;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(data.evidenceNotes)}</div>`
    : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px;">` +
    sectionTitle("Report content") +
    againstAdminBanner(data.againstAdmin) +
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

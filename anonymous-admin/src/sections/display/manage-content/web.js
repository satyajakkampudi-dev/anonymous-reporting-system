// Manage detail content - WEB renderer (wireframes §4 content card, admin side): a titled
// "Report content" card with a two-column meta grid (Ship · Location · Incident date · Accused
// party), an optional against-admin recusal banner, the full description block, then the evidence
// list of signed-URL download links with the D13 'download at your own risk' note, and any
// evidence notes. Composes shared theme tokens (theme.js) and the escapeHtml / toneColors
// primitives (format.js / theme.js) - every interpolated value is escaped at the primitive
// boundary (NFR-2, rule 10). Evidence URLs are PRE-SIGNED by A-F7 before sendResponse; this
// renderer never sees an S3 key (rule 11/18). Pure presentation: index.js owns the data.
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

// One "Label / value" cell in the meta grid.
const metaCell = (label, value) =>
  `<div style="min-width:0;">` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
  `letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">${escapeHtml(label)}</div>` +
  `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
  `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};margin-top:2px;word-break:break-word;">` +
  `${escapeHtml(value || "-")}</div>` +
  `</div>`;

// Against-admin recusal banner - shown ONLY when the report concerns a compliance-team
// member (D9). Amber WARNING tone so the reviewing officer registers the recusal context.
const againstAdminBanner = (against) => {
  if (!against) return "";
  const c = toneColors(TONE.WARNING);
  return (
    `<div style="margin-top:${SPACING.MD}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `background:${c.bg};border:1px solid ${c.border};border-radius:6px;` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;color:${c.fg};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
    `⚠ This report concerns a member of the compliance team.</div>`
  );
};

// Evidence list: signed download links, a degraded plain entry when a link could not be
// signed, or an empty-state line. Followed by the D13 'at your own risk' note when files exist.
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
      // Degraded: signing failed / not yet signed / no bucket - name only, never a broken link.
      return (
        `<li style="margin-bottom:${SPACING.XS}px;font-size:${TYPOGRAPHY.SIZE_SM}px;` +
        `color:${COLORS.TEXT_MUTED};">${name} <span style="color:${COLORS.TEXT_FAINT};">(link unavailable)</span></li>`
      );
    })
    .join("");

  // D13 - files may be opened by an attacker-controlled author; warn the officer.
  const riskNote =
    `<div style="margin-top:${SPACING.SM}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
    `color:${COLORS.WARNING};">Evidence files are uploaded by the reporter - download at your own risk.</div>`;

  return (
    heading +
    `<ul style="list-style:none;margin:0;padding:0;">${items}</ul>` +
    riskNote
  );
};

// Reporter contact block - shown ONLY when the reporter chose to identify themselves
// (open reporting, MP-FIX-CONTACT-OPEN-REPORTING). INFO tone so the officer registers that
// this report is NOT anonymous. Both values are reporter free-text → escaped (rule 10/NFR-2).
const contactBlock = (data) => {
  if (!data.hasContact) return "";
  const c = toneColors(TONE.INFO);
  const method = data.contactMethod
    ? `${escapeHtml(data.contactMethod)}: `
    : "";
  return (
    `<div style="margin-top:${SPACING.LG}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `background:${c.bg};border:1px solid ${c.border};border-radius:6px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;letter-spacing:0.04em;` +
    `color:${c.fg};margin-bottom:2px;">Reporter contact (shared voluntarily)</div>` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
    `font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};word-break:break-word;">${method}${escapeHtml(data.contactValue)}</div>` +
    `</div>`
  );
};

export const renderWeb = (data) => {
  // No report open (Dashboard / Queue screens, or not found) - emit nothing (empty-safe).
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
    sectionTitle("Report content") +
    // Meta grid - two columns on web.
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.MD}px ${SPACING.LG}px;">` +
    metaCell("Ship", data.ship) +
    metaCell("Location", data.location) +
    metaCell("Incident date", data.incidentDate) +
    metaCell("Accused party", data.accusedParty) +
    `</div>` +
    againstAdminBanner(data.againstAdmin) +
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
    // Reporter contact (open reporting) - only when the reporter chose to identify themselves.
    contactBlock(data) +
    `</div>`
  );
};

// Manage detail resolution - WEB renderer (wireframes §4 "Resolution" card, admin side):
// a titled card holding the admin-written resolution text and the "Resolved on" date, with
// an empty-state body ("none yet") until a resolution is recorded, plus an optional
// read-only block surfacing the reporter's reason for rejecting an earlier resolution
// (ER-B5/D10). Pure presentation: composes shared theme tokens (theme.js) and the
// escapeHtml / toneColors primitives (format.js / theme.js) - every interpolated value is
// escaped at the primitive boundary (NFR-2, rule 10). No buttons here - Resolve / Close as
// rejected live in the manage-actions card. index.js owns the data.
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

// Read-only "reporter rejected an earlier resolution" block - shown ONLY when the reporter
// supplied a reject reason (ER-B5/D10). WARNING tone so the officer registers that this
// report was reopened and why. The officer cannot edit it (the reporter wrote it).
const rejectReasonBlock = (reason) => {
  if (!reason) return "";
  const c = toneColors(TONE.WARNING);
  return (
    `<div style="margin-top:${SPACING.LG}px;padding:${SPACING.SM}px ${SPACING.MD}px;` +
    `background:${c.bg};border:1px solid ${c.border};border-radius:6px;">` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_XS}px;text-transform:uppercase;` +
    `letter-spacing:0.04em;color:${c.fg};font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
    `margin-bottom:${SPACING.XS}px;">Reporter rejected an earlier resolution</div>` +
    `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
    `line-height:1.55;white-space:pre-wrap;word-break:break-word;">${escapeHtml(reason)}</div>` +
    `</div>`
  );
};

export const renderWeb = (data) => {
  // No report open (Dashboard / Queue screens, or not found) - emit nothing (empty-safe).
  if (!data.hasReport) return "";

  const body = data.resolution
    ? `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT};` +
      `line-height:1.55;white-space:pre-wrap;word-break:break-word;">` +
      `${escapeHtml(data.resolution)}</div>`
    : `<div style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};` +
      `font-style:italic;">No resolution recorded yet.</div>`;

  const resolvedOn =
    data.resolution && data.resolvedOn
      ? `<div style="margin-top:${SPACING.MD}px;font-size:${TYPOGRAPHY.SIZE_XS}px;` +
        `text-transform:uppercase;letter-spacing:0.04em;color:${COLORS.TEXT_FAINT};">` +
        `Resolved on <span style="color:${COLORS.TEXT_MUTED};">${escapeHtml(data.resolvedOn)}</span></div>`
      : "";

  return (
    `<div style="font-family:${TYPOGRAPHY.FONT_FAMILY};background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-radius:${TYPOGRAPHY.RADIUS}px;` +
    `padding:${SPACING.LG}px ${SPACING.XL}px;">` +
    sectionTitle("Resolution") +
    body +
    resolvedOn +
    rejectReasonBlock(data.rejectReason) +
    `</div>`
  );
};

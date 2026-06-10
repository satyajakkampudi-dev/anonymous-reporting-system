// Shared notification-email shell (framework-mapping rule 33). ONE renderEmail used by
// both the reporter (U-F14) and admin (A-F15) email bodies so layout + escaping live in
// one place and never drift between the two apps.
//
// EMAIL HTML IS NOT WEB HTML:
//   - Table-based layout + INLINE styles only. No flexbox/grid (Outlook ignores them),
//     no <style>/<head> blocks (Gmail strips them). ~600px centred container.
//   - Reuses lib/utils/theme COLORS so email matches the in-app cards.
//
// ANONYMITY (rule 16/30, this is a whistleblowing tool):
//   - NO tracking pixel, NO open/click tracking, NO remote or S3 / signed-URL images.
//     The brand mark is a TEXT wordmark, never a hosted beacon (a per-open pixel in an
//     anonymous reporter's inbox would phone home - an anonymity breach).
//   - Identity-free: renderEmail escapes `title` and each `rows` { label, value };
//     `introHtml` / `footerHtml` are caller-supplied HTML (caller escapes any dynamic
//     part - e.g. reportId/status - before passing them in).

import { escapeHtml } from "./utils/format";
import { COLORS, SPACING, TYPOGRAPHY } from "./utils/theme";

const WORDMARK = "Anonymous Reporting";

// Render the identity-free detail rows (admin email) as an inline-styled table. Both the
// label and the value are escaped here (the single escaping chokepoint for rows).
const renderRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return "";
  const body = rows
    .map(
      ({ label, value }) =>
        `<tr>` +
        `<td style="padding:${SPACING.XS}px ${SPACING.MD}px ${SPACING.XS}px 0;` +
        `color:${COLORS.TEXT_MUTED};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
        `vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:${SPACING.XS}px 0;color:${COLORS.TEXT};` +
        `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};">` +
        `${escapeHtml(value == null ? "" : value)}</td>` +
        `</tr>`
    )
    .join("");
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;margin:${SPACING.MD}px 0 0 0;">${body}</table>`
  );
};

// renderEmail({ title, introHtml, rows, footerHtml }) -> a complete, email-client-safe
// HTML string. introHtml / footerHtml are HTML fragments supplied by the caller (already
// escaped where dynamic); title + rows are escaped here.
export const renderEmail = ({
  title,
  introHtml = "",
  rows = [],
  footerHtml = "",
}) => {
  const font = TYPOGRAPHY.FONT_FAMILY;
  return (
    // Full-width wrapper table - the email background.
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;background:${COLORS.BG};margin:0;padding:0;">` +
    `<tr><td align="center" style="padding:${SPACING.XL}px ${SPACING.MD}px;">` +
    // Centred ~600px card.
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;width:100%;max-width:600px;background:${COLORS.SURFACE};` +
    `border:1px solid ${COLORS.BORDER};border-top:4px solid ${COLORS.PRIMARY};` +
    `border-radius:${TYPOGRAPHY.RADIUS}px;font-family:${font};">` +
    // Text wordmark header (NO image).
    `<tr><td style="padding:${SPACING.LG}px ${SPACING.XL}px 0 ${SPACING.XL}px;` +
    `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `letter-spacing:0.4px;color:${COLORS.PRIMARY};text-transform:uppercase;">` +
    `${escapeHtml(WORDMARK)}</td></tr>` +
    // Title.
    `<tr><td style="padding:${SPACING.SM}px ${SPACING.XL}px 0 ${SPACING.XL}px;` +
    `font-size:${TYPOGRAPHY.SIZE_LG}px;font-weight:${TYPOGRAPHY.WEIGHT_BOLD};` +
    `color:${COLORS.TEXT};">${escapeHtml(title)}</td></tr>` +
    // Body: intro + optional detail rows.
    `<tr><td style="padding:${SPACING.MD}px ${SPACING.XL}px ${SPACING.LG}px ${SPACING.XL}px;` +
    `font-size:${TYPOGRAPHY.SIZE_MD}px;line-height:1.5;color:${COLORS.TEXT};">` +
    `${introHtml}${renderRows(rows)}</td></tr>` +
    // Footer reassurance (muted), separated by a hairline.
    (footerHtml
      ? `<tr><td style="padding:${SPACING.MD}px ${SPACING.XL}px ${SPACING.LG}px ${SPACING.XL}px;` +
        `border-top:1px solid ${COLORS.BORDER};font-size:${TYPOGRAPHY.SIZE_SM}px;` +
        `line-height:1.5;color:${COLORS.TEXT_MUTED};">${footerHtml}</td></tr>`
      : "") +
    `</table>` +
    `</td></tr>` +
    `</table>`
  );
};

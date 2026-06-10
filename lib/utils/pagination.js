// Shared list pagination controls (framework-mapping rule 36). One prev/next control
// reused by every custom-HTML list (admin queue, user My Reports, admin alerts) so the
// markup + invoke_intent wire format never drift. Mirrors the sailors-cart renderPagination
// precedent. Pure presentation - composes intentButtonHtml (escaped payload) + theme tokens.

import { intentButtonHtml } from "./format";
import { COLORS, SPACING, TYPOGRAPHY } from "./theme";

const BTN_BASE =
  "display:inline-block;padding:6px 14px;border-radius:6px;" +
  `font-size:${TYPOGRAPHY.SIZE_SM}px;font-weight:${TYPOGRAPHY.WEIGHT_MEDIUM};` +
  `border:1px solid ${COLORS.BORDER};background:${COLORS.SURFACE};color:${COLORS.PRIMARY};`;

// A disabled control must not fire its intent - pointer-events:none swallows the click.
const DISABLED = "opacity:0.4;pointer-events:none;cursor:not-allowed;";

// renderPaginationControls({ page, hasMore, intentId, payloadExtra }) - `page` is 0-indexed.
// prev fires intentId with { page: page-1, ...payloadExtra }; next with { page: page+1, ... }
// (so the active filter is carried across pages). prev disabled on page 0; next disabled when
// !hasMore. Returns "" for a single page (page 0 + no more) so single-page lists stay clean.
export const renderPaginationControls = ({
  page = 0,
  hasMore = false,
  intentId,
  payloadExtra = {},
} = {}) => {
  const cur = Number(page) || 0;
  const prevDisabled = cur <= 0;
  const nextDisabled = !hasMore;
  if (prevDisabled && nextDisabled) return ""; // single page - no controls

  const prevBtn = intentButtonHtml(
    intentId,
    "‹ Previous",
    { page: Math.max(0, cur - 1), ...payloadExtra },
    BTN_BASE + (prevDisabled ? DISABLED : "")
  );
  const nextBtn = intentButtonHtml(
    intentId,
    "Next ›",
    { page: cur + 1, ...payloadExtra },
    BTN_BASE + (nextDisabled ? DISABLED : "")
  );

  return (
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `gap:${SPACING.MD}px;padding:${SPACING.MD}px ${SPACING.LG}px;` +
    `border-top:1px solid ${COLORS.BORDER};margin-top:${SPACING.SM}px;">` +
    `<span style="font-size:${TYPOGRAPHY.SIZE_SM}px;color:${COLORS.TEXT_MUTED};">Page ${
      cur + 1
    }</span>` +
    `<span style="display:inline-flex;gap:${SPACING.SM}px;">${prevBtn}${nextBtn}</span>` +
    `</div>`
  );
};

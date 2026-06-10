// Display section: Report detail resolution (schema id: detailResolution, row 5).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-detailresolution fills the card content with the admin-written resolution
// text + "Resolved on" date, shown ONLY when present (empty-state otherwise).
// Display-only (no buttons - Accept/Reject live in detailActions) → readOnly not
// required.
//
// Single SYNC render path: detailResolutionSection.onResponse fires on every
// reportDisplayDoc.sendResponse(). It reads the already-loaded reportDoc scalar
// fields and dispatches via renderForPlatform. No async work, no S3 - so unlike
// detail-content there is no prepare() helper; the handler stays synchronous
// (section.onResponse is NOT awaited - render-handler rule). Empty-safe: on
// Home / My-Reports no report is loaded, and an OPEN/UNDER_REVIEW report has no
// resolution yet → hasResolution:false → renders nothing.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import { resolutionField, resolvedOnField } from "../../report-details";
import { formatDate, formatIsoDate } from "../../../../../lib/utils/format";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const detailResolutionSection = new Section("detailResolutionSection", {
  doc: reportDisplayDoc,
  grid: { row: 5, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailResolutionCardsSet = new CardsSet(
  "detailResolutionCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

detailResolutionSection.cardsSet = detailResolutionCardsSet;

export const detailResolutionPlaceholderCard = new Card(
  "detailResolutionPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailResolutionCardsSet,
    content: '<div class="placeholder">[Report detail resolution]</div>',
    state,
  }
);

// resolvedOn is a NUMBER_FIELD (epoch-ms set by the admin RESOLVE transition), but
// format defensively for either epoch-ms or an ISO string via the shared
// primitives (compose, do not reinvent). Empty → "".
const formatResolvedOn = (value) => {
  if (value === null || value === "" || typeof value === "undefined") return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    return formatDate(Number(value));
  }
  return formatIsoDate(value);
};

// Build the card content on every render (empty-safe - no resolution → no card).
detailResolutionSection.onResponse = () => {
  const resolution = reportDoc.f[resolutionField.id]?.value || "";

  const data = {
    // Show the card ONLY when an admin has written a resolution (schema:
    // "shown only when present"). No report loaded / not yet resolved → "".
    hasResolution: !!resolution.trim(),
    resolution,
    resolvedOn: formatResolvedOn(reportDoc.f[resolvedOnField.id]?.value),
  };

  detailResolutionPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

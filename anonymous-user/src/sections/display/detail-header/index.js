// Display section: Report detail header (schema id: detailHeader, row 2).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-detailheader fills the card content. Display-only (no buttons) → readOnly
// not required (the card surface hosts no inline intent clicks).
//
// onResponse runs as a Context-A render handler during reportDisplayDoc.sendResponse()
// — the same invocation in which the openReportDetail nav frame (MP-FIX-NAV) called
// reportDoc.loadDocument({ reportId }), so reportDoc.f[...] is hydrated for the opened
// report. It is ALSO empty-safe: on the Home / My-Reports screens no report is loaded,
// reportId reads empty, and the renderer is handed hasReport:false (renders nothing).
// onResponse is SYNCHRONOUS — the framework does NOT await it (CLAUDE.md "Render
// handlers are NOT awaited"); nothing async here (the header reads already-loaded
// scalar fields only — no signed URLs, that is detail-content's job).
//
// Header echoes the report's identity + triage at a glance (schema display_elements /
// wireframes §4 header card): tracking id, status pill, severity, category, urgency,
// submitted date. Tokens map to British-English labels via the shared lib/constants
// label maps, so the user app never re-encodes enum display text.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import {
  reportIdField,
  statusField,
  severityField,
  categoryField,
  urgencyField,
  createdOnField,
} from "../../report-details";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  SEVERITY_LABELS,
} from "../../../../../lib/constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const detailHeaderSection = new Section("detailHeaderSection", {
  doc: reportDisplayDoc,
  grid: { row: 2, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailHeaderCardsSet = new CardsSet("detailHeaderCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailHeaderSection.cardsSet = detailHeaderCardsSet;

export const detailHeaderPlaceholderCard = new Card(
  "detailHeaderPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailHeaderCardsSet,
    content: '<div class="placeholder">[Report detail header]</div>',
    state,
  }
);

// Build the card content on every render (empty-safe — no report loaded → no card).
detailHeaderSection.onResponse = () => {
  // reportDoc is the loaded single-report Data Doc — read scalars via f[field.id].value.
  const reportId = reportDoc.f[reportIdField.id]?.value || "";
  const status = reportDoc.f[statusField.id]?.value || "";
  const severityToken = reportDoc.f[severityField.id]?.value || "";
  const categoryToken = reportDoc.f[categoryField.id]?.value || "";
  const urgencyToken = reportDoc.f[urgencyField.id]?.value || "";

  const data = {
    // No report loaded (Home / My-Reports screens) → the renderer emits nothing.
    hasReport: !!reportId,
    reportId,
    status, // STATUS token → statusPillHtml resolves the label + tone
    severity: severityToken, // SEVERITY token → severityColors() resolves the tone
    severityLabel: SEVERITY_LABELS[severityToken] || severityToken || "—",
    category: CATEGORY_LABELS[categoryToken] || categoryToken || "—",
    urgency: URGENCY_LABELS[urgencyToken] || urgencyToken || "—",
    createdOn: reportDoc.f[createdOnField.id]?.value || null,
  };

  detailHeaderPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

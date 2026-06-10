// Display section: Report detail content — "What you reported" (schema id:
// detailContent, row 3). Shell (Section + CardsSet + placeholder Card + grid) was
// built in DISPLAY-SHELL; U-D-detailcontent fills the card content. Display-only
// (no buttons) → readOnly not required.
//
// TWO render paths, because evidence needs S3 signing and onResponse is NOT awaited:
//
//   1. prepareDetailContentEvidence() — EXPORTED async helper. The nav frame
//      (openReportDetail) MUST `await` it BEFORE reportDisplayDoc.sendResponse().
//      It drills each evidenceFile envelope (.value?.value = S3 key — NEVER the
//      raw key in HTML, rule 11/18), signs it via state.frontmlib.getS3SignedUrl
//      against the CONTENT bucket at `${currentUserDomain}/${key}` (domain-scoped
//      FILE_FIELD), and caches { fileName, url } in a
//      module-local for the synchronous render. Signing here (cloud-only AWS creds)
//      is the ONLY correct place — it cannot live in onResponse (the framework
//      calls section.onResponse synchronously and discards an async return; S3 guide
//      "section.onResponse is NOT awaited").
//
//   2. detailContentSection.onResponse — SYNC render handler. Fires on every
//      reportDisplayDoc.sendResponse(). Reads the already-loaded scalar fields plus
//      the pre-signed evidence cache and dispatches via renderForPlatform. Empty-safe:
//      on Home / My-Reports no report is loaded → hasReport:false → renders nothing.
//
// The cache is reset at the top of every prepare() call so a warm Lambda container
// can never leak a previous report's signed links into the next report.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import {
  reportIdField,
  shipNameField,
  locationField,
  incidentDateField,
  descriptionField,
  accusedPartyField,
} from "../../report-details";
import {
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
  evidenceNotesField,
} from "../../evidence";
import {
  LOCATION_LABELS,
  STATIC_DATA_KEYS,
  SIGNED_URL_EXPIRY_SECONDS,
} from "../../../../../lib/constants";
import { formatDate, formatIsoDate } from "../../../../../lib/utils/format";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const detailContentSection = new Section("detailContentSection", {
  doc: reportDisplayDoc,
  grid: { row: 3, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailContentCardsSet = new CardsSet("detailContentCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailContentSection.cardsSet = detailContentCardsSet;

export const detailContentPlaceholderCard = new Card(
  "detailContentPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailContentCardsSet,
    content: '<div class="placeholder">[Report detail content]</div>',
    state,
  }
);

// The five FILE_FIELDs in display order.
const EVIDENCE_FIELDS = [
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

// Module-local cache of pre-signed evidence links for the current detail render.
// Set by prepareDetailContentEvidence() (in the frame, before sendResponse) and
// read synchronously by onResponse. Reset on every prepare() so warm containers
// never leak a previous report's links.
let signedEvidence = [];

// DATE/NUMBER fields store either epoch-ms or an ISO string depending on the
// picker; format both via the shared primitives (compose, do not reinvent).
const formatIncidentDate = (value) => {
  if (value === null || value === "" || typeof value === "undefined") return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    return formatDate(Number(value));
  }
  return formatIsoDate(value);
};

// Signs every attached evidence file for the loaded report. MUST be awaited in the
// frame BEFORE reportDisplayDoc.sendResponse(). Empty-safe: no report / no files →
// cache becomes []. Best-effort per file: a signing failure drops that one link
// rather than aborting the whole render (poor maritime link / transient S3 error).
export const prepareDetailContentEvidence = async () => {
  signedEvidence = [];

  const reportId = reportDoc.f[reportIdField.id]?.value || "";
  if (!reportId) return; // no report loaded (Home / My-Reports) — nothing to sign.

  // Collect the S3 keys from the media-field envelopes ( .value?.value ).
  const attached = [];
  for (const field of EVIDENCE_FIELDS) {
    const envelope = reportDoc.f[field.id]?.value;
    const key = envelope?.value;
    if (key) {
      attached.push({
        key,
        fileName: envelope?.fileName || "",
        // The S3 path PREFIX is the resolved scope identifier the file was stored
        // under (fileScopeValue): the DOMAIN NAME for a domain-scoped upload (our
        // evidence is fileScope:"domain"), NOT the literal "domain". Signing at
        // `${conversationId}/${key}` 404s because the object lives at
        // `${domain}/${key}` (mirrors healthMarinerCommonLib/crewApi.js).
        scopeValue: envelope?.fileScopeValue || null,
      });
    }
  }
  if (!attached.length) return;

  // DOMAIN-scoped evidence (fileScope:"domain") lands in the CONTENT bucket at
  // `${currentUserDomain}/${key}` — NOT conversationsBucket (that's IMAGE_FIELD /
  // conversation-scoped media). Sign against the content bucket (healthMariner pattern).
  const bucket = await state.getStaticData(STATIC_DATA_KEYS.CONTENT_BUCKET);
  if (!bucket) {
    D.log({
      message:
        "detailContent: content bucket not configured (cannot sign evidence)",
      data: { reportId, attachedCount: attached.length },
    });
    signedEvidence = attached.map((a) => ({ fileName: a.fileName, url: "" }));
    return;
  }

  for (const item of attached) {
    try {
      // DOMAIN-scoped evidence (sections/evidence.js): the object lives at
      // `${currentUserDomain}/${key}` — NOT the conversation path. Sign that.
      const keyPath = `${state.currentUserDomain}/${item.key}`;
      const url = await state.frontmlib.getS3SignedUrl(
        bucket,
        keyPath,
        SIGNED_URL_EXPIRY_SECONDS
      );
      D.log({
        message: "detailContent: evidence signing attempt",
        data: {
          reportId,
          fileName: item.fileName,
          keyPath,
          signed: !!url,
        },
      });
      signedEvidence.push({ fileName: item.fileName, url: url || "" });
    } catch {
      // Best-effort (NFR-4): log and degrade this link to a non-clickable entry.
      D.log({
        message: "detailContent: evidence signing failed",
        data: { reportId, fileName: item.fileName },
      });
      signedEvidence.push({ fileName: item.fileName, url: "" });
    }
  }
};

// Build the card content on every render (empty-safe — no report loaded → no card).
detailContentSection.onResponse = () => {
  const reportId = reportDoc.f[reportIdField.id]?.value || "";
  const locationToken = reportDoc.f[locationField.id]?.value || "";

  const data = {
    // No report loaded (Home / My-Reports screens) → the renderer emits nothing.
    hasReport: !!reportId,
    ship: reportDoc.f[shipNameField.id]?.value || "",
    location: LOCATION_LABELS[locationToken] || locationToken || "",
    incidentDate: formatIncidentDate(reportDoc.f[incidentDateField.id]?.value),
    description: reportDoc.f[descriptionField.id]?.value || "",
    accusedParty: reportDoc.f[accusedPartyField.id]?.value || "",
    evidenceNotes: reportDoc.f[evidenceNotesField.id]?.value || "",
    // Pre-signed in prepareDetailContentEvidence() (frame, before sendResponse).
    evidence: signedEvidence,
  };

  detailContentPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

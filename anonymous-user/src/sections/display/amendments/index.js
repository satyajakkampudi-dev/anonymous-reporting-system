// Display section: Amendments table (schema id: amendments, row 6).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-amendments fills the card content. readOnly: true because the card header
// hosts an inline "+ Add" (addAmendment) intent button — the card surface must not
// swallow the click.
//
// APPEND-ONLY (D16, rule 25): the reporter may ADD amendments but never edit or
// delete one. This renderer carries NO edit/delete affordance — only the table and
// the header "+ Add" button.
//
// TWO render paths, mirroring detail-content, because the per-row evidence file
// needs S3 signing and onResponse is NOT awaited:
//
//   1. prepareAmendmentsEvidence() — EXPORTED async helper. The nav frame
//      (openReportDetail) MUST `await` it AFTER amendmentsCollection has loaded and
//      BEFORE reportDisplayDoc.sendResponse(). For each amendment row it drills the
//      FILE_FIELD envelope (.value?.value = S3 key — NEVER the raw key in HTML, rule
//      11/18), signs it via state.frontmlib.getS3SignedUrl against the conversations
//      bucket, and caches { fileName, url } keyed by amendmentId for the synchronous
//      render. Signing here (cloud-only AWS creds) is the ONLY correct place — it
//      cannot live in onResponse (the framework calls section.onResponse synchronously
//      and discards an async return; S3 guide "section.onResponse is NOT awaited").
//
//   2. amendmentsDisplaySection.onResponse — SYNC render handler. Fires on every
//      reportDisplayDoc.sendResponse(). Reads the loaded amendmentsCollection.rows
//      plus the pre-signed evidence cache and dispatches via renderForPlatform.
//      Empty-safe: on Home / My-Reports no report is loaded → hasReport:false → emits
//      nothing; a report with zero amendments → the empty state.
//
// The cache is reset at the top of every prepare() call so a warm Lambda container
// can never leak a previous report's signed links into the next report.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import { reportIdField } from "../../report-details";
import {
  amendmentsCollection,
  amendmentIdField,
  amendmentNoteField,
  amendmentEvidenceKeyField,
  amendedOnField,
} from "../../amendments";
import {
  STATIC_DATA_KEYS,
  SIGNED_URL_EXPIRY_SECONDS,
} from "../../../../../lib/constants";
import { INTENT } from "../../../constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const amendmentsDisplaySection = new Section(
  "amendmentsDisplaySection",
  {
    doc: reportDisplayDoc,
    grid: { row: 6, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const amendmentsDisplayCardsSet = new CardsSet(
  "amendmentsDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

amendmentsDisplaySection.cardsSet = amendmentsDisplayCardsSet;

export const amendmentsDisplayPlaceholderCard = new Card(
  "amendmentsDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: amendmentsDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Amendments table]</div>',
    state,
  }
);

// Module-local cache of pre-signed amendment evidence, keyed by amendmentId.
// Set by prepareAmendmentsEvidence() (in the frame, before sendResponse) and read
// synchronously by onResponse. Reset on every prepare() so warm containers never
// leak a previous report's links.
let signedEvidenceById = {};

// Collects every amendment row's S3 evidence key from the loaded sub-collection.
// Each row is a Doc — read fields via row.f[field.id].value; the FILE_FIELD value is
// an envelope, so the S3 key is .value?.value (rule 11/18).
const collectAttachments = () => {
  const attached = [];
  for (const row of amendmentsCollection.rows || []) {
    const envelope = row.f[amendmentEvidenceKeyField.id]?.value;
    const key = envelope?.value;
    if (key) {
      attached.push({
        amendmentId: row.f[amendmentIdField.id]?.value || "",
        key,
        fileName: envelope?.fileName || "",
        // S3 path prefix = resolved scope identifier (fileScopeValue): the
        // conversationId for this (conversation-scoped) amendment field, the domain
        // name for a domain-scoped field. Use it verbatim rather than assuming
        // conversation scope. See detail-content/index.js.
        scopeValue: envelope?.fileScopeValue || null,
      });
    }
  }
  return attached;
};

// Signs every amendment's attached evidence for the loaded report. MUST be awaited in
// the frame BEFORE reportDisplayDoc.sendResponse(). Empty-safe: no report / no rows /
// no attachments → cache becomes {}. Best-effort per file: a signing failure degrades
// that one link rather than aborting the whole render (poor maritime link / transient
// S3 error, NFR-4).
export const prepareAmendmentsEvidence = async () => {
  signedEvidenceById = {};

  const reportId = reportDoc.f[reportIdField.id]?.value || "";
  if (!reportId) return; // no report loaded (Home / My-Reports) — nothing to sign.

  const attached = collectAttachments();
  if (!attached.length) return;

  const bucket = await state.getStaticData(
    STATIC_DATA_KEYS.CONVERSATIONS_BUCKET
  );
  if (!bucket) {
    // No bucket configured — keep the filename, never embed a key (broken link).
    D.log({
      message: "amendments: no conversations bucket configured",
      data: { reportId, attachedCount: attached.length },
    });
    for (const item of attached) {
      signedEvidenceById[item.amendmentId] = {
        fileName: item.fileName,
        url: "",
      };
    }
    return;
  }

  for (const item of attached) {
    try {
      const url = await state.frontmlib.getS3SignedUrl(
        bucket,
        `${state.conversationId}/${item.key}`,
        SIGNED_URL_EXPIRY_SECONDS
      );
      D.log({
        message: "amendments: evidence signing attempt",
        data: {
          amendmentId: item.amendmentId,
          fileName: item.fileName,
          keyPath: `${state.conversationId}/${item.key}`,
          signed: !!url,
        },
      });
      signedEvidenceById[item.amendmentId] = {
        fileName: item.fileName,
        url: url || "",
      };
    } catch {
      D.log({
        message: "amendments: evidence signing failed",
        data: { reportId, amendmentId: item.amendmentId },
      });
      signedEvidenceById[item.amendmentId] = {
        fileName: item.fileName,
        url: "",
      };
    }
  }
};

// Build the card content on every render (empty-safe — no report loaded → no card).
amendmentsDisplaySection.onResponse = () => {
  const reportId = reportDoc.f[reportIdField.id]?.value || "";

  // Map the loaded rows to a presentation shape. Evidence comes from the pre-signed
  // cache (by amendmentId); never read the raw S3 key into the renderer.
  const amendments = (amendmentsCollection.rows || []).map((row) => {
    const amendmentId = row.f[amendmentIdField.id]?.value || "";
    const envelope = row.f[amendmentEvidenceKeyField.id]?.value;
    const hasEvidence = !!envelope?.value;
    return {
      note: row.f[amendmentNoteField.id]?.value || "",
      amendedOn: row.f[amendedOnField.id]?.value || null,
      // signed { fileName, url } when present, else null → renderer shows "—".
      evidence: hasEvidence ? signedEvidenceById[amendmentId] || null : null,
    };
  });

  // Newest first — the most recent amendment is the one the reporter just added.
  amendments.sort(
    (a, b) => (Number(b.amendedOn) || 0) - (Number(a.amendedOn) || 0)
  );

  const data = {
    // No report loaded (Home / My-Reports screens) → the renderer emits nothing.
    hasReport: !!reportId,
    reportId,
    addIntent: INTENT.ADD_AMENDMENT,
    amendments,
  };

  amendmentsDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

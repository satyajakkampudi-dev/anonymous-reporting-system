// Display section: Amendments (schema id: amendments, row 7). A-D-amendments fills the
// card with a READ-ONLY table of amendment rows (when · note · optional signed-URL
// evidence) read from the report's embedded `amendments` array. The admin side is
// read-only — the reporter appends rows (U-F13); there is NO +Add / edit / delete here
// (rule 30). The CardsSet + placeholder were built in DISPLAY-SHELL — content only here.
// Pure display, read-only → readOnly omitted. Distinct ids from the Data Doc's
// amendmentsSection (src/sections/amendments.js): the Data Doc owns the forCollection
// rows; this Display Doc section owns the CardsSet (framework-mapping rule 7).
//
// DATA SOURCE (same gateway contract as manage-header / manage-content / status-history).
// onResponse is a Context-A render handler called SYNCHRONOUSLY during
// adminDisplayDoc.sendResponse() (CLAUDE.md "Render handlers are NOT awaited"), so it
// cannot await a load or an S3 signing. The openManageReport nav frame (Context B) has
// already run the anonymity gateway — loadReportForAdmin({ reportId }) → loadReportsForAdmin,
// which populates reportsCollection.rows — and stashed the reportId
// (STATE_KEYS.CURRENT_REPORT_ID) in the SAME invocation. This handler reads that id, finds
// the matching loaded row, re-strips it through applyAdminProjection (second anonymity
// layer), and reads its embedded `amendments` array.
//
// EVIDENCE (consume-only, mirrors manage-content). Signing requires cloud-only AWS creds
// and MUST happen BEFORE sendResponse (rule 11/18) — never in this synchronous,
// non-awaited onResponse. We read each amendment's amendmentEvidenceKey media envelope for
// its S3 key (reading the key for a lookup is allowed — CLAUDE.md "Special Case: Media
// Fields"; the raw key is NEVER embedded in HTML) and overlay the signed URL from the
// STATE_KEYS.CURRENT_REPORT_EVIDENCE map (keyed by S3 key). A key with no signed URL →
// url:"" → the renderer shows the filename marked "(link unavailable)", never a broken
// key. NOTE: A-F7 currently signs only the top-level evidenceFile* keys into that map, not
// amendmentEvidenceKey — until a follow-up extends the openManageReport frame's signing,
// amendment evidence degrades to "(link unavailable)". Flagged for a /frontm-fix-task; this
// display side lights up automatically once amendment keys are signed into the same stash.
//
// ANONYMITY (the dominant constraint, C1 / rule 30 / ER-A2/A3): this section binds NO
// reporter-identity field and NEVER queries `reports` itself — its only source is the
// gateway-loaded rows, identity-free by construction and stripped again here. The embedded
// `amendments` rows carry only amendmentId / amendmentNote / amendmentEvidenceKey /
// amendedOn — no reporter id.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case
// (Dashboard / Queue screens, or a report not found) → hasReport:false → renderers emit
// nothing. A report with no amendments → empty array → empty-state.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { reportsCollection } from "../../../docs/admin-report-doc";
import {
  applyAdminProjection,
  extractRowData,
} from "../../../../../lib/access";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const amendmentsDisplaySection = new Section(
  "amendmentsDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 7, column: 0 },
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
    content: '<div class="placeholder">[Amendments]</div>',
    state,
  }
);

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer
// (same approach as manage-content / status-history).
const toPlainReport = (row) => applyAdminProjection(extractRowData(row));

// Resolve the opened report: the gateway-loaded row whose reportId matches the
// CURRENT_REPORT_ID stash. Returns null when no report is open or none matches
// (empty-safe). Every candidate is stripped through applyAdminProjection.
const readOpenedReport = () => {
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) return null;
  const rows = (reportsCollection.rows || []).map(toPlainReport);
  return rows.find((r) => r && r.reportId === reportId) || null;
};

// Build the evidence descriptor for one amendment row from its amendmentEvidenceKey
// media envelope ({ value: <s3-key>, fileName }). Overlays A-F7's pre-signed URLs
// (STATE_KEYS.CURRENT_REPORT_EVIDENCE map, keyed by S3 key). No key → null (renderer
// shows "—"). Key but no URL (unsigned / failed / expired) → url:"" (renderer shows the
// filename marked "(link unavailable)", never the raw key).
const buildEvidence = (envelope) => {
  const s3Key = envelope?.value;
  if (!s3Key) return null;
  const urlsByKey = state.getField(STATE_KEYS.CURRENT_REPORT_EVIDENCE) || {};
  return {
    fileName: envelope?.fileName || "",
    url: (urlsByKey && urlsByKey[s3Key]) || "",
  };
};

// Build the card content on every render (empty-safe — no report open → no card).
amendmentsDisplaySection.onResponse = () => {
  const report = readOpenedReport();

  // The amendment log is the embedded `amendments` array on the report (dbName-keyed
  // rows, appended by the reporter only — U-F13). Defensive against a missing/non-array
  // value. NOTE is reporter free-text → escaped at the renderer boundary (rule 10).
  const amendments = Array.isArray(report?.amendments) ? report.amendments : [];
  const rows = amendments.map((row) => ({
    amendedOn: row?.amendedOn ?? null,
    note: row?.amendmentNote || "",
    evidence: buildEvidence(row?.amendmentEvidenceKey),
  }));

  // Newest first — the most recent amendment leads the table (wireframe §4).
  rows.sort((a, b) => (Number(b.amendedOn) || 0) - (Number(a.amendedOn) || 0));

  const data = {
    // No report open (Dashboard / Queue screens, or not found) → renderer emits nothing.
    hasReport: !!report,
    rows,
  };

  amendmentsDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

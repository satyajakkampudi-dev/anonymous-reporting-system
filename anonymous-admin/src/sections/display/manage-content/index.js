// Display section: Manage detail content (schema id: manageContent, row 3). A-D-managecontent
// fills the card with ship / location / incident-date / description / accused / against-admin /
// evidence-notes and the EVIDENCE signed-URL links for the opened report. Pure display → readOnly
// omitted. NO reporter-identity element (C1, rule 30). Distinct ids (rule 7).
//
// DATA SOURCE (same gateway contract as manage-header). onResponse is a Context-A render handler
// called SYNCHRONOUSLY during adminDisplayDoc.sendResponse() (CLAUDE.md "Render handlers are NOT
// awaited"), so it cannot await a load or an S3 signing. The openManageReport nav frame (Context B)
// has already run the anonymity gateway — loadReportForAdmin({ reportId }) → loadReportsForAdmin,
// which populates reportsCollection.rows — and stashed the reportId (STATE_KEYS.CURRENT_REPORT_ID)
// in the SAME invocation. This handler reads that id, finds the matching loaded row, and re-strips
// it through applyAdminProjection as a second anonymity layer.
//
// EVIDENCE (two-task split). Signing requires cloud-only AWS creds and MUST happen BEFORE
// sendResponse (rule 11/18) — never in this synchronous, non-awaited onResponse. So A-F7 signs each
// evidence key in the openManageReport frame and stashes a { [s3Key]: signedUrl } map under
// STATE_KEYS.CURRENT_REPORT_EVIDENCE. Here we derive the ATTACHED-file list (key + fileName) from
// the loaded projection row's media envelopes and overlay the signed URL by S3 key. Reading the
// envelope key for a lookup is allowed (CLAUDE.md "Special Case: Media Fields" — matching is fine);
// the raw key is NEVER embedded in HTML. Pre-A-F7 / signing failure / expiry → no URL → the renderer
// shows the filename marked "(link unavailable)", never a broken key. Keys are unique per report, so
// a stale stash from a previously-opened report can never surface a wrong link here (warm-container
// safe). The 'download at your own risk' note (D13) is added by the renderers when files are present.
//
// ANONYMITY (the dominant constraint): this section binds NO reporter-identity field
// (rule 30, C1, ER-A2) and NEVER queries `reports` itself (ER-A3) — its only source is the
// gateway-loaded rows, identity-free by construction and stripped again here.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case
// (Dashboard / Queue screens, or a report not found) → hasReport:false → renderers emit nothing.
//
// SANITISATION (rule 10): ship / description / accused party / evidence notes are reporter
// free-text; every interpolated value is escaped at the format-primitive boundary (escapeHtml in
// the renderers), which is the full HTML-injection defence for display.

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
import { formatDate, formatIsoDate } from "../../../../../lib/utils/format";
import { LOCATION_LABELS } from "../../../../../lib/constants";
import { STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const manageContentDisplaySection = new Section(
  "manageContentDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 3, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageContentDisplayCardsSet = new CardsSet(
  "manageContentDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageContentDisplaySection.cardsSet = manageContentDisplayCardsSet;

export const manageContentDisplayPlaceholderCard = new Card(
  "manageContentDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageContentDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail content]</div>',
    state,
  }
);

// The five FILE_FIELD dbName keys in display order (specs/3.field-spec.md). Read from the
// projection row's media envelopes (NEVER from reporterId-bearing fields).
const EVIDENCE_KEYS = [
  "evidenceFile1",
  "evidenceFile2",
  "evidenceFile3",
  "evidenceFile4",
  "evidenceFile5",
];

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer
// (same approach as manage-header/index.js).
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

// DATE field stores either epoch-ms or an ISO string depending on the picker; format
// both via the shared primitives (compose, do not reinvent) — same helper as the
// reporter-side detail-content renderer.
const formatIncidentDate = (value) => {
  if (value === null || value === "" || typeof value === "undefined") return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    return formatDate(Number(value));
  }
  return formatIsoDate(value);
};

// Build the attached-evidence render list from the loaded report's media envelopes,
// overlaying A-F7's pre-signed URLs (STATE_KEYS.CURRENT_REPORT_EVIDENCE map, keyed by
// S3 key). No report / no attachments → []. Missing URL (pre-A-F7 / failed / expired)
// → url:"" → renderer shows the filename without a clickable link (never the raw key).
const buildEvidence = (report) => {
  if (!report) return [];
  const urlsByKey = state.getField(STATE_KEYS.CURRENT_REPORT_EVIDENCE) || {};
  const evidence = [];
  for (const key of EVIDENCE_KEYS) {
    const envelope = report[key];
    const s3Key = envelope?.value; // media-field envelope: { value: <s3-key>, fileName }
    if (!s3Key) continue; // no file attached in this slot
    evidence.push({
      fileName: envelope?.fileName || "",
      url: (urlsByKey && urlsByKey[s3Key]) || "",
    });
  }
  return evidence;
};

// Build the card content on every render (empty-safe — no report open → no card).
manageContentDisplaySection.onResponse = () => {
  const report = readOpenedReport();
  const locationToken = report?.location || "";

  const data = {
    // No report open (Dashboard / Queue screens, or not found) → renderer emits nothing.
    hasReport: !!report,
    ship: report?.shipName || "",
    location: LOCATION_LABELS[locationToken] || locationToken || "",
    incidentDate: formatIncidentDate(report?.incidentDate),
    description: report?.description || "",
    accusedParty: report?.accusedParty || "",
    // SWITCH field — drives the recusal/routing-awareness banner (D9). Coerced to bool.
    againstAdmin: !!report?.againstAdmin,
    evidenceNotes: report?.evidenceNotes || "",
    // Pre-signed by A-F7 (frame, before sendResponse); [] until then (empty-safe).
    evidence: buildEvidence(report),
    // Reporter open-reporting contact (MP-FIX-CONTACT-OPEN-REPORTING). Shown ONLY when the
    // reporter chose to identify (a non-empty contactValue). contactMethod stores the label
    // ("Email"/"Phone"/"Cabin"); contactValue is the decrypted detail. The reporter's PLATFORM
    // identity (reporterId) is still excluded — this is only what they voluntarily typed.
    hasContact: !!(report && report.contactValue),
    contactMethod: report?.contactMethod || "",
    contactValue: report?.contactValue || "",
  };

  manageContentDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

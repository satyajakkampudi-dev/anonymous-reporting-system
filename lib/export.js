// Case-file export builder (A-F14). Turns the adminProjection report object(s)
// - the ONLY field set the admin app reads (SPEC.md "adminProjection", ER-A3) -
// into a CSV string and a print-ready HTML document for PDF conversion.
//
// ANONYMITY (the dominant constraint, D15 / ER-A2 / rule 30). The export is the
// highest-risk surface in the system: it produces a downloadable artefact. Two
// hard guarantees, defence-in-depth:
//   1. Read layer - callers MUST pass an object already returned by
//      lib/access.js loadReportForAdmin / loadReportsForAdmin (the SINGLE gateway,
//      rule 15), which has run applyAdminProjection. NEVER a raw `reports` row.
//   2. Write layer (THIS module) - every value placed into a CSV row or the PDF
//      HTML is taken ONLY from EXPORT_COLUMNS, an explicit ALLOW-LIST. A field
//      that is not on the list cannot appear in the output even if a future schema
//      change adds it to the loaded object. assertNoIdentity() additionally throws
//      if any ADMIN_EXCLUDED_FIELDS key is present on the input (a loud failure is
//      better than a silent leak).
// statusHistory / amendments carry actorRole (a ROLE token, never an actorId).
// Evidence is rendered as FILENAME text only - never an S3 key, never a signed URL
// (a CSV must not carry a URL that expires; a key would leak a private path).
//
// All free-text is escaped: CSV via csvCell (RFC-4180 quoting), HTML via escapeHtml.

import { ADMIN_EXCLUDED_FIELDS } from "./access";
import {
  escapeHtml,
  formatDateTime,
  formatDate,
  formatIsoDate,
} from "./utils/format";
import { statusLabel } from "./ticket-status";
import {
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  LOCATION_LABELS,
} from "./constants";

// ---------------------------------------------------------------------------
// Column allow-list - the SINGLE source of truth for what an export may contain.
// `key`   - the adminProjection dbName read off the loaded object.
// `label` - the human-readable (British English) column / row label.
// `format`- pure value → display-string mapper (token→label, ms→date, etc.).
// A field absent here is NEVER exported. Identity fields (reporterId, contact*,
// createdBy/modifiedBy) are deliberately NOT on this list AND are asserted-absent
// below - they cannot reach the output by any path.
// ---------------------------------------------------------------------------

// DATE field stores epoch-ms OR an ISO string depending on the picker - format both
// (mirrors the manage-content renderer's formatIncidentDate; compose, do not reinvent).
const formatIncidentDate = (value) => {
  if (value === null || value === "" || typeof value === "undefined") return "";
  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    return formatDate(Number(value));
  }
  return formatIsoDate(value);
};

const labelFrom = (map) => (token) => (token ? map[token] || token : "");

export const EXPORT_COLUMNS = [
  { key: "reportId", label: "Tracking ID", format: (v) => v || "" },
  { key: "status", label: "Status", format: (v) => statusLabel(v) },
  { key: "severity", label: "Severity", format: labelFrom(SEVERITY_LABELS) },
  { key: "category", label: "Category", format: labelFrom(CATEGORY_LABELS) },
  { key: "urgency", label: "Urgency", format: labelFrom(URGENCY_LABELS) },
  { key: "shipName", label: "Ship / vessel", format: (v) => v || "" },
  { key: "location", label: "Location", format: labelFrom(LOCATION_LABELS) },
  { key: "incidentDate", label: "Incident date", format: formatIncidentDate },
  { key: "description", label: "Description", format: (v) => v || "" },
  { key: "accusedParty", label: "Accused party", format: (v) => v || "" },
  {
    key: "againstAdmin",
    label: "Concerns compliance team",
    format: (v) => (v ? "Yes" : "No"),
  },
  { key: "resolution", label: "Resolution", format: (v) => v || "" },
  { key: "rejectReason", label: "Reject reason", format: (v) => v || "" },
  { key: "createdOn", label: "Created", format: (v) => formatDateTime(v) },
  { key: "updatedOn", label: "Last updated", format: (v) => formatDateTime(v) },
  { key: "resolvedOn", label: "Resolved", format: (v) => formatDateTime(v) },
];

// Evidence FILE_FIELD keys (filenames only - never keys/URLs).
const EVIDENCE_KEYS = [
  "evidenceFile1",
  "evidenceFile2",
  "evidenceFile3",
  "evidenceFile4",
  "evidenceFile5",
];

// Friendly, role-ONLY actor label (anonymity, rule 30) - both admin roles collapse
// to "Compliance" so the audit trail never exposes the primary/secondary split or
// any id. Mirrors the status-history display renderer's ACTOR_LABEL.
const ACTOR_LABEL = {
  REPORTER: "Reporter",
  PRIMARY_ADMIN: "Compliance",
  SECONDARY_ADMIN: "Compliance",
  SYSTEM: "System",
};
const actorLabel = (role) => ACTOR_LABEL[role] || "";

// ---------------------------------------------------------------------------
// Anonymity assertion. Throws if a loaded object still carries an identity field.
// A loud failure (caught by the frame → calm message, no output) beats a silent
// leak. Returns the object unchanged when clean.
// ---------------------------------------------------------------------------
export const assertNoIdentity = (report) => {
  if (!report || typeof report !== "object") return report;
  for (const field of ADMIN_EXCLUDED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(report, field)) {
      throw new Error(
        `export anonymity violation: identity field "${field}" present`
      );
    }
  }
  return report;
};

// Evidence filenames present on a report (text only, never the key/URL).
const evidenceFileNames = (report) => {
  const names = [];
  for (const key of EVIDENCE_KEYS) {
    const fileName = report?.[key]?.fileName;
    if (fileName) names.push(fileName);
  }
  return names;
};

// Normalised, allow-listed sub-collections (read off the loaded object only).
const statusHistoryRows = (report) =>
  (Array.isArray(report?.statusHistory) ? report.statusHistory : [])
    .map((r) => ({
      fromStatus: r?.fromStatus || "",
      toStatus: r?.toStatus || "",
      actorRole: r?.actorRole || "",
      changedOn: r?.changedOn ?? null,
      note: r?.note || "",
    }))
    .sort((a, b) => (Number(a.changedOn) || 0) - (Number(b.changedOn) || 0));

const amendmentRows = (report) =>
  (Array.isArray(report?.amendments) ? report.amendments : [])
    .map((r) => ({
      amendedOn: r?.amendedOn ?? null,
      note: r?.amendmentNote || "",
      fileName: r?.amendmentEvidenceKey?.fileName || "",
    }))
    .sort((a, b) => (Number(a.amendedOn) || 0) - (Number(b.amendedOn) || 0));

// ===========================================================================
// CSV
// ===========================================================================

// RFC-4180 cell: wrap in quotes and double embedded quotes when the value
// contains a comma, quote, CR or LF. Leading-character injection (=,+,-,@) is
// neutralised with a leading apostrophe (spreadsheet formula-injection guard).
const csvCell = (value) => {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
};

const csvRow = (cells) => cells.map(csvCell).join(",");

// Build a CSV for one-or-many reports. One header row + one row per report over
// the EXPORT_COLUMNS allow-list, PLUS summary columns for the embedded
// sub-collections (counts + a pipe-joined digest) so a tabular export stays
// pragmatic and single-row-per-report. Evidence is a filename list (no keys/URLs).
export const buildCsv = (reports) => {
  const list = (Array.isArray(reports) ? reports : [reports]).filter(Boolean);
  list.forEach(assertNoIdentity);

  const header = [
    ...EXPORT_COLUMNS.map((c) => c.label),
    "Evidence files",
    "Status history",
    "Amendments",
  ];

  const lines = [csvRow(header)];

  for (const report of list) {
    const base = EXPORT_COLUMNS.map((c) => c.format(report?.[c.key]));

    const evidence = evidenceFileNames(report).join(" | ");

    const history = statusHistoryRows(report)
      .map((r) => {
        const when = formatDateTime(r.changedOn);
        const who = actorLabel(r.actorRole);
        const note = r.note ? ` - ${r.note}` : "";
        return `${when} ${who}: ${statusLabel(r.fromStatus)} -> ${statusLabel(r.toStatus)}${note}`;
      })
      .join(" | ");

    const amendments = amendmentRows(report)
      .map((r) => {
        const when = formatDateTime(r.amendedOn);
        const file = r.fileName ? ` [file: ${r.fileName}]` : "";
        return `${when}: ${r.note}${file}`;
      })
      .join(" | ");

    lines.push(csvRow([...base, evidence, history, amendments]));
  }

  return lines.join("\r\n");
};

// ===========================================================================
// PDF (case-file HTML for the HTML-class toPDF path)
// ===========================================================================

const fieldRow = (label, value) =>
  `<tr><th style="text-align:left;vertical-align:top;padding:6px 12px 6px 0;` +
  `color:#374151;width:180px;font-weight:600;">${escapeHtml(label)}</th>` +
  `<td style="padding:6px 0;color:#111827;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`;

// One report's case-file <section>. Allow-list only; sub-collections summarised
// as read-only tables. Every value escaped via escapeHtml.
const reportSectionHtml = (report) => {
  assertNoIdentity(report);

  const detailRows = EXPORT_COLUMNS.map((c) =>
    fieldRow(c.label, c.format(report?.[c.key]))
  ).join("");

  const evidence = evidenceFileNames(report);
  const evidenceHtml = evidence.length
    ? `<ul style="margin:6px 0 0;padding-left:20px;color:#111827;">${evidence
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join("")}</ul>`
    : `<div style="color:#6b7280;">No evidence attached.</div>`;

  const history = statusHistoryRows(report);
  const historyHtml = history.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:12px;">` +
      `<thead><tr>${["When", "Actor", "From", "To", "Note"]
        .map(
          (h) =>
            `<th style="text-align:left;border-bottom:1px solid #d1d5db;padding:4px 8px;color:#374151;">${escapeHtml(h)}</th>`
        )
        .join("")}</tr></thead><tbody>` +
      history
        .map(
          (r) =>
            `<tr>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(formatDateTime(r.changedOn))}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(actorLabel(r.actorRole))}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(statusLabel(r.fromStatus))}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(statusLabel(r.toStatus))}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(r.note)}</td>` +
            `</tr>`
        )
        .join("") +
      `</tbody></table>`
    : `<div style="color:#6b7280;">No status history.</div>`;

  const amendments = amendmentRows(report);
  const amendmentsHtml = amendments.length
    ? `<table style="border-collapse:collapse;width:100%;font-size:12px;">` +
      `<thead><tr>${["When", "Note", "Evidence file"]
        .map(
          (h) =>
            `<th style="text-align:left;border-bottom:1px solid #d1d5db;padding:4px 8px;color:#374151;">${escapeHtml(h)}</th>`
        )
        .join("")}</tr></thead><tbody>` +
      amendments
        .map(
          (r) =>
            `<tr>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(formatDateTime(r.amendedOn))}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:pre-wrap;">${escapeHtml(r.note)}</td>` +
            `<td style="padding:4px 8px;border-bottom:1px solid #eee;">${escapeHtml(r.fileName)}</td>` +
            `</tr>`
        )
        .join("") +
      `</tbody></table>`
    : `<div style="color:#6b7280;">No amendments.</div>`;

  const trackingId = report?.reportId || "(unknown)";

  return (
    `<section style="margin:0 0 32px;page-break-inside:avoid;">` +
    `<h2 style="font-size:18px;margin:0 0 4px;color:#111827;">Case file - ${escapeHtml(trackingId)}</h2>` +
    `<div style="font-size:11px;color:#6b7280;margin:0 0 12px;">Anonymous report · identity-free export</div>` +
    `<table style="border-collapse:collapse;width:100%;font-size:13px;margin:0 0 16px;">${detailRows}</table>` +
    `<h3 style="font-size:14px;margin:0 0 6px;color:#111827;">Evidence</h3>${evidenceHtml}` +
    `<h3 style="font-size:14px;margin:16px 0 6px;color:#111827;">Status history</h3>${historyHtml}` +
    `<h3 style="font-size:14px;margin:16px 0 6px;color:#111827;">Amendments</h3>${amendmentsHtml}` +
    `</section>`
  );
};

// Full HTML document (the string handed to the HTML class `content` with toPDF).
// Accepts one-or-many reports; multiple reports become page-broken sections.
export const buildPdfHtml = (reports, { generatedOn = Date.now() } = {}) => {
  const list = (Array.isArray(reports) ? reports : [reports]).filter(Boolean);
  const sections = list.map(reportSectionHtml).join("");
  const heading =
    list.length === 1
      ? `Case file - ${escapeHtml(list[0]?.reportId || "")}`
      : `Case files (${list.length})`;

  return (
    `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">` +
    `<title>${heading}</title>` +
    `<style>` +
    `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;` +
    `padding:32px;color:#111827;line-height:1.45;}` +
    `h1{font-size:22px;margin:0 0 4px;}` +
    `</style></head><body>` +
    `<h1>${heading}</h1>` +
    `<div style="font-size:11px;color:#6b7280;margin:0 0 24px;">` +
    `Generated ${escapeHtml(formatDateTime(generatedOn))} · This export contains NO reporter identity.` +
    `</div>` +
    sections +
    `</body></html>`
  );
};

// CSV-delivery HTML page (HTML class `content`, new browser tab). The browser
// downloads via a data:text/csv anchor - a pure-browser primitive, not a
// framework API. base64-encode the CSV so commas/newlines/quotes survive the URI.
export const buildCsvDeliveryHtml = (
  csv,
  { fileName = "case-export.csv" } = {}
) => {
  // btoa is not guaranteed in the Lambda runtime; use Buffer (Node) for the
  // data-URI payload, falling back to encodeURIComponent if Buffer is absent.
  let href;
  try {
    const b64 =
      typeof Buffer !== "undefined"
        ? Buffer.from(csv, "utf-8").toString("base64")
        : null;
    href = b64
      ? `data:text/csv;charset=utf-8;base64,${b64}`
      : `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  } catch (e) {
    href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }

  const safeName = escapeHtml(fileName);
  return (
    `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8">` +
    `<title>CSV export</title>` +
    `<style>body{font-family:system-ui,sans-serif;padding:40px;color:#111827;text-align:center;}` +
    `a.btn{display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;` +
    `border-radius:8px;text-decoration:none;font-weight:600;}</style></head><body>` +
    `<h1 style="font-size:20px;">Your case export is ready</h1>` +
    `<p style="color:#6b7280;">This file contains no reporter identity.</p>` +
    `<a class="btn" href="${href}" download="${safeName}">Download ${safeName}</a>` +
    `<p style="color:#6b7280;font-size:12px;margin-top:24px;">` +
    `If the download does not start automatically, use the button above.</p>` +
    `</body></html>`
  );
};

// A-F14 — Case export (CSV / PDF). Export a report's case file (or a filtered set)
// built from the adminProjection set ONLY — no reporter identity (D15).
//
// Independent intent (Context B): the object graph is empty, so we LOAD before we
// read. The reportId arrives ONE LEVEL DEEP under state.messageFromUser.payload
// (CLAUDE.md "Custom HTML Payloads"), exactly like the wired Export button in the
// manage-actions card (data-action="intent" data-intent-id="exportReport"
// data-payload '{"reportId":"..."}').
//
// SOURCE — the anonymity gateway ONLY (rule 15/16). loadReportForAdmin (single) /
// loadReportsForAdmin (set) apply { projection: adminProjection } AND re-strip every
// row through applyAdminProjection. lib/export.js builds the artefact from an
// explicit column ALLOW-LIST and asserts no identity field is present (D15) — a
// loud throw beats a silent leak. NEVER query `reports` directly here.
//
// DELIVERY (documented primitives only — html-class-guide / pdf-generation-guide):
//   • PDF  — the PRIMARY deliverable (acceptance "PDF via the HTML class toPDF").
//            buildPdfHtml → HTML class content + toPDF:true → the super-app converts
//            it to a downloadable PDF. (The PdfGenerator-Lambda path needs a
//            PDF_BUCKET static-data key this project does not define; toPDF needs no
//            S3/Lambda infra, which is why the acceptance specifies it.)
//   • CSV  — buildCsv → an HTML page (new browser tab) carrying a data:text/csv
//            download anchor. The new-tab HTML page is the documented HTML-class
//            mode; the data-URI download is a pure-browser primitive (no invented
//            framework API). Default for the SET/tabular export.
//   Format is chosen by the payload `format` ("pdf" | "csv"); single-report Export
//   defaults to PDF (case file), a set export defaults to CSV (tabular).
//
// SCOPE: only the single-report Export button is wired in the UI today (it emits
// { reportId }). The SET export (payload { filter }/{ scope:"queue" }) is fully
// implemented here but has NO trigger yet — FLAGGED as a follow-up (add a "Export
// queue" button to the queue toolbar that emits exportReport with a filter payload).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { HTML } from "@frontmltd/frontmjs/core/HTML";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { loadReportForAdmin, loadReportsForAdmin } from "../../../lib/access";
import {
  buildCsv,
  buildPdfHtml,
  buildCsvDeliveryHtml,
} from "../../../lib/export";
import { INTENT } from "../constants";

export const exportReport = Intent.Create({
  intentId: INTENT.EXPORT_REPORT,
  prompt: "Export a report's case file",
  state,
});

const FORMAT = { PDF: "pdf", CSV: "csv" };

// Map an optional set-export filter payload to a gateway query. v1 supports a
// status filter and a scope:"queue" (non-terminal) shorthand; extend additively.
// Returns null when no recognised set filter is present (→ caller treats as single).
const setQueryFromPayload = (payload) => {
  if (!payload || typeof payload !== "object") return null;
  if (payload.scope === "queue") {
    // Non-terminal reports (the live queue). Terminal statuses are excluded.
    return {
      query: {
        status: {
          $nin: ["CLOSED_BY_USER", "CLOSED_BY_SYSTEM", "WITHDRAWN"],
        },
      },
    };
  }
  if (payload.filter && typeof payload.filter === "object") {
    return { query: payload.filter };
  }
  return null;
};

// Deliver a generated case file. PDF via the HTML class toPDF; CSV via an HTML
// page carrying a data-URI download. New instance per call (per-invocation config
// pattern — html-class-guide "Instantiate Once, Configure Per Call" is also valid,
// but a fresh instance keeps the export intent stateless and side-effect-free).
const deliver = (format, reports, baseName) => {
  if (format === FORMAT.CSV) {
    const csv = buildCsv(reports);
    const page = buildCsvDeliveryHtml(csv, { fileName: `${baseName}.csv` });
    const html = new HTML("exportCsvHtml", {
      title: "Case export (CSV)",
      content: page,
      embedded: false, // new browser tab — full-window real estate for the download
      state,
    });
    html.sendResponse();
    return;
  }

  // PDF (default / primary deliverable).
  const page = buildPdfHtml(reports);
  const html = new HTML("exportPdfHtml", {
    title: "Case file (PDF)",
    content: page,
    toPDF: true, // super-app converts the HTML to a downloadable PDF
    state,
  });
  html.sendResponse();
};

exportReport.onResolution = async () => {
  const payload = state.messageFromUser?.payload || {};
  const { reportId } = payload;

  // Attach to the existing context (Redis-only; no MongoDB re-read of the doc graph).
  await Context.Create(state.currentTabId, { state });

  const setQuery = setQueryFromPayload(payload);

  try {
    // ---- SET export (no reportId, or an explicit filter/scope) ----
    if (!reportId && setQuery) {
      const reports = await loadReportsForAdmin(setQuery);
      if (!reports.length) {
        state.addErrorToStack(404, "No reports match the export filter.");
        return;
      }
      // A set defaults to CSV (tabular) unless the trigger asks for PDF.
      const format = payload.format === FORMAT.PDF ? FORMAT.PDF : FORMAT.CSV;
      D.log({
        message: "exportReport: set export",
        data: { count: reports.length, format },
      });
      deliver(format, reports, "case-export");
      return;
    }

    // ---- SINGLE-report export (the only wired trigger today) ----
    if (!reportId) {
      state.addErrorToStack(400, "Missing reportId for exportReport.");
      return;
    }

    const report = await loadReportForAdmin({ reportId });
    if (!report) {
      state.addErrorToStack(404, "Report not found.");
      return;
    }

    // A single report defaults to PDF (case file) unless the trigger asks for CSV.
    const format = payload.format === FORMAT.CSV ? FORMAT.CSV : FORMAT.PDF;
    D.log({
      message: "exportReport: single export",
      data: { reportId, format },
    });
    deliver(format, report, `case-${reportId}`);
  } catch (err) {
    // assertNoIdentity throws here if a loaded object ever carried an identity field
    // (defence-in-depth) — we NEVER ship a half-built or identity-leaking artefact.
    D.log({
      message: "exportReport: generation/delivery failed",
      data: { reportId: reportId || "(set)", error: err?.message },
    });
    state.addErrorToStack(
      500,
      "Could not generate the export. Please try again."
    );
  }
};

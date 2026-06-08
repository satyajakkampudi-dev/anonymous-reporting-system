// Navigation intent: openReportDetail — load one report by reportId for the detail view.
//
// Independent intent (Context B). The reportId arrives in the invoke_intent envelope
// ONE LEVEL DEEP under .payload (CLAUDE.md "Custom HTML Payloads") — never at the top
// level. Attach to the context, load the specific report (data-loading table), assert
// OWNERSHIP (reporterId === userId; never a cross-user leak), then load the two
// embedded sub-collections (loadDocument does not auto-populate collection.rows).
// SCAFFOLD: renders the loaded form inline; the detail cards are the U-D-detail* tasks.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { ownsReport } from "../../../lib/access";
import { ERROR_CODES } from "../../../lib/constants";
import { reportDoc } from "../collections/reports";
import { reportDisplayDoc } from "../docs/report-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { reporterIdField, statusField } from "../sections/report-details";
import { amendmentsCollection } from "../sections/amendments";
import { statusHistoryCollection } from "../sections/status-history";
import { prepareDetailContentEvidence } from "../sections/display/detail-content";
import { prepareAmendmentsEvidence } from "../sections/display/amendments";
import { INTENT } from "../constants";

export const openReportDetail = Intent.Create({
  intentId: INTENT.OPEN_REPORT_DETAIL,
  prompt: "Open a report's detail",
  state,
});

openReportDetail.onResolution = async () => {
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for openReportDetail");
    return;
  }

  D.log({ message: "openReportDetail: opening detail", data: { reportId } });

  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportDoc.loadDocument({ reportId });

  // Ownership assertion — the report must belong to the caller.
  if (!ownsReport({ reporterId: reporterIdField.value })) {
    state.addErrorToStack(
      ERROR_CODES.NOT_REPORT_OWNER,
      "This report was not found, or it is not yours to view."
    );
    return;
  }

  // Sub-collections are not auto-populated by loadDocument.
  await amendmentsCollection.loadCollectionWithQuery({});
  await statusHistoryCollection.loadCollectionWithQuery({});

  D.log({
    message: "openReportDetail: report loaded",
    data: {
      reportId,
      status: reportDoc.f[statusField.id]?.value || "",
      amendmentCount: amendmentsCollection.rows?.length || 0,
      statusHistoryCount: statusHistoryCollection.rows?.length || 0,
    },
  });

  // Sign the report's evidence S3 keys BEFORE rendering — onResponse (the detail
  // content render handler) is synchronous and NOT awaited, so the signing must
  // complete here (S3 guide "Signed URLs before sendResponse", rule 11/18).
  await prepareDetailContentEvidence();
  // Sign each amendment's evidence S3 key (same constraint — onResponse is sync,
  // not awaited). The sub-collection is already loaded above.
  await prepareAmendmentsEvidence();

  // Two-Doc: render via the Display Doc, not the editable Data Doc form.
  showScreen(SCREEN.DETAIL);
  reportDisplayDoc.sendResponse();
};

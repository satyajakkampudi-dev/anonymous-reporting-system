// Navigation intent: openManualLog — open the manual-log form (A-F13 / A-E-manualLog).
//
// Independent intent (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Attaches to the EXISTING context via Context.Create (preserves the
// autoSaveBuffer — rule 22; NEVER re-loadDocument). The source=MANUAL submit handler
// (adminReportDoc.onSubmit) lives in frames/manual-log.js; this frame opens a BLANK
// form.
//
// AUTHORISE (defence beyond A-F1): only an admin may open the manual-log form. The
// role is re-resolved authoritatively against the seeded admin-users registry
// (lib/access.resolveAdminRole — the SINGLE gating source, D3). A thrown read (poor
// maritime link) is a NEUTRAL retry, never a deny (same reasoning as the A-F1 gate +
// the takeReview sibling); a null role (caller not an admin) → refuse.
//
// FRESH-DRAFT RESET (CRITICAL — anonymity / no identity-or-timeline bleed). The admin
// may have JUST loaded an existing report into adminReportDoc via a transition
// (take-review / resolve / escalate / closeRejected all call
// adminReportDoc.loadDocument({ reportId })), so the shared Data Doc can be holding a
// previous report's field values AND its embedded statusHistory / amendments rows. The
// manual-log form MUST open blank. We reset adminReportDoc IN PLACE (rule 26 — NEVER
// cloneAndInit; the clone shares the original's intentId, gets silently un-registered,
// and the submit dispatch lands on the wrong instance):
//   1. set a fresh docId FIRST (so the new report is a new row, not an upsert of the
//      previously-loaded one — without it save() could clobber the loaded report);
//   2. clear ALL field values;
//   3. clear the embedded sub-collections' rows via the documented Collection.clearRows()
//      (frontm-ai-collection-class-comprehensive-guide), reaching the LIVE collections
//      through adminReportDoc.subCollections (the instances the framework serialises on
//      save — the same access pattern as status-history-writer.getStatusHistoryCollection,
//      rule 21). Without this a manual report would inherit the previous report's
//      timeline/amendments — a privacy and audit-integrity defect.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";
import { resolveAdminRole } from "../../../lib/access";
import { ERROR_CODES } from "../../../lib/constants";
import { INTENT } from "../constants";

export const openManualLog = Intent.Create({
  intentId: INTENT.OPEN_MANUAL_LOG,
  prompt: "Manually log a report",
  state,
});

openManualLog.onResolution = async () => {
  // AUTHORISE — authoritative role re-resolution (NOT a display stash). A thrown read
  // is a neutral retry, not a deny (never block a legitimate admin on a flaky link).
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-E-manualLog: openManualLog role resolution failed",
      data: { error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to log a report."
    );
    return;
  }

  // Fresh context for this dispatch (state.currentTabId does not persist across
  // invocations — a fresh CreateAndInit is the correct entry; the blank-form reset
  // below establishes the draft state, so no buffer carry-over is needed).
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });

  // FRESH-DRAFT RESET (rule 26 — in place, NEVER cloneAndInit).
  // 1. New docId FIRST so the new report is a new row (not an upsert of a loaded one).
  adminReportDoc.docId = state.getUniqueId();
  // 2. Clear ALL field values (content + every infra/system field).
  for (const field of adminReportDoc.fields) {
    field.value = null;
  }
  // 3. Clear the embedded sub-collections' rows (statusHistory + amendments) so the new
  //    report never inherits a previously-loaded report's timeline/amendments. Reach the
  //    LIVE collections via subCollections (rule 21) and use the documented clearRows().
  for (const subCollection of adminReportDoc.subCollections || []) {
    if (subCollection && typeof subCollection.clearRows === "function") {
      subCollection.clearRows();
    }
  }

  // Render the FORM. A Data-Doc form render IS correct for data ENTRY (the "never
  // sendResponse the Data Doc" rule is about READ/display screens, which use the Display
  // Doc) — mirrors the user submit form (nav-submit-report.js: reportDoc.sendResponse()).
  adminReportDoc.confirm = "Log report";
  adminReportDoc.title = "Manually log a report";
  adminReportDoc.sendResponse();
};

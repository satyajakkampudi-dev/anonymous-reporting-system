// U-F12 - Withdraw report (OPEN / UNDER_REVIEW → WITHDRAWN, terminal).
//
// Independent intent (Context B - object graph EMPTY on entry). Triggered by the
// "Withdraw" button in the detail-actions card (data-action="intent",
// intentId = withdrawReport, data-payload {reportId}). The payload field lives ONE
// LEVEL DEEP under state.messageFromUser.payload (CLAUDE.md "Custom HTML Payloads");
// read it defensively. Withdraw is offered ONLY on OPEN / UNDER_REVIEW for the
// REPORTER (lib/ticket-status STATUS_META allowedActionsByRole), so off-status
// reports never render the button - but the authoritative guard is re-run here on a
// fresh read.
//
// Direct (no-popup) sibling of the committed U-F10 accept-resolution.js. Same
// optimistic-concurrency contract (framework-mapping rule 12):
//   1. Read reportId from the payload; missing → 400.
//   2. Attach to the existing context (Context.Create - Redis-only, no buffer wipe;
//      rule 22) and re-read the report fresh from MongoDB by reportId (loadDocument).
//   3. OWNERSHIP FIRST (acceptance criterion): a report the caller does not own is
//      indistinguishable from "not found" - same message, no existence leak (ER-A3).
//   4. Concurrency + legality guard: validate the move against the CURRENT status via
//      canTransition(current, WITHDRAWN, REPORTER). Because step 2 re-read fresh,
//      `current` is the latest persisted status - so if an admin already moved the
//      report off OPEN/UNDER_REVIEW (e.g. resolved/escalated it), or a concurrent
//      double-click already withdrew it, the move is illegal NOW and is REJECTED and
//      surfaced, never overwritten. This fresh-read + canTransition check IS the
//      concurrency guard: a true compare-and-swap via save(false, {reportId, version})
//      is UNSAFE here - Doc.save() forces { upsert: true } (Doc.js), so a non-matching
//      version query would INSERT a corrupt duplicate report rather than no-op. version
//      is still advanced monotonically (read → read+1) so other writers' guards and the
//      audit trail stay coherent. Same reasoning as U-F10/U-F11.
//   5. Apply: status = WITHDRAWN, bump version, stamp withdrawnOn + updatedOn, and
//      append ONE statusHistory row via the transition path (rule 12; actorRole =
//      REPORTER, never an id - anonymity). loadDocument hydrates the embedded
//      statusHistory rows into the live sub-collection (hasSubDocs path), so the append
//      preserves the prior timeline on save (it does not clobber the history).
//   6. Persist (reportDoc.save() - re-runs the authoritative onSave gate, which the
//      already-validated report passes; detect a gate abort via the error stack
//      growing, mirroring U-F8/U-F10). On success, confirm clearly and reassuringly.
//
// No bot-to-bot/notification send here - WITHDRAWN has no cross-app contract in the
// task graph (the reporter initiates it; the admin sees it on next read). Do NOT
// invent a sender.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { reportDoc } from "../collections/reports";
import {
  reporterIdField,
  statusField,
  versionField,
  withdrawnOnField,
  updatedOnField,
} from "../sections/report-details";
import { appendStatusHistoryRow } from "./status-history-writer";
import { ownsReport } from "../../../lib/access";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import { ACTOR_ROLE, ERROR_CODES, userTab } from "../../../lib/constants";
import { saveDocWithSubCollections } from "../../../lib/persist";
import { CONTEXT, INTENT } from "../constants";

export const withdrawReport = Intent.Create({
  intentId: INTENT.WITHDRAW_REPORT,
  prompt: "Withdraw a report you submitted",
  state,
});

withdrawReport.onResolution = async () => {
  // 1. Payload (one level deep under .payload - never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for withdrawReport");
    return;
  }
  D.log({ message: "U-F12 withdraw: start", data: { reportId } });

  // 2. Fresh context for this dispatch, then re-read the report fresh (rule 12).
  // Stable detail tab (rule 37): the re-render via openReportDetail lands in the same tab.
  await Context.CreateAndInit(userTab(CONTEXT.REPORT_DETAIL, state), { state });
  await reportDoc.loadDocument({ reportId });

  // 3. Ownership FIRST - a non-owned or non-existent report yields the SAME message
  //    (no existence leak; ER-A3). reporterId is empty on a miss → ownsReport false.
  if (!ownsReport({ reporterId: reportDoc.f[reporterIdField.id]?.value })) {
    state.addErrorToStack(
      ERROR_CODES.NOT_REPORT_OWNER,
      "This report was not found, or it is not yours to act on."
    );
    return;
  }

  // 4. Concurrency + legality: the move must be legal from the CURRENT (just-read)
  //    status. canTransition allows WITHDRAWN only from OPEN / UNDER_REVIEW for the
  //    REPORTER. Catches an admin moving the report on (resolved/escalated) and a
  //    double-click that already withdrew it - rejected and surfaced, not overwritten.
  const current = reportDoc.f[statusField.id]?.value || "";
  D.log({
    message: "U-F12 withdraw: status read",
    data: { reportId, current },
  });
  if (!canTransition(current, STATUS.WITHDRAWN, ACTOR_ROLE.REPORTER)) {
    state.addErrorToStack(
      ERROR_CODES.ILLEGAL_TRANSITION,
      "This report can no longer be withdrawn - its status has changed. Please refresh to see the latest update."
    );
    D.log({
      message: "U-F12: withdraw rejected - illegal/stale transition",
      data: { reportId, current, to: STATUS.WITHDRAWN },
    });
    return;
  }

  D.log({
    message: "U-F12 withdraw: transition legal",
    data: { reportId, current, to: STATUS.WITHDRAWN },
  });

  // 5. Apply the transition. version advances monotonically (read → read+1).
  const now = Date.now();
  reportDoc.f[statusField.id].value = STATUS.WITHDRAWN;
  reportDoc.f[versionField.id].value =
    Number(reportDoc.f[versionField.id]?.value || 0) + 1;
  reportDoc.f[withdrawnOnField.id].value = now;
  reportDoc.f[updatedOnField.id].value = now;

  // One statusHistory row, same path/atomic with the report write (rule 12).
  appendStatusHistoryRow(reportDoc, {
    fromStatus: current,
    toStatus: STATUS.WITHDRAWN,
    actorRole: ACTOR_ROLE.REPORTER,
  });

  // 6. Persist. save() re-runs reportDoc.onSave (the evidence/contact gate); the
  //    already-validated report passes. A gate abort adds to the error stack WITHOUT
  //    throwing - detect it the same way U-F8/U-F10 do and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await saveDocWithSubCollections(reportDoc);
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not withdraw your report just now. Please try again."
    );
    D.log({
      message: "U-F12: report save failed on withdraw",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }
  D.log({
    message: "U-F12 withdraw: save success",
    data: { reportId, status: STATUS.WITHDRAWN },
  });

  `Your report **${reportId}** has been withdrawn.\n\nIt will no longer be reviewed by the compliance team. Your identity has remained anonymous throughout, and the full timeline stays on record for you. If you change your mind, you are welcome to submit a new report at any time.`.sendResponse();

  // Re-render the detail view so the UI reflects the new WITHDRAWN state: updated
  // status pill, the appended timeline row, and the Withdraw button GONE (it is no
  // longer a legal action from WITHDRAWN, so detail-actions won't render it). Chain to
  // openReportDetail - it re-reads fresh, re-asserts ownership, reloads the
  // sub-collections and re-signs evidence. continueWithIntentWithIdAndMessage carries
  // the reportId as messageFromUser.payload.reportId (the shape openReportDetail reads).
  D.log({
    message: "U-F12 withdraw: re-rendering detail view",
    data: { reportId },
  });
  state.continueWithIntentWithIdAndMessage(INTENT.OPEN_REPORT_DETAIL, {
    payload: { reportId },
  });
};

// U-F10 — Accept resolution (RESOLVED → CLOSED_BY_USER, terminal).
//
// Independent intent (Context B — object graph EMPTY on entry). Triggered by the
// "Accept" button in the detail-actions card (data-action="intent",
// intentId = acceptResolution, data-payload {reportId}). The payload field lives
// ONE LEVEL DEEP under state.messageFromUser.payload (CLAUDE.md "Custom HTML
// Payloads"); read it defensively.
//
// Sequence (framework-mapping rule 12 — optimistic concurrency on every transition):
//   1. Read reportId from the payload; missing → 400.
//   2. Attach to the existing context (Context.Create — Redis-only, no buffer wipe;
//      rule 22) and re-read the report fresh from MongoDB by reportId (loadDocument).
//   3. OWNERSHIP FIRST (acceptance criterion): a report the caller does not own is
//      indistinguishable from "not found" — same message, no existence leak (ER-A3).
//   4. Concurrency + legality guard: validate the move against the CURRENT status via
//      canTransition(current, CLOSED_BY_USER, REPORTER). Because step 2 re-read fresh,
//      `current` is the latest persisted status — so if an admin (or a concurrent
//      double-click) already moved the report off RESOLVED, the move is illegal NOW
//      and is REJECTED and surfaced, never overwritten (acceptance criterion "stale
//      version … rejected, not overwritten"). This fresh-read + canTransition check IS
//      the concurrency guard: a true compare-and-swap via save(false, {reportId,
//      version}) is UNSAFE here — Doc.save() forces { upsert: true } (Doc.js), so a
//      non-matching version query would INSERT a corrupt duplicate report rather than
//      no-op. version is still advanced monotonically (read → read+1) so other
//      writers' guards and the audit trail stay coherent.
//   5. Apply: status = CLOSED_BY_USER, bump version, stamp updatedOn, and append ONE
//      statusHistory row via the transition path (rule 12; actorRole = REPORTER, never
//      an id — anonymity). loadDocument hydrates the embedded statusHistory rows into
//      the live sub-collection (hasSubDocs path), so the append preserves prior history
//      on save (it does not clobber the timeline).
//   6. Persist (reportDoc.save() — re-runs the authoritative onSave gate, which the
//      already-validated report passes; detect a gate abort via the error stack
//      growing, mirroring U-F8). On success, confirm clearly and reassuringly.
//
// No bot-to-bot/notification send here — MSG_REPORT_CLOSED is the X-series contract
// task, wired AFTER save() (rule 16). Do NOT invent the sender now.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { reportDoc } from "../collections/reports";
import {
  reporterIdField,
  statusField,
  versionField,
  updatedOnField,
} from "../sections/report-details";
import { appendStatusHistoryRow } from "./status-history-writer";
import { ownsReport } from "../../../lib/access";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import { ACTOR_ROLE, ERROR_CODES } from "../../../lib/constants";
import { saveDocWithSubCollections } from "../../../lib/persist";
import { INTENT } from "../constants";

export const acceptResolution = Intent.Create({
  intentId: INTENT.ACCEPT_RESOLUTION,
  prompt: "Accept the resolution of a report and close it",
  state,
});

acceptResolution.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for acceptResolution");
    return;
  }
  D.log({ message: "U-F10 accept: start", data: { reportId } });

  // 2. Fresh context for this dispatch, then re-read the report fresh (rule 12).
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportDoc.loadDocument({ reportId });

  // 3. Ownership FIRST — a non-owned or non-existent report yields the SAME message
  //    (no existence leak; ER-A3). reporterId is empty on a miss → ownsReport false.
  if (!ownsReport({ reporterId: reportDoc.f[reporterIdField.id]?.value })) {
    state.addErrorToStack(
      ERROR_CODES.NOT_REPORT_OWNER,
      "This report was not found, or it is not yours to act on."
    );
    return;
  }

  // 4. Concurrency + legality: the move must be legal from the CURRENT (just-read)
  //    status. Catches both an admin moving the report off RESOLVED and a double-
  //    click that already closed it — rejected and surfaced, not overwritten.
  const current = reportDoc.f[statusField.id]?.value || "";
  D.log({ message: "U-F10 accept: status read", data: { reportId, current } });
  if (!canTransition(current, STATUS.CLOSED_BY_USER, ACTOR_ROLE.REPORTER)) {
    state.addErrorToStack(
      ERROR_CODES.ILLEGAL_TRANSITION,
      "This report can no longer be accepted — its status has changed. Please reopen it to see the latest update."
    );
    D.log({
      message: "U-F10: accept rejected — illegal/stale transition",
      data: { reportId, current, to: STATUS.CLOSED_BY_USER },
    });
    return;
  }

  D.log({
    message: "U-F10 accept: transition legal",
    data: { reportId, current, to: STATUS.CLOSED_BY_USER },
  });

  // 5. Apply the transition. version advances monotonically (read → read+1).
  const now = Date.now();
  reportDoc.f[statusField.id].value = STATUS.CLOSED_BY_USER;
  reportDoc.f[versionField.id].value =
    Number(reportDoc.f[versionField.id]?.value || 0) + 1;
  reportDoc.f[updatedOnField.id].value = now;

  // One statusHistory row, same path/atomic with the report write (rule 12).
  appendStatusHistoryRow(reportDoc, {
    fromStatus: current,
    toStatus: STATUS.CLOSED_BY_USER,
    actorRole: ACTOR_ROLE.REPORTER,
  });

  // 6. Persist. save() re-runs reportDoc.onSave (the evidence/contact gate); the
  //    already-validated report passes. A gate abort adds to the error stack WITHOUT
  //    throwing — detect it the same way U-F8 does and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await saveDocWithSubCollections(reportDoc);
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not record your acceptance just now. Please try again."
    );
    D.log({
      message: "U-F10: report save failed on accept",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  D.log({
    message: "U-F10 accept: save success",
    data: { reportId, status: STATUS.CLOSED_BY_USER },
  });

  // 7. Post-save (rule 16): the MSG_REPORT_CLOSED sender is the X-series contract
  //    task, wired HERE after save(). Not built in U-F10 — do NOT invent it now.

  `Thank you. Your report **${reportId}** is now closed.\n\nWe're glad this could be resolved. Your identity has remained anonymous throughout, and the full timeline stays on record for you.`.sendResponse();

  // Re-render the detail so the UI reflects the closed state (status pill, the new
  // timeline row, and no further actions) WITHOUT reopening. Chain to openReportDetail.
  state.continueWithIntentWithIdAndMessage(INTENT.OPEN_REPORT_DETAIL, {
    payload: { reportId },
  });
};

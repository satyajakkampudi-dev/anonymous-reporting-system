// U-F11 — Reject resolution (RESOLVED -> REOPENED, reopen-capped, with a reason).
//
// Two halves of the documented "reason popup -> transition" flow (framework-mapping
// rule 29; sibling of the committed U-F10 accept-resolution.js):
//
//   1. rejectResolution.onResolution — the trigger intent. Independent intent
//      (Context B — object graph EMPTY on entry). Fired by the "Reject" button in the
//      detail-actions card (data-action="intent", intentId = rejectResolution,
//      data-payload {reportId}). The payload lives ONE LEVEL DEEP under
//      state.messageFromUser.payload (CLAUDE.md "Custom HTML Payloads"). It ATTACHES to
//      the existing context (Context.Create — Redis buffer, NO loadDocument: rule 22)
//      and runs a CHEAP pre-popup guard off the buffer (the report the reporter is
//      viewing was loaded by openReportDetail). If reject is legal, it stashes the
//      reportId, resets the capture Doc in place (rule 26 — never cloneAndInit) and
//      opens the reason popup. The pre-popup guard is UX/defence-in-depth only; the
//      AUTHORITATIVE guard is re-run on submit against a fresh MongoDB read.
//
//   2. rejectReasonDoc.onSubmit — the transition. On popup-confirm this re-reads the
//      report FRESH by reportId (the optimistic-concurrency guard, rule 12: `current`
//      is the latest persisted status, so a concurrent admin move or a double-click is
//      rejected, never overwritten), asserts ownership (no existence leak, ER-A3),
//      re-checks legality via canTransition(current, REOPENED, REPORTER) AND the reopen
//      cap (reopenCount < REOPEN_CAP, D10), then applies: status=REOPENED, version++,
//      reopenCount 0->1 ONCE, rejectReason = sanitised reason, updatedOn; appends ONE
//      statusHistory row (note = reason; actorRole = REPORTER, never an id — anonymity).
//      A true compare-and-swap via save(false, {reportId, version}) is UNSAFE here —
//      Doc.save() forces { upsert: true }, so a non-matching version query would INSERT
//      a corrupt duplicate; version is advanced monotonically (read -> read+1) so other
//      writers' guards and the audit trail stay coherent. Same reasoning as U-F10.
//
// No bot-to-bot/notification send here — MSG_REPORT_REOPENED is the X2 contract task,
// wired AFTER save() (rule 16). Do NOT invent the sender now.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { reportDoc, rejectReasonDoc } from "../docs/report-doc";
import {
  reporterIdField,
  statusField,
  versionField,
  reopenCountField,
  rejectReasonField,
  updatedOnField,
  assignedToField,
} from "../sections/report-details";
import { rejectReasonInputField } from "../sections/reject-reason";
import { appendStatusHistoryRow } from "./status-history-writer";
import { saveDocWithSubCollections } from "../../../lib/persist";
import { ownsReport, resolveAssignees } from "../../../lib/access";
import { sendBotMessage, resolvePeerBotId } from "../../../lib/notifications";
import { canTransition, STATUS } from "../../../lib/ticket-status";
import {
  ACTOR_ROLE,
  ERROR_CODES,
  REOPEN_CAP,
  MSG,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import { sanitiseText } from "../../../lib/validation";
import { INTENT, STATE_KEYS } from "../constants";

export const rejectResolution = Intent.Create({
  intentId: INTENT.REJECT_RESOLUTION,
  prompt: "Reject the resolution of a report and reopen it with a reason",
  state,
});

// Shared, reusable copy so the pre-popup guard and the authoritative submit guard
// surface the SAME message for the same condition (no leak, no drift).
const NOT_OWNER_MSG =
  "This report was not found, or it is not yours to act on.";
const ILLEGAL_MSG =
  "This report can no longer be reopened — its status has changed. Please refresh to see the latest update.";
const CAP_MSG =
  "You have already reopened this report once. If you still have concerns, please add an amendment or contact the compliance team.";

// X2 — emit the identity-free MSG_REPORT_REOPENED to the report's assigned admins in
// the admin app. `doc` is the LIVE, just-saved reportDoc; `reason` the sanitised reject
// reason. Payload carries ONLY { reportId, reopenCount, rejectReason } — NO reporterId /
// contact (rule 16). Recipients = resolveAssignees(report).adminUserId (routing
// chokepoint, honouring the report's live assignedTo). Best-effort + logged; NEVER
// throws into the reopen flow. Sibling of the X1 sender.
const sendReportReopenedMessage = async (reportId, doc, reason) => {
  try {
    if (!reportId) {
      D.log({ message: "X2: MSG_REPORT_REOPENED skipped — no reportId" });
      return;
    }
    const reopenCount = Number(doc.f[reopenCountField.id]?.value || 0);
    const payload = { reportId, reopenCount, rejectReason: reason };
    // resolveAssignees needs the live assignedTo to route to the right role.
    const assignees = await resolveAssignees({
      reportId,
      assignedTo: doc.f[assignedToField.id]?.value,
    });
    const userIds = (assignees || []).map((a) => a.adminUserId).filter(Boolean);
    if (!userIds.length) {
      D.log({
        message:
          "X2: MSG_REPORT_REOPENED — no assignees to deliver to (reopened only)",
        data: { reportId },
      });
      return;
    }
    const botId = await resolvePeerBotId(STATIC_DATA_KEYS.ADMIN_BOT_ID);
    await sendBotMessage({
      type: MSG.REPORT_REOPENED,
      payload,
      userIds,
      botId,
      userDomain: state.currentUserDomain,
    });
    D.log({
      message: "X2: MSG_REPORT_REOPENED sent",
      data: { reportId, reopenCount, recipients: userIds.length },
    });
  } catch (error) {
    D.log({
      message: "X2: MSG_REPORT_REOPENED send swallowed an error",
      data: { reportId, error: String(error) },
    });
  }
};

// --- 1. Trigger intent: guard off the buffer, then open the reason popup ---
rejectResolution.onResolution = async () => {
  // Payload lives under .payload (invoke_intent envelope), never the top level.
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for rejectResolution");
    return;
  }

  // Attach to the EXISTING context (Redis buffer) — NOT loadDocument (rule 22). The
  // report the reporter opened (openReportDetail) is already hydrated in the buffer.
  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportDoc.loadDocument({ reportId });

  // Cheap pre-popup guard (defence-in-depth beyond the hidden button; the card already
  // withholds Reject off-RESOLVED / past the cap). The AUTHORITATIVE re-read happens on
  // submit. Ownership FIRST — a non-owned/empty report yields the SAME message (ER-A3).
  if (!ownsReport({ reporterId: reportDoc.f[reporterIdField.id]?.value })) {
    state.addErrorToStack(ERROR_CODES.NOT_REPORT_OWNER, NOT_OWNER_MSG);
    return;
  }
  const status = reportDoc.f[statusField.id]?.value || "";
  if (!canTransition(status, STATUS.REOPENED, ACTOR_ROLE.REPORTER)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    return;
  }
  const reopenCount = Number(reportDoc.f[reopenCountField.id]?.value || 0);
  if (reopenCount >= REOPEN_CAP) {
    state.addErrorToStack(ERROR_CODES.REOPEN_CAP_REACHED, CAP_MSG);
    return;
  }

  // Stash the id for the submit handler (a separate invocation; survives via Redis).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  // Reset the REGISTERED capture Doc in place (rule 26 — never cloneAndInit). docId
  // FIRST, then clear values, so the cleared buffer targets the new empty path.
  rejectReasonDoc.docId = state.getUniqueId();
  for (const field of rejectReasonDoc.fields) {
    field.value = null;
  }
  rejectReasonDoc.title = "Reopen report";
  rejectReasonDoc.sendQuickFormResponse();
};

// --- 2. Persist handler: re-read fresh, re-guard, apply, append, save (rule 12) ---
rejectReasonDoc.onSubmit = async (self) => {
  // 1. Reason: mandatory + sanitised (rule 10 — strip markup; safe for HTML card +
  //    any email use). Reject a reason that sanitises to empty (markup-only / abuse).
  const reason = sanitiseText(self.f[rejectReasonInputField.id]?.value);
  if (!reason) {
    state.addErrorToStack(
      400,
      "Please tell us why you are reopening this report."
    );
    return;
  }

  // 2. Which report — stashed by onResolution (the popup submit is a fresh invocation).
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) {
    state.addSystemErrorToStack(
      500,
      "We lost track of which report you were reopening. Please reopen it from the report and try again."
    );
    return;
  }

  D.log({ message: "U-F11 reject: start", data: { reportId } });

  // 3. Re-read the report FRESH (the concurrency guard).
  await reportDoc.loadDocument({ reportId });

  // 4. Ownership FIRST — a non-owned/non-existent report yields the SAME message (no
  //    existence leak; ER-A3). reporterId is empty on a miss -> ownsReport false.
  if (!ownsReport({ reporterId: reportDoc.f[reporterIdField.id]?.value })) {
    state.addErrorToStack(ERROR_CODES.NOT_REPORT_OWNER, NOT_OWNER_MSG);
    return;
  }

  // 5. Concurrency + legality against the CURRENT (just-read) status. Catches an admin
  //    moving the report off RESOLVED and a double-confirm — rejected, not overwritten.
  const current = reportDoc.f[statusField.id]?.value || "";
  D.log({ message: "U-F11 reject: status read", data: { reportId, current } });
  if (!canTransition(current, STATUS.REOPENED, ACTOR_ROLE.REPORTER)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    D.log({
      message: "U-F11: reject rejected — illegal/stale transition",
      data: { reportId, current, to: STATUS.REOPENED },
    });
    return;
  }

  // 6. Reopen cap (D10) — re-checked against the FRESH count so a concurrent reopen
  //    cannot push it past one. The increment below happens exactly ONCE per report.
  const reopenCount = Number(reportDoc.f[reopenCountField.id]?.value || 0);
  if (reopenCount >= REOPEN_CAP) {
    state.addErrorToStack(ERROR_CODES.REOPEN_CAP_REACHED, CAP_MSG);
    D.log({
      message: "U-F11: reject rejected — reopen cap reached",
      data: { reportId, reopenCount },
    });
    return;
  }

  D.log({
    message: "U-F11 reject: transition legal",
    data: { reportId, current, to: STATUS.REOPENED, reopenCount },
  });

  // 7. Apply. version advances monotonically (read -> read+1); reopenCount 0 -> 1 once.
  const now = Date.now();
  reportDoc.f[statusField.id].value = STATUS.REOPENED;
  reportDoc.f[versionField.id].value =
    Number(reportDoc.f[versionField.id]?.value || 0) + 1;
  reportDoc.f[reopenCountField.id].value = reopenCount + 1;
  reportDoc.f[rejectReasonField.id].value = reason;
  reportDoc.f[updatedOnField.id].value = now;

  // 8. One statusHistory row, note = reason, same atomic write as the report (rule 12).
  //    loadDocument hydrated the embedded statusHistory rows (hasSubDocs path), so the
  //    append preserves the prior timeline rather than clobbering it (as in U-F10).
  appendStatusHistoryRow(reportDoc, {
    fromStatus: current,
    toStatus: STATUS.REOPENED,
    actorRole: ACTOR_ROLE.REPORTER,
    note: reason,
  });

  // 9. Persist. save() re-runs reportDoc.onSave (the evidence/contact gate); the
  //    already-validated report passes. A gate abort adds to the error stack WITHOUT
  //    throwing — detect it the way U-F8/U-F10 do and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await saveDocWithSubCollections(reportDoc);
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not reopen your report just now. Please try again."
    );
    D.log({
      message: "U-F11: report save failed on reject/reopen",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }
  D.log({
    message: "U-F11 reject: save success",
    data: { reportId, status: STATUS.REOPENED },
  });

  // 10. Post-save (rule 16): emit the identity-free MSG_REPORT_REOPENED to the report's
  //     assigned admins in the admin app (X2). Payload carries ONLY { reportId,
  //     reopenCount, rejectReason } — NO reporterId / contact (rule 16). reopenCount is
  //     the just-incremented value; rejectReason is the sanitised reason. Best-effort +
  //     logged; NEVER throws into the reopen flow (no admins / no botId / fault → logged
  //     no-op; the SLA digest / Alerts surface the reopened report).
  await sendReportReopenedMessage(reportId, reportDoc, reason);

  `Thank you. Your report **${reportId}** has been reopened and sent back to the compliance team for another look.\n\nYour reason has been added to the report's timeline. Your identity has remained anonymous throughout. Note that a report can be reopened only once.`.sendResponse();

  // Re-render the detail so the UI reflects the reopened state (status pill + new
  // timeline row) WITHOUT reopening the tab. Chain to openReportDetail.
  state.continueWithIntentWithIdAndMessage(INTENT.OPEN_REPORT_DETAIL, {
    payload: { reportId },
  });
};

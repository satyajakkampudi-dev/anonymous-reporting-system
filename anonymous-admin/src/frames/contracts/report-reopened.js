// X2 RECEIVER — MSG_REPORT_REOPENED (anonymous-user -> anonymous-admin).
//
// The RECEIVING half of the MSG_REPORT_REOPENED contract. The SENDER is the user app
// (reject-resolution.js U-F11) which, AFTER save() of the RESOLVED -> REOPENED transition,
// emits an identity-free { reportId, reopenCount, rejectReason } to the report's assigned
// admins via state.notification.sendMessageToUserInBot.
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry). Matched by
// onMatching === MSG.REPORT_REOPENED. The payload arrives under state.messageFromUser.
// Runs in SANDBOX mode (bot-to-bot); notifyAssignees' email/web-push are NOT sandboxed.
//
// LOAD BEFORE READING (rule 21). We re-read the report FRESH through the single admin
// gateway loadReportForAdmin({ reportId }) (ER-A3) — identity-free, adminProjection-
// stripped — and notify off THAT authoritative row, not the wire payload.
//
// ACTION (X2 acceptance criteria): notify the assigned admins (A-F15 notifyAssignees,
// NOTIFY_EVENT.REOPENED). No auto-escalate re-arm here — REOPENED is its own status with
// its own SLA path; X2 only surfaces the reopen to the admins handling it.
//
// ANONYMITY (rule 16/30). Payload identity-free by construction; gateway re-strips;
// notifyAssignees binds no reporter identity. rejectReason is reporter free-text that was
// already sanitised on the sender side (U-F11) — it is NOT surfaced by notifyAssignees
// (which builds its own identity-free descriptor), so it cannot leak into an admin email.
//
// BEST-EFFORT. Missing reportId / not-found / send fault → logged calm return. No
// sendResponse (no interactive user initiated this).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { loadReportForAdmin } from "../../../../lib/access";
import { MSG } from "../../../../lib/constants";
import { notifyAssignees, NOTIFY_EVENT } from "../admin-notify";

export const reportReopenedReceiver = Intent.Create({
  intentId: "reportReopenedReceiver",
  prompt: "Receive a reopened report from the reporter app",
  state,
});

reportReopenedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.REPORT_REOPENED;

reportReopenedReceiver.onResolution = async () => {
  // 1. Payload — { reportId, reopenCount, rejectReason }, identity-free. Trust reportId
  //    only as the key; re-read the rest.
  const { reportId } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message: "X2 receiver: MSG_REPORT_REOPENED missing reportId — ignored",
    });
    return;
  }

  // 2. Attach to the existing context (Redis buffer, in-memory in sandbox), then load
  //    FRESH through the single admin gateway (rule 21, ER-A3). Identity-free. Mirrors
  //    the job-receiver precedent (auto-close.js / auto-escalate.js).
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  let report;
  try {
    report = await loadReportForAdmin({ reportId });
  } catch (error) {
    D.log({
      message: "X2 receiver: loadReportForAdmin failed",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if (!report) {
    D.log({
      message: "X2 receiver: report not found on gateway load (no-op)",
      data: { reportId },
    });
    return;
  }

  // 3. Notify the assigned admins (A-F15, REOPENED). Best-effort — never throws.
  try {
    await notifyAssignees(
      {
        reportId: report.reportId,
        status: report.status,
        severity: report.severity,
        category: report.category,
        urgency: report.urgency,
        assignedTo: report.assignedTo,
        againstAdmin: !!report.againstAdmin,
        createdOn: report.createdOn,
      },
      { event: NOTIFY_EVENT.REOPENED }
    );
    D.log({
      message: "X2 receiver: reopened report notified",
      data: { reportId },
    });
  } catch (error) {
    D.log({
      message: "X2 receiver: notifyAssignees errored (ignored)",
      data: { reportId, error: String(error) },
    });
  }
};

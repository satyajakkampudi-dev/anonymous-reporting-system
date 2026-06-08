// X5 RECEIVER — MSG_REPORT_STATUS_CHANGED (anonymous-admin -> anonymous-user).
//
// THE ANONYMITY LINCHPIN (see report-resolved.js for the full rationale). The admin
// app holds NO reporterId (rule 30) and BROADCASTS this blind to EVERY user of the
// user bot (take-review.js A-F8 newStatus=UNDER_REVIEW; note-transition.js A-F10
// ESCALATED path — both AFTER save()). This receiver fires in EVERY reporter's
// context; the OWNERSHIP FILTER below is what prevents notifying the wrong reporter.
//
// INDEPENDENT INTENT (Context B). Matched by onMatching === MSG.REPORT_STATUS_CHANGED.
// Identity-free payload { reportId, newStatus } under state.messageFromUser. We do
// NOT trust newStatus for the copy — notifyReporter re-reads the freshly-loaded
// report's own status, so the wording always matches the persisted state.
//
// FLOW (rule 20/21):
//   1. reportId from the payload; missing -> silent no-op.
//   2. Context.Create attach, loadDocument({ reportId }) — load by id before reading.
//   3. OWNERSHIP FILTER — proceed only if reporterId === state.user.userId; otherwise
//      (different reporter / not found / MANUAL-CALL empty reporterId) silent no-op.
//   4. Owner -> notifyReporter(reportDoc, { event: STATUS_CHANGED }) on the reporter's
//      own channels.
//
// No sendResponse; best-effort throughout (NFR-4).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../../collections/reports";
import { reporterIdField } from "../../sections/report-details";
import { ownsReport } from "../../../../lib/access";
import { MSG } from "../../../../lib/constants";
import { notifyReporter } from "../reporter-notify";
import { NOTIFY_EVENT } from "../../constants";

export const reportStatusChangedReceiver = Intent.Create({
  intentId: "reportStatusChangedReceiver",
  prompt: "Receive a report status-change notice from the compliance app",
  state,
});

reportStatusChangedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.REPORT_STATUS_CHANGED;

reportStatusChangedReceiver.onResolution = async () => {
  const { reportId } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message:
        "X5 receiver: MSG_REPORT_STATUS_CHANGED missing reportId — ignored",
    });
    return;
  }

  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportDoc.loadDocument({ reportId });

  // OWNERSHIP FILTER — the anonymity linchpin.
  if (!ownsReport({ reporterId: reporterIdField.value })) {
    D.log({
      message: "X5 receiver: not the owning reporter — silent no-op",
      data: { reportId },
    });
    return;
  }

  try {
    await notifyReporter(reportDoc, { event: NOTIFY_EVENT.STATUS_CHANGED });
  } catch (error) {
    D.log({
      message: "X5 receiver: notifyReporter errored (ignored)",
      data: { reportId, error: String(error) },
    });
  }
};

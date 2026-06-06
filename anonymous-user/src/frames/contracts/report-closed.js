// X6 RECEIVER — MSG_REPORT_CLOSED (anonymous-admin -> anonymous-user).
//
// THE ANONYMITY LINCHPIN (see report-resolved.js for the full rationale). The admin
// app holds NO reporterId (rule 30) and BROADCASTS this blind to EVERY user of the
// user bot (auto-close.js A-F17 closeType=CLOSED_BY_SYSTEM; note-transition.js A-F11
// CLOSED_REJECTED path — both AFTER save()). This receiver fires in EVERY reporter's
// context; the OWNERSHIP FILTER below prevents notifying the wrong reporter.
//
// INDEPENDENT INTENT (Context B). Matched by onMatching === MSG.REPORT_CLOSED.
// Identity-free payload { reportId, closeType } under state.messageFromUser. We do
// NOT trust closeType for the copy — notifyReporter re-reads the freshly-loaded
// report's own status so the wording matches the persisted close state.
//
// FLOW (rule 20/21):
//   1. reportId from the payload; missing -> silent no-op.
//   2. Context.Create attach, loadDocument({ reportId }) — load by id before reading.
//   3. OWNERSHIP FILTER — proceed only if reporterId === state.user.userId; otherwise
//      (different reporter / not found / MANUAL-CALL empty reporterId) silent no-op.
//   4. Owner -> notifyReporter(reportDoc, { event: CLOSED }) on the reporter's own
//      channels.
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

export const reportClosedReceiver = Intent.Create({
  intentId: "reportClosedReceiver",
  prompt: "Receive a report-closed notice from the compliance app",
  state,
});

reportClosedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.REPORT_CLOSED;

reportClosedReceiver.onResolution = async () => {
  const { reportId } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message: "X6 receiver: MSG_REPORT_CLOSED missing reportId — ignored",
    });
    return;
  }

  await Context.Create(state.currentTabId, { state });
  await reportDoc.loadDocument({ reportId });

  // OWNERSHIP FILTER — the anonymity linchpin.
  if (!ownsReport({ reporterId: reporterIdField.value })) {
    D.log({
      message: "X6 receiver: not the owning reporter — silent no-op",
      data: { reportId },
    });
    return;
  }

  try {
    await notifyReporter(reportDoc, { event: NOTIFY_EVENT.CLOSED });
  } catch (error) {
    D.log({
      message: "X6 receiver: notifyReporter errored (ignored)",
      data: { reportId, error: String(error) },
    });
  }
};

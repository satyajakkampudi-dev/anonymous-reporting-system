// X4 RECEIVER — MSG_REPORT_RESOLVED (anonymous-admin -> anonymous-user).
//
// THE ANONYMITY LINCHPIN. The admin app holds NO reporterId (framework-mapping
// rule 30 — adminProjection strips it), so it CANNOT target the reporter with a
// directed send. Instead the admin BROADCASTS this message blind to EVERY user of
// the user bot (resolve-report.js A-F9, AFTER save()). This receiver therefore
// fires in EVERY reporter's context. The OWNERSHIP FILTER below is the only thing
// standing between "notify the right reporter" and "tell every reporter about a
// stranger's report" — it MUST gate the notify.
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry; CLAUDE.md
// "Invocation Lifecycle"). Matched by onMatching === MSG.REPORT_RESOLVED and
// nothing else. The identity-free payload { reportId, resolvedOn } arrives under
// state.messageFromUser (the bot-to-bot delivery slot).
//
// FLOW (rule 20/21):
//   1. Read reportId from the payload. Missing -> silent no-op.
//   2. Context.Create attach (Redis buffer), then loadDocument({ reportId }) — load
//      by id BEFORE reading (rule 21). The report is the SHARED `reports` row, so
//      every reporter's context can load it by id.
//   3. OWNERSHIP FILTER — proceed ONLY if the loaded report's reporterId ===
//      state.user.userId (ownsReport). The reporterId check is LEGITIMATE in the
//      USER app (it owns reporter scoping); it is the ADMIN app that must never
//      hold it. If this context is NOT the owner (different reporter, report not
//      found, or a MANUAL/CALL report whose empty reporterId can never equal a real
//      userId) -> SILENT no-op: do NOT notify, do NOT error, do NOT reveal anything.
//   4. Owner -> notifyReporter(reportDoc, { event: RESOLVED }) (U-F14) on the
//      reporter's OWN channels (web push + their own contact email).
//
// No sendResponse — no interactive user initiated this. Best-effort throughout; a
// dropped/failed notify is logged, never thrown (the in-app RESOLVED status the
// reporter sees on next open is the source of truth — NFR-4).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../../collections/reports";
import { reporterIdField } from "../../sections/report-details";
import { ownsReport } from "../../../../lib/access";
import { MSG } from "../../../../lib/constants";
import { notifyReporter } from "../reporter-notify";
import { NOTIFY_EVENT } from "../../constants";

export const reportResolvedReceiver = Intent.Create({
  intentId: "reportResolvedReceiver",
  prompt: "Receive a report-resolved notice from the compliance app",
  state,
});

reportResolvedReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.REPORT_RESOLVED;

reportResolvedReceiver.onResolution = async () => {
  const { reportId } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message: "X4 receiver: MSG_REPORT_RESOLVED missing reportId — ignored",
    });
    return;
  }

  await Context.CreateAndInit(`user_${state.getUniqueId()}`, { state });
  await reportDoc.loadDocument({ reportId });

  // OWNERSHIP FILTER — the anonymity linchpin. Only the owning reporter's context
  // proceeds; every other broadcast recipient silently no-ops.
  if (!ownsReport({ reporterId: reporterIdField.value })) {
    D.log({
      message: "X4 receiver: not the owning reporter — silent no-op",
      data: { reportId },
    });
    return;
  }

  try {
    await notifyReporter(reportDoc, { event: NOTIFY_EVENT.RESOLVED });
  } catch (error) {
    D.log({
      message: "X4 receiver: notifyReporter errored (ignored)",
      data: { reportId, error: String(error) },
    });
  }
};

// X1 RECEIVER — MSG_NEW_REPORT (anonymous-user -> anonymous-admin).
//
// The RECEIVING half of the MSG_NEW_REPORT contract. The SENDER is the user app
// (submit-report.js U-F8 + call-timeout.js U-F16) which, AFTER save(), emits an
// identity-free { reportId, category, urgency, severity, assignedTo, createdOn } to the
// report's assigned admins via state.notification.sendMessageToUserInBot.
//
// INDEPENDENT INTENT (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Matched by onMatching === MSG.NEW_REPORT and NOTHING else. The payload
// arrives under state.messageFromUser (the bot-to-bot delivery slot; docs:
// "payload becomes messageFromUser in receiver"). It runs in SANDBOX mode (bot-to-bot
// messages are processed sandboxed — setField/autoSaveBuffer are in-memory only), but the
// two side-effects this handler performs are NOT sandboxed: notifyAssignees sends real
// emails/web-push, and jobScheduler.scheduleMessage arms a real durable job.
//
// LOAD BEFORE READING (rule 21). The payload carries the reportId only as a trust anchor;
// we DO NOT trust the payload's other fields for the auto-escalate timing — we re-read the
// report FRESH through the SINGLE admin gateway loadReportForAdmin({ reportId }) (ER-A3),
// which returns an identity-free, adminProjection-stripped plain object. createdOn +
// severity for the SLA timer come from that authoritative read, not the wire.
//
// TWO ACTIONS (X1 acceptance criteria):
//   (a) notify the assigned admins (A-F15 notifyAssignees, NOTIFY_EVENT.NEW) — identity-free
//       descriptor built from the loaded projection row.
//   (b) arm the auto-escalate job (A-F16): scheduleMessage at createdOn + the SLA delay,
//       CRITICAL -> +1d, else +3d (D2); deterministic jobId `${AUTO_ESCALATE}-${reportId}`
//       so a duplicate MSG_NEW_REPORT (re-delivery) re-arms rather than stacks (ER-B8); the
//       scheduled payload is { reportId } ONLY (rule 30). toUser = state.user.userId — the
//       admin in whose context this receiver fires; A-F16 re-reads the report by id
//       regardless of whose context it runs in, so any stable admin id is correct, and the
//       receiving admin is a guaranteed-present, stable choice.
//
// ANONYMITY (rule 16/30). The payload is identity-free by construction (the sender strips
// it); the gateway load re-strips via adminProjection; notifyAssignees binds no reporter
// identity; the job payload is { reportId } only. Nothing here reads or echoes a reporter.
//
// BEST-EFFORT. A missing reportId / not-found report / send fault is logged and the
// handler returns calmly — a dropped cross-app message is caught by the SLA digest (A-F18)
// + Alerts backstop. No sendResponse (no interactive user initiated this).

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { loadReportForAdmin } from "../../../../lib/access";
import { MSG, SEVERITY, TIMING } from "../../../../lib/constants";
import { notifyAssignees, NOTIFY_EVENT } from "../admin-notify";
import { INTENT } from "../../constants";

export const newReportReceiver = Intent.Create({
  intentId: "newReportReceiver",
  prompt: "Receive a new anonymous report from the reporter app",
  state,
});

// Match ONLY the MSG_NEW_REPORT bot-to-bot type (docs: receiver matches on
// state.messageTypeFromUser === type).
newReportReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.NEW_REPORT;

newReportReceiver.onResolution = async () => {
  // 1. Payload — { reportId, category, urgency, severity, assignedTo, createdOn },
  //    identity-free. reportId is the only field we trust as a key; the rest is re-read.
  const { reportId } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message: "X1 receiver: MSG_NEW_REPORT missing reportId — ignored",
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
      message: "X1 receiver: loadReportForAdmin failed",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if (!report) {
    D.log({
      message: "X1 receiver: report not found on gateway load (no-op)",
      data: { reportId },
    });
    return;
  }

  // 3a. Notify the assigned admins (A-F15). Best-effort — notifyAssignees never throws.
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
      { event: NOTIFY_EVENT.NEW }
    );
  } catch (error) {
    D.log({
      message: "X1 receiver: notifyAssignees errored (ignored)",
      data: { reportId, error: String(error) },
    });
  }

  // 3b. Arm the auto-escalate job (A-F16). Delay by severity (D2): CRITICAL +1d, else +3d.
  //     Schedule from the report's authoritative createdOn (the SLA deadline is measured
  //     from creation); fall back to now if createdOn is missing so the timer still arms.
  //     Deterministic jobId per report → a re-delivered MSG_NEW_REPORT re-arms, never
  //     stacks (ER-B8). Payload { reportId } ONLY (rule 30). Best-effort + logged.
  try {
    const delayMs =
      report.severity === SEVERITY.CRITICAL
        ? TIMING.AUTO_ESCALATE_CRITICAL_MS
        : TIMING.AUTO_ESCALATE_DEFAULT_MS;
    const base = Number(report.createdOn) || Date.now();
    await state.jobScheduler.scheduleMessage({
      toUser: state.user.userId,
      jobId: `${INTENT.AUTO_ESCALATE}-${reportId}`,
      schedule: base + delayMs,
      messages: [{ intentId: INTENT.AUTO_ESCALATE, data: { reportId } }],
    });
    D.log({
      message: "X1 receiver: auto-escalate armed",
      data: { reportId, severity: report.severity, schedule: base + delayMs },
    });
  } catch (error) {
    // The SLA digest backstop (A-F18) catches an un-armed report — never throw.
    D.log({
      message: "X1 receiver: failed to arm auto-escalate (non-fatal)",
      data: { reportId, error: String(error) },
    });
  }
};

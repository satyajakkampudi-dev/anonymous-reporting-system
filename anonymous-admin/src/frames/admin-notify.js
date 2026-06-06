// A-F15 — Admin notification dispatch (reusable frame helper).
//
// The SINGLE reusable dispatch that notifies the admins a report is assigned to,
// over the routing chokepoint (resolveAssignees, lib/access — rule 14) and the
// best-effort senders (sendAdminEmail / sendAdminWebPush, lib/notifications — each
// already swallows + D.log's its own failure). Called by the post-save hooks of the
// admin transitions: the shared note-transition dispatcher (ESCALATED), auto-escalate
// (ESCALATED), and manual-log (NEW). The cross-app X1 (new) / X2 (reopened) receivers
// will call notifyAssignees when THEY are built — do NOT build X1/X2 here.
//
// BEST-EFFORT, NEVER THROWS (NFR-4, rule 16). Notification is a side-effect that runs
// AFTER save() — a failed email/push must never fail or roll back the transition that
// called it. Every send is wrapped (the lib senders already swallow, and we additionally
// guard the whole function) so notifyAssignees ALWAYS resolves. The SLA digest (A-F18)
// + in-app Alerts banner (A-D-alerts) are the fallback so a failed notification never
// means an unseen report (ER-D15, ER-B7).
//
// ANONYMITY (rule 16/30). The descriptor and all content are IDENTITY-FREE: reportId,
// status, severity, category, urgency, age, and the ADMIN's OWN adminEmail/adminUserId
// (resolved by resolveAssignees). NEVER reporterId / contactMethod / contactValue. The
// caller builds the descriptor from adminReportDoc's bound fields (which declare no
// reporter identity — rule 30), so nothing here can read a reporter. The push `data`
// carries { reportId } ONLY. Every HTML interpolation passes through escapeHtml.
//
// CROSS-ADMIN FAILURE RECORDING. A failure is recorded into a DURABLE, CROSS-ADMIN
// sharedField (SHARED_KEYS.NOTIFICATION_FAILURES) — failures happen in whichever admin's
// invocation the transition fired in, so a per-conversation field cannot carry them to
// the admin who later views the Alerts banner. The shape { reportId, failedOn } matches
// the A-D-alerts consumer verbatim.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { resolveAssignees } from "../../../lib/access";
import { sendAdminEmail, sendAdminWebPush } from "../../../lib/notifications";
import {
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  URGENCY_LABELS,
} from "../../../lib/constants";
import { statusLabel } from "../../../lib/ticket-status";
import { escapeHtml, formatRelative } from "../../../lib/utils/format";
import { SHARED_KEYS, NOTIFICATION_FAILURE_TTL_SECONDS } from "../constants";

// The notify-worthy events this dispatch knows about — drives subject/body wording.
// NEW: a freshly-created report reached its assigned admins (manual-log; later X1).
// REOPENED: a resolved report the reporter rejected (later X2). ESCALATED: routed to
// the secondary compliance admins (manual + auto escalate).
export const NOTIFY_EVENT = {
  NEW: "NEW",
  REOPENED: "REOPENED",
  ESCALATED: "ESCALATED",
};

// Human-readable (British English) lead-in per event. Identity-free.
const EVENT_COPY = {
  [NOTIFY_EVENT.NEW]: {
    verb: "assigned to you",
    subject: "New report assigned",
    lead: "A new report has been assigned to your compliance queue.",
  },
  [NOTIFY_EVENT.REOPENED]: {
    verb: "reopened",
    subject: "Report reopened",
    lead: "A report has been reopened and needs your attention.",
  },
  [NOTIFY_EVENT.ESCALATED]: {
    verb: "escalated to you",
    subject: "Report escalated",
    lead: "A report has been escalated to the secondary compliance team.",
  },
};

// Safe label lookups (fall back to the raw token / em-dash for an unknown value;
// never throw on a missing/legacy enum value).
const severityLabel = (token) => SEVERITY_LABELS[token] || token || "—";
const categoryLabel = (token) => CATEGORY_LABELS[token] || token || "—";
const urgencyLabel = (token) => URGENCY_LABELS[token] || token || "—";

// "age" — relative time since creation (identity-free). Falls back to em-dash.
const ageLabel = (createdOn) => formatRelative(createdOn) || "—";

// Build the identity-free email HTML body. Every interpolation is escaped (rule 10).
const buildEmailHtml = (report, copy) => {
  const rows = [
    ["Tracking ID", report.reportId],
    ["Status", statusLabel(report.status)],
    ["Severity", severityLabel(report.severity)],
    ["Category", categoryLabel(report.category)],
    ["Urgency", urgencyLabel(report.urgency)],
    ["Age", ageLabel(report.createdOn)],
  ]
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;">${escapeHtml(
          label
        )}</td>` +
        `<td style="padding:4px 0;font-size:13px;font-weight:600;">${escapeHtml(
          value
        )}</td>` +
        `</tr>`
    )
    .join("");

  return (
    `<div style="font-family:system-ui,Arial,sans-serif;color:#1f2937;">` +
    `<p style="font-size:14px;">${escapeHtml(copy.lead)}</p>` +
    `<table style="border-collapse:collapse;margin:8px 0;">${rows}</table>` +
    `<p style="font-size:12px;color:#6b7280;">Open the compliance app to action this report. ` +
    `This message contains no information that could identify the reporter.</p>` +
    `</div>`
  );
};

// Record a notification failure into the durable, cross-admin sharedField (ER-D15).
// Append-only with a TTL; defensive against a non-array existing value or a thrown
// Redis read/write (a recording failure must itself never throw — log and move on).
const recordFailure = async (reportId) => {
  const failedOn = Date.now();
  try {
    const existing = await state.getSharedField(
      SHARED_KEYS.NOTIFICATION_FAILURES
    );
    const list = Array.isArray(existing) ? existing : [];
    list.push({ reportId, failedOn });
    await state.setSharedField(
      SHARED_KEYS.NOTIFICATION_FAILURES,
      list,
      NOTIFICATION_FAILURE_TTL_SECONDS
    );
  } catch (error) {
    D.log({
      message: "A-F15: failed to record notification failure to sharedField",
      data: { reportId, error: String(error) },
    });
  }
  D.log({
    message: "A-F15: notification failure recorded (Alerts/digest fallback)",
    data: { reportId, failedOn },
  });
};

// Notify the admins a report is assigned to. BEST-EFFORT — always resolves, NEVER throws.
//
//   report  — IDENTITY-FREE descriptor built by the caller from adminReportDoc bound
//             fields: { reportId, status, severity, category, urgency, assignedTo,
//             againstAdmin, createdOn }. NEVER reporterId / contact (rule 16/30).
//   event   — one of NOTIFY_EVENT.* — drives subject/body wording.
//
// Returns a small summary { recipients, emailFailures, pushFailures, anyFailure } so the
// caller can log it. recipients = resolveAssignees(report) (the chokepoint; now honours
// the LIVE assignedTo, so escalation notifies the secondary admins).
export const notifyAssignees = async (report, { event } = {}) => {
  const summary = {
    recipients: 0,
    emailFailures: 0,
    pushFailures: 0,
    anyFailure: false,
  };

  try {
    const reportId = report && report.reportId;
    const copy = EVENT_COPY[event] || EVENT_COPY[NOTIFY_EVENT.NEW];

    if (!reportId) {
      // Defensive — a descriptor with no reportId cannot be acted on. Loud log, no throw.
      D.log({
        message: "A-F15: notifyAssignees called with no reportId",
        data: { event },
      });
      return summary;
    }

    let recipients = [];
    try {
      recipients = await resolveAssignees(report);
    } catch (error) {
      // resolveAssignees does a MongoDB read — a thrown read (poor maritime link) is a
      // notification failure, recorded so the fallback catches it. Never throw.
      D.log({
        message: "A-F15: resolveAssignees failed",
        data: { reportId, event, error: String(error) },
      });
      await recordFailure(reportId);
      summary.anyFailure = true;
      return summary;
    }

    // EMPTY registry for a notify-worthy event → loud log, never silent (ER-B7). The SLA
    // digest + in-app Alerts are the backstop. Do NOT throw, do NOT record a per-report
    // failure (there is no send to fail — the absence is a configuration gap the digest
    // surfaces). resolveAssignees already logs the "no GLOBAL admins" case; add the
    // notify-context line so the gap is unmissable in operations logging.
    if (!recipients.length) {
      D.log({
        message:
          "A-F15: no assignees for a notify-worthy event — nothing sent (SLA digest + Alerts are the fallback, ER-B7)",
        data: { reportId, event, assignedTo: report.assignedTo },
      });
      return summary;
    }

    summary.recipients = recipients.length;

    const subject = `${copy.subject} — ${reportId}`;
    const html = buildEmailHtml(report, copy);
    const title = copy.subject;
    const message = `Report ${reportId} has been ${copy.verb}.`;

    // For EACH recipient: best-effort email AND push, each wrapped so one failure never
    // aborts the rest. The lib senders already swallow + log; we read the { ok } result to
    // record a durable failure for the Alerts/digest fallback (ER-D15).
    for (const recipient of recipients) {
      let recipientFailed = false;

      try {
        const emailResult = await sendAdminEmail({
          to: recipient.adminEmail,
          subject,
          html,
        });
        if (!emailResult || !emailResult.ok) {
          summary.emailFailures += 1;
          recipientFailed = true;
        }
      } catch (error) {
        // The lib sender should not throw, but guard anyway — best-effort.
        summary.emailFailures += 1;
        recipientFailed = true;
        D.log({
          message: "A-F15: sendAdminEmail threw unexpectedly",
          data: { reportId, event, error: String(error) },
        });
      }

      try {
        const pushResult = await sendAdminWebPush({
          userId: recipient.adminUserId,
          title,
          message,
          data: { reportId },
        });
        if (!pushResult || !pushResult.ok) {
          summary.pushFailures += 1;
          recipientFailed = true;
        }
      } catch (error) {
        summary.pushFailures += 1;
        recipientFailed = true;
        D.log({
          message: "A-F15: sendAdminWebPush threw unexpectedly",
          data: { reportId, event, error: String(error) },
        });
      }

      if (recipientFailed) {
        summary.anyFailure = true;
      }
    }

    // Record ONE durable failure entry per report when any send for it failed — the
    // Alerts banner counts reports that could not be fully notified, not individual sends
    // (ER-D15). recordFailure is itself best-effort.
    if (summary.anyFailure) {
      await recordFailure(reportId);
    }

    D.log({
      message: "A-F15: notifyAssignees complete",
      data: { reportId, event, ...summary },
    });
    return summary;
  } catch (error) {
    // Absolute backstop — notifyAssignees must NEVER throw into the transition (rule 16).
    D.log({
      message: "A-F15: notifyAssignees swallowed an unexpected error",
      data: { event, error: String(error) },
    });
    summary.anyFailure = true;
    return summary;
  }
};

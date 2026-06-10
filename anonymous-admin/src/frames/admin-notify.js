// A-F15 - Admin notification dispatch (reusable frame helper).
//
// The SINGLE reusable dispatch that notifies the admins a report is assigned to,
// over the routing chokepoint (resolveAssignees, lib/access - rule 14) and the
// best-effort senders (sendAdminEmail / sendPushToCurrentUser, lib/notifications - each
// already swallows + D.log's its own failure). Called by the post-save hooks of the
// admin transitions: the shared note-transition dispatcher (ESCALATED), auto-escalate
// (ESCALATED), and manual-log (NEW). The cross-app X1 (new) / X2 (reopened) receivers
// will call notifyAssignees when THEY are built - do NOT build X1/X2 here.
//
// BEST-EFFORT, NEVER THROWS (NFR-4, rule 16). Notification is a side-effect that runs
// AFTER save() - a failed email/push must never fail or roll back the transition that
// called it. Every send is wrapped (the lib senders already swallow, and we additionally
// guard the whole function) so notifyAssignees ALWAYS resolves. The SLA digest (A-F18)
// + in-app Alerts banner (A-D-alerts) are the fallback so a failed notification never
// means an unseen report (ER-D15, ER-B7).
//
// ANONYMITY (rule 16/30). The descriptor and all content are IDENTITY-FREE: reportId,
// status, severity, category, urgency, age, and the ADMIN's OWN adminEmail/adminUserId
// (resolved by resolveAssignees). NEVER reporterId / contactMethod / contactValue. The
// caller builds the descriptor from adminReportDoc's bound fields (which declare no
// reporter identity - rule 30), so nothing here can read a reporter. The push `data`
// carries { reportId } ONLY. Every HTML interpolation passes through escapeHtml.
//
// CROSS-ADMIN FAILURE RECORDING. A failure is recorded into a DURABLE, CROSS-ADMIN
// sharedField (SHARED_KEYS.NOTIFICATION_FAILURES) - failures happen in whichever admin's
// invocation the transition fired in, so a per-conversation field cannot carry them to
// the admin who later views the Alerts banner. The shape { reportId, failedOn } matches
// the A-D-alerts consumer verbatim.

import { D, state } from "@frontmltd/frontmjs/core/State";
import {
  resolveAssignees,
  loadReportForAdmin,
  resolveAdminIdentity,
} from "../../../lib/access";
import {
  sendAdminEmail,
  sendPushToCurrentUser,
  sendBotMessage,
} from "../../../lib/notifications";
import {
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  URGENCY_LABELS,
  MSG,
} from "../../../lib/constants";
import { statusLabel } from "../../../lib/ticket-status";
import { escapeHtml, formatRelative } from "../../../lib/utils/format";
import { renderEmail } from "../../../lib/email-template";
import {
  SHARED_KEYS,
  STATE_KEYS,
  NOTIFICATION_FAILURE_TTL_SECONDS,
} from "../constants";

// The notify-worthy events this dispatch knows about - drives subject/body wording.
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
const severityLabel = (token) => SEVERITY_LABELS[token] || token || "-";
const categoryLabel = (token) => CATEGORY_LABELS[token] || token || "-";
const urgencyLabel = (token) => URGENCY_LABELS[token] || token || "-";

// "age" - relative time since creation (identity-free). Falls back to em-dash.
const ageLabel = (createdOn) => formatRelative(createdOn) || "-";

// Build the identity-free email HTML body via the shared renderEmail shell (framework-
// mapping rule 33): text wordmark, table layout, inline styles, no tracking pixel / no
// images. renderEmail escapes the row label/value (the single chokepoint), so the rows
// are passed as plain { label, value }; copy.lead is escaped here (caller-supplied HTML).
const buildEmailHtml = (report, copy) =>
  renderEmail({
    title: copy.subject,
    introHtml: `<p style="margin:0;">${escapeHtml(copy.lead)}</p>`,
    rows: [
      { label: "Tracking ID", value: report.reportId },
      { label: "Status", value: statusLabel(report.status) },
      { label: "Severity", value: severityLabel(report.severity) },
      { label: "Category", value: categoryLabel(report.category) },
      { label: "Urgency", value: urgencyLabel(report.urgency) },
      { label: "Age", value: ageLabel(report.createdOn) },
    ],
    footerHtml:
      "Open the compliance app to action this report. This message contains no information that could identify the reporter.",
  });

// Record a notification failure into the durable, cross-admin sharedField (ER-D15).
// Append-only with a TTL; defensive against a non-array existing value or a thrown
// Redis read/write (a recording failure must itself never throw - log and move on).
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

// A-F19 bridge (MP-FIX-ALERTS-FAILURE-BRIDGE). recordFailure (above) APPENDS to the
// DURABLE cross-admin sharedField SHARED_KEYS.NOTIFICATION_FAILURES; the alerts
// renderer reads the SYNCHRONOUS render stash STATE_KEYS.NOTIFICATION_FAILURES
// (section.onResponse is not awaited, so it cannot read the async sharedField itself).
// This helper bridges the two: read the shared list, drop entries older than the TTL
// (defensive - Redis TTL covers whole-field expiry, not per-entry), and write the
// render stash. MUST run in a Context-B handler (app-start) BEFORE
// adminDisplayDoc.sendResponse(). Best-effort: a thrown read leaves the stash empty
// and logs (NFR-4) - never blocks the dashboard render. Identity-free: { reportId,
// failedOn } only (rule 30).
export const hydrateNotificationFailureStash = async () => {
  try {
    const shared = await state.getSharedField(
      SHARED_KEYS.NOTIFICATION_FAILURES
    );
    const list = Array.isArray(shared) ? shared : [];
    const cutoff = Date.now() - NOTIFICATION_FAILURE_TTL_SECONDS * 1000;
    const fresh = list.filter((f) => f && f.reportId && f.failedOn >= cutoff);
    state.setField(STATE_KEYS.NOTIFICATION_FAILURES, fresh);
  } catch (error) {
    D.log({
      message: "A-F19: hydrateNotificationFailureStash failed",
      data: { error: String(error) },
    });
    state.setField(STATE_KEYS.NOTIFICATION_FAILURES, []);
  }
};

// notifySelf - push (mobile+web) + email to the recipient admin whose session THIS
// invocation runs as (framework-mapping rule 32). Used by the X1/X2 receivers (already
// in the recipient's session) and by adminNotifyReceiver (the MSG_ADMIN_NOTIFY landing).
// BEST-EFFORT - always resolves, NEVER throws.
//
//   reportId - the report key. The descriptor is re-read FRESH through the single admin
//              gateway (loadReportForAdmin - identity-free, adminProjection-stripped),
//              NOT trusted from any payload (rule 21/ER-A3).
//   event    - one of NOTIFY_EVENT.* - drives subject/body wording.
//
// Push goes to the CURRENT user's own conversation (sendPushToCurrentUser → mobile+web).
// Email goes to the caller's OWN seeded admin address (resolveAdminIdentity; fallback to
// their account email). A send fault records ONE durable failure for the Alerts/digest
// fallback (ER-D15). Identity-free throughout (push data { reportId } only - rule 16/30).
export const notifySelf = async ({ reportId, event } = {}) => {
  if (!reportId) {
    D.log({
      message: "A-F15: notifySelf called with no reportId",
      data: { event },
    });
    return { ok: false };
  }

  const copy = EVENT_COPY[event] || EVENT_COPY[NOTIFY_EVENT.NEW];

  try {
    const report = await loadReportForAdmin({ reportId });
    if (!report) {
      D.log({
        message: "A-F15: notifySelf - report not found on gateway load (no-op)",
        data: { reportId, event },
      });
      return { ok: false };
    }

    const subject = `${copy.subject} - ${reportId}`;
    const html = buildEmailHtml(report, copy);
    const title = copy.subject;
    const message = `Report ${reportId} has been ${copy.verb}.`;

    // Mobile + web push to self (the recipient's own conversation).
    const pushResult = await sendPushToCurrentUser({
      title,
      message,
      data: { reportId },
    });

    // Email to the recipient's OWN seeded admin address (their identity is permitted to
    // read here - it is the caller's, never a reporter's; rule 30). Fallback: account email.
    const self = await resolveAdminIdentity();
    const to = (self && self.adminEmail) || state.user?.emailAddress || "";
    const emailResult = await sendAdminEmail({ to, subject, html });

    const anyFailure = !pushResult?.ok || !emailResult?.ok;
    if (anyFailure) {
      await recordFailure(reportId);
    }
    D.log({
      message: "A-F15: notifySelf dispatched",
      data: {
        reportId,
        event,
        pushOk: !!pushResult?.ok,
        emailOk: !!emailResult?.ok,
      },
    });
    return { ok: !anyFailure };
  } catch (error) {
    // Absolute backstop - notifySelf must NEVER throw into the receiver (rule 16).
    D.log({
      message: "A-F15: notifySelf swallowed an unexpected error",
      data: { reportId, event, error: String(error) },
    });
    await recordFailure(reportId);
    return { ok: false };
  }
};

// dispatchAdminNotify - used by callers whose ACTING context is NOT the recipient's:
// escalate (note-transition), auto-escalate (scheduled job, no user session), manual-log.
// Resolves the report's assignees (chokepoint - honours the LIVE assignedTo) and sends an
// intra-admin-bot MSG_ADMIN_NOTIFY { reportId, event } to their userIds. adminNotifyReceiver
// then runs in EACH recipient's own session and notifySelf's (mobile+web push + email). This
// is the ONLY way a session-less job can reach admins on mobile (framework-mapping rule 32).
// BEST-EFFORT - never throws into the transition. Same (report, { event }) call shape as the
// former notifyAssignees, so callers only change the function name.
export const dispatchAdminNotify = async (report, { event } = {}) => {
  try {
    const reportId = report && report.reportId;
    if (!reportId) {
      D.log({
        message: "A-F15: dispatchAdminNotify called with no reportId",
        data: { event },
      });
      return;
    }

    let recipients = [];
    try {
      recipients = await resolveAssignees(report);
    } catch (error) {
      // resolveAssignees does a MongoDB read - a thrown read is a notification failure,
      // recorded so the Alerts/digest fallback catches it. Never throw.
      D.log({
        message: "A-F15: dispatchAdminNotify - resolveAssignees failed",
        data: { reportId, event, error: String(error) },
      });
      await recordFailure(reportId);
      return;
    }

    const userIds = (recipients || [])
      .map((r) => r.adminUserId)
      .filter(Boolean);
    if (!userIds.length) {
      // EMPTY registry for a notify-worthy event → loud log, never silent (ER-B7). The SLA
      // digest + Alerts are the backstop; no per-report failure (no send to fail).
      D.log({
        message:
          "A-F15: dispatchAdminNotify - no assignees (SLA digest + Alerts are the fallback, ER-B7)",
        data: { reportId, event, assignedTo: report.assignedTo },
      });
      return;
    }

    // Same-bot message: OMIT botId so sendMessageToUserInBot defaults to the CURRENT
    // (admin) bot - the documented default and the proven X7 precedent (sendCallStopRing
    // is called with no toBotId). This is reliable in the scheduled-job context too (no
    // dependence on state.botId being set, no ADMIN_BOT_ID static-data dependency).
    await sendBotMessage({
      type: MSG.ADMIN_NOTIFY,
      payload: { reportId, event },
      userIds,
      userDomain: state.currentUserDomain,
    });
    D.log({
      message: "A-F15: dispatchAdminNotify sent MSG_ADMIN_NOTIFY",
      data: { reportId, event, recipients: userIds.length },
    });
  } catch (error) {
    D.log({
      message: "A-F15: dispatchAdminNotify swallowed an unexpected error",
      data: { event, error: String(error) },
    });
  }
};

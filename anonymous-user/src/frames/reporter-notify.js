// U-F14 — Reporter notification dispatch (reusable helper).
//
// A single reusable function — notifyReporter(reportDoc, { event }) — that
// notifies the reporter that something happened to THEIR report. It is NOT an
// intent and registers no framework events: it is a plain async helper composed
// from the lib/notifications.js best-effort primitives (NFR-4). Callers:
//   - the inbound cross-app receivers X4 / X5 / X6 (Context B): each loads the
//     report by reportId, then calls this with the matching NOTIFY_EVENT;
//   - any reporter-side own-action frame that later opts to acknowledge (e.g. a
//     RECEIVED ack on submit) — wired by that task, not here.
//
// Two channels, both BEST-EFFORT + LOGGED (a failed send never throws and never
// goes silent; the SLA digest / Alerts screen are the fallback — NFR-4):
//   1. Web push, addressed by the reporter's FrontM userId (= reporterId). This
//      is the in-app channel the reporter uses to track their own report, so it
//      is sent whenever a reporterId exists, independent of the contact-method
//      choice (which governs only the OUT-of-band channel).
//   2. Email, sent ONLY when the reporter chose Email as their contact method
//      AND supplied a valid address. Phone / Cabin / None have no programmatic
//      out-of-band channel here, so those reporters rely on web push alone.
//
// ANONYMITY (framework-mapping rule 16; acceptance criterion):
//   - The notification CONTENT carries nothing beyond what the reporter already
//     owns — the reportId and the report's own status. No resolution text, no
//     accused party, no evidence, no actor identity.
//   - The push `data` payload carries reportId only (so a tap can deep-link).
//   - The email `to` is the reporter's OWN address (their contactValue); we
//     never look up an account and never send reporter identity to a third party.
//   - A MANUAL / CALL report has no reporterId (no tracking owner) → no reporter
//     notification at all (logged skip).

import { D } from "@frontmltd/frontmjs/core/State";
import {
  reportIdField,
  reporterIdField,
  statusField,
} from "../sections/report-details";
import { contactMethodField, contactValueField } from "../sections/contact";
import {
  sendReporterEmail,
  sendPushToCurrentUser,
} from "../../../lib/notifications";
import { statusLabel } from "../../../lib/ticket-status";
import { CONTACT_METHOD, contactMethodFromLabel } from "../../../lib/constants";
import { isValidEmail } from "../../../lib/validation";
import { escapeHtml } from "../../../lib/utils/format";
import { renderEmail } from "../../../lib/email-template";
import { NOTIFY_EVENT } from "../constants";

// Build the (identity-free) copy for an event. `statusText` is the live status
// label of the freshly-loaded report — so the wording always matches the
// persisted state even if the triggering event was coarse. Returns a plain
// title + body for push and a subject + (escaped) HTML for email.
const buildCopy = (event, reportId, statusText) => {
  const safeId = escapeHtml(reportId);
  const safeStatus = escapeHtml(statusText);
  // The email body goes through the shared renderEmail shell (framework-mapping
  // rule 33): text wordmark, table layout, inline styles, no tracking pixel / no
  // images, identity-free. `lead` is static copy; safeId/safeStatus are escaped.
  const buildHtml = (title, lead) =>
    renderEmail({
      title,
      introHtml:
        `<p style="margin:0 0 12px 0;">${lead}</p>` +
        `<p style="margin:0;">Your report <strong>${safeId}</strong> is now <strong>${safeStatus}</strong>.</p>`,
      footerHtml:
        "Open the Anonymous Reporting app to view the full timeline. Your identity has remained anonymous throughout.",
    });

  switch (event) {
    case NOTIFY_EVENT.RECEIVED:
      return {
        title: "Report received",
        message: `Your report ${reportId} has been received.`,
        subject: `Your report ${reportId} has been received`,
        html: buildHtml(
          "Report received",
          "Thank you — your report has been received by the compliance team."
        ),
      };
    case NOTIFY_EVENT.RESOLVED:
      return {
        title: "Report resolved",
        message: `Your report ${reportId} has been resolved — please review the outcome.`,
        subject: `Your report ${reportId} has been resolved`,
        html: buildHtml(
          "Report resolved",
          "The compliance team has added a resolution to your report. Please review the outcome and let us know whether it addresses your concern."
        ),
      };
    case NOTIFY_EVENT.CLOSED:
      return {
        title: "Report closed",
        message: `Your report ${reportId} has been closed (${statusText}).`,
        subject: `Your report ${reportId} has been closed`,
        html: buildHtml("Report closed", "Your report has been closed."),
      };
    case NOTIFY_EVENT.STATUS_CHANGED:
    default:
      return {
        title: "Report update",
        message: `Your report ${reportId} is now ${statusText}.`,
        subject: `An update on your report ${reportId}`,
        html: buildHtml(
          "Report update",
          "There has been an update to your report."
        ),
      };
  }
};

// Notify the reporter about their own report. `reportDoc` MUST already be loaded
// (the X4/X5/X6 receivers loadDocument({ reportId }) in Context B before calling).
// Best-effort: never throws; always logs a one-line summary. Returns the per-
// channel outcome so a caller could branch, though callers normally ignore it.
export const notifyReporter = async (reportDoc, { event } = {}) => {
  const reportId = reportDoc?.f[reportIdField.id]?.value;
  const reporterId = reportDoc?.f[reporterIdField.id]?.value;
  const status = reportDoc?.f[statusField.id]?.value || "";

  // Defensive: no report loaded → nothing to do (should not happen — callers load
  // by id first). Logged, not thrown (NFR-4).
  if (!reportId) {
    D.log({
      message: "U-F14: notifyReporter skipped — no reportId on the loaded doc",
      data: { event },
    });
    return { ok: false, push: false, email: false };
  }

  // MANUAL / CALL reports have no tracking owner (reporterId empty) — there is
  // nobody to notify and no in-app account to push to. Logged skip.
  if (!reporterId) {
    D.log({
      message:
        "U-F14: notifyReporter skipped — report has no reporterId (MANUAL/CALL)",
      data: { reportId, event, status },
    });
    return { ok: false, push: false, email: false };
  }

  const copy = buildCopy(event, reportId, statusLabel(status));

  // 1. Push — mobile + web (framework-mapping rule 32). notifyReporter ALWAYS runs in
  //    the reporter's own session (submit onSubmit; X4/X5/X6 receivers), so push-to-self
  //    reaches their device AND browser. `data` carries reportId only (identity-free).
  const pushResult = await sendPushToCurrentUser({
    title: copy.title,
    message: copy.message,
    data: { reportId },
  });

  // 2. Email — only when the reporter chose Email AND gave a valid address. The
  //    stored contactMethod is a LABEL ("Email"); map it to a token before the
  //    comparison (contactMethodFromLabel; idempotent for token-valued rows).
  const method = contactMethodFromLabel(
    reportDoc?.f[contactMethodField.id]?.value
  );
  const contactValue = reportDoc?.f[contactValueField.id]?.value;
  let emailResult = { ok: false };
  const wantsEmail =
    method === CONTACT_METHOD.EMAIL && isValidEmail(contactValue);
  if (wantsEmail) {
    emailResult = await sendReporterEmail({
      to: contactValue,
      subject: copy.subject,
      html: copy.html,
    });
  }

  D.log({
    message: "U-F14: reporter notification dispatched",
    data: {
      reportId,
      event,
      status,
      pushOk: !!pushResult?.ok,
      emailAttempted: wantsEmail,
      emailOk: !!emailResult?.ok,
    },
  });

  return {
    ok: !!pushResult?.ok || !!emailResult?.ok,
    push: !!pushResult?.ok,
    email: !!emailResult?.ok,
  };
};

// U-F8 — Submit-time transforms + idempotency (reportDoc.onSubmit).
//
// Context A (framework event on reportDoc — object graph LIVE; handler lives in
// frames/ per AGENTS.md so it can import Field refs from sections/). Fires when the
// reporter confirms the submit form (reportDoc rendered by openSubmitReport). The
// AUTHORITATIVE validation gate is reportDoc.onSave (report-validation.js: evidence
// U-F6 + contact U-F7); this handler does the SUBMIT TRANSFORMS, then self.save()
// (which runs that gate), then — on success — gives the reporter their tracking ID.
//
// Order inside onSubmit:
//   1. Sanitise all free-text (rule 10) — strip markup before it can reach an HTML
//      card or email. Reject a description that sanitises to empty.
//   2. Map the category/urgency/location DROPDOWN labels → stable tokens (lib +
//      every Display renderer are token-based; the dropdowns render labels).
//   3. Validate incidentDate: parseable AND not in the future — abort before any id
//      work (lib/validation.isValidIncidentDate).
//   4. Set system fields IDEMPOTENTLY (status=OPEN, createdOn, source=REPORTER,
//      reporterId, version=1, reopenCount=0, severity from urgency D6, assignedTo via
//      the routing chokepoint assignedRoleFor D17, updatedOn). Every field is set
//      only-if-unset (except updatedOn) so a re-submit of the SAME autosaved draft is
//      a no-op UPDATE — this is the debounce/idempotency for double-submit (the PK
//      reportId is reused, so save() upserts the same row, never a duplicate) AND it
//      means a re-open of an already-triaged draft can never clobber an admin-set
//      severity / status. (The proper fresh-draft reset on submit is a deferred task
//      — see nav-submit-report.js; the idempotent guards make the interim safe.)
//   5. Append the FIRST statusHistory row (→ OPEN, REPORTER) via the transition path
//      (rule 12), idempotently — only if no OPEN/REPORTER row exists yet, so a
//      resubmit after a validation failure cannot stack a second creation row.
//   6. Persist with retry-on-collision (ER-B9): regenerate reportId + retry only on a
//      genuine duplicate-key error. save() can also abort WITHOUT throwing when the
//      onSave gate adds a validation error and returns — detect that via the error
//      stack growing, and do NOT show success.
//   7. Post-save (rule 16): the X1 contract task wires the identity-free
//      MSG_NEW_REPORT sender HERE, AFTER save(). Not built in U-F8 (X1 depends on
//      U-F8) — do NOT invent the sender now.
//   8. Confirm to the reporter with their tracking ID (clear, reassuring, anonymous).

import { D, state } from "@frontmltd/frontmjs/core/State";
import { reportDoc } from "../collections/reports";
import {
  reportIdField,
  reporterIdField,
  statusField,
  severityField,
  sourceField,
  assignedToField,
  createdOnField,
  updatedOnField,
  versionField,
  reopenCountField,
  categoryField,
  urgencyField,
  locationField,
  againstAdminField,
  descriptionField,
  accusedPartyField,
  shipNameField,
  incidentDateField,
} from "../sections/report-details";
import { evidenceNotesField, ATTACHMENT_FIELDS } from "../sections/evidence";
import { toStatusField, actorRoleField } from "../sections/status-history";
import {
  getStatusHistoryCollection,
  appendStatusHistoryRow,
} from "./status-history-writer";
import { STATUS } from "../../../lib/ticket-status";
import { assignedRoleFor, resolveAssignees } from "../../../lib/access";
import { sendBotMessage, resolvePeerBotId } from "../../../lib/notifications";
import { sanitiseText, isValidIncidentDate } from "../../../lib/validation";
import {
  generateReportId,
  isDuplicateKeyError,
} from "../../../lib/id-generator";
import { saveDocWithSubCollections } from "../../../lib/persist";
import {
  severityFromUrgency,
  categoryFromLabel,
  urgencyFromLabel,
  locationFromLabel,
  SOURCE,
  ACTOR_ROLE,
  ERROR_CODES,
  MSG,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import { INTENT } from "../constants";

// Free-text fields sanitised on submit (rule 10). category/urgency/location are
// DROPDOWN tokens, contactValue is handled by the U-F7 onSave gate — not here.
const FREE_TEXT_FIELDS = [
  descriptionField,
  accusedPartyField,
  shipNameField,
  evidenceNotesField,
];

// Submit button label on the (shared) reportDoc — set on THIS app's bundle instance
// so reportDoc.sendResponse() (the submit form, openSubmitReport) renders a confirm
// action that fires onSubmit. The admin bundle never sendResponse()s reportDoc, so
// this is inert there.
reportDoc.confirm = "Submit report";

// X1 — emit the identity-free MSG_NEW_REPORT to the report's assigned admins in the
// admin app. `self` is the LIVE, just-saved reportDoc (Context A). Payload carries ONLY
// { reportId, category, urgency, severity, assignedTo, createdOn } — NO reporterId /
// contact (rule 16). Recipients = resolveAssignees(report).adminUserId (the routing
// chokepoint). botId = the admin app, from deployment static data. Best-effort + logged;
// NEVER throws into the submit flow (no admins / no botId / send fault → logged no-op,
// the report still sits in the queue and the SLA digest is the backstop).
const sendNewReportMessage = async (self) => {
  try {
    const report = {
      reportId: self.f[reportIdField.id].value,
      category: self.f[categoryField.id].value,
      urgency: self.f[urgencyField.id].value,
      severity: self.f[severityField.id].value,
      assignedTo: self.f[assignedToField.id].value,
      createdOn: self.f[createdOnField.id].value,
    };
    if (!report.reportId) {
      D.log({
        message: "X1: MSG_NEW_REPORT skipped — no reportId on saved doc",
      });
      return;
    }
    // resolveAssignees honours the LIVE assignedTo (routing chokepoint, rule 14) and
    // returns identity-free admin rows { adminUserId, adminEmail, ... }.
    const assignees = await resolveAssignees(report);
    const userIds = (assignees || []).map((a) => a.adminUserId).filter(Boolean);
    if (!userIds.length) {
      // No admins to deliver to — log, do NOT send (the report is persisted; the SLA
      // digest / Alerts surface an unassigned report). Mirrors ER-B7.
      D.log({
        message:
          "X1: MSG_NEW_REPORT — no assignees to deliver to (queued only)",
        data: { reportId: report.reportId, assignedTo: report.assignedTo },
      });
      return;
    }
    const botId = await resolvePeerBotId(STATIC_DATA_KEYS.ADMIN_BOT_ID);
    await sendBotMessage({
      type: MSG.NEW_REPORT,
      payload: report,
      userIds,
      botId,
      userDomain: state.currentUserDomain,
    });
    D.log({
      message: "X1: MSG_NEW_REPORT sent",
      data: { reportId: report.reportId, recipients: userIds.length },
    });
  } catch (error) {
    // Absolute backstop — a cross-app send fault must never fail the reporter's submit.
    D.log({
      message: "X1: MSG_NEW_REPORT send swallowed an error",
      data: { error: String(error) },
    });
  }
};

reportDoc.onSubmit = async (self) => {
  D.log({
    message: "submit: report onSubmit start",
    data: {
      category: self.f[categoryField.id].value,
      urgency: self.f[urgencyField.id].value,
      status: self.f[statusField.id].value,
    },
  });
  D.log({
    message: "U-F8 submit: start",
    data: { hasDescription: !!self.f[descriptionField.id].value },
  });
  // 1. Sanitise free-text (idempotent — safe on a re-submit).
  for (const field of FREE_TEXT_FIELDS) {
    const raw = self.f[field.id].value;
    if (typeof raw === "string" && raw !== "") {
      self.f[field.id].value = sanitiseText(raw);
    }
  }
  // Description is mandatory; markup-only input can hollow it to empty on sanitise.
  if (!self.f[descriptionField.id].value) {
    state.addErrorToStack(400, "Please enter a description of what happened.");
    return;
  }

  // 2. Dropdown LABELS → stable tokens (idempotent: a token passes through unchanged).
  self.f[categoryField.id].value = categoryFromLabel(
    self.f[categoryField.id].value
  );
  const urgencyToken = urgencyFromLabel(self.f[urgencyField.id].value);
  self.f[urgencyField.id].value = urgencyToken;
  self.f[locationField.id].value = locationFromLabel(
    self.f[locationField.id].value
  );

  // 3. incidentDate must parse AND not be in the future — abort before id work.
  if (!isValidIncidentDate(self.f[incidentDateField.id].value)) {
    state.addErrorToStack(
      ERROR_CODES.INVALID_INCIDENT_DATE,
      "Please choose a valid incident date that is not in the future."
    );
    return;
  }

  // 4. System fields — idempotent (debounce double-submit; never clobber admin fields).
  const now = Date.now();
  if (!self.f[reportIdField.id].value) {
    self.f[reportIdField.id].value = generateReportId();
  }
  if (!self.f[reporterIdField.id].value) {
    self.f[reporterIdField.id].value = state.user?.userId || "";
  }
  if (!self.f[sourceField.id].value) {
    self.f[sourceField.id].value = SOURCE.REPORTER;
  }
  if (!self.f[statusField.id].value) {
    self.f[statusField.id].value = STATUS.OPEN;
  }
  if (!self.f[createdOnField.id].value) {
    self.f[createdOnField.id].value = now;
  }
  // version starts at 1 (0 is never a valid version → a plain falsy check is safe).
  if (!self.f[versionField.id].value) {
    self.f[versionField.id].value = 1;
  }
  // reopenCount defaults to 0, and 0 IS a valid value — only seed it when it is not
  // already a number (unset at creation), so a re-submit never resets a 0→1 reopen.
  if (typeof self.f[reopenCountField.id].value !== "number") {
    self.f[reopenCountField.id].value = 0;
  }
  // severity from urgency (D6) — set once at creation; never recomputed over an admin
  // override (admins triage in a separate app/Doc; the reporter never re-routes).
  if (!self.f[severityField.id].value) {
    self.f[severityField.id].value = severityFromUrgency(urgencyToken);
  }
  // Routing (D17): assignedTo is the ROLE enum, resolved by the assignedRoleFor
  // chokepoint (againstAdmin → SECONDARY, else PRIMARY). resolveAssignees — which
  // returns admin ROWS — is the recipient resolver the X1 MSG_NEW_REPORT sender uses
  // AFTER save(); it is the wrong shape for this enum column.
  if (!self.f[assignedToField.id].value) {
    self.f[assignedToField.id].value = assignedRoleFor({
      againstAdmin: !!self.f[againstAdminField.id].value,
    });
  }
  self.f[updatedOnField.id].value = now;

  // 5. First statusHistory row (→ OPEN, REPORTER) — transition path (rule 12),
  //    idempotent so a resubmit after a validation failure never stacks a 2nd row.
  const historyCollection = getStatusHistoryCollection(self);
  const hasCreationRow = (historyCollection.rows || []).some(
    (row) =>
      row.f[toStatusField.id]?.value === STATUS.OPEN &&
      row.f[actorRoleField.id]?.value === ACTOR_ROLE.REPORTER
  );
  if (!hasCreationRow) {
    appendStatusHistoryRow(self, {
      toStatus: STATUS.OPEN,
      actorRole: ACTOR_ROLE.REPORTER,
    });
  }

  const evidenceCount = ATTACHMENT_FIELDS.reduce(
    (count, field) => (self.f[field.id]?.value?.value ? count + 1 : count),
    0
  );
  D.log({
    message: "U-F8 submit: fields set",
    data: {
      reportId: self.f[reportIdField.id].value,
      status: self.f[statusField.id].value,
      severity: self.f[severityField.id].value,
      assignedTo: self.f[assignedToField.id].value,
      evidenceCount,
    },
  });

  // 6. Persist with retry-on-collision (ER-B9).
  const MAX_ATTEMPTS = 3;
  let persisted = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !persisted; attempt += 1) {
    const errorsBefore = (state.errorStack || []).length;
    try {
      await saveDocWithSubCollections(self);
    } catch (error) {
      // A genuine random reportId collision against an existing row → new id + retry.
      if (isDuplicateKeyError(error) && attempt < MAX_ATTEMPTS) {
        self.f[reportIdField.id].value = generateReportId();
        D.log({
          message: "U-F8: reportId collision, regenerating",
          data: { attempt },
        });
        continue;
      }
      state.addSystemErrorToStack(
        500,
        "We could not submit your report just now. Please try again."
      );
      D.log({
        message: "U-F8: report save failed",
        data: { error: String(error) },
      });
      return;
    }
    // save() aborts WITHOUT throwing when the onSave gate (evidence U-F6 / contact
    // U-F7) adds a validation error and returns. Detect via the error stack growing —
    // nothing persisted, so do not claim success.
    if ((state.errorStack || []).length > errorsBefore) {
      return;
    }
    persisted = true;
  }

  // 7. Post-save (rule 16): emit the identity-free MSG_NEW_REPORT to the assigned
  //    admins in the admin app (X1). The payload carries ONLY non-identity report
  //    facts — NEVER reporterId / contact (rule 16) — built straight off the saved
  //    reportDoc fields. Best-effort + logged (sendBotMessage swallows its own
  //    failure); a send fault must never fail the reporter's submit — the SLA digest
  //    / Alerts backstop catches an undelivered report. Sent here, AFTER save().
  const reportId = self.f[reportIdField.id].value;
  D.log({
    message: "submit: report submitted successfully",
    data: {
      reportId,
      status: self.f[statusField.id].value,
      assignedTo: self.f[assignedToField.id].value,
    },
  });
  await sendNewReportMessage(self);
  `Thank you. Your report has been submitted securely and anonymously.\n\nYour tracking ID is **${reportId}** — please keep it so you can follow up on this report. We will never reveal your identity.`.sendResponse();
  D.log({ message: "U-F8 submit: report saved", data: { reportId } });
  // After a successful submit, navigate the reporter to their My Reports list so
  // they immediately see the report they just filed. continueWithIntent runs
  // openMyReports AFTER this onSubmit completes (state preserved; messageFromUser
  // dropped — openMyReports needs none, it loads by reporterId). openMyReports
  // does its own Context.CreateAndInit + loadCollectionWithQuery (Context B).
  state.continueWithIntent(INTENT.OPEN_MY_REPORTS);
};

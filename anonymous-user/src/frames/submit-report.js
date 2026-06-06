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
import { evidenceNotesField } from "../sections/evidence";
import { toStatusField, actorRoleField } from "../sections/status-history";
import {
  getStatusHistoryCollection,
  appendStatusHistoryRow,
} from "./status-history-writer";
import { STATUS } from "../../../lib/ticket-status";
import { assignedRoleFor } from "../../../lib/access";
import { sanitiseText, isValidIncidentDate } from "../../../lib/validation";
import {
  generateReportId,
  isDuplicateKeyError,
} from "../../../lib/id-generator";
import {
  severityFromUrgency,
  categoryFromLabel,
  urgencyFromLabel,
  locationFromLabel,
  SOURCE,
  ACTOR_ROLE,
  ERROR_CODES,
} from "../../../lib/constants";

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

reportDoc.onSubmit = async (self) => {
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

  // 6. Persist with retry-on-collision (ER-B9).
  const MAX_ATTEMPTS = 3;
  let persisted = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !persisted; attempt += 1) {
    const errorsBefore = (state.errorStack || []).length;
    try {
      await self.save();
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

  // 7. Post-save hook (rule 16): X1 wires the identity-free MSG_NEW_REPORT sender HERE
  //    — { reportId, category, urgency, severity, assignedTo, createdOn } only, via
  //    state.notification.sendMessageToUserInBot. Built by task X1 (depends on U-F8).

  // 8. Reporter confirmation. The custom read screens + any navigation belong to the
  //    Display Doc; U-F8 gives clear, trustworthy feedback with the tracking ID.
  const reportId = self.f[reportIdField.id].value;
  `Thank you. Your report has been submitted securely and anonymously.\n\nYour tracking ID is **${reportId}** — please keep it so you can follow up on this report. We will never reveal your identity.`.sendResponse();
};

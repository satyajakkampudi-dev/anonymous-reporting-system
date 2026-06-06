// A-E-manualLog — manual-log submit transforms + idempotency (adminReportDoc.onSubmit).
//
// An admin manually logs a report on behalf of someone (a phone / in-person
// disclosure that did not come through the reporter app). The result is an OPEN
// report with source = MANUAL and NO tracking owner (reporterId stays empty), routed
// to the assigned compliance admin exactly like a reporter-submitted report.
//
// Context A (framework event on adminReportDoc — object graph LIVE; handler lives in
// frames/ per AGENTS.md so it can import Field refs from sections/). Fires when the
// admin confirms the manual-log form (adminReportDoc rendered BLANK by openManualLog).
// This is the near-exact mirror of the USER submit flow (anonymous-user
// submit-report.js), with THREE — and only three — substantive deltas:
//
//   1. source = SOURCE.MANUAL          (not SOURCE.REPORTER).
//   2. reporterId = "" EMPTY           (NEVER state.user.userId). A MANUAL report has
//      no tracking owner, and the LOGGING ADMIN's identity must NEVER become the
//      reporterId — that would both falsely attribute the report and break anonymity
//      (rule 30 / ER-A2). reporterId is left empty; no reporter notifications, no
//      reporter transitions are ever wired for a MANUAL report.
//   3. first statusHistory row actorRole = the LOGGING ADMIN's resolved ROLE
//      (PRIMARY_ADMIN | SECONDARY_ADMIN via resolveAdminRole), NOT ACTOR_ROLE.REPORTER.
//      It is a ROLE token only, never an id (anonymity, rule 16).
//
// IMPORTANT — onSubmit OWNERSHIP. adminReportDoc has exactly ONE onSubmit slot, owned
// HERE by manualLog ONLY. The transition popups bind their OWN capture Docs'
// onSubmit (resolveCaptureDoc / severityCaptureDoc / noteCaptureDoc), never
// adminReportDoc.onSubmit — so there is no clobber. (Verified across frames/.)
//
// Evidence validation: the user app's authoritative gate lives in reportDoc.onSave
// (report-validation.js). The admin bundle binds NO adminReportDoc.onSave, so the
// ENFORCEABLE subset (file count ≤ MAX_FILES + extension allow-list) is applied HERE,
// inline, before save(). Content-type + byte-size enforcement is NOT achievable from a
// Doc handler with documented APIs (the FILE_FIELD envelope carries no contentType /
// size and state.frontmlib exposes no S3 HEAD) — that is the deferred
// MP-FIX-EVIDENCE-METADATA limitation (see lib/validation.js + report-validation.js),
// NOT something to invent an S3 metadata call for.

import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
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
  evidenceNotesField,
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
} from "../sections/manual-log";
import { toStatusField, actorRoleField } from "../sections/status-history";
import {
  getStatusHistoryCollection,
  appendStatusHistoryRow,
} from "./status-history-writer";
import { STATUS } from "../../../lib/ticket-status";
import { assignedRoleFor, resolveAdminRole } from "../../../lib/access";
import {
  sanitiseText,
  isValidIncidentDate,
  validateEvidenceEnvelope,
  isWithinEvidenceFileCount,
} from "../../../lib/validation";
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
  ROLE,
  EVIDENCE_LIMITS,
  ERROR_CODES,
} from "../../../lib/constants";

// Free-text fields sanitised on submit (rule 10). category/urgency/location are
// DROPDOWN labels (mapped to tokens below); there are NO contact fields on this Doc
// (rule 30, D-L3-5).
const FREE_TEXT_FIELDS = [
  descriptionField,
  accusedPartyField,
  shipNameField,
  evidenceNotesField,
];

const EVIDENCE_FILE_FIELDS = [
  evidenceFile1Field,
  evidenceFile2Field,
  evidenceFile3Field,
  evidenceFile4Field,
  evidenceFile5Field,
];

adminReportDoc.onSubmit = async (self) => {
  // 0. Resolve the LOGGING ADMIN's ROLE up-front — it is REQUIRED for the
  //    statusHistory actorRole (delta 3). We cannot attribute the creation without it,
  //    and an unattributable audit row is not acceptable for a manual log, so a thrown
  //    read or a null role ABORTS before any persist (no fallback role — that would
  //    misattribute the audit trail). resolveAdminRole reads the admin-users registry,
  //    which works in any execution context.
  let adminRole;
  try {
    adminRole = await resolveAdminRole();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We couldn't verify your access just now. Please try again in a moment."
    );
    D.log({
      message: "A-E-manualLog: role resolution failed on submit",
      data: { error: String(error) },
    });
    return;
  }
  if (adminRole !== ROLE.PRIMARY_ADMIN && adminRole !== ROLE.SECONDARY_ADMIN) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to log a report."
    );
    return;
  }

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

  // 3b. Evidence — enforceable subset (file count + extension allow-list). The admin
  //     bundle has no adminReportDoc.onSave gate, so apply it inline here. Content-type
  //     + size remain deferred (MP-FIX-EVIDENCE-METADATA — see the file header).
  const attachedEvidence = EVIDENCE_FILE_FIELDS.map(
    (field) => self.f[field.id].value
  ).filter((envelope) => envelope && envelope.value);
  if (!isWithinEvidenceFileCount(attachedEvidence.length)) {
    state.addErrorToStack(
      ERROR_CODES.INVALID_EVIDENCE_FILE,
      `Please attach no more than ${EVIDENCE_LIMITS.MAX_FILES} evidence files.`
    );
    return;
  }
  for (const envelope of attachedEvidence) {
    const { valid, reason } = validateEvidenceEnvelope(envelope);
    if (!valid) {
      state.addErrorToStack(ERROR_CODES.INVALID_EVIDENCE_FILE, reason);
      return;
    }
  }

  // 4. System fields — idempotent (debounce double-submit; never clobber on re-submit).
  const now = Date.now();
  if (!self.f[reportIdField.id].value) {
    self.f[reportIdField.id].value = generateReportId();
  }
  // DELTA 2 — reporterId stays EMPTY. A MANUAL report has no tracking owner; the
  // logging admin's id MUST NEVER be written here (anonymity / rule 30, ER-A2).
  // (adminReportDoc binds no reporterId field at all — so there is nothing to set; the
  // empty value is enforced by the binding layer. No assignment is made on purpose.)
  // DELTA 1 — source = MANUAL (not REPORTER).
  if (!self.f[sourceField.id].value) {
    self.f[sourceField.id].value = SOURCE.MANUAL;
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
  // already a number, so a re-submit never resets a 0→1 reopen.
  if (typeof self.f[reopenCountField.id].value !== "number") {
    self.f[reopenCountField.id].value = 0;
  }
  // severity from urgency (D6) — set once at creation; an admin re-triages via the
  // overrideSeverity popup, never by re-submitting this form.
  if (!self.f[severityField.id].value) {
    self.f[severityField.id].value = severityFromUrgency(urgencyToken);
  }
  // Routing (D17): assignedTo is the ROLE enum via the assignedRoleFor chokepoint
  // (againstAdmin → SECONDARY, else PRIMARY) — identical to the reporter path.
  if (!self.f[assignedToField.id].value) {
    self.f[assignedToField.id].value = assignedRoleFor({
      againstAdmin: !!self.f[againstAdminField.id].value,
    });
  }
  self.f[updatedOnField.id].value = now;

  // 5. First statusHistory row (→ OPEN) — transition path (rule 12), idempotent so a
  //    resubmit after a validation failure never stacks a 2nd creation row.
  //    DELTA 3 — actorRole = the logging admin's ROLE (not REPORTER).
  const historyCollection = getStatusHistoryCollection(self);
  const hasCreationRow = (historyCollection.rows || []).some(
    (row) =>
      row.f[toStatusField.id]?.value === STATUS.OPEN &&
      row.f[actorRoleField.id]?.value === adminRole
  );
  if (!hasCreationRow) {
    appendStatusHistoryRow(self, {
      toStatus: STATUS.OPEN,
      actorRole: adminRole,
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
          message: "A-E-manualLog: reportId collision, regenerating",
          data: { attempt },
        });
        continue;
      }
      state.addSystemErrorToStack(
        500,
        "We could not log this report just now. Please try again."
      );
      D.log({
        message: "A-E-manualLog: report save failed",
        data: { error: String(error) },
      });
      return;
    }
    // save() can abort WITHOUT throwing if a gate adds a validation error and returns —
    // detect via the error stack growing; nothing persisted, so do not claim success.
    if ((state.errorStack || []).length > errorsBefore) {
      return;
    }
    persisted = true;
  }

  // 7. Post-save hook (DEFERRED — A-F15, NOT cross-app X1). A MANUAL report notifies the
  //    ASSIGNED admins directly (resolveAssignees(report) → sendAdminEmail /
  //    sendAdminWebPush) — there is NO reporter to address, so the X1 user→admin
  //    cross-app send does not apply here. The sender is wired by A-F15 (depends on this
  //    task). Do NOT invent the orchestration; do NOT add any identity to a payload.

  // 8. Confirm to the admin with the generated reportId and where it was routed.
  const reportId = self.f[reportIdField.id].value;
  const routedTo =
    self.f[assignedToField.id].value === ROLE.SECONDARY_ADMIN
      ? "secondary"
      : "primary";
  D.log({
    message: "A-E-manualLog: manual report logged",
    data: { reportId, source: SOURCE.MANUAL, routedTo, actorRole: adminRole },
  });
  `Report **${reportId}** has been logged and routed to the ${routedTo} compliance admin.`.sendResponse();
};

// A-E-overrideSeverity — admin "Override severity" edit (A-F12).
//
// This is NOT a status transition. It WRITES the report's `severity` infra column
// (sections/manual-log.js) — the only edit to severity after submit-time
// initialisation from urgency (D6). No status changes. The new severity feeds
// priority surfacing (A-F5) and auto-escalate timing (A-F16), which read the
// column live; there is therefore NO reporter-facing MSG / X-task hook here
// (severity is non-identity admin triage data — rule 30).
//
// Because severityCaptureDoc is SINGLE-OWNER (only this frame opens its popup),
// this frame owns severityCaptureDoc.onSubmit DIRECTLY — unlike the shared
// noteCaptureDoc, no dispatcher is needed (framework-mapping rule 29).
//
// The action is gated by isActionAllowed(status, role, ACTION.OVERRIDE_SEVERITY)
// — the ACTION gate, NOT canTransition (there is no status move). OVERRIDE_SEVERITY
// is allowed for both admin roles on every NON-terminal status and is absent from
// every terminal status (lib/ticket-status.js STATUS_META), so a report that moved
// to a terminal state after the popup opened is rejected on submit (defence in depth).
//
// The two halves mirror resolve-report.js (rule 29 precedent) discipline:
//   1. overrideSeverity.onResolution — trigger intent (Context B — graph EMPTY on
//      entry). Payload guard, authoritative role re-resolution (neutral retry on a
//      thrown read), Context.Create attach (NOT loadDocument — rule 22), cheap
//      pre-popup ACTION guard off the buffer, stash reportId, reset the capture Doc
//      in place (rule 26 — docId first, then clear; NEVER cloneAndInit), pre-select
//      the current severity into the dropdown, open the popup.
//   2. severityCaptureDoc.onSubmit — validate the chosen severity against the
//      SEVERITY enum, re-read the stashed reportId, re-resolve role authoritatively,
//      attach + loadDocument FRESH (the concurrency guard — version advances
//      monotonically read -> read+1), existence 404, re-check the ACTION gate against
//      the just-read status, apply severity + version + updatedOn, append ONE
//      statusHistory row (fromStatus === toStatus because there is no status change —
//      the timeline records the edit via the note; actorRole token only, no id —
//      anonymity, rule 16), save with errorStack-length abort detection.
//
// ANONYMITY (rule 30). adminReportDoc declares no reporter-identity field; the
// statusHistory note carries only severity tokens. actorRole is the ROLE token, never
// an id. Nothing identity-bearing is read, written, or sent.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, severityCaptureDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  severityField,
  versionField,
  updatedOnField,
} from "../sections/manual-log";
import { severityInputField } from "../sections/severity-popup";
import { appendStatusHistoryRow } from "./status-history-writer";
import { resolveAdminRole } from "../../../lib/access";
import { isActionAllowed, ACTION } from "../../../lib/ticket-status";
import { SEVERITY, SEVERITY_LABELS, ERROR_CODES } from "../../../lib/constants";
import { INTENT, STATE_KEYS } from "../constants";

// Valid severity tokens — the only values the dropdown may legitimately submit and
// the only values the persisted column may take.
const SEVERITY_TOKENS = Object.values(SEVERITY);

// Shared copy so the pre-popup guard and the authoritative submit guard surface the
// SAME message for the SAME condition (no drift). "Edit" rather than "transition"
// wording — this is a severity edit, not a status move.
const ILLEGAL_MSG =
  "Severity can no longer be changed on this report — its status has changed. Please refresh to see the latest update.";

const NOT_AN_ADMIN_MSG =
  "You do not have permission to change this report's severity.";

const RETRY_MSG =
  "We couldn't verify your access just now. Please try again in a moment.";

export const overrideSeverity = Intent.Create({
  intentId: INTENT.OVERRIDE_SEVERITY,
  prompt: "Override the severity of a report",
  state,
});

// --- 1. Trigger intent: cheap pre-popup ACTION guard off the buffer, open popup ---
overrideSeverity.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for overrideSeverity");
    return;
  }

  // 2. Authorise — authoritative role re-resolution (NOT the display stash). A thrown
  //    read (poor maritime link) is a neutral retry, not a deny.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F12: overrideSeverity role resolution failed (pre-popup)",
      data: { reportId, error: String(error) },
    });
    RETRY_MSG.sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(ERROR_CODES.NOT_AN_ADMIN, NOT_AN_ADMIN_MSG);
    return;
  }

  // 3. Attach to the EXISTING context (Redis buffer) — NOT loadDocument (rule 22). The
  //    report the admin opened (openManageReport) is already hydrated in the buffer.
  await Context.Create(state.currentTabId, { state });

  // 4. Cheap pre-popup guard (defence-in-depth beyond the hidden button): the CURRENT
  //    status must allow OVERRIDE_SEVERITY for this role. This is an ACTION gate, NOT a
  //    canTransition status move. The AUTHORITATIVE re-read + guard happens on submit.
  const status = adminReportDoc.f[statusField.id]?.value || "";
  if (!isActionAllowed(status, role, ACTION.OVERRIDE_SEVERITY)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    return;
  }

  // 5. Stash the id for the submit handler (a separate invocation; survives via Redis).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  // 6. Reset the REGISTERED capture Doc in place (rule 26 — never cloneAndInit). docId
  //    FIRST, then clear values, so the cleared buffer targets the new empty path.
  severityCaptureDoc.docId = state.getUniqueId();
  for (const field of severityCaptureDoc.fields) {
    field.value = null;
  }

  // 7. UX nicety: pre-select the report's CURRENT severity (read off the buffer) so the
  //    dropdown defaults to the current value — but ONLY if it is a valid SEVERITY token
  //    (an unset/legacy/garbage column leaves the dropdown empty rather than offering a
  //    non-enum default).
  const currentSeverity = adminReportDoc.f[severityField.id]?.value;
  if (SEVERITY_TOKENS.includes(currentSeverity)) {
    severityCaptureDoc.f[severityInputField.id].value = currentSeverity;
  }

  severityCaptureDoc.title = "Override severity";
  severityCaptureDoc.sendQuickFormResponse();
};

// --- 2. Persist handler: validate, re-read fresh, re-guard, apply, append, save ---
severityCaptureDoc.onSubmit = async (self) => {
  // 1. Chosen severity: must be one of the SEVERITY tokens. Guards against an empty or
  //    garbage submit (the field is mandatory, but defence in depth never trusts that).
  const next = self.f[severityInputField.id]?.value;
  if (!SEVERITY_TOKENS.includes(next)) {
    state.addErrorToStack(400, "Please choose a severity.");
    return;
  }

  // 2. Which report — stashed by onResolution (the popup submit is a fresh invocation).
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) {
    state.addSystemErrorToStack(
      500,
      "We lost track of which report you were editing. Please reopen it from the report and try again."
    );
    return;
  }

  // 3. Authorise AUTHORITATIVELY on submit too (defence in depth — the popup was opened
  //    in an earlier invocation). Neutral retry on a thrown read; refuse on null.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F12: overrideSeverity role resolution failed (submit)",
      data: { reportId, error: String(error) },
    });
    RETRY_MSG.sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(ERROR_CODES.NOT_AN_ADMIN, NOT_AN_ADMIN_MSG);
    return;
  }

  // 4. Attach to the context, then re-read the report FRESH (the concurrency guard).
  await Context.Create(state.currentTabId, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 5. Existence — no hydrated reportId means the report was not found.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // 6. Re-check the ACTION gate against the CURRENT (just-read) status for THIS role.
  //    Defence: the status may have moved to a terminal state since the popup opened
  //    (OVERRIDE_SEVERITY is absent from every terminal status), in which case the
  //    severity column is frozen — reject, never overwrite.
  const current = adminReportDoc.f[statusField.id]?.value || "";
  if (!isActionAllowed(current, role, ACTION.OVERRIDE_SEVERITY)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    D.log({
      message:
        "A-F12: severity override rejected — action not allowed on current status",
      data: { reportId, current, role },
    });
    return;
  }

  // 7. Previous severity — captured for the audit note (before we overwrite it).
  const prev = adminReportDoc.f[severityField.id]?.value || "";

  // Same-value decision: PROCEED and record even when next === prev (no short-circuit).
  // Rationale — a deliberate "re-affirm CRITICAL" is a meaningful triage action and the
  // audit trail should reflect it honestly; the write is a cheap idempotent $set and
  // costs one extra statusHistory row, which is the correct, transparent behaviour for a
  // compliance system. The note below reads "unset to X" / "X to X" accordingly.

  // 8. Apply. version advances monotonically (read -> read+1); a concurrent writer's
  //    guard and the audit trail stay coherent (same reasoning as resolve-report.js).
  const now = Date.now();
  adminReportDoc.f[severityField.id].value = next;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // 9. ONE statusHistory row, atomic with the report write (rule 12). There is NO status
  //    change, so fromStatus === toStatus === current; the severity edit is recorded via
  //    the note (the documented way to log a non-transition admin action). actorRole is
  //    the admin's ROLE token — never an id (anonymity, rule 16).
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: current,
    actorRole: role,
    note: `Severity changed from ${prev || "unset"} to ${next}.`,
  });

  // 10. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate
  //     abort adds to the error stack WITHOUT throwing — detect it the way
  //     resolve-report.js does and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not change the severity just now. Please try again."
    );
    D.log({
      message: "A-F12: report save failed on severity override",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  // 11. No deferred MSG / notify hook: severity override is not a reporter-facing
  //     contract and feeds no X task. A-F5 (priority surfacing) and A-F16 (auto-escalate)
  //     read the `severity` column live — nothing to send.

  D.log({
    message: "A-F12: severity overridden",
    data: { reportId, from: prev || "unset", to: next, role },
  });

  `Severity for report **${reportId}** is now **${
    SEVERITY_LABELS[next] || next
  }**. The change has been recorded in the report's timeline.`.sendResponse();
};

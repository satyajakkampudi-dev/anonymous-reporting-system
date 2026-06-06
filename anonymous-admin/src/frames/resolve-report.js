// A-E-resolveReport — admin "Resolve" transition (A-F9).
//
//   UNDER_REVIEW --(any admin)--------> RESOLVED
//   ESCALATED    --(secondary only)---> RESOLVED
//
// Per-action transition POPUP (framework-mapping rule 29): unlike takeReview (a direct
// transition with no popup), resolve opens a sendQuickFormResponse() to capture the
// mandatory resolution text. The two halves of the documented "capture popup ->
// transition" flow — mirror of the user app's reject-resolution.js (rule 29 precedent)
// and the admin take-review.js guard/concurrency/save/history discipline:
//
//   1. resolveReport.onResolution — the trigger intent (independent intent, Context B —
//      object graph EMPTY on entry; CLAUDE.md "Invocation Lifecycle"). Fired by the
//      "Resolve" button in the Manage-actions card (A-D-manageactions): data-action=
//      "intent", intentId = resolveReport, data-payload '{"reportId":"..."}'. The
//      payload lives ONE LEVEL DEEP under state.messageFromUser.payload (CLAUDE.md
//      "Custom HTML Payloads"). It ATTACHES to the existing context (Context.Create —
//      Redis buffer, NO loadDocument: rule 22), runs a CHEAP pre-popup guard off the
//      buffer (defence-in-depth; the AUTHORITATIVE guard re-runs on submit against a
//      fresh MongoDB read), stashes the reportId, resets the capture Doc IN PLACE
//      (rule 26 — docId first, then clear values; NEVER cloneAndInit) and opens the
//      resolution popup.
//
//   2. resolveCaptureDoc.onSubmit — the transition. On popup-confirm it sanitises the
//      mandatory resolution text (reject if empty after sanitise), re-reads the report
//      FRESH by reportId (the optimistic-concurrency guard, rule 12: `current` is the
//      latest persisted status, so a concurrent admin move or a double-confirm is
//      rejected, never overwritten), re-checks legality via canTransition(current,
//      RESOLVED, role) — which also enforces the ESCALATED -> RESOLVED secondary-only
//      split — then applies: status=RESOLVED, resolvedOn=now, resolution=sanitised text
//      (onto adminReportDoc's hidden `resolution` column), version=read+1, updatedOn=now;
//      appends ONE statusHistory row (actorRole = the admin's ROLE token, never an id —
//      anonymity, rule 16). A true compare-and-swap via save(false, {reportId, version})
//      is UNSAFE — Doc.save() forces { upsert: true }, so a non-matching version query
//      would INSERT a corrupt duplicate; version advances monotonically (read -> read+1)
//      so other writers' guards and the audit trail stay coherent (same reasoning as
//      take-review.js / U-F10).
//
// ANONYMITY (rule 30). adminReportDoc declares NO reporterId / contactMethod /
// contactValue field, so loadDocument cannot surface them and save() persists a
// MongoDB `$set` of only the bound fields. The auto-close schedule and the X4 hook
// carry { reportId } only — never any reporter identity, never an actorId.
//
// AUTO-CLOSE +30d (D2). AFTER a successful save() we arm a jobScheduler message that
// fires INTENT.AUTO_CLOSE_REPORT at resolvedOn + TIMING.AUTO_CLOSE_MS, payload
// { reportId } ONLY. The handler is registered by A-F17 (RESOLVED -> CLOSED_BY_SYSTEM
// if the reporter has neither accepted nor rejected by then); A-F17 DEPENDS on this
// task, so the id is safe to target now. toUser is the resolving admin's own userId
// (an admin identity, not the reporter's — anonymity preserved); the A-F17 handler
// re-reads the shared report by reportId, independent of whose context it fires in
// (job-scheduler guide: the scheduled intent runs in the toUser's context). The jobId
// is deterministic per report so a re-resolve (after a reject/reopen cycle) overwrites
// the prior timer rather than stacking. Best-effort: a scheduling failure does NOT
// fail the resolve (the report is already RESOLVED + saved); it is logged.
//
// CROSS-APP X4 (MSG_REPORT_RESOLVED — deferred, NOT silently skipped). The acceptance
// criterion calls for MSG_REPORT_RESOLVED to the reporter after save(). The admin app,
// by design, CANNOT address the reporter (it holds no reporterId — rule 30). Resolving
// identity-free delivery is the explicit responsibility of cross-app task X4. So the
// sender is left as a documented post-save hook below, exactly mirroring take-review.js
// (X5) and reject-resolution.js (X2). Payload would be { reportId, newStatus } — no
// identity. Do NOT invent the sender now.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, resolveCaptureDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  versionField,
  updatedOnField,
  resolvedOnField,
  resolutionField,
} from "../sections/manual-log";
import { resolutionInputField } from "../sections/resolve-popup";
import { appendStatusHistoryRow } from "./status-history-writer";
import { resolveAdminRole } from "../../../lib/access";
import { canTransition, STATUS, statusLabel } from "../../../lib/ticket-status";
import { sanitiseText } from "../../../lib/validation";
import {
  ERROR_CODES,
  TIMING,
  MSG,
  STATIC_DATA_KEYS,
} from "../../../lib/constants";
import {
  broadcastBotMessage,
  resolvePeerBotId,
} from "../../../lib/notifications";
import { INTENT, STATE_KEYS } from "../constants";

// Shared copy so the pre-popup guard and the authoritative submit guard surface the
// SAME message for the same condition (no drift).
const ILLEGAL_MSG =
  "This report can no longer be resolved — its status has changed. Please refresh to see the latest update.";

export const resolveReport = Intent.Create({
  intentId: INTENT.RESOLVE_REPORT,
  prompt: "Resolve a report with a resolution note",
  state,
});

// --- 1. Trigger intent: cheap pre-popup guard off the buffer, then open the popup ---
resolveReport.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for resolveReport");
    return;
  }

  // 2. Authorise — authoritative role re-resolution (NOT the display stash). A thrown
  //    read (poor maritime link) is a neutral retry, not a deny.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F9: resolveReport role resolution failed (pre-popup)",
      data: { reportId, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to resolve this report."
    );
    return;
  }

  // 3. Attach to the EXISTING context (Redis buffer) — NOT loadDocument (rule 22). The
  //    report the admin opened (openManageReport) is already hydrated in the buffer.
  await Context.Create(state.currentTabId, { state });

  // 4. Cheap pre-popup guard (defence-in-depth beyond the hidden button). The
  //    AUTHORITATIVE re-read + guard happens on submit.
  const status = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(status, STATUS.RESOLVED, role)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    return;
  }

  // 5. Stash the id for the submit handler (a separate invocation; survives via Redis).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  // 6. Reset the REGISTERED capture Doc in place (rule 26 — never cloneAndInit). docId
  //    FIRST, then clear values, so the cleared buffer targets the new empty path.
  resolveCaptureDoc.docId = state.getUniqueId();
  for (const field of resolveCaptureDoc.fields) {
    field.value = null;
  }
  resolveCaptureDoc.title = "Resolve report";
  resolveCaptureDoc.sendQuickFormResponse();
};

// --- 2. Persist handler: sanitise, re-read fresh, re-guard, apply, append, save ---
resolveCaptureDoc.onSubmit = async (self) => {
  // 1. Resolution: mandatory + sanitised (rule 10 — strip markup; safe for HTML card +
  //    any email/X4 use). Reject a resolution that sanitises to empty (markup-only/abuse).
  const resolution = sanitiseText(self.f[resolutionInputField.id]?.value);
  if (!resolution) {
    state.addErrorToStack(400, "Please describe how this report was resolved.");
    return;
  }

  // 2. Which report — stashed by onResolution (the popup submit is a fresh invocation).
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) {
    state.addSystemErrorToStack(
      500,
      "We lost track of which report you were resolving. Please reopen it from the report and try again."
    );
    return;
  }

  // 3. Authorise AUTHORITATIVELY on submit too (defence in depth — the popup was opened
  //    in an earlier invocation; re-resolve against the seeded registry). Neutral retry
  //    on a thrown read; refuse on null.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F9: resolveReport role resolution failed (submit)",
      data: { reportId, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to resolve this report."
    );
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

  // 6. Concurrency + legality against the CURRENT (just-read) status for THIS role.
  //    Catches a concurrent move and a double-confirm — rejected, never overwritten —
  //    and enforces the ESCALATED -> RESOLVED secondary-only split (canTransition).
  const current = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(current, STATUS.RESOLVED, role)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    D.log({
      message: "A-F9: resolve rejected — illegal/stale transition",
      data: { reportId, current, to: STATUS.RESOLVED, role },
    });
    return;
  }

  // 7. Apply. version advances monotonically (read -> read+1). resolution lands on the
  //    HIDDEN persisted column (sections/manual-log.js), NOT the transient capture field.
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = STATUS.RESOLVED;
  adminReportDoc.f[resolvedOnField.id].value = now;
  adminReportDoc.f[resolutionField.id].value = resolution;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // 8. One statusHistory row, atomic with the report write (rule 12). actorRole is the
  //    admin's ROLE token — never an id (anonymity, rule 16). note is optional and
  //    omitted (the resolution text lives on its own column; the timeline records the
  //    transition, not a copy of the resolution body).
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: STATUS.RESOLVED,
    actorRole: role,
  });

  // 9. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate
  //    abort adds to the error stack WITHOUT throwing — detect it the way take-review.js
  //    does and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not resolve this report just now. Please try again."
    );
    D.log({
      message: "A-F9: report save failed on resolve",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  // 10. Auto-close +30d (D2). Arm a jobScheduler message that fires AUTO_CLOSE_REPORT at
  //     resolvedOn + TIMING.AUTO_CLOSE_MS, payload { reportId } ONLY (no identity). The
  //     A-F17 handler re-reads the shared report by reportId and closes it ONLY if still
  //     RESOLVED (a guarded no-op if the reporter already accepted/rejected). jobId is
  //     deterministic per report so a re-resolve overwrites rather than stacks. Best-
  //     effort: a scheduling failure does NOT fail the (already-saved) resolve.
  try {
    await state.jobScheduler.scheduleMessage({
      toUser: state.user.userId,
      jobId: `${INTENT.AUTO_CLOSE_REPORT}-${reportId}`,
      schedule: now + TIMING.AUTO_CLOSE_MS,
      messages: [{ intentId: INTENT.AUTO_CLOSE_REPORT, data: { reportId } }],
    });
  } catch (error) {
    D.log({
      message: "A-F9: failed to arm the +30d auto-close",
      data: { reportId, error: String(error) },
    });
  }

  // 11. Post-save hook (rule 16) — X4 MSG_REPORT_RESOLVED. The admin app holds NO
  //     reporterId (rule 30 — adminProjection strips it) so it CANNOT address the
  //     reporter. We BROADCAST an identity-free { reportId, resolvedOn } to the entire
  //     user bot; the user-side receiver (report-resolved.js) loads by reportId and
  //     notifies ONLY if the loaded report's reporterId === its own state.user.userId
  //     (the ownership filter — the anonymity linchpin). Best-effort, AFTER save();
  //     a broadcast failure NEVER rolls back the (already-persisted) resolve — the
  //     in-app RESOLVED status is the source of truth, the push/email is a courtesy.
  try {
    const userBotId = await resolvePeerBotId(STATIC_DATA_KEYS.USER_BOT_ID);
    await broadcastBotMessage({
      type: MSG.REPORT_RESOLVED,
      botId: userBotId,
      payload: { reportId, resolvedOn: now },
    });
  } catch (error) {
    D.log({
      message: "A-F9: X4 MSG_REPORT_RESOLVED broadcast failed (non-fatal)",
      data: { reportId, error: String(error) },
    });
  }

  D.log({
    message: "A-F9: report resolved",
    data: { reportId, from: current, to: STATUS.RESOLVED, role },
  });

  `Report **${reportId}** is now **${statusLabel(STATUS.RESOLVED)}**. Your resolution has been recorded in the report's timeline and shared with the reporter. If they take no action, the report will close automatically in 30 days.`.sendResponse();
};

// Shared note-popup transition dispatcher — owns the SINGLE noteCaptureDoc.onSubmit.
//
// noteCaptureDoc (docs/admin-report-doc.js) is the per-action CAPTURE Doc SHARED by
// TWO transitions: escalateReport (A-F10, this bundle) and closeRejected (A-F11, the
// next task). Both open the SAME "Add a note" popup with the SAME single transient
// field (sections/transition-note-popup.js). A Doc has exactly ONE onSubmit slot —
// so the two transitions CANNOT each assign noteCaptureDoc.onSubmit; the second
// assignment would clobber the first (the exact clobber bug framework-mapping rule 29
// warns about). Instead, this module owns the one onSubmit and DISPATCHES on the
// TARGET STATUS the trigger intent armed (STATE_KEYS.PENDING_NOTE_TARGET), via a
// command registry that each transition extends with registerNoteTransition().
//
// HOW closeRejected extends this (no edit to escalate's logic): closeRejected's frame
// imports registerNoteTransition and registers a STATUS.CLOSED_REJECTED entry with its
// own successMessage + applyExtra (e.g. stamping a reject-close column). The dispatcher
// below is transition-agnostic — it performs the SAME guard / fresh-read / concurrency /
// monotonic-version / statusHistory / save discipline (mirrored from resolve-report.js)
// for whichever entry matches `target`, then calls cfg.applyExtra for the transition-
// specific writes. Adding a transition is additive: a registry entry, never a code edit.
//
// CONTEXT (CLAUDE.md "Invocation Lifecycle"). onSubmit runs in Context A relative to
// noteCaptureDoc (its graph is live via `self`), but the report it mutates is loaded
// FRESH here (the popup submit is a separate invocation from the trigger intent, so the
// adminReportDoc graph is reconstructed) — exactly the resolve-report.js submit pattern.
//
// ANONYMITY (rule 16/29/30). The transient note is consumed into statusHistory.note
// ONLY (actorRole = the admin's ROLE token, never an id). transitionNoteField has no
// dbName and noteCaptureDoc is never save()d, so the note can NEVER leak to a `reports`
// column. adminReportDoc binds no reporter-identity field, so loadDocument/save touch no
// identity. The deferred post-save hooks carry { reportId, newStatus } only.

import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc, noteCaptureDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  versionField,
  updatedOnField,
  severityField,
  categoryField,
  urgencyField,
  assignedToField,
  againstAdminField,
  createdOnField,
} from "../sections/manual-log";
import { transitionNoteField } from "../sections/transition-note-popup";
import { appendStatusHistoryRow } from "./status-history-writer";
import { notifyAssignees } from "./admin-notify";
import { resolveAdminRole } from "../../../lib/access";
import { canTransition } from "../../../lib/ticket-status";
import { sanitiseText } from "../../../lib/validation";
import { ERROR_CODES } from "../../../lib/constants";
import { STATE_KEYS } from "../constants";

// Command registry: targetStatus -> { successMessage(reportId), applyExtra(doc, role) }.
// Module-level: registration happens at module load (each transition frame calls
// registerNoteTransition on import), dispatch happens at runtime on popup submit — so
// by the time any popup submits, every transition module is loaded and registered.
const NOTE_TRANSITIONS = {};

// Register a note-popup transition. config:
//   successMessage(reportId): string   — the confirmation shown after a successful save.
//   applyExtra(adminReportDoc, role): void — transition-specific field writes (e.g.
//                                            escalate sets assignedTo = SECONDARY_ADMIN).
//   notifyEvent?: NOTIFY_EVENT          — OPTIONAL. When set, the dispatcher fires the
//                                         admin-notify dispatch (A-F15) AFTER a clean save
//                                         (rule 16). escalate registers NOTIFY_EVENT.ESCALATED
//                                         (notify the secondary admins); closeRejected does
//                                         NOT set it (closing-as-rejected does not notify admins).
export const registerNoteTransition = (targetStatus, config) => {
  NOTE_TRANSITIONS[targetStatus] = config;
};

// Shared copy so a stale/illegal transition surfaces the SAME message regardless of
// which transition armed the popup (no per-transition drift).
const ILLEGAL_MSG =
  "This report can no longer be updated — its status has changed. Please refresh to see the latest update.";

// --- The SINGLE onSubmit slot for noteCaptureDoc (shared by all note transitions) ---
noteCaptureDoc.onSubmit = async (self) => {
  // 1. Optional note — sanitised (rule 10: strip markup; safe for the statusHistory
  //    timeline + any later email/X5 use). EMPTY IS ALLOWED (the note is optional per
  //    the task) — sanitising to empty is not an error, it just records no note.
  const note = sanitiseText(self.f[transitionNoteField.id]?.value);

  // 2. Which report — stashed by the trigger intent (the submit is a fresh invocation).
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) {
    state.addSystemErrorToStack(
      500,
      "We lost track of which report you were updating. Please reopen it from the report and try again."
    );
    return;
  }

  // 3. Which transition — armed by the trigger intent. Without it we cannot know the
  //    target status, so this is a neutral 500 (never guess a transition).
  const target = state.getField(STATE_KEYS.PENDING_NOTE_TARGET);
  if (!target) {
    state.addSystemErrorToStack(
      500,
      "We lost track of which action you were taking. Please reopen the report and try again."
    );
    return;
  }

  // 4. Look up the registered transition config. A missing entry is a wiring fault
  //    (the trigger armed a target nothing registered) — neutral 500, never proceed.
  const cfg = NOTE_TRANSITIONS[target];
  if (!cfg) {
    state.addSystemErrorToStack(
      500,
      "We couldn't complete that action just now. Please try again."
    );
    D.log({
      message: "A-F10/F11: note transition has no registered handler",
      data: { reportId, target },
    });
    return;
  }

  // 5. Authorise AUTHORITATIVELY on submit (defence in depth — the popup was opened in
  //    an earlier invocation). A thrown read (poor maritime link) is a neutral retry,
  //    never a deny; a null role refuses.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F10/F11: note transition role resolution failed (submit)",
      data: { reportId, target, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to update this report."
    );
    return;
  }

  // 6. Attach to the context, then re-read the report FRESH (the concurrency guard).
  await Context.Create(state.currentTabId, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 7. Existence — no hydrated reportId means the report was not found.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // 8. Concurrency + legality against the CURRENT (just-read) status for THIS role.
  //    Catches a concurrent move and a double-confirm — rejected, never overwritten —
  //    and enforces every role split canTransition encodes (e.g. ESCALATED is the
  //    secondary admin's alone). A true CAS via save(false,{version}) is UNSAFE
  //    (Doc.save() forces upsert:true → a non-matching version would INSERT a corrupt
  //    duplicate), so version advances monotonically (read -> read+1) — same reasoning
  //    as resolve-report.js / take-review.js.
  const current = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(current, target, role)) {
    state.addErrorToStack(ERROR_CODES.ILLEGAL_TRANSITION, ILLEGAL_MSG);
    D.log({
      message: "A-F10/F11: note transition rejected — illegal/stale transition",
      data: { reportId, current, to: target, role },
    });
    return;
  }

  // 9. Apply the common state change, then the transition-specific writes.
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = target;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;
  cfg.applyExtra(adminReportDoc, role);

  // 10. ONE statusHistory row, atomic with the report write (rule 12). actorRole is the
  //     admin's ROLE token — never an id (anonymity, rule 16). The optional note is
  //     consumed into statusHistory.note ONLY (omitted when empty), NEVER a reports
  //     column (rule 29 — transitionNoteField has no dbName; noteCaptureDoc is never saved).
  //     Build the args so an empty note simply omits the key (appendStatusHistoryRow
  //     defaults note to "") — never forwards a falsy placeholder.
  const historyArgs = {
    fromStatus: current,
    toStatus: target,
    actorRole: role,
  };
  if (note) {
    historyArgs.note = note;
  }
  appendStatusHistoryRow(adminReportDoc, historyArgs);

  // 11. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate
  //     abort adds to the error stack WITHOUT throwing — detect it the way
  //     resolve-report.js does and do not claim success.
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not update this report just now. Please try again."
    );
    D.log({
      message: "A-F10/F11: report save failed on note transition",
      data: { reportId, target, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  // 12. Post-save admin-notify dispatch (A-F15, rule 16 — ONLY on a clean save, never on
  //     the abort path above). escalate registers notifyEvent = NOTIFY_EVENT.ESCALATED so the
  //     SECONDARY admins it just routed to are notified; closeRejected does not set notifyEvent
  //     (closing-as-rejected does not notify admins). Best-effort — notifyAssignees never
  //     throws, but wrap anyway so a notification fault can NEVER fail/roll back the (already
  //     persisted) transition. The descriptor is IDENTITY-FREE, built from the just-saved
  //     adminReportDoc bound fields (rule 30 — no reporter identity is bound here).
  if (cfg.notifyEvent) {
    try {
      await notifyAssignees(
        {
          reportId,
          status: target,
          severity: adminReportDoc.f[severityField.id]?.value,
          category: adminReportDoc.f[categoryField.id]?.value,
          urgency: adminReportDoc.f[urgencyField.id]?.value,
          assignedTo: adminReportDoc.f[assignedToField.id]?.value,
          againstAdmin: !!adminReportDoc.f[againstAdminField.id]?.value,
          createdOn: adminReportDoc.f[createdOnField.id]?.value,
        },
        { event: cfg.notifyEvent }
      );
    } catch (error) {
      D.log({
        message:
          "A-F15: notifyAssignees errored after note transition (ignored)",
        data: { reportId, target, error: String(error) },
      });
    }
  }

  // 13. Reporter cross-app notify — the relevant MSG depends on the TARGET status:
  //         · ESCALATED        -> MSG_REPORT_STATUS_CHANGED = X5 (cross-app)
  //         · CLOSED_REJECTED  -> MSG_REPORT_CLOSED         = X6 (cross-app)
  //       The admin app cannot address the reporter (rule 30 — it holds no reporterId);
  //       X5 / X6 each own identity-free delivery. Both carry { reportId, newStatus: target }
  //       ONLY — never any identity / actorId. Both are deferred to their own cross-app
  //       tasks; nothing is sent here.

  D.log({
    message: "A-F10/F11: report note transition applied",
    data: { reportId, from: current, to: target, role },
  });

  cfg.successMessage(reportId).sendResponse();
};

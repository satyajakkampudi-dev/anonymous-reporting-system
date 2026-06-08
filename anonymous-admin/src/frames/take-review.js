// A-E-takeReview — admin "Take review" transition (A-F8).
//
//   OPEN / REOPENED  --(any admin)-->      UNDER_REVIEW
//   ESCALATED        --(secondary only)--> UNDER_REVIEW
//
// Direct transition — NO popup (framework-mapping rule 29; the escalate/resolve/
// closeRejected siblings open a sendQuickFormResponse popup, takeReview does not).
// Triggered by the "Take review" button in the Manage-actions card
// (A-D-manageactions): data-action="intent", intentId = takeReview, data-payload
// '{"reportId":"..."}'. The button is only RENDERED when allowedActions(status, role)
// includes TAKE_REVIEW — but that is a visibility hint, never the authority. The
// authoritative guard is re-run here on a fresh read (rule 12 / ER-B5).
//
// Independent intent (Context B — object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). The admin analogue of the committed user-side withdraw-report.js, with
// the same optimistic-concurrency contract (rule 12):
//   1. Read reportId from the payload (one level deep under .payload, never the top
//      level — CLAUDE.md "Custom HTML Payloads"); missing → 400.
//   2. Authorise: re-resolve the caller's admin ROLE authoritatively against the
//      seeded admin-users registry (lib/access.resolveAdminRole — the SINGLE gating
//      source, D3). We do NOT trust the STATE_KEYS.ADMIN_ROLE stash for an
//      authorisation decision: it is a display hint, can be stale, and a transition
//      is security-sensitive. A thrown read (poor maritime link) is NOT a deny — show
//      a neutral retry and STOP (same reasoning as the A-F1 access gate). A null role
//      (caller not an admin) → refuse; A-F1 should already have blocked them, this is
//      defence in depth.
//   3. Attach to the existing context (Context.Create — Redis-only, preserves the
//      buffer, rule 22) and re-read the report fresh from MongoDB by reportId
//      (adminReportDoc.loadDocument). loadDocument — not the loadReportForAdmin
//      gateway — is correct here because this is a WRITE path: the gateway returns
//      identity-free PLAIN objects (good for display reads, rule 15), not the
//      hydrated, saveable Doc graph a transition needs. Anonymity on this write path
//      is guaranteed by the BINDING layer instead (rule 30): adminReportDoc declares
//      NO reporterId / contactMethod / contactValue field, so loadDocument cannot
//      surface them, and save() persists via a MongoDB `$set` of only the bound
//      fields — leaving the reporter-identity columns in MongoDB untouched (verified:
//      Doc.js _dbDocument → DB.js updateDataInCollection updateOperator "$set").
//   4. Existence: a report that does not exist hydrates no fields → reportId empty →
//      404 (mirrors openManageReport's not-found check). Role-gated, NOT owner-gated
//      (admins manage any report).
//   5. Concurrency + legality: the move must be legal from the CURRENT (just-read)
//      status for THIS role via canTransition(current, UNDER_REVIEW, role). Because
//      step 3 re-read fresh, `current` is the latest persisted status — so a stale
//      client (another admin already took/resolved/escalated it, or a double-click
//      already moved it to UNDER_REVIEW) is REJECTED and surfaced, never overwritten.
//      canTransition also enforces the role split: ESCALATED → UNDER_REVIEW is the
//      SECONDARY admin's alone (actorSatisfies); a PRIMARY opening an escalated report
//      never even sees the button, and is rejected here if they reach it. This
//      fresh-read + canTransition check IS the concurrency guard — a true CAS via
//      save(false, { reportId, version }) is UNSAFE because Doc.save() forces
//      { upsert: true }, so a non-matching version query would INSERT a corrupt
//      duplicate report rather than no-op (same reasoning as the user-side
//      transitions). version is still advanced monotonically (read → read+1) so other
//      writers' guards and the audit trail stay coherent.
//   6. Apply: status = UNDER_REVIEW, bump version, stamp updatedOn. assignedTo is NOT
//      touched — taking review does not re-route the report (OPEN/REOPENED stay with
//      the primary, ESCALATED stays SECONDARY_ADMIN); only escalate re-assigns (A-F10,
//      rule 14). Append ONE statusHistory row via the transition path (actorRole =
//      the admin's ROLE token, never an id — anonymity, rule 16).
//   7. Persist (adminReportDoc.save() — audit: true records the admin action, NFR-3).
//      A save abort adds to the error stack WITHOUT throwing — detect it the same way
//      the user-side transitions do and do not claim success.
//   8. X5 hook (deferred — see the post-save comment below).
//
// CROSS-APP X5 (deferred — NOT silently skipped). The acceptance criterion calls for
// MSG_REPORT_STATUS_CHANGED to the reporter after save(). The admin app, by design,
// CANNOT address the reporter: sendMessageToUserInBot REQUIRES a userIds array of
// receiver-bot users (docs/frontm-ai-inter-intent-bot-to-bot-messaging-guide), and the
// admin app holds no reporterId (rule 30 binding layer). Resolving identity-free
// delivery (a relay user in the user bot, or a broadcast the user-side U-X5 receiver
// filters by reportId ownership) is the explicit responsibility of cross-app task X5,
// which DEPENDS on this task + U-F14. So the sender is left as a documented post-save
// hook here, exactly mirroring the committed U-F8 precedent (submit-report.js leaves
// the X1 sender as a hook: "Built by task X1"). The transition, guard, audit and
// statusHistory are all complete and correct without it.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { adminReportDoc } from "../docs/admin-report-doc";
import {
  reportIdField,
  statusField,
  versionField,
  updatedOnField,
} from "../sections/manual-log";
import { appendStatusHistoryRow } from "./status-history-writer";
import { resolveAdminRole } from "../../../lib/access";
import { canTransition, STATUS, statusLabel } from "../../../lib/ticket-status";
import { ERROR_CODES, MSG, STATIC_DATA_KEYS } from "../../../lib/constants";
import {
  broadcastBotMessage,
  resolvePeerBotId,
} from "../../../lib/notifications";
import { INTENT } from "../constants";

export const takeReview = Intent.Create({
  intentId: INTENT.TAKE_REVIEW,
  prompt: "Take a report into review",
  state,
});

takeReview.onResolution = async () => {
  // 1. Payload (one level deep under .payload — never the top level).
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for takeReview");
    return;
  }

  // 2. Authorise — authoritative role re-resolution (NOT the display stash). A thrown
  //    read is a neutral retry, not a deny (never accuse a legitimate admin).
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F8: takeReview role resolution failed",
      data: { reportId, error: String(error) },
    });
    "We couldn't verify your access just now. Please try again in a moment.".sendResponse();
    return;
  }
  if (!role) {
    state.addErrorToStack(
      ERROR_CODES.NOT_AN_ADMIN,
      "You do not have permission to take this report into review."
    );
    return;
  }

  // 3. Attach to the existing context, then re-read the report fresh (rule 12).
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  await adminReportDoc.loadDocument({ reportId });

  // 4. Existence — no hydrated reportId means the report was not found.
  if (!adminReportDoc.f[reportIdField.id]?.value) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // 5. Concurrency + legality: the move must be legal from the CURRENT (just-read)
  //    status for THIS role. Catches a concurrent move-on / double-click and enforces
  //    the ESCALATED → UNDER_REVIEW secondary-only split — rejected and surfaced,
  //    never overwritten.
  const current = adminReportDoc.f[statusField.id]?.value || "";
  if (!canTransition(current, STATUS.UNDER_REVIEW, role)) {
    state.addErrorToStack(
      ERROR_CODES.ILLEGAL_TRANSITION,
      `This report can no longer be taken into review — it is now "${statusLabel(current)}". Please refresh to see the latest update.`
    );
    D.log({
      message: "A-F8: takeReview rejected — illegal/stale transition",
      data: { reportId, current, to: STATUS.UNDER_REVIEW, role },
    });
    return;
  }

  // 6. Apply the transition. version advances monotonically (read → read+1).
  //    assignedTo is intentionally NOT changed (takeReview does not re-route).
  const now = Date.now();
  adminReportDoc.f[statusField.id].value = STATUS.UNDER_REVIEW;
  adminReportDoc.f[versionField.id].value =
    Number(adminReportDoc.f[versionField.id]?.value || 0) + 1;
  adminReportDoc.f[updatedOnField.id].value = now;

  // One statusHistory row, atomic with the report write (rule 12). actorRole is the
  // admin's ROLE token (== ACTOR_ROLE.PRIMARY_ADMIN / SECONDARY_ADMIN) — never an id.
  appendStatusHistoryRow(adminReportDoc, {
    fromStatus: current,
    toStatus: STATUS.UNDER_REVIEW,
    actorRole: role,
  });

  // 7. Persist. save() (audit: true, NFR-3) re-runs the Doc/field onSave gates; a gate
  //    abort adds to the error stack WITHOUT throwing — detect it and do not claim
  //    success (mirrors the user-side transitions / U-F8).
  const errorsBefore = (state.errorStack || []).length;
  try {
    await adminReportDoc.save();
  } catch (error) {
    state.addSystemErrorToStack(
      500,
      "We could not update this report just now. Please try again."
    );
    D.log({
      message: "A-F8: report save failed on takeReview",
      data: { reportId, error: String(error) },
    });
    return;
  }
  if ((state.errorStack || []).length > errorsBefore) {
    return;
  }

  // 8. Post-save hook (rule 16) — X5 MSG_REPORT_STATUS_CHANGED. The admin app holds NO
  //    reporterId (rule 30) so it CANNOT address the reporter. We BROADCAST an
  //    identity-free { reportId, newStatus: UNDER_REVIEW } to the entire user bot; the
  //    user-side receiver (report-status-changed.js) loads by reportId and notifies ONLY
  //    its owning reporter (reporterId === state.user.userId — the ownership filter).
  //    Best-effort, AFTER save(); a broadcast failure NEVER rolls back the transition.
  try {
    const userBotId = await resolvePeerBotId(STATIC_DATA_KEYS.USER_BOT_ID);
    await broadcastBotMessage({
      type: MSG.REPORT_STATUS_CHANGED,
      botId: userBotId,
      payload: { reportId, newStatus: STATUS.UNDER_REVIEW },
    });
  } catch (error) {
    D.log({
      message:
        "A-F8: X5 MSG_REPORT_STATUS_CHANGED broadcast failed (non-fatal)",
      data: { reportId, error: String(error) },
    });
  }

  D.log({
    message: "A-F8: report taken into review",
    data: { reportId, from: current, to: STATUS.UNDER_REVIEW, role },
  });

  `Report **${reportId}** is now **${statusLabel(STATUS.UNDER_REVIEW)}**. It is yours to action — the change has been recorded in the report's timeline.`.sendResponse();
};

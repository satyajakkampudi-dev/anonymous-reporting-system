// Display section: Manage detail actions (schema id: manageActions, row 5). A-D-manageactions
// fills the card with the status- + role-gated action buttons for the opened report (wireframes
// §4 "Actions" bar / input-schema manageActions display_elements):
//   Take review (takeReview) · Override severity (overrideSeverity) · Resolve (resolveReport) ·
//   Escalate (escalateReport) · Close as rejected (closeRejected) · Export (exportReport).
// Each is an inline data-action="intent" button carrying data-payload '{"reportId":"..."}'.
// Clicking does nothing yet - the handlers are later EDIT/custom tasks (A-E-* / A-F14). readOnly:
// true on the card (set in the shell) because it hosts those inline intent clicks. Distinct ids
// (rule 7).
//
// DATA SOURCE (same gateway contract as manage-header / manage-content / manage-resolution).
// onResponse is a Context-A render handler called SYNCHRONOUSLY during adminDisplayDoc.sendResponse()
// (CLAUDE.md "Render handlers are NOT awaited"), so it cannot await a load or a role resolution. Two
// stashes, both written earlier in the session, are read here:
//   • CURRENT_REPORT_ID - set by the openManageReport nav frame (Context B) in the SAME invocation,
//     after it ran the anonymity gateway (loadReportForAdmin → loadReportsForAdmin, which populated
//     reportsCollection.rows). This handler finds the matching loaded row and re-strips it through
//     applyAdminProjection as a second anonymity layer.
//   • ADMIN_ROLE - the caller's resolved ROLE (PRIMARY_ADMIN | SECONDARY_ADMIN), stashed once by the
//     access gate at app-start (durable conversation-scoped field, survives to this invocation).
//
// ACTION GATING is code-enforced, never free-form (the dominant correctness constraint here): the
// legal actions for the report's CURRENT status AND the caller's role come straight from the state-
// machine single source of truth - STATUS_META.allowedActionsByRole (lib/ticket-status, the same map
// the transition guard of framework-mapping rule 12 validates writes against). An illegal move is
// never rendered: e.g. a PRIMARY admin opening an ESCALATED report sees only Override severity +
// Export (escalated reports are the secondary's to take/resolve); a terminal report (CLOSED_* /
// WITHDRAWN) offers only Export. Finer runtime guards (recusal, optimistic-concurrency version
// check) live in the transition frames, not here (rule 12 / ER-B5).
//
// ANONYMITY (rule 30, C1, ER-A2/A3): this section binds NO reporter-identity field and NEVER queries
// `reports` itself - its only source is the gateway-loaded rows, identity-free by construction and
// stripped again here. The buttons carry ONLY the reportId (a non-identity tracking ref).
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case (Dashboard /
// Queue screens, or a report not found) → no allowed actions → renderers emit nothing. A caller with
// no resolved admin role (defensive - the access gate, A-F1, should already have blocked them) also
// yields an empty action set → nothing rendered.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminDisplayDoc } from "../../../docs/admin-display-doc";
import { reportsCollection } from "../../../docs/admin-report-doc";
import {
  applyAdminProjection,
  extractRowData,
} from "../../../../../lib/access";
import {
  allowedActions,
  ACTION,
  STATUS,
  isTerminal,
  statusLabel,
} from "../../../../../lib/ticket-status";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { INTENT, STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const manageActionsDisplaySection = new Section(
  "manageActionsDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 5, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageActionsDisplayCardsSet = new CardsSet(
  "manageActionsDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageActionsDisplaySection.cardsSet = manageActionsDisplayCardsSet;

export const manageActionsDisplayPlaceholderCard = new Card(
  "manageActionsDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageActionsDisplayCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Manage detail actions]</div>',
    state,
  }
);

// Presentation descriptor for each admin action, in wireframe / input-schema order.
// `action` is the STATUS_META gate key (lib/ticket-status ACTION); `intentId` is the
// data-intent-id the button emits (lib INTENT, matching the schema `intent:*` source);
// `group` splits transitions (advance the case) from tools (triage / export) so the
// renderers can lay them out as two clusters; `variant` selects the button styling.
const ACTION_BUTTONS = [
  {
    action: ACTION.TAKE_REVIEW,
    intentId: INTENT.TAKE_REVIEW,
    label: "Take review",
    group: "transition",
    variant: "primary",
  },
  {
    action: ACTION.RESOLVE,
    intentId: INTENT.RESOLVE_REPORT,
    label: "Resolve",
    group: "transition",
    variant: "primary",
  },
  {
    action: ACTION.ESCALATE,
    intentId: INTENT.ESCALATE_REPORT,
    label: "Escalate",
    group: "transition",
    variant: "warning",
  },
  {
    action: ACTION.CLOSE_REJECTED,
    intentId: INTENT.CLOSE_REJECTED,
    label: "Close as rejected",
    group: "transition",
    variant: "danger",
  },
  {
    action: ACTION.OVERRIDE_SEVERITY,
    intentId: INTENT.OVERRIDE_SEVERITY,
    label: "Override severity",
    group: "tool",
    variant: "neutral",
  },
  // Export (A-F14) - TEMPORARILY DISABLED (deferred; revisit the export functionality
  // later). The button is withheld from the manage-actions card and the exportReport
  // intent is no longer registered (commented in main.js). The frame + lib/export.js
  // are left intact for the future re-enable.
  // {
  //   action: ACTION.EXPORT,
  //   intentId: INTENT.EXPORT_REPORT,
  //   label: "Export",
  //   group: "tool",
  //   variant: "neutral",
  // },
];

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer
// (same approach as manage-header / manage-content / manage-resolution).
const toPlainReport = (row) => applyAdminProjection(extractRowData(row));

// Resolve the opened report: the gateway-loaded row whose reportId matches the
// CURRENT_REPORT_ID stash. Returns null when no report is open or none matches
// (empty-safe). Every candidate is stripped through applyAdminProjection.
const readOpenedReport = () => {
  const reportId = state.getField(STATE_KEYS.CURRENT_REPORT_ID);
  if (!reportId) return null;
  const rows = (reportsCollection.rows || []).map(toPlainReport);
  return rows.find((r) => r && r.reportId === reportId) || null;
};

// Build the card content on every render (empty-safe - no allowed actions → no card).
manageActionsDisplaySection.onResponse = () => {
  const report = readOpenedReport();
  const reportId = report?.reportId || "";
  const status = report?.status || "";
  // The caller's resolved ROLE, stashed by the access gate at app-start. Absent →
  // empty action set (defensive: A-F1 should already have blocked a non-admin).
  const role = state.getField(STATE_KEYS.ADMIN_ROLE) || "";

  // Status- + role-gated set - the SINGLE source of truth for which actions are legal
  // (lib/ticket-status). Never re-derived; an action absent here is never rendered.
  const allowed = report && role ? allowedActions(status, role) : [];

  // Two clusters (wireframes §4): forward transitions first, triage/export tools second.
  // Each entry is a presentation-ready descriptor; the renderers compose the markup.
  const transitions = ACTION_BUTTONS.filter(
    (b) => b.group === "transition" && allowed.includes(b.action)
  );

  // Once the report is RESOLVED or terminal (closed/withdrawn), severity no longer
  // drives anything (the case is done / awaiting the reporter), so Override severity is
  // shown DISABLED rather than actionable. Export stays active (you can always export).
  const severityMoot = status === STATUS.RESOLVED || isTerminal(status);
  const tools = ACTION_BUTTONS.filter(
    (b) => b.group === "tool" && allowed.includes(b.action)
  ).map((b) =>
    b.action === ACTION.OVERRIDE_SEVERITY && severityMoot
      ? { ...b, disabled: true }
      : b
  );

  // A disabled status chip shown in the Actions area when the case has no forward
  // transition left for this admin - RESOLVED (green) or a terminal/closed state - so the
  // outcome is visible in the actions bar, not just an empty card. Mirrors the header pill.
  const completedChip =
    status === STATUS.RESOLVED
      ? { label: "Resolved", tone: "success" }
      : isTerminal(status)
        ? { label: statusLabel(status), tone: "neutral" }
        : null;

  const data = {
    // Nothing legal to do (no report open, no role) AND no completed chip → emit "".
    hasActions: transitions.length + tools.length > 0 || !!completedChip,
    reportId,
    transitions,
    tools,
    completedChip,
  };

  manageActionsDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

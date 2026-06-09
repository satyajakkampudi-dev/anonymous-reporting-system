// Display section: Report detail actions (schema id: detailActions, row 7).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-detailactions fills the card content with the reporter's status-gated action
// buttons (wireframes §4 "Actions" bar / input-schema detailActions display_elements):
//   Amend (addAmendment) · Withdraw (withdrawReport) · Accept (acceptResolution) ·
//   Reject (rejectResolution). Each is an inline data-action="intent" button carrying
//   data-payload '{"reportId":"..."}'. readOnly:true on the card (set in the shell)
//   because it hosts those inline intent clicks.
//
// Single SYNC render path: detailActionsSection.onResponse fires on every
// reportDisplayDoc.sendResponse() (same invocation as openReportDetail's
// reportDoc.loadDocument — Context-A, graph live). It reads the loaded reportDoc
// scalar fields and dispatches via renderForPlatform. No async work, no S3, so the
// handler stays synchronous (section.onResponse is NOT awaited — CLAUDE.md render-
// handler rule); a prepare() helper like detail-content's is unnecessary.
//
// Action GATING is code-enforced, never free-form: the reporter's allowed actions
// for the report's CURRENT status come straight from the state-machine single source
// of truth — STATUS_META.allowedActionsByRole[ACTOR_ROLE.REPORTER] (lib/ticket-status,
// the same map the transition guard of framework-mapping rule 12 validates writes
// against) — so an illegal action is never rendered. Reject carries the extra
// REOPEN_CAP guard
// (reopenCount < 1, D10) — once a report has been reopened once, Reject is withheld
// even though STATUS_META still lists it for a RESOLVED report. Empty-safe: on
// Home / My-Reports no report is loaded → no allowed actions → renders nothing; a
// terminal report (WITHDRAWN / CLOSED_*) has an empty reporter action set → nothing.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import {
  reportIdField,
  statusField,
  reopenCountField,
} from "../../report-details";
import { allowedActions, ACTION } from "../../../../../lib/ticket-status";
import { ACTOR_ROLE, REOPEN_CAP } from "../../../../../lib/constants";
import { INTENT } from "../../../constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const detailActionsSection = new Section("detailActionsSection", {
  doc: reportDisplayDoc,
  grid: { row: 7, column: 0 },
  borderless: true,
  collapsable: false,
  state,
});

export const detailActionsCardsSet = new CardsSet("detailActionsCardsSet", {
  type: CARD_TYPES.HTML,
  state,
});

detailActionsSection.cardsSet = detailActionsCardsSet;

export const detailActionsPlaceholderCard = new Card(
  "detailActionsPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: detailActionsCardsSet,
    readOnly: true,
    content: '<div class="placeholder">[Report detail actions]</div>',
    state,
  }
);

// Build the card content on every render (empty-safe — no allowed actions → no card).
detailActionsSection.onResponse = () => {
  const reportId = reportDoc.f[reportIdField.id]?.value || "";
  const status = reportDoc.f[statusField.id]?.value || "";
  // reopenCount defaults to 0; coerce defensively (NUMBER_FIELD, may be unset).
  const reopenCount = Number(reportDoc.f[reopenCountField.id]?.value || 0);

  // Status- + role-gated set — the SINGLE source of truth for which actions are
  // legal for the reporter on this status (lib/ticket-status). Never re-derived.
  const allowed = reportId ? allowedActions(status, ACTOR_ROLE.REPORTER) : [];

  // Two semantic groups (wireframes §4): lifecycle actions on the left, resolution
  // responses on the right. Each entry is a presentation-ready button descriptor;
  // the per-platform renderers compose the actual markup + variant styling.
  const lifecycle = [];
  if (allowed.includes(ACTION.AMEND)) {
    lifecycle.push({
      intentId: INTENT.ADD_AMENDMENT,
      label: "Amend",
      variant: "neutral",
    });
  }
  if (allowed.includes(ACTION.WITHDRAW)) {
    lifecycle.push({
      intentId: INTENT.WITHDRAW_REPORT,
      label: "Withdraw",
      variant: "neutral",
    });
  }

  const resolution = [];
  if (allowed.includes(ACTION.ACCEPT)) {
    resolution.push({
      intentId: INTENT.ACCEPT_RESOLUTION,
      label: "Accept",
      variant: "primary",
    });
  }
  // Reject: status allows it AND the report has not already been reopened (D10,
  // REOPEN_CAP). Withholding here matches the frame-level reopen-cap guard (U-F11).
  const rejectAllowedByStatus = allowed.includes(ACTION.REJECT);
  if (rejectAllowedByStatus && reopenCount < REOPEN_CAP) {
    resolution.push({
      intentId: INTENT.REJECT_RESOLUTION,
      label: "Reject",
      variant: "danger",
    });
  }

  // Hint: the status WOULD allow Reject (i.e. the report is RESOLVED) but the one-reopen
  // cap (D10) is reached — so only Accept is offered. Explain WHY, rather than silently
  // dropping the Reject button, so the reporter understands the report can't be reopened
  // again. Shown beside the remaining Accept action.
  const reopenCapReached = rejectAllowedByStatus && reopenCount >= REOPEN_CAP;

  const data = {
    // Nothing legal to do (no report loaded, or terminal status) → renderer emits "".
    hasActions: lifecycle.length + resolution.length > 0,
    reportId,
    lifecycle,
    resolution,
    reopenCapNote: reopenCapReached
      ? "You've already reopened this report once, so it can't be reopened again. You can still accept the resolution."
      : "",
  };

  detailActionsPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

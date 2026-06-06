// Display section: Status timeline (schema id: statusHistory, row 4).
// Shell (Section + CardsSet + placeholder Card + grid) was built in DISPLAY-SHELL;
// U-D-statushistory fills the card content with the report's status timeline.
// Display-only (no buttons — the timeline is a read echo of the transition log) →
// readOnly not required.
//
// ANONYMITY (rule 16, SPEC.md): the statusHistory rows carry actorRole ONLY, never
// an id. This renderer surfaces a friendly role label (You / Compliance / System) —
// it MUST never expose reporterId, an admin id, or any identity beyond the role.
//
// Single SYNC render path: statusHistoryDisplaySection.onResponse fires on every
// reportDisplayDoc.sendResponse(). It reads the already-loaded statusHistoryCollection
// rows (populated by openReportDetail BEFORE sendResponse) and dispatches via
// renderForPlatform. No async work, no S3 — so unlike detail-content / amendments
// there is no prepare() helper; the handler stays synchronous (section.onResponse is
// NOT awaited — render-handler rule). Empty-safe: on Home / My-Reports no report is
// loaded → hasReport:false → renders nothing; a loaded report always has at least the
// OPEN row, but a zero-row collection falls back to the empty state.

import { Section } from "@frontmltd/frontmjs/core/Section";
import { Card, CardsSet } from "@frontmltd/frontmjs/core/Card";
import { CARD_TYPES } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";
import { reportDisplayDoc } from "../../../docs/report-display-doc";
import { reportDoc } from "../../../../../lib/collections/reports";
import { reportIdField } from "../../report-details";
import {
  statusHistoryCollection,
  toStatusField,
  changedOnField,
  actorRoleField,
  noteField,
} from "../../status-history";
import { ACTOR_ROLE } from "../../../../../lib/constants";
import { renderForPlatform } from "../../../../../lib/utils/platform";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const statusHistoryDisplaySection = new Section(
  "statusHistoryDisplaySection",
  {
    doc: reportDisplayDoc,
    grid: { row: 4, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const statusHistoryDisplayCardsSet = new CardsSet(
  "statusHistoryDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

statusHistoryDisplaySection.cardsSet = statusHistoryDisplayCardsSet;

export const statusHistoryDisplayPlaceholderCard = new Card(
  "statusHistoryDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: statusHistoryDisplayCardsSet,
    content: '<div class="placeholder">[Status timeline]</div>',
    state,
  }
);

// Friendly, role-ONLY actor label (anonymity, rule 16). Both admin roles collapse to
// a single "Compliance" label — the reporter never needs (and must never see) the
// primary/secondary distinction or any id. Unknown/missing role degrades to "".
const ACTOR_LABEL = {
  [ACTOR_ROLE.REPORTER]: "You",
  [ACTOR_ROLE.PRIMARY_ADMIN]: "Compliance",
  [ACTOR_ROLE.SECONDARY_ADMIN]: "Compliance",
  [ACTOR_ROLE.SYSTEM]: "System",
};

// Build the card content on every render (empty-safe — no report loaded → no card).
statusHistoryDisplaySection.onResponse = () => {
  const reportId = reportDoc.f[reportIdField.id]?.value || "";

  // Map the loaded transition rows to a presentation shape. toStatus drives the pill
  // (label + tone resolved in the renderer via statusPillHtml); actorRole is mapped
  // to a friendly role label here (never an id).
  const rows = (statusHistoryCollection.rows || []).map((row) => ({
    toStatus: row.f[toStatusField.id]?.value || "",
    changedOn: row.f[changedOnField.id]?.value ?? null,
    actorLabel: ACTOR_LABEL[row.f[actorRoleField.id]?.value] || "",
    note: row.f[noteField.id]?.value || "",
  }));

  // Newest first — the most recent transition leads the timeline (wireframe §4).
  rows.sort((a, b) => (Number(b.changedOn) || 0) - (Number(a.changedOn) || 0));

  const data = {
    // No report loaded (Home / My-Reports screens) → the renderer emits nothing.
    hasReport: !!reportId,
    rows,
  };

  statusHistoryDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

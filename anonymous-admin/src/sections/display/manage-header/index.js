// Display section: Manage detail header (schema id: manageHeader, row 2). A-D-manageheader
// fills the card with tracking id, status pill, severity tone, assigned role, category,
// urgency, created date for the opened report (gateway projection - NO identity).
//
// DATA SOURCE. onResponse is a Context-A render handler called SYNCHRONOUSLY during
// adminDisplayDoc.sendResponse() (CLAUDE.md "Render handlers are NOT awaited"), so it
// cannot await a load. The openManageReport nav frame (Context B) has already run the
// anonymity gateway - loadReportForAdmin({ reportId }) → loadReportsForAdmin, which
// populates reportsCollection.rows - and stashed the reportId (STATE_KEYS.CURRENT_REPORT_ID)
// in the SAME invocation. This handler reads that id, finds the matching loaded row, and
// re-strips it through applyAdminProjection as a second anonymity layer (mirrors the queue).
//
// ANONYMITY (the dominant constraint): this section binds NO reporter-identity field
// (rule 30, C1, ER-A2) and NEVER queries `reports` itself (ER-A3) - its only source is the
// gateway-loaded rows, identity-free by construction and stripped again here.
//
// EMPTY-SAFE: onResponse fires for every sendResponse(), including the no-report case
// (Dashboard / Queue screens, or a report not found) → hasReport:false → renderers emit
// nothing. Pure display (no inline buttons) → readOnly omitted. Distinct ids (rule 7).
//
// SANITISATION (rule 10): the header binds only id / enum-token / date fields - no
// free-text - so escaping at the format-primitive boundary (escapeHtml in the renderers)
// is the full requirement; no lib/validation.js sanitiser is needed for these values.

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
import { renderForPlatform } from "../../../../../lib/utils/platform";
import {
  CATEGORY_LABELS,
  URGENCY_LABELS,
  SEVERITY_LABELS,
  ROLE,
} from "../../../../../lib/constants";
import { STATE_KEYS } from "../../../constants";
import { renderWeb } from "./web";
import { renderMobile } from "./mobile";

export const manageHeaderDisplaySection = new Section(
  "manageHeaderDisplaySection",
  {
    doc: adminDisplayDoc,
    grid: { row: 2, column: 0 },
    borderless: true,
    collapsable: false,
    state,
  }
);

export const manageHeaderDisplayCardsSet = new CardsSet(
  "manageHeaderDisplayCardsSet",
  {
    type: CARD_TYPES.HTML,
    state,
  }
);

manageHeaderDisplaySection.cardsSet = manageHeaderDisplayCardsSet;

export const manageHeaderDisplayPlaceholderCard = new Card(
  "manageHeaderDisplayPlaceholderCard",
  {
    type: CARD_TYPES.HTML,
    cardsSet: manageHeaderDisplayCardsSet,
    content: '<div class="placeholder">[Manage detail header]</div>',
    state,
  }
);

// Assigned-role display label (display_elements "Assigned"). The header shows the
// routing target as a readable role; unset → "Unassigned".
const ASSIGNED_LABELS = {
  [ROLE.PRIMARY_ADMIN]: "Primary admin",
  [ROLE.SECONDARY_ADMIN]: "Secondary admin",
};

// Normalise a loaded collection row into a plain, identity-free object using the
// shared lib/access.extractRowData (reads field values by dbName) and re-applies
// applyAdminProjection as a second anonymity layer.
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

// Build the card content on every render (empty-safe - no report open → no card).
manageHeaderDisplaySection.onResponse = () => {
  const report = readOpenedReport();

  const severityToken = report?.severity || "";
  const assignedToken = report?.assignedTo || "";

  const data = {
    // No report open (Dashboard / Queue screens, or not found) → renderer emits nothing.
    hasReport: !!report,
    reportId: report?.reportId || "",
    status: report?.status || "", // STATUS token → statusPillHtml resolves label + tone
    severity: severityToken, // SEVERITY token → severityColors() resolves the tone
    severityLabel: SEVERITY_LABELS[severityToken] || severityToken || "-",
    assigned: ASSIGNED_LABELS[assignedToken] || "Unassigned",
    category: CATEGORY_LABELS[report?.category] || report?.category || "-",
    urgency: URGENCY_LABELS[report?.urgency] || report?.urgency || "-",
    createdOn: report?.createdOn || null,
  };

  manageHeaderDisplayPlaceholderCard.content = renderForPlatform(data, {
    web: renderWeb,
    mobile: renderMobile,
  });
};

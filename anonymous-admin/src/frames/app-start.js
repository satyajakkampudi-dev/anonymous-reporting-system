// App entry logic for main.onResolution — the ACCESS-GATE-THEN-BOOTSTRAP ordering
// (framework-mapping rule 27; CLAUDE.md "App Entry-Point Bootstrap"). A-F1 enriches
// the gate's refusal UX later; the ORDERING is owned here and is non-negotiable.
//
// Order (rule 27):
//   1. Access gate (Context B, BEFORE the bootstrap): resolve the caller's admin ROLE
//      against the seeded admin-users registry (lib/access.js). On DENY → render a
//      refusal and STOP: no Context.CreateAndInit, no gateway read.
//   2. On ALLOW → state.setField the role (for the queue role-filter, A-F4).
//   3. Context.CreateAndInit("mainApp") — adminReportDoc is autoSave: true (D-L3-2),
//      so the bootstrap is MANDATORY (rule 17); missing it silently disables every
//      autoSaveBuffer write. Runs AFTER the gate passes.
//   4. Gateway load only (rule 15): loadReportsForAdmin applies { projection:
//      adminProjection } — admin code NEVER queries `reports` directly.
//   5. Render the DISPLAY Doc (Two-Doc, rule 4/8): hide the tab bar, then
//      adminDisplayDoc.sendResponse(). adminReportDoc (the Data Doc) is NEVER sent — it
//      owns the Fields + persistence; adminDisplayDoc owns the CardsSet screens. The
//      Dashboard is grid row 0, so it leads; A-D-* tasks fill each card's content.

import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { resolveAdminRole, loadReportsForAdmin } from "../../../lib/access";
import { buildDashboardStats } from "../../../lib/dashboard-stats";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { sendAccessRefusal } from "../sections/display/access-refusal";
import { showScreen, SCREEN } from "./display-nav";
import { CONTEXT, STATE_KEYS } from "../constants";

// Side-effect imports: register every Section + Field on adminReportDoc, the two
// embedded sub-collections, the per-action popups, and the aux-doc field schemas so
// the Data model is fully populated at bundle load.
import "../sections/manual-log";
import "../sections/resolve-popup";
import "../sections/severity-popup";
import "../sections/transition-note-popup";
import "../sections/status-history";
import "../sections/amendments";
import "../sections/admin-user";
import "../sections/call-queue";

// Side-effect imports: register every Display Doc CardsSet section so the shell is
// laid out (grid rows 0–10, input-schema order) before sendResponse(). A-D-* tasks
// fill the card content per platform via renderForPlatform.
import "../sections/display/dashboard";
import "../sections/display/report-queue";
import "../sections/display/manage-header";
import "../sections/display/manage-content";
import "../sections/display/manage-resolution";
import "../sections/display/manage-actions";
import "../sections/display/status-history";
import "../sections/display/amendments";
import "../sections/display/alerts";
import "../sections/display/on-call";
import "../sections/display/incoming-call";

export const appStart = async () => {
  // 1. Access gate — Context B, before any bootstrap or gateway read (rule 27).
  //    resolveAdminRole reads the seeded admin-users registry (lib/access.js — the
  //    SINGLE gating source, D3; no hardcoded allowlist). It performs a MongoDB read,
  //    so on a poor maritime link it can throw. A thrown error is NOT a deny — it
  //    must never accuse a legitimate admin, and (rule 27) must never fall through to
  //    the bootstrap. So: catch it, show a neutral retry message, and STOP — same
  //    no-bootstrap / no-gateway-read outcome as a deny, different copy.
  let role;
  try {
    role = await resolveAdminRole();
  } catch (error) {
    D.log({
      message: "A-F1: access-gate role resolution failed",
      data: { error: String(error) },
    });
    "We couldn't verify your access just now. Please try opening the console again in a moment.".sendResponse();
    return;
  }

  if (!role) {
    // DENY (caller not in the admin-users registry): clear refusal card, then STOP.
    // No Context.CreateAndInit, no gateway read — nothing is loaded behind the wall.
    D.log({ message: "A-F1: access denied (caller not an admin)" });
    sendAccessRefusal();
    return;
  }

  // 2. Stash the resolved role for the queue role-filter (A-F4).
  state.setField(STATE_KEYS.ADMIN_ROLE, role);

  // 3. Context bootstrap — BEFORE any loadDocument / buffer write.
  await Context.CreateAndInit(CONTEXT.MAIN_APP, { state });

  // 4. Gateway load only (rule 15): identity-free, projection applied.
  const reports = await loadReportsForAdmin({});

  // 4a. Dashboard aggregation (A-F2) — compute counts + small-cell suppression over
  //     the SAME gateway rows the consumer expects, and stash for the A-D-dashboard
  //     renderer (rule 28, ER-A6). buildDashboardStats is pure + empty-safe; the
  //     renderer NEVER aggregates raw rows itself (per-ship counts must arrive already
  //     suppressed). DASHBOARD_STATS is the single contract between the two tasks.
  state.setField(STATE_KEYS.DASHBOARD_STATS, buildDashboardStats(reports));

  // 5. Render the Display Doc. Single-tab app → hide the (empty) tab bar first. Open on
  //    the DASHBOARD screen (dashboard + alerts/digest visible; all other exclusive
  //    sections hidden) via showScreen — NOT all sections stacked. incoming-call is the
  //    overlay (never hidden, self-gates on RINGING). adminReportDoc (Data Doc) is NEVER
  //    sent (rule 4/8).
  showScreen(SCREEN.DASHBOARD);
  adminDisplayDoc.tabBarHidden = true;
  adminDisplayDoc.sendResponse();
};

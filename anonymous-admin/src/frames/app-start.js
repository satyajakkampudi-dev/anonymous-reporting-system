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
import { frontmAdminRole } from "../../../lib/constants";
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
  // PRIMARY entitlement: the FrontM admin role in state.user.roles (quitelineprimaryadmin
  // → PRIMARY, quitelinesecondaryadmin → SECONDARY; sailorscartadmin → PRIMARY as a
  // TEMPORARY dev-test role — see APP_ROLES/frontmAdminRole, remove before prod). The
  // sailors-cart admin access-gate pattern. The admin-users registry (D3) is the
  // SECONDARY source: it supplies PRIMARY/SECONDARY for curated admins and acts as a
  // fallback gate. The gate opens if EITHER yields a role; a non-admin hits the wall.
  const frontmRole = frontmAdminRole(state);

  let registryRole;
  try {
    registryRole = await resolveAdminRole();
  } catch (error) {
    // A thrown registry read (poor maritime link) is NOT a deny — never accuse a
    // legitimate admin, and never fall through to the bootstrap (rule 27). Neutral retry.
    D.warning({
      message: "A-F1: admin-users lookup failed",
      data: { error: String(error) },
    });
    "We couldn't verify your access just now. Please try opening the console again in a moment.".sendResponse();
    return;
  }

  // Always-visible decision trace (run-profile independent) — confirms the actual
  // state.client (cloud vs edge) and the role codes present, for diagnosis.
  D.warning({
    message: "A-F1: access gate decision",
    data: {
      client: state.client,
      roles: state.user && state.user.roles,
      frontmRole,
      registryRole,
    },
  });

  if (!frontmRole && !registryRole) {
    // DENY (neither a FrontM admin role nor a curated registry row): refusal, STOP.
    // No Context.CreateAndInit, no gateway read — nothing is loaded behind the wall.
    sendAccessRefusal();
    return;
  }

  // 2. Effective in-app routing role: the FrontM-role level takes precedence (the
  //    provisioned entitlement), else the curated registry value. Stash for A-F4.
  const role = frontmRole || registryRole;
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

  // 5. Render the Display Doc. Open on the DASHBOARD screen (dashboard + alerts/digest
  //    visible; all other exclusive sections hidden) via showScreen — NOT all sections
  //    stacked. incoming-call is the overlay (never hidden, self-gates on RINGING).
  //    adminReportDoc (Data Doc) is NEVER sent (rule 4/8).
  //    NOTE: do NOT set tabBarHidden = true — it leaves no active tab, so the framework
  //    never sets state.currentTabId, and every subsequent invoke_intent nav
  //    (Context.Create(state.currentTabId)) crashes ("Cannot set properties of undefined
  //    (setting 'currentTabId')"). Sailors-cart keeps the tab bar visible for this reason.
  showScreen(SCREEN.DASHBOARD);
  adminDisplayDoc.sendResponse();
};

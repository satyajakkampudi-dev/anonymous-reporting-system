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
import {
  resolveAdminRole,
  resolveAdminIdentity,
  loadReportsForAdmin,
  backfillPriorityRank,
} from "../../../lib/access";
import { frontmAdminRole, userTab } from "../../../lib/constants";
import { buildDashboardStats } from "../../../lib/dashboard-stats";
import { roleVisibleReports } from "../../../lib/queue";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { hydrateNotificationFailureStash } from "./admin-notify";
import { showScreen, SCREEN } from "./display-nav";
import {
  CONTEXT,
  STATE_KEYS,
  SHARED_KEYS,
  PRIORITY_RANK_BACKFILL_TTL_SECONDS,
} from "../constants";

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
import "../sections/display/access-refusal";
import { armSlaDigestSweep } from "./sla-digest";

export const appStart = async () => {
  // 0. Context bootstrap FIRST (rule 27, MP-FIX-ACCESS-REFUSAL-RENDER) — Context.CreateAndInit
  //    creates the conversation tab / state.currentTabId that ANY render needs (deny, retry,
  //    or allow). Without it, sendResponse has no tab and the screen renders BLANK. Harmless
  //    for a denied user (an empty tab; no field writes). adminReportDoc is autoSave:true
  //    (rule 17) so the bootstrap is mandatory regardless.
  await Context.CreateAndInit(userTab(CONTEXT.MAIN_APP, state), { state });

  // 1. Access gate (rule 27).
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
    // DENY (neither a FrontM admin role nor a curated registry row): render the Restricted
    // screen via the Display Doc (showScreen + sendResponse, like every other screen) and
    // STOP — no gateway read, nothing loaded behind the wall. Context already created above.
    showScreen(SCREEN.REFUSAL);
    adminDisplayDoc.sendResponse();
    return;
  }

  // 2. Effective in-app routing role: the FrontM-role level takes precedence (the
  //    provisioned entitlement), else the curated registry value. Stash for A-F4.
  const role = frontmRole || registryRole;
  state.setField(STATE_KEYS.ADMIN_ROLE, role);

  // 3b. One-time legacy priorityRank backfill (MP-FIX-QUEUE-SERVER-PAGINATION). The queue
  //     now sorts on the STORED priorityRank column; rows predating it have none and would
  //     mis-sort (missing < 0 in an ascending sort → false float to the top). Stamp them
  //     ONCE, latched cross-admin in a sharedField so only the first session after deploy
  //     pays it. Best-effort: a failure logs and is NOT latched (retries next session) and
  //     never blocks the shell. Set the latch only on success.
  try {
    const done = await state.getSharedField(
      SHARED_KEYS.PRIORITY_RANK_BACKFILL_DONE
    );
    if (!done) {
      await backfillPriorityRank();
      await state.setSharedField(
        SHARED_KEYS.PRIORITY_RANK_BACKFILL_DONE,
        true,
        PRIORITY_RANK_BACKFILL_TTL_SECONDS
      );
    }
  } catch (error) {
    D.log({
      message:
        "app-start: priorityRank backfill skipped (will retry next session)",
      data: { error: String(error) },
    });
  }

  // 4. Gateway load only (rule 15): identity-free, projection applied.
  const reports = await loadReportsForAdmin({});

  // DIAGNOSTIC — confirm the shared reports_<systemId> read returns the user-submitted
  // reports to the admin bot. D.warning → always visible on logz.io regardless of run
  // profile. If count is 0 here but rows exist in MongoDB, the shared-collection read
  // (systemId/domain) is the issue; if count ≥ 1, it is a render/role-filter concern.
  D.warning({
    message: "ADMIN app-start — loadReportsForAdmin result",
    data: {
      count: reports.length,
      ids: reports.map((r) => r.reportId),
      statuses: reports.map((r) => r.status),
      assignedTo: reports.map((r) => r.assignedTo),
      systemId: state.systemId,
      domain: state.currentUserDomain,
    },
  });

  // 4a. ROLE-SCOPED dashboard (REQUIREMENTS §3 / A-F4 — dashboard + queue are role-filtered).
  //     PRIMARY counts only PRIMARY-routed reports; SECONDARY counts everything. `role` is the
  //     viewing role resolved above; identity drives recusal. Filter via the shared
  //     roleVisibleReports (same routing + recusal as the queue), then aggregate.
  //     buildDashboardStats is pure + empty-safe; the renderer NEVER aggregates raw rows itself.
  const identity = await resolveAdminIdentity();
  const visible = roleVisibleReports({ reports, viewingRole: role, identity });
  state.setField(STATE_KEYS.DASHBOARD_STATS, buildDashboardStats(visible));
  // Stash the role-visible set for the Alerts breach renderer (sync — can't role-filter itself).
  state.setField(STATE_KEYS.ALERTS_REPORTS, visible);

  // 4b. Notification-failure bridge (A-F19, MP-FIX-ALERTS-FAILURE-BRIDGE). Hydrate the
  //     synchronous render stash (STATE_KEYS.NOTIFICATION_FAILURES) from the durable
  //     cross-admin sharedField BEFORE sendResponse — the alerts onResponse is not
  //     awaited and cannot read the async sharedField itself. Best-effort; never blocks.
  await hydrateNotificationFailureStash();

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

  // Kick off the self-rearming SLA-digest backstop sweep (A-F18). Idempotent
  // (deterministic jobId), best-effort — never blocks the dashboard render. Done AFTER
  // sendResponse so a scheduler hiccup can't delay the console opening.
  await armSlaDigestSweep();
};

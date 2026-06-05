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
//   5. Placeholder render. The Dashboard Display Doc is A-DISPLAY-SHELL; this scaffold
//      never sendResponse()s a Data Doc (rule 4/8).

import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { resolveAdminRole, loadReportsForAdmin } from "../../../lib/access";
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

export const appStart = async () => {
  // 1. Access gate — Context B, before any bootstrap or gateway read (rule 27).
  const role = await resolveAdminRole();
  if (!role) {
    // DENY: clear refusal, then STOP. No bootstrap, no read.
    "This console is restricted to the compliance team.".sendResponse();
    return;
  }

  // 2. Stash the resolved role for the queue role-filter (A-F4).
  state.setField(STATE_KEYS.ADMIN_ROLE, role);

  // 3. Context bootstrap — BEFORE any loadDocument / buffer write.
  await Context.CreateAndInit(CONTEXT.MAIN_APP, { state });

  // 4. Gateway load only (rule 15): identity-free, projection applied.
  await loadReportsForAdmin({});

  // 5. Placeholder render — the Dashboard Display Doc is A-DISPLAY-SHELL.
  "Admin console ready. The dashboard is added in the display task.".sendResponse();
};

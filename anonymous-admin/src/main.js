import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";

// --- Shared lib (side-effect: registers the shared Docs + Collections) ---
import "../../lib/collections/reports";
import "../../lib/collections/call-queue";
import "../../lib/collections/admin-availability";

// --- Feature modules ---
// The admin access gate, dashboard, queue, manage views, jobs, analytics, on-call
// availability, and incoming-call handling are imported here as they are added
// during the build phase (see ../../REQUIREMENTS.md §8, "Admin app" + "Calling").
// Access is role-gated (FR-A1).

export const main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "Anonymous Reporting — admin console",
  state,
});

main.onResolution = async () => {
  "Anonymous Reporting (admin app) — skeleton".sendResponse();
};

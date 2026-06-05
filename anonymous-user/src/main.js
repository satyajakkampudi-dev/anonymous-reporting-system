import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { SYSTEM_INTENTS } from "@frontmltd/frontmjs/core/ALLConstants";
import { state } from "@frontmltd/frontmjs/core/State";

// --- Shared lib (side-effect: registers the shared Docs + Collections) ---
import "../../lib/collections/reports";
import "../../lib/collections/call-queue";
import "../../lib/collections/admin-availability";

// --- Feature modules ---
// Collections / docs / sections / frames are imported here as they are added
// during the build phase (see ../../REQUIREMENTS.md §8, "User app" + "Calling").

export const main = Intent.Create({
  intentId: SYSTEM_INTENTS.MAIN,
  prompt: "Anonymous Reporting — submit and track reports",
  state,
});

main.onResolution = async () => {
  "Anonymous Reporting (user app) — skeleton".sendResponse();
};

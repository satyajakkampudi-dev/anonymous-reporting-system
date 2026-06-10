// Navigation intent: openOnCall - the on-call availability screen (A-F20).
//
// Independent intent (Context B). Context.Create preserves the buffer (rule 22). Loads
// the caller's OWN admin-users row by adminUserId (their own identity - not a
// reporter's - so reading it is fine). The availability toggle (setAvailability) and
// the On-call display card are later tasks; SCAFFOLD loads + placeholder render.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminUserDoc } from "../docs/admin-user-doc";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { userTab } from "../../../lib/constants";
import { CONTEXT, INTENT } from "../constants";

export const openOnCall = Intent.Create({
  intentId: INTENT.OPEN_ON_CALL,
  prompt: "Open on-call availability",
  state,
});

openOnCall.onResolution = async () => {
  await Context.CreateAndInit(userTab(CONTEXT.ON_CALL, state), { state }); // stable per-screen tab (rule 37)
  await adminUserDoc.loadDocument({ adminUserId: state.user?.userId });

  // Route to the On-call screen (only the on-call section visible) and render the
  // Display Doc (rule 4/8). The on-call card reads the freshly-loaded adminUserDoc row
  // in its onResponse fired by this sendResponse.
  showScreen(SCREEN.ON_CALL);
  adminDisplayDoc.sendResponse();
};

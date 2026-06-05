// Navigation intent: openOnCall — the on-call availability screen (A-F20).
//
// Independent intent (Context B). Context.Create preserves the buffer (rule 22). Loads
// the caller's OWN admin-users row by adminUserId (their own identity — not a
// reporter's — so reading it is fine). The availability toggle (setAvailability) and
// the On-call display card are later tasks; SCAFFOLD loads + placeholder render.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { state } from "@frontmltd/frontmjs/core/State";
import { adminUserDoc } from "../docs/admin-user-doc";
import { INTENT } from "../constants";

export const openOnCall = Intent.Create({
  intentId: INTENT.OPEN_ON_CALL,
  prompt: "Open on-call availability",
  state,
});

openOnCall.onResolution = async () => {
  await Context.Create(state.currentTabId, { state });
  await adminUserDoc.loadDocument({ adminUserId: state.user?.userId });
  "On-call status. The availability controls are added in the on-call task.".sendResponse();
};

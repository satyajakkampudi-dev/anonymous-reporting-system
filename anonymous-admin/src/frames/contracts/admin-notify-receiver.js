// MSG_ADMIN_NOTIFY RECEIVER - intra-admin-bot notification (framework-mapping rule 32).
//
// The RECEIVING half of the admin notification path for events whose ACTING context is
// NOT the recipient's: escalate (note-transition), auto-escalate (scheduled job), and
// manual-log. Those callers run dispatchAdminNotify, which sends MSG_ADMIN_NOTIFY
// { reportId, event } to the assigned admins' userIds. This receiver runs in EACH
// recipient admin's OWN session, so push-to-self (sendPushToCurrentUser → mobile + web)
// works here - the only place it can for a remote recipient.
//
// INDEPENDENT INTENT (Context B - object graph EMPTY on entry; CLAUDE.md "Invocation
// Lifecycle"). Matched by onMatching === MSG.ADMIN_NOTIFY and nothing else. The payload
// arrives under state.messageFromUser. notifySelf re-reads the report FRESH through the
// single admin gateway (rule 21) and is best-effort (never throws). No sendResponse - no
// interactive user initiated this. Mirrors the X1 receiver (new-report.js) precedent.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { MSG } from "../../../../lib/constants";
import { notifySelf } from "../admin-notify";

export const adminNotifyReceiver = Intent.Create({
  intentId: "adminNotifyReceiver",
  prompt:
    "Receive an intra-admin notification and push/email the recipient admin",
  state,
});

// Match ONLY the MSG_ADMIN_NOTIFY bot-to-bot type.
adminNotifyReceiver.onMatching = () =>
  state.messageTypeFromUser === MSG.ADMIN_NOTIFY;

adminNotifyReceiver.onResolution = async () => {
  // Payload - { reportId, event }, identity-free. reportId is the only field we trust as
  // a key; notifySelf re-reads the rest through the gateway.
  const { reportId, event } = state.messageFromUser || {};
  if (!reportId) {
    D.log({
      message:
        "adminNotifyReceiver: MSG_ADMIN_NOTIFY missing reportId - ignored",
    });
    return;
  }

  // Attach a context (job-receiver precedent, new-report.js) so the gateway load + push
  // run cleanly in this recipient's session.
  await Context.CreateAndInit(`admin_${state.getUniqueId()}`, { state });
  await notifySelf({ reportId, event });
};

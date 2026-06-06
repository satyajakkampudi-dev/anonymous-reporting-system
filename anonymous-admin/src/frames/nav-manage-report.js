// Navigation intent: openManageReport — load one report for the manage detail view.
//
// Independent intent (Context B). The reportId arrives in the invoke_intent envelope
// ONE LEVEL DEEP under .payload (CLAUDE.md "Custom HTML Payloads") — never at the top
// level. Loads the report ONLY through the anonymity gateway (rule 15) —
// loadReportForAdmin applies { projection: adminProjection } and is role-gated, NOT
// owner-gated (admins manage any report). Stash the reportId for the manage cards +
// transition handlers (A-D-manage* / A-E-*). SCAFFOLD: placeholder render.

import { Intent } from "@frontmltd/frontmjs/core/Intent";
import { Context } from "@frontmltd/frontmjs/core/Context";
import { D, state } from "@frontmltd/frontmjs/core/State";
import { loadReportForAdmin } from "../../../lib/access";
import {
  STATIC_DATA_KEYS,
  SIGNED_URL_EXPIRY_SECONDS,
} from "../../../lib/constants";
import { adminDisplayDoc } from "../docs/admin-display-doc";
import { showScreen, SCREEN } from "./display-nav";
import { INTENT, STATE_KEYS } from "../constants";

export const openManageReport = Intent.Create({
  intentId: INTENT.OPEN_MANAGE_REPORT,
  prompt: "Open a report to manage",
  state,
});

// The five reporter-evidence FILE_FIELD dbName keys, in display order
// (specs/3.field-spec.md — mirrors the manage-content consumer's EVIDENCE_KEYS).
// evidenceNotes is reporter TEXT (TEXT_AREA), NOT a file — it is NEVER signed.
const EVIDENCE_KEYS = [
  "evidenceFile1",
  "evidenceFile2",
  "evidenceFile3",
  "evidenceFile4",
  "evidenceFile5",
];

// Resolved media-scope tokens (envelope.fileScopeValue — field-class guide
// § "Media Field Value Shape"). Only DOMAIN-scoped objects are signable from
// the admin app: they carry NO conversation prefix, so the admin can sign the
// raw key. CONVERSATION-scoped (or unset → default conversation) objects live
// under the REPORTER's conversationId, which the admin does NOT have (and must
// not have — anonymity); the admin cannot construct that path with any
// documented API, so such a key is OMITTED (consumer shows "(link unavailable)")
// and FLAGGED — never signed under the admin's own conversationId (that would
// 404 and leak a meaningless path). See deliverable note (c).
const FILE_SCOPE = {
  DOMAIN: "domain",
  CONVERSATION: "conversation",
  BOT: "bot",
};

// Build the { [rawS3Key]: signedUrl } stash the A-D-managecontent renderer
// consumes (admin/src/constants.js STATE_KEYS.CURRENT_REPORT_EVIDENCE — keyed by
// raw S3 key, overlaid by key). Per-key failures degrade to omission (the
// consumer renders "(link unavailable)"), NEVER an exception out of the handler.
// Signed HERE, in the Context-B frame, BEFORE sendResponse — signing cannot live
// in the non-awaited manageContent onResponse (rule 11/18). Rebuilt fresh on
// EVERY open → a new short-lived (SIGNED_URL_EXPIRY_SECONDS = 5 min) URL per open,
// which is exactly the ER-D16 expired-link re-fetch behaviour.
const buildEvidenceSignedUrls = async (report) => {
  const stash = {};
  if (!report) return stash;

  const bucket = await state.getStaticData(
    STATIC_DATA_KEYS.CONVERSATIONS_BUCKET
  );
  if (!bucket) {
    // No bucket configured → cannot sign anything; render filenames without links.
    D.log({ message: "openManageReport: no conversations bucket configured" });
    return stash;
  }

  for (const fieldKey of EVIDENCE_KEYS) {
    const envelope = report[fieldKey]; // { value:<s3-key>, fileName, fileScopeValue } | null
    const s3Key = envelope?.value; // drill the envelope — NEVER the bare envelope
    if (!s3Key) continue; // empty slot

    const scope = envelope?.fileScopeValue;

    // DOMAIN-scoped (e.g. voicemail-as-evidence, call-timeout.js) → signable by the
    // admin: raw key, no conversation prefix. This is the ONLY cross-conversation
    // path the documented API supports.
    if (scope === FILE_SCOPE.DOMAIN) {
      try {
        const url = await state.frontmlib.getS3SignedUrl(
          bucket,
          s3Key,
          SIGNED_URL_EXPIRY_SECONDS
        );
        if (url) stash[s3Key] = url;
      } catch (signErr) {
        // Best-effort (NFR-4): omit this one link; consumer shows "(link unavailable)".
        D.log({
          message: "openManageReport: domain-scoped evidence signing failed",
          data: { fieldKey, scope, error: signErr?.message },
        });
      }
      continue;
    }

    // CONVERSATION-scoped (or unset → conversation default): the key is under the
    // REPORTER's conversation. The admin's state.conversationId is a DIFFERENT
    // conversation, so the documented "${conversationId}/${key}" path would point
    // at the wrong object (404) and embed a meaningless prefix. There is NO
    // documented admin-side API to sign a foreign conversation's object, so this
    // key is OMITTED and FLAGGED — never a wrong-conversation URL.
    // ANONYMITY/ACCESS FINDING (for a /frontm-fix-task): reporter evidence
    // (anonymous-user/src/sections/evidence.js) uploads with the default
    // "conversation" scope, so admins cannot retrieve those files. To make
    // reporter evidence admin-accessible WITHOUT leaking the reporter's
    // conversation, the reporter FILE_FIELDs must use fileScope:"domain" (as
    // voicemail already does) — a reporter-app schema change, out of scope here.
    D.log({
      message:
        "openManageReport: evidence not signable from admin (non-domain scope)",
      data: { fieldKey, scope: scope || "unset(conversation)" },
    });
  }

  return stash;
};

openManageReport.onResolution = async () => {
  const { reportId } = state.messageFromUser?.payload || {};
  if (!reportId) {
    state.addErrorToStack(400, "Missing reportId for openManageReport");
    return;
  }

  await Context.Create(state.currentTabId, { state });
  const report = await loadReportForAdmin({ reportId });
  if (!report) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // Stash for the manage cards + transition handlers (Context B → B).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  // A-F7 — evidence signed URLs. Produce the { [s3Key]: signedUrl } stash the
  // A-D-managecontent renderer consumes, BEFORE sendResponse (signing cannot live
  // in the non-awaited onResponse — rule 11/18). Wrapped so a signing failure can
  // NEVER block the manage view from rendering: on any error the stash is empty and
  // every attachment degrades to "(link unavailable)". Rebuilt fresh on every open
  // → fresh 5-min URLs (ER-D16 expired-link re-fetch). The 'download at your own
  // risk' note (D13) is display copy added by the manage-content renderer, not here.
  try {
    const evidenceUrls = await buildEvidenceSignedUrls(report);
    state.setField(STATE_KEYS.CURRENT_REPORT_EVIDENCE, evidenceUrls);
  } catch (evidenceErr) {
    state.setField(STATE_KEYS.CURRENT_REPORT_EVIDENCE, {});
    D.log({
      message: "openManageReport: evidence stash build failed (degraded)",
      data: { reportId, error: evidenceErr?.message },
    });
  }

  // Route to the Manage (report-detail) screen — the six detail sections (header,
  // content, resolution, actions, status-history, amendments) visible; all other
  // exclusive sections hidden — and render the Display Doc (rule 4/8). The
  // CURRENT_REPORT_ID / CURRENT_REPORT_EVIDENCE stashes above feed the A-D-manage*
  // onResponse handlers fired by this sendResponse.
  showScreen(SCREEN.MANAGE);
  adminDisplayDoc.sendResponse();
};

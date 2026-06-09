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
import { CONTEXT, INTENT, STATE_KEYS } from "../constants";

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

// Media-scope handling (envelope.fileScopeValue — field-class guide § "Media Field
// Value Shape"). Only DOMAIN-scoped objects are signable from the admin app: their
// fileScopeValue equals the DOMAIN NAME, the object lives at `${domain}/${key}`, and
// any admin in the domain may read it (no reporter conversation → anonymity-safe).
// CONVERSATION-scoped (fileScopeValue = the REPORTER's conversationId) or BOT-scoped
// objects are OMITTED (consumer shows "(link unavailable)") — the admin must not sign
// under, or even depend on, the reporter's conversation (anonymity). The detection +
// `${domain}/${key}` path live inline in buildEvidenceSignedUrls below.

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

    // ARCHITECTURE LIMITATION (verified live — NoSuchKey on `${domain}/${key}`):
    // setting fileScope:"domain" on a FILE_FIELD records fileScopeValue = the domain
    // name ("onship") as METADATA, but the super-app still uploads the bytes to the
    // UPLOADER's conversation path — `${reporterConversationId}/${key}` (same path
    // myProfile signs for its photo field). It does NOT relocate the object to
    // `${domain}/${key}`. So the admin — a DIFFERENT conversation, with no access to
    // (and, by anonymity, no right to) the reporter's conversationId — literally
    // cannot construct a working key for reporter evidence. Every reporter-uploaded
    // file is therefore OMITTED here → the consumer shows "(link unavailable)".
    //
    // The only proven cross-conversation pattern (healthMarinerCommonLib/crewApi.js)
    // is a CUSTOM server-side `state.frontmlib.uploadToS3Bucket` to `${domain}/${key}`
    // at write time, NOT FILE_FIELD scope. Making admin evidence access work requires
    // copying each evidence object to a domain-shared path on report submit and
    // storing that domain key — a deliberate change (see the open MP-FIX for evidence
    // S3 access). Until then, omit + flag; NEVER emit a 404 link.
    D.log({
      message:
        "openManageReport: reporter evidence not admin-accessible (stored under reporter conversation, not a domain path)",
      data: { fieldKey, scope: scope || "unset" },
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

  // Stable per-screen tab (rule 37): reuse the manage contextId so opening another
  // report (or re-rendering after a transition) replaces this tab, never a new one.
  await Context.CreateAndInit(CONTEXT.MANAGE_REPORT, { state });
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

// Navigation intent: openManageReport - load one report for the manage detail view.
//
// Independent intent (Context B). The reportId arrives in the invoke_intent envelope
// ONE LEVEL DEEP under .payload (CLAUDE.md "Custom HTML Payloads") - never at the top
// level. Loads the report ONLY through the anonymity gateway (rule 15) -
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
  userTab,
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
// (specs/3.field-spec.md - mirrors the manage-content consumer's EVIDENCE_KEYS).
// evidenceNotes is reporter TEXT (TEXT_AREA), NOT a file - it is NEVER signed.
const EVIDENCE_KEYS = [
  "evidenceFile1",
  "evidenceFile2",
  "evidenceFile3",
  "evidenceFile4",
  "evidenceFile5",
];

// Media-scope handling (envelope.fileScopeValue - field-class guide § "Media Field
// Value Shape"). Only DOMAIN-scoped objects are signable from the admin app: their
// fileScopeValue equals the DOMAIN NAME, the object lives at `${domain}/${key}`, and
// any admin in the domain may read it (no reporter conversation → anonymity-safe).
// CONVERSATION-scoped (fileScopeValue = the REPORTER's conversationId) or BOT-scoped
// objects are OMITTED (consumer shows "(link unavailable)") - the admin must not sign
// under, or even depend on, the reporter's conversation (anonymity). The detection +
// `${domain}/${key}` path live inline in buildEvidenceSignedUrls below.

// Build the { [rawS3Key]: signedUrl } stash the A-D-managecontent renderer
// consumes (admin/src/constants.js STATE_KEYS.CURRENT_REPORT_EVIDENCE - keyed by
// raw S3 key, overlaid by key). Per-key failures degrade to omission (the
// consumer renders "(link unavailable)"), NEVER an exception out of the handler.
// Signed HERE, in the Context-B frame, BEFORE sendResponse - signing cannot live
// in the non-awaited manageContent onResponse (rule 11/18). Rebuilt fresh on
// EVERY open → a new short-lived (SIGNED_URL_EXPIRY_SECONDS = 5 min) URL per open,
// which is exactly the ER-D16 expired-link re-fetch behaviour.
const buildEvidenceSignedUrls = async (report) => {
  const stash = {};
  if (!report) return stash;

  // DOMAIN-scoped evidence lands in the CONTENT bucket at `${currentUserDomain}/${key}`
  // (not conversationsBucket) - readable by any admin in the domain (healthMariner pattern).
  const bucket = await state.getStaticData(STATIC_DATA_KEYS.CONTENT_BUCKET);
  if (!bucket) {
    // No bucket configured → cannot sign anything; render filenames without links.
    D.log({ message: "openManageReport: no conversations bucket configured" });
    return stash;
  }

  // Sign one DOMAIN-scoped S3 key into the stash (keyed by the raw s3Key so every consumer
  // - manage-content AND amendments - overlays it by key). DOMAIN-scoped evidence lives at
  // `${currentUserDomain}/${key}`: a domain-shared path readable by ANY admin in the domain,
  // with NO reporter conversationId in it (anonymity-safe, rule 30). Per-key failure degrades
  // to omission ("(link unavailable)"), never an exception out of the handler.
  const signKey = async (s3Key, label) => {
    if (!s3Key || stash[s3Key]) return; // empty slot, or already signed
    const keyPath = `${state.currentUserDomain}/${s3Key}`;
    try {
      const url = await state.frontmlib.getS3SignedUrl(
        bucket,
        keyPath,
        SIGNED_URL_EXPIRY_SECONDS
      );
      if (url) stash[s3Key] = url;
      D.log({
        message: "openManageReport: evidence signed",
        data: { label, keyPath, signed: !!url },
      });
    } catch (error) {
      D.log({
        message: "openManageReport: evidence signing failed (degraded)",
        data: { label, keyPath, error: String(error) },
      });
    }
  };

  // 1. The five reporter top-level evidence files (manage-content consumer).
  for (const fieldKey of EVIDENCE_KEYS) {
    // drill the envelope - NEVER the bare envelope
    await signKey(report[fieldKey]?.value, fieldKey);
  }

  // 2. Per-amendment evidence (amendments consumer). Each amendment row carries its own
  //    DOMAIN-scoped amendmentEvidenceKey envelope ({ value:<s3-key>, fileName }); sign each
  //    into the SAME stash so the read-only Amendments table can link it. report.amendments
  //    is the embedded sub-collection array returned by loadReportForAdmin (extractRowData).
  const amendments = Array.isArray(report.amendments) ? report.amendments : [];
  for (const row of amendments) {
    await signKey(row?.amendmentEvidenceKey?.value, "amendmentEvidenceKey");
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
  await Context.CreateAndInit(userTab(CONTEXT.MANAGE_REPORT, state), { state });
  const report = await loadReportForAdmin({ reportId });
  if (!report) {
    state.addErrorToStack(404, "Report not found.");
    return;
  }

  // Stash for the manage cards + transition handlers (Context B → B).
  state.setField(STATE_KEYS.CURRENT_REPORT_ID, reportId);

  // A-F7 - evidence signed URLs. Produce the { [s3Key]: signedUrl } stash the
  // A-D-managecontent renderer consumes, BEFORE sendResponse (signing cannot live
  // in the non-awaited onResponse - rule 11/18). Wrapped so a signing failure can
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

  // Route to the Manage (report-detail) screen - the six detail sections (header,
  // content, resolution, actions, status-history, amendments) visible; all other
  // exclusive sections hidden - and render the Display Doc (rule 4/8). The
  // CURRENT_REPORT_ID / CURRENT_REPORT_EVIDENCE stashes above feed the A-D-manage*
  // onResponse handlers fired by this sendResponse.
  showScreen(SCREEN.MANAGE);
  adminDisplayDoc.sendResponse();
};

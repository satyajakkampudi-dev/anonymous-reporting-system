// Shared dashboard aggregation (A-F2, ER-A6, D-L3-3) - the SINGLE source of truth
// for the compliance-dashboard counts AND the small-cell suppression. Extracted as a
// pure lib/ module (mirroring lib/sla.js) so the producer can run it identically on
// first paint (app-start) and on nav (openDashboard) with no duplication, and so the
// counting logic is unit-reasonable in isolation.
//
// PURE module: depends ONLY on other lib/ modules (STATUS, SEVERITY, URGENCY,
// SMALL_CELL_THRESHOLD, TIMING). No framework state, no app imports, no DB - so both
// micro-apps can import it freely with no circular-dependency risk (lib is the tree
// root). `nowMs` is injectable for testability and deterministic age bucketing.
//
// ANONYMITY (the dominant constraint, ER-A3/A6): operates ONLY on the already-
// projected, identity-free report objects produced by loadReportsForAdmin (lib/access.js)
// - it reads status / severity / urgency / createdOn / shipName only. shipName is
// incident metadata (admin-visible per the field spec / adminProjection), NOT a reporter
// identity. It NEVER touches reporterId / contactMethod / contactValue (the projection
// excludes them anyway). The per-ship breakdown is the canonical de-anonymisation risk,
// so ANY ship cell with fewer than SMALL_CELL_THRESHOLD (5) reports - and any report with
// a blank/missing shipName - is merged into a single "Other" bucket (k-anonymity, k=5).
//
// EMPTY-SAFE: an empty report set yields { totalReports: 0, priorityCount: 0, and every
// sub-array empty }, which the dashboard renderer surfaces as a neutral "no reports" /
// muted "-" state. A status/severity with zero reports is simply absent from its array.

import { STATUS } from "./ticket-status";
import { SEVERITY, URGENCY, SMALL_CELL_THRESHOLD } from "./constants";

// One day in ms - derived from TIMING semantics (same value the timing constants are
// built from). Kept local so the age boundaries are expressed in named day-multiples
// rather than magic millisecond literals (rule 19).
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Age-bucket boundaries (field-spec §512: "<24 h · 1–3 d · 3–7 d · >7 d"). Each bucket
// carries a stable token (`bucket`, for keyed logic/styling) and a human-readable
// British-English `label` (what the stat-card shows). Boundaries are upper-exclusive in
// ms-of-age; the final bucket is open-ended.
export const AGE_BUCKETS = [
  { bucket: "lt24h", label: "< 24h", maxAgeMs: 1 * ONE_DAY_MS },
  { bucket: "1to3d", label: "1–3 days", maxAgeMs: 3 * ONE_DAY_MS },
  { bucket: "3to7d", label: "3–7 days", maxAgeMs: 7 * ONE_DAY_MS },
  { bucket: "gt7d", label: "> 7 days", maxAgeMs: Infinity },
];

// Label used for the small-cell / blank-shipName merged bucket.
const OTHER_SHIP_LABEL = "Other";

// Pick the age bucket for a report given its createdOn (ms) and the reference now (ms).
// A missing/invalid createdOn ages as 0 → the freshest bucket (never throws).
const ageBucketFor = (createdOn, nowMs) => {
  const ageMs = Math.max(0, nowMs - (Number(createdOn) || 0));
  return (
    AGE_BUCKETS.find((b) => ageMs < b.maxAgeMs) ||
    AGE_BUCKETS[AGE_BUCKETS.length - 1]
  );
};

// A report is "priority" if its admin-assessed severity is CRITICAL, OR the reporter
// flagged immediate risk (urgency === IMMEDIATE → "Immediate risk"), OR it is ESCALATED.
// Uses the shared enum tokens, never string literals (rule 19).
//
// EXPORTED so it is the SINGLE source of truth for "priority" across the system:
// the dashboard 'Priority / Escalated' stat card (A-F2, priorityCount below), the queue
// priority surfacing + sort + quick-filter (A-F5, lib/queue.js), and the queue renderer's
// per-row badge all consume THIS predicate - they can never drift. Severity reflects the
// admin's A-F12 override because it reads the live `severity` column on the projected row.
export const isPriority = (r) =>
  !!r &&
  (r.severity === SEVERITY.CRITICAL ||
    r.urgency === URGENCY.IMMEDIATE ||
    r.status === STATUS.ESCALATED);

// The stored priority SORT key (MP-FIX-QUEUE-SERVER-PAGINATION): 0 for a priority
// report (floats to the top), 1 otherwise. The framework has no aggregation, so the
// computed isPriority float cannot be a server-side sort expression - it must be a
// stored, sortable column. reportDoc.onSave writes priorityRankFor(report) on EVERY
// save in both apps, so the column tracks isPriority exactly (no drift). The queue
// then sorts { priorityRank: 1, createdOn: -1 } server-side.
export const priorityRankFor = (r) => (isPriority(r) ? 0 : 1);

// The Mongo query criteria equivalent to isPriority - the SAME three-field OR, in
// query form. SINGLE-SOURCED here so the one-time backfill (lib/access.backfillPriorityRank)
// that stamps priorityRank on legacy rows uses byte-identical criteria to the runtime
// predicate above (no drift between "what counts as priority" in code vs in the migration).
// The live PRIORITY quick-filter does NOT use this - once priorityRank is stored it filters
// on { priorityRank: 0 } directly.
export const priorityQueryCriteria = () => ({
  $or: [
    { severity: SEVERITY.CRITICAL },
    { urgency: URGENCY.IMMEDIATE },
    { status: STATUS.ESCALATED },
  ],
});

// Tally a list into a Map<key, count>, ignoring null/undefined keys.
const tally = (items, keyOf) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (key === null || key === undefined) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
};

// Build the complete DASHBOARD_STATS stash from the gateway report set. `reports` is the
// identity-free, projection-applied array from loadReportsForAdmin. Pure + empty-safe.
//
// Returns EXACTLY the shape the dashboard renderer (A-D-dashboard) binds:
//   {
//     totalReports: number,
//     priorityCount: number,
//     byStatus:   [{ status, count }],
//     bySeverity: [{ severity, count }],
//     byAge:      [{ bucket, label, count }],   // every non-empty bucket, in age order
//     perShip:    [{ label, count }],            // small-cell suppressed (<5 → "Other")
//   }
export const buildDashboardStats = (reports, nowMs = Date.now()) => {
  const rows = Array.isArray(reports) ? reports : [];

  const totalReports = rows.length;
  const priorityCount = rows.filter(isPriority).length;

  // By status - one entry per STATUS token actually present (zero-count statuses absent).
  const statusCounts = tally(rows, (r) => r.status || null);
  const byStatus = [...statusCounts.entries()].map(([status, count]) => ({
    status,
    count,
  }));

  // By severity - one entry per SEVERITY token actually present.
  const severityCounts = tally(rows, (r) => r.severity || null);
  const bySeverity = [...severityCounts.entries()].map(([severity, count]) => ({
    severity,
    count,
  }));

  // By age - bucketed from createdOn vs now; emit only non-empty buckets, preserving the
  // canonical age order (AGE_BUCKETS).
  const ageCounts = tally(rows, (r) => ageBucketFor(r.createdOn, nowMs).bucket);
  const byAge = AGE_BUCKETS.filter((b) => ageCounts.has(b.bucket)).map((b) => ({
    bucket: b.bucket,
    label: b.label,
    count: ageCounts.get(b.bucket),
  }));

  // Per ship - SMALL-CELL SUPPRESSION (ER-A6, D-L3-3, rule 28). Group by shipName;
  // a blank/missing shipName folds straight into "Other"; then ANY remaining named-ship
  // cell with fewer than SMALL_CELL_THRESHOLD reports is also merged into "Other". A tiny
  // per-ship population could de-anonymise the reporter, so such a cell is NEVER emitted.
  const shipCounts = new Map();
  let otherCount = 0;
  for (const r of rows) {
    const name = typeof r.shipName === "string" ? r.shipName.trim() : "";
    if (!name) {
      otherCount += 1; // blank/missing shipName → "Other"
      continue;
    }
    shipCounts.set(name, (shipCounts.get(name) || 0) + 1);
  }

  const perShip = [];
  for (const [name, count] of shipCounts.entries()) {
    if (count < SMALL_CELL_THRESHOLD) {
      otherCount += count; // sub-threshold named ship → merged into "Other"
    } else {
      perShip.push({ label: name, count });
    }
  }
  // Largest named ships first for a stable, readable layout; "Other" always last.
  perShip.sort((a, b) => b.count - a.count);
  if (otherCount > 0) {
    perShip.push({ label: OTHER_SHIP_LABEL, count: otherCount });
  }

  return { totalReports, priorityCount, byStatus, bySeverity, byAge, perShip };
};

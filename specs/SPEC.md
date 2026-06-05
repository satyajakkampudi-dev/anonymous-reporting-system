# Data Model Spec — Anonymous Reporting System

> Companion to [`../REQUIREMENTS.md`](../REQUIREMENTS.md). Defines the `Report` entity, its
> fields, enumerations, the status state machine, and the admin field-projection that enforces
> anonymity. Field/enum **values are the single source of truth** and live in `lib/constants.js`,
> `lib/ticket-status.js`. Symbol names below are indicative (finalised at code time).

## Collection
- **Name:** `reports` → MongoDB `reports_${systemId}` (`shared: true`, `audit: true`).
- **Defined once** in `lib/collections/reports.js`; side-effect-imported by both apps.
- **Primary key:** `reportId`.

## Report fields

### Identity & system
| Field (`dbName`) | Type | Notes |
|---|---|---|
| `reportId` | string (PK) | `RPT-` + 10 chars (collision-resistant alphabet). |
| `status` | enum | See state machine. Never written free-form. |
| `severity` | enum | `LOW \| MEDIUM \| HIGH \| CRITICAL`. Source: see OQ-6. |
| `source` | enum | `REPORTER \| MANUAL`. |
| `assignedTo` | enum | `PRIMARY_ADMIN \| SECONDARY_ADMIN`. |
| `createdOn` | number (ms) | Set at submit/log. |
| `updatedOn` | number (ms) | Last write; backs optimistic-concurrency guard (ER-B5). |
| `version` | number | Increment on each write; transitions validate against the read version. |
| `reopenCount` | number | Increment on reject→reopen; capped (OQ-10). Default 0. |
| `withdrawnOn` | number (ms) | Set on `WITHDRAWN`. |

### Reporter-private — **NEVER exposed to Admin app** (excluded from `adminProjection`)
| Field (`dbName`) | Type | Notes |
|---|---|---|
| `reporterId` | string | FrontM `userId` of submitter. Scoping + notifications only. Empty for `MANUAL`. |
| `contactMethod` | enum | `None \| Email \| Phone \| Cabin number`. |
| `contactValue` | string | Validated per method. |

### Reporter-entered content (visible to admin, read-only there)
| Field (`dbName`) | Type | Notes |
|---|---|---|
| `category` | enum | Harassment/abuse · Safety violation · Fraud/ethics breach · Bullying/retaliation · Other. |
| `urgency` | enum | Immediate risk · High · Medium · Low. |
| `shipName` | string | Free text. Sanitised. |
| `location` | enum | Onboard vessel · Office/shore base · Remote/digital · Other. |
| `incidentDate` | string (ISO) | Validated: not in the future. |
| `description` | text | Sanitised before any email/HTML use. |
| `accusedParty` | string | Optional. Sanitised. |
| `againstAdmin` | boolean | If true → route `assignedTo = SECONDARY_ADMIN`. |

### Evidence
| Field (`dbName`) | Type | Notes |
|---|---|---|
| `evidenceFile1..N` | string | Domain-scoped S3 key. Validated type+size. (N per OQ-1, proposed 5.) |
| `evidenceNotes` | text | Optional. Sanitised. |

### Admin-entered & audit
| Field (`dbName`) | Type | Notes |
|---|---|---|
| `resolution` | text | Admin resolution. Sanitised. |
| `resolvedOn` | number (ms) | Set on RESOLVED. |
| `rejectReason` | text | Reporter's reason on reject. Sanitised. |
| audit fields | — | `createdBy`/`modifiedBy`/`createdOn`/`modifiedOn` via `audit: true` — **admin actions only**; ensure the reporter-create path does not stamp reporter identity here, or exclude it from `adminProjection` (ER-A2). |

### Report history sub-collections (added Layer 3 — D-L3-1)
The report's **status timeline** (U-F2/A-F6) and **append-only amendment trail** (U-F13) are
modelled as two embedded sub-collections on the report Doc (`forCollection: true`), since `audit:
true` records only the *last* modifier and cannot reconstruct a timeline.

| Sub-collection (`dbName`) | Field | Type | Notes |
|---|---|---|---|
| `statusHistory` | `historyId` | string (PK) | Generated per entry. |
| | `fromStatus` / `toStatus` | enum | STATUS values. |
| | `actorRole` | enum | `REPORTER \| PRIMARY_ADMIN \| SECONDARY_ADMIN \| SYSTEM`. Identity-free (role only — never admin/reporter id on the reporter-visible side). |
| | `changedOn` | number (ms) | Transition timestamp. |
| | `note` | text | Optional, sanitised (e.g. reject reason, escalate note). |
| `amendments` | `amendmentId` | string (PK) | Generated per entry. |
| | `amendmentNote` | text | Sanitised. Mandatory. |
| | `amendmentEvidenceKey` | string | Optional S3 key (≤ limits, validated). |
| | `amendedOn` | number (ms) | Append timestamp. |

Both are **append-only** (no edit/delete of existing rows). `statusHistory` is written by every
status transition in `lib/ticket-status.js`'s transition path (both apps); `amendments` is written
by U-F13 only. On the admin side both sub-collections pass through `adminProjection` unchanged (they
already carry **no** reporter identity — `actorRole` not `actorId`).

## Enumerations (canonical values in `lib/constants.js`)
- `STATUS`: `OPEN, UNDER_REVIEW, ESCALATED, RESOLVED, REOPENED, CLOSED_BY_USER, CLOSED_BY_SYSTEM, CLOSED_REJECTED, WITHDRAWN`
- `CATEGORY`, `URGENCY`, `SEVERITY`, `LOCATION`, `CONTACT_METHOD` — as in REQUIREMENTS §5.
- `ROLE`: `PRIMARY_ADMIN, SECONDARY_ADMIN`
- `SOURCE`: `REPORTER, MANUAL, CALL`
- `MSG_*`: `MSG_NEW_REPORT, MSG_REPORT_REOPENED, MSG_REPORT_RESOLVED, MSG_REPORT_STATUS_CHANGED, MSG_REPORT_CLOSED, MSG_INCOMING_CALL, MSG_CALL_STOP_RING`
- `CALL_STATUS`: `RINGING, ACTIVE, ENDED, MISSED, ABANDONED`
- `AVAILABILITY`: `available, busy, unavailable`

## Status state machine (allowed transitions)
Defined in `lib/ticket-status.js` as `{ [status]: { transitions: [{ to, actor, action }], terminal, meta } }`.

| From | To | Actor | Trigger |
|------|----|-------|---------|
| OPEN | UNDER_REVIEW | admin | take review |
| OPEN | ESCALATED | system | auto-escalate (unactioned) |
| UNDER_REVIEW | RESOLVED | admin | post resolution |
| UNDER_REVIEW | ESCALATED | admin/system | escalate / auto-escalate |
| ESCALATED | UNDER_REVIEW | secondary admin | take review |
| ESCALATED | RESOLVED | secondary admin | resolve |
| RESOLVED | CLOSED_BY_USER | reporter | accept |
| RESOLVED | CLOSED_BY_SYSTEM | system | auto-close (+30d) |
| RESOLVED | REOPENED | reporter | reject (reason) — once only, `reopenCount` 0→1 (D10) |
| REOPENED | UNDER_REVIEW | admin | take review |
| REOPENED | ESCALATED | admin | escalate |
| REOPENED | CLOSED_REJECTED | admin | close as rejected (or force-close past reopen cap) |
| OPEN | WITHDRAWN | reporter | withdraw |
| UNDER_REVIEW | WITHDRAWN | reporter | withdraw |

**Terminal:** `CLOSED_BY_USER, CLOSED_BY_SYSTEM, CLOSED_REJECTED, WITHDRAWN`.
Status `meta`: `{ label, tone, allowedActionsByRole }` for consistent rendering/gating in both apps.

**Concurrency (ER-B5):** every transition re-reads the report and checks the move is legal from the
**current** `status` and that `version` matches the read; on mismatch the write is rejected (stale).
Jobs (auto-escalate/close) and call-claim use the same guard + a job-id/`attendedBy` conditional so
duplicate or stale fires are safe no-ops (ER-B8). `source = MANUAL|CALL` reports (no `reporterId`)
omit reporter-driven transitions (accept/reject/withdraw) and reporter notifications.

## `adminProjection` (anonymity enforcement)
The **only** field set the Admin app reads. Excludes `reporterId`, `contactMethod`, `contactValue`,
and the audit `createdBy`/`modifiedBy` for the reporter-create path (ER-A2). All admin reads go
through a **single gateway** `loadReportsForAdmin()` / `loadReportForAdmin()` that always applies
`{ projection: adminProjection }` (ER-A3) — no admin code path queries the collection directly.
Admin Display/Form Docs bind no identity field; bot-to-bot payloads and admin emails are built from
this set only. Dashboard/analytics aggregations apply small-cell suppression (ER-A6).

## Retention & export (ER-D14 — decision D15)
**v1:** 7-year retention for reports, evidence files, and voicemails; **CSV/PDF case export** from
the `adminProjection` set only (no reporter identity). **Deferred to post-v1:** admin-initiated
erasure on terminal reports (would also clear `reporterId`/contact + linked S3 objects) — irreversible,
pending legal sign-off. Confirm retention against the org's legal policy before go-live.

## Anonymous calling data model

### Collection `call-queue` → `call_queue_${systemId}` (`shared: true`)
One entry per call attempt. **Identity-free** — never stores reporter id/email/name.

| Field (`dbName`) | Type | Notes |
|---|---|---|
| `callRef` | string (PK) | Opaque reference, e.g. `CALL-…`. |
| `status` | enum | `RINGING \| ACTIVE \| ENDED \| MISSED \| ABANDONED`. |
| `meetingId` | string | Daily.co meeting id. |
| `attendedBy` | string | Admin userId/email who answered (admin side only). |
| `createdOn` | number (ms) | Ring start. |
| `answeredOn` | number (ms) | Set on ACTIVE. |
| `endedOn` | number (ms) | Set on ENDED/MISSED. |
| `durationMs` | number | ENDED − answered. |
| `voicemailKey` | string | S3 key if a voicemail was left (MISSED path). |
| `linkedReportId` | string | Report auto-created from voicemail (`source=CALL`). |

### Collection `admin-users` → `admin_users_${systemId}` (`shared: true`)
The **seeded admin registry** (D3) — single source for access gating, PRIMARY/SECONDARY role +
routing, recusal, on-call availability, and call ringing. Seeded out-of-band; admins update their
own `availability`; calling reads `available` rows to ring.

| Field (`dbName`) | Type | Notes |
|---|---|---|
| `adminUserId` | string (PK) | Admin's FrontM userId. |
| `adminEmail` | string | Used to invite to the call meeting. |
| `role` | enum | `PRIMARY \| SECONDARY`. |
| `scope` | string | Routing scope (D17). v1 default `GLOBAL`; future `FLEET_A`/region/etc. |
| `availability` | enum | `available \| busy \| unavailable`. |
| `updatedOn` | number (ms) | Last status change. |

**Routing (D17):** `resolveAssignees(report)` in `lib/access.js` is the single routing chokepoint.
v1 returns all `admin-users` of the target role with `scope = GLOBAL` (central team). Scoped routing
later = populate `scope` + add a structured vessel→scope mapping + extend the resolver; the report
schema and admin queue are unchanged. `shipName` is incident metadata; a structured `vesselId` may
be added then for the vessel→scope mapping (free-text `shipName` retained as fallback).

### Masking (anonymity — `lib/calling.js`)
- `hostUserEmail` = a masked/system account (never `state.user.userEmail`).
- Reporter joins via `getAccessToken({ guestEmail: maskedGuestEmail(callRef) })` with display
  name "Anonymous Reporter"; meeting created `allowGuests: true`, video muted (voice-only).
- Ring payloads (`MSG_INCOMING_CALL`, VoIP push) contain **only** `callRef` + `meetingId` — no
  `callerName`/`callerId`/email. Generic ring message ("Incoming anonymous call").
- Voicemail-derived report uses `source=CALL`, `reporterId` empty (no tracking owner).

### Call lifecycle
`RINGING` → (admin answers) `ACTIVE` → (hang-up) `ENDED`; or (no available admin / ring timeout,
OQ-7) `MISSED` → voicemail recorded → auto-create report. Edge handling (ER-C12): reporter hangs up
before answer → `ABANDONED`; network drop mid-call → inactivity timeout `ACTIVE → ENDED`. The answer
is an **atomic claim** — first admin to set `ACTIVE`/`attendedBy` wins; others get
`MSG_CALL_STOP_RING`. Recording stays **off** (ER-A5). Concurrent callers: an admin who answers is
marked `busy` so they're skipped for other rings (OQ-12). No `audit`-style recording captures voice.

## Validation rules (in `lib/validation.js`)
- **Email:** RFC-pragmatic regex; **Phone:** E.164-tolerant; **Cabin:** alphanumeric pattern.
- **incidentDate:** parseable ISO date, not in the future.
- **Evidence file:** allowed extensions **and** content type; size ≤ limit (OQ-1). Reject otherwise.
- **Sanitiser:** escape/strip HTML from all free-text fields before email/HTML-card rendering.

## Verification surface (runtime — FrontM has no unit-test files)
Keep these `/lib` helpers **pure** so they can be exercised quickly via a `mock-data` toggle and
verified on the live runtime (`/frontm-review`, `/verify`, `npm run build`): ID generator (format
+ uniqueness), status transition validator (allowed/denied per role), validators
(email/phone/cabin/date/file), sanitiser (injection cases), `adminProjection` (identity fields
absent).

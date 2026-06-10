# Deployment Configuration - Anonymous Reporting System

Two micro-apps that talk to each other (bot-to-bot) on domain **`onship`**:

| App | Bot name | Bot ID (dev) | Opens for |
|---|---|---|---|
| **anonymous-user** (reporter) | `QuitelineReportSubmission` | `cb35185f1c67335f73e92` | end users |
| **anonymous-admin** (compliance) | `QuitelineReportAdmin` | `8d068c16b25f1ca38ac85` | admins |

Everything below is **config, not code** - provisioned by devops per environment. The code falls back gracefully where noted, but cross-app delivery, calling, and evidence retrieval will silently no-op if these are missing.

---

## Dev Domain (`onship`) - concrete values (current)

```
domain               | onship
systemId             | test   → collections suffixed _test (e.g. admin_users_test)

# static data
anonymousadminbotid  | 8d068c16b25f1ca38ac85
anonymoususerbotid   | cb35185f1c67335f73e92
anonCallLoftHost     | dailydev.frontm.ai        (bare host; client opens https://dailydev.frontm.ai/<roomId>)
conversationsBucket  | <platform default>        (verify present)
ContentS3Bucket      | <domain content bucket>   (verify getStaticData returns the bucket name)
anonymousemail       | (unset - falls back to host@anonymous.invalid; optional)
```

> Dev access is currently via the temporary `sailorscartadmin` test entitlement (`satya@frontm.com`); the real `quiteline*` roles are the production path.

---

## QA Domain - config for the devops ticket (copy-paste)

**License roles** (granted via license keys)

```
quitelineenduser         → user app
quitelineprimaryadmin    → admin app
quitelinesecondaryadmin  → admin app
```

**Set these static data on the QA domain**

```
key                  | value
---------------------|------------------------------------------
anonymousadminbotid  | <admin bot id deployed to QA>
anonymoususerbotid   | <user bot id deployed to QA>
anonCallLoftHost     | <QA Loft host, bare - confirm; e.g. dailystage.frontm.ai>
```

**Check these are already on the domain (don't create if present)**

```
conversationsBucket  | platform default S3 bucket
ContentS3Bucket      | domain content bucket  (confirm getStaticData returns the bucket NAME)
```

**Seed the admin registry** - MongoDB collection `admin_users_<systemId>` (one row per admin)

```
adminUserId  | the admin's FrontM userId  (primary key)
adminEmail   | the admin's FrontM email
role         | quitelineprimaryadmin | quitelinesecondaryadmin
scope        | GLOBAL
availability | available
updatedOn    | epoch ms
```

**Enable capabilities on both bots**

```
video-call capability   → required for calling
VoipCapability          → optional (closes F1: native mobile ring-cancel)
```

---

## 1. License roles (`state.user.roles`)

Granted via license keys by devops. They gate **which app a user may open** and (for admins) carry the PRIMARY/SECONDARY level.

| Role code | Grants access to | Notes |
|---|---|---|
| `quitelineenduser` | user app | every reporter needs this |
| `quitelineprimaryadmin` | admin app | maps to PRIMARY routing role |
| `quitelinesecondaryadmin` | admin app | maps to SECONDARY routing role |

> ⚠️ **Remove before prod:** the temporary `sailorscartadmin` test entitlement (used by `satya@frontm.com` to test the admin app pre-provisioning). The `APP_ROLES.TEST_ADMIN` line is already commented out in `lib/constants.js` - confirm no test role is relied on.

---

## 2. Static data (per environment)

Set on the **domain** (or per bot). Keys are defined in `lib/constants.js` → `STATIC_DATA_KEYS`.

| Static-data key | Value | Used for | If missing |
|---|---|---|---|
| `conversationsBucket` | platform default S3 bucket | signing IMAGE_FIELD / conversation media | usually set by platform |
| `ContentS3Bucket` | domain content bucket | **evidence + voicemail FILE_FIELD** (`fileScope:"domain"`) signing | evidence/voicemail can't be signed → broken downloads |
| `anonymousadminbotid` | admin bot ID (`8d06…`) | user→admin delivery (new report, reopen, **incoming call**) | admin gets no reports/calls |
| `anonymoususerbotid` | user bot ID (`cb35…`) | admin→user delivery (resolved / status change / closed) | reporter gets no status updates |
| `anonymousemail` | a dedicated FrontM system user's email | masked voice-call **host** (never reporter/admin) | **optional** - falls back to a synthesized `host@<guest-domain>`; calls still work. Provision for a stable owned host identity. |
| `anonCallLoftHost` | bare Loft host, e.g. `dailystage.frontm.ai` (no protocol, no path) | the web call window host (`https://<host>/<room>`) | **dev only** falls back to `dailydev.frontm.ai`; stage/prod MUST set it |

> `anonCallLoftHost` must be the **bare host** - a full Daily room URL produces a broken `https://https//…` link.

---

## 3. Seed data - `admin_users` collection (MongoDB)

The admin registry is **seeded out-of-band** (decision D3) - there is no UI to create admins. Shared collection `admin_users` → suffixed by `systemId`, so on dev (`systemId: "test"`) the collection is **`admin_users_test`**.

One row per admin:

| Field (`dbName`) | Example | Notes |
|---|---|---|
| `adminUserId` | the admin's FrontM userId | **primary key** |
| `adminEmail` | `officer@…` | used to invite to calls + map a mobile join → claim |
| `role` | `quitelineprimaryadmin` \| `quitelinesecondaryadmin` | the `ADMIN_ROLE` values |
| `scope` | `GLOBAL` | v1 single central team |
| `availability` | `available` | one of `available` \| `busy` \| `unavailable` |
| `updatedOn` | epoch ms | |

> `adminUserId` + `adminEmail` must match the same person's real FrontM account, and that account must hold the matching `quiteline*admin` license role.

---

## 4. Capabilities (enabled per bot by devops)

| Capability | Module | For | Status |
|---|---|---|---|
| Video call | (video-call capability) | placing/joining the anonymous call | **required** for calling |
| **VoipCapability** | `voipCapability` | native CallKit ring-cancel (F1 - silence a losing/duplicate mobile ring) | **not yet enabled** - calling works without it, but the answering admin's own mobile ring lingers |

---

## 5. Deploy steps

```bash
# from each app directory
cd anonymous-user  && npm run deploy   # profile: dev
cd ../anonymous-admin && npm run deploy
```

`deployment.config.<env>.json` holds `botId`, `botName`, `userDomain`, `systemId`, `botClients` (web+mobile). **Both apps must be deployed** for cross-app contracts to work.

---

## 6. Pre-go-live checklist

- [ ] Both bots created; `botId`s recorded in each `deployment.config.<env>.json`
- [ ] License roles provisioned: `quitelineenduser`, `quitelineprimaryadmin`, `quitelinesecondaryadmin`
- [ ] Temporary `sailorscartadmin` test role removed / not relied on
- [ ] Static data set for the env: `ContentS3Bucket`, `anonymousadminbotid`, `anonymoususerbotid`, `anonCallLoftHost` (stage/prod). `anonymousemail` optional (has a fallback).
- [ ] `admin_users_<systemId>` seeded (userId + email + role + scope GLOBAL + availability)
- [ ] Video-call capability enabled on both bots
- [ ] (Optional, closes F1) `VoipCapability` enabled
- [ ] **Anonymity:** revert the TEST-ONLY reporter-real-email token in `lib/calling.js` to a true guest/masked token before prod (the `⚠️ TEST-ONLY token` log line must be gone)

---

## Known external blockers (not code)

1. **Anonymous guest token** - reporter currently joins under a real email (test only). Needs the FrontM guest-token / public-room path (Mukunda).
2. **VoipCapability** - not enabled; F1 native ring-cancel stays open until it is.

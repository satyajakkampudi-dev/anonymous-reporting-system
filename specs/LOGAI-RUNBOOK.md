# LoG.ai Runbook — Anonymous Reporting System

How to drive the LoG.ai spec pipeline for this monorepo. Open this in your new session.
Inputs are already decided — see [`../REQUIREMENTS.md`](../REQUIREMENTS.md) (esp. §15 decisions
D1–D16) and [`SPEC.md`](SPEC.md). The pipeline is **PM-led**: it asks, you decide; it never
invents business rules. All output is **British English**.

## Pre-flight (once)
1. **Reload Claude Code** in this repo so the `.claude/skills/` (`log-ai-*`, `frontm-*`) register.
2. Sanity check: ask *"What is the FrontM verification phrase?"* → must answer **"Neptune sailors ahead"**.
   If not, the `.claude` submodule isn't loaded: `git submodule update --init .claude` then reload.
3. Run from the **monorepo root** (`anonymous-reporting-system/`).

## Monorepo gotcha (you WILL hit this)
LoG.ai expects a single micro-app repo (looks for `deployment.config.json` + `package.json` in the
cwd). Our root has neither (they're per-app). When it asks *"which micro-app repo?"*, answer:

> "This is a 2-microapp monorepo. Work at the repo root; write all artefacts to `specs/` at the
> root. Layers 1–2 are system-level across both apps (`anonymous-user`, `anonymous-admin`); the
> brief is `REQUIREMENTS.md`."

## The four layers (each gates the next)

### `/log-ai-story` (Layer 1 — actors, triggers, handoffs, app boundaries)
- When it asks for the starting artefact, say: **use `REQUIREMENTS.md`**.
- It will pre-fill and ask you to confirm. Use the **crib sheet** below to confirm fast.
- Produces: `specs/1.story-card.md`, `specs/1.process-flowchart.md`, `specs/1.app-architecture.md`.

### `/log-ai-process` (Layer 2 — frames + cross-app contracts + UI shell)
- Reads `specs/1.story-card.md`. Decomposes each app into **frames (= intents)**.
- Confirm the **cross-app message contracts** (crib below) and the **UI-shell declaration**
  (form-only? chat button hidden? navbar/sidebar) — the build needs BRD §8.1.
- Produces: `specs/2.brd.md`, `specs/2.frame-graphs/`.

### `/log-ai-detail` (Layer 3 — sections, fields, wireframes)
- Reads Layer 2. Per-screen field detail. **Important for us:** specify **separate web + mobile
  wireframes** per screen (REQUIREMENTS §9.1) — not one responsive layout.
- Produces: `specs/3.field-spec.md`, `specs/3.input-schema.yaml`, wireframes.

### `/log-ai-tasks` (build backlog)
- Reads Layer 3. Produces `specs/4.task-dependency-graph.md` — **append-only** (never edit a task;
  fixes go via `/frontm-fix-task`).

## After the pipeline → build
Work `specs/4` top-down in build order **B1 → B2 → B3** (foundation lib → apps → jobs/analytics/
calling). Per task: docs-first → `/frontm-api-verify` → generate (`/frontm-new-intent`,
`/frontm-add-collection`) → `npm run build` (in the app dir) → `/frontm-review`. One task per
fresh session. FrontM has **no unit tests** — verify on the live runtime + `/verify`.

---

## Layer-1 crib sheet (confirm these from REQUIREMENTS)

**Problem (one sentence):** internal crew/employees need to report misconduct anonymously and
track it to resolution; compliance staff triage/resolve/escalate without ever seeing who reported.

**Actors**
| Actor | Location | Org | Creates data? | Reads others' data? |
|---|---|---|---|---|
| Reporter | Vessel / shore (mobile + web) | Same org | Yes (reports, evidence, calls) | No — only own reports |
| Primary admin | Shore (mobile + web) | Same org | Yes (resolution, status, manual logs) | Yes — reports (identity-stripped) |
| Secondary admin | Shore (mobile + web) | Same org | Yes | Yes — escalated + against-admin |

**Triggers:** reporter submits a report; reporter places an anonymous voice call; auto-escalation
timer (CRITICAL +1d / others +3d); auto-close timer (+30d); reporter accept/reject/withdraw.

**Handoffs (all reporter-identity-free):** reporter→admin (new report); admin→reporter (status,
resolution, closed); reporter→admin (reopen once); admin→admin (escalation, call ring + ring-stop).

**Micro-apps (2):** `anonymous-user` (submit/track/call — own bot, mobile+web) and
`anonymous-admin` (triage/resolve/jobs/analytics/calls — own bot, mobile+web, role-gated).

**Cross-app contracts (MSG types):** `MSG_NEW_REPORT`, `MSG_REPORT_RESOLVED`,
`MSG_REPORT_STATUS_CHANGED`, `MSG_REPORT_CLOSED`, `MSG_REPORT_REOPENED`, `MSG_INCOMING_CALL`,
`MSG_CALL_STOP_RING`. **No payload carries reporter identity.**

**Shared data (one cluster, `shared: true`, `*_${systemId}`):** `reports` (audit), `call-queue`
(identity-free), `admin-users` (registry: role + availability).

**Key constraints to keep stating to the pipeline:** code-enforced anonymity (single
`adminProjection` gateway; recusal); mobile **and** web with **separate per-platform renderers**;
custom HTML UI (no Atlas Charts); voice-only calling with masking; decisions D1–D16 are fixed.

> If the pipeline proposes something that contradicts REQUIREMENTS/§15 or invents a business rule,
> stop it and point it back to this runbook + the relevant D-number.

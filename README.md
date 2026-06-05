# Anonymous Reporting System

A FrontM.ai product that lets internal users **submit and track reports anonymously**, and lets
authorised staff **triage, investigate, resolve, and escalate** them — **without ever seeing who
reported**. Built as **two microapps + a shared library in one repository**, modelled on the
`sailors-cart` monorepo architecture.

> **Start here:** [`REQUIREMENTS.md`](REQUIREMENTS.md) — problem statement, personas, flows, and
> the full requirements. Data model: [`specs/SPEC.md`](specs/SPEC.md).

## Layout

```
anonymous-reporting-system/
├── REQUIREMENTS.md         # problem statement + full requirements (read first)
├── specs/SPEC.md           # report data model + status state machine
├── lib/                    # shared building blocks consumed by BOTH apps
│   ├── constants.js        # statuses, categories, urgency, roles, MSG_* types, keys
│   ├── ticket-status.js    # status enum + metadata + allowed-transition map
│   ├── id-generator.js     # report-ID generation
│   ├── validation.js       # validators + HTML sanitiser
│   ├── notifications.js    # email + web-push + bot-to-bot helpers
│   ├── access.js           # role resolution + adminProjection (anonymity enforcement)
│   ├── calling.js          # anonymous voice-call helpers (VideoCall + VoIP, masked)
│   ├── utils/
│   │   ├── format.js       # HTML escaping + generic card builders
│   │   ├── platform.js     # state.client detection + per-screen renderer dispatch
│   │   └── theme.js        # shared theme tokens (web + mobile renderers)
│   └── collections/        # shared Docs + Collections (shared: true)
│       ├── reports.js          # the reports collection (audit: true)
│       ├── call-queue.js       # anonymous call entries (identity-free)
│       └── admin-users.js       # admin registry: role + availability (D3)
├── anonymous-user/         # User microapp (submit + track) — own bot
└── anonymous-admin/        # Admin microapp (triage + resolve) — own bot
```

Each app is built and deployed **independently** (its own `package.json`, `webpack.config.js`,
`deployment.config.json`) but compiles the shared `../lib` (wired into each app's
`webpack.config.js` babel `include`) and side-effect-imports it from `src/main.js`. All shared
logic lives **only** in `lib/` — no duplication across the apps.

## Develop

```bash
# Per app (run inside anonymous-user/ or anonymous-admin/)
npm install
npm run build        # lint + format check (prebuild) → webpack → frontm-build
npm run watch        # rebuild on save
npm run lint         # eslint
npm run format       # prettier --write
npm run deploy       # build + frontm CLI deploy
```

The FrontM framework docs are a git submodule under `docs/`
(`git submodule update --init docs`); the `.claude/` Claude Code config is another submodule.

## Anonymity model (summary)

Pseudonymous, **identity hidden from admins in code** (not merely assumed from the platform): the
reporter's account id is stored only to scope "My Reports" and deliver reporter notifications, and
is **stripped from every admin-facing surface** (queries via `lib/access.js` `adminProjection`,
bot-to-bot payloads, emails, and display bindings). See [`REQUIREMENTS.md`](REQUIREMENTS.md) §3.

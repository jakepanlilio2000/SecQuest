# SecQuest

An unofficial Security+ learning workspace with original practice, spaced review, timed mocks and private study notes. Built with Next.js, React and TypeScript, with SQLite locally and PostgreSQL for server deployments. The bundled **SY0-801 V8 objectives, document v2.0** were checked on **October 27, 2026**; this is not a claim of current exam availability or official affiliation.

[Project guide](https://jakepanlilio2000.github.io/SecQuest/) · [Source](https://github.com/jakepanlilio2000/SecQuest/tree/master) · [Deployment and recovery](docs/DEPLOYMENT.md)

The default branch is **master**. GitHub Pages is configured for a separate project information and setup guide, published after this change is merged and CI passes. It offers no accounts, sign-in or saved learning progress. The learning application requires a Node server and SQL database; no server production host is selected.

This release is an operational foundation, not completion of the entire master brief. It contains **44 original starter questions across all 27 objectives**, six question formats, persistent adaptive review, timed mock practice, and five defensive simulations. The 600-question target and independent subject-matter approval are **not complete**. See [implementation status](docs/STATUS.md) and [content provenance](docs/CONTENT.md).

## Run locally on Windows

Requires Node.js ^22.18.0 or >=24.11.0 (tested with the supplied Node 26.12 runtime). No WAMP, PHP, database service, AI key, or Docker installation is needed for the SQLite development path.

```powershell
npm ci --cache .npm-cache
npm run content:validate
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000** and create an account. Onboarding selects SY0-801, a daily goal, and an optional target date. There are no default accounts or passwords. Progress is stored in `data/secquest.sqlite`, not browser storage. Do not remove this file after starting real study.

The app also initializes migrations and missing starter records on its first API request. Seed operations do not replace existing question revisions or editorial changes.

`.env.example` describes configuration. Copy it to `.env` only when needed. Leave `DATABASE_URL` blank for SQLite. CLI scripts load the environment supplied by the shell; Next loads `.env` for its runtime. For external Postgres CLI use, set `$env:DATABASE_URL` explicitly or run Node with `--env-file=.env` before the script.

The Windows compatibility preload only handles restricted hosts where `os.userInfo()` is denied. It gives tooling a temporary-directory label and is not used for authentication or authorization.

## What works

- Registration, scrypt password hashing, hashed server sessions, sign-out, profile/preferences, data export and password-confirmed account deletion.
- Learning, filtered practice, recovery, daily review, ten-minute challenge, and configurable timed mock sessions.
- Single/scenario, multiple response, matching, ordering, and fictional log analysis. Each starter question has a definition, option-specific rationales, and at least two examples.
- Wrong answers enter a durable review schedule automatically and return after 3–8 intervening items when enough eligible session items remain. Otherwise they are deferred. Recent retries do not count as new mastery evidence.
- Mock drafts autosave. Correctness and explanations are absent from active exam payloads. Server time enforces expiry; the report appears after final submission or expiry.
- First-encounter/retry/delayed-recall analytics, objective coverage, XP with unique reward events, ranks, and eight evidence-based achievements.
- Searchable concept library, typo-tolerant lookup, deterministic concept companion, personal spaced flashcards, editable study-day plans, skill tree, five graded simulations.
- Restricted content dashboard with a JSON question editor, immutable revisions, separate-author review approval, publication states, atomic JSON/CSV import, export, coverage matrix, source register, audit history, and versioned exam configuration.
- Knowledge gaps and misconception evidence, a directed concept map with prerequisite paths, schedule-based retention forecasts, and a private Markdown notebook with autosave, conflict recovery, contextual saves, search, folders/tags and export. Start from the new sidebar sections; administrators manage mappings under Account settings → Content administration.

The [intelligent learning implementation report](INTELLIGENT_LEARNING_IMPLEMENTATION.md) records architecture, mapping coverage, model limitations, migration verification and rollback instructions. Forecasts are uncalibrated heuristics and remain nonnumeric without sufficient delayed-review evidence. The original grading and review scheduler remain in place.

For an existing database, back it up before first starting this release: `npm run db:backup -- data/backups/before-upgrade.sqlite` (backup tool requires Node 22.16+). Migrations 004 and 005 are additive. Run `npm run db:verify -- data/backups/before-upgrade.sqlite.manifest.json` immediately after seeding to compare original rows, then `npm run intelligence:backfill` for historical evidence and `npm run progression:backfill` for eligible badges. No learner records are reset.

## Verify

```powershell
npm test
npm run lint
npm run content:validate
npm run build
npm run typecheck
npm start
```

The automated unit/integration suite uses isolated temporary SQLite databases and synthetic accounts. It exercises real database writes and route handlers. Desktop and mobile Playwright scenarios are included:

```powershell
# On a machine configured for Playwright browser execution:
npx playwright install chromium
npm run test:e2e
```

Recent local validation passed 72 unit/integration tests, two HTTP E2E tests, desktop/mobile Chromium workflows, lint, typecheck, content validation and production build. It used Node 22.14 with engine warnings; GitHub CI uses Node 24 and is the merge gate. Build before standalone typechecking on a clean checkout to generate Next route types. Docker/Postgres, SMTP and independent accessibility/security acceptance remain outstanding. See [QA evidence](docs/QA.md) for historical results.

## Content administration

Register an account, then run:

```powershell
npm run admin:create
```

Enter the registered email to promote the account. Open **Settings → Content administration**. New and edited content starts as Draft. The author cannot approve their own revision. Create a second reviewer/editor account through the operator tooling for proper separation. `scripts/create-admin.ts` can assign learner, reviewer, content administrator, or system administrator; the default is system administrator.

Question imports accept a JSON array, or CSV with one `content` column containing quoted JSON question objects. Exported CSV follows that format. Import validation is transactional; no rows are inserted if any row fails. Consult `content/questions.ts` and `src/lib/types.ts` for the schema.

## Deploy

PostgreSQL is the deployment database. Redis is intentionally unnecessary for this release: rate limits, queues, and rewards are durable database records, avoiding cross-process in-memory state. A typed repository using bound SQL parameters supports both PostgreSQL and SQLite; Prisma is not required.

See [deployment guide](docs/DEPLOYMENT.md), [architecture](docs/ARCHITECTURE.md), and [security notes](docs/SECURITY.md).

```powershell
# Set POSTGRES_PASSWORD in .env first; use a URL-safe random value.
docker compose up --build -d
# Development container with live source updates:
docker compose -f compose.yaml -f compose.dev.yaml up --build
```

This application runs as a Node service; placing it under WAMP's document root does not make it a PHP application. Use the local Node port or configure Apache as a reverse proxy. For public deployment, use HTTPS, set the canonical `APP_ORIGIN`, set `COOKIE_SECURE=true`, and provide backups and monitoring.

CompTIA and Security+ are their respective owners' marks. SecQuest is unofficial, offers original educational material, and does not supply actual examination questions or predict an official passing score.

## Completion release · October 28, 2026

Official shadcn MCP is configured and actual registry calls verified. **Restart Codex for native shadcn tools in a new session.** Six scoped shadcn primitives refine the current interface. New features include private note revision restoration and recall cards, weekly missions/personal bests, optional sharing/sounds and unlocked accents, four-week/elapsed-time insights, verification-token workflow, versioned review policies and duplicate-review assistance. SMTP delivery remains unavailable without configuration.

Historical October 28 checks: **70 tests**, **2 HTTP E2E tests**, lint, TypeScript, content validation and optimized build passed. The dependency audit recorded in the [final implementation audit](FINAL_IMPLEMENTATION_AUDIT.md) is a historical snapshot: the recent lockfile install reported 10 advisories, so a clean current dependency audit is not claimed. See [feature statuses](IMPLEMENTATION_GAP_ANALYSIS.md) for remaining product work.

```powershell
npm run lint
npm run mcp:verify
npm run progression:backfill
# Starts its own isolated local QA server at port 3001:
npm run test:e2e:api
```

Both E2E suites start their own server with a fresh temporary SQLite database, blank DATABASE_URL and SMTP_URL, and no server reuse. Ports 3100 (GUI) and 3001 (HTTP) must be free. E2E_BASE_URL may not redirect either suite to another instance. Run the suites sequentially because they share Next development build output. Temporary databases contain synthetic fixtures and are retained in the OS temporary directory for diagnosis. These configuration changes have focused automated coverage; full Playwright execution still requires an installed toolchain. Development tooling requires Node ^22.18.0 or >=24.11.0. Historical release results above do not certify later changes.

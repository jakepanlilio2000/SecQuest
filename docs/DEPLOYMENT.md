# Deployment and recovery

## Current delivery policy: CI only

The owner selected CI only; production deployment is deferred. `.github/workflows/ci.yml` validates pull requests, branch pushes and merge-queue candidates. It does not publish an image, deploy a site, contact a production database or upload test artifacts. No production host, URL or credentials are configured. GitHub Pages cannot run the existing Node API/auth/SQL application; no static export or guest demo is included.

The `Validation` job uses GitHub-hosted Ubuntu with Node 24 (also the Docker image's runtime major), SHA-pinned checkout/setup actions, read-only contents permission, no persisted checkout credentials and cancellation of superseded runs. Only npm's download cache is cached, keyed by the lockfile through setup-node; node_modules, Next output, databases, environment files and credentials are not cached. `npm ci` enforces the lockfile. No workflow step receives repository secrets. Keep PR jobs on disposable GitHub-hosted runners and use `pull_request`, never privileged `pull_request_target` execution of PR code.

Required job steps: lockfile install, lint, typecheck, unit/integration tests, content validation, production build, isolated HTTP workflows and Chromium desktop/mobile workflows. Test database URL selectors are explicitly blank; the fallback path is in runner temporary storage and test fixtures allocate their own temporary SQLite files. E2E configs start their own disposable instances and do not reuse a listening app. PostgreSQL, Docker, SMTP, TLS and production acceptance remain separate release prerequisites; a green SQLite workflow does not establish those results.

### Repository setup and PR verification

1. Apply this change on a feature branch in the actual Git checkout and open a PR. This supplied directory has no `.git`/remote metadata, so branch protections, the default branch and remote workflow execution could not be inspected here. No repository settings have been changed.
2. Enable Actions under the repository's existing security policy. An administrator should configure the protected default branch/ruleset to require PR review and the `Validation` status from this workflow, with changes up to date (or a merge queue). Confirm the status name in the first actual run before making it required. Do not allow direct/force pushes or deletion. Require appropriate review for workflow changes. These are setup instructions, not settings this change enforces.
3. Inspect the PR diff for unexpected workflow permissions, secret references, dependency changes and data files. Check that both pinned action SHAs belong to their official repositories before updating them.
4. Verify the PR check at the repository's **Pull requests → PR → Checks → Validation** and its **Actions → SecQuest CI** run. There is no public preview URL. Inspect failed logs before retrying; never disable a required check to obtain a passing result. Fork PRs may require maintainer approval to run.
5. Merge through the protected-default-branch PR process only when the reviewed revision's required checks pass. The resulting push validates the merged revision again. Merging performs no production release under the current policy.

Official references: [GitHub secure workflow use](https://docs.github.com/en/actions/reference/security/secure-use), [workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency), [Playwright CI setup](https://playwright.dev/docs/ci-intro).

### Future server release gate and verification

Production release requires a separate reviewed host-specific change after the owner selects a server-capable host. That workflow must accept only the protected default branch's checked revision, require successful validation, serialize production releases and use a protected production environment with approval. PR jobs must never publish or receive production credentials. Do not add deployment tokens to source or pass runtime secrets as image build arguments.

Use the standalone Node service and durable PostgreSQL described below. Configure runtime `DATABASE_URL` (or Compose-managed `POSTGRES_PASSWORD`), the exact HTTPS `APP_ORIGIN`, `COOKIE_SECURE=true`, and authorized `SMTP_URL`/`MAIL_FROM` when email is enabled, through the selected host's secret mechanism. Restrict database/network access and configure database transport security as required by that host. Keep the application behind the HTTPS proxy; the current Compose application port binds to loopback.

Before first application request, back up and verify restoration to an isolated database, retain the previous release artifact, and run tracked migrations/seed once with the intended database environment. Use an operator environment containing the TypeScript sources and locked dependencies; the slim runtime image omits those scripts. The first API request, including `/api/health`, currently performs initialization, so keep traffic stopped until the backup and migration checks finish. Do not change database engines or overwrite a volume during rollout.

After deploying the checked revision, verify `<APP_ORIGIN>/api/health` returns HTTP 200, `ok: true` and `database: postgresql`, then verify the landing page at `<APP_ORIGIN>/`. These are templates; no production URL exists yet. In an isolated staging instance with synthetic accounts, verify sign-in/logout, refresh/resume, attempts/schedules, notebook persistence, cross-account isolation, mock redaction and account export/deletion. Verify secure cookies, origin rejection and SMTP expiration/replay behavior. Production smoke checks must not delete or rewrite real learner records. Configure encrypted backups, restore drills, storage/error monitoring and operator alerts before public traffic.

All accounts, question revisions, attempts, schedules, notes and settings persist in SQL. PostgreSQL requires its retained volume or managed database; container replacement alone must not replace that storage. Local SQLite requires durable disk. Browser drafts are recovery aids; no cross-device sync, browser database, export import/restore facility or infrastructure backup is added here. CI databases and runner files are disposable.

Rollback: revert a faulty CI change through another reviewed PR. For a future server release, redeploy the retained previous artifact while retaining additive tables and migration records. If data restoration is unavoidable, snapshot current state first, stop writers, restore into a separate destination, verify preservation and account for newer records before cutover. Never roll back by deleting the PostgreSQL volume or replacing an active SQLite/WAL file. The backup procedures below remain required.

## Local production build

```powershell
npm ci --cache .npm-cache
npm run build
$env:APP_ORIGIN='http://127.0.0.1:3000'
npm start
```

Production origin checks are strict. Set `APP_ORIGIN` to exactly the browser origin, including scheme and port. Use the same hostname consistently. The development server accepts only localhost and 127.0.0.1 at its local port in addition to a configured canonical origin.

SQLite is intended for one small local instance on a durable local disk. Use PostgreSQL for multi-instance deployment. SQLite data does not automatically migrate to Postgres; export learner data and plan an explicit migration before changing databases.

## PostgreSQL + Docker

1. Install Docker through its official distribution and create `.env` from `.env.example`.
2. Set a strong URL-safe alphanumeric `POSTGRES_PASSWORD` so it can be used in the Compose connection URL. Never commit `.env`.
3. Set `APP_ORIGIN=http://localhost:3000` for local Compose, `COOKIE_SECURE=false` for local HTTP only.
4. Run `docker compose up --build -d` and inspect `docker compose logs app`.
5. Request `/api/health` to initialize/verify the database; initialization applies tracked migrations and idempotent starter records. Create accounts in the UI.
6. For an internet-facing host, terminate HTTPS at a trusted reverse proxy; set the public canonical `APP_ORIGIN` and `COOKIE_SECURE=true`. Bind the application behind that proxy. The database has no published host port by default.

The production image uses standalone Next output and a non-root Node user. The development override mounts source and isolated Linux dependency/build volumes. No container runtime was available on the implementation host, so this recipe requires execution in your deployment environment before release.

To run CLI operations for a Compose database, use a dedicated migration/operator container or a local shell with `DATABASE_URL` exported. The slim production image intentionally omits TypeScript operator sources. Run initialization before scaling replicas; advisory migration locking prevents duplicate migrations, but initial seeding should remain a single deployment step.

## Password recovery

Set `SMTP_URL` and `MAIL_FROM` to an authorized SMTP service and configure the canonical HTTPS origin. The reset endpoint stores only a hashed, single-use 30-minute token, sends a link, and revokes all sessions after a successful password change. No tokens are returned in the API or written to ordinary logs. Without SMTP, recovery explicitly reports unavailable; login and learning continue to function.

## Backups

PostgreSQL: schedule `pg_dump` custom-format backups to encrypted storage with separate access and retention. Use a database administrator's existing secure credential mechanism; avoid passwords in command arguments. Verify restores into an isolated database using `pg_restore`, then run application smoke checks and record recovery time. Set a recovery-point and recovery-time target appropriate to your deployment.

SQLite: use an online SQLite backup tool or stop the Node process before copying the database and associated WAL state. Copying only the database file during active WAL writes is not a reliable backup. Store backups outside the web-served root and restrict filesystem access. Do not expose the WAMP project directory as a publicly browsable static directory.

Test account export, sign-in, saved session resumption, attempt counts, and due schedules after restoration. A JSON profile export is a portability artifact, not a complete infrastructure backup or an implemented import/restore facility.

## Release verification

Both Playwright configs now launch their own development server with a fresh SQLite database under the OS temporary directory. They override inherited DATABASE_URL, SQLITE_PATH, APP_ORIGIN, COOKIE_SECURE and SMTP_URL, and refuse to reuse a listening server. Keep ports 3100 (GUI) and 3001 (HTTP) free; E2E_BASE_URL cannot select another instance. Run the suites sequentially because Next build output is shared. Synthetic databases are retained for diagnosis; do not use these suites to test a running deployment. PostgreSQL acceptance remains a separate task against a disposable database.

Run unit/integration tests, typecheck, content validation, production build, and desktop/mobile browser workflows. Test SMTP and the exact PostgreSQL version in the deployment environment. Use `TEST_DATABASE_URL` only with a disposable empty Postgres database for the integration suite; never point tests at a live learner database. The blueprint unit test intentionally uses isolated SQLite.

Monitor error rates and database storage, rotate infrastructure secrets, patch dependencies, and rehearse restoration. Production logs emit structured request failures without credentials. Centralized observability, retention policy enforcement, automatic backups, and uptime alerts are operator responsibilities.

## Applying the intelligent learning upgrade

Back up before starting the new release, because the existing initialization path applies pending migrations. Migration 004 is additive. For SQLite, `npm run db:backup -- <new-backup-path>` uses an online snapshot (Node 22.16+ required by the backup API) and writes a digest/row manifest; it refuses an existing destination. Run `npm run db:seed`, then immediately `npm run db:verify -- <backup-path>.manifest.json` while original records are still unchanged by new learner activity. The verifier checks backup digest, integrity, foreign keys and preservation of every original row. Run `npm run intelligence:backfill` to derive evidence in bounded batches. The CLI needs the intended database environment exported explicitly.

For PostgreSQL, use operator-managed `pg_dump`/restore verification; the SQLite utilities intentionally refuse a PostgreSQL URL. Apply migrations/seed once before scaling replicas. Execute the expanded integration tests against a disposable PostgreSQL instance before release; this host verified SQLite only.

Preferred code rollback keeps all additive tables and migration records, then redeploys the operator's previously retained release artifact. For a database restore, snapshot the current state first, restore the old backup into a new isolated destination, verify sign-in/progress/schedules, and cut over only with writers stopped. Never blindly replace an active WAL file or discard newer notebook entries. Full backup and rollback details are in [the upgrade report](../INTELLIGENT_LEARNING_IMPLEMENTATION.md).

## Completion release operations

Development/build tooling now requires Node **^22.18.0 or >=24.11.0**, tested 26.12. Scoped Tailwind/PostCSS and official primitives require normal build dependencies. Use the existing standalone container entry point for deployment; `next start` produces a standalone-output warning during local QA even though local HTTP checks pass.

Back up before first start of this release; migration 005 is additive and initialization can apply it automatically. Seed once, verify immediately before live traffic, then run `npm run progression:backfill` to derive eligible badges without XP rewriting. Existing sessions retain policy v1 and due dates; new sessions snapshot the active policy. CLI processes require the intended database environment explicitly exported.

Strict preservation may detect normal throttle/cache changes if requests remain active. Retain the raw result and inspect differences rather than reverting live security counters. The companion completion audit explicitly separates these from original learning/content/account rows; it does not excuse arbitrary changes.

Configure SMTP_URL/MAIL_FROM and APP_ORIGIN, then verify real mail and expiration/replay behavior before declaring verification/recovery operational. Mandatory email gating is not enabled for existing accounts. Verify PostgreSQL migrations, transactions/advisory locking and complete workflows against a disposable target-version database; this host tested SQLite only.

Codex MCP is development tooling: backup location and exact configuration are in the final audit. Restart Codex to load newly registered tools. Do not package personal Codex config, local learner DBs, backups or QA evidence into a public static host. Rollback keeps additive tables; any data restore requires a fresh current-state backup and stopped writers so newer notes/progress are not discarded.

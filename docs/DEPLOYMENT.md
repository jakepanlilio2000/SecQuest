# Deployment and recovery

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

Run unit/integration tests, typecheck, content validation, production build, and desktop/mobile browser workflows. Test SMTP and the exact PostgreSQL version in the deployment environment. Use `TEST_DATABASE_URL` only with a disposable empty Postgres database for the integration suite; never point tests at a live learner database. The blueprint unit test intentionally uses isolated SQLite.

Monitor error rates and database storage, rotate infrastructure secrets, patch dependencies, and rehearse restoration. Production logs emit structured request failures without credentials. Centralized observability, retention policy enforcement, automatic backups, and uptime alerts are operator responsibilities.

## Applying the intelligent learning upgrade

Back up before starting the new release, because the existing initialization path applies pending migrations. Migration 004 is additive. For SQLite, `npm run db:backup -- <new-backup-path>` uses an online snapshot (Node 22.16+ required by the backup API) and writes a digest/row manifest; it refuses an existing destination. Run `npm run db:seed`, then immediately `npm run db:verify -- <backup-path>.manifest.json` while original records are still unchanged by new learner activity. The verifier checks backup digest, integrity, foreign keys and preservation of every original row. Run `npm run intelligence:backfill` to derive evidence in bounded batches. The CLI needs the intended database environment exported explicitly.

For PostgreSQL, use operator-managed `pg_dump`/restore verification; the SQLite utilities intentionally refuse a PostgreSQL URL. Apply migrations/seed once before scaling replicas. Execute the expanded integration tests against a disposable PostgreSQL instance before release; this host verified SQLite only.

Preferred code rollback keeps all additive tables and migration records, then redeploys the operator's previously retained release artifact. For a database restore, snapshot the current state first, restore the old backup into a new isolated destination, verify sign-in/progress/schedules, and cut over only with writers stopped. Never blindly replace an active WAL file or discard newer notebook entries. Full backup and rollback details are in [the upgrade report](../INTELLIGENT_LEARNING_IMPLEMENTATION.md).

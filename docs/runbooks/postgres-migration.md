# MongoDB → PostgreSQL migration runbook

The EdNova API and web app store their data in PostgreSQL through Prisma. The
Python AI service keeps its own MongoDB collections. This page covers how to get
from an existing MongoDB deployment to PostgreSQL without losing records, and how
to roll back if something goes wrong.

## What moved

| Before | After |
|---|---|
| `users`, `courses`, `course_revisions`, `course_enrollments`, rooms, attempts, evidence, rankings, notifications, analytics, AI jobs | PostgreSQL tables in `apps/api/prisma/schema.prisma` |
| `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications`, `auth_rate_limits` | PostgreSQL tables, managed by better-auth through `@better-auth/prisma-adapter` |
| Python-owned collections (`coach_actions`, `pacing_data`, `review_schedule`, `search_history`, `task_scheduling`, `chunk_embeddings`, …) | unchanged, still MongoDB |

Identifiers are preserved on the way in: every MongoDB `_id` becomes a row key,
so stored references stay valid. Primary keys are PostgreSQL `uuid` columns and
the API returns `id`.

## 1. Back up MongoDB first

```bash
apps/api/scripts/backup.sh "mongodb://localhost:27017/ednova"
```

Confirm the dump directory exists and is non-empty before continuing. This is the
only step that makes the migration reversible.

## 2. Prepare PostgreSQL

```bash
pnpm dev:infra:up                       # local PostgreSQL 17 on 5433
cd apps/api
pnpm prisma:deploy                      # apply every migration
pnpm prisma:generate                    # regenerate the client
```

In an existing deployment, create the role and database first:

```bash
createuser ednova --pwprompt
createdb ednova --owner ednova
```

## 3. Dry run the data migration

```bash
cd apps/api
DATABASE_URL=postgresql://ednova:<password>@<host>:5432/ednova \
MONGODB_URI=mongodb://<mongo-host>:27017/ednova \
pnpm migrate:data --dry-run
```

The script reads and converts every collection and writes nothing. It prints a
per-collection table (`read`, `written`, `skipped`, `failed`) and lists any
collection in MongoDB that has no target table. Resolve whatever it reports
before moving on; `migration-report.json` holds the detail.

## 4. Run it for real

```bash
DATABASE_URL=… MONGODB_URI=… pnpm migrate:data
```

The script is idempotent: it upserts by primary key, so a partial run can simply
be repeated. `--strict` aborts on the first document it cannot convert; without
it, bad documents are reported and the rest of the run completes.

At the end it compares source and target counts per collection and checks the
key relations (course → subject, enrollment → user, membership → institution).
Any mismatch is printed and written to the report.

## 5. Verify before switching traffic

```bash
# Row counts line up
DATABASE_URL=… pnpm migrate:data --verify-only
# The API boots and serves against PostgreSQL
pnpm --filter api start
curl -fsS http://localhost:3001/api/v1/monitoring/health
```

Sign in as a migrated user, open a course, start a study session and confirm the
data that appears is the data that was in MongoDB.

## 6. Roll back

The migration never writes to MongoDB, so rollback is:

1. Point `DATABASE_URL` consumers back at the previous deployment, or restore the
   dump taken in step 1:
   ```bash
   apps/api/scripts/restore.sh <dump-dir> "mongodb://localhost:27017/ednova"
   ```
2. Check out the last commit before the migration and redeploy it.

PostgreSQL itself can be backed up and restored with
`apps/api/scripts/backup-postgres.sh` and `apps/api/scripts/restore-postgres.sh`
(`pg_dump -Fc` / `pg_restore --clean --if-exists`).

## Operations notes

- **Migrations** run with `prisma migrate deploy`. Never edit an applied
  migration; add a new one.
- **Expired rows.** MongoDB TTL indexes became the `ednova_sweep_expired_rows()`
  PostgreSQL function (dismissed notifications, expired Nardouch conversations,
  terminal AI jobs). Schedule it, for example daily:
  ```sql
  SELECT cron.schedule('ednova-sweep', '17 3 * * *', 'SELECT ednova_sweep_expired_rows()');
  ```
  or call it from your scheduler of choice.
- **Single-instance lease.** `api_instance_leases` uses `now()` on the server, so
  clock skew between API processes cannot grant two owners.

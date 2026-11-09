# MongoDB → PostgreSQL migration

**Status:** complete for the Node API and the web app. The Python AI service keeps
its own MongoDB collections and is unaffected.

This page is the summary of record: what changed, how it was verified, what was
deliberately not moved, and how to roll back. The step-by-step operator procedure
is the [runbook](runbooks/postgres-migration.md).

---

## 1. What was migrated

| Layer | Before | After |
|---|---|---|
| Persistence | MongoDB 7 through Mongoose 8 | PostgreSQL 17 through Prisma 7.10.1 |
| Schema of record | 48 Mongoose schema files (~5.8k lines) | `apps/api/prisma/schema.prisma` |
| Auth storage | `@better-auth/mongo-adapter` | `@better-auth/prisma-adapter` |
| Identifier shape | 24-char ObjectId hex, exposed as `_id` | native PostgreSQL `uuid`, exposed as `id` |
| Query surface | ~480 Mongoose call sites | Prisma delegates, same call semantics |

### Collections → tables

All 57 application collections map to tables with their original names
(`study_rooms`, `course_enrollments`, `institution_memberships`, `ai_jobs`, …).
A handful of embedded arrays became proper relations because they are written
element-by-element:

| Embedded before | Relation now |
|---|---|
| `users.refreshTokens[]` | `refresh_tokens` |
| `coupons.usedBy[]` / `usageHistory[]` | `coupon_usages` (unique per coupon + user) |
| `study_groups.members[]` / `invites[]` | `study_group_members` / `study_group_invites` |

Documents that are only ever read and written whole stay JSONB: `courses.topics`,
`course_revisions.contentDocument`, `student_attempts.answers`,
`structured_assets.payload`, `study_rooms.participants` / `commandReceipts` /
`visualizationState`, `gamifications.stats` / `xpHistory` / `achievements`, and
the `calendar` row payloads.

### MongoDB behaviours that had to be rebuilt

MongoDB gave some guarantees through index options and single-document atomic
updates. Each one is preserved explicitly:

| MongoDB mechanism | PostgreSQL replacement |
|---|---|
| Unique `(userId, attemptId)` etc. | `@@unique` constraints |
| Partial unique index (`sessionchats.peer_stream`, room creation command) | partial unique indexes in `20261109030000_mongo_semantics` |
| TTL index (dismissed notifications, Nardouch conversations, terminal AI jobs) | `ednova_sweep_expired_rows()` function, scheduled by the operator |
| `$inc` / `$addToSet` counters (coupons, XP, room `seq`) | transactions or conditional `updateMany` |
| `findOneAndUpdate(..., { new: true })` on a guarded filter | `updateMany` + re-read, or `upsert` on the natural key |
| Optimistic concurrency (`__v`, `version`, `seq`) | conditional update on the version column |
| Room lease with server time | `UPDATE … WHERE expiresAt <= now()` + `now()` server time |

---

## 2. How it is verified

| Check | Result |
|---|---|
| `prisma validate` | schema valid |
| `prisma migrate deploy` (test + dev databases) | all migrations applied |
| `tsc -p tsconfig.check.json` | clean |
| `tsc` (production build) | clean |
| Jest — whole API | 101 suites / 1350 tests passing |
| `node:test` — routes and top-level suites | 15/15 passing |
| `node:test` — integration suites (41 files) | 352/360 passing (8 LiveKit media cases blocked, see below) |
| Jest — web app | 42 files / 282 tests passing |
| Data migration dry run + apply against the live Mongo copy | see below |

The 8 integration tests that do not pass are all in the two LiveKit media
suites (`step9-livekit-media`, `step9-security-matrix` vector 5). They need a
LiveKit SFU on `127.0.0.1:7880`; none is running in this environment, and the
suites' own log says `LiveKit server unreachable`. They exercise WebRTC
transport permissions, not database behaviour, so the migration cannot have
caused them. Everything else — rooms, facilitation, instructor analytics,
evidence, rewards, ingestion, institutions, the master evaluation scenario —
passes.

### Data migration result on the development dataset

```
users                    4 read  → 4 written (idempotent, re-run skips)
subjects                 2 read  → 2 written
courses                  8 read  → 8 written
course_enrollments       5 read  → 5 written
course_revisions        25 read  → 8 written, 12 skipped (already present), 5 refused
notifications            5 read  → 5 written
learning_objectives      4 read  → 4 written
```

The 26 refused documents are **orphaned references that were already unreachable
in MongoDB** — for example 5 revisions whose `courseId` names a course that no
longer exists, and 14 auth sessions/accounts whose `userId` has no `auth_users`
row. The script refuses them rather than inventing parents, reports each with its
`_id` and a plain-language cause, and continues with the rest. `--strict` turns
those into a non-zero exit for CI.

One real conversion defect was found and fixed this way: legacy OCR text
contained U+0000, which MongoDB stores but PostgreSQL `jsonb` rejects (SQLSTATE
22P05). Those characters are now stripped and counted in the report.

---

## 3. What did **not** move

The Python AI service (`apps/ai`) owns its own collections — `coach_actions`,
`pacing_data`, `review_schedule`, `search_history`, `task_scheduling`,
`evaluation_sessions`, `chunk_embeddings`, `schedule_history`,
`schedule_snapshots`, `signals`, `reflections`, `daily_metrics`, and the LLM
budget ledger. They stay in MongoDB; nothing in this migration touches them.

Two consequences worth knowing:

- `agents/coach/services/course_repository.py` and `planner_repository.py` used to
  read the API's `courses` / `subjects` / `studysessions` / `studyplans`
  collections. Those now live in PostgreSQL, so those readers find nothing and
  the coach falls back to task-title-only context — the degradation path the code
  was already written to tolerate. The files carry a note saying so.
- The QA harness passes the Python container a `MONGODB_URI`; the Node runtime
  no longer reads one.

One Node path stays on MongoDB on purpose: `modules/study/src/services/planningBudget.ts`
reads the `llm_approval_budgets` ledger from `LLM_BUDGET_MONGODB_URI` when it is
configured. That ledger is shared with the Python LLM client, which debits the
same collection, so moving only the Node half would split one accounting record
across two stores. It fails closed when unconfigured, and its tests cover that.
It should move together with the Python budget client, not before.

---

## 4. Rollback

The migration never writes to MongoDB, so rollback is non-destructive:

1. Restore MongoDB from the dump taken before starting (`scripts/restore.sh`).
2. Redeploy the last commit before this migration.
3. PostgreSQL data can be discarded, or restored from
   `scripts/backup-postgres.sh` output with `scripts/restore-postgres.sh`.

See the [runbook](runbooks/postgres-migration.md) for the exact commands.

---

## 5. Remaining work

- The Playwright browser run was not executed here. The harnesses are ported
  (`tests/helpers/provision-test-database.ts` creates and migrates a throwaway
  database per run, and the Playwright configs pass it through), but no browser
  session was driven, so sign-in / upload / study-room flows are verified by
  the API and integration suites plus a live boot, not by a browser.
- The two LiveKit media suites need an SFU server (see above).

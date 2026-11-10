# Noveris development

Use Node >=24 and pnpm 11.3.0 as declared in root/package manifests. Python AI supports >=3.11,<3.15 and has its own Poetry manifest. The host default Python may be outside this range; choose a compatible isolated environment. See [architecture](architecture.md) for runtime boundaries.

## Local setup

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm dev:infra:up
pnpm dev:doctor
pnpm --filter api db:setup
pnpm dev
```

`setup` creates missing API/web/AI env files with shared random secrets and consistent local ports. Existing files are never overwritten; `doctor` identifies mismatches without printing values. Review local files yourself when repairing an existing installation. Never commit env files or point test commands at production data.

The development stack is `deploy/compose.development.yml`; the separate test stack is `deploy/compose.test.yml`. The dev project provides PostgreSQL 5433, RabbitMQ 5673 (management UI 15673), Redis 6381 and Mailpit SMTP 1026/UI 8026. Ports bind to loopback; credentials are local-development defaults. Volumes persist through `pnpm dev:infra:down`. Dev and test stacks share the PostgreSQL/Mailpit host ports: run one stack at a time. Integration/auth/browser commands use isolated database names; they can use the running dev PostgreSQL/Mailpit.

Schema changes are Prisma migrations. Run `pnpm --filter api exec prisma migrate dev --name <name>` to create one and `prisma migrate deploy` (CI and production) to apply them. The client is generated into `apps/api/src/generated/prisma`; run `pnpm --filter api exec prisma generate` after pulling a schema change.

For newly generated host configurations, `pnpm dev:setup` gives Node and Python the same absolute `INGEST_UPLOADS_DIR` and `FAISS_INDEX_DIR` paths under `var/`. The default `var/dev-uploads` and `var/dev-faiss` directories are excluded from Git because they contain private originals and indexes. Existing environment files are never overwritten: `pnpm dev:doctor` flags missing or mismatched paths, service keys and broker settings for manual correction. These host paths are distinct from Docker named volumes; sharing storage with containerized Python requires an explicit matching bind mount or a compatible shared volume.

`pnpm dev` builds/starts API :3001 and Next :3000 only. `pnpm dev:api` and `pnpm dev:web` run them independently. API health: `/api/v1/health`; OpenAPI: `/api/v1/docs/openapi.json`. Next proxies HTTP `/api/v1` and `/uploads`; local setup sets `NEXT_PUBLIC_WS_URL` to the API origin for direct WebSocket access. Inspect the current generated configuration when choosing hostnames.

## Workspace and collaboration

The root `pnpm-workspace.yaml` already includes the API, its seven domain packages, shared package and web. Keep the root lockfile and use `pnpm --filter <package> <command>` for scoped work; do not install with npm/yarn inside packages. Python is independent and managed by Poetry.

Branch from current main per coherent task (`feat/ed-30-course-drafts`, for example). Include task ID, changed contract, tests and known limits in each PR. Habib owns source/revision/access contracts; Tasnim activities/private evidence; Aziz room/public state. Shared files, generated adapters, CI and lockfile changes need a single editor per integration window and consumer review. Run `pnpm generate:contracts` after route-contract edits; commit the generated adapters with their generator input.

## AI lifecycle

See [AI service](ai-service.md). Use a compatible Python environment with Poetry; configure PostgreSQL, reachable broker, optional Redis, `AI_SERVICE_API_KEY` and provider/model configuration. Node's `AI_SERVICE_API_KEY` must match Python. The API service key is a server-to-server secret, separate from model provider credentials.

If Poetry is unavailable but the locked application environment is already installed, set `EDNOVA_AI_PYTHON` in `apps/ai/.env` to that environment's absolute Python executable. `pnpm dev:ai` and `pnpm dev:worker ingestion` then use it directly. `pnpm dev:doctor` checks the selected interpreter and basic dependencies. For external inference, see the separate approval and durable-budget prerequisites in [revision sources](runbooks/ednova-revision-sources.md); mock mode is not approved provider execution.

Host-mode scanned-PDF ingestion additionally needs local Tesseract with English
language data (`tesseract-ocr`, `tesseract-ocr-eng` on Debian/Ubuntu). The image
includes these packages. See the ingestion worker and course source-review gates for processing bounds and review requirements.

HTTP alone does not consume broker jobs. Launch ingestion/planner/schedule/coach/evaluator/search workers as required in separate processes. Share the correct uploads directory and reconcile Node course IDs/aiCourseId with Python persistence. The shared LLM client requires explicit `LLM_MOCK=1` for test responders. Without a configured provider key it raises `LLMUnavailableError` (`UNAVAILABLE`); existing callers may choose an identified deterministic fallback. A successful fallback/template is not evidence of real inference. Organizer-model adaptation is PLANNED. Local setup sets `LLM_MOCK=1` explicitly; this is development scaffolding, not real inference acceptance.

## Existing commands and tests

| Root command | Scope / prerequisite |
|---|---|
| `pnpm build` | API tsc and Next production webpack build |
| `pnpm lint`, `pnpm typecheck` | Both Node packages; strict API checks include test files |
| `pnpm test` | API route checks + Jest + Node unit/real integration + auth lifecycle, then Vitest; stops on failure |
| `pnpm test:integration` | API integration cases; real roundtrip opt-in separate |
| `pnpm test:auth` | API build then Better Auth lifecycle/Nest tests; PostgreSQL on 5433 |
| `pnpm test:e2e` | Auth/workspace/smoke Playwright; test PostgreSQL/Mailpit and browser required |

No root format command exists. Package `format` scripts are different and may have legacy globs; do not treat them as a repository-wide check. Python checks use its own environment.

When the development site is already running, use
`AUTH_E2E_WEB_PORT=5192 AUTH_E2E_API_PORT=3192 pnpm test:e2e`.
The root command uses `scripts/run-integrated-browser.mjs --auth` to create a
disposable web source copy under `.cache/`, with real links to the declared
locked dependencies. It copies no environment/credential files. Managed auth
tests use a generated `ednova_auth_browser_*` database and the selected origin
for both services; Next writes generated files into the private copy so the IDE
development server and its type/config files are preserved. Browser-generated
synthetic database records currently remain available for diagnosis after the
run; never reuse those databases for development or real users.

## Reproducible verification

Run quality gates against the same checkout and a migrated disposable database.

API `test:node` and `test:node:integration` execute Node test suites separately from Jest. The integration command normally points its AI HTTP boundary at an unavailable loopback port to exercise deterministic recovery without provider calls. Real inference requires separate bounded approvals. Install Chromium and browser media prerequisites with `pnpm --filter web exec playwright install chromium ffmpeg`.

For an isolated PostgreSQL run, reuse `apps/api/tests/helpers/provision-test-database.ts` to create and migrate a disposable database. Set the test process `DATABASE_URL` before importing persistence. Clean up through the matching teardown. Do not treat the development database as a disposable test fixture.

## Troubleshooting by boundary

| Symptom | Check |
| --- | --- |
| API/web session rejected | Shared Better Auth secret, database URL and origin settings |
| Database field/type error | Actual migrated schema, generated Prisma client and database target |
| Upload stays processing | Broker credentials, worker process, source operation and matching storage paths |
| Tutor/lab unavailable | AI service credential, provider key, unexpired approval and reachable API budget ledger |
| Source artifact mismatch | Revision manifest, content identity, index/artifact files and shared paths |
| Room reconnect misses messages | Current room membership, direct WebSocket origin and history recovery |
| Dev stack cannot bind a port | Existing Docker/host listeners and the chosen dev/test Compose project |

The configuration doctor checks local settings and prerequisites. It does not prove that a live database schema or provider is ready. A `LengthMismatch` / `P2000` error while seeding means the database was migrated with an older schema (identifiers are now native UUIDs). Use a fresh database, or run `pnpm --filter api exec prisma migrate reset` on a disposable one.

## Working conventions

Keep credentials and private artifacts out of Git. Source JSON, contracts, lockfiles and fixture documents are versioned inputs. Run `pnpm generate:contracts` after changes to relevant domain routes. Preserve source pins, authorization checks, message identities, replay behavior and rollback procedures when changing workflows.

Documentation is indexed in [README](README.md).

### Student background actions

After starting the local infrastructure, run `pnpm dev:ai` for the AI HTTP service and
`pnpm dev:workers` for ingestion, feedback, planning, search, scheduling and coaching.
Both commands read `apps/ai/.env` and use the selected local Python environment.
Model-backed operations still require their configured provider authorization.

Feedback, search and plan pages keep the current job in the page URL. Refreshing or returning to that URL resumes status checks; the API still checks job ownership. Use **Check status** after a temporary connection failure.

# Development — CURRENT workspace

Use Node >=24 and pnpm 11.3.0 as declared in root/package manifests. Python AI supports >=3.11,<3.15 and has its own Poetry manifest. The host default Python may be outside this range; choose a compatible isolated environment. See [current architecture](architecture.md) and [actual validation](audit/validation.md) for known baseline failures.

## Local setup

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm dev:infra:up
pnpm dev:doctor
pnpm dev
```

`setup` creates missing API/web/AI env files with shared random secrets and consistent local ports. Existing files are never overwritten; `doctor` identifies mismatches without printing values. Review local files yourself when repairing an existing installation. Never commit env files or point test commands at production data.

The development stack is `deploy/compose.development.yml`; the separate test stack is `deploy/compose.test.yml`. The dev project provides MongoDB 27018, RabbitMQ 5673 (management UI 15673), Redis 6381 and Mailpit SMTP 1026/UI 8026. Ports bind to loopback; credentials are local-development defaults. Volumes persist through `pnpm dev:infra:down`. Dev and test stacks share Mongo/Mailpit host ports: run one stack at a time. Integration/auth/browser commands use isolated database names; they can use the running dev Mongo/Mailpit.

For newly generated host configurations, `pnpm dev:setup` gives Node and Python the same absolute `INGEST_UPLOADS_DIR` and `FAISS_INDEX_DIR` paths under `var/`. The default `var/dev-uploads` and `var/dev-faiss` directories are excluded from Git because they contain private originals and indexes. Existing environment files are never overwritten: `pnpm dev:doctor` flags missing or mismatched paths, service keys and broker settings for manual correction. These host paths are distinct from Docker named volumes; sharing storage with containerized Python requires an explicit matching bind mount or a compatible shared volume.

`pnpm dev` builds/starts API :3000 and Next :5173 only. `pnpm dev:api` and `pnpm dev:web` run them independently. API health: `/api/v1/health`; OpenAPI: `/api/v1/docs/openapi.json`. Next proxies HTTP `/api/v1` and `/uploads`; local setup sets `NEXT_PUBLIC_WS_URL=ws://localhost:3000` for direct WebSocket access.

## Workspace and collaboration

The root `pnpm-workspace.yaml` already includes the API, its seven domain packages, shared package and web. Keep the root lockfile and use `pnpm --filter <package> <command>` for scoped work; do not install with npm/yarn inside packages. Python is independent and managed by Poetry.

Branch from current main per coherent task (`feat/ed-30-course-drafts`, for example). Include task ID, changed contract, tests and known limits in each PR. Habib owns source/revision/access contracts; Tasnim activities/private evidence; Aziz room/public state. Shared files, generated adapters, CI and lockfile changes need a single editor per integration window and consumer review. Run `pnpm generate:contracts` after route-contract edits; commit the generated adapters with their generator input.

## AI lifecycle

See [AI service](ai-service.md). Use a compatible Python environment with Poetry; configure Mongo, reachable broker, optional Redis, `AI_SERVICE_API_KEY` and provider/model configuration. Node's `AI_SERVICE_API_KEY` must match Python. The API service key is a server-to-server secret, separate from model provider credentials.

If Poetry is unavailable but the locked application environment is already installed, set `EDNOVA_AI_PYTHON` in `apps/ai/.env` to that environment's absolute Python executable. `pnpm dev:ai` and `pnpm dev:worker ingestion` then use it directly. `pnpm dev:doctor` checks the selected interpreter and basic dependencies. For external inference, see the separate approval and durable-budget prerequisites in [revision sources](runbooks/ednova-revision-sources.md); mock mode is not approved provider execution.

Host-mode scanned-PDF ingestion additionally needs local Tesseract with English
language data (`tesseract-ocr`, `tesseract-ocr-eng` on Debian/Ubuntu). The image
includes these packages. See [bounded OCR support](../reports/EDNOVA-OCR-VERIFICATION.md)
for processing limits and instructor-review requirements.

HTTP alone does not consume broker jobs. Launch ingestion/planner/schedule/coach/evaluator/search workers as required in separate processes. Share the correct uploads directory and reconcile Node course IDs/aiCourseId with Python persistence. The shared LLM client requires explicit `LLM_MOCK=1` for test responders. Without a configured provider key it raises `LLMUnavailableError` (`UNAVAILABLE`); existing callers may choose an identified deterministic fallback. A successful fallback/template is not evidence of real inference. Organizer-model adaptation is PLANNED. Local setup sets `LLM_MOCK=1` explicitly; this is development scaffolding, not real inference acceptance.

## Existing commands and tests

| Root command | Scope / prerequisite |
|---|---|
| `pnpm build` | API tsc and Next production webpack build |
| `pnpm lint`, `pnpm typecheck` | Both Node packages; strict API checks include test files |
| `pnpm test` | API route checks + Jest + Node unit/real integration + auth lifecycle, then Vitest; stops on failure |
| `pnpm test:integration` | API integration cases; real roundtrip opt-in separate |
| `pnpm test:auth` | API build then Better Auth lifecycle/Nest tests; Mongo on 27018 |
| `pnpm test:e2e` | Auth/workspace/smoke Playwright; test Mongo/Mailpit and browser required |

No root format command exists. Package `format` scripts are different and may have legacy globs; do not treat them as a repository-wide check. Python checks use its own environment. Full scenario gates and exact current failures are in [testing plan](testing-plan.md) and [validation](audit/validation.md).

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

### M01 baseline recipe — 22 October 2026

The current CI and AI Docker recipe use Python 3.12 and Poetry 2.5.1 with the existing `apps/ai/poetry.lock`. The manifest's wider supported interpreter range is unchanged; this recipe does not certify every interpreter/model combination. The AI image installs locked main dependencies rather than an independent unpinned package list. Build it with `docker build -t ednova-ai -f apps/ai/Dockerfile apps/ai`; the AI context has its own `.dockerignore` excluding local environment files and caches. Full ML/CUDA dependency installation still requires substantial downloads.

API `test:node` and `test:node:integration` execute `node:test` suites separately from Jest; both are included in the default API test command. The integration command points its AI HTTP boundary at an unavailable loopback port, exercising existing deterministic fallback without provider calls. This does not establish real inference. The production web builder includes the API-backed browser launchers' source/dependency context so the existing strict web check remains enabled.

Install all browser prerequisites with `pnpm --filter web exec playwright install chromium ffmpeg`. Use only the dedicated Mongo/Mailpit test stack for the documented browser/auth runs. Current executed results, failures, preservation hashes and remaining ED-01 gates are recorded in [M01 baseline verification](../reports/EDNOVA-M01-BASELINE.md); a successful build is not a claim that repository-wide lint, full Python or the complete CI pipeline is green.

## Working conventions

Keep authored verification reports in `reports/*.md` in Git. Raw command logs, generated inventories, screenshots, patches and copied helper scripts under `reports/evidence/` are local artifacts excluded from Git and the root Docker build context. Report links into that directory resolve only where the evidence has been retained; publish reviewed evidence separately as CI/PR artifacts when it must be shared. Keep reusable test runners in the source tree. Do not ignore source JSON, lockfiles, fixture PDFs or product images globally.

Preserve contract/controller registration, security checks, AI message topology parity, correlation/idempotency and rollback mechanisms. Do not remove legacy apps/routes/helpers based solely on new architecture diagrams. Runtime changes, role additions and schema evolution belong to future backlog tasks. Maintain one active [backlog](sprint-backlog.md); add executed evidence before marking DONE.

M01 continuation results and reproducible broker fixture instructions are recorded in [the continuation verification](../reports/EDNOVA-M01-CONTINUATION-VERIFICATION.md). API lint passes. The [final runtime verification](../reports/EDNOVA-M01-FINAL-RUNTIME-VERIFICATION.md) closes the full locked Python/AI image gate: 818 Python tests pass with five documented existing manual-fixture skips, and actual image health/native imports plus broker worker transport pass. This is local baseline evidence, not approved inference, GPU/media or downstream feature acceptance.

# Development — CURRENT workspace

Use Node >=24 and pnpm 11.3.0 as declared in root/package manifests. Python AI supports >=3.11,<3.15 and has its own Poetry manifest. The host default Python may be outside this range; choose a compatible isolated environment. See [current architecture](ARCHITECTURE.md) and [actual validation](audit/2026-10-18/VALIDATION.md) for known baseline failures.

## Install and configure

From the repository root:

```bash
pnpm install --frozen-lockfile
cp .env.example study-partner-api/.env
cp study-partner-web/.env.example study-partner-web/.env.local
```

Replace placeholders with local secrets. API and Next must share the same `MONGODB_URI` and `BETTER_AUTH_SECRET`; choose `BETTER_AUTH_URL=http://localhost:5173` and consistent trusted origins for direct development. Keep secrets server-only. For dedicated test infrastructure:

```bash
pnpm test:infra:up
```

That starts MongoDB on **27018** and Mailpit SMTP on **1026** (UI **8026**). Set API/web `MONGODB_URI` to an appropriate local database on 27018 and SMTP host `127.0.0.1`, port `1026`, secure false if using those services. Example files instead default to 27017/1025 and are not automatically rewritten. Auth lifecycle/browser tests use their own test DB names; never point them at production.

API startup also requires `INTERNAL_API_SECRET` and `RABBITMQ_URL`. Root test Compose provides neither RabbitMQ nor Redis. Configure a dedicated reachable broker and optional Redis, or run just the main Compose broker/cache services using the API env file (review host port conflicts first):

```bash
docker compose --env-file study-partner-api/.env up -d rabbitmq redis
```

The configured RabbitMQ user/password/vhost must agree with the URL. Do not use unrelated application brokers or databases for tests. API startup retries unavailable consumer initialization, but queued work needs a working broker/worker. Starting the main stack instead uses [deployment](DEPLOYMENT.md) configuration and ports.

```bash
pnpm dev
```

This builds/starts API (:3000) and Next (:5173) only. It does not start Python or workers; current Nest route syntax can prevent startup (ED-01). API health is `/api/v1/health`; OpenAPI is `/api/v1/docs/openapi.json`. Next rewrites `/api/v1` and `/uploads` to BACKEND_URL. WebSocket `/ws/*` needs direct `NEXT_PUBLIC_WS_URL` for direct-dev backend access, or an edge proxy such as the main nginx stack; Next rewrites do not establish a WS proxy.

## AI lifecycle

See [AI service](docs-repo/docs/ai-service.md). Use a compatible Python environment with Poetry; configure Mongo, reachable broker, optional Redis, `AI_SERVICE_API_KEY` and provider/model configuration. Node's `AI_SERVICE_API_KEY` must match Python. The API service key is a server-to-server secret, separate from model provider credentials.

HTTP alone does not consume broker jobs. Launch ingestion/planner/schedule/coach/evaluator/search workers as required in separate processes. Share the correct uploads directory and reconcile Node course IDs/aiCourseId with Python persistence. Missing provider keys may invoke mocks even when LLM_MOCK is not 1; a successful fallback/template is not evidence of real inference. Organizer-model adaptation is PLANNED.

## Existing commands and tests

| Root command | Scope / prerequisite |
|---|---|
| `pnpm build` | API tsc and Next production webpack build |
| `pnpm lint`, `pnpm typecheck` | Both Node packages; strict API checks include test files |
| `pnpm test` | API Jest + auth lifecycle, then Vitest; stops on failure |
| `pnpm test:integration` | API integration cases; real roundtrip opt-in separate |
| `pnpm test:auth` | API build then Better Auth lifecycle/Nest tests; Mongo on 27018 |
| `pnpm test:e2e` | Auth/smoke Playwright; test Mongo/Mailpit and browser required |

No root format command exists. Package `format` scripts are different and may have legacy globs; do not treat them as a repository-wide check. Python checks use its own environment. Full scenario gates and exact current failures are in [testing plan](docs-repo/docs/testing-plan.md) and [validation](audit/2026-10-18/VALIDATION.md).

## Working conventions

Preserve contract/controller registration, security checks, AI message topology parity, correlation/idempotency and rollback mechanisms. Do not remove legacy apps/routes/helpers based solely on new architecture diagrams. Runtime changes, role additions and schema evolution belong to future backlog tasks. Maintain one active [backlog](docs-repo/docs/sprint-backlog.md); add executed evidence before marking DONE.

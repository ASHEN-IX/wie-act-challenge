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

The dev Compose project provides MongoDB 27018, RabbitMQ 5673 (management UI 15673), Redis 6381 and Mailpit SMTP 1026/UI 8026. Ports bind to loopback; credentials are local-development defaults. Volumes persist through `pnpm dev:infra:down`. Dev and test stacks share Mongo/Mailpit host ports: run one stack at a time. Integration/auth/browser commands use isolated database names; they can use the running dev Mongo/Mailpit.

`pnpm dev` builds/starts API :3000 and Next :5173 only. `pnpm dev:api` and `pnpm dev:web` run them independently. API health: `/api/v1/health`; OpenAPI: `/api/v1/docs/openapi.json`. Next proxies HTTP `/api/v1` and `/uploads`; local setup sets `NEXT_PUBLIC_WS_URL=ws://localhost:3000` for direct WebSocket access.

## Workspace and collaboration

The root `pnpm-workspace.yaml` already includes the API, its seven domain packages, shared package and web. Keep the root lockfile and use `pnpm --filter <package> <command>` for scoped work; do not install with npm/yarn inside packages. Python is independent and managed by Poetry.

Branch from current main per coherent task (`feat/ed-30-course-drafts`, for example). Include task ID, changed contract, tests and known limits in each PR. Habib owns source/revision/access contracts; Tasnim activities/private evidence; Aziz room/public state. Shared files, generated adapters, CI and lockfile changes need a single editor per integration window and consumer review. Run `pnpm generate:contracts` after route-contract edits; commit the generated adapters with their generator input.

## AI lifecycle

See [AI service](ai-service.md). Use a compatible Python environment with Poetry; configure Mongo, reachable broker, optional Redis, `AI_SERVICE_API_KEY` and provider/model configuration. Node's `AI_SERVICE_API_KEY` must match Python. The API service key is a server-to-server secret, separate from model provider credentials.

HTTP alone does not consume broker jobs. Launch ingestion/planner/schedule/coach/evaluator/search workers as required in separate processes. Share the correct uploads directory and reconcile Node course IDs/aiCourseId with Python persistence. Missing provider keys may invoke mocks even when LLM_MOCK is not 1; a successful fallback/template is not evidence of real inference. Organizer-model adaptation is PLANNED. Local setup sets `LLM_MOCK=1` explicitly; this is development scaffolding, not real inference acceptance.

## Existing commands and tests

| Root command | Scope / prerequisite |
|---|---|
| `pnpm build` | API tsc and Next production webpack build |
| `pnpm lint`, `pnpm typecheck` | Both Node packages; strict API checks include test files |
| `pnpm test` | API Jest + auth lifecycle, then Vitest; stops on failure |
| `pnpm test:integration` | API integration cases; real roundtrip opt-in separate |
| `pnpm test:auth` | API build then Better Auth lifecycle/Nest tests; Mongo on 27018 |
| `pnpm test:e2e` | Auth/workspace/smoke Playwright; test Mongo/Mailpit and browser required |

No root format command exists. Package `format` scripts are different and may have legacy globs; do not treat them as a repository-wide check. Python checks use its own environment. Full scenario gates and exact current failures are in [testing plan](testing-plan.md) and [validation](audit/validation.md).

## Working conventions

Preserve contract/controller registration, security checks, AI message topology parity, correlation/idempotency and rollback mechanisms. Do not remove legacy apps/routes/helpers based solely on new architecture diagrams. Runtime changes, role additions and schema evolution belong to future backlog tasks. Maintain one active [backlog](sprint-backlog.md); add executed evidence before marking DONE.

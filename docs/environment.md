# Environment and how the apps connect

One page for "which `.env` does what". Verified against the code on 2026-11-09.

## The pieces

```
Browser ──► web (Next.js, :3000) ──/api/v1, /ws, /uploads──► API (NestJS, :3001)
              │  hosts /api/auth/* (Better Auth)                │   │   │
              │                                                 │   │   └─ HTTP + RabbitMQ ─► AI service (FastAPI, :8000) + workers
              ▼                                                 ▼   ▼
           PostgreSQL ◄── Prisma ── API                   `ai` schema (Python's own tables)
                                                                 ├─ Redis (cache, rate limits)
                                                                 └─ RabbitMQ (jobs and results)
SMTP (Mailpit :1025 locally) is used by web (sign-in emails) and API (invitations, notifications).
The AI workers and the API share two folders: uploads and the FAISS index.
```

Two things surprise people:

- **The web app talks to PostgreSQL.** It hosts the sign-in endpoints (`apps/web/src/app/api/auth/[...all]`, Better Auth through `apps/api/shared/betterAuth.ts`). Sessions are stored in the same database the API reads, and the API verifies them with the same secret. That is why `apps/web/.env.local` has `DATABASE_URL`, `BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS` and SMTP settings. Everything else the web app does goes through the API (`BACKEND_URL`).
- **There are two databases with different owners.** API and web share one PostgreSQL database (`ednova`) through Prisma. The Python AI service keeps the tables only it owns in the `ai` schema (`AI_DATABASE_URL`); it never reads the application tables and instead calls the API's internal endpoints (`API_SERVICE_URL`, `INTERNAL_API_SECRET`).

## Which file for which app

| File | Used by | Notes |
|---|---|---|
| `apps/api/.env` | API, and Compose through `pnpm docker:up` (`--env-file`) | The only env file for the backend. Copy from `apps/api/.env.example`. |
| `.env` at the repo root | nothing of its own | Optional symlink to `apps/api/.env` so plain `docker compose` sees the same values. Do not keep a separate copy: it drifts. |
| `apps/web/.env.local` | web | Copy from `apps/web/.env.example`. |
| `apps/ai/.env` | AI service and workers | Copy from `apps/ai/.env.example`. Compose overrides the PostgreSQL, RabbitMQ and Redis hosts with container names. |
| `.env.ai` (from `.env.ai.example`) | only the separate `docker-compose.ai.yml` | For running the AI stack on its own server. |

Real env files are git-ignored; only `*.example` files are committed.

## Values that must match across apps

| Value | Where | Why |
|---|---|---|
| `DATABASE_URL` (database `ednova`) | api, web | One PostgreSQL database, through Prisma. |
| `AI_DATABASE_URL` | ai | PostgreSQL for the AI service's own `ai` schema. Unset = no database; repositories degrade. |
| `API_SERVICE_URL`, `INTERNAL_API_SECRET` | ai | Internal API endpoints (ingestion fencing, coach context, planner plans, LLM budget). Unconfigured = fail closed. |
| `BETTER_AUTH_SECRET` | api, web | Web signs sessions, API verifies them. Different secrets mean every request is "not signed in". |
| `BETTER_AUTH_URL`, `AUTH_TRUSTED_ORIGINS` | api, web | The public web origin (`http://localhost:3000`). |
| `AI_SERVICE_API_KEY` | api, ai | The API sends it; the AI service checks it. |
| `RABBITMQ_URL` (and `RABBITMQ_USER/PASS/VHOST` for Compose) | api, ai | Same broker and credentials. |
| `INGEST_UPLOADS_DIR`, `FAISS_INDEX_DIR` | api, ai | Same host folders; Compose bind-mounts them into the containers. |

`INTERNAL_API_SECRET` (API only) lets trusted services call the API without a user session.

## The "web address" variables

Five variables name the web origin. They are all `http://localhost:3000` locally and should always agree:

| Variable | Read by | Purpose |
|---|---|---|
| `AUTH_TRUSTED_ORIGINS` | api, web | Which origins may sign in and call the API (CORS). Primary setting. |
| `BETTER_AUTH_URL` | api, web | Base URL of the auth endpoints; web also sends it as the `Origin` header to the API. |
| `APP_URL` | api | Links in emails; fallback for the two above. |
| `FRONTEND_URL` | api | Billing return URL and the course join link in invitation emails. |
| `CORS_ORIGIN` | api | Fallback for `AUTH_TRUSTED_ORIGINS`. |

They are kept for compatibility; collapsing them into one variable is a code change, not a config change.

## Local ports

web 3000, API 3001, AI 8000, PostgreSQL 5433 (host) → 5432 (container), Redis 6379, RabbitMQ 5672 (UI 15672), Mailpit 1025 (UI 8025).

## Tests

Playwright and e2e harnesses build their own isolated environment (own database, secret and ports) and do not read these files.

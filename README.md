# Mindflow

Mindflow is a full-stack learning and study optimization platform, architected as a **pnpm monorepo workspace** featuring a **Next.js 16** App Router frontend, a **NestJS 12** Modular Monolith backend, and an **independent Python AI service**.

---

## Architecture at a Glance

```
                         ┌──────────────────────┐
                         │   Browser / Client   │
                         └──────────┬───────────┘
                                    │ HTTP / WSS
                                    ▼
                         ┌──────────────────────┐
                         │   Nginx Edge Proxy   │ (:80 / :443)
                         └─────┬──────────┬─────┘
                               │          │
                 ┌─────────────┘          └─────────────┐
                 │ HTTP / UI                            │ API / WSS
                 ▼                                      ▼
      ┌──────────────────────┐               ┌──────────────────────┐
      │   Next.js Frontend   │ (:5173)       │    NestJS Backend    │ (:3000)
      │  App Router & Auth   │               │   Modular Monolith   │
      └──────────┬───────────┘               └──────────┬───────────┘
                 │                                      │
                 │ /api/auth                            │ Domain Logic
                 ▼                                      ▼
            Better Auth ────────────────────────── MongoDB 7
                                                        │
                                            ┌───────────┴───────────┐
                                            ▼                       ▼
                                         Redis 7                RabbitMQ 3
                                                                    │
                                                                    ▼
                                                        ┌───────────────────────┐
                                                        │  Independent Python   │
                                                        │   AI Service (:8000)  │
                                                        └───────────────────────┘
```

- **Frontend**: Next.js 16 (`study-partner-web`) with App Router (28 pages), Server & Client Components, Tailwind CSS, Lucide icons, and Better Auth client.
- **Backend**: NestJS 12 (`study-partner-api`) Modular Monolith with single entrypoint (`src/main.js`), typed Controllers, Injectable Providers, Session Guards, Parameter Pipes, and WebSocket real-time engine.
- **Package Manager**: `pnpm 11.3.0` monorepo workspace (`pnpm-workspace.yaml`, `pnpm-lock.yaml`).
- **Database**: MongoDB 7 with Mongoose 8.
- **Message Broker & Cache**: RabbitMQ 3 (job queues, progress streaming, DLQ) and Redis 7 (rate limiting, cache).
- **External AI**: Python 3.11 FastAPI service (`study-partner-ai`) — **REMAINS FULLY INDEPENDENT**.

---

## Quick Start

### 1. Prerequisites
- **Node.js**: >= 24
- **pnpm**: 11.3.0 (`corepack enable && corepack prepare pnpm@11.3.0 --activate`)
- **Docker**: For local database and broker dependencies

### 2. Setup
```bash
# Clone and enter workspace
cd mindflow

# Copy environment variables
cp .env.example study-partner-api/.env
cp study-partner-web/.env.example study-partner-web/.env.local

# Install dependencies with frozen lockfile
pnpm install --frozen-lockfile

# Start background database containers (MongoDB on 27018, Mailpit on 1026)
pnpm test:infra:up

# Start both Next.js and NestJS development servers
pnpm dev
```

- **Web Application**: http://localhost:5173
- **NestJS API Health**: http://localhost:3000/api/v1/health
- **OpenAPI Documentation**: http://localhost:3000/api/v1/docs

---

## Monorepo Commands

| Command | Description |
|---|---|
| `pnpm dev` | Run NestJS API and Next.js frontend in parallel |
| `pnpm build` | Compile NestJS TypeScript and Next.js standalone bundle |
| `pnpm lint` | Run ESLint across all packages |
| `pnpm typecheck` | Run TypeScript checking and AST syntax validation |
| `pnpm test` | Run entire test suite (Jest, Vitest, Auth lifecycle) |
| `pnpm test:integration` | Run NestJS integration test suite |
| `pnpm test:e2e` | Run Playwright end-to-end browser tests |
| `pnpm format` | Run Prettier across codebase |
| `pnpm docker:up` | Start full Docker Compose environment |
| `pnpm docker:down` | Stop Docker Compose environment |

---

## Documentation

- **[MIGRATION.md](MIGRATION.md)**: Full migration record from React + Express to Next.js + NestJS.
- **[MIGRATION_INVENTORY.md](MIGRATION_INVENTORY.md)**: Status inventory for all components, routes, and controllers.
- **[API_COMPATIBILITY.md](API_COMPATIBILITY.md)**: Complete endpoint compatibility and migration matrix.
- **[TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md)**: Target architectural blueprint and system diagrams.
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: System design and communication patterns.
- **[DEPLOYMENT.md](DEPLOYMENT.md)**: Production deployment instructions, Docker configurations, and rollbacks.
- **[SECURITY.md](SECURITY.md)**: Security architecture, threat mitigations, and compliance audit.
- **[DEVELOPMENT.md](DEVELOPMENT.md)**: Developer workflow and architectural rules.

# wie-act-challenge

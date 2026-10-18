# Mindflow System Architecture

This document describes the production architecture of the Mindflow full-stack platform following the completed migration from React + Express to Next.js + NestJS.

---

## 1. Architectural Overview

Mindflow is structured as a **pnpm monorepo workspace** composed of:
1. **Frontend (`study-partner-web`)**: Next.js 16 App Router application running in `standalone` server mode.
2. **Backend (`study-partner-api`)**: NestJS 12 Modular Monolith exposing unified REST and WebSocket endpoints.
3. **Shared Contracts & Utilities (`study-partner-api/shared`)**: Workspace package providing common logger, cache, auth, and schema utilities.
4. **External AI Service (`study-partner-ai`)**: Independent Python FastAPI service handling specialized ML/LLM workloads.

---

## 2. Monorepo Organization

```
mindflow/
├── apps & services/
│   ├── study-partner-web/          # Next.js 16 Frontend
│   │   ├── app/                    # Next.js App Router (28 pages + /api/auth)
│   │   ├── src/                    # Screens, components, stores, hooks, styles
│   │   ├── e2e/                    # Playwright E2E browser tests
│   │   ├── Dockerfile              # Multi-stage standalone build
│   │   └── next.config.mjs         # Next.js configuration and API rewrites
│   │
│   ├── study-partner-api/          # NestJS 12 Backend Modular Monolith
│   │   ├── src/                    # Main entrypoint, NestJS AppModule, bootstrap
│   │   ├── modules/                # Domain packages
│   │   │   ├── auth/               # User accounts, billing, Stripe, admin
│   │   │   ├── user-profile/       # Profiles, availability, gamification, quests, friends
│   │   │   ├── study/              # Tasks, sessions, subjects, courses, plans, competencies
│   │   │   ├── ai-orchestrator/    # AI jobs, evaluations, search, coach integration
│   │   │   ├── signal-processing/  # Focus sessions, telemetry
│   │   │   ├── analytics/          # Event tracking, timelines, insights
│   │   │   └── notification/       # Notifications, session chat, voice, WebSockets
│   │   ├── shared/                 # In-process domain client, database, cache, auth
│   │   └── tests/                  # Integration, lifecycle, and architecture tests
│   │
│   └── study-partner-ai/           # Independent Python FastAPI AI Service
│       ├── services/api/           # FastAPI routers (ingest, plan, coach, search)
│       ├── agents/                 # Evaluator, coach, and planner agents
│       ├── workers/                # RabbitMQ job consumers
│       └── Dockerfile              # Python 3.11 Alpine/Debian container
│
├── .github/workflows/ci.yml        # Unified CI/CD pipeline
├── docker-compose.yml              # Core service composition
├── docker-compose.prod.yml         # Production resource & security overrides
├── docker-compose.ai.yml           # Optional independent AI service composition
├── pnpm-workspace.yaml             # Monorepo packages manifest
└── package.json                    # Workspace root scripts
```

---

## 3. Communication Patterns

### 3.1. Browser → Frontend & Backend
- Browser traffic arrives at the Nginx edge proxy (port 80/443).
- Web routes (`/`, `/dashboard`, `/sessions`, etc.) are routed to Next.js (`:5173`).
- Authentication requests (`/api/auth/*`) execute inside the Next.js Route Handler powered by Better Auth.
- API requests (`/api/v1/*`) are routed to NestJS (`:3000`), preserving cookie authentication.
- WebSocket requests (`/ws/*`) upgrade directly to the NestJS HTTP listener.

### 3.2. Cross-Module Communication (In-Process)
- Rather than making remote HTTP calls between domains, NestJS modules register contracts with `moduleClient`.
- Calls between domains (e.g. `study` awarding XP in `user-profile`) run **in-memory** within the same Node process, eliminating network latency while enforcing parameter validation and identity propagation.

### 3.3. NestJS → Independent Python AI Service
- The Python AI service runs as a completely independent process.
- **Synchronous REST**: `aiClient` in NestJS sends validated HTTP requests to `AI_SERVICE_URL` with timeouts and retry safety.
- **Asynchronous Message Bus**: Long-running ingestion, planning, and evaluation tasks are dispatched to RabbitMQ queues (`ai.jobs.*`). Python workers process jobs and publish outcomes to result queues (`ai.results.*`), which NestJS consumers ingest and broadcast.

---

## 4. Data Layer Architecture

- **MongoDB 7**: Shared database instance storing all business entities.
  - Better Auth collections (`user`, `session`, `account`, `verification`) reside alongside existing business collections.
  - ObjectIds and user entity relationships are preserved.
- **Redis 7**: Distributed caching and token-bucket rate limiting state.
- **RabbitMQ 3**: Durable message broker for asynchronous AI tasks and Dead Letter Queues (DLQ).

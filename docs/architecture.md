# CURRENT architecture — verified source, 18 October 2026

This describes code present in this checkout, not certification of production behavior. Read [validation](audit/validation.md) for failures and [target architecture](target-architecture.md) for PLANNED EdNova adaptations.

## Boundaries and technologies

One Git repository contains a pnpm workspace: API shell, web, shared package and seven domain packages (11 packages total). Python is separately operated and uses Poetry; it is not a pnpm package. All maintained documentation lives under `docs/`. Manifests declare Next ^16.4, React ^19.3, Nest ^12.1, Prisma ^7.10, Better Auth ^1.7.7, Node >=24 and pnpm 11.3.0. Python supports >=3.11,<3.15; Compose uses PostgreSQL 17, Redis 7 and RabbitMQ 3 (MongoDB 7 remains only for the Python service's own collections).

```text
Browser -> Next (:5173) -> /api/auth -> Better Auth -> Postgres auth_* tables
        -> /api/v1 rewrite or nginx -> Nest (:3000) -> domain contracts -> Postgres (Prisma)
        -> /ws/realtime, /ws/notifications -> notification module
Browser <-> peer browser: WebRTC audio; WS carries signaling, not audio packets
Nest -> independent FastAPI (:8000): authenticated HTTP
Nest -> RabbitMQ -> separately launched Python worker -> result/progress -> Postgres (API schema via Prisma; AI-owned `ai` schema via psycopg)
Redis: cache/rate state; optional Python idempotency and evaluation session state
```

## Application and domains

`apps/api/src/main.ts` starts Nest through `framework/bootstrap.ts`, owns lifecycle, connects persistence, attaches realtime, starts result consumers and study pollers, and drains them on stop. `src/framework/app.module.ts` loads auth, users, study, AI, signals, analytics and notifications. Generated controllers call `DomainService`, which dispatches operations loaded from `src/domain-definitions.ts`. Existing route files export `createContracts()` operations; this is not a wholesale rewrite into independent Nest business services.

`shared/moduleClient.ts` routes `module://` requests in process with request context, identity and handler execution. Non-module URLs use `shared/aiClient.ts`; do not replace module calls with a service fleet. `src/app.ts` retains an Express-compatible application exercised by legacy tests; it is not the production entrypoint and is not proven dead.

| Domain | Actual public surfaces | Main persistence / responsibilities |
|---|---|---|
| Auth | `/api/v1/auth`, `/api/v1/auth/admin`, `/api/v1/auth/stripe` | Domain User, payments/coupons, profile/account administration and entitlements; Better Auth HTTP engine is separate |
| Users | `/api/v1/users/profile`, `/api/v1/users/availability`, `/api/v1/users/gamification`, `/api/v1/users/quests`, `/api/v1/users/friends` | Profiles, ranks, XP, quests, availability and friendships |
| Study | `/api/v1/study/*`, `/api/v1/competencies`, `/api/v1/coach` | Tasks, subjects, courses, solo/team sessions, plans, objectives and competency updates |
| AI | `/api/v1/ai/*`, `/api/v1/eval`, `/api/v1/search` | AI jobs, evaluation outputs, external AI requests and results |
| Signals | `/api/v1/signals/focus` | Focus sessions and telemetry |
| Analytics | `/api/v1/analytics` | Events/insights; not an institution-scoped instructor dashboard |
| Notifications | `/api/v1/notifications`, `/api/v1/session-chat`, `/api/v1/voice`; `/ws/*` | Mail, notifications, search-style session chat and voice signaling |

Authoritative endpoint registration is `src/domain-definitions.ts` and generated `src/framework/domains/*.module.ts`; old `.js` route maps are historical.

## Frontend

`src/app` owns native App Router pages/layouts and Better Auth routes. Server Components read through `src/lib/api.ts`; authenticated Server Actions live beside module features in `src/features`. The gateway forwards session cookies to Nest with no shared user-data cache. Small client components handle forms, job polling and room realtime. React 19, Tailwind 4 and shadcn/ui replace the legacy SPA shell, navigation adapter, Zustand/React Query stores and screen CSS. See [frontend guide](frontend-web.md) for route changes and retired legacy UI.

`src/proxy.ts` adds CSP/nonce and headers. HTTP rewrites and WebSockets retain their existing boundaries. Backend voice/signaling is reusable, but voice controls are not part of the rebuilt UI yet.

## Identity, authorization and storage

Better Auth uses `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications` and `auth_rate_limits` alongside preserved domain `users`. Session identity is resolved from Postgres-backed cookies; bcrypt compatibility supports old passwords. API SessionGuard authenticates; domain roles and tier gates restrict operations. `operationPolicy.ts` scopes AI actor/resource references and namespaces evaluation conversation IDs. Existing global roles are student/admin; M04-A/M04-A.1 adds institution membership and invitation schemas, but no course enrollment or institutional course scope exists.

Owner filters exist on personal course reads/downloads. Team creation's course lookup, session-chat/voice HTTP resource checks and generic static `/uploads` mounts require review: presence of authentication is not proof of content isolation. WebSocket connect and inbound messages check identity and team membership; session broadcast/heartbeat behavior must also be tested under revocation. See ED-02 and [roles](roles-and-permissions.md).

PostgreSQL stores business and auth state through Prisma; the Python service keeps what it alone produces (coach history, pacing, schedules, signals, review schedule, embeddings, search history, formula dispatch markers) in the `ai` schema of PostgreSQL, and reads API-owned data over HTTP with `x-internal-secret`. FAISS indexes and embeddings are also stored on disk; uploads use local/Compose volumes. Multiple schema views of learning objectives/eval results are intentional read/write boundaries, not automatically duplicate dead models. [Data model](data-model.md) records relationships and unresolved ownership boundaries.

## AI and background flow

Upload -> validated file staging -> course/job identifiers -> RabbitMQ ingestion worker -> parsing/OCR/enrichment/chunks/embeddings/objectives -> results/progress -> course status and topics. Planner retrieves course context, decomposes goals, adds reviews/buffers and generates task graphs; scheduler places tasks into availability. Evaluator supports individual multi-turn Socratic checks; competency pollers consume evaluation evidence. Coach uses signals/rules and optional LLM decisions. Search retrieves web sources and synthesizes answers; reflection aggregates learning metrics.

Shared LiteLLM aliases are per agent; **no challenge compact/capable policy is implemented**. Missing credentials can trigger mocks. Provider fallbacks do not establish challenge-compliant degraded pedagogy. Broker contracts retain typed payloads, correlations, idempotency leases, retry TTL queues, DLQs and result consumers. Ingest/planner/coach/evaluator/search/schedule workers are separate entrypoints. FastAPI's Compose command starts HTTP only; workers need independent launch. See [AI specification](ai-specification.md) and [message contract](contracts/ai-message-contract.md).

## Realtime and infrastructure

Team sessions support invite codes, participant lists and task progress. Realtime handles `chat_query`, voice signaling, mute and speaking updates. SessionChat stores query/result/coach messages, not a full peer-discussion/facilitation model. Browser WebRTC uses STUN; no managed SFU/TURN service is supplied. No tested synchronized PDF/page/exercise protocol, group misconception state machine or private tutor channel exists.

Main Compose defines API, Next web, nginx edge (:8080), PostgreSQL (:5433 published), Redis, RabbitMQ and Mailpit (:1025/:8025). Test Compose provides PostgreSQL (:5433) and Mailpit (:1026/:8026). AI Compose is separate and mounts an external upload volume; path/DB/broker/secret alignment requires explicit configuration. Production override plus `deploy/Caddyfile` and nginx config require validation; there is no evidence for zero-downtime or deployed-state claims.

Root CI declares Node checks, E2E and AI checks, but its AI install references absent `requirements.txt`. The nested Python workflow reflects former repository layout and is not automatically a root GitHub Actions workflow. Python Docker dependencies differ from Poetry, and the HTTP image does not constitute worker deployment. These remain ED-01 work, without changes to infrastructure in this audit.

## v1.2 source verification addendum

Rechecked ingestion/course routes, SocraticEvaluation, Gamification, reward route, awardService and RankEventLedger against the new brief. CURRENT extraction and XP/levels/achievements exist; TODO: reviewed editable Studio revisions, versioned trusted activity registry/selector, private attempts shared across solo/group and learning-evidence XP. The XP method adds totals/history; ranking's sparse unique eventKey and anti-farming KP logic are a separate path. Do not describe ranking replay protection as XP exactly-once protection. No runtime changes or tests were executed for this documentation update; prior validation results retain their original scope. See [v1.2 report](audit/ednova-v1-2-update.md) and [team implementation plan](team-delivery-plan.md).

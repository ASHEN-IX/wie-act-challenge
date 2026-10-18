# Backend API

The backend is one modular Express application, running Node 24 with pnpm 11.3.0. The only entrypoint is `study-partner-api/src/main.js` on port 3000. Its notification and session WebSockets share that listener.

| Module | Public routes | Responsibilities |
|---|---|---|
| Auth | `/api/v1/auth` | Cookies, JWT, OTP, RBAC, subscriptions |
| Users | `/api/v1/users` | Profiles, availability, XP, ranks, quests, friends |
| Study | `/api/v1/study`, `/api/v1/competencies`, `/api/v1/coach` | Courses, plans, tasks, sessions, competency feedback |
| AI integration | `/api/v1/ai`, `/api/v1/eval`, `/api/v1/search` | External AI requests and asynchronous job results |
| Signals | `/api/v1/signals` | Focus session tracking |
| Analytics | `/api/v1/analytics` | Events and insights |
| Notifications | `/api/v1/notifications`, `/api/v1/session-chat`, `/api/v1/voice`, `/ws/*` | Notifications, session chat and voice signaling |

Domain packages live in `study-partner-api/modules/*`, expose application and lifecycle contracts, and never start independent listeners. Shared infrastructure lives in `study-partner-api/shared`. Internal calls use validated in-process contracts. Outbound AI HTTP uses `shared/aiClient.js` and `AI_SERVICE_URL`.

The same MongoDB collection names remain in use, with one connection owned by the API lifecycle. Redis provides caching and public request limits. RabbitMQ retains durable AI jobs/results, publisher confirms, retry queues and DLQs. Python AI is independently operated; the main Compose deployment neither builds nor starts it.

From the parent workspace:

```bash
pnpm install --frozen-lockfile
pnpm --filter study-partner-api dev
pnpm test
pnpm test:integration
pnpm docker:up
```

Configure `study-partner-api/.env` using the central `.env.example`. See [architecture](../../ARCHITECTURE.md), [development](../../DEVELOPMENT.md), and the [migration record](../../MIGRATION.md) for deployment, validation and rollback details. Character selection and character abilities have been removed.

## Authentication migration (2026-10-08)

Authentication is now owned by Better Auth hosted in Next.js. NestJS owns the backend listener, verifies HTTP-only sessions and enforces application authorization before dispatching domain modules. MongoDB stores new auth collections beside preserved domain users/profile data. Custom JWT/refresh flows are retired; see the root AUTH_MIGRATION_ANALYSIS.md and AUTH_MIGRATION.md for the current endpoint map, setup, migration and validation. Python AI remains independent.

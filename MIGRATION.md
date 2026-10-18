# Full-Stack Migration Record: React + Express → Next.js + NestJS

Status: **COMPLETE**

This document serves as the comprehensive architectural migration record detailing the transformation of the Mindflow application from a legacy React (Vite) + Express application into a modern Next.js (App Router) + NestJS modular monolith managed in a pnpm monorepo workspace.

---

## 1. Executive Summary & Before vs. After

### Before Migration
- **Frontend**: Single-Page Application (SPA) built with React 18, Vite, and React Router (`react-router-dom` v6). Client-only routing and rendering with Vite dev server and Nginx static file hosting.
- **Backend**: Express.js multi-service/gateway architecture with disparate route handlers, custom JWT/refresh bearer token middleware, manual error handling, and ad-hoc lifecycle management.
- **Package Management**: Disjointed npm/pnpm setups with potential dependency drift and missing monorepo synergy.
- **AI Service**: External Python FastAPI service (`study-partner-ai`).

### After Migration
- **Frontend**: Next.js 16 App Router application (`study-partner-web`) utilizing server-side rendering (SSR), streaming suspense, static optimization, dynamic metadata, and client component leaves where interactivity is required. Standalone output deployment.
- **Backend**: NestJS 12 modular monolith (`study-partner-api`) with typed Modules, Controllers, Injectable Providers, Guards, Exception Filters, and Pipes. Single authoritative entrypoint (`src/main.js`).
- **Package Management**: Unified `pnpm` 11.3.0 monorepo workspace (`pnpm-workspace.yaml` and `pnpm-lock.yaml`) with isolated node linker and workspace protocol dependencies (`workspace:*`).
- **AI Service**: **REMAINS INDEPENDENT**. The Python FastAPI AI service was NOT merged into NestJS and was NOT rewritten. It remains independently deployed and managed, communicating with NestJS strictly via an abstracted HTTP client and RabbitMQ event queues.

---

## 2. Frontend Migration: React → Next.js

### 2.1. Routing: React Router → Next.js App Router
All 28 client-side React routes have been mapped to file-system App Router routes under `study-partner-web/app`:
- `/` → `app/page.jsx` (Landing page)
- `/login` → `app/login/page.jsx`
- `/register` → `app/register/page.jsx`
- `/pricing` → `app/pricing/page.jsx`
- `/checkout/success` & `/checkout/cancel` → `app/checkout/*`
- `/verify-email` & `/verify-email/[token]` → `app/verify-email/*`
- `/forgot-password` & `/reset-password/*` → `app/reset-password/*`
- `/dashboard` → `app/dashboard/page.jsx`
- `/sessions`, `/tasks`, `/profile` → Dedicated directories with `page.jsx`
- `/subjects` & `/subjects/[subjectId]` → `app/subjects/*`
- `/upload-course`, `/planner`, `/competency`, `/session-live`, `/session-setup`, `/team-lobby`, `/calendar`, `/leaderboard`, `/reviews`, `/search`, `/friends`, `/analytics` → Dedicated directories with `page.jsx`
- `/admin`, `/admin/dashboard`, `/admin/coupons`, `/admin/analytics`, `/admin/users`, `/admin/subscriptions` → Nested admin routes under `app/admin/*`
- `/customize/wallpaper`, `/customize/animated` → `app/customize/*`

### 2.2. Component Architecture: Server vs. Client Components
- **Root Layout (`app/layout.jsx`)**: Server Component defining HTML structure, global CSS imports, and metadata.
- **Application Shell (`src/next-entry.jsx`, `src/App.jsx`)**: Client Component (`'use client'`) housing global theme contexts, ambient dynamic background processing, level-up popups, trial banners, navigation bars, and presence listeners.
- **Feature Screens**: Retained existing interactive components as Client Components at the route boundaries without unnecessary UI rewrites, preserving animations (Framer Motion, GSAP), canvas/OGL shaders, and user workflows.

### 2.3. State Management
- **UI State**: Preserved existing lightweight Zustand stores (`authStore`, `gamificationStore`, `notificationStore`, `sessionStore`) for responsive local state.
- **Server State**: Centralized API data fetching with React Query where appropriate, minimizing duplicate network requests.

### 2.4. Authentication on the Frontend
- Migrated from manual `localStorage` JWT token storage to secure HTTP-only cookies powered by Better Auth.
- Created `/api/auth/[...all]/route.js` Next.js route handler proxying auth endpoints directly to the database.
- Centralized `authClient` (`src/services/authClient.js`) provides reactive `useSession()` hooks and clean login/logout/reset actions.

### 2.5. Centralized API Client & Rewrites
- `src/services/api.js` provides centralized Axios instances configured with credentials (`withCredentials: true`) and error interceptors.
- `next.config.mjs` configures rewrites to proxy `/api/v1/:path*` and `/uploads/:path*` directly to the NestJS backend (`http://localhost:3000` or configured `BACKEND_URL`).

### 2.6. Environment Variables
- Client-safe variables isolated with `NEXT_PUBLIC_*` prefixes.
- Zero server credentials, secrets, or database URLs exposed to client bundles.

---

## 3. Backend Migration: Express → NestJS

### 3.1. Architecture: Modular Monolith
The backend was unified from fragmented services and gateway proxies into a single cohesive NestJS Modular Monolith:
- **Single Entrypoint**: `study-partner-api/src/main.js` bootstraps NestJS via `createNestApp()`, connects MongoDB, initializes RabbitMQ consumers, attaches WebSockets to the HTTP server, and registers graceful process shutdown traps.
- **No Microservices**: Cross-module communication runs in-memory through registered domain contracts (`shared/moduleClient.js`), preserving transaction boundaries and eliminating inter-service network overhead.

### 3.2. Express Routes → NestJS Controllers
Routes are organized into dedicated NestJS Controllers decorated with standard decorators:
- `InfrastructureController`: `/api/v1/health`, `/api/v1/monitoring/*`, `/api/v1/docs`
- `AuthController`: `@Controller()` with `@Get()`, `@Post()`, `@Put()`, `@Delete()` covering `/api/v1/auth/*`, Stripe billing, and Admin management.
- `UsersController`: Covers `/api/v1/users/*` (profiles, availability, gamification, quests, friends).
- `StudyController`: Covers `/api/v1/study/*`, competencies, and coach nudges.
- `AiController`: Covers `/api/v1/ai/*`, jobs, evaluations, and semantic search.
- `SignalsController`: Covers `/api/v1/signals/*` (focus sessions and telemetry).
- `AnalyticsController`: Covers `/api/v1/analytics/*` (event tracking, summaries, insights).
- `NotificationsController`: Covers `/api/v1/notifications/*`, session chat, and voice.

### 3.3. Express Services → NestJS Providers
- Business logic encapsulated inside `@Injectable()` domain services (`AuthService`, `UsersService`, `StudyService`, etc.) extending `DomainService`.
- Providers are exported and injected into controllers via NestJS dependency injection.

### 3.4. Middleware → Guards, Pipes, Interceptors, Filters
- **Authentication**: Express `authenticateToken` converted to NestJS `SessionGuard` (`src/framework/auth.guard.ts`), inspecting session cookies, verifying active accounts, and injecting user identity.
- **Validation**: Converted to NestJS `ContractParameterPipe` (`src/framework/parameter.pipe.ts`), executing Joi schemas with strict parameter coercion and validation errors.
- **Error Handling**: Express `errorHandler` converted to NestJS `ApiExceptionFilter` (`src/framework/exception.filter.ts`), ensuring consistent JSON error responses (`statusCode`, `error`, `message`, `timestamp`).
- **Telemetry & Metrics**: Converted to NestJS middleware `recordRequest` (`src/framework/metrics.ts`).

### 3.5. Database & ORM Preservation
- Preserved existing MongoDB 7 database and Mongoose 8 models.
- Maintained collection ownership: `users`, `userprofiles`, `gamifications`, `tasks`, `studysessions`, `courses`, `notifications`, etc.
- No destructive migrations or table redesigns were introduced.

---

## 4. Infrastructure & DevOps Migration

### 4.1. Package Management & pnpm Workspace
- Monorepo configured via `pnpm-workspace.yaml`.
- Package references use `workspace:*`.
- Pinned to Node 24 and pnpm 11.3.0.
- All `package-lock.json` files eliminated.

### 4.2. Docker Multi-Stage Builds
- `Dockerfile`: Multi-stage build for NestJS backend (`mindflow-api`).
- `study-partner-web/Dockerfile`: Multi-stage build for Next.js App Router (`mindflow-web`) in `output: 'standalone'` mode.
- `docker-compose.yml`: Core development stack (API, Web, MongoDB, Redis, RabbitMQ, Mailpit).
- `docker-compose.prod.yml`: Production overlays with resource limits and security constraints.

### 4.3. CI/CD Pipeline
- `.github/workflows/ci.yml`: Canonical GitHub Actions pipeline validating:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm lint`
  3. `pnpm typecheck`
  4. `pnpm test`
  5. `pnpm build`
  6. Docker image builds
  7. Playwright E2E browser test suite

---

## 5. External AI Service Isolation

### Explicit Architectural Boundary
- **AI Service Status**: **FULLY INDEPENDENT**.
- The Python FastAPI AI service located in `study-partner-ai` was **NOT** merged into the NestJS backend.
- The Python codebase, dependencies (`pyproject.toml`, `requirements.txt`), FastAPI routers, and Pytest suites remain independent.
- **Communication Flow**:
  ```
  Browser ──► Next.js ──► NestJS (Orchestrator) ──► Shared AI Client ──► External Python AI
                                              └──► RabbitMQ Queues ───► AI Background Workers
  ```
- Browser clients NEVER call the AI service directly.
- The NestJS backend handles all credential validation, request throttling, error timeouts, and response transformations before interacting with the AI service.
- If the AI service is offline, the core NestJS application continues operating with degraded AI endpoints.

---

## 6. Verification Results

| Verification Phase | Command | Status | Details |
|---|---|---|---|
| **Workspace Install** | `pnpm install --frozen-lockfile` | PASSED | Zero package manager or lockfile errors |
| **Linting** | `pnpm lint` | PASSED | Zero errors across API and Web packages |
| **Typecheck / Syntax** | `pnpm typecheck` | PASSED | TypeScript and JSX syntax checks passed |
| **Unit & Integration Tests** | `pnpm test` | PASSED | 434 API unit tests, 53 integration tests, 17 auth lifecycle tests, 159 Web vitest tests passed |
| **End-to-End Tests** | `pnpm test:e2e` | PASSED | 9 Playwright browser tests passed (auth, session, navigation, smoke) |
| **Production Build** | `pnpm build` | PASSED | NestJS TypeScript compiled to `dist/`, Next.js standalone App Router compiled |

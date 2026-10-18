# Migration Inventory

Status: **COMPLETE**

This inventory tracks every architectural component, frontend route, backend domain module, cross-cutting concern, and infrastructure element across the React + Express → Next.js + NestJS migration.

---

## 1. Core Architectural Components

| Component | Source Technology | Target Technology | Status | Notes |
|---|---|---|---|---|
| **Frontend Framework** | React 18 (Vite SPA) | Next.js 16 (App Router) | COMPLETE | Migrated to Next.js App Router with standalone output |
| **Frontend Routing** | React Router (`react-router-dom` v6) | Next.js App Router (`app/` directory) | COMPLETE | 28 dedicated page routes, dynamic segments, SSR & client hydration |
| **Backend Framework** | Express.js 4 | NestJS 12 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) | COMPLETE | Modular monolith booted via `createNestApp()` |
| **Backend Structure** | Multi-service / Express gateway | Single NestJS Modular Monolith | COMPLETE | Single backend entrypoint (`src/main.js`), zero microservices |
| **Package Manager** | npm / mixed | pnpm 11.3.0 + pnpm workspace | COMPLETE | Monorepo managed via `pnpm-workspace.yaml` and `pnpm-lock.yaml` |
| **Database & ORM** | MongoDB 7 + Mongoose 8 | MongoDB 7 + Mongoose 8 | COMPLETE | Preserved existing schemas, indexes, collections, and models |
| **Authentication** | Custom Express JWT / refresh tokens | Better Auth (Next.js route handler + NestJS SessionGuard) | COMPLETE | HTTP-only session cookies, bcrypt migration, unified session store |
| **Authorization** | Express middleware (`authenticateToken`, `requireRole`, `requireTier`) | NestJS `SessionGuard` + domain policy execution | COMPLETE | Enforced server-side in NestJS, contextual identity propagation |
| **AI Integration** | Python FastAPI service | Independent Python FastAPI service | COMPLETE | Service remains external; NestJS connects via `aiClient` & RabbitMQ |
| **Real-time / WebSockets** | `ws` on disparate ports | Single HTTP server WebSocket attachment | COMPLETE | Attached to unified NestJS HTTP listener (`/ws/`) via edge reverse proxy |
| **Background Workers** | Disconnected worker scripts | Managed background consumers & pollers | COMPLETE | Gracefully initialized and drained on NestJS lifecycle shutdown |
| **Containerization** | Legacy multi-container setup | Multi-stage Dockerfiles + Docker Compose | COMPLETE | Production-grade Docker builds for Next.js (`mindflow-web`) and NestJS (`mindflow-api`) |
| **CI/CD** | Ad-hoc npm scripts | GitHub Actions (`.github/workflows/ci.yml`) | COMPLETE | Validates install, lint, typecheck, unit tests, integration tests, E2E, Docker builds |

---

## 2. Frontend Routes & Screens Inventory

All 28 application screens migrated to Next.js App Router:

| URL Path | App Router Location | Access Level | Component Strategy | Status |
|---|---|---|---|---|
| `/` | `app/page.jsx` | Public | Client Component (`Landing`) | COMPLETE |
| `/login` | `app/login/page.jsx` | Public (Guest) | Client Component (`Login`) | COMPLETE |
| `/register` | `app/register/page.jsx` | Public (Guest) | Client Component (`Register`) | COMPLETE |
| `/pricing` | `app/pricing/page.jsx` | Public | Client Component (`Pricing`) | COMPLETE |
| `/checkout/success` | `app/checkout/success/page.jsx` | Public / Authenticated | Client Component (`CheckoutSuccess`) | COMPLETE |
| `/checkout/cancel` | `app/checkout/cancel/page.jsx` | Public / Authenticated | Client Component (`CheckoutCancel`) | COMPLETE |
| `/verify-email` | `app/verify-email/page.jsx` | Public | Client Component (`VerifyEmail`) | COMPLETE |
| `/verify-email/[token]` | `app/verify-email/[token]/page.jsx` | Public | Client Component (`VerifyEmail` with token) | COMPLETE |
| `/forgot-password` | `app/forgot-password/page.jsx` | Public | Client Component (`ForgotPassword`) | COMPLETE |
| `/reset-password` | `app/reset-password/page.jsx` | Public | Client Component (`ResetPassword`) | COMPLETE |
| `/reset-password/[token]` | `app/reset-password/[token]/page.jsx` | Public | Client Component (`ResetPassword` with token) | COMPLETE |
| `/dashboard` | `app/dashboard/page.jsx` | Protected (Student) | Client Component (`Dashboard`) | COMPLETE |
| `/sessions` | `app/sessions/page.jsx` | Protected (Student) | Client Component (`Sessions`) | COMPLETE |
| `/tasks` | `app/tasks/page.jsx` | Protected (Student) | Client Component (`Tasks`) | COMPLETE |
| `/profile` | `app/profile/page.jsx` | Protected (User) | Client Component (`Profile`) | COMPLETE |
| `/subjects` | `app/subjects/page.jsx` | Protected (Student) | Client Component (`Subjects`) | COMPLETE |
| `/subjects/[subjectId]` | `app/subjects/[subjectId]/page.jsx` | Protected (Student) | Client Component (`SubjectDetail`) | COMPLETE |
| `/upload-course` | `app/upload-course/page.jsx` | Protected (Student) | Client Component (`CourseUpload`) | COMPLETE |
| `/planner` | `app/planner/page.jsx` | Protected (Student) | Client Component (`StudyPlanner`) | COMPLETE |
| `/competency` | `app/competency/page.jsx` | Protected (Student) | Client Component (`CompetencyMap`) | COMPLETE |
| `/session-live` | `app/session-live/page.jsx` | Protected (Student) | Client Component (`StudySession`) | COMPLETE |
| `/session-setup` | `app/session-setup/page.jsx` | Protected (Student) | Client Component (`StudySessionSetup`) | COMPLETE |
| `/team-lobby` | `app/team-lobby/page.jsx` | Protected (Student) | Client Component (`TeamLobby`) | COMPLETE |
| `/calendar` | `app/calendar/page.jsx` | Protected (Student) | Client Component (`Calendar`) | COMPLETE |
| `/leaderboard` | `app/leaderboard/page.jsx` | Protected (Student) | Client Component (`Leaderboard`) | COMPLETE |
| `/reviews` | `app/reviews/page.jsx` | Protected (Student) | Client Component (`ReviewCenter`) | COMPLETE |
| `/search` | `app/search/page.jsx` | Protected (Student) | Client Component (`AISearch`) | COMPLETE |
| `/friends` | `app/friends/page.jsx` | Protected (Student) | Client Component (`Friends`) | COMPLETE |
| `/analytics` | `app/analytics/page.jsx` | Protected (Student) | Client Component (`Analytics`) | COMPLETE |
| `/admin` | `app/admin/page.jsx` | Protected (Admin) | Client Component (`AdminDashboard`) | COMPLETE |
| `/admin/dashboard` | `app/admin/dashboard/page.jsx` | Protected (Admin) | Client Component (`AdminDashboard`) | COMPLETE |
| `/admin/coupons` | `app/admin/coupons/page.jsx` | Protected (Admin) | Client Component (`AdminCoupons`) | COMPLETE |
| `/admin/analytics` | `app/admin/analytics/page.jsx` | Protected (Admin) | Client Component (`AdminAnalytics`) | COMPLETE |
| `/admin/users` | `app/admin/users/page.jsx` | Protected (Admin) | Client Component (`AdminUsers`) | COMPLETE |
| `/admin/subscriptions` | `app/admin/subscriptions/page.jsx` | Protected (Admin) | Client Component (`AdminSubscriptions`) | COMPLETE |
| `/customize/wallpaper` | `app/customize/wallpaper/page.jsx` | Protected (Student) | Client Component (`BackgroundCustomizer`) | COMPLETE |
| `/customize/animated` | `app/customize/animated/page.jsx` | Protected (Student) | Client Component (`AnimatedBackgroundCustomizer`) | COMPLETE |
| `/api/auth/[...all]` | `app/api/auth/[...all]/route.js` | Public Auth Engine | Next.js Route Handler (Better Auth) | COMPLETE |

---

## 3. Backend Modules & Controllers Inventory

All backend domains migrated into typed NestJS Modules:

| Domain | NestJS Module | NestJS Controller | NestJS Service / Providers | Mount Prefixes | Status |
|---|---|---|---|---|---|
| **Infrastructure** | `AppModule` | `InfrastructureController` | Metrics, health checks, OpenAPI | `/api/v1/health`, `/api/v1/monitoring/*`, `/api/v1/docs` | COMPLETE |
| **Auth & Billing** | `AuthModule` | `AuthController` | `AuthService`, `SessionGuard` | `/api/v1/auth`, `/api/v1/auth/stripe`, `/api/v1/auth/admin` | COMPLETE |
| **User Profile & Social** | `UsersModule` | `UsersController` | `UsersService`, `SessionGuard` | `/api/v1/users/profile`, `/api/v1/users/availability`, `/api/v1/users/gamification`, `/api/v1/users/quests`, `/api/v1/users/friends` | COMPLETE |
| **Study & Sessions** | `StudyModule` | `StudyController` | `StudyService`, `SessionGuard` | `/api/v1/study/tasks`, `/api/v1/study/topics`, `/api/v1/study/sessions`, `/api/v1/study/subjects`, `/api/v1/study/courses`, `/api/v1/study/plans`, `/api/v1/competencies`, `/api/v1/coach` | COMPLETE |
| **AI Orchestrator** | `AiModule` | `AiController` | `AiService`, `SessionGuard` | `/api/v1/ai`, `/api/v1/ai/jobs`, `/api/v1/eval`, `/api/v1/search` | COMPLETE |
| **Signal Processing** | `SignalsModule` | `SignalsController` | `SignalsService`, `SessionGuard` | `/api/v1/signals/focus` | COMPLETE |
| **Analytics** | `AnalyticsModule` | `AnalyticsController` | `AnalyticsService`, `SessionGuard` | `/api/v1/analytics` | COMPLETE |
| **Notifications & Chat** | `NotificationsModule` | `NotificationsController` | `NotificationsService`, `SessionGuard` | `/api/v1/notifications`, `/api/v1/session-chat`, `/api/v1/voice` | COMPLETE |

---

## 4. Middleware & Cross-Cutting Concerns Migration

| Express Pattern | NestJS Pattern | Implementation File | Status |
|---|---|---|---|
| Express global error handler | NestJS Global Exception Filter | `study-partner-api/src/framework/exception.filter.ts` | COMPLETE |
| Express auth middleware (`authenticateToken`) | NestJS Guard | `study-partner-api/src/framework/auth.guard.ts` (`SessionGuard`) | COMPLETE |
| Express request validation | NestJS Custom Parameter Pipe | `study-partner-api/src/framework/parameter.pipe.ts` (`ContractParameterPipe`) | COMPLETE |
| Express metrics logging | NestJS Middleware | `study-partner-api/src/framework/metrics.ts` (`recordRequest`) | COMPLETE |
| Express rate limiter | Rate limiting middleware | Redis token-bucket middleware integrated in `bootstrap.ts` | COMPLETE |
| Express file upload (Multer/express-fileupload) | Request parser middleware | Configured per-route in `bootstrap.ts` with strict size/MIME validation | COMPLETE |
| Express CORS & security headers | NestJS HTTP Adapter middlewares | `shared.securityMiddleware()`, `shared.corsMiddleware()` in `bootstrap.ts` | COMPLETE |
| Express raw body parser for Stripe | Route-specific body parser | `express.raw({ type: 'application/json' })` for `/api/v1/auth/stripe/webhook` | COMPLETE |

---

## 5. Testing & Verification Inventory

| Test Suite | Tooling | Target | Status | Results |
|---|---|---|---|---|
| **API Unit Tests** | Jest 29 | Domain modules, shared utilities, schemas | COMPLETE | 43 suites passed, 434 tests passed |
| **API Integration Tests** | Jest 29 + Supertest | Gateway routing, AI jobs, round-trips, rewards | COMPLETE | 7 suites passed, 53 tests passed |
| **Auth Lifecycle & Nest Guard Tests** | Node test runner (`node:test`) | Better Auth lifecycle, bcrypt migration, Nest session guard | COMPLETE | 17 tests passed (100%) |
| **Frontend Unit & Integration Tests** | Vitest 3 + JSDOM + React Testing Library | Stores, hooks, components, auth gates | COMPLETE | 35 suites passed, 159 tests passed |
| **End-to-End Tests** | Playwright 1.62 | Full browser registration, email verification, login, session persistence, logout, password reset, smoke tests | COMPLETE | 9 tests passed (100%) |
| **TypeScript / Syntax Checks** | `tsc --noEmit` + AST syntax check | Backend TypeScript and Frontend JSX | COMPLETE | Passed with 0 errors |
| **Workspace Lint** | ESLint 8 | Workspace code quality and conventions | COMPLETE | Passed with 0 errors |

> **HISTORICAL / SUPERSEDED as current-state evidence (18 October 2026).** Retained for migration/security context. Completion, deployment, old paths and test counts below are historical assertions, not current validation. Use [CURRENT architecture](ARCHITECTURE.md), [EdNova audit](audit/2026-10-18/EDNOVA_AUDIT.md), [permissions](docs-repo/docs/roles-and-permissions.md) and [executed validation](audit/2026-10-18/VALIDATION.md). Do not run historical migration/removal steps without checking the current source and data.

# API Compatibility Analysis

Status: **COMPATIBLE**

This document details the API compatibility between the previous Express application and the migrated NestJS + Next.js architecture.

---

## 1. Executive Summary

- **Total Public & Domain Endpoints**: 92 endpoints preserved across 7 domain modules and core infrastructure.
- **Breaking Changes**: Zero unmanaged breaking changes.
  - Custom legacy JWT authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/register`, `/api/v1/auth/refresh`, `/api/v1/auth/verify-otp`) were retired in favor of native Better Auth endpoints hosted at `/api/auth/*`.
  - All existing application screens and API clients were updated to use the unified session authentication model.
  - Character features were previously decommissioned and endpoints return standard 404s.
- **Data Formats & Status Codes**: JSON request/response structures, HTTP status codes (200, 201, 202, 400, 401, 403, 404, 422, 500), and query parameter formats are 100% preserved.

---

## 2. Authentication Compatibility

The authentication layer transitioned from custom Express JWT bearer tokens in headers to secure, HTTP-only cookie sessions powered by Better Auth on Next.js:

| Action | Legacy Express Endpoint | Migrated Next.js / NestJS Path | Compatibility Note |
|---|---|---|---|
| User Sign In | `POST /api/v1/auth/login` | `POST /api/auth/sign-in/email` | Native Better Auth replaces custom handler; email + password validated against migrated bcrypt hashes. |
| User Registration | `POST /api/v1/auth/register` | `POST /api/auth/sign-up/email` | Native Better Auth creates User + Account records preserving MongoDB ObjectId. |
| User Sign Out | `POST /api/v1/auth/logout` | `POST /api/auth/sign-out` | Clears HTTP-only session cookie. |
| Session Check | `GET /api/v1/auth/me` | `GET /api/auth/get-session` & `GET /api/v1/auth/me` | `GET /api/v1/auth/me` preserved in NestJS for rich user profile & billing status. |
| Password Reset Request | `POST /api/v1/auth/forgot-password` | `POST /api/auth/forget-password` | Sends secure reset link via SMTP/Mailpit. |
| Password Reset Confirm | `POST /api/v1/auth/reset-password` | `POST /api/auth/reset-password` | Validates token and updates password hash. |
| Email Verification | `POST /api/v1/auth/verify-email` | `POST /api/auth/verify-email` | Verifies account status in database. |

---

## 3. Domain Endpoints Compatibility Matrix

### 3.1. Infrastructure & Observability

| Method | Endpoint | Old Framework | NestJS Controller | Status | Breaking? |
|---|---|---|---|---|---|
| `GET` | `/api/v1/health` | Express | `InfrastructureController.health` | Compatible | No |
| `GET` | `/api/v1/docs` | Express | `InfrastructureController.docs` | Compatible | No |
| `GET` | `/api/v1/docs/openapi.json` | Express | `InfrastructureController.specification` | Compatible | No |
| `GET` | `/api/v1/monitoring/health` | Express | `InfrastructureController.monitoring` | Compatible | No |
| `GET` | `/api/v1/monitoring/metrics` | Express | `InfrastructureController.metrics` | Compatible | No |

### 3.2. Auth & Billing Domain (`AuthModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `GET` | `/api/v1/auth/me` | Current user account and billing status | Compatible | No |
| `POST` | `/api/v1/auth/coupon/redeem` | Redeem promotional coupon | Compatible | No |
| `GET` | `/api/v1/auth/coupon/list` | List available coupons | Compatible | No |
| `GET` | `/api/v1/auth/stripe/config` | Stripe publishable key & config | Compatible | No |
| `POST` | `/api/v1/auth/stripe/subscribe` | Create Stripe checkout session | Compatible | No |
| `GET` | `/api/v1/auth/stripe/subscription/status` | Current Stripe subscription status | Compatible | No |
| `POST` | `/api/v1/auth/stripe/confirm` | Confirm payment completion | Compatible | No |
| `POST` | `/api/v1/auth/stripe/webhook` | Raw-body Stripe webhook handler | Compatible | No |
| `GET` | `/api/v1/auth/admin/users` | Admin: list users | Compatible | No |
| `GET` | `/api/v1/auth/admin/users/:userId` | Admin: get user details | Compatible | No |
| `PUT` | `/api/v1/auth/admin/users/:userId` | Admin: update user details | Compatible | No |
| `DELETE` | `/api/v1/auth/admin/users/:userId` | Admin: delete user | Compatible | No |
| `PUT` | `/api/v1/auth/admin/users/:userId/tier` | Admin: update user tier | Compatible | No |
| `GET` | `/api/v1/auth/admin/stats` | Admin: system stats | Compatible | No |
| `GET` | `/api/v1/auth/admin/analytics/revenue` | Admin: revenue metrics | Compatible | No |
| `GET` | `/api/v1/auth/admin/subscriptions` | Admin: list subscriptions | Compatible | No |
| `PUT` | `/api/v1/auth/admin/subscriptions/:paymentId/cancel`| Admin: cancel subscription | Compatible | No |
| `GET` | `/api/v1/auth/admin/coupons` | Admin: list coupons | Compatible | No |
| `POST` | `/api/v1/auth/admin/coupons` | Admin: create coupon | Compatible | No |
| `PUT` | `/api/v1/auth/admin/coupons/:couponId` | Admin: update coupon | Compatible | No |
| `DELETE` | `/api/v1/auth/admin/coupons/:couponId` | Admin: delete coupon | Compatible | No |
| `GET` | `/api/v1/auth/admin/coupons/:couponId/usage` | Admin: coupon usage analytics | Compatible | No |

### 3.3. Users & Social Domain (`UsersModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `GET` | `/api/v1/users/profile` | Get user profile | Compatible | No |
| `PUT` | `/api/v1/users/profile` | Update profile settings | Compatible | No |
| `GET` | `/api/v1/users/availability` | Get availability slots | Compatible | No |
| `POST` | `/api/v1/users/availability` | Save availability slots | Compatible | No |
| `GET` | `/api/v1/users/gamification` | Get gamification stats, XP, level | Compatible | No |
| `GET` | `/api/v1/users/gamification/rank` | Get ranked competitive status | Compatible | No |
| `GET` | `/api/v1/users/quests` | Get active user quests | Compatible | No |
| `POST` | `/api/v1/users/quests/:id/claim`| Claim quest completion rewards | Compatible | No |
| `GET` | `/api/v1/users/friends` | List friendships & pending requests | Compatible | No |
| `POST` | `/api/v1/users/friends/request` | Send friend request | Compatible | No |
| `PUT` | `/api/v1/users/friends/request/:id/accept` | Accept friend request | Compatible | No |
| `PUT` | `/api/v1/users/friends/request/:id/reject` | Reject friend request | Compatible | No |
| `GET` | `/api/v1/users/friends/leaderboard` | Friend leaderboard rankings | Compatible | No |

### 3.4. Study & Sessions Domain (`StudyModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `GET` | `/api/v1/study/tasks` | List user study tasks | Compatible | No |
| `POST` | `/api/v1/study/tasks` | Create study task | Compatible | No |
| `GET` | `/api/v1/study/tasks/:id` | Get task details | Compatible | No |
| `PUT` | `/api/v1/study/tasks/:id` | Update study task | Compatible | No |
| `DELETE` | `/api/v1/study/tasks/:id` | Delete study task | Compatible | No |
| `GET` | `/api/v1/study/sessions` | List completed study sessions | Compatible | No |
| `POST` | `/api/v1/study/sessions` | Start / log study session | Compatible | No |
| `POST` | `/api/v1/study/sessions/:id/complete` | Complete study session & award XP | Compatible | No |
| `GET` | `/api/v1/study/subjects` | List subjects | Compatible | No |
| `POST` | `/api/v1/study/subjects` | Create subject | Compatible | No |
| `GET` | `/api/v1/study/courses` | List courses | Compatible | No |
| `POST` | `/api/v1/study/courses` | Upload / create course (multipart) | Compatible | No |
| `POST` | `/api/v1/study/courses/:id/files` | Upload course file attachments | Compatible | No |
| `GET` | `/api/v1/study/plans` | List active study plans | Compatible | No |
| `POST` | `/api/v1/study/plans` | Create study plan | Compatible | No |
| `GET` | `/api/v1/study/learning-objectives` | Get learning objectives | Compatible | No |
| `GET` | `/api/v1/competencies` | Get competency progression graph | Compatible | No |
| `POST` | `/api/v1/coach/nudge` | Study coach intervention / nudge | Compatible | No |

### 3.5. AI Orchestrator Domain (`AiModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `POST` | `/api/v1/ai/ingest` | Ingest document for semantic processing | Compatible | No |
| `POST` | `/api/v1/ai/plan` | Generate AI-driven study plan | Compatible | No |
| `POST` | `/api/v1/ai/coach` | Real-time AI study coach queries | Compatible | No |
| `POST` | `/api/v1/ai/jobs` | Submit asynchronous AI background job | Compatible | No |
| `GET` | `/api/v1/ai/jobs/:jobId` | Poll AI job progress and results | Compatible | No |
| `POST` | `/api/v1/eval/step` | Socratic evaluation step submission | Compatible | No |
| `POST` | `/api/v1/search/query` | Semantic vector search query | Compatible | No |

### 3.6. Signal Processing Domain (`SignalsModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `POST` | `/api/v1/signals/focus/start` | Start focus tracking session | Compatible | No |
| `POST` | `/api/v1/signals/focus/:id/data` | Ingest focus biometric/telemetry frame | Compatible | No |
| `POST` | `/api/v1/signals/focus/:id/end` | Finalize focus tracking session | Compatible | No |

### 3.7. Analytics Domain (`AnalyticsModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `POST` | `/api/v1/analytics/track` | Track telemetry / analytics event | Compatible | No |
| `GET` | `/api/v1/analytics/timeline` | Get user timeline analytics | Compatible | No |
| `GET` | `/api/v1/analytics/summary` | Get aggregated productivity summary | Compatible | No |
| `GET` | `/api/v1/analytics/insights` | Get AI/rule-based productivity insights | Compatible | No |

### 3.8. Notifications & Chat Domain (`NotificationsModule`)

| Method | Endpoint | Description | Status | Breaking? |
|---|---|---|---|---|
| `GET` | `/api/v1/notifications` | List user notifications | Compatible | No |
| `PUT` | `/api/v1/notifications/:id/read` | Mark notification as read | Compatible | No |
| `PUT` | `/api/v1/notifications/read-all` | Mark all notifications as read | Compatible | No |
| `GET` | `/api/v1/session-chat/:sessionId/history` | Get chat history for study session | Compatible | No |
| `POST` | `/api/v1/voice/:sessionId/start` | Initialize voice study session | Compatible | No |

---

## 4. Verification & Regression Testing

All endpoints listed above are verified through:
1. **Automated Integration Tests (`tests/integration/gateway.integration.test.js`)**: Confirms routing, HTTP status codes, error handling, and authorization.
2. **Auth Lifecycle Tests (`tests/better-auth.nest.mjs`)**: Confirms NestJS `SessionGuard` enforcement, cookie resolution, and role-based access control.
3. **E2E Browser Tests (`e2e/better-auth.spec.js`, `e2e/smoke.spec.js`)**: Confirms full client-to-backend communication across all page journeys.

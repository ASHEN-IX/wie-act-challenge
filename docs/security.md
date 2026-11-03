> **HISTORICAL / SUPERSEDED as current-state evidence (18 October 2026).** Retained for migration/security context. Completion, deployment, old paths and test counts below are historical assertions, not current validation. Use [CURRENT architecture](architecture.md), [EdNova audit](audit/ednova-audit.md), [permissions](roles-and-permissions.md) and [executed validation](audit/validation.md). Do not run historical migration/removal steps without checking the current source and data.

# Security Architecture & Audit Report

This document outlines the security architecture, controls, threat mitigations, and compliance audit for the Mindflow Next.js + NestJS application.

---

## 1. Threat Model & Security Posture Overview

```
[Untrusted Client / Browser]
         │
         │ HTTPS / WSS
         ▼
[Nginx Edge / Reverse Proxy] ── Rate Limiting, TLS Termination, No-Log Credential Headers
         │
         ├───► [Next.js App Router] ── CSP Nonces, CSRF Checks, HTTP-only Cookie Management
         │            │
         │            ▼
         │      [Better Auth] ──── Bcrypt Hash (cost 12), Account Lockout, OTP Expiration
         │
         ▼
[NestJS Backend Monolith]
         │
         ├──► [SessionGuard] ──────── Authoritative Cookie & Identity Validation
         ├──► [Domain Policies] ───── Role-Based Access Control (RBAC), Tier Gating
         ├──► [Parameter Pipes] ───── Joi Schema Validation, Sanitization, Coercion
         ├──► [Upload Validation] ─── MIME/Extension Whitelist, Size Limits, Nonce Paths
         │
         ▼
[Protected Data & Infrastructure]
         ├──► MongoDB ─────────────── Model-Layer Casts, NoSQL Injection Immunity
         ├──► Redis ───────────────── Rate Limiting State, Token Buckets
         ├──► RabbitMQ ────────────── Authenticated VHosts, TLS Broker Connections
         └──► Independent AI ──────── Strict URL Origin Whitelist, Egress Guard
```

---

## 2. Authentication & Credential Management

### 2.1. Cookie-Based Session Architecture
- **Protocol**: HTTP-only, `SameSite=Lax`, `Secure` (in production) cookies managed by Better Auth.
- **Token Leakage Prevention**: Bearer tokens are completely eliminated from `localStorage` and `sessionStorage`. Client JavaScript cannot read session credentials.
- **Session Lifecycle**:
  - Logins issue unique session identifiers stored in MongoDB `auth_sessions`.
  - Logouts invalidate the database session immediately and clear the cookie.
  - Password resets invalidate all active sessions for the target user.

### 2.2. Password Storage & Migration
- Passwords are encrypted using Bcrypt with a salt work factor of 12.
- Backward compatibility: Existing user accounts are lazily migrated to Better Auth `auth_accounts` upon authentication, preserving historical identity records.

### 2.3. Brute Force & Rate Limiting
- **Sign-in & Sign-up**: Rate-limited token buckets stored in Redis.
- **OTP Verification**: Email verification OTPs expire within 10 minutes and lock out after 5 consecutive failed attempts (`tests/better-auth.lifecycle.mjs`).

---

## 3. Authorization & Access Control

### 3.1. Authoritative Backend Enforcement
- The frontend UI adapts based on user roles and subscription tiers, but **the NestJS backend remains 100% authoritative**.
- Every protected domain route executes under NestJS `SessionGuard`:
  - Resolves session from incoming HTTP cookies.
  - Injects authenticated user context (`req.user`) into the execution request.
  - Verifies account active status (`isActive === true`).

### 3.2. Role-Based Access Control (RBAC)
- **Roles**: `student`, `user`, `admin`.
- Admin-only routes (`/api/v1/auth/admin/*`) strictly reject non-admin identities with HTTP `403 Forbidden`.

### 3.3. Resource Ownership & Multi-Tenancy
- Endpoints enforce ownership bounds: a user can only query or modify their own tasks, study plans, sessions, and notifications.
- Team sessions and friends discovery enforce explicit membership validation.

### 3.4. Subscription Tier Gating
- Features gated by tier (`free`, `trial`, `vip`, `vip_plus`) are checked in domain logic via `shared/tierGate.js`.

---

## 4. Network & Transport Security

### 4.1. CSRF & Origin Validation
- Every mutating HTTP request (`POST`, `PUT`, `PATCH`, `DELETE`) is inspected at the NestJS bootstrap layer:
  - Validates `Origin` against `AUTH_TRUSTED_ORIGINS`.
  - Rejects cross-site fetch metadata (`Sec-Fetch-Site: cross-site`) when origin headers are omitted.
  - Responds with HTTP `403 Untrusted request origin`.

### 4.2. Content Security Policy (CSP)
- The Next.js edge proxy (`apps/web/proxy.js`) issues a dynamic per-request cryptographic nonce:
  ```
  default-src 'self';
  script-src 'self' 'nonce-<UUID>' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self' data:;
  connect-src 'self' ws: wss:;
  media-src 'self' blob: https:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  object-src 'none';
  ```
- Protects against Cross-Site Scripting (XSS), Clickjacking (`frame-ancestors 'none'`), and unauthorized resource embedding.

### 4.3. Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 5. Input Validation & Injection Mitigations

### 5.1. NoSQL Injection
- All database operations utilize Mongoose schemas with strict types. User inputs cannot alter MongoDB query operators (`$ne`, `$where`, `$gt`).

### 5.2. Request Payload Validation
- NestJS uses `ContractParameterPipe` backed by Joi validation schemas.
- Payloads containing unknown or unexpected fields are sanitized or rejected before handler execution.

### 5.3. SSRF (Server-Side Request Forgery)
- Outbound requests to external services (AI service, webhooks) pass through dedicated clients (`shared/aiClient.js`).
- The AI client enforces strict URL origin checking against `AI_SERVICE_URL` and rejects unapproved protocols or private network scans.

---

## 6. File Upload Security

File uploads (`/api/v1/study/courses`, `/api/v1/study/courses/:id/files`, `/uploads`) enforce:
1. **Size Limits**: Hard 10MB maximum request size.
2. **Rate Limiting**: Dedicated rate limiter restricts uploads to 5 per minute per IP.
3. **MIME Validation**: Verified against an approved whitelist (PDF, DOCX, TXT, images).
4. **Directory Traversal**: Upload paths are normalized; path components containing `..` or dotfiles are rejected.
5. **Static File Serving**: Uploaded static files serve with `X-Content-Type-Options: nosniff` and cannot execute code.

---

## 7. Secrets Management & Environment Isolation

- **Client vs. Server Isolation**:
  - `apps/web` environment variables expose NO sensitive credentials.
  - Variables prefixed with `NEXT_PUBLIC_*` contain only safe public settings (such as app title or public URLs).
  - Secrets (`BETTER_AUTH_SECRET`, `INTERNAL_API_SECRET`, `MONGODB_URI`, `STRIPE_SECRET_KEY`, `RABBITMQ_PASS`) are strictly isolated to server-side environments.
- **Internal API Calls**:
  - Monolith internal service routes (`/api/v1/notifications/internal`, `/api/v1/monitoring/metrics`) require `x-internal-secret` matching `INTERNAL_API_SECRET`.

---

## 8. Stripe Billing & Webhook Integrity

- Webhook endpoint `/api/v1/auth/stripe/webhook` bypasses standard JSON body parsing to receive raw payload bytes (`express.raw({ type: 'application/json' })`).
- Cryptographic signature verified using `stripe.webhooks.constructEvent(rawBody, signature, secret)`.
- Replay attacks are mitigated by Stripe event timestamp tolerance checks.

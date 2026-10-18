# Backlog Items — MindFlow (Study Partner) Production Readiness Program

## MindFlow — Feature-Based Sprint Backlog

_Version 1.1 — August 2026 (v1.0 + F14 Bloom Competency Engine)_
_Input: Production audit (`study_partner_audit_2026.md`) + AI communication architecture decision (RabbitMQ) + revised Bloom taxonomy specification (Anderson & Krathwohl, 2001)_
_Team: 3 developers_

---

## Table des matières

1. [Overview](#1-overview)
2. [F01 — AI Communication & Job Infrastructure (AI-COM)](#2-f01--ai-communication--job-infrastructure-ai-com)
3. [F02 — AI Planner (PLAN)](#3-f02--ai-planner-plan)
4. [F03 — AI Coach (COACH)](#4-f03--ai-coach-coach)
5. [F04 — AI Evaluator (EVAL)](#5-f04--ai-evaluator-eval)
6. [F05 — AI Search & Ingestion (SEARCH / INGEST)](#6-f05--ai-search--ingestion-search--ingest)
7. [F06 — Authentication & Security (SEC)](#7-f06--authentication--security-sec)
8. [F07 — Study & Session Reliability (STUDY)](#8-f07--study--session-reliability-study)
9. [F08 — Gamification & Async Events (GAME)](#9-f08--gamification--async-events-game)
10. [F09 — Analytics & Performance (PERF)](#10-f09--analytics--performance-perf)
11. [F10 — Testing & Quality (TEST)](#11-f10--testing--quality-test)
12. [F11 — Infrastructure & Deployment (INFRA)](#12-f11--infrastructure--deployment-infra)
13. [F12 — UX & Frontend Quality (UX)](#13-f12--ux--frontend-quality-ux)
14. [F13 — Observability & Disaster Recovery (OPS)](#14-f13--observability--disaster-recovery-ops)
15. [F14 — Bloom Competency Engine (BLOOM)](#15-f14--bloom-competency-engine-bloom)
16. [F15 — Knowledge Graph & Graph RAG Infrastructure (KG-RAG)](#16-f15--knowledge-graph--graph-rag-infrastructure-kg-rag)
17. [Dependency Graph](#17-dependency-graph)
18. [Team Workload Projection](#18-team-workload-projection)
19. [Shared Foundation](#19-shared-foundation)

---

## 1. Overview

This document defines all user stories required to bring MindFlow from its audited state (**41/100 production readiness**) to a secure, reliable, deployable platform.

The features are organized around **delivery increments** rather than technical layers:

1. **F01 — AI Communication & Job Infrastructure** — replaces direct HTTP proxying to the Python AI service with an asynchronous RabbitMQ architecture, simultaneously removing the audit's worst finding (unauthenticated Python API) and the missing queue/reliability weakness
2. **F02–F05 — AI features** (Planner, Coach, Evaluator, Search & Ingestion) — migrate each agent onto the RabbitMQ job framework and eliminate prompt-injection vulnerabilities
3. **F06 — Authentication & Security** — resolves remaining P0/P1 security and crash risks (OTP, refresh token, async handlers, internal auth, ReDoS, uploads)
4. **F07–F09 — Study, Gamification, Analytics & Performance** — reliability and scalability (async side effects, indexes, N+1, aggregation, base64 storage)
5. **F10 — Testing & Quality** — makes the test suite actually prove the platform works (fake integration tests removed, E2E unblocked, contract + security tests)
6. **F11 — Infrastructure & Deployment** — blocking CI security, hardening, staging, deployment
7. **F12 — UX & Frontend Quality** — product friction fixes
8. **F13 — Observability & Disaster Recovery** — monitoring, alerting, backups, DR
9. **F14 — Bloom Competency Engine** — revised Bloom taxonomy (Anderson & Krathwohl, 2001) as a two-dimensional competency model: learning objectives classified by cognitive process × knowledge type, evidence-based mastery estimation per (topic × level), and personalized plans that target the weakest competencies

The first feature (**F01**) is the shared foundation for every AI feature and is a hard prerequisite for F02–F05.

### Team

| Developer | Primary responsibility |
|-----------|------------------------|
| **Dev A** | Backend / Core platform (Node services, MongoDB, contracts) |
| **Dev B** | AI / Python / AI infrastructure (agents, workers, LLM security) |
| **Dev C** | Frontend / QA / DevOps (React, Playwright, Docker, CI/CD) |

Developers are not locked to one layer. During a feature, two developers can work on different sides of the same feature.

### Story Format

All stories follow the sprint backlog format:

```
ID | User Story | Day | Assignee | Domain | Type | Priority | Est.h | Story Pts | Acceptance Criteria | Dependencies
```

### Sequencing Principle

- **F01 (RabbitMQ + contracts) first** — every AI feature depends on it
- **One vertical slice before full migration** — one complete AI operation must travel Node → RabbitMQ → Python → RabbitMQ → Node before migrating the rest
- **Ingestion before AI intelligence** — you can't analyze what you haven't collected
- **Security before feature growth** — F06 completes while AI features migrate
- **Testing is a feature** — F10 runs in parallel from Sprint 1 and validates every other feature
- **Refactoring and UX last** — only after the system is operationally stable
- **Competency before personalization claims** — F14 turns "personalized plan" from marketing into a measured feedback loop; it lands after ingestion + evaluation produce evidence

### Priority Model

| Priority | Meaning |
|----------|---------|
| **Critical** | Production blocker (audit P0) |
| **High** | Important before production (audit P1) |
| **Medium** | Production maturity (audit P2) |
| **Low** | Enhancement / quality of life (audit P3) |

---

## 2. F01 — AI Communication & Job Infrastructure (AI-COM)

### Epic: As a Platform, I want AI communication to be asynchronous via a secured, reliable RabbitMQ job bus so that the Python AI service is no longer exposed as a client-facing HTTP API and every AI job is idempotent, traceable and retried.

**Priority:** Critical
**Sprint:** 1
**Owners:** Dev A + Dev B + Dev C

This is the shared foundation for every AI feature. The current architecture has the Node `ai-orchestrator-service` proxying directly to the Python AI service over HTTP, and the Python service has **no authentication** (audit §7.1, Critical). Replacing direct HTTP with an authenticated, network-isolated RabbitMQ job bus resolves the audit's #1 finding and its missing-queue reliability finding (§5.5) in one architectural change.

```
Browser
   ↓ JWT/cookie
API Gateway (:3000)
   ↓
AI Orchestrator (:3004)
   ↓ validated job message
RabbitMQ (:5672)
   ↓ consume
Python AI (:8000, internal network only)
   ↓ result event
RabbitMQ
   ↓
AI Orchestrator
   ↓
Node services
```

---

#### AI-COM-01 — RabbitMQ Infrastructure

**User Story:**
As a Platform Engineer, I want RabbitMQ provisioned in the Docker Compose stack with credentials, vhost, persistent storage and a health check so that AI jobs can be transported reliably.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Critical
**Estimated Hours:** 4
**Story Points:** 3
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- RabbitMQ container added to both `docker-compose.yml` and `docker-compose.prod.yml`
- Credentials supplied via environment variables (`RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`) with no weak in-file defaults
- A dedicated vhost (e.g., `mindflow`) configured for AI traffic
- Persistent volume mounted for queue data (`rabbitmq_data`)
- Container health check defined (`rabbitmq-diagnostics -q ping`) and wired into compose `depends_on`
- Management UI disabled on public exposure; only reachable inside the internal network
- Port `5672` bound to the internal Docker network only (not `0.0.0.0` on the host)

**Technical Notes:**
- Audit: §9.1/§9.2 Docker posture; §7.11 unauthenticated Redis/RabbitMQ risk
- Use the `rabbitmq:3-management` image only in dev; plain `rabbitmq:3` in prod
- Apply CPU/memory limits in prod compose (mirrors existing per-service limits)

---

#### AI-COM-02 — AI Message Contract

**User Story:**
As a Platform Engineer, I want a versioned AI job message envelope with idempotency, correlation and tracing fields so that every AI operation is uniquely identifiable end-to-end.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Define a canonical JSON envelope in the shared Node package (`shared/`) and as a Pydantic model in the Python service:

```json
{
  "messageId": "uuid",
  "correlationId": "uuid",
  "type": "study.plan.generate",
  "version": "1",
  "userId": "user-id",
  "requestId": "request-id",
  "timestamp": "2026-08-19T08:00:00Z",
  "payload": {}
}
```

- Field semantics enforced:
  - `messageId` → consumer idempotency (deduplication key)
  - `correlationId` → connects request → AI result
  - `type` → identifies the AI operation
  - `version` → future schema evolution
  - `userId` → AI knows whose operation this is (never taken from body)
  - `requestId` → distributed tracing
  - `timestamp` → observability / debugging
- Both Node and Python validate the envelope schema on publish and on consume
- Invalid messages are rejected before entering business logic
- Contract is documented in a shared markdown file referenced by both codebases

**Technical Notes:**
- Audit: §7.1 (AI API unauthenticated) — `userId` must come from the authenticated Node context, never from a client body
- This contract is the single synchronization point for the whole feature

---

#### AI-COM-03 — AI Result Contract

**User Story:**
As a Platform Engineer, I want a versioned AI result event envelope so that the orchestrator can correlate each result to its originating request and persist/return it correctly.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 2
**Day:** 1

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- Result envelope contains: `messageId` (echo), `correlationId`, `requestId`, `type`, `status` (`completed` | `failed`), `payload`, `error` (if failed), `timestamp`
- On failure, the result includes a sanitized error (no stack traces, no DB connection strings)
- Result contract is versioned identically to the request contract
- Both Node and Python validate the result envelope schema
- Definition of "terminal" vs "retryable" failure is encoded (see AI-COM-06)

**Technical Notes:**
- Audit: §7.5 error leakage via `str(e)` in Python routers and `proxyBuilder.js`
- The result contract allows the Node orchestrator to persist job state (AI-COM-07)

---

#### AI-COM-04 — Node RabbitMQ Publisher

**User Story:**
As an AI Orchestrator developer, I want a shared Node publisher that validates and publishes AI job messages and consumes result events so that services publish consistent, traceable jobs.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 4
**Story Points:** 3
**Day:** 2

**Dependencies:** AI-COM-01, AI-COM-02

**Acceptance Criteria:**
- Shared publisher module (`shared/ai-messaging/`) with a single `publishAiJob(type, userId, payload)` API
- Publisher enforces the AI-COM-02 envelope schema before publishing
- Connection lifecycle managed: reconnect with exponential backoff, heartbeat
- Publisher is injected into `ai-orchestrator-service`; no direct HTTP calls to the Python AI service remain for new jobs
- `correlationId`/`requestId` generated or propagated from the incoming HTTP request
- Publish failure does not silently drop the job: returns a recoverable error to the caller
- One unit test proving a valid job is published and an invalid envelope is rejected

**Technical Notes:**
- Audit: §5.3 duplicate `buildInternalHeaders`/proxy patterns to be replaced by messaging
- Reuses the AI-COM-02 contract as the single source of truth

---

#### AI-COM-05 — Python RabbitMQ Consumer Framework

**User Story:**
As an AI engineer, I want a shared `BaseAIWorker` consumer framework in Python so that all five AI agents reuse one connection, validation and ACK/NACK pipeline instead of five independent consumers.

**Domain:** AI
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** AI-COM-01, AI-COM-02

**Acceptance Criteria:**
- `BaseAIWorker` provides: connect, declare exchange/queues, consume, validate envelope, dispatch to handler, ACK/NACK, graceful shutdown
- Concrete workers inherit it:

```
BaseAIWorker
   ├── PlannerWorker
   ├── CoachWorker
   ├── EvaluatorWorker
   ├── SearchWorker
   └── IngestionWorker
```

- Envelope validated against the AI-COM-02 Pydantic schema before dispatch
- Message ACKed only after successful processing; NACKed with `requeue=false` for retryable failures (per AI-COM-06)
- Duplicate `messageId` rejected via idempotency store (AI-COM-08)
- Worker prefetch limit configured (e.g., prefetch=1 per queue) to bound memory
- Graceful shutdown drains in-flight messages on SIGTERM
- One integration test: consuming a fixture message runs the correct handler

**Technical Notes:**
- Audit: §5.2/§5.5 three different LLM clients and 8+ `DatabaseService()` instantiations — the framework should own the single shared DB client
- Audit: §8.3 blocking Python event loop — handlers run LLM/ML work off the main loop (see SP08 refactor, kept out of this sprint's scope)

---

#### AI-COM-06 — Retry / Dead-Letter Queue

**User Story:**
As a Platform Engineer, I want automatic retry with exponential backoff and dead-letter queues so that transient AI failures recover without losing jobs.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 3

**Dependencies:** AI-COM-05

**Acceptance Criteria:**
- Retry policy defined: max retry count (e.g., 3), exponential backoff (e.g., 1s → 4s → 16s)
- Retry queues configured per AI operation with per-message TTL
- Dead-letter exchange and per-operation DLQ configured (`ai.dlx`, `ai.<op>.dlq`)
- Messages exceeding max retries land in the DLQ with the failure reason attached
- DLQ consumers can replay messages (with a manual tool or admin endpoint)
- Retryable vs terminal failure classification implemented (network/timeout → retry; schema/validation → DLQ immediately)
- RabbitMQ queue monitoring endpoint exposes per-queue depth and DLQ depth

**Technical Notes:**
- Audit: §5.5 fire-and-forget persistence — this is the reliability backbone
- Uses the durable topology from AI-COM-01; TTL applies only to retry queues

---

#### AI-COM-07 — AI Job Persistence

**User Story:**
As an AI Orchestrator developer, I want AI jobs persisted with an explicit state machine so that the API can return job status and results can be retrieved after the fact.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2–3

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- New `AiJob` model (study-service or shared) with fields: `jobId`, `type`, `userId`, `requestId`, `correlationId`, `status`, `result`, `error`, `attempts`, `createdAt`, `updatedAt`
- States: `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED`, plus `RETRYING`
- State transitions enforced (invalid transitions rejected)
- Job creation returns `202 Accepted` with the `jobId` immediately
- Result correlation: when a result event arrives, the job is updated via `correlationId`
- Jobs are queryable by user: `GET /api/v1/ai/jobs/{jobId}` and `GET /api/v1/ai/jobs?userId=...`
- Indexes on `jobId`, `userId + createdAt`, `correlationId`
- TTL/cleanup policy for completed jobs defined (e.g., 30 days)

**Technical Notes:**
- Audit: §5.5 queue absence; §8.1 no caching/hot-read issues — this model also enables polling UIs (PLAN-09)
- Replaces the current synchronous proxy contract of `ai-orchestrator-service`

---

#### AI-COM-08 — Idempotency

**User Story:**
As a Platform Engineer, I want duplicate AI messages processed exactly once so that retries and client retransmissions never double-pay LLM calls or duplicate side effects.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** AI-COM-05, AI-COM-07

**Acceptance Criteria:**
- Consumer deduplicates by `messageId` (Redis SETNX or MongoDB unique index + state check)
- A duplicate message is ACKed without re-running the handler
- Idempotency keys are stored with TTL (e.g., 24h) to bound store growth
- Side effects triggered by a job (XP awards, plan saves, notification) are also idempotent (see GAME-06)
- Test: publishing the same message twice runs the handler once

**Technical Notes:**
- Audit: §8.3 fire-and-forget XP/streak side effects — the idempotency pattern here becomes the template for GAME-06

---

#### AI-COM-09 — AI Network Isolation

**User Story:**
As a Security Engineer, I want the Python AI service reachable only from inside the internal Docker network so that it cannot be reached from the browser or the public internet.

**Domain:** Infrastructure
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** AI-COM-01

**Acceptance Criteria:**
- Python AI container publishes no host ports in `docker-compose.yml` / `docker-compose.prod.yml`
- Service is reachable only via the internal `study-partner-network`
- Nginx does not proxy any `/ai` path to the Python service
- No CORS configuration exposes AI endpoints to browser origins
- Network-level rule verified by an integration/security test that an external request cannot reach `:8000`
- Documentation updated: `❌ Internet → Python AI`, `❌ Browser → Python AI`, `✅ Node → RabbitMQ → Python AI`

**Technical Notes:**
- Audit: §7.1 (Critical — no auth on Python AI API). Network isolation is the architectural fix; a defensive `INTERNAL_API_SECRET` check may remain on the (now unused) HTTP entrypoint until it is removed
- Keep the FastAPI app alive only for the RabbitMQ consumer bootstrap and health checks

---

#### AI-COM-10 — Communication Integration Test

**User Story:**
As a QA Engineer, I want one end-to-end test where a real AI job travels Node → RabbitMQ → Python AI → RabbitMQ → Node so that the foundation is proven before any feature migration begins.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 4
**Story Points:** 3
**Day:** 5

**Dependencies:** AI-COM-04, AI-COM-05, AI-COM-07

**Acceptance Criteria:**
- Test publishes a fixture job (`study.plan.generate`) via the Node publisher
- Asserts the Python worker consumes and executes (with mocked LLM)
- Asserts the result event is published and the orchestrator updates the `AiJob` to `COMPLETED`
- Asserts `correlationId`/`requestId` are consistent across the whole round trip
- Asserts a deliberately NACKed message ends in the DLQ after max retries
- Test runs in CI against a real RabbitMQ service container
- **Feature Definition of Done:** `Node → RabbitMQ → Python AI → RabbitMQ → Node` works with a real AI request

**Technical Notes:**
- Audit: §10.2 no real end-to-end test exists anywhere
- This is the vertical-slice gate: do not start F02–F05 migration until it passes

---

## 3. F02 — AI Planner (PLAN)

### Epic: As a User, I want to generate personalized study plans through the new RabbitMQ job pipeline so that plan generation is asynchronous, secure against prompt injection and reliably persisted.

**Priority:** Critical
**Sprint:** 1–2
**Owners:** Dev A (orchestrator/API) + Dev B (planner agent) + Dev C (frontend/QA)

The planner currently interpolates user-controlled `goal`/`concepts` directly into an LLM prompt (`llm_decomposer_real.py:30–45`) and has a `SimpleGoalDecomposer` fallback. This feature migrates it onto the job bus and hardens it.

```
User
 ↓
Study Service
 ↓
AI Orchestrator
 ↓
RabbitMQ
 ↓
Planner Worker
 ↓
LLM
 ↓
Validation
 ↓
RabbitMQ
 ↓
AI Orchestrator
 ↓
Study Service
```

---

#### PLAN-01 — Planner RabbitMQ Consumer

   **User Story:**
   As an AI engineer, I want the planner to consume `study.plan.generate` jobs through `PlannerWorker` so that plan generation runs inside the job bus.

   **Domain:** AI
   **Type:** Feature
   **Priority:** Critical
   **Estimated Hours:** 3
   **Story Points:** 3
   **Day:** 1

   **Dependencies:** AI-COM-05

   **Acceptance Criteria:**
   - `PlannerWorker` extends `BaseAIWorker`
   - Handler invoked with validated envelope payload
   - ACK on success, NACK per AI-COM-06 policy on failure
   - Existing `PlannerAgent` invoked from the worker with the payload
   - No direct HTTP exposure for planning remains

   ---

#### PLAN-02 — Planner Input Schema

**User Story:**
As a Backend engineer, I want the planner request payload validated by a strict schema (with length limits) so that malformed or oversized input never reaches the LLM.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- Pydantic `PlannerRequest` model defines: `goal` (1–500 chars), `concepts` (list of 0–50, each ≤ 100 chars), optional `courseId`, optional `deadline`
- Schema mirrored in the Node envelope payload validation
- Over-length or malformed payloads rejected at the orchestrator before publish
- `userId` taken only from the authenticated context, never from the payload

**Technical Notes:**
- Audit: §7.2 prompt injection (planner), §2.4 AI service input validation gaps

---

#### PLAN-03 — Planner Prompt Isolation

**User Story:**
As an AI engineer, I want user content isolated from instructions in the planner prompt so that prompt injection is neutralized.

**Domain:** AI
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 1–2

**Dependencies:** PLAN-01

**Acceptance Criteria:**
- User-provided `goal`/`concepts` wrapped in unambiguous delimiters and marked as untrusted data
- System instructions separated from user content (role separation)
- Instruction-override phrasing ("ignore previous instructions", etc.) treated as data, not commands
- No executable instructions derived from LLM output
- Prompt hardened against the audit attack surface in `llm_decomposer_real.py:30–45`

**Technical Notes:**
- Audit: §7.2 — highest-risk LLM path besides search
- Reusable hardening approach shared with COACH-03/EVAL-03/SEARCH-03 (extract to a shared `prompt_guard` util)

---

#### PLAN-04 — Planner Output Schema

**User Story:**
As an AI engineer, I want the planner LLM output parsed into a strict, typed schema so that downstream code never trusts free-form LLM text.

**Domain:** AI
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** PLAN-01

**Acceptance Criteria:**
- Pydantic `PlannerOutput` schema: tasks with `title`, `description`, `duration_minutes`, `order`, optional `topicId`
- Tasks MAY carry optional `objectiveId` + `targetBloomLevel` (F14 BLOOM-10): when competency data is available, generated plans target specific learning objectives
- Output parsing via structured extraction (JSON with schema validation)
- Parsing failures produce a sanitized validation error for the job result

---

#### PLAN-05 — Planner Output Validation

**User Story:**
As an AI engineer, I want planner outputs validated (required fields, ranges, evidence) before persistence so that hallucinated or malformed plans are rejected.

**Domain:** AI
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** PLAN-04

**Acceptance Criteria:**
- Reject outputs with missing required fields, durations ≤ 0 or > 480 minutes, empty task lists
- Confidence/evidence check: every task must trace to an input concept or course content
- One retry with a "please follow the schema" correction prompt; then FAILED with sanitized reason
- Rejected outputs logged with full LLM response for debugging (no user data beyond job context)

**Technical Notes:**
- Audit: §7.2; mirrors HDIE-09 validation pipeline pattern from the reference backlog

---

#### PLAN-06 — Planner Retry / Fallback

**User Story:**
As an AI engineer, I want planner failures to retry with backoff and fall back to the deterministic decomposer so that users still get a plan during LLM outages.

**Domain:** AI
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** AI-COM-06

**Acceptance Criteria:**
- LLM timeout/quota failures flow through the retry/DLQ policy (AI-COM-06)
- After retries, fall back to `SimpleGoalDecomposer` and mark the job `COMPLETED` with `fallbackUsed: true`
- Fallback result still passes PLAN-05 validation
- User-facing result includes a note that a simpler decomposition was used

---

#### PLAN-07 — Planner Result Persistence

**User Story:**
As a Backend engineer, I want completed plan results persisted to the study database so that the API and frontend can retrieve them.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** AI-COM-07

**Acceptance Criteria:**
- On `COMPLETED`, the orchestrator saves the validated plan to the `Plan` collection
- Duplicate correlation (`messageId`/`correlationId`) cannot create duplicate plans
- Job status updated to `COMPLETED` with result reference
- Failure path leaves no partial plan documents

---

#### PLAN-08 — Planner API Integration

**User Story:**
As a Backend engineer, I want the plan-generation API to create a job and expose its status so that the frontend can poll or subscribe.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** PLAN-07

**Acceptance Criteria:**
- `POST /api/v1/plans/generate` returns `202 { jobId }` (no synchronous LLM wait)
- `GET /api/v1/plans/jobs/{jobId}` returns status + result when ready
- Existing synchronous plan route either removed or routed through the job path
- 401/403 preserved through the orchestrator (auth stays at gateway/service layer)

---

#### PLAN-09 — Planner Frontend Async State

**User Story:**
As a User, I want the plan-generation UI to show job progress (pending/processing/completed/failed) with retry so that I understand and can recover from async generation.

**Domain:** Frontend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** PLAN-08

**Acceptance Criteria:**
- `StudyPlanner` page triggers job creation and polls `GET /api/v1/plans/jobs/{jobId}`
- Loading, progress, completed, and failed states rendered (with the shared skeleton/empty-state components from UX-07)
- Failed jobs show a "Retry" action that creates a new job
- No hard refresh required to see the result

---

#### PLAN-10 — Planner E2E Tests

**User Story:**
As a QA Engineer, I want an end-to-end test covering plan generation through the real job bus so that the planner feature is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** PLAN-08

**Acceptance Criteria:**
- Playwright test: authenticated user → create plan → job completes (LLM mocked) → plan visible in UI
- Runs against the real API + RabbitMQ with only external LLM mocked
- Negative test: invalid input shows validation error without creating a job

---

#### PLAN-11 — Prompt-Injection Tests

**User Story:**
As a Security Engineer, I want regression tests that malicious planner inputs are treated as data so that prompt-injection fixes stay fixed.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** PLAN-05

**Acceptance Criteria:**
- Test suite covering: instruction-override attempts, goal containing "ignore previous instructions", concept containing script/command payloads, extremely long inputs
- All tests assert the planner output schema/behavior is unaffected by the injection payloads
- Tests run in Python pytest against the planner with mocked LLM responses

---

## 4. F03 — AI Coach (COACH)

### Epic: As a User, I want real-time coaching nudges delivered through the job bus with hardened prompts so that coaching is reliable and cannot be manipulated by user input.

**Priority:** High
**Sprint:** 2
**Owners:** Dev A (API) + Dev B (coach agent) + Dev C (QA)

The coach currently embeds the full `CoachInput` dump into the Gemini prompt (`llm_decider.py:218–224`) and uses a separate LLM client from the other agents.

**Scope (Sprint 2):** reliable, hardened nudge delivery through the job bus.
**Expansion (Sprint 3+):** the coach grows into an active learning companion —
it watches live session stats, knows which courses and subjects the user
studies, reads emotional state from ML models, and can trigger the reschedule
agent to change the plan when a nudge is not enough.

---

#### COACH-01 — Coach RabbitMQ Consumer

**User Story:**
As an AI engineer, I want the coach to consume `study.coach.nudge` jobs through `CoachWorker` so that coaching runs inside the job bus.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** AI-COM-05

**Acceptance Criteria:**
- `CoachWorker` extends `BaseAIWorker`
- Handler invoked with validated envelope
- ACK/NACK per policy
- No direct HTTP exposure for coaching remains

---

#### COACH-02 — Coach Input Schema

**User Story:**
As a Backend engineer, I want the coach request payload validated with limits so that unbounded context never reaches the LLM.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- `CoachRequest` schema: `sessionId`, recent signals (bounded array), recent messages (bounded array, each ≤ 2000 chars), focus state
- Total payload size capped (e.g., ≤ 16 KB)
- `userId` from authenticated context only
- Malformed payloads rejected at the orchestrator

---

#### COACH-03 — Prompt Isolation

**User Story:**
As an AI engineer, I want user chat content isolated from coach instructions so that a student cannot inject instructions through chat messages.

**Domain:** AI
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** COACH-01

**Acceptance Criteria:**
- All user-generated text in the prompt wrapped in untrusted delimiters
- System prompt separated from user content
- Instruction-override payloads treated as data
- Reuses the shared `prompt_guard` utility from PLAN-03
- Audit finding at `llm_decider.py:218–224` (full `CoachInput` dump) eliminated

---

#### COACH-04 — Context Filtering

**User Story:**
As an AI engineer, I want only relevant, recent context sent to the LLM so that coaching is cheaper, faster and less exposed to stale content.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** COACH-03

**Acceptance Criteria:**
- Context windowing: last N messages / last M minutes only
- Redundant signal data downsampled
- PII (names, emails) excluded from the prompt
- Configurable window sizes via env/config

---

#### COACH-05 — Output Schema

**User Story:**
As an AI engineer, I want coach LLM output parsed into a strict schema so that the UI never trusts free-form text.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** COACH-01

**Acceptance Criteria:**
- `CoachOutput` schema: `nudge_text` (1–500 chars), `intensity` (0.0–1.0), `category` (enum: motivation, focus, fatigue, break)
- Structured extraction + schema validation
- Parsing failures → sanitized error in job result

---

#### COACH-06 — Output Validation

**User Story:**
As an AI engineer, I want coach outputs validated and sanitized so that inappropriate or malformed nudges never reach the user.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** COACH-05

**Acceptance Criteria:**
- Reject outputs missing required fields or with out-of-range intensity
- Content policy check: no self-harm, harassment, or unsafe content (list-based filter + LLM guard as fallback)
- One correction retry, then FAILED with sanitized reason
- Sanitized output rendered as plain text in the frontend (no HTML)

---

#### COACH-07 — Unified LLM Client

**User Story:**
As an AI engineer, I want the coach to use the shared LLM client so that one client, one retry policy, one key handling exists across agents.

**Domain:** AI
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** COACH-01

**Acceptance Criteria:**
- Extract shared `llm_client.py` (interface + Gemini implementation + mock)
- Coach's `llm_decider.py` uses it (replaces its `google-generativeai` SDK usage)
- Retry/fallback consistent with other agents
- Audit finding §5.2 (three different LLM clients) reduced by one

---

#### S-MIG-01 — LiteLLM migration sprint (fixing-errors sprint) ✅ done

**User Story:**
As an AI engineer, I want the remaining agents moved onto the shared LiteLLM client (`utils/llm_client.py`, config in `litellm/config.yaml`) so that one client, one retry policy and one key-handling path exist end-to-end — per agent model routing (COACH-07) applied everywhere.

**Domain:** AI
**Type:** Sprint (cleanup / fixing-errors)
**Priority:** Medium
**Estimated Hours:** 6
**Story Points:** 5
**Day:** 4
**Status:** DONE (2026-08-29, branch `s-mig-01`)

**Dependencies:** COACH-07

**Acceptance Criteria:**
- [x] Planner decomposer (`agents/planner/decomposition/llm_decomposer_real.py`) targets `ask("planner", ...)`
- [x] Search (`agents/search/llm/llm.py`) targets `ask("search", ...)`
- [x] Reflection (`agents/reflection/src/reflection/services/reflection_service.py`) targets `ask("reflection", ...)`
- [x] Course ingestion enricher + task generator target `ask("course_ingestion", ...)`
- [x] Evaluator (`agents/evaluator/src/evaluator/llm_client.py`) targets `ask("evaluator", ...)` (retires its local `GeminiClient`/`QwenClient`)
- [x] `google.generativeai` SDK usage fully removed; LM-Studio REST call sites routed through LiteLLM or retired
- [x] Each agent's mock/fallback responder preserved via `mock_fn` when no provider key is configured
- [x] Audit finding §5.2 (three different LLM clients) fully resolved

---

#### COACH-08 — Retry / Fallback ✅ done

**User Story:**
As a Platform Engineer, I want coach failures retried with the shared policy and a rule-engine fallback so that coaching still works during LLM outages.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4
**Status:** DONE (2026-08-30, branches `coach-08` — incl. PLAN-06 planner parity)

**Dependencies:** AI-COM-06

**Acceptance Criteria:**
- [x] Timeout/quota failures flow through retry/DLQ policy
- [x] After retries, fall back to the existing rule engine
- [x] Fallback nudge passes COACH-05/06 validation
- [x] Job marked `COMPLETED` with `fallbackUsed: true`

---

#### COACH-09 — Result Persistence ✅ done

**User Story:**
As a Backend engineer, I want coach results persisted to the coach-history store so that history and declining-trend detection keep working.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4
**Status:** DONE (2026-08-30, branch `coach-09`)

**Dependencies:** AI-COM-07

**Acceptance Criteria:**
- [x] Nudge persisted to coach history collection on job completion
- [x] Idempotent by `correlationId` (no duplicate history entries)
- [x] Failure path leaves no partial history records

---

#### COACH-10 — Coach API Integration

**User Story:**
As a Backend engineer, I want the coaching API to create jobs and return their status so that the frontend can display nudges asynchronously.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4–5
✅ done

**Status:** DONE (2026-08-30, branch `coach-10`)

**Dependencies:** COACH-09

**Acceptance Criteria:**
- [x] `POST /api/v1/coach/nudge` returns `202 { jobId }`
- [x] `GET /api/v1/coach/jobs/{jobId}` returns status + nudge
- [x] Session-scoped: nudges tied to the active `sessionId` of the authenticated user

---

#### COACH-11 — Coach E2E Tests ✅ done

**User Story:**
As a QA Engineer, I want an end-to-end coach test so that the coaching loop is proven through the job bus.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Status:** DONE (2026-08-31, branches `coach-11` [api/ai/web] — real-bus round-trip + popup E2E)

**Dependencies:** COACH-10

**Acceptance Criteria:**
- [x] Playwright: user in active session → nudge requested → job completes (LLM mocked) → nudge rendered in the coach popup
- [x] Backend round-trip proven on the real job bus (real `CoachWorker`, `LLM_MOCK=1`)
- [x] Negative: unauthenticated nudge request rejected

---

#### COACH-12 — Prompt-Injection Tests ✅ done

**User Story:**
As a Security Engineer, I want coach-specific prompt-injection regression tests so that chat-input injection stays fixed.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Status:** DONE (2026-08-31, branch `coach-12`)

**Dependencies:** COACH-06

**Acceptance Criteria:**
- [x] Injection payloads embedded in chat messages and signal context tested
- [x] Assert nudge category/intensity unaffected by injected instructions
- [x] Runs in pytest with mocked LLM

---

### Coach expansion beyond nudges (Sprint 3)

Building on the nudge pipeline (COACH-01–12), the coach becomes an active
learning companion. New capabilities, implemented feature by feature after the
nudge path is live:

1. **Session stats** — coach sees live session statistics (progress, time on
   task, recent completions, streak) so nudges reflect actual behaviour.
2. **Course & subject awareness** — coach knows which courses and subjects the
   user studies, so nudges reference the correct domain and vocabulary.
3. **Emotion detection** — an ML emotion adapter feeds the student's emotional
   state (frustration, stress, boredom, …) into the coach instead of a
   hardcoded default.
4. **Reschedule agent** — when a nudge is not enough, the coach triggers the
   reschedule agent to change the plan inside the job bus.

---

#### COACH-13 — Session Stats Feed ✅ done

**User Story:**
As an AI engineer, I want the coach to receive live session statistics (progress, time on task, recent completions, streak) so that nudges are grounded in the student's actual in-session behaviour.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Status:** DONE (2026-08-31, branch `coach-13`)

**Dependencies:** COACH-01

**Acceptance Criteria:**
- [x] `SessionStats` schema: `progress_pct` (0–100), `minutes_elapsed` (0–600), `task_switches` (0–50), `break_count` (0–20), `current_streak_days` (0–365)
- [x] Stats feed supplied in the `study.coach.nudge` payload from the active session
- [x] `CoachInput` extended with session stats; missing or stale stats default, never fail the job
- [x] Stats bounded so the payload stays within the 16 KB CoachRequest cap

---

#### COACH-14 — Course & Subject Awareness ✅ done

**User Story:**
As an AI engineer, I want the coach to know which courses and subjects the user studies so that nudges reference the correct domain, prerequisites and vocabulary.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** COACH-13

**Status:** DONE (2026-08-31, branch `coach-14`)

**Acceptance Criteria:**
- [x] Coach loads the user's enrolled courses and subjects from the course catalog (courses collection)
- [x] Current task mapped to its course/subject; the prompt references the subject context
- [x] Bounded context: subject title + key concepts per course, newest courses only (≤ 10)
- [x] No PII; catalog fetch failure degrades to task-title-only context

---

#### COACH-15 — Emotion Detection ML

**User Story:**
As an AI engineer, I want an ML emotion adapter that feeds the student's emotional state into the coach so that interventions adapt to frustration, stress or boredom instead of a hardcoded state.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** COACH-13

**Acceptance Criteria:**
- `EmotionAdapter` produces `affective_state` (engaged, frustrated, stressed, bored, confident) + confidence, mirroring the focus/fatigue adapters
- `CoachInput.affective_state` populated from signals, removing the hardcoded `engaged` constant in `services/ai_orchestrator/orchestrator.py`
- Confidence thresholding with recent-snapshot fallback, same policy as focus/fatigue
- Emotion snapshot persisted and included in the bounded CoachRequest signals

---

#### COACH-16 — Reschedule Agent Integration ✅ done

**User Story:**
As an AI engineer, I want the coach to trigger the reschedule agent when a nudge is insufficient so that plan changes are applied automatically inside the job bus.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** COACH-01

**Status:** DONE (2026-08-31, branches `coach-16` on `study-partner-ai` + `study-partner-api`)

**Acceptance Criteria:**
- [x] Coach result carrying `schedule_changes` publishes a schedule job (new `study.schedule.apply` type) consumed by the reschedule agent
- [x] ScheduleOrchestrator applies changes transactionally through the worker path, not direct HTTP
- [x] Idempotent by correlationId; every change logged in `schedule_history`
- [x] Reschedule failure returns `schedule_update.status = error` in the coach result, never silent

---

## 5. F04 — AI Evaluator (EVAL)

### Epic: As a User, I want Socratic evaluations to run through the job bus with evidence-grounded, schema-validated scoring so that mastery assessment is reliable and immune to prompt injection.

**Priority:** High
**Sprint:** 2
**Owners:** Dev A (API) + Dev B (evaluator agent) + Dev C (QA)

The evaluator currently passes raw `student_answer` into the analysis prompt (`evaluator_agent.py:414–421`) and keeps sessions in memory + Mongo.

---

#### EVAL-01 — Evaluator Worker ✅ done

**User Story:**
As an AI engineer, I want the evaluator to consume `study.eval.step` jobs through `EvaluatorWorker` so that evaluation steps run inside the job bus.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 1

**Dependencies:** AI-COM-05

**Acceptance Criteria:**
- [x] `EvaluatorWorker` extends `BaseAIWorker`
- [x] Multi-turn evaluation state machine retained (not simplified)
- [x] ACK/NACK per policy
- [x] No direct HTTP exposure for evaluation remains

---

#### EVAL-02 — Evaluation Input Contract ✅ done

**User Story:**
As a Backend engineer, I want evaluation requests carried by a strict contract so that session and step data are validated before reaching the agent.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** AI-COM-02, EVAL-01

**Acceptance Criteria:**
- [x] `EvaluationRequest` schema: camelCase wire fields `sessionId`, `step` (int ≥ 1), `studentAnswer` (1–5000 chars), `contextId`; `extra="forbid"`; validated in `EvaluatorWorker` (malformed → terminal)
- [ ] Objective targeting (`objectiveId` → bloomLevel + knowledgeType) — deferred to **EVAL-02b** (F14/BLOOM dependent)
- [x] Session state rehydration: the worker loads prior turns from the state store (in-memory sessions from `evaluator_agent.py` are not reliable across restarts)
- [x] `userId` from authenticated context only

---

#### EVAL-02b — Evaluation Objective Targeting

**User Story:**
As an AI engineer, I want evaluation requests to optionally target a learning objective so that a session's Bloom level and knowledge type shape the questions and scoring.

**Domain:** AI
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** (after F14)

**Dependencies:** EVAL-02, F14/BLOOM (learning objectives)

**Acceptance Criteria:**
- [x] `EvaluationRequest` carries optional `objectiveId`
- [x] When present, the objective's `bloomLevel` + `knowledgeType` (F14 model) are loaded server-side and carried as evaluation context
- [x] Session targets the objective's Bloom level for question depth and demonstrates the resulting level on mastery
- [x] `objectiveId`/`targetBloomLevel` join the persisted step result for BLOOM-08 competency updates

---

#### EVAL-03 — Prompt Hardening ✅ done

**User Story:**
As an AI engineer, I want student answers and context isolated in evaluation prompts so that students cannot inject scoring instructions.

**Domain:** AI
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** EVAL-01

**Acceptance Criteria:**
- [x] `student_answer` wrapped as untrusted data (audit finding at `evaluator_agent.py:414–421`)
- [x] Instructions about scoring/behavior separated from user content
- [x] "Give me 1.0" style injections treated as data
- [x] Reuses shared `prompt_guard` utility

---

#### EVAL-04 — Output Schema ✅ done

**User Story:**
As an AI engineer, I want evaluation scoring parsed into a strict schema so that scores are type-safe and bounded.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** EVAL-01

**Acceptance Criteria:**
- [x] `EvaluationOutput` schema: 5 dimension scores (concept coverage, logical coherence, causal reasoning, error awareness, specificity), each 0.0–1.0, plus `mastery_score`, `next_question`, `session_status`
- [x] Bloom fields (F14): `targetBloomLevel` (echoed from the objective) + `demonstratedBloomLevel` — the cognitive operation the answer actually shows; the two MAY differ
- [x] Structured extraction + validation
- [x] Out-of-range values rejected

---

#### EVAL-05 — Evidence Grounding ✅ done

**User Story:**
As an AI engineer, I want evaluator scoring to reference evidence from the student's answer so that scores are auditable and hallucination-resistant.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 3

**Dependencies:** EVAL-03

**Acceptance Criteria:**
- [x] Each dimension score includes an evidence quote (max 200 chars) from the answer
- [x] Evidence items structured as `{dimension, quote}` so they can be reused directly as competency `evidence[]` entries in the F14 profile store
- [x] Scores without evidence quotes are rejected at validation
- [x] Guessing detection retained and reported in the output
- [x] Mastery scoring formula retained with its smoothing guard (reused by BLOOM-07's estimator)

---

#### EVAL-06 — Validation / Rejection ✅ done

**User Story:**
As an AI engineer, I want malformed or ungrounded evaluation outputs rejected before persistence so that bad scores never reach the UI.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** EVAL-04

**Acceptance Criteria:**
- [x] Reject missing fields, out-of-range scores, missing evidence quotes, incoherent question
- [x] One correction retry, then FAILED with sanitized reason
- [x] Rejection logged with full LLM response for debugging

---

#### EVAL-07 — Retry / Fallback

**User Story:**
As a Platform Engineer, I want evaluation jobs retried per policy so that transient LLM failures don't lose a session step.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** AI-COM-06

**Acceptance Criteria:**
- [x] Timeout/quota failures → retry/DLQ policy
- [x] Session remains in the state store across retries (state machine must be retry-safe)
- [x] Idempotent by `messageId`: replaying a step does not double-count

> **✅ done (EVAL-07):** Implemented on `eval-07` (`dee6754`). Validate-then-mutate session state so a transient LLM failure surfaces as `RetryableError` before mutation; the AI-COM-06 worker policy retries/DLQs, and a retried step never double-counts attempts/answers. `GeminiClient.generate(raise_on_error=True)` propagates transient errors; non-transient failures keep the defensive local-scoring fallback. 12 tests in `tests/test_evaluator_retry.py`.

---

#### EVAL-08 — Result Persistence

**User Story:**
As a Backend engineer, I want evaluation results persisted per session step so that the API and frontend can resume sessions.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** AI-COM-07

**Acceptance Criteria:**
- [x] Each step's score + next question persisted to Mongo
- [x] `demonstratedBloomLevel` + `objectiveId` (when present) persisted per step — the raw feed for BLOOM-08 competency updates
- [x] **Future extension (KG-RAG-09):** evaluation results will also trigger student mastery updates in the knowledge graph (StudentMastery node)
- [x] Session state recoverable after service restart (removes the in-memory-only risk)
- [x] Idempotent by `correlationId`

> **✅ done (EVAL-08):** Cross-repo — the Python agents ONLY publish `ai.results` events (never write Mongo); the Node backend is the sole writer. `study-partner-ai/eval-08` (`569f31c`) enriched the published payload into a clean per-step record (`sessionId`, `step`, `demonstratedBloomLevel`, optional `objectiveId`); `study-partner-api/eval-08` (`ccb50f0`) added the `EvalResult` model (`eval_results`, unique `correlationId` upsert → idempotent, `sessionId`+`step` index for resume, `demonstratedBloomLevel` index for the BLOOM-08 feed) and wires `jobResultConsumer` to persist it. Session rehydration across restarts is carried by the `evaluation_output` + per-step history.

---

#### EVAL-09 — API Integration

**User Story:**
As a Backend engineer, I want the evaluation API to create jobs and return status so that the Socratic UI can poll for steps.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** EVAL-08

**Acceptance Criteria:**
- [x] `POST /api/v1/eval/step` returns `202 { jobId }`
- [x] `GET /api/v1/eval/jobs/{jobId}` returns status + step result
- [x] Frontend `SocraticEvaluation` component consumes the async API

✅ done — PRs awaited (study-partner-api `eval-09@b420bca`, study-partner-web `eval-09@b1ee95e`). Node: `routes/eval.js` POST `/api/v1/eval/step` (validate eval payload → `AiJob.createPending` → `publishAiJob('study.eval.step')` → 202 `{ jobId, status, correlationId, sessionId, step, poll }`; rolls back PENDING job on publish failure) + GET `/api/v1/eval/jobs/:jobId` (owner-scoped, eval-type only) mounted under `/api/v1/eval` with `authenticate` + AI rate limit on the step; 9 route tests (`eval-routes.test.js`). Web: `SocraticEvaluation` now polls the job API (`submitEvalStep`/`getEvalJob`) instead of legacy sync endpoints — client-generated `sessionId`, step increments per answer, `taskTitle` as `contextId`, CONTINUE walks `next_question`, mastery_confirmed/failed ends; 4 vitest tests.

---

#### EVAL-10 — E2E Tests

**User Story:**
As a QA Engineer, I want an end-to-end evaluation test so that the Socratic flow is proven through the job bus.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** EVAL-09

**Acceptance Criteria:**
- Playwright: user answers question → eval job completes (LLM mocked) → next question displayed → session completes with mastery score
- Negative: submitting an empty answer shows validation feedback

✅ done — PR awaited (study-partner-web `eval-10@606c699`, PR #4 → `AI-evaluator`). Playwright `e2e/eval-e2e.spec.js` (2 green tests) proves the async job flow at the API boundary (LLM mocked via `POST /api/v1/eval/step` → `GET /api/v1/eval/jobs/:jobId`), no backend/broker required: seed login (`auth-storage`) + seeded `sessionStore` into the full task view → MARK COMPLETE (mocked task-complete) opens the Socratic card → step 1 CONTINUE shows `next_question` (Q2) → step 2 `mastery_confirmed` 0.9 → "Evaluation Passed" + 90%. E2E surfaced two real bugs fixed in this story: `aliveRef` died under StrictMode double-mount (submits silently dropped) and the card unmounted on `onComplete` in the same batch so the mastery result never painted. `SocraticEvaluation` vitest: 7 passing incl. a StrictMode regression. eslint override disables testing-library `prefer-screen-queries` for `e2e/` (Playwright locators).

---

## 6. F05 — AI Search & Ingestion (SEARCH / INGEST)

### Epic: As a User, I want web search and course ingestion to run through secure, validated, asynchronous pipelines so that untrusted scraped content and uploaded files can never inject instructions or compromise the system.

**Priority:** High
**Sprint:** 2–3
**Owners:** Dev A (validation/API) + Dev B (agents) + Dev C (QA)

This feature is especially critical: the audit identifies **scraped web content entering LLM prompts** as the highest prompt-injection risk (§7.2), and file uploads without validation (§7.9).

---

### SEARCH Stories

#### SEARCH-01 — Search Worker

**User Story:**
As an AI engineer, I want search to run as a `study.search.query` job through `SearchWorker` so that web search is asynchronous and reliable.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 1

**Dependencies:** AI-COM-05

**Acceptance Criteria:**
- `SearchWorker` extends `BaseAIWorker`
- Handler performs retrieval (RAG + Apify crawl) + LLM extraction
- ACK/NACK per policy
- No direct HTTP exposure for search remains

---

#### SEARCH-02 — Query Validation

**User Story:**
As a Backend engineer, I want search queries validated with length limits so that abusive or malformed queries never reach the crawler.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- `SearchRequest` schema: `query` (1–500 chars), `max_results` (1–10), optional `voice_mode` bool
- Rate limiting on search job creation (e.g., 10/min per user)
- `userId` from authenticated context only

---

#### SEARCH-03 — Prompt Isolation (Scraped Content)

**User Story:**
As a Security Engineer, I want scraped web content fully isolated from search instructions so that malicious pages cannot hijack the model.

**Domain:** AI
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2

**Dependencies:** SEARCH-01

**Acceptance Criteria:**
- Scraped content truncated (≤ 2000 tokens) and wrapped in untrusted delimiters
- Crawler restricted to allow-listed domains; no redirects to internal/private IP ranges (SSRF guard)
- Content classified as "data, not instructions" in the prompt
- Audit finding at `search/agent.py:89–93` (web content into prompt) resolved
- Instruction-override payloads from pages treated as data

**Technical Notes:**
- Audit: §7.2 (Critical — scraped content), §7.10 (SSRF via Apify)
- Reuses `prompt_guard`; adds the `validate_url`/SSRF guard from the CI's SSRF tests

---

#### SEARCH-04 — Result Schema

**User Story:**
As an AI engineer, I want search results parsed into a strict schema so that the UI renders structured answers.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** SEARCH-01

**Acceptance Criteria:**
- `SearchOutput` schema: `answer` (≤ 2000 chars), `sources` (list of URLs + titles, ≤ 10), optional `voice_summary`
- Structured extraction + validation
- URLs validated (http/https only)

---

#### SEARCH-05 — Result Validation

**User Story:**
As an AI engineer, I want search outputs validated so that answers always cite sources and never contain injected content.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** SEARCH-04

**Acceptance Criteria:**
- Reject answers with no sources
- Reject outputs that echo injection payloads verbatim
- One correction retry, then FAILED with sanitized reason
- **Future extension (KG-RAG-11):** search will include course-material sources (from vector store) and knowledge graph subgraph results, tagged with source type

---

#### SEARCH-06 — Search Retry

**User Story:**
As a Platform Engineer, I want search failures retried per policy so that transient crawler/LLM failures recover.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** AI-COM-06

**Acceptance Criteria:**
- Crawler timeout / LLM failure → retry/DLQ policy
- Apify rate limits handled with backoff
- Result cached per query (Redis, TTL 1h) to reduce repeated crawls

---

#### SEARCH-07 — Search API Integration

**User Story:**
As a Backend engineer, I want the search API to create jobs and return results so that the AISearch page works asynchronously.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** SEARCH-05

**Acceptance Criteria:**
- `POST /api/v1/search/query` returns `202 { jobId }`
- `GET /api/v1/search/jobs/{jobId}` returns status + answer/sources
- Search history persisted per user (existing behavior retained)

---

#### SEARCH-08 — Search E2E

**User Story:**
As a QA Engineer, I want a search end-to-end test so that the full search path is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** SEARCH-07

**Acceptance Criteria:**
- Playwright: user submits query → job completes (crawler + LLM mocked) → answer + sources displayed
- Negative: empty query shows validation error

---

### INGEST Stories

#### INGEST-01 — File Validation

**User Story:**
As a Backend engineer, I want uploaded course files validated by extension, content type and magic bytes so that malicious files are rejected before processing.

**Domain:** Backend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** AI-COM-02

**Acceptance Criteria:**
- Allowed types: PDF (`application/pdf`), text (`.txt`, `.md`), and supported document types only
- MIME type checked AND magic-byte sniffed (content type alone is not trusted — audit `courses.js:29–44`)
- Reject files with mismatched extension vs content
- Reject scripts/executables disguised with document extensions
- Error returned as `422` with sanitized message

**Technical Notes:**
- Audit: §7.9 upload validation; Python `ingestion.py` currently accepts any file
- Reuses a shared `validate_upload` util in both Node (multer filter) and Python (ingestion worker)

---

#### INGEST-02 — File Size Limits

**User Story:**
As a Backend engineer, I want uploads size-limited (e.g., 25 MB) so that the server cannot be exhausted by large files.

**Domain:** Backend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** INGEST-01

**Acceptance Criteria:**
- Max upload enforced at the Node upload route and in the Python ingestion worker (belt and braces)
- Oversized files rejected with `413`
- Nginx `client_max_body_size` aligned with the limit

---

#### INGEST-03 — MIME Validation

**User Story:**
As a Backend engineer, I want upload endpoints to reject unexpected content types before parsing so that the parser is never handed non-document content.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** INGEST-01

**Acceptance Criteria:**
- Content-Type allowlist enforced at the gateway and upload route
- Unexpected types rejected with `415`
- Multipart form parsing hardened (field count/size limits)

---

#### INGEST-04 — Content / Magic-Byte Validation

**User Story:**
As a Security Engineer, I want PDF/text content signature-checked so that polyglot files are rejected.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2

**Dependencies:** INGEST-01

**Acceptance Criteria:**
- PDFs verified against `%PDF-` header + trailer
- Text files checked for printable-character ratio
- Encrypted/password-protected PDFs rejected with a clear message
- Parsing runs in a sandboxed/temp location with strict timeouts

---

#### INGEST-05 — RabbitMQ Ingestion Job

**User Story:**
As an AI engineer, I want uploads to trigger a `study.ingest.course` job so that ingestion runs asynchronously and cannot block the UI.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** AI-COM-05

**Acceptance Criteria:**
- Validated file triggers an ingestion job with a reference to the stored file
- Job envelope carries `userId`, `courseId`, `fileRef`, `messageId`
- Upload API returns `202 { jobId }` immediately

---

#### INGEST-06 — Background Worker

**User Story:**
As an AI engineer, I want the ingestion worker to perform OCR/parsing/embedding in the background so that long-running work never blocks other jobs.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 3

**Dependencies:** INGEST-05

**Acceptance Criteria:**
- `IngestionWorker` consumes `study.ingest.course` jobs
- Pipeline: parse → normalize → enrich (LLM) → **extract concepts + draft learning objectives (BLOOM-04)** → chunk → embed → deduplicate → store in vector store
- **Future extension (KG-RAG-02):** entity + relation extraction into Neo4j knowledge graph will be added as a parallel stage after enrich
- Progress events emitted (parsing/enriching/embedding) for INGEST-07
- Blocking work executed off the main event loop
- ACK only after full pipeline completes

---

#### INGEST-07 — Job Status

**User Story:**
As a User, I want ingestion progress shown (uploading → parsing → enriching → indexing → done) so that I can track course readiness.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** AI-COM-07

**Acceptance Criteria:**
- `GET /api/v1/courses/{courseId}/ingest-status` returns progress + status
- Course becomes "searchable/usable" only when `COMPLETED`
- Failure surfaces a sanitized reason + retry action

---

#### INGEST-08 — Retry / DLQ

**User Story:**
As a Platform Engineer, I want ingestion jobs retried with a sane policy so that transient OCR/LLM failures don't lose uploads.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** AI-COM-06

**Acceptance Criteria:**
- Retry policy with backoff (OCR/LLM failures retryable)
- Schema/file validation failures go straight to DLQ (not retried)
- Replay tool for DLQ messages
- No duplicate embedding on replay (idempotent by `messageId`)

---

#### INGEST-09 — AI Extraction

**User Story:**
As an AI engineer, I want LLM-based enrichment/task-generation hardened so that extracted content cannot inject instructions downstream.

**Domain:** AI
**Type:** Security
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 4–5

**Dependencies:** INGEST-06

**Acceptance Criteria:**
- Extracted document text treated as untrusted before any LLM enrichment
- Enrichment output schema-validated (topics, sections, generated tasks)
- Generated tasks validated against the planner/task schemas
- Injection payloads found in documents treated as data

---

#### INGEST-10 — Ingestion E2E

**User Story:**
As a QA Engineer, I want an ingestion end-to-end test so that upload → process → searchable is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** INGEST-07

**Acceptance Criteria:**
- Playwright: user uploads a fixture PDF → job completes (OCR/LLM mocked) → course becomes searchable → appears in planner/search
- Negative: uploading an executable file is rejected with `422`/`415`
- Negative: oversized file rejected with `413`

---

## 7. F06 — Authentication & Security (SEC)

### Epic: As a Platform, I want all P0/P1 authentication, token, injection and crash risks resolved so that the audit's critical security findings are closed.

**Priority:** Critical
**Sprint:** 2
**Owners:** Dev A (backend security) + Dev C (frontend + security tests); Dev B handles AI-specific security in F02–F05

---

#### SEC-01 — Secure OTP Generation

**User Story:**
As a Security Engineer, I want all OTP codes generated with a cryptographically secure RNG so that verification tokens cannot be predicted.

**Domain:** Backend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- `Math.random()` OTP at `auth/routes/auth.js:241` replaced with `crypto.randomInt(0, 1e6)` padded to 6 digits
- All OTP paths use the existing `generateOtp` util (`crypto.randomInt`)
- No other `Math.random()`-based security values remain (grep-verified)
- Unit test asserts OTP entropy source (no `Math.random`)

**Technical Notes:**
- Audit: §7.3 (Critical) — only `resend-verification` used the safe util

---

#### SEC-02 — OTP Lifecycle Audit

**User Story:**
As a Security Engineer, I want OTP expiry, attempts and resend limits audited so that brute force and replay are prevented.

**Domain:** Backend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** SEC-01

**Acceptance Criteria:**
- OTP TTL (10 min) enforced consistently across all flows
- Max verification attempts per OTP enforced (e.g., 5) then invalidated
- Resend throttling (existing 3/min rate limit) retained
- OTP invalidated on successful verification
- Rate limits verified by test (SEC regression in TEST-10)

---

#### SEC-03 — httpOnly Refresh Cookie

**User Story:**
As a Security Engineer, I want the refresh token delivered via an httpOnly, Secure, SameSite cookie so that it is unreachable by JavaScript.

**Domain:** Backend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Refresh token issued in a dedicated cookie (`HttpOnly; Secure; SameSite=Lax`; `Path=/api/v1/auth`)
- `X-Refresh-Token` header flow removed from the axios interceptor and backend
- Rotation + reuse-detection logic (SHA-256 hashed storage) retained
- Cookie `Secure` flag only in production (config-driven)
- Logout clears the cookie server-side

**Technical Notes:**
- Audit: §7.4 (High) — refresh token currently in JS-accessible header

---

#### SEC-04 — Remove JS Refresh-Token Storage

**User Story:**
As a Frontend engineer, I want no auth tokens stored in JavaScript-accessible state so that XSS cannot exfiltrate them.

**Domain:** Frontend
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** SEC-03

**Acceptance Criteria:**
- `authStore` no longer persists or reads any refresh token
- Axios interceptor relies on cookie auth only
- `localStorage`/`zustand persist` partialize excludes tokens (already excludes — verify after SEC-03)
- 401 → refresh → retry race-condition guard retained

---

#### SEC-05 — Centralize Internal Service Authentication

**User Story:**
As a Security Engineer, I want one shared internal-service authentication middleware so that service-to-service calls are consistent and cannot be silently unauthenticated.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Single `requireInternal` middleware in `shared/` replacing the 6+ copy-pasted `buildInternalHeaders`/`requireInternalOrAdmin` variants (audit §5.3)
- Middleware validates `x-internal-secret` against env or a valid admin JWT
- All internal-only endpoints use it
- Fail-fast at boot if `INTERNAL_API_SECRET` missing in non-dev

**Technical Notes:**
- Audit: §7.6 (Medium) — silent omission when secret unset

---

#### SEC-06 — Validate Internal Secrets (Fail-Fast)

**User Story:**
As a Security Engineer, I want the platform to refuse to start when required secrets are missing so that services never boot insecurely.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3

**Dependencies:** SEC-05

**Acceptance Criteria:**
- Boot-time validation for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `INTERNAL_API_SECRET`, Stripe keys (auth), RabbitMQ creds (new)
- Missing/weak secrets cause process exit with a clear error (matching the existing `auth/app.js` guard pattern)
- Compose `:?` required-variable syntax for prod (with INFRA-07)
- Python `deps.py` "fail-fast" comment matched by real behavior

---

#### SEC-07 — Monitoring Endpoint Protection

**User Story:**
As a Security Engineer, I want the monitoring/metrics endpoint restricted so that operational details are not public.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- `/api/v1/monitoring/metrics` (`auth/app.js:302–311`) accessible only to internal network / admin
- No error-rate or internals leaked publicly
- Health endpoints remain public (non-sensitive)

---

#### SEC-08 — Remove Sensitive Error Leakage

**User Story:**
As a Security Engineer, I want clients to never receive stack traces or internal error details so that reconnaissance is prevented.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- Python routers: no raw `str(e)` in HTTP 500 details (replace with generic + server-side log)
- Node `proxyBuilder.js:82–98`: upstream statuses sanitized (client sees generic 502/503, full error logged)
- `console.log` of full base64 avatar (`profile.js:181`) removed; log a hash/length instead
- Python `print()` with emoji/ internals replaced by structured logger (OPS-01)

---

#### SEC-09 — Fix Admin ReDoS

**User Story:**
As a Security Engineer, I want admin search queries treated as literal text so that crafted regexes cannot stall MongoDB.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- `admin.js:42–44` `$regex: query` input escaped (e.g., `RegExp.escape`) or replaced with a safe substring search
- Admin-only endpoint audit for any other unsanitized regex inputs
- Test: pathological regex input returns quickly and matches nothing harmful

**Technical Notes:**
- Audit: §7.7 (Medium)

---

#### SEC-10 — Mass-Assignment Protection

**User Story:**
As a Security Engineer, I want request bodies whitelisted per endpoint so that users cannot write protected fields.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3–4

**Dependencies:** None

**Acceptance Criteria:**
- Joi validation uses `stripUnknown: true` (or explicit allowlists) across study-service routes (audit §5.2-1: `tasks.js:103`, `challengeSessions.js:136`, `coreSessions.js:111`)
- `Object.assign(session, req.body)` / `Task.create({...req.body})` patterns replaced with explicit field mapping
- `userId`, `role`, `tier`, `isAdmin` never settable from the client
- Regression test: sending `{ role: "admin" }` has no effect

---

#### SEC-11 — Upload Security (Node side)

**User Story:**
As a Security Engineer, I want the Node upload routes hardened so that malicious files never reach storage or parsing.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4

**Dependencies:** SEC-10

**Acceptance Criteria:**
- Multer filter enforces allowlist + size cap (shared with INGEST-01/02)
- `fs.readFileSync` in request handler (`courses.js:135`) replaced with async streaming
- Uploaded files stored outside the app bundle, not executable
- Filenames sanitized (no path traversal)

---

#### SEC-12 — Security Regression Tests

**User Story:**
As a QA Engineer, I want security regression tests covering auth, authorization, uploads and OTP so that fixes stay fixed.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** SEC-01..SEC-11

**Acceptance Criteria:**
- Negative auth tests: missing/expired/invalid tokens rejected
- Authorization tests: user A cannot access user B's plans/sessions/chat
- Cross-user AI access tests (audit §7.1): no client can read another user's AI data
- Upload tests (shared with TEST-09), OTP tests (shared with TEST-10)
- All green in CI

---

## 8. F07 — Study & Session Reliability (STUDY)

### Epic: As a Platform, I want study/session operations to be crash-safe, query-efficient and validated so that core flows survive failures and scale.

**Priority:** High
**Sprint:** 3
**Owners:** Dev A (backend) + Dev C (tests/QA)

The audit identifies inconsistent async error handling, mass assignment, N+1 queries and blocking file I/O in study-service.

---

#### STUDY-01 — Standardize asyncHandler

**User Story:**
As a Backend engineer, I want every async route wrapped so that promise rejections are handled and the process never crashes.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- All async handlers wrapped in shared `asyncHandler` (audit §5.1: `tasks.js:38`, `topics.js:24`, `coreSessions.js:65`, `auth.js:210/281`)
- Consistent across all 7 services
- Lint rule prevents unwrapped async handlers

---

#### STUDY-02 — Process-Level Rejection Handling

**User Story:**
As a Platform Engineer, I want `unhandledRejection`/`uncaughtException` handlers so that transient errors log and restart cleanly instead of hanging.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** STUDY-01

**Acceptance Criteria:**
- Process-level handlers log a structured error and exit for supervisor restart
- Docker restart policy in place for all services
- No silent swallow (`except: pass` style) in Node handlers (audit §5.4)

---

#### STUDY-03 — Mass-Assignment Protection

**User Story:**
As a Backend engineer, I want study routes to whitelist fields so that clients cannot inject unwanted properties.

**Domain:** Backend
**Type:** Security
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1–2

**Dependencies:** None

**Acceptance Criteria:**
- Aligns with SEC-10; Joi `stripUnknown` applied in study-service
- `sessionTasks.js:174` session lookup additionally scoped to `userId` (authorization bug — any authenticated user could act on another user's active session)
- `teamSessions.js:48` course lookup scoped to user (audit §5.2-bug list)

---

#### STUDY-04 — Async File I/O

**User Story:**
As a Backend engineer, I want file reads/writes async so that the event loop is never blocked.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2

**Dependencies:** SEC-11

**Acceptance Criteria:**
- `fs.readFileSync` in request handlers replaced with `fs/promises` or streaming (audit §5.2-2, `courses.js:135`)
- No other synchronous FS/network calls remain in request paths

---

#### STUDY-05 — StudySession Indexes

**User Story:**
As a Database engineer, I want StudySession covered by the right indexes so that invite-code and session-list queries are fast.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Add `{ type: 1, inviteCode: 1, status: 1 }` index (audit §6.2)
- Keep existing `{ userId, completedAt }` index
- Indexes verified via `explain()` in test (PERF-08)

---

#### STUDY-06 — Task Indexes

**User Story:**
As a Database engineer, I want Task covered by study-plan indexes so that plan detail queries are fast.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Add `{ studyPlanId: 1, userId: 1 }` index (audit §6.2)
- Add `{ userId, status }` if used by list queries

---

#### STUDY-07 — Subject N+1 Elimination

**User Story:**
As a Backend engineer, I want subject lists to avoid per-subject count queries so that dashboard loads scale.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- `subjects.js:38–55` per-subject `Course.countDocuments` replaced with aggregation/`$lookup` or batch count (audit §6.3)
- Query count per request verified by a test/instrumentation (≤ 2 queries for a subject list)

---

#### STUDY-08 — Team-Session N+1 Elimination

**User Story:**
As a Backend engineer, I want team-session participant authorization batched so that session creation scales with team size.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- Per-participant sequential HTTP calls in `teamSessions.js:415–426` replaced with one batched internal request (or parallel with a concurrency cap)
- Authorization result identical to today's behavior

---

#### STUDY-09 — Friendship Query Optimization

**User Story:**
As a Backend engineer, I want friendship lists and counts optimized so that social endpoints scale.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- `friends.js:38–87` 3-sequential-query pattern reduced (batch/`$lookup`)
- `friends.js:554–576` `/count` avoids loading all friendships
- Add `{ requester, recipient, status }` compound index (PERF-03)

---

#### STUDY-10 — Study Integration Tests

**User Story:**
As a QA Engineer, I want integration tests for sessions/tasks/subjects so that reliability fixes are proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** STUDY-01..09

**Acceptance Criteria:**
- Tests cover: session start/complete, task CRUD, subject list (query-count check), team session creation (batched auth)
- Include cross-user negative tests (authorization)
- Use supertest + real Mongo (pattern of `gateway.integration.test.js`)

---

#### STUDY-11 — Session E2E

**User Story:**
As a QA Engineer, I want a session end-to-end test so that the core study loop is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** STUDY-10

**Acceptance Criteria:**
- Playwright: register → create subject → start study session → complete task → XP awarded (aligns with TEST-12 journey)
- Runs with real API (hybrid fixture, TEST-03)

---

## 9. F08 — Gamification & Async Events (GAME)

### Epic: As a Platform, I want XP, streaks, quests and season events published through the event bus with idempotent processing so that gamification side effects are never silently lost.

**Priority:** High
**Sprint:** 3
**Owners:** Dev A (events/contracts) + Dev B (consumers) + Dev C (QA)

The audit identifies fire-and-forget XP/streak/analytics calls with `console.warn` and no retry (§5.1/§8.3). This feature turns them into reliable events (using the RabbitMQ foundation from F01, or the same pattern for Node-internal events).

---

#### GAME-01 — Identify All Asynchronous Side Effects

**User Story:**
As a Backend engineer, I want a complete inventory of fire-and-forget side effects so that none are lost in migration.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Inventory of every `awardXp`-style `axios.post` call (audit §5.3: `tasks.js:122`, `courses.js:180/493`, `subjects.js:110`, `sessionTasks.js:244`, `teamSessions.js:513`, `gamificationService.js:372`)
- Inventory of streak updates, season snapshot triggers, notification sends, analytics events
- Each side effect categorized: publish to bus vs keep-in-process

---

#### GAME-02 — Define Event Contracts

**User Story:**
As a Backend engineer, I want versioned event contracts for gamification so that producers and consumers evolve independently.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1–2

**Dependencies:** AI-COM-02 (envelope pattern), GAME-01

**Acceptance Criteria:**
- Contracts: `gamify.xp.awarded`, `gamify.streak.updated`, `gamify.season.advanced`, `gamify.quest.completed`
- Each carries `messageId`, `userId`, `timestamp`, typed payload, `correlationId` to the source session/task
- Contracts documented + validated in Node producer and consumer

---

#### GAME-03 — Publish XP Events

**User Story:**
As a Backend engineer, I want XP awards published as durable events so that a crash mid-award cannot lose XP.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** GAME-02

**Acceptance Criteria:**
- All `awardXp` call sites publish an XP event instead of/in addition to the direct call
- Event published in the same transaction scope as the source action where possible (outbox pattern or after-commit)
- Publish failure logged and retried via bus policy

---

#### GAME-04 — Publish Streak Events

**User Story:**
As a Backend engineer, I want streak updates published as events so that streak logic is reliable and consistent.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** GAME-02

**Acceptance Criteria:**
- Streak check/update (`awardService.js` daily/UTC logic) event-driven
- Timezone handling documented and consistent (audit §5.2: `getTodayAwardedKp` vs `getUtcDayDiff`)
- Event idempotent: same day + same user processed once

---

#### GAME-05 — Publish Season Events

**User Story:**
As a Backend engineer, I want season advancement and knowledge-point events published so that seasonal ranking is reliable.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2–3

**Dependencies:** GAME-02

**Acceptance Criteria:**
- Season snapshot/advancement triggered via event
- `RankEventLedger` writes idempotent by `messageId`
- Daily KP cap enforced in the consumer (audit §5.2: `xp_amount` override vulnerability closed — internal callers cannot exceed caps)

---

#### GAME-06 — Idempotent Event Processing

**User Story:**
As a Backend engineer, I want gamification consumers to process each event exactly once so that replays don't double-award.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** GAME-03, GAME-04, GAME-05

**Acceptance Criteria:**
- Consumers deduplicate by `messageId` (Redis SETNX or unique index)
- Replayed event after ACK-loss produces no double XP/streak
- Test proves double-delivery → single award

---

#### GAME-07 — Retry / DLQ (Gamification)

**User Story:**
As a Platform Engineer, I want gamification events retried with DLQ so that transient failures don't lose XP.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3–4

**Dependencies:** GAME-06

**Acceptance Criteria:**
- Reuses AI-COM-06 retry/DLQ pattern for gamify events
- DLQ depth monitored (OPS-04)
- Replay tool available

---

#### GAME-08 — XP Regression Tests

**User Story:**
As a QA Engineer, I want XP event tests so that awards are correct and idempotent.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4

**Dependencies:** GAME-03

**Acceptance Criteria:**
- Tests: task completion awards correct XP; duplicate event → single award; difficulty multipliers consistent (audit §5.2: 3 duplicate multiplier maps unified first)

---

#### GAME-09 — Streak Regression Tests

**User Story:**
As a QA Engineer, I want streak tests covering timezone/day boundaries so that streaks don't silently break.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4

**Dependencies:** GAME-04

**Acceptance Criteria:**
- Tests: consecutive-day, gap-break, same-day-twice, UTC boundary cases

---

#### GAME-10 — Season Regression Tests

**User Story:**
As a QA Engineer, I want season/rank tests so that ranking math and caps are verified.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 5

**Dependencies:** GAME-05

**Acceptance Criteria:**
- Tests: KP cap enforcement, rank thresholds (numeric + alias), badge key fix regression (audit §5.5 `'use'` bug — also in TEST-14)
- `awardService.js` upper-bound `xp_amount` validation covered

---

## 10. F09 — Analytics & Performance (PERF)

### Epic: As a Platform, I want analytics and hot paths optimized with indexes, aggregation pipelines and caching so that the platform scales beyond the current bottlenecks.

**Priority:** Medium/High
**Sprint:** 3
**Owners:** Dev A (Mongo/Node) + Dev C (infra/QA)

---

#### PERF-01 — Analytics Indexes

**User Story:**
As a Database engineer, I want AnalyticsEvent indexed so that summary queries are fast.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Add `{ userId: 1, createdAt: 1 }` index on `AnalyticsEvent` (audit §6.2)
- Add event-type index if used in filters

---

#### PERF-02 — Rank Indexes

**User Story:**
As a Database engineer, I want rank/season collections indexed so that leaderboards and snapshots scale.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- `RankSeason` indexed on `{ userId, seasonId }`
- `RankEventLedger` indexed on `{ userId, seasonId }` and `{ userId, createdAt }`
- `SeasonResultSnapshot` indexed on `{ seasonId, rank }`

---

#### PERF-03 — Friendship Indexes

**User Story:**
As a Database engineer, I want Friendship compound-indexed for the frequent `$or` queries.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Add `{ requester: 1, recipient: 1, status: 1 }` index (audit §6.2)
- Verify `friends.js` queries use it via `explain()`

---

#### PERF-04 — Study Indexes

**User Story:**
As a Database engineer, I want remaining study-service hot queries indexed (complements STUDY-05/06).

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1–2

**Dependencies:** STUDY-05, STUDY-06

**Acceptance Criteria:**
- Any remaining hot queries identified via slow-query log get an index
- Index catalog documented per collection

---

#### PERF-05 — Mongo Aggregation Pipelines

**User Story:**
As a Backend engineer, I want summary/stat computations moved to MongoDB aggregation so that they no longer load collections into memory.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** PERF-01

**Acceptance Criteria:**
- Analytics summary uses `$match → $group/$bucket` pipeline (audit §6.3: `analytics.js:106`)
- Focus session stats use aggregation (audit §6.3: `focus.js:233`)
- No endpoint loads an unbounded collection into memory
- Response shape unchanged for the frontend

---

#### PERF-06 — Focus Aggregation

**User Story:**
As a Backend engineer, I want focus-session statistics aggregated server-side so that the signal dashboard scales.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2–3

**Dependencies:** PERF-05

**Acceptance Criteria:**
- Focus stats (averages, trends) computed via aggregation pipeline
- Query plan verified (index + pipeline), no collection scan

---

#### PERF-07 — Analytics Aggregation

**User Story:**
As a Backend engineer, I want event analytics aggregated server-side so that activity timelines scale.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2–3

**Dependencies:** PERF-05

**Acceptance Criteria:**
- Activity timeline + insights computed via aggregation
- Pagination/cursor on timeline queries (audit §4: no pagination on leaderboard/tasks/chat)

---

#### PERF-08 — Query Explain Checks

**User Story:**
As a Database engineer, I want CI to run `explain()` on critical queries so that index regressions are caught.

**Domain:** Backend
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3

**Dependencies:** PERF-01..07

**Acceptance Criteria:**
- A test/script executes `explain()` on the top 10 hot queries and asserts `COLLSCAN` absence
- Runs in CI (backend pipeline)

---

#### PERF-09 — Redis Authentication

**User Story:**
As a Security Engineer, I want Redis protected with a password so that cache cannot be poisoned or data leaked.

**Domain:** Infrastructure
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- `requirepass` configured in dev and prod
- `REDIS_PASSWORD` required in prod compose
- No weak default password (audit §7.11)
- Services authenticate via env-provided password

---

#### PERF-10 — Redis Hot-Data Caching

**User Story:**
As a Backend engineer, I want hot reads (profiles, leaderboards, badges) cached in Redis so that repeated loads are cheap.

**Domain:** Backend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** PERF-09

**Acceptance Criteria:**
- Leaderboard snapshot cached (TTL 1 min)
- Frequently read profiles cached (TTL 5 min, invalidated on profile update)
- Rank/badge data cached (TTL 1h)
- Cache invalidation on write verified by test

---

#### PERF-11 — Move Images to Object Storage

**User Story:**
As a Backend engineer, I want profile/subject images stored in object storage (S3/MinIO/R2) instead of base64 in MongoDB so that documents stay small and queries fast.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 4–5

**Dependencies:** None

**Acceptance Criteria:**
- Images uploaded to object storage; DB stores only the URL/reference (audit §5.2-3: `subjects.js:83`, `profile.js:148/536/597`)
- Backfill script migrates existing base64 docs
- Signed URLs for private avatars if needed
- Document size audit: no doc exceeds 1 MB after migration

---

#### PERF-12 — Performance Regression Tests

**User Story:**
As a QA Engineer, I want performance smoke tests in CI so that regressions are caught early.

**Domain:** Testing
**Type:** Test
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** PERF-01..11

**Acceptance Criteria:**
- k6/Artillery smoke: 50 RPS on core endpoints with P95 < 500 ms (or documented exception)
- Query-count assertions on subject list, friends, leaderboard
- Runs as a non-blocking CI job first, then made blocking once budget is met

---

## 11. F10 — Testing & Quality (TEST)

### Epic: As a Platform, I want the test suite to actually validate the real system so that regressions are caught before deployment.

**Priority:** Critical
**Sprint:** 2–4 (runs in parallel with all features)
**Owners:** Dev C (coordination) + Dev A (backend) + Dev B (AI)

The audit (§10) states: the integration tests contain fake assertions, E2E blocks API calls, and no real end-to-end flow exists.

---

#### TEST-01 — Rewrite API Integration Tests

**User Story:**
As a QA Engineer, I want `api-integration.test.js` rewritten to hit real services so that coverage metrics reflect reality.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Remove all assertions-on-local-variables "tests"
- Rewrite using the supertest + real Mongo pattern of `gateway.integration.test.js`
- Coverage thresholds enforced (jest 70% config retained)

---

#### TEST-02 — Remove Fake Assertions / Empty Tests

**User Story:**
As a QA Engineer, I want dead test files removed so that the suite is honest.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- `api-integration.test.js` (if not rewritten) removed
- Empty `test_coach_with_signals.py` removed or filled
- Stale Flask app in `search/retrieval/search.py:136–180` removed
- `agentService.js` temporary logger stub replaced with shared logger

---

#### TEST-03 — Hybrid Playwright Fixture

**User Story:**
As a QA Engineer, I want Playwright fixtures that allow real API calls (mocking only external AI/crawlers) so that E2E tests exercise the real backend.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Replace `route.abort('blockedbyclient')` behavior with an allowlist: real calls pass, external LLM/Apify calls are mocked
- Tests run against a real API stack (compose) 
- Full E2E suite runs in CI (not just `test:smoke`)

---

#### TEST-04 — RabbitMQ Contract Tests ✅ done

**User Story:**
As a QA Engineer, I want the AI message contract tested on both sides so that Node and Python never drift.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2–3
**Status:** DONE (2026-08-30 — delivered with AI-COM-02/03; verified by read-only audit)

**Dependencies:** F01 (AI-COM-02/03)

**Acceptance Criteria:**
- [x] Contract fixtures shared by Node + Python tests
- [x] Node publisher fixture validated against Python schema and vice versa
- [x] Version mismatch fails CI

---

#### TEST-05 — AI Contract Tests

**User Story:**
As a QA Engineer, I want per-agent input/output contracts tested so that agent schemas stay stable.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** F02–F05

**Acceptance Criteria:**
- Fixtures for planner/coach/evaluator/search/ingestion messages
- Invalid payload → rejected; valid payload → processed
- Runs in pytest with mocked LLM

---

#### TEST-06 — Authentication Negative Tests

**User Story:**
As a QA Engineer, I want negative authentication tests so that unauthenticated access is proven impossible.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** SEC-01..07

**Acceptance Criteria:**
- Missing/invalid/expired token → 401 for protected endpoints across all services
- Refresh rotation/reuse-detection tested
- OTP brute-force/expiry tested

---

#### TEST-07 — Authorization Negative Tests

**User Story:**
As a QA Engineer, I want cross-user authorization tests so that user A can never access user B's data.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3–4

**Dependencies:** SEC-05, STUDY-03

**Acceptance Criteria:**
- Attempted access to another user's plans, sessions, chat history, search history, profiles → 403/404
- AI job access by another user → 403
- Internal endpoints reachable only via internal secret

---

#### TEST-08 — Prompt Injection Suite

**User Story:**
As a QA Engineer, I want a consolidated prompt-injection regression suite across all agents so that hardening stays fixed.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** PLAN-11, COACH-12, F04/F05 hardening

**Acceptance Criteria:**
- Consolidated suite covering planner, coach, evaluator, search (incl. scraped content), ingestion
- Assertions: outputs obey schemas, no instruction takeover, no data exfiltration in output
- Green in CI

---

#### TEST-09 — Upload Security Tests

**User Story:**
As a QA Engineer, I want upload security tests so that file validation is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4

**Dependencies:** INGEST-01..04, SEC-11

**Acceptance Criteria:**
- Executable disguised as PDF → rejected
- Oversized file → 413
- Path-traversal filename → sanitized/rejected
- Password-protected PDF → rejected with clear message

---

#### TEST-10 — OTP Security Tests

**User Story:**
As a QA Engineer, I want OTP behavior tested so that verification is secure.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4–5

**Dependencies:** SEC-01, SEC-02

**Acceptance Criteria:**
- Correct OTP verifies; incorrect/expired/replayed OTP rejected
- Attempt limits enforced
- No `Math.random()` in OTP code path (static check)

---

#### TEST-11 — Full AI E2E

**User Story:**
As a QA Engineer, I want one test where an AI job completes through RabbitMQ end-to-end (mocked LLM) so that the whole AI pipeline is proven.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** F02–F05

**Acceptance Criteria:**
- Trigger planner job via API → RabbitMQ → Python worker (mocked LLM) → result → UI shows plan
- Same pattern verified for coach and search (can be parametrized)
- Runs in CI with real RabbitMQ + MongoDB containers
- **Future extension (KG-RAG-14):** Graph RAG E2E test will extend this to verify knowledge graph population and traversal-based retrieval through the full pipeline

---

#### TEST-12 — Full User Journey E2E

**User Story:**
As a QA Engineer, I want the complete user journey tested so that the platform is proven end-to-end.

**Domain:** Testing
**Type:** Test
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** TEST-03, TEST-11

**Acceptance Criteria:**
- Journey: Register → Login → Create course → Generate plan → (RabbitMQ → AI → result) → Study session → Earn XP → Rank update → Leaderboard reflects
- This is the test the existing architecture is missing (audit §10.2)
- Runs in CI, stable (no flakiness), under 5 min

---

#### TEST-13 — Load Smoke Test

**User Story:**
As a QA Engineer, I want a basic load smoke test so that gross regressions are caught.

**Domain:** Testing
**Type:** Test
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** PERF-12

**Acceptance Criteria:**
- k6 script for core endpoints (auth, subjects, sessions, leaderboard)
- 50 concurrent users, P95 assertions
- Non-blocking first, then blocking

---

#### TEST-14 — Duplicate-Method Lint Rule

**User Story:**
As a QA Engineer, I want duplicate class methods / module attributes to fail lint so that the silent-override bugs cannot return.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 5

**Dependencies:** TEST-02

**Acceptance Criteria:**
- Lint rule (JS + Python) flags duplicate method definitions
- Regression tests for the three known bugs: duplicate `is_ready()` (`signal_processing_service/service.py`), duplicate `add_documents`/`retrieve` (`planner/rag/retriever.py`), badge `'use'` key (`leaderboardService.js`)
- CI runs the rule + tests

---

## 12. F11 — Infrastructure & Deployment (INFRA)

### Epic: As a Platform, I want hardened containers, blocking security scans and a real deployment path so that the platform can ship safely.

**Priority:** High
**Sprint:** 4
**Owners:** Dev C (infra) + Dev A (migrations)

---

#### INFRA-01 — Blocking npm Audit

**User Story:**
As a DevOps engineer, I want `pnpm audit` to fail the build on critical/high vulnerabilities so that vulnerable dependencies never ship.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Remove `continue-on-error: true` from pnpm audit in all CI workflows (audit §9.1)
- `--audit-level=high` enforced
- Known false positives documented with `--json` evidence

---

#### INFRA-02 — Blocking Trivy

**User Story:**
As a DevOps engineer, I want Trivy image scans to fail the build on critical/high findings so that vulnerable images never ship.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Trivy `exit-code: 1` for critical/high (audit §9.1 currently `exit-code: '0'`)
- Ignore list documented and reviewed
- Scan runs on every pushed image

---

#### INFRA-03 — Blocking Secret Scanning

**User Story:**
As a DevOps engineer, I want TruffleHog/secret scans to fail the build when secrets are found so that credentials never reach the registry.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- TruffleHog blocks on findings (audit §9.1)
- Baseline false positives documented
- Gitleaks run locally via pre-commit

---

#### INFRA-04 — Non-Root Containers

**User Story:**
As a Security Engineer, I want all containers running as non-root so that a container breakout is contained.

**Domain:** Infrastructure
**Type:** Security
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1–2

**Dependencies:** None

**Acceptance Criteria:**
- Dockerfiles create and switch to a non-root user (Node, Python AI, Nginx)
- Volume permissions adjusted (uploads dir writable by the app user)
- Compose `user:` overrides where needed
- Verified by `docker inspect` in CI (or Trivy `--severity` check for root)

---

#### INFRA-05 — Read-Only Filesystem

**User Story:**
As a Security Engineer, I want containers to run with a read-only root filesystem where possible so that runtime tampering is blocked.

**Domain:** Infrastructure
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** INFRA-04

**Acceptance Criteria:**
- `read_only: true` in prod compose for services that need no runtime writes
- Writable tmpfs mounted only for `/tmp` where required (Python AI, uploads)
- Smoke-tested in staging (INFRA-09)

---

#### INFRA-06 — no-new-privileges

**User Story:**
As a Security Engineer, I want `security_opt: no-new-privileges` on all containers so that privilege escalation via setuid is blocked.

**Domain:** Infrastructure
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** INFRA-04

**Acceptance Criteria:**
- Applied to all services in prod compose
- Verified in CI (Trivy config check)

---

#### INFRA-07 — RabbitMQ Hardening

**User Story:**
As a Security Engineer, I want RabbitMQ secured with credentials, a dedicated vhost and restricted permissions so that the AI bus is not a public surface.

**Domain:** Infrastructure
**Type:** Security
**Priority:** Critical
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** AI-COM-01

**Acceptance Criteria:**
- Management UI reachable only internally
- Consumer credentials restricted to their queues (no wildcard admin)
- Port not exposed on the host (internal network only)
- TLS for RabbitMQ in prod (documented, enabled where certs available)

---

#### INFRA-08 — Redis Hardening

**User Story:**
As a Security Engineer, I want Redis hardened with password + network restrictions so that cache is protected.

**Domain:** Infrastructure
**Type:** Security
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2–3

**Dependencies:** PERF-09

**Acceptance Criteria:**
- `requirepass` + no host port binding (internal only)
- `rename-command` for `CONFIG`/`FLUSHALL` in prod
- Fail-fast if password missing in prod

---

#### INFRA-09 — Staging Environment

**User Story:**
As a DevOps engineer, I want a staging environment mirroring production so that deployment is validated safely.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** INFRA-04..08

**Acceptance Criteria:**
- Staging compose/profile with real Mongo + Redis auth, non-root, prod-like env
- Staging deployed by CI on merge to `staging`
- Smoke + E2E run against staging
- Data reset/seed procedure documented

---

#### INFRA-10 — Migration Pipeline

**User Story:**
As a DevOps engineer, I want database migrations run in CI/CD so that schema changes are applied reproducibly.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3–4

**Dependencies:** INFRA-09

**Acceptance Criteria:**
- Adopt a migration tool for Mongo (e.g., migrate-mongo) with versioned, reversible scripts
- Migrations run before tests in CI and before deploy in staging/prod
- Backfill scripts (`backfillGamificationStats.js`, `migrateXpToKnowledgePoints.js`) converted to migrations
- Migration status endpoint/command for ops

---

#### INFRA-11 — Deployment Pipeline

**User Story:**
As a DevOps engineer, I want an automated deployment pipeline so that shipping is repeatable and fast.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 4

**Dependencies:** INFRA-09, INFRA-10

**Acceptance Criteria:**
- CI deploys images to a target (VPS via docker compose or container platform)
- `.env`/secrets provisioned via a secrets manager or encrypted CI secrets
- Deploy triggered on tag/merge to `main`
- Deployment smoke test post-deploy (health check all services)

---

#### INFRA-12 — Rollback Strategy

**User Story:**
As a DevOps engineer, I want a tested rollback strategy so that a bad release can be reverted safely.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4–5

**Acceptance Criteria:**
- Previous image tags retained and deployable in one command
- DB migrations are forward + backward compatible (rollback path documented)
- Rollback runbook written and dry-run in staging

---

#### INFRA-13 — Environment Matrix

**User Story:**
As a DevOps engineer, I want a documented env-var matrix so that configuration is reproducible.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 5

**Dependencies:** INFRA-09..12

**Acceptance Criteria:**
- Cross-service table: variable, purpose, default, required, dev/staging/prod values
- `.env.example` files synced with the matrix
- Secrets never appear in the matrix (only secret refs)

---

## 13. F12 — UX & Frontend Quality (UX)

### Epic: As a User, I want a polished, accessible, honest interface so that product friction is removed and features are discoverable.

**Priority:** Medium
**Sprint:** 4–5 (after production blockers)
**Owners:** Dev C

---

#### UX-01 — Fix View Demo CTA

**User Story:**
As a User, I want the "View Demo" button to work so that the landing page has no dead controls.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- `HeroSection.jsx:174` button either navigates to a working demo/video or is removed
- Keyboard + screen-reader accessible (real `<a>` or `<button>` with handler)

---

#### UX-02 — 404 Page

**User Story:**
As a User, I want a 404 page so that unknown URLs don't render blank.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 1

**Dependencies:** None

**Acceptance Criteria:**
- Catch-all route in `App.jsx` renders a branded 404 with navigation
- Audit: no catch-all route exists (§4 routing)

---

#### UX-03 — Global Error Boundary

**User Story:**
As a User, I want a friendly global error state so that crashes never show a blank screen.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1–2

**Dependencies:** None

**Acceptance Criteria:**
- `ErrorBoundary` fallback provides a reload action and error id
- Route-level boundaries for lazy chunks

---

#### UX-04 — Toast System

**User Story:**
As a User, I want consistent toast notifications so that successes/failures are visible.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2

**Dependencies:** None

**Acceptance Criteria:**
- Global `ToastProvider` + `useToast` hook
- API interceptor surfaces network errors as toasts
- Replaces ad-hoc `console.error` silent failures (e.g., `Lobby.jsx:237`)

---

#### UX-05 — Replace alert()

**User Story:**
As a User, I want inline validation instead of browser alerts so that the UI is consistent.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2

**Dependencies:** UX-04

**Acceptance Criteria:**
- Remove `alert()` in `WeeklyCalendar.jsx:244/280` and `SlotModal.jsx`
- Inline field errors using the toast/input-error pattern

---

#### UX-06 — Empty States

**User Story:**
As a User, I want meaningful empty states so that empty data never looks broken.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 2–3

**Dependencies:** None

**Acceptance Criteria:**
- Empty states for: tasks, subjects, friends, leaderboard, search results, notifications, chat
- Reuse `EmptyState` shared component; add contextual CTA ("Add your first subject")

---

#### UX-07 — Skeleton Loaders

**User Story:**
As a User, I want skeleton loading states so that pages never flash blank while loading.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** None

**Acceptance Criteria:**
- Skeleton states for `Lobby.jsx`, `StudySession.jsx`, `Dashboard.jsx`, `Navbar.jsx`, chat history
- Reusable `Skeleton` primitive

---

#### UX-08 — Fix VoiceSettings

**User Story:**
As a User, I want voice settings that work or are hidden so that no control is fake.

**Domain:** Frontend
**Type:** Feature
**Priority:** Low
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 3–4

**Dependencies:** None

**Acceptance Criteria:**
- Implement device routing/selection or remove the placeholder (audit §4: "can be added in next phase")

---

#### UX-09 — Fix VolumeControl

**User Story:**
As a User, I want the volume control to affect audio output so that it is not UI-only.

**Domain:** Frontend
**Type:** Feature
**Priority:** Low
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 3–4

**Dependencies:** None

**Acceptance Criteria:**
- Volume state applied to the WebRTC audio element
- Audit §4: `VolumeControl` currently captures state but applies nothing

---

#### UX-10 — Onboarding / Tutorial

**User Story:**
As a New User, I want a guided tour so that I discover characters, quests, planner and focus features.

**Domain:** Frontend
**Type:** Feature
**Priority:** Low
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 4–5

**Dependencies:** UX-04, UX-06

**Acceptance Criteria:**
- First-run tour (3–5 steps) highlighting key features
- Dismissible, remembers completion (localStorage)
- Feature discoverability improved (audit §11.2)

---

#### UX-11 — Mobile Responsiveness Audit

**User Story:**
As a User, I want the app usable on mobile so that studying happens anywhere.

**Domain:** Frontend
**Type:** Feature
**Priority:** Low
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** None

**Acceptance Criteria:**
- Audit calendar grid, study session, voice chat on small viewports (audit §11.2)
- Fix top blocking issues; document remaining as known limits
- Touch targets ≥ 44px, no horizontal scroll on key pages

---

#### UX-12 — Accessibility Audit

**User Story:**
As a User with disabilities, I want accessible controls so that the platform is usable by everyone.

**Domain:** Frontend
**Type:** Feature
**Priority:** Low
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 5

**Dependencies:** None

**Acceptance Criteria:**
- Fix audit findings: calendar slot cells `role`/`aria-label` (§3 a11y), voice mute buttons `aria-pressed`, emoji icons with `aria-label`, keyboard traps in modals
- `<main>`/`<nav>` landmarks in Layout
- Contrast + reduced-motion pass on key pages
- Lighthouse a11y ≥ 90 on main routes

---

## 14. F13 — Observability & Disaster Recovery (OPS)

### Epic: As a Platform, I want end-to-end observability and a real DR story so that incidents are detectable and data is recoverable.

**Priority:** High
**Sprint:** 4
**Owners:** Dev A (Node tracing) + Dev B (AI metrics) + Dev C (infra/backups)

---

#### OPS-01 — Structured Logging

**User Story:**
As a Platform Engineer, I want all services logging structured JSON with levels so that logs are searchable.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** SEC-08

**Acceptance Criteria:**
- Replace Python `print()` (audit §5.2) with the existing JSON logger
- Replace `console.log` of sensitive data (base64 avatar) with safe structured logs
- Consistent fields: `level`, `service`, `requestId`, `timestamp`, `message`, `meta`

---

#### OPS-02 — Request IDs

**User Story:**
As a Platform Engineer, I want request IDs propagated across services so that a single user action is traceable.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** OPS-01

**Acceptance Criteria:**
- Request-ID middleware at gateway generates `requestId` (or accepts `X-Request-ID`)
- Propagated on internal calls and into AI messages (`requestId` field)
- Logged by every service

---

#### OPS-03 — AI Correlation IDs ✅ done

**User Story:**
As a Platform Engineer, I want AI job correlation visible in logs so that job lifecycle is debuggable.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1–2
**Status:** DONE (2026-08-30 — delivered with the F01 job-bus suite; verified by read-only audit)

**Dependencies:** AI-COM-02/03, OPS-02

**Acceptance Criteria:**
- [x] `correlationId` logged at publish, consume, process, result
- [x] Job → result correlation verified by a test

---

#### OPS-04 — RabbitMQ Metrics

**User Story:**
As a Platform Engineer, I want RabbitMQ queue metrics so that backlogs and DLQs are visible.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2

**Dependencies:** AI-COM-01, INFRA-07

**Acceptance Criteria:**
- Metrics: queue depth, messages published/consumed, DLQ depth, prefetch utilization, connection count
- Exposed via Prometheus (rabbitmq_exporter) or the management API
- Dashboard panel in OPS-08

---

#### OPS-05 — AI Latency Metrics

**User Story:**
As a Platform Engineer, I want AI job latency metrics so that degradation is caught.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2

**Dependencies:** OPS-03

**Acceptance Criteria:**
- Histogram: job duration by type (planner/coach/eval/search/ingest)
- Labels: type, status
- Exposed via Prometheus

---

#### OPS-06 — AI Failure Metrics

**User Story:**
As a Platform Engineer, I want AI failure rates so that LLM/provider issues are visible.

**Domain:** Backend
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 2–3

**Dependencies:** OPS-03

**Acceptance Criteria:**
- Counters: failures by type and reason (timeout/quota/validation)
- Retry count distribution
- DLQ ingress rate

---

#### OPS-07 — Prometheus

**User Story:**
As a Platform Engineer, I want Prometheus scraping all services so that metrics are centralized.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3

**Dependencies:** OPS-04..06

**Acceptance Criteria:**
- Prometheus service in compose (prod profile)
- Node services expose `/metrics` (prom-client)
- Python AI exposes `/metrics` (prometheus-client)
- Scrape config covers all services + RabbitMQ + MongoDB

---

#### OPS-08 — Grafana Dashboards

**User Story:**
As a Platform Engineer, I want Grafana dashboards so that operations have a single view.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 3–4

**Dependencies:** OPS-07

**Acceptance Criteria:**
- Dashboards: API (RPS, latency, errors), AI jobs (queue depth, latency, failures), RabbitMQ, Redis, MongoDB, system
- Panels reference audit's critical flows (auth, plan generation, sessions)

---

#### OPS-09 — Alerting

**User Story:**
As a Platform Engineer, I want alerts on SLO breaches so that incidents are caught early.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** OPS-07

**Acceptance Criteria:**
- Alerts: error rate > 5% (5 min), AI queue backlog > threshold, DLQ growth, P95 latency breach, service down (up=0)
- Notification via email/webhook
- On-call doc with severity definitions

---

#### OPS-10 — OpenTelemetry

**User Story:**
As a Platform Engineer, I want distributed tracing so that cross-service latency is diagnosable.

**Domain:** Backend
**Type:** Infra
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 4

**Dependencies:** OPS-02

**Acceptance Criteria:**
- OpenTelemetry SDK in Node services + Python AI
- Trace propagation: HTTP headers + AI message `requestId`
- Traces exported to a backend (Tempo/Jaeger) in staging

---

#### OPS-11 — Encrypted Backups

**User Story:**
As a Platform Engineer, I want database backups encrypted so that a leaked backup is unreadable.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4–5

**Dependencies:** None

**Acceptance Criteria:**
- `backup.sh` encrypts dumps (age/gpg) before storage (audit §9.4: plaintext dumps)
- Key managed via secrets manager; key rotation procedure documented

---

#### OPS-12 — Offsite Backups

**User Story:**
As a Platform Engineer, I want backups stored offsite so that a server loss doesn't lose data.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** OPS-11

**Acceptance Criteria:**
- Backups pushed to offsite storage (S3-compatible bucket)
- Retention policy (e.g., daily 30d, weekly 90d)
- No local-only dependency

---

#### OPS-13 — Backup Verification

**User Story:**
As a Platform Engineer, I want backup integrity verified so that restores don't fail silently.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 5

**Dependencies:** OPS-11

**Acceptance Criteria:**
- Checksums computed and verified (audit §9.4: no checksum today)
- `restore.sh` dry-run mode + integrity check before `--drop`
- Robust DB-name extraction in `backup.sh` (audit §9.4 regex fragility)

---

#### OPS-14 — Restore Drill

**User Story:**
As a Platform Engineer, I want a proven restore procedure so that DR is real.

**Domain:** Infrastructure
**Type:** Infra
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 5

**Dependencies:** OPS-13

**Acceptance Criteria:**
- Restore from a recent backup verified in a throwaway environment
- RTO measured and recorded
- Run quarterly (documented schedule)

---

#### OPS-15 — DR Runbook

**User Story:**
As a Platform Engineer, I want a written DR runbook so that anyone can recover the platform.

**Domain:** Documentation
**Type:** Doc
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 5

**Dependencies:** OPS-11..14

**Acceptance Criteria:**
- Sections: detect → notify → restore DB → redeploy services → verify → rollback
- Contact/on-call matrix, decision trees
- Stored in the repo and referenced from README

---

#### OPS-16 — Define RPO / RTO

**User Story:**
As a Platform Engineer, I want RPO/RTO targets defined so that DR investment is scoped.

**Domain:** Documentation
**Type:** Doc
**Priority:** Medium
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 5

**Dependencies:** OPS-14

**Acceptance Criteria:**
- RPO (e.g., ≤ 24h) and RTO (e.g., ≤ 4h) agreed and documented
- Backup frequency aligned to RPO
- DR drill measures against targets

---

## 15. F14 — Bloom Competency Engine (BLOOM)

### Epic: As a User, I want my platform to model WHAT kind of thinking I demonstrate (revised Bloom taxonomy, Anderson & Krathwohl 2001) so that mastery is measured as evidence-based cognitive competency per topic — not a single quiz percentage — and my study plan targets exactly where I am weakest.

**Priority:** High
**Sprint:** 3–4
**Owners:** Dev B (AI/estimator) + Dev A (models/API) + Dev C (UI/QA)

The revised taxonomy classifies learning along TWO dimensions: six cognitive processes (Remember → Understand → Apply → Analyze → Evaluate → Create) and four knowledge types (factual, conceptual, procedural, metacognitive). A question HAS a Bloom level; a student's answer DEMONSTRATES a level that may differ. The engine maintains a competency profile keyed `(userId × topic × knowledgeType × bloomLevel)` with score, confidence and evidence — never a naive "% correct → level" mapping.

Reference: `docs/education/bloom-taxonomy.md` (BLOOM-DOC).

---

#### BLOOM-01 — Shared Taxonomy Constants

**User Story:**
As an AI engineer, I want the taxonomy enums and verb maps defined once and mirrored across Node and Python with a parity fixture so that no service can drift from the canonical model.

**Domain:** Full-stack
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 1

**Dependencies:** none (F01 done)

**Acceptance Criteria:**
- Sealed enums: `BLOOM_LEVELS = [remember, understand, apply, analyze, evaluate, create]` (ordered), `KNOWLEDGE_TYPES = [factual, conceptual, procedural, metacognitive]`
- Action-verb map per level (Waterloo mapping: Remember→Define/List, Understand→Explain/Summarize, Apply→Solve/Implement, Analyze→Compare/Diagnose, Evaluate→Justify/Critique, Create→Design/Compose)
- Node module `shared/bloom/taxonomy.js` + Python mirror `bloom/taxonomy.py`
- Shared fixture `docs/contracts/bloom-fixture.json`; parity BLOOM-01 — Shared Taxonomy Constantstests on both sides (pattern of AI-COM-06)
- Progression helper: `nextLevel(level)` / `unlockThreshold = 0.7`

✅ done — AI `bloom@ca5edab` (PR #16) + API `bloom@3e9e58f` (PR #6), awaiting merge to main. Node `shared/bloom/taxonomy.js` (Object.freeze'd) mirrors Python `bloom/taxonomy.py` (tuples) and both match `docs/contracts/bloom-fixture.json` byte-for-byte; `UNLOCK_THRESHOLD = 0.7` + camelCase `unlockThreshold` alias; `nextLevel()` walks the progression and returns null at 'create'/unknown. Parity tests run in CI on both sides: API (`jest.config.js` testMatch `**/tests/**/*.test.js` → BLoom parity 5 tests) and AI (`.github/workflows/ai.yml` extended to lint `bloom/ models/ tests/` and run `pytest tests/` at repo root; `pyproject.toml` `testpaths` now includes `"tests"` so a bare `pytest` collects them too). 14 AI + 5 API parity/progression tests pass.

---

#### BLOOM-02 — Learning Objective Contract

**User Story:**
As a Backend engineer, I want learning objectives represented by a strict schema with measurable verbs so that vague objectives never enter the competency pipeline.

**Domain:** Backend
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1–2

**Dependencies:** BLOOM-01

**Acceptance Criteria:**
- `LearningObjective`: `{objectiveId, topicId, knowledgeType, bloomLevel, verb, text}` (Node validator + Pydantic)
- Validation rejects: verbs not in the level's verb map, non-measurable phrasings ("know", "be familiar with"), empty text
- Objective text ≤ 200 chars; verb must appear at/near the start of `text`
- Rejected objectives logged for curation, never silently dropped

✅ done — AI Pydantic `models/learning_objective.py` + API `validators/learningObjective.js`, awaiting merge. Same 6-field contract (`objectiveId, topicId, knowledgeType, bloomLevel, verb, text`) with snake_case/camelCase aliases on the Pydantic side. Rejects: verbs outside the level's verb map, non-measurable phrasings (`know`, `be familiar with`, `understand`, `learn about`, `be aware of`, `grasp`), empty text, >200 chars, verb not at/near the start (first 3 words). **Parity verified locally edge-for-edge** (accept/reject identical Node vs Python). Rejections logged via `console.warn` (`learningObjectives.js`) / call-site catch (`learning_objective.py` docstring) — never silently dropped. API route `POST /api/v1/study/learning-objectives` returns `200` echo (valid) / `400 {errors}` (invalid); 16 validator+route tests (supertest) pass, plus 8 Pydantic model tests.

---

#### BLOOM-03 — Knowledge Extraction Job Type

**User Story:**
As an AI engineer, I want a `study.knowledge.extract` job type on the bus so that objective extraction runs through the same reliable pipeline as every other AI operation.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 1
**Story Points:** 1
**Day:** 2

**Dependencies:** BLOOM-02, AI-COM-06

**Acceptance Criteria:**
- Type registered in `AI_JOB_TYPES` (Node envelope + Python mirror) and topology constants
- Input contract: `{documentId, courseId, contentRef}` — raw content loaded from storage, never inline in the envelope
- Orchestrator declares work/DLQ/delay queues for the type at boot (existing ensureTopologyForType flow)

✅ done — AI `feature/bloom-03-knowledge-extract`@49fc32f (PR #25) + API `feature/bloom-03-knowledge-extract`@a5a8ed3 (PR #9), both targeting `bloom` (unmerged). `study.knowledge.extract` added to Node `AI_JOB_TYPES` (`shared/ai-messaging/envelope.js`) and Python frozenset mirror (`messaging/envelope.py`) — parity tests on both sides parametrize over the full set so the new type is auto-covered. Input-contract validation added both sides: Node `validateKnowledgeExtractPayload` (`shared/ai-messaging/payloadSchemas.js`, `{documentId, courseId, contentRef}` with limits 64/64/256, raw content never inline) + Python `KnowledgeExtractRequest` (`workers/schemas.py`, `extra="forbid"`, same limits, blank strings rejected). Orchestrator needs no change — `services/ai-orchestrator/src/server.js` already loops `AI_JOB_TYPES` calling `ensureTopologyForType` at boot and the queue-name helpers are generic. Tests: API 29 (envelope+schemas+taxonomy) and 67 (shared+study) pass, prettier clean; AI 39 (schema+envelope+bloom) and 101 (full `tests/`, minus pre-existing coach baseline) pass; no shared fixture change required (`topology-fixture.json` only samples `study.plan.generate`).

---

#### BLOOM-04 — Objective Extraction Stage

**User Story:**
As an AI engineer, I want ingestion to extract concepts and draft measurable learning objectives from course content so that every document produces assessable targets.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 2–3

**Dependencies:** BLOOM-03, INGEST-06

**Acceptance Criteria:**
- Extraction stage inserted between enrich and chunk in the ingestion pipeline (INGEST-06 amended)
- LLM prompt hardened via shared `prompt_guard` (course content = untrusted data); output strictly per BLOOM-02 schema
- Deduplication: identical `(topicId, normalized text)` objectives are merged, not duplicated
- Cap per document (e.g., ≤ 40 objectives) to bound cost; truncation reported in job result
- Extraction failure degrades gracefully: ingestion completes without objectives, warning emitted

✅ done — AI `feature/bloom-04-objective-extraction`@cfbbacb (PR #26, targeting `bloom`, unmerged). New `agents/course_ingestion/enrichment/objective_extractor.py` stage wired in `ingest_course` as Step 4b between enrich (Step 4) and tokenize (Step 5). Prompt hardened via `prompt_guard.wrap_untrusted` (nonce-delimited `SUBTITLE` + `COURSE_MATERIAL` blocks, system instructions isolated). Every LLM draft validated against BLOOM-02 `LearningObjective` (rejections logged, never silently dropped; validation never causes ingestion failure). Dedup by `(topicId, normalized text)` keeping first occurrence; per-document cap `OBJECTIVE_CAP_PER_DOCUMENT = 40` with truncation reported in stats + logged warning. Empty/unparseable LLM output or an exception → `[]` + warning, ingestion completes without objectives. Deterministic content-addressed `objectiveId` (sha256 of topicId+text) stable across re-runs. `Subtopic.learning_objectives` added to `normalization/schema.py` so objectives persist in the course JSON. 14 unit tests (prompt hardening, schema validation/rejection, dedup incl. case/whitespace normalization, cap+re-scatter, graceful failure, empty-subtopic skip). Verification: 56 tests pass across extractor + bloom/parity suites; pre-existing baselines unchanged (embedder needs live embedder, `agents/tests` collection needs `faiss`).

---

#### BLOOM-05 — Bloom Classification & Confidence Gate

**User Story:**
As an AI engineer, I want each draft objective classified into cognitive process × knowledge type with a confidence score so that uncertain classifications are flagged instead of silently wrong.

**Domain:** AI
**Type:** Feature
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 3

**Dependencies:** BLOOM-04

**Acceptance Criteria:**
- Classification output validated against BLOOM-01 enums; illegal values → one correction retry → FAILED (sanitized)
- Verb-map consistency check: classifier's level must agree with the objective's verb; disagreement lowers confidence
- `confidence < 0.6` → objective stored but marked `needsReview`, excluded from plan targeting until curated
- Regression fixtures: one example per (level × knowledge type) cell asserted in tests

✅ done — AI `feature/bloom-05-classification-gate` (PR #27, targeting `bloom`, unmerged). New `bloom/classifier.py` = Step 4c in `ingest_course` (between extraction Step 4b and chunking Step 5). LLM classification prompt hardened via `prompt_guard.wrap_untrusted` (objective text = untrusted, nonce-delimited). Output validated against BLOOM-01 enums (`BLOOM_LEVELS`, `KNOWLEDGE_TYPES`, confidence ∈ [0,1]); illegal values → one correction retry (`MAX_CORRECTION_RETRIES=1`, `CORRECTION_SUFFIX`) → FAILED with sanitized `FAILED_REASON` (illegal value never leaks). Verb-map consistency: classified level must contain the objective's verb in `VERB_MAP`; disagreement scales confidence down `VERB_DISAGREEMENT_PENALTY=0.5`. Confidence gate `GATE_THRESHOLD=0.6`: `< 0.6` → `needsReview=true` (objective kept, flagged for curation, excluded from plan targeting); `>= 0.6` → cleared. Graceful degradation: empty/unparseable LLM output or exception → FAILED classification + warning, never raises. Deterministic `classification` dict (`bloomLevel`, `knowledgeType`, `confidence`, `verbConsistent`, `needsReview`, `status`, `reason`) attached to each objective; stats `{classified, needs_review, failed, warnings}` logged. `docs/contracts/classification-fixture.json`: one regression example per (level × knowledge type) cell (24 cells, no duplicates) + constants aligned; regression tests assert every cell round-trips. 24 unit/regression tests; 80 passed across bloom suites; pre-existing 12 coach failures unchanged.

---

#### BLOOM-06 — LearningObjective Persistence

**User Story:**
As a Backend engineer, I want objectives persisted with indexes and document versioning so that lookups are fast and re-ingestion doesn't duplicate history.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 4

**Dependencies:** BLOOM-05

**Acceptance Criteria:**
- Mongo collection `learning_objectives`; indexes: `(topicId, bloomLevel)`, `documentId`, unique `(topicId, textHash)`
- Re-ingestion of a document supersedes (version bump) rather than duplicating objectives
- TTL-free: objectives live until superseded or topic deleted

✅ done — API `feature/bloom-06-learning-objective-persistence`@bdd0391 (PR #10, targeting `bloom`, unmerged). New `LearningObjective` model in `services/study/src/models/index.js` persisted under collection `learning_objectives` with indexes `(topicId, bloomLevel)`, `documentId`, and a unique key. **Design decision:** the AC's unique `(topicId, textHash)` is scoped per-document to `unique (documentId, topicId, textHash)` — the AI extractor collapses all subtopics to `topicId=topic_1` for every course, so a global unique key would collide when two users upload the same objective text (e.g. two "Linear Algebra" courses). New `services/study/src/services/objectives.js` syncs on ing (bulk upsert, version bump via `$inc`, supersede removed objectives) and hard-deletes on course deletion (TTL-free). `routes/courses.js` now carries `learning_objectives` through the AI→schema transform on both create and re-process. Mocks extended in `study.test.js`; 12 new service tests in `objectives.test.js`. Verification: full study-service suite 28/28 pass, prettier clean.

---

#### BLOOM-07 — CompetencyProfile Model & Estimator

**User Story:**
As an AI engineer, I want a per-student competency profile keyed by (topic × knowledgeType × bloomLevel) with an evidence-weighted estimator so that mastery reflects demonstrated cognition over time, not one grade.

**Domain:** Backend/AI
**Type:** Feature
**Priority:** Critical
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 4–5

**Dependencies:** BLOOM-02, AI-COM-07

**Acceptance Criteria:**
- Model shape: `{userId, topicId, knowledgeType, bloomLevel, score (0–1), confidence (0–1), evidence[], updatedAt}`; compound index on `(userId, topicId)`
- Estimator: evidence-weighted EWMA seeded by EVAL's smoothing guard; updates bounded to [0,1]; recency decay documented
- **No cross-level inference**: scoring "Understand" never moves "Create" (progression only via BLOOM-10 gate + evidence)
- Property-based unit tests: bounds, monotonicity under consistent evidence, convergence, decay
- Aggregation endpoint-ready: subject-level rollup computed from topic-level rows (topic granularity is the source of truth)

✅ done — PR #11 (https://github.com/study-partner-esprit/study-partner-api/pull/11) on branch `feature/bloom-07-competency-profile`, targeting `bloom`. New `CompetencyProfile` model in `services/study/src/models/index.js` persisted under `competency_profiles` collection. Indexes: `(userId, topicId)` compound, unique `(userId, topicId, knowledgeType, bloomLevel)`. Evidence array capped at N=20. EWMA estimator in new `services/study/src/services/competency.js`: seeded at 0.5 (EVAL's `last_valid_score` default), α=0.4, max_step=0.12 clamp, bounded [0,1]. `replayEvidence` sorts by evaluatedAt, replays from seed, null masteryScore filtered; `rollupByTopics` for subject-level aggregation. 21 property-based tests covering bounds, monotonicity, convergence, recency decay, no cross-level inference, idempotency, edge cases. Full study-service suite 49/49 pass, prettier clean.

---

#### BLOOM-08 — Profile Updater (result-event consumer)

**User Story:**
As a Platform engineer, I want competency profiles updated idempotently from evaluation result events so that replays and retries never corrupt scores.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** BLOOM-07, EVAL-08

**Acceptance Criteria:**
- Subscribes to eval result events; updates ONLY when `demonstratedBloomLevel` present
- Idempotent by correlationId (AI-COM-08 store): replayed events are ACK-skipped
- Atomic per-key update (`findOneAndUpdate` on the compound key), no read-modify-write races
- Evidence entries appended capped (keep last N=20 per key)

✅ done — PR #14 (https://github.com/study-partner-esprit/study-partner-api/pull/14) on branch `feature/bloom-08-profile-updater`, targeting `bloom`. EvalResult enriched with `userId` (from the authenticated ai.results envelope — the only trusted identity source) in `EvalResult` model / `evalResultBuilder` / `evalResultStore`, enabling the competency key. Study service gained a read-only `EvalResultRecord` model mapped to `eval_results`, a `CompetencyProcessing` idempotency claim store (`competency_processing`, unique `correlationId`), and `services/study/src/services/competencyUpdater.js`: `claimResult` (duplicate-key ⇒ ACK-skip), `resolveCompetencyKey` (objectiveId → LearningObjective → topicId + knowledgeType), `processEvalResult` (claim → resolve → build evidence item → `upsertProfile`), and `runOnce` single poll cycle. `startCompetencyUpdater()` interval poller (default 5s, `COMPETENCY_POLL_INTERVAL_MS`) wired into `server.js` after DB connect with graceful SIGTERM stop. Updates only run when `demonstratedBloomLevel` present; evidence capped by BLOOM-07's N=20. 16 updater tests + 10 eval-result tests; full study-service suite 67/67 pass, prettier clean.

---

#### BLOOM-09 — Competency API

**User Story:**
As a Frontend engineer, I want endpoints returning the student's cognitive competency map so that UI can visualize strengths and gaps.

**Domain:** Backend
**Type:** Feature
**Priority:** High
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 5

**Dependencies:** BLOOM-08

**Acceptance Criteria:**
- `GET /api/v1/competencies` → grouped by subject → topic → 6 levels (+knowledge-type breakdown param)
- `GET /api/v1/competencies/topics/:topicId` → detail incl. evidence excerpts + `needsReview` flags hidden from students
- Auth-scoped: userId always from token; caching headers/Redis per PERF patterns (short TTL)
- OpenAPI/schema documented; pagination not required (bounded per user)

✅ done — PR #15 (https://github.com/study-partner-esprit/study-partner-api/pull/15) on branch `feature/bloom-09-competency-api`, targeting `bloom`. New `services/study/src/services/competencyQueries.js`: `buildTopicIndex` joins competency `topicId` (a course-tree subtopic `id`) back to its subject by flattening the user's course topic trees; `getUserCompetencyMap` groups `CompetencyProfile` rows subject → topic → ordered Bloom levels with optional `subjectId` filter + `?knowledgeType=breakdown`; `getTopicDetail` returns per-level competencies with evidence excerpts (last 5) and an internal `needsReview` (confidence below `NEEDS_REVIEW_MIN_CONFIDENCE=0.4`, instructor-only, distinct from BLOOM-05's objective-level flag). `routes/competencies.js` exposes auth-scoped `GET /api/v1/competencies` and `GET /api/v1/competencies/topics/:topicId` (404 when no data), mounted in `app.js` at `/api/v1/competencies`, with short-TTL private `Cache-Control` headers (PERF). Bounded per user, pagination N/A per AC. 12 tests (route layer + aggregation units); full study suite passes, prettier clean.

---

#### BLOOM-10 — Planner Integration (weakest-first targeting)

**User Story:**
As a User, I want generated plans to target my weakest competencies at the right cognitive level so that studying actually moves my profile up the taxonomy ladder.

**Domain:** AI
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 3
**Story Points:** 3
**Day:** 6

**Dependencies:** BLOOM-09, PLAN-06

**Acceptance Criteria:**
- Planner input enriched with top-K weakest competencies + their unlocked levels
- Progression gate: level N activities only when level N−1 ≥ 0.7 (BLOOM-01 constant)
- Tasks carry `objectiveId` + `targetBloomLevel` (PLAN-04 schema already amended); fallback planner emits tasks WITHOUT them (graceful degradation)
- Deterministic tie-breaking so identical profiles produce stable plans

✅ done — Python PR #29 (https://github.com/study-partner-esprit/study-partner-ai/pull/29) on branch `feature/bloom-10-planner-targeting`, targeting `bloom`; Node PR #16 (https://github.com/study-partner-esprit/study-partner-api/pull/16) on branch `feature/bloom-10-planner-targeting`, targeting `bloom` (was stacked on BLOOM-09 — after BLOOM-08 #14 and BLOOM-09 #15 merged into `bloom`, the branch was rebased onto `bloom` at `e483b2e` to drop the duplicate BLOOM-09 commits; PR now MERGEABLE clean). **Python (ai):** `bloom/taxonomy.py` gained `is_level_unlocked`/`unlocked_levels` enforcing the progression gate (level N unlocked only when N−1 ≥ 0.7); `AtomicTask` carries optional `objective_id`/`target_bloom_level`; new `WeakCompetency` model flows through `PlannerInput.weak_competencies`; `workers/schemas.py` added bounded `WeakCompetencyRequest` (≤10, scores ∈ [0,1], `extra=forbid`) + `to_planner_input` mapping; the LLM decomposer prompt includes weakest-competency context (prompt-guarded) and deterministically tags tasks whose title/description match a weak topic at its highest unlocked weak level, never assigning a gated/locked level; the simple decomposer accepts the kwarg but degrades gracefully (tasks WITHOUT objective/target). **Node (api):** `getWeakCompetenciesForCourse` aggregates `CompetencyProfile` rows scoped to the course's subtopics into per-topic per-level scores, computes progression-gated `unlocked_levels` + `current_level`, normalises stored upper-case British levels (`ANALYSE`→`analyze`) to taxonomy keys, ranks weakest-first (not-started = weakest), caps at top-K; `/create` sends `weak_competencies` into the `study.plan.generate` payload (empty → graceful degradation); `/create-status` persists `objectiveId`/`targetBloomLevel` on tasks and echoes `objective_id`/`target_bloom_level` onto `StudyPlan.taskGraph.tasks`. Tests: 9 new Node tests (query + routes) + 5 new/extended Python suites; study suite 70/70, planner/worker/taxonomy/parity suites green; prettier clean. Baseline failures (faiss/retriever, 12 coach, `test_gemini_only`, 2 pre-existing unused vars in `plans.js`) untouched.

---

#### BLOOM-11 — Frontend Competency Map

**User Story:**
As a User, I want a visual competency radar per subject showing my six Bloom levels so that I can see cognitive strengths and gaps at a glance.

**Domain:** Frontend
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 7

**Dependencies:** BLOOM-09

**Acceptance Criteria:**
- Radar/bar visualization per subject (6 axes = Bloom levels); drill-down to topic list with per-topic scores
- Tasks in plans display their target level badge ("Apply", "Analyze"…)
- Empty state explains the model briefly (link to help article)
- Loading/error states per UX conventions; axe accessibility checks pass

✅ done — Web PR #5 (https://github.com/study-partner-esprit/study-partner-web/pull/5) on branch `feature/bloom-11-competency-map`, targeting `main` (this repo has no `bloom` branch; web work goes to `main`). **Competency Map page** at `/competency` (`requireStudent`): per-subject six-axis **Bloom radar** (Remember/Understand/Apply/Analyze/Evaluate/Create) averaging topic scores, a subject tab switcher, drill-down to a per-topic score list, and a **topic detail panel** (per-knowledge-type rows, scores, evidence excerpts). The internal `needsReview` signal is intentionally **not shown to students** (BLOOM-09 instructor-only convention). **Task level badges:** `PlanTaskBadge` on plan tasks renders `targetBloomLevel` (+ `objectiveId` tooltip) from the BLOOM-10 planner output with humanized labels (`analyze` → `Analyze`) and graceful degradation when absent. **API client:** `competencyAPI.getCompetencyMap` / `getTopicDetail` → `GET /api/v1/competencies[/topics/:topicId]`. **Accessibility:** added **jest-axe**, registered `expect(...).toHaveNoViolations()` in `setupTests.js`; axe tests cover the loaded map + badge. Empty state explains the Bloom model; loading spinner + retryable error state. Tests: 11 new tests in `CompetencyMap.test.jsx` + `PlanTaskBadge.test.jsx` (radar/topic load, drill-down, close, empty, error/retry, badge mapping, axe); touched suites 15/15 green, `vite build` passes, ESLint/Prettier clean (only pre-existing warnings remain in `Sidebar.jsx`/`Tasks.jsx`/`api.js`).

---

#### BLOOM-12 — E2E Validation

**User Story:**
As a QA Engineer, I want an end-to-end test proving material → objectives → evaluation → profile → targeted plan so that the feedback loop is regression-proof.

**Domain:** Testing
**Type:** Test
**Priority:** High
**Estimated Hours:** 5
**Story Points:** 5
**Day:** 8

**Dependencies:** BLOOM-10, BLOOM-11

**Acceptance Criteria:**
- Contract tests: bloom-fixture parity both sides (extends TEST-04 suite)
- Integration: ingest sample doc (LLM mocked) → objectives classified → eval steps update profile idempotently (duplicate replay = no double-count) → plan targets weakest
- Playwright happy path: student sees updated radar after session; negative: no objectives extracted → plan still generates (degraded mode)
- Estimator property tests wired into CI (bounds/monotonicity/decay)
- **Future extension (KG-RAG-14):** Graph RAG E2E will extend this to verify knowledge graph population and prerequisite-aware plan generation
- Estimator property tests wired into CI (bounds/monotonicity/decay)

✅ done — Node PR at `760152f` on `bloom` (bloom-loop.integration.test.js: real-Mongo loop test — classify objectives via syncObjectivesForDocument, processEvalResult EWMA, getWeakCompetenciesForCourse + degraded mode; idempotency replay skips duplicate; 5/5 passing). Web PR#5 at `de5f6a3` on `feature/bloom-11-competency-map` (competency-e2e.spec.js: Playwright happy path (map renders + topic drill-down with scored rows), empty map state, failed-fetch error with retry; 3/3 passing). Contract parity tests and estimator property tests already merged from EVAL-02b.

---

#### BLOOM-DOC — Educational Reference Document

**User Story:**
As a team, I want a written technical/educational reference for the taxonomy model so that implementation debates resolve against a documented source.

**Domain:** Docs
**Type:** Documentation
**Priority:** Medium
**Estimated Hours:** 2
**Story Points:** 2
**Day:** 1

**Dependencies:** BLOOM-01

**Acceptance Criteria:**
- `docs/education/bloom-taxonomy.md`: 1956 vs 2001 revision; two dimensions; lower vs higher-order split; verb tables; assessment design mapping; competency formula; estimator math
- Cites Anderson & Krathwohl (2001) as primary reference
- Explicitly documents the anti-pattern: "score % ≠ Bloom level"

---

## 16. F15 — Knowledge Graph & Graph RAG Infrastructure (KG-RAG)

> **Coverage scope:** Provides the foundational knowledge-graph layer, Graph RAG retrieval, and domain-specific sub-stores (Pedagogical KB, Misconception KB, Student Knowledge Graph) that extend the basic vector RAG introduced by F05/INGEST. Depends on AI-COM message contracts for ingestion events and F05/SEARCH vector-store patterns.

**Must cover:**

- Knowledge-graph schema (entities, relations, edge properties) stored in Neo4j
- Entity + relation extraction pipeline (LLM-based) triggered during course ingestion
- Graph RAG retrieval service (traversal-based, not flat kNN) exposing a shared client interface
- Pedagogical Knowledge Base (concept hierarchy, prerequisite chains, Bloom verb maps)
- Misconception Knowledge Base (common student misconceptions, corrective paths)
- Student Knowledge Graph (per-user mastery state, prerequisite gaps, learning path graph)
- Reference Answer Store (canonical answers per question, versioned)
- Graph RAG adapters for Planner, Evaluator, Coach, and Search agents

**Stories:**

---

#### KG-RAG-01 — Graph RAG Core Schema & Neo4j Setup

**User Story:**
As a platform architect, I want a defined knowledge-graph schema (Concept, Subtopic, Question, Misconception, Prerequisite, BloomLevel, StudentMastery nodes and edges) with Neo4j storage so that agents can traverse prerequisite chains, misconception paths, and mastery states.

**Domain:** Infrastructure
**Type:** Feature
**Priority:** High
**Estimated Hours:** 8
**Story Points:** 5
**Day:** 1

**Dependencies:** AI-COM-01

**Acceptance Criteria:**
- Neo4j schema DDL in `study-partner-ai/services/knowledge_graph/schema.cypher` with all required node labels and relationship types
- Unique constraints on Concept.id, Subtopic.id, Question.id, Misconrection.id, Student.id
- Index on Concept.name, Subtopic.name for fast lookup
- Unit tests verifying schema creation and constraint enforcement
- Integration tests: create sample graph, verify traversal queries (prerequisite chain, Bloom progression, misconception → corrective path)

---

#### KG-RAG-02 — Entity & Relation Extraction Pipeline

**User Story:**
As a course ingestion pipeline, I want an LLM-powered entity + relation extraction step that parses course content into knowledge-graph nodes and edges so that the graph is populated automatically during ingestion.

**Domain:** Ingestion
**Type:** Feature
**Priority:** High
**Estimated Hours:** 10
**Story Points:** 8
**Day:** 2

**Dependencies:** KG-RAG-01, INGEST-05

**Acceptance Criteria:**
- New module `study-partner-ai/services/knowledge_graph/extractor.py` exposing `extract_entities_relations(content: str) -> ExtractionResult`
- Uses existing LiteLLM routing (config.yaml) for LLM calls; supports all configured models
- Extracts: Concepts, Subtopics, Prerequisite relations, Bloom verb mappings per concept
- Writes extracted entities to Neo4j via `kg_store.write_batch()`
- Includes test fixtures: sample lecture transcript, sample textbook section → verify extracted entities and relations match expected graph structure
- Graceful degradation: if extraction fails for a chunk, log warning and continue with remaining chunks (circuit breaker integration pattern from AI-COM-06)

---

#### KG-RAG-03 — Graph RAG Retrieval Service

**User Story:**
As any AI agent, I want a shared Graph RAG retrieval client that traverses the knowledge graph (following prerequisite chains, Bloom levels, and misconception links) and returns ranked subgraphs so that agents get contextually rich, relation-aware results rather than flat kNN hits.

**Domain:** Shared Service
**Type:** Feature
**Priority:** High
**Estimated Hours:** 12
**Story Points:** 8
**Day:** 3

**Dependencies:** KG-RAG-01, KG-RAG-02

**Acceptance Criteria:**
- `study-partner-ai/services/graph_rag/client.py` exposing `GraphRAGClient`
- Core methods: `retrieve_by_concept(concept_id, max_depth, bloom_level)`, `retrieve_prerequisite_chain(concept_id)`, `retrieve_misconceptions(concept_id)`, `retrieve_similar_situations(student_id, concept_id)`
- Traversal-based retrieval with configurable max_depth (default 3)
- Returns structured `GraphRAGResult` with nodes, edges, confidence scores
- Implements circuit breaker and retry logic (AI-COM-06 pattern)
- Performance: <500ms for traversal queries up to depth 3 on test graph
- Unit tests with mocked graph; integration tests against Neo4j with test data

---

#### KG-RAG-04 — Pedagogical Knowledge Base

**User Story:**
As the Evaluator and Coach agents, I want a curated Pedagogical Knowledge Base (concept hierarchy, prerequisite chains, Bloom verb maps, difficulty calibrations) stored in the knowledge graph so that I can reason about curriculum structure and student progression.

**Domain:** Knowledge Base
**Type:** Feature
**Priority:** High
**Estimated Hours:** 8
**Story Points:** 5
**Day:** 3

**Dependencies:** KG-RAG-01, BLOOM-01

**Acceptance Criteria:**
- Seed data import script `study-partner-ai/services/knowledge_graph/seeds/pedagogical_kb.py` with sample concept hierarchy (50+ concepts, 200+ prerequisite edges, Bloom level assignments)
- Concept nodes include: id, name, domain, bloom_levels (list), difficulty_base
- Prerequisite edges include: required_strength (0.0-1.0), is_hard_prerequisite (bool)
- Bloom verb maps stored as node properties: BloomLevel → list of verbs
- Graph traversal test: given concept X, retrieve full prerequisite chain with Bloom levels
- Documented in `docs/knowledge-graph/pedagogical-kb.md`

---

#### KG-RAG-05 — Misconception Knowledge Base

**User Story:**
As the Evaluator agent, I want a Misconception Knowledge Base mapping common student misconceptions to corrective explanations and prerequisite gaps so that I can diagnose WHY a student got something wrong, not just WHAT they got wrong.

**Domain:** Knowledge Base
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 8
**Story Points:** 5
**Day:** 4

**Dependencies:** KG-RAG-01, BLOOM-01

**Acceptance Criteria:**
- Misconception nodes in Neo4j: id, text, domain, severity (1-5), detected_via (list of question types)
- Misconception → CorrectiveEdge → Concept (the concept the student needs to revisit)
- Misconception → BloomGapEdge → BloomLevel (which cognitive level is missing)
- Seed data: 30+ misconceptions across math, science, programming domains
- Retrieval: given a student's wrong answer pattern, retrieve top-3 likely misconceptions with confidence scores
- Unit tests: wrong answer → misconception mapping matches expected output

---

#### KG-RAG-06 — Reference Answer Store

**User Story:**
As the Evaluator agent, I want a versioned Reference Answer Store where canonical answers (with rubrics, partial-credit rules, and Bloom-level tags) are stored so that I can evaluate student responses against authoritative references.

**Domain:** Knowledge Base
**Type:** Feature
**Priority:** High
**Estimated Hours:** 6
**Story Points:** 5
**Day:** 3

**Dependencies:** INGEST-05, EVAL-02

**Acceptance Criteria:**
- `study-partner-ai/services/knowledge_graph/reference_answers.py` with CRUD operations
- ReferenceAnswer node: id, question_id, canonical_text, rubric (JSON), bloom_level, version, created_at
- Version history: each edit creates a new version, old versions retained
- Retrieval: `get_reference_answer(question_id, version=None)` returns latest or specific version
- Bulk import: CSV/JSON → batch insert for course-level answer keys
- Integration tests: create reference → retrieve → update → verify versioning

---

#### KG-RAG-07 — Student Knowledge Graph & Mastery Tracing

**User Story:**
As the Coach and Scheduler agents, I want a per-student knowledge graph tracking mastery state across concepts and prerequisite gaps so that I can personalize learning paths and recommend next topics.

**Domain:** Student Model
**Type:** Feature
**Priority:** High
**Estimated Hours:** 10
**Story Points:** 8
**Day:** 5

**Dependencies:** KG-RAG-01, KG-RAG-03, BLOOM-02, F14-EST

**Acceptance Criteria:**
- StudentMastery node per student per concept: student_id, concept_id, mastery_score (0.0-1.0), last_assessed, bloom_level_achieved, prerequisite_gaps (list of concept_ids)
- Mastery updates via event listener: when EVAL produces mastery_update event, update StudentMastery node and recompute prerequisite_gaps
- `StudentKGClient` in `study-partner-ai/services/knowledge_graph/student_kg.py`
- Methods: `get_student_mastery(student_id)`, `get_prerequisite_gaps(student_id, concept_id)`, `get_recommended_next(student_id)`
- Recommended-next uses prerequisite chain traversal + mastery scores to suggest lowest-mastery, prerequisite-satisfied concepts
- Integration test: student completes assessment → mastery updated → gaps computed → recommended-next returns correct concepts

---

#### KG-RAG-08 — Planner Agent Graph RAG Integration

**User Story:**
As the Planner agent, I want to use Graph RAG when generating study plans so that prerequisite chains are respected (student can't study Topic B before mastering prerequisite Topic A) and Bloom-level progression is followed.

**Domain:** Planner
**Type:** Feature
**Priority:** High
**Estimated Hours:** 6
**Story Points:** 5
**Day:** 6

**Dependencies:** KG-RAG-03, KG-RAG-07, PLAN-07

**Acceptance Criteria:**
- Planner agent calls `GraphRAGClient.retrieve_prerequisite_chain(concept_id)` before scheduling a concept
- Plan generation respects prerequisite mastery: concept is only scheduled if all hard prerequisites have mastery_score >= 0.7
- Bloom-level ordering enforced: lower-order concepts before higher-order within the same topic
- Integration test: generate plan for a student with known gaps → plan includes remediation for prerequisite gaps before advancing
- Graceful degradation: if KG is unavailable, fall back to flat RAG + warning log (no hard failure)

---

#### KG-RAG-09 — Evaluator Agent RAG Integration

**User Story:**
As the Evaluator agent, I want to use Graph RAG (Reference Answers + Misconception KB + Student KG) when grading responses so that I can provide diagnosis-level feedback, not just correct/incorrect.

**Domain:** Evaluator
**Type:** Feature
**Priority:** High
**Estimated Hours:** 8
**Story Points:** 5
**Day:** 6

**Dependencies:** KG-RAG-03, KG-RAG-05, KG-RAG-06, KG-RAG-07, EVAL-06

**Acceptance Criteria:**
- Evaluator retrieves reference answer via `ReferenceAnswerStore.get_reference_answer(question_id)` before grading
- After grading, evaluator retrieves likely misconceptions via `GraphRAGClient.retrieve_misconceptions(concept_id)` if student answer is incorrect
- Evaluation output includes: `diagnosis` (misconception_id, corrective_explanation, prerequisite_gap_concept_id)
- Student Mastery updated: `StudentKGClient.update_mastery(student_id, concept_id, score, bloom_level_earned)`
- Integration test: student answers incorrectly → evaluator returns misconception diagnosis + prerequisite gap → student mastery updated

---

#### KG-RAG-10 — Coach Agent RAG Integration

**User Story:**
As the Coach agent, I want to use Graph RAG (Student KG + Pedagogical KB + Misconception KB) when providing explanations so that I can tailor explanations to the student's specific gaps and misconceptions.

**Domain:** Coach
**Type:** Feature
**Priority:** High
**Estimated Hours:** 8
**Story Points:** 5
**Day:** 7

**Dependencies:** KG-RAG-03, KG-RAG-07, COACH-09

**Acceptance Criteria:**
- Coach retrieves student mastery state and prerequisite gaps before generating explanation
- Explanation adapts: if prerequisite gap detected, coach includes prerequisite review before the target concept
- If misconception detected in evaluation, coach provides corrective explanation referencing the misconception KB
- Coach history (past explanations, outcomes) stored for future similar-situation retrieval
- Integration test: student has prerequisite gap → coach explanation includes prerequisite review; student has misconception → coach addresses it

---

#### KG-RAG-11 — Search Agent Personal Corpus RAG

**User Story:**
As the Search agent, I want to include the student's ingested course materials in search results so that searches are grounded in the student's actual curriculum, not generic knowledge.

**Domain:** Search
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 6
**Story Points:** 3
**Day:** 7

**Dependencies:** KG-RAG-03, SEARCH-05, INGEST-05

**Acceptance Criteria:**
- Search agent's retrieval pipeline includes course-ingested documents (already in vector store) AND knowledge graph subgraph for the query concept
- Hybrid retrieval: flat kNN (existing) + graph traversal (new) → merged and re-ranked results
- Results tagged with source: "course-material" vs "reference" for transparency
- Integration test: student queries a topic from their course → results include course-specific content + graph-linked prerequisites

---

#### KG-RAG-12 — Reflection Agent RAG

**User Story:**
As the Reflection agent, I want to retrieve past reflections, their outcomes, and correlated learning patterns so that I can generate richer insights and identify recurring themes.

**Domain:** Reflection
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 6
**Story Points:** 3
**Day:** 8

**Dependencies:** KG-RAG-03, REFLECTION-02

**Acceptance Criteria:**
- Reflection agent stores each reflection summary in vector store with student_id, session_id, themes, mood tags
- New retrieval: `ReflectionRAGClient.retrieve_similar_reflections(student_id, themes, k=5)`
- Past reflections surfaced to the reflection prompt as context
- Outcome correlation: if reflection theme X was addressed, track whether subsequent session performance improved
- Integration test: generate reflection → store → generate second reflection → verify first is surfaced as context

---

#### KG-RAG-13 — Graph RAG Observability & Monitoring

**User Story:**
As an SRE, I want observability hooks on all Graph RAG retrieval calls (traversal depth, latency, hit rate, fallback usage) so that I can monitor performance and detect degradation.

**Domain:** Observability
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 4
**Story Points:** 3
**Day:** 8

**Dependencies:** KG-RAG-03, OPS-01

**Acceptance Criteria:**
- All GraphRAGClient methods emit structured logs: concept_id, traversal_depth, latency_ms, result_count, fallback_used
- Prometheus metrics: `graph_rag_traversal_latency_seconds`, `graph_rag_hit_count`, `graph_rag_fallback_total`
- Dashboard panel in Grafana showing Graph RAG health
- Alert: fallback rate > 20% over 5 minutes triggers warning

---

#### KG-RAG-14 — Graph RAG Integration Tests & Load Test

**User Story:**
As a QA engineer, I want end-to-end integration tests and a load test for the full Graph RAG pipeline (extraction → graph population → retrieval → agent integration) so that we verify correctness and performance under realistic conditions.

**Domain:** Testing
**Type:** Feature
**Priority:** Medium
**Estimated Hours:** 6
**Story Points:** 5
**Day:** 9

**Dependencies:** KG-RAG-08, KG-RAG-09, KG-RAG-10, TEST-01

**Acceptance Criteria:**
- Integration test: ingest course content → extraction populates graph → student answers question → evaluator uses graph RAG → coach uses graph RAG → verify full pipeline
- Load test: 100 concurrent retrieval requests, p95 latency < 1s
- Regression test: graph RAG fallback does not break existing flat RAG behavior
- CI wiring: tests run on every PR touching `services/knowledge_graph/` or `services/graph_rag/`

---

#### KG-RAG-15 — Documentation & Runbook

**User Story:**
As a team member, I want comprehensive documentation for the Knowledge Graph & Graph RAG system so that onboarding and debugging are efficient.

**Domain:** Docs
**Type:** Documentation
**Priority:** Medium
**Estimated Hours:** 4
**Story Points:** 3
**Day:** 9

**Dependencies:** KG-RAG-01 through KG-RAG-14

**Acceptance Criteria:**
- `docs/knowledge-graph/architecture.md`: system overview, schema diagram, data flow
- `docs/knowledge-graph/agent-integration.md`: how each agent uses Graph RAG, with code examples
- `docs/knowledge-graph/troubleshooting.md`: common failures, fallback behavior, debugging steps
- `docs/knowledge-graph/performance.md`: tuning guide for traversal depth, index optimization
- Runbook: how to seed new domain data, how to add new misconception types, how to extend schema

---

## 17. Dependency Graph

```
SHARED FOUNDATION
└── F01 (AI Communication & Job Infrastructure)
    ├── AI-COM-01 (RabbitMQ) ──┐
    ├── AI-COM-02 (Msg contract)┼── AI-COM-03 (Result contract)
    ├── AI-COM-04 (Node publisher)      ├── AI-COM-07 (Job persistence)
    ├── AI-COM-05 (Python consumer) ◄───┤
    ├── AI-COM-06 (Retry/DLQ) ◄─────────┤
    ├── AI-COM-08 (Idempotency)         │
    ├── AI-COM-09 (Network isolation) ──┘
    └── AI-COM-10 (Communication test) ◄─ all of the above
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
   F02 Planner   F03 Coach    F04 Evaluator   F05 Search & Ingestion
   ├ PLAN-01 ◄── AI-COM-05   ├ COACH-01 ◄─ AI-COM-05   ├ SEARCH-01 ◄─ AI-COM-05
   ├ PLAN-02 ◄── AI-COM-02   ├ COACH-02 ◄─ AI-COM-02   ├ SEARCH-02 ◄─ AI-COM-02
   ├ PLAN-03..05 (prompt/out) ├ COACH-03..06            ├ SEARCH-03..05 (prompt/out)
   ├ PLAN-06 ◄── AI-COM-06   ├ COACH-08 ◄─ AI-COM-06   ├ SEARCH-06 ◄─ AI-COM-06
   ├ PLAN-07 ◄── AI-COM-07   ├ COACH-09 ◄─ AI-COM-07   ├ SEARCH-07 ◄─ SEARCH-05
   ├ PLAN-08..09 ◄─ PLAN-07   ├ COACH-10 ◄─ COACH-09   ├ SEARCH-08 ◄─ SEARCH-07
   ├ PLAN-10 ◄── PLAN-08      ├ COACH-11 ◄─ COACH-10   │
   └ PLAN-11 ◄── PLAN-05      └ COACH-12 ◄─ COACH-06   ├ INGEST-01..04 (file validation)
                                                       ├ INGEST-05 ◄─ AI-COM-05
                                                       ├ INGEST-06..08 ◄─ AI-COM-06/07
                                                       ├ INGEST-09 ◄─ INGEST-06
                                                       └ INGEST-10 ◄─ INGEST-07

   SECURITY (independent of AI bus)
   F06 — Authentication & Security
   ├ SEC-01..02 (OTP)
   ├ SEC-03..04 (refresh cookie)
   ├ SEC-05..06 (internal auth)
   ├ SEC-07..09 (metrics/errors/ReDoS)
   ├ SEC-10 (mass assignment)
   ├ SEC-11 (uploads) ◄── INGEST-01..04 pattern
   └ SEC-12 (tests) ◄── SEC-01..11

   COGNITIVE COMPETENCY LOOP
   F14 — Bloom Competency Engine
   ├ BLOOM-01/02/DOC ◄── (contracts, no deps — start anytime post-F01)
   ├ BLOOM-03 ◄── AI-COM-06
   ├ BLOOM-04 ◄── INGEST-06 + BLOOM-03
   ├ BLOOM-05..06 ◄── BLOOM-04
   ├ BLOOM-07 ◄── AI-COM-07 + BLOOM-02
   ├ BLOOM-08 ◄── EVAL-08 + BLOOM-07
   ├ BLOOM-09 ◄── BLOOM-08
   ├ BLOOM-10 ◄── PLAN-06 + BLOOM-09   ← closes the loop back into F02 plans
   ├ BLOOM-11 ◄── BLOOM-09
   └ BLOOM-12 ◄── BLOOM-10/11

   KNOWLEDGE GRAPH & GRAPH RAG (F15 — extends F02/F03/F04/F05 with graph traversal)
   F15 — Knowledge Graph & Graph RAG Infrastructure
   ├ KG-RAG-01 (schema) ◄── AI-COM-01
   ├ KG-RAG-02 (extraction) ◄── KG-RAG-01 + INGEST-05
   ├ KG-RAG-03 (retrieval) ◄── KG-RAG-01 + KG-RAG-02
   ├ KG-RAG-04 (pedagogical KB) ◄── KG-RAG-01 + BLOOM-01
   ├ KG-RAG-05 (misconception KB) ◄── KG-RAG-01 + BLOOM-01
   ├ KG-RAG-06 (reference answers) ◄── INGEST-05 + EVAL-02
   ├ KG-RAG-07 (student KG) ◄── KG-RAG-03 + BLOOM-02 + F14-EST
   ├ KG-RAG-08 (Planner integration) ◄── KG-RAG-03 + KG-RAG-07 + PLAN-07
   ├ KG-RAG-09 (Evaluator integration) ◄── KG-RAG-03/05/06/07 + EVAL-06
   ├ KG-RAG-10 (Coach integration) ◄── KG-RAG-03 + KG-RAG-07 + COACH-09
   ├ KG-RAG-11 (Search integration) ◄── KG-RAG-03 + SEARCH-05 + INGEST-05
   ├ KG-RAG-12 (Reflection RAG) ◄── KG-RAG-03 + REFLECTION-02
   ├ KG-RAG-13 (observability) ◄── KG-RAG-03 + OPS-01
   ├ KG-RAG-14 (E2E + load tests) ◄── KG-RAG-08..10 + TEST-01
   └ KG-RAG-15 (docs) ◄── KG-RAG-01..14

   RELIABILITY & SCALABILITY (parallel, independent)
   F07 Study       F08 Gamification   F09 Analytics/Performance
   ├ STUDY-01..02 (async)  ├ GAME-01..02 ◄─ AI-COM-02 pattern  ├ PERF-01..04 (indexes)
   ├ STUDY-03..04 (mass/io) ├ GAME-03..05 (publish)             ├ PERF-05..07 (aggregation)
   ├ STUDY-05..06 (indexes) ├ GAME-06 (idempotency)             ├ PERF-08 (explain CI)
   ├ STUDY-07..09 (N+1)     ├ GAME-07 (retry/DLQ)               ├ PERF-09..10 (Redis)
   └ STUDY-10..11 (tests)   └ GAME-08..10 (tests)               ├ PERF-11 (object storage)
                                                                └ PERF-12 (load test)

   TESTING (feature, runs in parallel from Sprint 1)
   F10 — Testing & Quality
   ├ TEST-01..02 (fix fake tests)     ─── all features
   ├ TEST-03 (hybrid E2E fixture)
   ├ TEST-04..05 ◄── F01..F05 (contracts)
   ├ TEST-06..07 ◄── F06 (security)
   ├ TEST-08 ◄── F02..F05 (prompt injection)
   ├ TEST-09..10 ◄── F06/F05 (uploads/OTP)
   ├ TEST-11 ◄── F02..F05 (full AI E2E)
   ├ TEST-12 ◄── TEST-03 + TEST-11 (user journey)
   └ TEST-13..14 ◄── PERF-12 / TEST-02

   INFRASTRUCTURE & DEPLOYMENT (Sprint 4)
   F11 — Infrastructure & Deployment
   ├ INFRA-01..03 (blocking scans)      ─── all features
   ├ INFRA-04..06 (container hardening)
   ├ INFRA-07 ◄── AI-COM-01 (RabbitMQ)
   ├ INFRA-08 ◄── PERF-09 (Redis)
   ├ INFRA-09 (staging) ◄── INFRA-04..08
   ├ INFRA-10 (migrations) ◄── INFRA-09
   ├ INFRA-11 (deploy) ◄── INFRA-09/10
   ├ INFRA-12 (rollback) ◄── INFRA-11
   └ INFRA-13 (env matrix) ◄── INFRA-09..12

   OBSERVABILITY & DR (Sprint 4, parallel)
   F13 — Observability & Disaster Recovery
   ├ OPS-01..02 (logging/request IDs)   ─── all features
   ├ OPS-03..06 ◄── F01 (AI metrics)
   ├ OPS-07..09 (Prometheus/Grafana/alerts) ◄── OPS-03..06
   ├ OPS-10 (OTel) ◄── OPS-02
   ├ OPS-11..13 (backups)               ─── independent
   ├ OPS-14 (restore drill) ◄── OPS-13
   └ OPS-15..16 (runbook/RPO) ◄── OPS-11..14

   UX (last, after blockers)
   F12 — UX & Frontend Quality ◄── stability of F02/F07
```

---

## 18. Team Workload Projection

### Assumptions

- 3 developers (Dev A — Backend, Dev B — AI, Dev C — Frontend/QA/DevOps)
- Each developer works ~4–5 hours/day on stories
- F01 is the shared foundation; all developers touch it in Sprint 1
- F10 (Testing) runs in parallel every sprint; TEST-01/02/03 are early so the suite is trustworthy before features land

### Sprint 1 (Days 1–5): AI Foundation — F01 + F10 kickoff

| Developer | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Total |
|-----------|-------|-------|-------|-------|-------|-------|
| **Dev A** | AI-COM-02 (contract) 3h | AI-COM-04 (publisher) 4h | AI-COM-07 (persistence) 4h | AI-COM-07 1h + PLAN-02 2h | PLAN-01 3h (contract partner) | 13h |
| **Dev B** | AI-COM-03 3h (result contract) | AI-COM-05 (consumer framework) 5h | AI-COM-06 (retry/DLQ) 3h | AI-COM-06 2h + AI-COM-08 3h | PLAN-03 (prompt isolation) 5h | 13h |
| **Dev C** | AI-COM-01 (RabbitMQ infra) 4h | AI-COM-09 (network isolation) 2h + TEST-01 3h | TEST-02 1h + TEST-03 (hybrid fixture) 3h | TEST-04 (contract tests) 3h | AI-COM-10 (comm test) 4h + TEST-14 1h | 14h |

**Sprint 1 gate:** AI-COM-10 green — one real AI job round-trips through RabbitMQ.

### Sprint 2 (Days 1–5): AI Features + Security

| Developer | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Total |
|-----------|-------|-------|-------|-------|-------|-------|
| **Dev A** | PLAN-02 2h + SEC-01/02 (OTP) 4h | SEC-03 (refresh cookie) 3h + SEC-05 2h | SEC-05 1h + SEC-06/07 2h + SEC-08 2h | SEC-09/10 4h | SEC-11 2h + PLAN-07 3h | 14h |
| **Dev B** | COACH-01 3h + EVAL-01 5h | COACH-02 2h + EVAL-02 2h + PLAN-03 1h | COACH-03 5h + EVAL-03 2h | EVAL-04/05 5h + COACH-05 2h | EVAL-06 3h + COACH-06 2h | 14h |
| **Dev C** | TEST-06 (auth negative) 3h | TEST-07 (authz negative) 3h + SEC-04 1h | TEST-08 (prompt injection) 3h | TEST-09/10 (upload/OTP) 4h | TEST-05 (AI contracts) 3h + TEST-03 fin 1h | 14h |

### Sprint 3 (Days 1–5): Reliability, Gamification, Performance

| Developer | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Total |
|-----------|-------|-------|-------|-------|-------|-------|
| **Dev A** | STUDY-01/02 (async) 3h + PERF-01/02 2h | STUDY-03/04 5h | STUDY-05/06/07 4h | STUDY-08/09 3h + PERF-05 1h | PERF-05/06/07 4h + PERF-08 1h | 14h |
| **Dev B** | GAME-01/02 5h | GAME-03 3h + GAME-04 3h | GAME-05 3h + GAME-06 3h | GAME-07 2h + SEARCH-01 3h | SEARCH-03 5h | 14h |
| **Dev C** | PERF-09 (Redis auth) 1h + TEST-11 setup 3h | TEST-11 5h | PERF-12 (load smoke) 3h + STUDY-10 2h | STUDY-11 3h + PERF-10 2h | PERF-11 (object storage) 5h | 14h |

### Sprint 4 (Days 1–5): Infrastructure, Observability, UX start

| Developer | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Total |
|-----------|-------|-------|-------|-------|-------|-------|
| **Dev A** | OPS-01/02 4h | OPS-03 2h + INFRA-10 2h | OPS-10 3h | PERF-11 fin 3h + GAME-08 2h | TEST-12 support 4h | 13h |
| **Dev B** | OPS-05/06 4h | OPS-06 fin 2h + SEARCH-04/05 3h | SEARCH-06/07 3h + INGEST-09 2h | INGEST-09 3h + GAME-09 2h | TEST-08 consolidated 3h + GAME-10 2h | 14h |
| **Dev C** | INFRA-01..03 (blocking scans) 3h | INFRA-04..06 (container hardening) 4h | INFRA-07/08 2h + INFRA-09 3h | INFRA-10/11 4h | INFRA-12/13 4h + OPS-04 1h | 14h |

### Sprint 5 (Days 1–5): Deploy, DR, UX

| Developer | Day 1 | Day 2 | Day 3 | Day 4 | Day 5 | Total |
|-----------|-------|-------|-------|-------|-------|-------|
| **Dev A** | TEST-12 (journey E2E) 5h | TEST-12 fin 3h + INFRA-13 2h | DR review 2h + OPS-15 2h | GAME-08..10 fin 3h | Release support 4h | 12h |
| **Dev B** | INGEST-10 5h | INGEST-10 fin 3h + OPS-05 2h | COACH/EVAL E2E support 4h | SEARCH-08 3h | Release support 4h | 13h |
| **Dev C** | OPS-07 (Prometheus) 3h + OPS-11 2h | OPS-08 (Grafana) 3h + OPS-12 2h | OPS-09 (alerts) 3h + OPS-13 2h | OPS-14 (restore drill) 2h + UX-01/02 2h | UX-03/04 3h + INFRA-12 rollback drill 2h | 13h |

### Critical path (the dependency chain that must not slip)

```
AI-COM-01 → AI-COM-02 → AI-COM-04/05 → AI-COM-10 (Sprint 1 gate)
   → PLAN-01..08 → PLAN-10 (Sprint 2)
   → TEST-11 → TEST-12 (Sprint 3-4 gate)
   → INFRA-09 → INFRA-11 → INFRA-12 (Sprint 4-5 deploy)
```

### F14 insertion (added v1.1)

The Bloom Competency Engine (~44 h, 13 stories) was added after the v1.0 scope was frozen. Scheduling options:

- **Recommended: Sprint 6** — the competency loop only delivers value once INGEST (Sprint 3) and EVAL (Sprint 2) produce evidence
- **Alternative:** BLOOM-01/02/DOC (contracts, zero deps) slot into spare capacity immediately; BLOOM-10/11 are Medium priority and deferrable to post-MVP if Sprint 6 slips
- The loop closes back into F02: BLOOM-10 makes "personalized plan" measurable — do not market personalization until it ships

### F15 insertion (added v1.2)

The Knowledge Graph & Graph RAG Infrastructure (~100 h, 15 stories) was added to cover advanced retrieval needs identified across all AI agents. Scheduling options:

- **Recommended: Sprint 7** — KG-RAG depends on F05/INGEST (Sprint 3) for entity extraction triggers, BLOOM (Sprint 6) for mastery data, and EVAL (Sprint 2) for reference answers
- **Early start:** KG-RAG-01 (schema) and KG-RAG-04/05 (Pedagogical KB, Misconception KB) can start in Sprint 6 alongside BLOOM since they share Bloom data
- **Critical path:** KG-RAG-01 → KG-RAG-02 → KG-RAG-03 → KG-RAG-08/09/10 (agent integrations) → KG-RAG-14 (E2E tests)
- The Graph RAG layer is the single most impactful capability upgrade: it transforms flat kNN retrieval into relation-aware subgraph retrieval for Planner, Evaluator, Coach, and Search agents

---

## 19. Shared Foundation

The RabbitMQ AI job infrastructure (F01) is the single most important shared artifact. Every AI feature depends on it.

### Shared Node artifacts (`study-partner-api/shared/`)

| Artifact | Purpose | Consumers |
|----------|---------|-----------|
| `ai-messaging/publisher.js` | AI-COM-04 publisher (envelope + reconnect) | ai-orchestrator, study, auth (for events) |
| `ai-messaging/envelope.js` | AI-COM-02/03 envelope validation | all producers/consumers |
| `ai-messaging/dlq-replay.js` | AI-COM-06 DLQ replay ops tool | ai-orchestrator operators |
| `bloom/taxonomy.js` | BLOOM-01 taxonomy enums + verb maps | ai-orchestrator, study, web |
| `middleware/internalAuth.js` | SEC-05 internal-service auth | all services |
| `middleware/asyncHandler.js` | STUDY-01 async wrapping | all services |
| `utils/awardXp.js` | GAME-03 unified XP event publisher | study, user-profile |
| `config/envValidator.js` | SEC-06 fail-fast secret validation | all services |

### Shared Python artifacts (`study-partner-ai/`)

| Artifact | Purpose | Consumers |
|----------|---------|-----------|
| `workers/base.py` | AI-COM-05 `BaseAIWorker` | Planner/Coach/Evaluator/Search/Ingestion/Knowledge workers |
| `messaging/envelope.py` | AI-COM-02/03 Pydantic envelope | all workers |
| `bloom/taxonomy.py` | BLOOM-01 Python taxonomy mirror | knowledge extraction, evaluator |
| `llm/client.py` | COACH-07 unified LLM client | all agents |
| `security/prompt_guard.py` | PLAN-03/COACH-03/EVAL-03/SEARCH-03/BLOOM-04 prompt isolation | all agents |
| `security/url_guard.py` | SEARCH-03 SSRF protection | search agent |
| `db/client.py` | shared async Mongo client | all agents |
| `vector/embedder.py` | shared SentenceTransformer singleton | planner + ingestion |
| `knowledge_graph/schema.py` | KG-RAG-01 graph schema definitions | knowledge graph, all agents |
| `knowledge_graph/extractor.py` | KG-RAG-02 entity/relation extraction | ingestion pipeline |
| `graph_rag/client.py` | KG-RAG-03 shared Graph RAG client | planner, evaluator, coach, search, reflection |

### Sequencing rules

1. **F01 before F02–F05** — no AI feature migrates until AI-COM-10 passes
2. **TEST-01/02/03 before feature work lands** — the suite must be trustworthy first
3. **SEC-01..04 before GA** — token/OTP security are P0
4. **INFRA-01..03 before any deploy** — security scans must block
5. **OPS-11..14 before real data** — backups must be recoverable
6. **F12 (UX) after stability** — only after F02/F07 are solid
7. **F15 (KG-RAG) after F05 + F14** — Graph RAG needs course ingestion data and Bloom competency data; early schema work (KG-RAG-01, KG-RAG-04/05) can start in Sprint 6

---

_End of backlog. Every story traces to a finding in `study_partner_audit_2026.md`; all AI stories depend on the RabbitMQ architecture decision documented in this backlog's F01._

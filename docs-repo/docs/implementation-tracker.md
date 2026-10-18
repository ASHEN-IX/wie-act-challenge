# MindFlow Implementation Tracker

_Live progress guide derived from `backlog.md` (v1.0) and `study_partner_audit_2026.md`._
_Update the status column as stories are completed. Do not reorder IDs._

**Legend:** `[x]` Done · `[~]` In progress · `[ ]` Not started
**Priority:** C = Critical (audit P0) · H = High (P1) · M = Medium (P2) · L = Low (P3)

**Last updated:** 2026-09-14 (SEC-12 regression suite in `origin/security` as `1f8036f`; **F06 complete 12/12**)

---

## Progress Summary

| Feature | Stories | Done | In progress | Status |
|---|---|---|---|---|
| F01 AI Communication & Jobs | 10 | 10 | 0 | ✅ Complete — Sprint 1 gate passed, silent-drop hole closed |
| F02 AI Planner | 11 | 11 | 0 | ✅ Complete — all stories done |
| F03 AI Coach | 17 | 16 | 0 | 🔄 |
| F04 AI Evaluator | 11 | 10 | 0 | 🔄 |
| F05 Search & Ingestion | 18 | 18 | 0 | ✅ Complete — SEARCH-01..08 + INGEST-01..10 all done; fully merged across web/AI/API |
| F06 Auth & Security | 12 | 12 | 0 | ✅ |
| F07 Study Reliability | 11 | 2 | 0 | 🔄 |
| F08 Gamification Events | 10 | 0 | 0 | ⬜ |
| F09 Analytics & Performance | 12 | 0 | 0 | ⬜ |
| F10 Testing & Quality | 14 | 1 | 2 | 🔄 |
| F11 Infrastructure & Deploy | 13 | 0 | 0 | ⬜ |
| F12 UX & Frontend | 12 | 0 | 0 | ⬜ |
| F13 Observability & DR | 16 | 1 | 0 | 🔄 |
| F14 Bloom Competency Engine | 14 | 14 | 0 | 🔄 BLOOM-01..12 done — contracts, extraction, classification, persistence + estimator + profile updater + read API + planner weakest-first targeting + frontend competency map + E2E validation loop |
| F15 Knowledge Graph & Graph RAG | 15 | 0 | 0 | ⬜ Added v1.2 — schema startable in Sprint 6 |

---

## F01 — AI Communication & Job Infrastructure (Sprint 1, CRITICAL PATH)

- [x] **AI-COM-01** RabbitMQ in compose: creds/vhost/persistent volume/healthcheck/loopback-only ports (dev+prod) — *C*
- [x] **AI-COM-02** Job envelope contract: Node `shared/ai-messaging/envelope.js` + Pydantic `messaging/envelope.py` + `docs/contracts/ai-message-contract.md` — *C*
- [x] **AI-COM-03** Result envelope contract with sanitized-error enforcement — *C*
- [x] **AI-COM-04** Node publisher (`publisher.js`): confirms+backoff+heartbeat, result consumer, unit tests — *C*
  - `mandatory:true` + return tracking → `ENOROUTE` (no silent drop when a queue is missing); orchestrator boot declares topology for all job types
- [x] **AI-COM-05** Python `BaseAIWorker`: validate/dispatch/ACK-NACK/prefetch=1/SIGTERM drain, unit tests — *C*
- [x] **AI-COM-06** Retry/DLQ topology + classification done both sides (parity-tested); DLQ replay tool + v2 migration runbook shipped — *C*
  - v2 topology: per-type delay queues `ai.delay.<type>.<ms>` + retry routing keys `retry.<type>.<ms>` (dead-lettering preserves the CURRENT key, so work queues carry extra retry-key bindings and pin `x-dead-letter-routing-key` for the DLX hop)
  - Replay tool: `shared/ai-messaging/dlq-replay.js` (fresh messageId per replay → fresh idempotency claim; correlationId preserved; dry-run mode)
  - Runbook: `docs/runbooks/rabbitmq-topology-v2-migration.md`
- [x] **AI-COM-07** `AiJob` model + enforced state machine + `/api/v1/ai/jobs` API (202 pattern) + result correlation, integration tests — *C*
  - POST persists the job BEFORE publishing (fast-worker race fix); publish failure rolls back → 503
- [x] **AI-COM-08** Idempotency by messageId: Redis SETNX / in-memory stores w/ TTL, duplicate-ACK tested — *C*
  - Claim key is `<messageId>:<attempt>` — retries reuse messageId by design
- [x] **AI-COM-09** Network isolation verification test (compose contract assertions in jest) — *C*
- [x] **AI-COM-10** Round-trip integration test (SPRINT 1 GATE): Node→Rabbit→Python stub→Rabbit→Node→Mongo, happy path COMPLETED + retry-exhaustion DLQ/FAILED — *C*

## F02 — AI Planner (Sprint 1–2)

- [x] **PLAN-01** PlannerWorker consumes `study.plan.generate` — *C* · deps: AI-COM-05
  - Wraps PlannerAgent; lazy init; payload→PlannerInput mapping (identity from envelope only)
  - `asyncio.to_thread` off-loop; malformed input → TerminalError; 9 unit tests
  - AC "no direct HTTP exposure": fulfilled by PLAN-08 (plans.js migrated to job bus)
- [x] **PLAN-02** Planner input schema w/ length limits — *C* · deps: AI-COM-02
  - Python: `workers/schemas.py` — PlannerRequest with GOAL_MAX_CHARS=500, CONCEPTS_MAX_ITEMS=50
  - Node: `shared/ai-messaging/payloadSchemas.js` — mirrors Python limits, wired into orchestrator jobs.js
  - `to_planner_input()` maps to PlannerInput with identity from envelope
- [x] **PLAN-03** Prompt isolation / untrusted delimiters — *C* · deps: PLAN-01
  - `security/prompt_guard.py` — `wrap_untrusted()` nonce-delimited markers, `sanitize_untrusted()`
  - `build_system_block()` for system instructions; 20KB cap on untrusted content
  - `llm_decomposer_real.py` uses `wrap_untrusted()` + `build_system_block()` for goal/concepts
- [x] **PLAN-04** PlannerOutput strict schema — *C* · deps: PLAN-01
  - Pydantic v2 schemas: PlannerInput, PlannerOutput, AtomicTask, TaskGraph in `models/task_graph.py`
  - `workers/schemas.py` — PlannerRequest validates goal length, concepts bounds, available_minutes 1–10080
- [x] **PLAN-05** Output validation (ranges, evidence, retry-once) — *C* · deps: PLAN-04
  - `agents/planner/output_validation.py` — `validate_plan_output()` checks empty tasks, duplicates, prereq coherence
  - `llm_decomposer_real.py` — one correction retry on parse failure via `_call_llm()` returning None sentinel
- [x] **PLAN-06** Retry/fallback to SimpleGoalDecomposer — *C* · deps: AI-COM-06
  - `BaseAIWorker.current_attempt` exposed for subclass fallback logic
  - PlannerWorker catches RetryableError at final attempt → `_fallback_result()` via SimpleGoalDecomposer
  - Fallback output marked with `fallbackUsed: true` in result payload
- [x] **PLAN-07** Plan result persistence (idempotent) — *C* · deps: AI-COM-07
  - `jobResultConsumer.js` correlates via correlationId, stores full plan payload in AiJob.result
  - `AiJob.completeByCorrelation()` is idempotent (replayed results ignored once terminal)
  - `fallbackUsed` flag persisted in AiJob alongside result payload
- [x] **PLAN-08** `POST /plans/generate` → 202 jobId + status endpoint — *C* · deps: PLAN-07
  - `plans.js` `/create` route calls orchestrator POST /jobs (creates AiJob + publishes), returns 202
  - `plans.js` `/create-status` route finalises: reads AiJob, persists StudyPlan + Tasks
  - Removed direct HTTP call to Python AI service (was sync + mock fallback)
- [x] **PLAN-09** Frontend async job polling UI — *H* · deps: PLAN-08
  - `SubjectDetail.jsx` — polls `aiAPI.getJobStatus(jobId)` every 2s while job is PROCESSING
  - On COMPLETED: calls `studyPlanAPI.finalize(correlationId)` to persist plan, navigates to /planner
  - On FAILED: shows error, clears generatingPlan state
  - `api.js` — added `aiAPI.getJobStatus()` and `studyPlanAPI.finalize()`
- [x] **PLAN-10** Planner E2E — *H* · deps: PLAN-08
  - `ai-roundtrip.integration.test.js` — 4/4 pass with live RabbitMQ (happy path + DLQ + network isolation)
  - `e2e/planner-e2e.spec.js` — Playwright test covering async polling flow + validation error
  - Happy path: stub worker returns canned plan → result consumer persists → frontend polls → COMPLETED → finalize
  - Negative path: course not completed → validation error shown, no job created
- [x] **PLAN-11** Prompt-injection regression tests — *C* · deps: PLAN-05
  - `tests/test_prompt_guard.py` — 13 tests covering nonce wrapping, sanitization, system block separation
  - Verifies decomposer wraps goal and concepts inside untrusted markers
  - Canonical attack strings: instruction override, SQL injection, XSS, Log4Shell, oversized input

## F03 — AI Coach (Sprint 2–3)

- [x] **COACH-01** CoachWorker consumes `study.coach.nudge` — *H* · deps: AI-COM-05
  - `workers/coach_worker.py` — `CoachWorker(BaseAIWorker)`, lazy `AIOrchestrator`, payload→context validation (terminal on malformed input), identity from `envelope.userId`
  - `asyncio.to_thread` off-loop; result payload = JSON-safe `CoachAction` dump (mode="json")
  - HTTP decision path removed: `services/api/routers/coaching.py` no longer exposes `POST /api/ai/coach/decision`; passive history read kept
  - 14 unit tests in `tests/test_coach_worker.py`
- [x] **COACH-02** CoachRequest bounded schema — *H* · deps: AI-COM-02
  - `CoachRequest`/`CoachSignal`/`CoachMessage` in `workers/schemas.py` (+ limits: signals ≤ 20, messages ≤ 40 each ≤ 2000 chars, session_id ≤ 64 chars, total payload ≤ 16 KB)
  - `CoachWorker` validates through the schema (`extra="forbid"`, `userId` only from the envelope); malformed → terminal
  - Node mirror `validateCoachPayload` in `payloadSchemas.js` with identical limits (defense at the edge, jobs route rejects pre-publish)
  - 21 worker unit tests (Python 88/88) + 7 schema parity tests (Node 22/22)
- [x] **COACH-03** Prompt isolation (chat content) — *C* · deps: COACH-01
  - `build_user_prompt` routes all user text (task titles, subject, key concepts, chat/history messages) through `prompt_guard.wrap_untrusted` (nonce-delimited UNTRUSTED DATA)
  - System instructions kept in a separate `build_system_block`; `call_gemini` honours the boundary
  - Full `CoachInput` dump (audit `llm_decider.py:218–224`) eliminated — trusted state rendered separately
  - 5 regression tests in `tests/test_coach_prompt_isolation.py` (100/100 suite green)
- [x] **COACH-04** Context windowing + PII exclusion — *H* · deps: COACH-03
  - New `agents/coach/context/preprocess.py`: `window_history` (recent actions capped by count
    + age), `downsample_signals` (≤K evenly-spaced points, oldest→newest), `redact_pii`
    (emails → `[EMAIL_REDACTED]`, titled names + explicit blocklist → `[NAME_REDACTED]`)
  - Config-driven windows via env: `COACH_HISTORY_LIMIT`, `COACH_HISTORY_WINDOW_MINUTES`,
    `COACH_SIGNAL_MAX_POINTS`, `COACH_SIGNAL_WINDOW_MINUTES`, `COACH_REDACT_EMAILS`,
    `COACH_REDACT_NAMES`, `COACH_REDACTED_NAMES`
  - Wired: `decide_with_llm` windows `recent_history`; `build_user_prompt` redacts every
    untrusted string before wrapping (PII never reaches the prompt)
  - Signal-series consumer lands with COACH-13; downsampler ready + tested
  - 20 tests in `tests/test_coach_context_preprocessing.py` (120/120 suite green)
- [x] **COACH-05** CoachOutput schema — *H* · deps: COACH-01
  - `CoachOutput` strict model: `nudge_text` 1–500, `intensity` 0.0–1.0, `category` enum
    (motivation/focus/fatigue/break); `CoachAction` gains optional `nudge` + sanitized `coach_error`
  - New `agents/coach/decision/output_parser.py`: `parse_response` (fence-tolerant JSON),
    `extract_coach_output` (nested `nudge`, top-level fields, legacy `message` fallback;
    intensity/category defaulted only when absent, validated when present), `safe_fallback_nudge`
  - `_DECISION_INSTRUCTIONS` now requires the `nudge` object on every response
  - `decide_with_llm` builds the decision first, then validates the nudge; parse/validation
    failures → sanitized `coach_error` (field paths only, no raw LLM content) + fixed fallback nudge
  - 23 tests in `tests/test_coach_output_schema.py` (143/143 suite green)
- [x] **COACH-06** Output validation + content policy — *H* · deps: COACH-05
  - New `agents/coach/decision/output_validator.py`: `strip_html`/`sanitize_nudge` (plain text only),
    `match_content_policy` (phrase-based term filter: self-harm, harassment, violence, unsafe +
    `COACH_POLICY_EXTRA_TERMS` env), `check_coach_output` (shape + policy + LLM-guard fallback),
    `gemini_content_guard`, `CoachOutputRejectedError`
  - `decide_with_llm` probes once, then makes ONE correction retry with a rejection note; a second
    failure raises `CoachOutputRejectedError` (sanitized reason — no raw LLM content) → job FAILED
  - Silence decisions short-circuit (no nudge required); unsafe → first call returns corrected nudge
  - `CoachWorker` escalates rejection → `TerminalError` (terminal, dead-lettered); planner-style
    `rejected by validation` failure semantics
  - 18 tests in `tests/test_coach_output_validation.py` (161/161 suite green)
- [x] **COACH-07** Unified LLM client (`llm_client.py`) — *M* · deps: COACH-01
  - New shared `utils/llm_client.py` (LiteLLM): `ask(agent, system, user, ...)`, lazy `Router` built
    straight from `litellm/config.yaml`, guarded system block (prompt_guard) for every agent
  - New `litellm/config.yaml` mirroring hackership-ai layout: `model_list` per-agent deployments +
    `router_settings` (num_retries/allowed_fails/retry_after/cooldown_time) + `fallbacks` chains
  - Per-agent model routing: coach→gemini-2.0-flash, planner→nvidia_nim/deepseek-r1,
    search→openrouter/llama-3.3-70b, reflection→nvidia_nim/llama-3.3-70b,
    course_ingestion→groq/llama-3.1-8b-instant, evaluator→gemini-2.0-flash; keys via
    `os.environ/KEY` (GEMINI/GROQ/NVIDIA/OPENROUTER); all reconfigurable in the YAML, no code
  - New deps: `litellm`, `PyYAML` in pyproject.toml
  - Coach `llm_decider.call_gemini` now delegates to `ask("coach", ...)`; `google.generativeai`
    SDK usage removed from the coach; no-key/`LLM_MOCK=1`/dummy-key → coach mock responder;
    `LLMRequestError` → mock fallback (same degradation as before)
  - Remaining agents (planner/search/reflection/ingestion/evaluator) deferred to **S-MIG-01**
  - 15 tests in `tests/test_llm_client.py` (158/158 suite green)
- [x] **S-MIG-01** LiteLLM migration sprint (fixing-errors) — *M* · deps: COACH-07
  - All remaining agents migrated onto `utils/llm_client.ask(...)`: planner decomposer
    (`ask("planner", ...)`, one-correction retry kept, no-key → rule fallback), search
    (`ask("search", ...)`, `""` degrade), reflection (`ask("reflection", ...)`, src + legacy
    app service), course ingestion enricher + task generator (`ask("course_ingestion", ...)`),
    evaluator (`ask("evaluator", ...)`; `GeminiClient` kept as thin wrapper, template fallback)
  - Retired: LM Studio REST call sites, `groq` client, evaluator `QwenClient`/`google-genai`
    SDK wiring; `google-generativeai` removed from pyproject.toml + Dockerfile
  - Per-agent no-key degradation preserved (rule engine / `""` / template fallback)
  - `tests/test_prompt_guard.py` updated for `_build_prompt`; 158/158 suite green
  - Branched + pushed `origin/s-mig-01`
- [x] **COACH-08** Rule-engine fallback after retries — *H* · deps: AI-COM-06
  - `llm_decider.call_gemini`: `MissingMockResponderError` → mock degrade (no key / mock mode);
    real `LLMRequestError` (timeout/quota) → `raise RetryableError(...)` so the shared AI-COM-06
    retry/DLQ policy owns recovery
  - `CoachWorker.handle`: `CoachOutputRejectedError` → `TerminalError` (COACH-06, terminal);
    `RetryableError` at `current_attempt >= MAX_RETRIES` → `_fallback_result`, otherwise re-raise
  - `_fallback_result`: `apply_rules` with a guaranteed `safe_fallback_nudge` when no hard rule
    fires; fallback decision still sanitized + validated via `check_coach_output`; result carries
    `fallbackUsed: true`
  - Restored missing `import os` in `llm_decider` (pre-existing `NameError` in `_has_real_api_key`
    surfaced once the mock-degrade path was reachable)
  - **PLAN-06 parity:** planner retry/fallback made live — `llm_decomposer_real._completion` now
    raises `RetryableError` on `LLMRequestError` so `PlannerWorker`'s `_fallback_result`
    (SimpleGoalDecomposer) actually fires instead of dead-lettering
  - New `tests/test_coach_retry.py` + coach/planner worker additions; 185/185 green
  - Branched + pushed `origin/coach-08`
- [x] **COACH-09** Coach history persistence (idempotent) — *H* · deps: AI-COM-07
  - `CoachHistoryRepository.save_action` → `update_one({"trace_id": ...}, {"$setOnInsert": doc},
    upsert=True)`: a matched trace_id is a no-op, so retried/redelivered jobs cannot duplicate
    history rows (idempotent by `correlationId`, stored as `correlation_id` field)
  - Unique index `uniq_coach_actions_trace_id` on `trace_id` created best-effort in `_ensure_index`
    (database-level race guard)
  - `CoachWorker.handle` persists every completed decision (normal + rule-engine fallback) before
    the result publishes — off the event loop, repository no-ops when Mongo is unavailable;
    TerminalError / sub-max RetryableError paths never reach persistence → no partial records
  - `_fallback_result` → `_fallback_action` (returns CoachAction); `_build_coach_input` extracted
    and shared by fallback + persistence
  - Repo + worker tests added/updated; 190/190 suite green
  - Branched + pushed `origin/coach-09`
- [x] **COACH-10** Nudge API → 202 jobId — *H* · deps: COACH-09
  - `POST /api/v1/coach/nudge` (study service, `services/study/src/routes/coach.js`): validates
    nudge fields, resolves the authenticated user's active `StudySession` (or an owned, still-active
    `session_id`), publishes a `study.coach.nudge` job to the orchestrator bus, returns
    `202 { status, jobId, correlationId }`
  - `GET /api/v1/coach/jobs/:jobId` reads `ai_jobs` owner-scoped (`{ jobId, userId }`) → status + result/nudge
  - Gateway proxies `/api/v1/coach` → study-service and documents both endpoints in the OpenAPI spec
  - 8 new jest tests (202/400/404/503, session ownership, `current_time` default, cross-user scoping);
    `services/study` coach suite green, no regressions (5 pre-existing suite failures on base unchanged)
  - Branched + pushed `origin/coach-10`
- [x] **COACH-11** Coach E2E — *H* · deps: COACH-10
  - Backend round-trip on the real job bus: `POST /api/v1/coach/nudge` → 202 → real `CoachWorker`
    (`LLM_MOCK=1`) consumes `study.coach.nudge` → result consumer marks the `AiJob` COMPLETED with
    the validated `CoachOutput` nudge → owner-scoped `GET /api/v1/coach/jobs/:jobId` returns it;
    `correlationId` intact end-to-end, coach history persisted idempotently (COACH-09)
  - New `tests/e2e_coach_worker.py` spawns the real worker for the harness
    (`coach-roundtrip.integration.test.js`, real RabbitMQ; skips cleanly without a broker)
  - `services/study` unit suite grown to 9 (new 401 negative: unauthenticated nudge rejected)
  - Playwright `e2e/coach-nudge.spec.js`: mocked login → start session → `/api/v1/ai/coach` decision
    → nudge rendered in the coach popup (`.coach-popup`); voice-personalized nudge UI lands later
  - Bug fixed on the bus path: aware `current_time` (Node ISO instant) normalized to naive UTC at
    `run_coach` entry so `is_late`/staleness checks no longer compare aware vs naive datetimes
  - Branched + pushed `origin/coach-11` (api + ai + web); docs on `main`
- [x] **COACH-12** Coach injection tests — *H* · deps: COACH-06
  - New `tests/test_coach_prompt_injection.py` (116 tests) — coach-specific prompt-injection
    regressions over the shared nonce-delimited UNTRUSTED blocks (`security/prompt_guard` +
    `agents.coach.decision.prompt`)
  - Injection payloads embedded in chat/history messages, task titles, subjects and key
    concepts: each must appear ONLY inside its labelled UNTRUSTED block — never in the trusted
    signal-state JSON, decision instructions, or SYSTEM_PROMPT; forged `<<<END_UNTRUSTED_...>>>`
    markers stay inert; PII (emails, titled names) redacted before wrapping
  - AC#2 proven with a mocked LLM: a deterministic responder derives the nudge solely from the
    trusted state block; category/intensity/message identical across every probe and channel combo
  - Suite green 306/306 (190 prior + 116 new); branched + pushed `origin/coach-12`

### F03 expansion — adaptive coach beyond nudges (Sprint 3)

Implement feature by feature, only after the nudge path (COACH-01–12) is live.

- [x] **COACH-13** Session stats feed into coach context — *H* · deps: COACH-01
  - `SessionStats` bounded schema (progress_pct, minutes_elapsed, task_switches,
    break_count, current_streak_days) supplied in the `study.coach.nudge` payload
  - Derived server-side from the active `StudySession` (`progress = taskProgress`,
    minutes from `startTime`, switches = `currentTaskIndex`, breaks from
    `breakStats`) + the gamification streak; every figure clamped to its bound and
    mirrored in `payloadSchemas.js` ⟷ `workers.schemas.py` — clients can never spoof stats
  - `CoachInput` extended; missing/stale stats default to 0, never fail the job
    (orchestrator re-resolves defensively); stats reach the LLM inside the TRUSTED
    state block + new system/decision guidance uses them
  - Unit + live-bus round trip green (336 python, 200 api, 2/2 broker);
    branched + pushed `origin/coach-13` (api + ai)
- [x] **COACH-14** Course & subject awareness (catalog context) — *H* · deps: COACH-13
  - `CourseRepository` reads the shared `courses`/`subjects` collections; newest ≤ 10
    courses reduced to subject + title + ≤ 15 key concepts (no files/urls/descriptions)
  - Session `taskProgress.currentTaskIndex` task mapped to course subject via
    `courseId → subjectId → subjects.name`
  - Catalog reaches the prompt ONLY as UNTRUSTED DATA (COURSE / COURSE_CONCEPTS
    channels); the trusted state carries just the count; current-task subject context
    is already a wrapped channel — injection-safe
  - Catalog + current-task resolve independently, so an outage degrades to
    task-title-only (or catalog-only) and never fails the job; no PII carried
  - 413 python / 33 api-jest / 2 live roundtrip green; branched + pushed
    `origin/coach-14` (ai)
  - Coach loads the user's enrolled courses/subjects from the courses catalog; current task mapped to its subject
  - Bounded context (≤ 10 newest courses, no PII); catalog failure degrades to task-title-only
- [ ] **COACH-15** Emotion detection ML adapter — *H* · deps: COACH-13
  - `EmotionAdapter` produces `affective_state` + confidence, mirroring focus/fatigue adapters
  - Removes hardcoded `engaged` at `services/ai_orchestrator/orchestrator.py`
- [x] **COACH-16** Reschedule agent integration — *H* · deps: COACH-01
  - Coach result with `schedule_changes` → `study.schedule.apply` job consumed by the reschedule agent
  - ScheduleOrchestrator applies changes in the worker path (no direct HTTP), idempotent by correlationId, logged to `schedule_history`
  - Coach result surfaces `schedule_update.status` (success/no_changes/error) via correlated await bridge — never silent

## F04 — AI Evaluator (Sprint 2)

- [x] **EVAL-01** EvaluatorWorker consumes `study.eval.step` — *H* · deps: AI-COM-05
- [x] **EVAL-02** EvaluationRequest contract + state rehydration — *H* · deps: AI-COM-02
- [x] **EVAL-02b** Evaluation objective targeting (objectiveId → bloomLevel/knowledgeType) — *M* · deps: EVAL-02, F14/BLOOM
- [x] **EVAL-03** Prompt hardening (student_answer untrusted) — *C* · deps: EVAL-01
- [x] **EVAL-04** EvaluationOutput schema (5 dims + mastery) — *H* · deps: EVAL-01
- [x] **EVAL-05** Evidence grounding per dimension score — *H* · deps: EVAL-03
- [x] **EVAL-06** Validation/rejection pipeline — *H* · deps: EVAL-04
- [x] **EVAL-07** Retry-safe session state — *H* · deps: AI-COM-06
- [x] **EVAL-08** Step results persisted to Mongo — *H* · deps: AI-COM-07 ✅ Node PR#13 (`eval_results` + EvalResult) merged to `bloom`; Python PR#28 (full EVAL side) merged to `bloom`
- [x] **EVAL-09** Eval API → 202 jobId — *H* · deps: EVAL-08
- [x] **EVAL-10** Evaluator E2E — *H* · deps: EVAL-09

## F05 — AI Search & Ingestion (Sprint 2–3)

### SEARCH
- [x] **SEARCH-01** SearchWorker consumes `study.search.query` — *H* · deps: AI-COM-05
- [x] **SEARCH-02** Query validation + rate limit (10/min/user) — *H* · deps: AI-COM-02
- [x] **SEARCH-03** Scraped-content isolation + SSRF guard — *C* · deps: SEARCH-01
- [x] **SEARCH-04** SearchOutput schema (answer/sources) — *H* · deps: SEARCH-01
- [x] **SEARCH-05** Result validation (sources required) — *H* · deps: SEARCH-04
- [x] **SEARCH-06** Retry + Redis result cache (TTL 1h) — *H* · deps: AI-COM-06
- [x] **SEARCH-07** Search API → 202 jobId — *H* · deps: SEARCH-05
- [x] **SEARCH-08** Search E2E — *H* · deps: SEARCH-07

### INGEST
- [x] **INGEST-01** Upload validation: MIME + magic bytes — *C* · deps: AI-COM-02
- [x] **INGEST-02** Size limits (25 MB, 413) — *C* · deps: INGEST-01
  - `MAX_UPLOAD_BYTES`/`MAX_UPLOAD_MB` exported from `shared/uploadValidation.js`
  - `courses.js` multer limit raised 10MB → 25MB; both course upload routes
    (`POST /` and `POST /:courseId/files`) wrapped with `withUploadError`
  - multer `LIMIT_FILE_SIZE` → 413 (never a generic 500); partial files written by
    diskStorage are cleaned up before responding
  - 2 route tests (413 + no disk residue) in `course-upload-validation.test.js`; suite 7/7
- [x] **INGEST-03** Content-type allowlist at gateway/route — *H* · deps: INGEST-01
  - `requireMultipart` middleware in `shared/middleware.js` (415 for non-multipart POST/PUT)
  - Gateway guards `POST /api/v1/study/courses` and `POST /:courseId/files` before proxy
  - Study routes same guard (defense-in-depth); gateway + route 415 tests; all suites green
- [x] **INGEST-04** Polyglot/PDF-header checks, sandboxed parsing — *H* · deps: INGEST-01
  - PDFs verified against `%PDF-` header **and** `%%EOF` trailer; content after the
    last trailer must be whitespace-only (polyglot/spliced payloads → 422)
  - Encrypted/password-protected PDFs rejected with a clear message: `/Encrypt` in
    trailer at upload (422) + authoritative `doc.needs_pass` in the AI parser
  - Text files checked for printable-character ratio (valid UTF-8 sequences count;
    masked binary payloads → "not readable text", 422)
  - AI parsing runs inside a forked sandbox: RLIMIT_AS + RLIMIT_CPU applied before
    parse, strict 45s wall-clock timeout with kill, clear `PdfParse*Error` contract
  - Node: `shared/uploadValidation.js` (`checkPdfStructure`, `printableTextRatio`);
    32 shared + 13 route + 106 shared-dir + 115 study tests green
  - AI: `pdf_loader.py` sandbox supervisor + lazy PyMuPDF; 6 sandbox tests green
- [x] **INGEST-05** `study.ingest.course` job trigger — *H* · deps: AI-COM-05
  - Upload/re-ingest no longer block on a 5-minute synchronous AI call: files are
    staged under `uploads/courses/:courseId` and a `study.ingest.course` job is
    published via RabbitMQ; both endpoints return `202 { jobId, courseId, status }`
  - Strict payload validation on both sides: `validateIngestPayload` (courseId ≤64,
    fileRef ≤256, files ≤10, per-file filename/originalName ≤256, mimetype ≤128,
    size ≥0, storage-relative path ≤256, extra fields forbidden) + Python
    `IngestionRequest`/`IngestFileMeta` mirror — limits and names kept in lockstep
  - Publish failure → course marked `failed`, staged files cleaned, `503` returned;
    no orphaned/partially-processed uploads
  - Node: `ingestionJob.js` (`publishCourseIngestionJob`, jobId = envelope messageId);
    118 study + 111 shared + 13 gateway tests green; parity: 6 Python schema tests green
- [x] **INGEST-06** Background ingestion worker pipeline — *H* · deps: INGEST-05
  - `IngestionWorker` (`workers/ingestion_worker.py`) consumes `study.ingest.course`
    jobs: parse → normalize → enrich → objectives → chunk → embed → dedup → vector store;
    all stages run off the event loop via `asyncio.to_thread`, ACK only after full completion
  - Staged files resolved under the ingests-uploads root with path-traversal containment;
    PDFs run through the INGEST-04 sandbox (encrypted/malformed → `TerminalError`,
    timeout/limit → retryable); OCR fallback for scanned PDFs, lazy `pytesseract` import
  - Progress events on `ai.results` under routing key `progress` (NOT `result`, so the
    Node result inbox's complete/fail correlation is never affected): `AiProgressEnvelope`
    with stages `parsing/enriching/embedding/indexing`, progress 0..1, detail ≤256
  - Vectors live in the vector store (`VectorStoreAdapter.add_course`, idempotent on replay);
    `courseId` used as `course_title` (payload has no title); result payload strips chunk vectors
  - Node: `PROGRESS_ROUTING_KEY` mirror + fixture `routingKeys {result, progress}` + both parity
    tests; `docker-compose.prod.yml` mounts `study_uploads:/app/uploads` + `INGEST_UPLOADS_DIR`
    (ai-service did NOT mount uploads before)
  - Tests: 68 AI (worker + envelope + parity + base + schema + pdf sandbox) and 112 Node
    shared tests green
- [x] **INGEST-07** Ingest-status endpoint + course gating — *H* · deps: AI-COM-07
  - `GET /api/v1/study/courses/:courseId/ingest-status` (user-scoped, 404 if not owned):
    `{courseId,status,jobId,stage,progress,detail,error,failedOnly,processedAt,retry,updatedAt}`;
    `retry.action: 're-upload'` → `POST /:courseId/files` while `failed`
  - Course model: `jobId` + `correlationId` (set on ingest, reset on re-upload) and live
    `ingestStage/ingestProgress/ingestDetail/ingestError`; gateway closes with
    `Course.findOne({ correlationId })` ACKs only `study.ingest.course` events
  - `services/ingestStatus.js` tracker consumes on `ai.results` via NEW queues
    `ai.results.progress` (key `progress`) + `ai.results.ingest` (key `result`) — direct
    exchange copies `result` to both the orchestrator inbox and the ingest queue, so the
    orchestrator's AiJob complete/fail correlation is untouched; progress envelope
    validator mirrors Python (`no payload/error` fields)
  - Completion persists the worker's curated course structure through
    `sanitizeCourseFromResult` (whitelist: title/subtopics/summary/key_concepts/formulas/
    examples/definitions/learning_objectives/prerequisites — drops chunk vectors);
    failure surfaces the sanitized reason
  - Course gating: `POST /api/v1/study/sessions/setup` (sessionTasks) now requires
    `course.status === 'completed'` — 400 "still being processed" while ingesting
    (precedent: `plans.js` gate)
  - Bootstrap: tracker starts when `RABBITMQ_URL` set (SIGTERM graceful stop);
    docker-compose(+prod) gives study-service `RABBITMQ_URL` + rabbitmq `depends_on`
    (closes the INGEST-05 publishing-without-broker gap)
  - Tests: 135 study + 131 shared + 13 gateway Node green (orchestrator 38/44 — 6
    pre-existing `coach.test.js` axios-3rd-arg fixture failures, files unchanged vs base);
    AI 68 green incl. `test_topology_parity` asserting the two new queues
- [x] **INGEST-08** Ingestion retry/DLQ policy — *H* · deps: AI-COM-06
  - Retry/DLQ machinery already ships in `BaseAIWorker` (AI-COM-06): per-type delayed
    backoff queues, `x-retry-count`, DLX → `ai.dlq.study.ingest.course`. This story pins
    the four ACs at the ingestion boundary (tests only — no prod changes needed)
  - OCR/LLM failures retryable: `classify_failure` maps OCR/embedding timeouts,
    rate-limit/5xx → retryable; an OCR failure at attempt 0 books the first backoff stage
    (1000ms) and is never DLQ'd early; only after MAX_RETRIES (3) → failed result event +
    DLQ. LLM enrichment failure (parse → enrich raises) behaves identically
  - Schema/file validation → DLQ immediately: invalid `IngestionRequest` payload and
    non-UTF-8 file are terminal at attempt 0 (no retry scheduled, nack no-requeue, failed
    result emitted) — retrying can't fix bad input
  - Replay tool for DLQ messages: existing `shared/ai-messaging/dlq-replay.js` now pinned
    for the ingest type (`--type study.ingest.course`) — fresh messageId (fresh worker
    claim, so the job actually re-runs), correlationId preserved (Course status keeps
    correlating), retry headers stripped (full retry budget again)
  - No duplicate embedding on replay: `VectorStoreAdapter.add_course` upserts Mongo by
    `course_id` with `$set` (replace, never append) and rebuilds the per-course FAISS
    index, so a replayed job re-indexes the same course without duplicating vectors
  - Tests: AI 76 green (8 new `tests/test_ingestion_retry.py`: lifecycle + classification
    + replay-budget + adapter idempotency); Node shared 132 green (ingest replay coverage
    in `dlq-replay.test.js`)
- [x] **INGEST-09** Hardened LLM extraction of documents — *H* · deps: INGEST-06
- [x] **INGEST-10** Ingestion E2E — *H* · deps: INGEST-07
- [x] **F05 fully merged** — web `695e85f` · ai `dc8965f` · api `86cfd0b` · docs `3dfb81c`; 0 branches ahead of `main` in every repo; AI history rewritten to purge stray conflict markers

## F06 — Authentication & Security (Sprint 2)

- [x] **SEC-01** OTP via `crypto.randomInt` (`auth.js:241`) — *C*
- [x] **SEC-02** OTP TTL/attempts/resend audit — *C* · deps: SEC-01
- [x] **SEC-03** httpOnly refresh cookie (backend already sets cookies; verify header flow fully removed) — *C*
- [x] **SEC-04** No refresh token in JS-accessible state (frontend verify) — *C* · deps: SEC-03
- [x] **SEC-05** Centralized `requireInternal` middleware replacing 6+ copies — *H*
- [x] **SEC-06** Fail-fast env validation at boot (all services) — *H* · deps: SEC-05
- [x] **SEC-07** Protect `/api/v1/monitoring/metrics` — *H*
- [x] **SEC-08** Error-leak sanitization (Python `str(e)`, proxyBuilder, base64 log) — *H*
- [x] **SEC-09** ReDoS: escape admin `$regex` (`admin.js:42–44`) — *H*
- [x] **SEC-10** Mass-assignment protection (`stripUnknown`, field allowlists) — *H*
- [x] **SEC-11** Upload security Node-side (async streaming, filename sanitize) — *H* · deps: SEC-10
- [x] **SEC-12** Security regression suite (authz/authn/upload/OTP) — *H* · deps: SEC-01..11

## F07 — Study & Session Reliability (Sprint 3)

- [x] **STUDY-01** asyncHandler on all async routes (28 wrapped across study/auth) — *C*
- [x] **STUDY-02** Process-level rejection handlers (all 8 services) — *C*
- [ ] **STUDY-03** Mass-assignment protection + session scoping fixes (`sessionTasks.js:174`, `teamSessions.js:48`) — *H*
- [ ] **STUDY-04** Async file I/O (`courses.js:135`) — *H* · deps: SEC-11
- [ ] **STUDY-05** StudySession `{type, inviteCode, status}` index — *H*
- [ ] **STUDY-06** Task `{studyPlanId, userId}` index — *H*
- [ ] **STUDY-07** Subject list N+1 elimination — *H*
- [ ] **STUDY-08** Team-session participant batching — *H*
- [ ] **STUDY-09** Friendship query optimization + count endpoint — *H*
- [ ] **STUDY-10** Study integration tests — *H* · deps: STUDY-01..09
- [ ] **STUDY-11** Session E2E journey — *H* · deps: STUDY-10

## F08 — Gamification & Async Events (Sprint 3)

- [ ] **GAME-01** Inventory of fire-and-forget side effects — *H*
- [ ] **GAME-02** Event contracts (`gamify.*`) — *H* · deps: GAME-01
- [ ] **GAME-03** XP events published durably — *H* · deps: GAME-02
- [ ] **GAME-04** Streak events (UTC-consistent, idempotent/day) — *H* · deps: GAME-02
- [ ] **GAME-05** Season events + KP cap in consumer — *H* · deps: GAME-02
- [ ] **GAME-06** Idempotent consumers — *H* · deps: GAME-03..05
- [ ] **GAME-07** Gamify retry/DLQ — *H* · deps: GAME-06
- [ ] **GAME-08** XP regression tests — *H* · deps: GAME-03
- [ ] **GAME-09** Streak/timezone tests — *H* · deps: GAME-04
- [ ] **GAME-10** Season/rank tests incl. badge key fix — *H* · deps: GAME-05

## F09 — Analytics & Performance (Sprint 3)

- [ ] **PERF-01** AnalyticsEvent `(userId, createdAt)` index — *H*
- [ ] **PERF-02** RankSeason/RankEventLedger/SeasonResultSnapshot indexes — *H*
- [ ] **PERF-03** Friendship compound index — *H*
- [ ] **PERF-04** Remaining hot-query indexes — *H* · deps: STUDY-05/06
- [ ] **PERF-05** Mongo aggregation pipelines (analytics.js:106) — *H* · deps: PERF-01
- [ ] **PERF-06** Focus stats aggregation (focus.js:233) — *H* · deps: PERF-05
- [ ] **PERF-07** Timeline aggregation + pagination — *H* · deps: PERF-05
- [ ] **PERF-08** `explain()` CI guard vs COLLSCAN — *M* · deps: PERF-01..07
- [ ] **PERF-09** Redis requirepass — *H*
- [ ] **PERF-10** Redis hot-read caching — *M* · deps: PERF-09
- [ ] **PERF-11** Images → object storage + backfill — *H*
- [ ] **PERF-12** k6 smoke (50 RPS, P95<500ms) — *M* · deps: PERF-01..11

## F10 — Testing & Quality (parallel from Sprint 1)

- [ ] **TEST-01** Rewrite fake `api-integration.test.js` against real services — *H*
- [~] **TEST-02** Remove dead code (empty `test_coach_with_signals.py`, stale Flask app in `search/retrieval/search.py:136–180`, agentService stub) — *H*
- [ ] **TEST-03** Hybrid Playwright fixture (allow real API, mock only external) — *C*
- [x] **TEST-04** Envelope + topology-parity contract tests both sides vs shared fixture — *H* · deps: F01
  - Node suite: `tests/shared/ai-envelope.test.js`, `topology-parity.test.js`, `payload-schemas.test.js`,
    `ai-publisher.test.js`, `dlq-replay.test.js` against the shared `docs/contracts/topology-fixture.json`
  - Python mirror: `tests/test_ai_envelope_contract.py` + `tests/test_topology_parity.py` (same fixture)
  - Wired into CI on both sides (jest `test:unit` runs `tests/shared/*`; `pytest tests/` runs the parity
    tests) → a fixture/version mismatch fails CI
  - Per-agent I/O fixtures remain planned under **TEST-05**
  - Status verified by read-only code audit 2026-08-30
- [ ] **TEST-05** Per-agent I/O contract fixtures — *H* · deps: F02..F05
- [ ] **TEST-06** Auth negative tests — *H* · deps: SEC-01..07
- [ ] **TEST-07** Cross-user authorization negative tests — *C* · deps: SEC-05, STUDY-03
- [ ] **TEST-08** Consolidated prompt-injection suite — *C* · deps: PLAN-11 etc.
- [ ] **TEST-09** Upload abuse tests (polyglot, oversized, traversal) — *H* · deps: INGEST-01..04
- [ ] **TEST-10** OTP behavior tests + no-Math.random static check — *H* · deps: SEC-01/02
- [ ] **TEST-11** Full AI round-trip E2E — *H* · deps: F02..F05
- [ ] **TEST-12** Full user journey E2E (register→…→leaderboard) — *C* · deps: TEST-03, TEST-11
- [ ] **TEST-13** Load smoke in CI — *M* · deps: PERF-12
- [~] **TEST-14** Duplicate-method regression tests done; lint rule pending — *H* · deps: TEST-02

## F11 — Infrastructure & Deployment (Sprint 4)

- [ ] **INFRA-01** pnpm audit blocking (`--audit-level=high`) — *C*
- [ ] **INFRA-02** Trivy blocking (`exit-code: 1`) — *C*
- [ ] **INFRA-03** Secret scanning blocking — *C*
- [ ] **INFRA-04** Non-root containers — *H*
- [ ] **INFRA-05** read_only root FS where possible — *H* · deps: INFRA-04
- [ ] **INFRA-06** no-new-privileges everywhere — *H* · deps: INFRA-04
- [ ] **INFRA-07** RabbitMQ hardening (perms, TLS, UI internal-only) — *C* · deps: AI-COM-01
- [ ] **INFRA-08** Redis hardening (rename-command, no host port) — *H* · deps: PERF-09
- [ ] **INFRA-09** Staging environment — *M* · deps: INFRA-04..08
- [ ] **INFRA-10** migrate-mongo pipeline — *M* · deps: INFRA-09
- [ ] **INFRA-11** Deployment pipeline + smoke — *M* · deps: INFRA-09/10
- [ ] **INFRA-12** Rollback strategy/runbook — *M* · deps: INFRA-11
- [ ] **INFRA-13** Env-var matrix doc — *M* · deps: INFRA-09..12

## F12 — UX & Frontend Quality (Sprint 4–5, after stability)

- [ ] **UX-01** Fix "View Demo" CTA — *M*
- [ ] **UX-02** 404 route — *M*
- [ ] **UX-03** Global error boundary — *M*
- [ ] **UX-04** ToastProvider + interceptor errors — *M*
- [ ] **UX-05** Replace alert() (WeeklyCalendar/SlotModal) — *M* · deps: UX-04
- [ ] **UX-06** Empty states (tasks/subjects/friends/leaderboard/search/chat) — *M*
- [ ] **UX-07** Skeleton loaders — *M*
- [ ] **UX-08** VoiceSettings real or hidden — *L*
- [ ] **UX-09** VolumeControl applies to audio element — *L*
- [ ] **UX-10** Onboarding tour — *L* · deps: UX-04/06
- [ ] **UX-11** Mobile responsiveness pass — *L*
- [ ] **UX-12** Accessibility audit (a11y ≥ 90) — *L*

## F13 — Observability & DR (Sprint 4)

- [ ] **OPS-01** Structured logging (kill Python print(), safe logs) — *H* · deps: SEC-08
- [ ] **OPS-02** Request-ID propagation — *H* · deps: OPS-01
- [x] **OPS-03** AI correlationId in logs + test — *H* · deps: OPS-02
  - `correlationId` logged at publish (`ai-orchestrator/src/routes/jobs.js`), consume/process
    (`workers/base.py` + `workers/coach_worker.py`), result (`jobResultConsumer.js`)
  - Job → result correlation verified by the AI round-trip integration test
  - Status verified by read-only code audit 2026-08-30
- [ ] **OPS-04** RabbitMQ queue metrics — *H* · deps: AI-COM-01
- [ ] **OPS-05** AI latency histogram by type/status — *H* · deps: OPS-03
- [ ] **OPS-06** AI failure counters + DLQ ingress rate — *H* · deps: OPS-03
- [ ] **OPS-07** Prometheus compose + /metrics all services — *H* · deps: OPS-04..06
- [ ] **OPS-08** Grafana dashboards — *H* · deps: OPS-07
- [ ] **OPS-09** Alerting rules + on-call doc — *H* · deps: OPS-07
- [ ] **OPS-10** OpenTelemetry tracing — *M* · deps: OPS-02
- [ ] **OPS-11** Encrypted backups (age/gpg) — *H*
- [ ] **OPS-12** Offsite backups (S3-compatible) — *H* · deps: OPS-11
- [ ] **OPS-13** Backup checksums + restore dry-run — *H* · deps: OPS-11
- [ ] **OPS-14** Restore drill (RTO measured) — *H* · deps: OPS-13
- [ ] **OPS-15** DR runbook — *H* · deps: OPS-11..14
- [ ] **OPS-16** RPO/RTO targets — *M* · deps: OPS-14

---

## F14 — Bloom Competency Engine (Sprint 6 recommended; contracts startable now)

Two-dimensional revised taxonomy (Anderson & Krathwohl 2001): 6 cognitive levels × 4 knowledge types. Competency keyed `(userId × topic × knowledgeType × bloomLevel)` — never "% correct → level".

- [x] **BLOOM-01** Shared taxonomy constants: Node `shared/bloom/taxonomy.js` + Python `bloom/taxonomy.py` + `docs/contracts/bloom-fixture.json` parity tests — *C* · deps: none
- [x] **BLOOM-02** `LearningObjective` contract + measurable-verb validation — *C* · deps: BLOOM-01
- [x] **BLOOM-03** `study.knowledge.extract` job type in topology/envelope both sides — *H* · deps: BLOOM-02
- [x] **BLOOM-04** Ingestion extraction stage (between enrich & chunk), prompt-guarded, dedup, ≤40/doc cap, graceful degradation — *H* · deps: BLOOM-03, INGEST-06
- [x] **BLOOM-05** LLM classification ×2 dimensions, verb-consistency check, confidence <0.6 → needsReview — *H* · deps: BLOOM-04
- [x] **BLOOM-06** `learning_objectives` collection + indexes + versioned re-ingestion — *H* · deps: BLOOM-05
- [x] **BLOOM-07** `CompetencyProfile` model + evidence-weighted EWMA estimator (bounds/monotonicity property tests; no cross-level inference) — *C* · deps: BLOOM-02, AI-COM-07 ✅ PR#11 merged at `1c974f9`
- [x] **BLOOM-08** Profile updater on eval result events, idempotent by correlationId, atomic per-key updates — *H* · deps: BLOOM-07, EVAL-08 ✅ PR#14 open at `f00fb14` — EvalResult userId enrichment + study-side poller with ACK-skip idempotency + upsertProfile call
- [x] **BLOOM-09** `GET /api/v1/competencies` (+ topic detail), subject rollup from topic rows — *H* · deps: BLOOM-08 ✅ PR#15 open at `0b47c3b` — subject→topic→level map + topic detail with evidence & needsReview
- [x] **BLOOM-10** Planner weakest-first targeting + progression gate (N−1 ≥ 0.7); tasks carry objectiveId/targetLevel — *M* · deps: BLOOM-09, PLAN-06 ✅ Python PR#29 open at `46083b3` (weak comps threaded through PlannerInput, progress-gated `unlocked_levels`, LLM targets tasks at highest unlocked weak level) · Node PR#16 open at `e483b2e` (rebased onto `bloom` after BLOOM-08/09 merged — `getWeakCompetenciesForCourse` weakest-first payload into `study.plan.generate`, persist `objectiveId`/`targetBloomLevel` on tasks + taskGraph; MERGEABLE clean)
- [x] **BLOOM-11** Frontend competency radar + task level badges — *M* · deps: BLOOM-09 ✅ Web PR#5 open at `19e7a1f` on `main` (`feature/bloom-11-competency-map` — Competency Map page at `/competency` with per-subject 6-axis radar + topic drill-down + detail panel; `PlanTaskBadge` target-level badges on plan tasks; `competencyAPI` client; jest-axe a11y tests; empty/loading/error states)
- [x] **BLOOM-12** E2E: ingest→objectives→eval→profile→plan loop; idempotency replay test; parity in CI — *H* · deps: BLOOM-10/11 ✅ Node PR at `760152f` on `bloom` (bloom-loop.integration.test.js — real Mongo loop: classify objectives → processEvalResult EWMA → getWeakCompetenciesForCourse + degraded mode, 5/5 passing) · Web PR#5 at `de5f6a3` on `feature/bloom-11-competency-map` (competency-e2e.spec.js — Playwright happy path, empty state, failed-fetch retry, 3/3 passing)
- [x] **BLOOM-DOC** `docs/education/bloom-taxonomy.md` (2001 revision, both dimensions, estimator math, anti-patterns) — *M* · deps: BLOOM-01

---

## F15 — Knowledge Graph & Graph RAG Infrastructure (Sprint 7 recommended; schema startable in Sprint 6)

Graph-based retrieval layer extending flat vector RAG. Provides prerequisite-aware traversal, misconception mapping, student mastery tracing, and reference answer storage. Depends on F05/INGEST for entity extraction triggers, F14/BLOOM for competency data, F04/EVAL for reference answers.

- [ ] **KG-RAG-01** Graph RAG core schema & Neo4j setup: Concept/Subtopic/Question/Misconception/StudentMastery nodes + Prerequisite/MisconceptionPath/BloomEdge relations + constraints + indexes — *H* · deps: AI-COM-01
- [ ] **KG-RAG-02** Entity & relation extraction pipeline: LLM-powered extraction during course ingestion, writes to Neo4j, graceful degradation — *H* · deps: KG-RAG-01, INGEST-05
- [ ] **KG-RAG-03** Graph RAG retrieval service: `GraphRAGClient` with traversal-based retrieval (prerequisite chain, misconception path, similar situation), circuit breaker, <500ms target — *H* · deps: KG-RAG-01, KG-RAG-02
- [ ] **KG-RAG-04** Pedagogical Knowledge Base: concept hierarchy, prerequisite chains, Bloom verb maps, difficulty calibrations seeded in graph — *H* · deps: KG-RAG-01, BLOOM-01
- [ ] **KG-RAG-05** Misconception Knowledge Base: misconception nodes mapped to corrective paths and prerequisite gaps, 30+ seeded misconceptions — *M* · deps: KG-RAG-01, BLOOM-01
- [ ] **KG-RAG-06** Reference Answer Store: versioned canonical answers with rubrics and Bloom-level tags, bulk import support — *H* · deps: INGEST-05, EVAL-02
- [ ] **KG-RAG-07** Student Knowledge Graph: per-student mastery nodes, prerequisite gap computation, recommended-next-concept via graph traversal — *H* · deps: KG-RAG-03, BLOOM-02, F14-EST
- [ ] **KG-RAG-08** Planner Agent Graph RAG integration: prerequisite-aware plan generation, Bloom-level ordering, graceful fallback — *H* · deps: KG-RAG-03, KG-RAG-07, PLAN-07
- [ ] **KG-RAG-09** Evaluator Agent RAG integration: reference answer retrieval, misconception diagnosis, student mastery update — *H* · deps: KG-RAG-03, KG-RAG-05, KG-RAG-06, KG-RAG-07, EVAL-06
- [ ] **KG-RAG-10** Coach Agent RAG integration: prerequisite-aware explanations, misconception addressing, pedagogical KB lookup — *H* · deps: KG-RAG-03, KG-RAG-07, COACH-09
- [ ] **KG-RAG-11** Search Agent Personal Corpus RAG: hybrid kNN + graph retrieval, course-grounded results with source tagging — *M* · deps: KG-RAG-03, SEARCH-05, INGEST-05
- [ ] **KG-RAG-12** Reflection Agent RAG: past reflection retrieval, outcome correlation, theme-based similar-reflection matching — *M* · deps: KG-RAG-03, REFLECTION-02
- [ ] **KG-RAG-13** Graph RAG observability: structured logs, Prometheus metrics, Grafana dashboard, fallback-rate alerts — *M* · deps: KG-RAG-03, OPS-01
- [ ] **KG-RAG-14** Graph RAG E2E + load tests: full pipeline test (ingest→extract→graph→eval→coach), 100 concurrent requests p95 <1s — *M* · deps: KG-RAG-08, KG-RAG-09, KG-RAG-10, TEST-01
- [ ] **KG-RAG-15** Documentation & runbook: architecture.md, agent-integration.md, troubleshooting.md, performance.md, runbook — *M* · deps: KG-RAG-01..14

---

## Audit Quick Wins Checklist (from §15, outside story IDs)

- [x] Fix OTP randomness (= SEC-01)
- [x] asyncHandler + process handlers (= STUDY-01/02)
- [x] Duplicate-method bugs: `is_ready`, retriever, badge `'use'` key (+ regression tests)
- [ ] Escape admin search regex (= SEC-09)
- [ ] Remove dead code: `api-integration.test.js`, empty Python test, stale Flask app (= TEST-02)
- [ ] CI scans blocking (= INFRA-01..03)
- [ ] Compose secrets `:?` + Redis password (= INFRA-08/PERF-09) — RabbitMQ part done; Redis pending
- [ ] SPA 404 route (= UX-02)
- [ ] View Demo CTA (= UX-01)
- [ ] Character image lazy-loading/srcSet

## Completed Outside Backlog IDs

- Shared `processHandlers.js` wired into all 8 service entrypoints
- `docs/contracts/ai-message-contract.md`
- Contract regression suites: `tests/shared/*` (Node), `tests/test_ai_envelope_contract.py` (Python)

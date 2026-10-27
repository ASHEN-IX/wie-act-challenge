# EdNova — M06 / ED-03: Approved AI Provider Execution & Mode Reporting Verification Report

**Date:** 2026-10-23  
**Status:** DONE / VERIFIED  
**Task:** ED-03 / M06  
**Domain:** AI Infrastructure & Gateway  

---

## 1. Objectives & Scope
The goal of M06 (ED-03) is to establish authoritative, transparent execution mode reporting and category tiering across the Python AI inference layer and Node API gateway:
1. **Explicit Execution Modes:** `REAL_APPROVED`, `MOCK_TEST`, `DETERMINISTIC_FALLBACK`, `UNAVAILABLE`. Eliminate silent mock substitution when mock mode is not explicitly opted in.
2. **Model Category / Tier Mapping:** Map all agents into architectural tiers (`compact` for short nudges, fast formatting, entity extraction vs `capable` for complex evaluation, decomposition, long-form synthesis, and planning).
3. **Safe Metadata Reporting:** Provide sanitized inference results reporting model, tier, trace ID, token usage, and latency without leaking credentials or internal secrets.
4. **Provider Readiness & Status:** Expose provider health and capability inspection on Python FastAPI (`/provider/status` and `/api/ai/provider/status`) and Node.js gateway (`InfrastructureController` at `/api/v1/system/ai-status`).

---

## 2. Implementation Summary

### A. Python AI Inference Layer (`apps/ai/utils/llm_client.py`)
- **Model Tiers (`ModelTier`):**
  - `compact`: `coach`, `course_ingestion`
  - `capable`: `planner`, `evaluator`, `search`, `reflection`
  - Enforced via `get_model_tier(agent)`.
- **Execution Modes (`ExecutionMode`):**
  - `REAL_APPROVED`: Real provider invocation via LiteLLM router when valid provider credentials are configured.
  - `MOCK_TEST`: Explicit test mode enabled exclusively when `LLM_MOCK=1`.
  - `DETERMINISTIC_FALLBACK`: Rule-based deterministic responder executed safely when provider errors occur or credentials are absent and a fallback function is provided.
  - `UNAVAILABLE`: Raised via `LLMUnavailableError` (with `state="UNAVAILABLE"`) when credentials are missing and mock mode is not active.
- **Result Object (`LLMResult`):**
  - Returns `text`, `execution_mode`, `model`, `tier`, `agent`, `trace_id`, `fallback_used`, `usage`, `latency_ms`.
  - Accessible via `ask_with_metadata(...)` or `ask(..., return_metadata=True)`.
  - Retains 100% backward compatibility for existing callers: `ask(..., return_metadata=False)` continues returning `str`.
- **Credential Protection (`sanitize_text`):**
  - Redacts all recognized provider keys (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`) and internal service tokens (`AI_SERVICE_API_KEY`) from logs, error messages, and returned metadata.
- **Status Endpoint (`get_provider_status`):**
  - Aggregates provider configuration across all agent groups without leaking secrets.

### B. Python API Endpoints (`apps/ai/services/api/`)
- Public monitoring endpoint: `GET /provider/status` in `apps/ai/services/api/main.py`.
- Authenticated service endpoint: `GET /api/ai/provider/status` in `apps/ai/services/api/routers/provider.py`.

### C. Node.js Gateway & Contracts (`apps/api/shared/aiClient.ts` & `infrastructure.controller.ts`)
- Added TypeScript types: `ModelTier`, `ExecutionMode`, `ProviderAgentStatus`, `ProviderStatusReport`.
- Added `getProviderStatus()` client method in `apps/api/shared/aiClient.ts`.
- Added `GET /api/v1/system/ai-status` in `apps/api/src/framework/infrastructure.controller.ts` with 503 fallback when AI service is unreachable.

---

## 3. Verification Evidence

### A. Python Test Suite (`apps/ai/tests/test_ai_provider_mode.py`)
Executed with `/home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python -m pytest`:
- `test_agent_tier_mapping`: PASSED (verified compact vs capable for all 6 agents)
- `test_ask_mock_test_mode`: PASSED (verified MOCK_TEST mode under LLM_MOCK=1)
- `test_ask_real_approved_mode`: PASSED (verified REAL_APPROVED mode with usage and latency metrics)
- `test_deterministic_fallback_on_missing_credentials`: PASSED (verified DETERMINISTIC_FALLBACK mode)
- `test_deterministic_fallback_on_router_failure`: PASSED (verified DETERMINISTIC_FALLBACK mode on provider outage)
- `test_zero_credential_leakage`: PASSED (verified [REDACTED_API_KEY] scrubbing in errors)
- `test_provider_status_unavailable`: PASSED (verified UNAVAILABLE report when unconfigured)
- `test_provider_status_mock_mode`: PASSED (verified MOCK_TEST report when LLM_MOCK=1)
- `test_fastapi_provider_status_endpoint`: PASSED (verified public and authenticated HTTP endpoints)
- **All 9 tests PASSED in 0.49s.**
- Full suite (32 runtime and client tests) PASSED with 0 failures.

### B. Node.js Integration Suite (`apps/api/tests/integration/m06-ai-provider-mode.node.test.ts`)
Executed with `pnpm --filter api exec tsx --test`:
- `aiClient.getProviderStatus parses provider report correctly`: PASSED (19.4ms)
- `InfrastructureController returns ai-status snapshot`: PASSED (4.6ms)
- `InfrastructureController returns 503 when AI service is unavailable`: PASSED (4.8ms)
- **All 4 tests PASSED.**

### C. Lint and Typecheck Quality Gates
- `pnpm --filter api typecheck`: PASSED (0 errors).
- `pnpm --filter api exec eslint shared/aiClient.ts src/framework/infrastructure.controller.ts tests/integration/m06-ai-provider-mode.node.test.ts`: PASSED (0 errors, 0 warnings).

---

## 4. Next Step
Proceed to **M07 / ED-30: Course Studio Versioned Draft APIs & Objectives**:
- Implement versioned course draft editing APIs with optimistic concurrency control (`expectedRevisionTag`).
- Implement topic and subtopic hierarchy tree integrity and Bloom level extraction.
- Restrict draft editing to course owner or assigned instructor.

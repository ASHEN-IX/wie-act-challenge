# AI Service — study-partner-ai

Setup, configuration, and day-to-day commands for the Python AI service
(multi-agent, RabbitMQ job bus, shared LiteLLM client). Consumed through the
API's AI integration module (inside the single API on port 3000); see [Backend API](backend-api.md).

## Prerequisites

- Python 3.12+
- MongoDB (for agent databases: history, pacing, embeddings, reflections)
- (Optional but recommended) RabbitMQ if you run the job-bus workers

## Install

```bash
poetry install
```

If you are installing on a PEP 668-managed system Python without Poetry, use
`--break-system-packages` (the project relies on `litellm`, added in COACH-07):

```bash
pip install --break-system-packages litellm PyYAML
```

## Environment

Create `.env` in the repo root. API keys are consumed by the LiteLLM router
via `os.environ/KEY` (see [LLM Configuration](llm-config.md)):

```dotenv
GEMINI_API_KEY=...
GROQ_API_KEY=...
NVIDIA_API_KEY=...
OPENROUTER_API_KEY=...
```

Optional switches:

```dotenv
LLM_MOCK=1          # force mock responders for every agent (dev/CI)
LLM_CONFIG=...      # override the litellm config.yaml path
```

When running from a shell directly, export the keys before starting the
process (`set -a; source .env; set +a`) — several entry points call
`load_dotenv()` from the repo root, but the shared LLM client reads the
**process environment**.

## Running

```bash
# FastAPI API service
poetry run python services/api/main.py

# Job-bus workers (RabbitMQ)
poetry run python -m workers.coach_worker
poetry run python -m workers.planner_worker
```

## Worker reliability contract (COACH-08 / COACH-09)

Both the coach and planner workers share one retry → fallback → persist flow
(AI-COM-06/07 foundation):

1. **Retry.** Real LLM failures (`LLMRequestError` — timeout/quota) are raised as
   `RetryableError` and owned by the shared retry/DLQ policy (NACK + TTL'd delay
   queues, `MAX_RETRIES`). Missing keys / mock mode degrade in-process instead.
2. **Fallback.** On the final attempt a job is not dead-lettered — the coach falls
   back to the deterministic rule engine (`apply_rules`, guaranteed safe nudge),
   the planner to `SimpleGoalDecomposer`. The result is `COMPLETED` with
   `fallbackUsed: true` and still passes output validation.
3. **Persist.** Completed coach decisions are persisted to the `coach_actions`
   collection on job completion, idempotently by `correlationId` (unique
   `trace_id` index + `$setOnInsert` upsert). Failed paths never persist, so no
   partial history rows. The repository degrades to a no-op when MongoDB is
   unavailable.

## Testing

```bash
# Core suite (shared tests + coach)
python3 -m pytest tests agents/coach/tests -q

# Per-agent suites
python3 -m pytest agents/planner/tests agents/search/tests \
  agents/course_ingestion/tests agents/reflection -q

# Full repo
python3 -m pytest agents -q
```

Notes on the full run:

- Search extraction tests require `beautifulsoup4` (`bs4`).
- Planner RAG / course-ingestion embedding tests require `sentence_transformers`
  and `faiss-cpu`.
- Without provider API keys, LLM-dependent tests and smoke calls degrade to
  their rule-based/`""`/template fallbacks instead of failing.

## Project layout

```
study-partner-ai/
├─ agents/            # planner, coach, scheduler, search, course_ingestion,
│                     # evaluator, reflection (+ tests)
├─ services/          # api, ai_orchestrator, schedule_orchestrator,
│                     # signal_processing_service, vector_store
├─ workers/           # RabbitMQ job consumers (coach, planner) + idempotency
├─ messaging/         # message envelope, failures, queue topology
├─ utils/             # llm_client (LiteLLM), logger (structured JSON)
├─ security/          # prompt_guard (untrusted-block wrapping)
├─ litellm/           # config.yaml (per-agent LLM model routing)
├─ models/, ML/       # shared domain models, ML signal artifacts
├─ docs/              # this documentation tree
└─ tests/             # repo-level shared tests
```
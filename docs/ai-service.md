# Python AI service — CURRENT operations

Independent process tree under `apps/ai`; pnpm does not install/start it. Poetry declares Python >=3.11,<3.15. Work from that directory in a compatible isolated environment:

```bash
poetry install --with dev
cd ..
pnpm dev:ai
```

Configure process environment using the service `.env.example` and root `.env.ai.example` guidance. API needs PostgreSQL settings and `AI_SERVICE_API_KEY` >=32 chars; Node's matching service key authenticates private HTTP requests. Provider keys/model aliases are separate in `litellm/config.yaml`. `LLM_CONFIG` can override YAML. `LLM_MOCK=1` explicitly enables test responders. Otherwise absent recognized usable provider keys raise `LLMUnavailableError` (`UNAVAILABLE`), including with `LLM_MOCK=0`. Mock responses are not approved inference.

FastAPI mounts ingest/planning/coaching/signals/search/reflection/schedule routers with service authentication. `/health` is lightweight and does not prove agents/models/workers ready. Broker jobs require separate worker processes using the same broker/vhost/database/upload configuration:

```bash
pnpm dev:worker ingestion
pnpm dev:worker planner
pnpm dev:worker schedule
pnpm dev:worker coach
pnpm dev:worker evaluator
pnpm dev:worker search
```

Run worker commands from the repository root. The helpers load `apps/ai/.env` and run Poetry in the AI directory. Each command is a separate long-running process; launch only required workers. Main Node lifecycle starts consumers/pollers, not these Python producers/consumers. AI Compose starts HTTP only. Set INGEST_UPLOADS_DIR/file references to actual API upload staging; match Node `aiCourseId` and Python course/index metadata. Redis enables cross-process idempotency/evaluation session storage; memory defaults do not persist through restarts.

The [AI specification](ai-specification.md) documents actual ingestion/planner/scheduler/coach/evaluator/search/reflection behavior, current model configuration, and the separate PLANNED EdNova facilitator/category policy. Preserve BaseAIWorker leases, validated payloads, retries/DLQs, deterministic fallback and [message contract](contracts/ai-message-contract.md). Existing external provider fallback is not authorization to bypass organizer limits.

Tests: `poetry run pytest tests agents -q` with known manual/network/heavy-model prerequisites reviewed first. Focused worker/state/schema tests can run in a lightweight compatible environment, but do not certify full ML/RAG/real inference. See [testing plan](testing-plan.md) and [actual validation](audit/validation.md). Root CI now installs through Poetry and runs named worker/contract/configuration/SSRF checks. This is not full ML/inference coverage. The AI Docker recipe installs the canonical Poetry lock with Python 3.12/Poetry 2.5.1; the [23 October 2026 M01 verification](../reports/EDNOVA-M01-FINAL-RUNTIME-VERIFICATION.md) records a passing complete image/import/health and isolated worker gate. Approved provider inference and GPU/media acceptance remain separate. Its BuildKit artifact cache preserves Poetry downloads across interrupted builds without adding cached wheels to runtime layers.

## v1.2 implementation scope

Python AI ownership follows modules: Habib owns ingestion/OCR/Studio enrichment/source indexing, Tasnim owns tutor/selector/individual evaluator/progress and the common provider adapter stewardship, Aziz owns peer facilitator/group-summary/private-room-help and later consented speech operations. Each member owns matching Node/UI integration and tests; there is no dedicated AI developer. Share approved transport/schema conventions without cloning clients or the individual evaluation engine. See [team plan](team-delivery-plan.md) and [backlog](sprint-backlog.md). This update implemented no features.

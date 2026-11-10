# Noveris Python AI service and workers

The Python project runs independently from the Node workspace. `services/api/main.py` hosts FastAPI; `workers/*_worker.py` hosts background consumers. `utils/llm_client.py` is the shared model boundary. Task implementation lives under `agents` and task-specific services.

## Install and launch

Use a supported Python 3.11–3.14 interpreter and the Poetry lock. The Docker runtime uses the project's configured Python/dependency build. Dependency resolution and model downloads can be substantial because the repository includes embeddings and optional media/ML capabilities.

```bash
cd apps/ai
poetry install
cd ../..
pnpm dev:ai
```

For an existing compatible locked environment, set `EDNOVA_AI_PYTHON` in `apps/ai/.env`. `scripts/run-ai.mjs` reads that environment and sets the development application context by default.

```bash
pnpm dev:worker ingestion
pnpm dev:worker evaluator
# Launch all six configured consumers instead.
pnpm dev:workers
```

HTTP health is `/health`. Most AI routes require the service Bearer credential from `AI_SERVICE_API_KEY`; provider status has a separate public surface. A healthy HTTP response does not certify provider approvals, loaded embeddings or worker connectivity.

## Storage and application context

`AI_DATABASE_URL` configures PostgreSQL repositories for Python-owned state in the `ai` schema. Source manifests, application courses, sessions and approval budgets remain API-owned. Python uses `API_SERVICE_URL` and `INTERNAL_API_SECRET` to request that context and reserve inference allowance.

The API and AI processes need matching, accessible originals and FAISS paths through `INGEST_UPLOADS_DIR` and `FAISS_INDEX_DIR`. Host and container path values can differ only when volume mapping exposes the same intended artifacts at each configured location. Check revision identity and artifact hashes when debugging retrieval.

## HTTP and background capabilities

HTTP routers include course ingestion/planning, coaching, search/reflection, scheduling, tutor, sources, formula recognition, Visual Lab, course review, Nardouch and experience planning. Workflows apply their own schemas and boundaries. The dedicated Gemini formula path has its own consent and data policy; a declared model alias does not authorize arbitrary learner content.

The ingestion worker extracts text/OCR, structures source material and produces supported indexing/result payloads. Planner, scheduler, coach, evaluator and search workers execute their respective background contracts. Correlation, idempotency and failure classification belong to the messaging layer. Preserve the [AI message contract](contracts/ai-message-contract.md) when changing payloads or consumers.

## Model behavior and configuration

Per-task aliases select compact or capable routes. Real inference needs usable provider credentials and an unexpired bounded operator approval. Missing service budget configuration fails closed. Explicit mock mode uses supplied responders only. Callers may expose supported deterministic guidance or unavailable results. The shared router disables transparent retries/fallbacks under exact-model approval. Worker retries are separate.

Eligible course-only reuse uses Redis with prompt/model/settings identity and expiry. Private dialogue is outside that reuse policy. See [AI engineering](ai-specification.md) and [model configuration](llm-config.md).

## Checks

```bash
cd apps/ai
poetry run pytest tests/test_llm_client.py tests/test_llm_response_cache.py agents/facilitator/tests -q
```

Full test selection can require PostgreSQL, broker, cached models, media runtimes or explicitly configured fixtures. Mock tests and schema checks establish their named contracts. The recorded live Visual Lab probe establishes compact/capable provider execution in its synthetic Python scope. Broad tutor quality, quota exhaustion and a full browser learning journey remain separate acceptance work.

Scanned-PDF host processing requires Tesseract and supported language data. Source-region review remains part of the publication workflow. Optional speech workers and external voice providers have independent requirements and should be evaluated against the current configuration and challenge rules before use.

See [environment](environment.md), [development](development.md) and [current evidence](submission/evidence/EDNOVA-CLAIM-TRACEABILITY.md).

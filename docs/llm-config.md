# Noveris model configuration

The shared client reads `apps/ai/litellm/config.yaml`. Task aliases and tier classification are maintained in `apps/ai/utils/llm_client.py`. Provider models are configured routes, while the evidence dossier records which paths actually executed.

## Current aliases

| Alias | Category | Configured route |
| --- | --- | --- |
| coach | compact | groq/openai/gpt-oss-20b |
| course_ingestion | compact | groq/openai/gpt-oss-20b |
| visual_lab_selector | compact | groq/openai/gpt-oss-20b |
| nardouch_compact | compact | groq/openai/gpt-oss-20b |
| planner | capable | groq/openai/gpt-oss-120b |
| evaluator | capable | groq/openai/gpt-oss-120b |
| facilitator | capable | groq/openai/gpt-oss-120b |
| visual_lab_planner | capable | groq/openai/gpt-oss-120b |
| course_review | capable | groq/openai/gpt-oss-120b |
| nardouch_capable | capable | groq/openai/gpt-oss-120b |
| search | capable | groq/llama-3.3-70b-versatile |
| reflection | capable | groq/llama-3.3-70b-versatile |
| course_multimodal_prototype | dedicated optional adapter | gemini/gemini-2.5-flash |

Nardouch supports `NARDOUCH_COMPACT_MODEL` and `NARDOUCH_CAPABLE_MODEL` overrides. Other alias wiring is read from YAML. Inspect the file for temperature and token caps because reasoning models may consume the generation allowance before visible output.

Declared fallback targets include Groq, NVIDIA NIM and OpenRouter routes. They are visible in configuration but the shared router disables automatic fallback dispatch. The exact route in the approval must match the selected model and the provider's response identity.

## Local configuration

Fresh `pnpm dev:setup` uses explicit mock mode. Existing environment files are preserved. Set `LLM_MOCK=1` only for supplied mock responders. With mock mode disabled, usable credentials and approvals are required. Missing credentials or approvals produces unavailable behavior rather than silently authorizing model traffic.

The Python service needs `API_SERVICE_URL` and `INTERNAL_API_SECRET` to request budget reservation. Node owns `llm_approval_budgets`. `AI_DATABASE_URL` is for Python-owned repositories and does not replace the API budget boundary.

An operator approval in `LLM_APPROVALS_JSON` identifies `approvalId`, `task`, exact `model`, Unix-seconds `expiresAt` and positive `maxRequests`. Optional `maxTokens` and `maxCostUsd` bound usage. Use a new approval identity when changing bound limits. Set an appropriate short expiry and authorize only the operations needed. Real provider calls may incur cost.

```python
from utils.llm_client import ask

result = ask(
    "coach",
    "Trusted task instructions",
    "Bounded synthetic input",
    max_tokens=256,
    return_metadata=True,
)
print(result.execution_mode, result.tier, result.latency_ms)
```

This snippet requires an existing bounded approval and provider setup. Never print local credentials, complete environment contents or private learner prompts as troubleshooting output.

## Reservations, cache and recovery

1. Resolve alias and approval identity.
2. Reserve the request through the API's conditional ledger operation.
3. Check eligible opt-in cached content where requested.
4. Invoke the approved model if reuse is unavailable.
5. Recheck approval and model identity, record usage and return sanitized metadata.
6. Let the caller select a supported deterministic response or unavailable state on failure.

The cache key binds model, prompts and generation settings. `LLM_CACHE_TTL_SECONDS` controls expiry, with a default of seven days. Cache hits consume the current approval request reservation conservatively. Cache eligibility excludes private learner dialogue. Router retries and transparent fallback chains remain disabled even if YAML contains retry values. Broker retry behavior is a separate worker concern.

## Reproduce the recorded live probe

`docs/submission/evidence/run_live_inference_evaluation.py` loads the local AI credential and API service secret, creates process-local short-lived bounded approvals and executes synthetic Visual Lab planning. It writes redacted call metadata and the candidate to the evidence JSON. Run it only when the local API, ledger migrations and provider access are ready. Each agent is limited to three requests in that script, and planning may use a repair call. The default data is synthetic.

The recorded two-call probe succeeded with Groq. It does not establish equivalence to the organizer-provided service or real quota-exhaustion behavior. See [AI engineering](ai-specification.md) and [evidence](submission/evidence/EDNOVA-CLAIM-TRACEABILITY.md).

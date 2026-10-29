> **CURRENT configuration guide; scope limit:** provider aliases are not verified organizer compact/capable mappings. Mocks require explicit LLM_MOCK=1; missing keys otherwise raise UNAVAILABLE. See [AI specification](ai-specification.md), [delivery rules](hackathon-delivery.md) and [actual validation](audit/validation.md). Historical migration completion language below does not certify this checkout.

# LiteLLM Config Guide

Introduced in **COACH-07** (shared client) and completed across all agents in
**S-MIG-01**. LLM-backed agent aliases use the shared client; the only
thing that varies per agent is the model wiring in `litellm/config.yaml`.

## The shared client: `utils/llm_client.py`

```python
from utils.llm_client import ask

answer = ask(
    "coach",                 # agent alias (must be one of AGENT_GROUPS)
    system_prompt,           # trusted system content (guarded block)
    user_prompt,             # user/content data
    temperature=0.5,         # optional per-call override of YAML defaults
    max_tokens=512,          # optional per-call override of YAML defaults
    mock_fn=None,            # responder used when mocking
    trace_id="",             # propagated through the router call
)
```

Other exported helpers: `agent_config(agent)` (resolved model/fallbacks),
`config_path()`/`load_config()`/`reload_config()`, `build_router()`/`reset_router()`,
and the exceptions `LLMRequestError`, `LLMUnavailableError` and `MissingMockResponderError`.

Recognised agent aliases (`AGENT_GROUPS`): `coach`, `planner`, `search`,
`reflection`, `course_ingestion`, `evaluator`.

### How messages are built

- **System role** — `build_system_block(system_prompt)` wraps system content in
  its own delimited, trusted block (prompt-guard). User content is never
  concatenated into it.
- **User role** — your raw user prompt.

### Mock semantics

The router is bypassed with `mock_fn(user_prompt)` only when `LLM_MOCK=1` is explicitly configured (`MOCK_TEST`). Without a responder, explicit mock mode raises `MissingMockResponderError`.

With mock mode unset or disabled, absent/dummy provider keys raise `LLMUnavailableError` (`UNAVAILABLE`, a subclass of `LLMRequestError`). Neither the provider nor a mock responder is called. Configured provider failures raise `LLMRequestError`; callers may choose a separately identified deterministic fallback. Provider availability does not certify approved inference. Non-transient parse/validation problems remain the responsibility of each caller.

## `litellm/config.yaml`

Structure mirrors the reference **hackership-ai** repo: a flat `model_list` of
deployments plus `router_settings`.

- Each agent alias = one `model_name` deployment (with default `temperature` /
  `max_tokens`, `drop_params: true`).
- `api_key` is always `os.environ/KEY` — keys come from the process
  environment, **not** the YAML.
- Additional `-main` deployments (`groq-main`, `nvidia-main`,
  `openrouter-main`) exist only to be targets of fallback chains.

### Current wiring

| Alias | Primary model | Temp / max_tokens | Fallback chain |
|-------|---------------|-------------------|----------------|
| `coach` | `groq/openai/gpt-oss-20b` | 0.5 / 1024 | `[groq-main]` |
| `planner` | `groq/openai/gpt-oss-120b` | 0.3 / 2048 | `[nvidia-main, groq-main]` |
| `search` | `groq/openai/gpt-oss-120b` | 0.2 / 1536 | `[groq-main]` |
| `reflection` | `groq/openai/gpt-oss-120b` | 0.7 / 2048 | `[groq-main]` |
| `course_ingestion` | `groq/openai/gpt-oss-20b` | 0.1 / 1024 | `[nvidia-main]` |
| `evaluator` | `groq/openai/gpt-oss-120b` | 0.3 / 1536 | `[groq-main, nvidia-main]` |
| `facilitator` | `groq/openai/gpt-oss-120b` | 0.5 / 1536 | `[nvidia-main]` |

### Compact and capable tiers

Each agent is tagged in `utils/llm_client.py` (`AGENT_TIERS`) so the split is explicit:

- **Compact** (`gpt-oss-20b`): short, frequent steps with a well-defined output: `coach` (hints, grounded tutor answers) and `course_ingestion` (cleaning and extraction).
- **Capable** (`gpt-oss-120b`): steps that synthesize or judge: `facilitator` (peer-first interventions across several learners), `planner`, `search`, `reflection`, `evaluator` (grading).

The facilitator prompt contains learner dialogue, so it is never cached. Course-only steps (`course_ingestion`) opt into the response cache (see below).

### Response cache

`ask(..., cache=True)` reuses a previous approved response for an identical agent, model, system prompt, user prompt and sampling settings. The cache key is a SHA-256 hash, so prompt text is not stored in the key. Values live in Redis (`REDIS_URL`) for `LLM_CACHE_TTL_SECONDS` (default 7 days).

- Opt-in only. Callers must pass `cache=True` only for content with no learner data.
- Only validated real responses are stored. Mock and fallback results are never cached.
- A cache hit still goes through the approval gate, and it counts against the approval's request budget. This is deliberately conservative.
- A Redis outage falls back to a normal approved call.

Fallback deployments: `groq-main` = `groq/openai/gpt-oss-120b`,
`nvidia-main` = `nvidia_nim/meta/llama-3.2-11b-vision-instruct`,
`openrouter-main` = `openrouter/meta-llama/llama-3.3-70b-instruct` (defined, not used by any alias while no OpenRouter key is provisioned).

These models were chosen from the models available to the provided Groq and NVIDIA keys on 28 October 2026. Gemini and OpenRouter aliases were replaced because no keys were provisioned for them. `gpt-oss` models are reasoning models, so `max_tokens` includes reasoning tokens.

### Router settings

```yaml
router_settings:
  num_retries: 2
  allowed_fails: 2
  retry_after: 2
  cooldown_time: 30
  fallbacks:
    - coach: [groq-main]
    ...
```

`build_router()` lifts `allowed_fails`/`retry_after`/`cooldown_time` to the
`litellm.Router` constructor. `litellm.drop_params = True` is set globally.

**Fallback chains are resolved but not routed, and that is deliberate.** The
`fallbacks:` block above is read by `agent_config()`, so the chains appear in
status output and in the per-agent wiring, but `build_router()` passes
`fallbacks=[]` to the Router. `ask()` accepts only the model named in the
operator's approval (`LLM_APPROVALS_JSON[agent].model`):

```python
if getattr(response, "model", None) not in (approval["model"], approved_bare):
    raise LLMRequestError("Provider/model identity did not match approval")
```

A routed fallback would therefore be paid for and then discarded, because it
reports a different model. Enabling `fallbacks=` without changing the approval to
name each fallback (or dropping the identity check) is strictly worse than the
current behaviour. Recovery today is the caller's typed deterministic fallback,
which is reported as `DETERMINISTIC_FALLBACK` rather than presented as inference.

`num_retries` is forced to `0` for the same reason: each attempt needs its own
approval-budget reservation, which the Router cannot make. Retries belong to the
caller.

Both behaviours are pinned by `tests/test_llm_client.py` so a future change has to
make the corresponding approval change rather than silently re-enabling routing.

### Provider prefixes

LiteLLM provider prefixes used here: `gemini/`, `groq/`, `openrouter/`,
`nvidia_nim/`. Note the `nvidia/` prefix (used in some reference repos) is **not
supported** by the pinned LiteLLM in this project — use `nvidia_nim/`.

## Changing models without code

1. Edit `litellm/config.yaml` (alias `model_name`, params, fallbacks).
2. Restart the process (the config is cached once at first use;
   `reload_config()` clears the cache for tests).

`LLM_CONFIG` overrides `config_path()`. The same file is also a valid
LiteLLM **proxy-server** config, so a future `litellm` container can mount it
at `/app/config.yaml` without changing it.

## Migration notes (S-MIG-01)

- All six agent groups migrated: planner decomposer, search, reflection,
  course-ingestion (enricher + task generator), evaluator, coach.
- Retired: `google.generativeai` (removed from pyproject/Dockerfile), the
  local `groq` client, LM-Studio REST call sites, and the evaluator's
  `QwenClient`/`GeminiClient` SDK wiring (the `GeminiClient` name is kept as a
  thin wrapper with the same public interface).
- Per-agent explicit test mode uses `mock_fn`; unavailable inference may use rule-based/
  template fallbacks.
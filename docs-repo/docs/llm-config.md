# LiteLLM Config Guide

Introduced in **COACH-07** (shared client) and completed across all agents in
**S-MIG-01**. Every agent now talks to the LLM through one client; the only
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
and the exceptions `LLMRequestError` and `MissingMockResponderError`.

Recognised agent aliases (`AGENT_GROUPS`): `coach`, `planner`, `search`,
`reflection`, `course_ingestion`, `evaluator`.

### How messages are built

- **System role** — `build_system_block(system_prompt)` wraps system content in
  its own delimited, trusted block (prompt-guard). User content is never
  concatenated into it.
- **User role** — your raw user prompt.

### Mock semantics

The router is bypassed with `mock_fn(user_prompt)` when:

- `LLM_MOCK=1`, or
- none of the provider keys needed for an agent (primary **or** its fallback
  chain) are present in the environment (`DUMMY_KEYS = {"dummy_key_for_testing"}`
  is treated as absent).

If mocking is requested but `mock_fn` is `None`, `ask` raises
`MissingMockResponderError` — callers use this as "LLM unavailable" and fall
back (rule engine, `""`, template question, etc.).

### Error behaviour

A real call that exhausts the router's retries raises `LLMRequestError`;
non-transient parse/validation problems are handled by each caller, not the
client.

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
| `coach` | `gemini/gemini-2.0-flash` | 0.5 / 512 | `[groq-main]` |
| `planner` | `nvidia_nim/deepseek-ai/deepseek-r1` | 0.3 / 2048 | `[nvidia-main, groq-main]` |
| `search` | `openrouter/meta-llama/llama-3.3-70b-instruct` | 0.2 / 1536 | `[groq-main]` |
| `reflection` | `nvidia_nim/meta/llama-3.3-70b-instruct` | 0.7 / 2048 | `[groq-main]` |
| `course_ingestion` | `groq/llama-3.1-8b-instant` | 0.1 / 1024 | `[nvidia-main]` |
| `evaluator` | `gemini/gemini-2.0-flash` | 0.3 / 1536 | `[groq-main, openrouter-main]` |

Fallback deployments: `groq-main` = `groq/llama-3.3-70b-versatile`,
`nvidia-main` = `nvidia_nim/meta/llama-3.3-70b-instruct`,
`openrouter-main` = `openrouter/meta-llama/llama-3.3-70b-instruct`.

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

`build_router()` lifts `num_retries`/`allowed_fails`/`retry_after`/
`cooldown_time` to the `litellm.Router` constructor and passes `fallbacks` as
LiteLLM expects. `litellm.drop_params = True` is set globally.

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
- Per-agent no-key degradation is preserved via `mock_fn` or rule-based/
  template fallbacks.
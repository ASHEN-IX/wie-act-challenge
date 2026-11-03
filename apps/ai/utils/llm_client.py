"""Shared LLM client (COACH-07).

Every agent talks to the LLM through :func:`ask`. Model wiring lives in
``litellm/config.yaml`` (same shape as the reference hackership-ai repo): a
``model_list`` of deployments keyed by agent alias plus ``router_settings``
(retries + fallback chains). The alias is passed to :func:`ask` — no code change
needed to re-route, add providers, or change fallbacks, just edit the YAML.

Mock responders run only when ``LLM_MOCK=1`` is explicitly configured. Missing
provider keys (including dummy values) raise :class:`LLMUnavailableError` and
never silently substitute test output. A failing configured call raises
:class:`LLMRequestError` so callers can choose an identified fallback.
"""

import hashlib
import os
import json
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Dict, List, Literal, Optional, Union, overload

from security.prompt_guard import build_system_block
from utils.logger import get_logger

logger = get_logger(__name__)

# Provider prefix -> env var holding its API key. LiteLLM reads these itself for
# the real call; we only inspect them to decide whether to use the mock.
PROVIDER_KEY_ENV = {
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "nvidia_nim": "NVIDIA_API_KEY",
}

DUMMY_KEYS = {"dummy_key_for_testing"}

# Aliases agents may target via ask(). Anything else the YAML declares (e.g.
# fallback providers) is a router-internal deployment.
AGENT_GROUPS = (
    "coach",
    "planner",
    "search",
    "reflection",
    "course_ingestion",
    "evaluator",
    "facilitator",
    # Visual Learning Lab: selection is a bounded classification (compact), while
    # scenario planning must reason about the concept (capable).
    "visual_lab_selector",
    "visual_lab_planner",
)


class ModelTier(str, Enum):
    """Categorization for model operations (ED-03)."""

    COMPACT = "compact"
    CAPABLE = "capable"


class ExecutionMode(str, Enum):
    """Explicit provider execution modes (ED-03)."""

    REAL_APPROVED = "REAL_APPROVED"
    MOCK_TEST = "MOCK_TEST"
    DETERMINISTIC_FALLBACK = "DETERMINISTIC_FALLBACK"
    UNAVAILABLE = "UNAVAILABLE"


AGENT_TIERS: Dict[str, ModelTier] = {
    "coach": ModelTier.COMPACT,
    "course_ingestion": ModelTier.COMPACT,
    "planner": ModelTier.CAPABLE,
    "evaluator": ModelTier.CAPABLE,
    "search": ModelTier.CAPABLE,
    "reflection": ModelTier.CAPABLE,
    # Peer-first interventions weigh several learners' dialogue at once (synthesis).
    "facilitator": ModelTier.CAPABLE,
    "visual_lab_selector": ModelTier.COMPACT,
    "visual_lab_planner": ModelTier.CAPABLE,
}


# Explicit operator allow-list and shared durable request reservations. Missing
# approval or unavailable durable accounting never triggers external traffic.
_execution_records: Dict[str, dict] = {}


def _approval(agent):
    try:
        approval = json.loads(os.getenv("LLM_APPROVALS_JSON", "{}")).get(agent, {})
        # The research alias is deliberately not an ask() agent. Its dedicated
        # adapter still uses this same approval and durable-budget machinery.
        model = (_deployment(agent)["model"] if agent == "course_multimodal_prototype"
                 else agent_config(agent).model)
        if (
            not isinstance(approval.get("approvalId"), str)
            or not 1 <= len(approval["approvalId"]) <= 200
            or approval.get("model") != model
            or approval.get("task") != agent
            or float(approval.get("expiresAt", 0)) <= time.time()
            or type(approval.get("maxRequests")) is not int
            or approval["maxRequests"] < 1
            or _provider_of(model) not in PROVIDER_KEY_ENV
        ):
            return None
        if "maxTokens" in approval and (not isinstance(approval["maxTokens"], int) or approval["maxTokens"] < 1):
            return None
        if "maxCostUsd" in approval and (not isinstance(approval["maxCostUsd"], (int, float)) or float(approval["maxCostUsd"]) <= 0):
            return None
        return approval
    except (ValueError, TypeError, AttributeError):
        return None


def _reserve_approved_call(agent):
    approval = _approval(agent)
    return approval if approval and _reserve_durable_budget(approval) else None


def _reserve_durable_budget(approval):
    """Reserve before dispatch; an uncertain write never authorizes a call.

    Each approval ID is bound to its original task, model, limit and expiry.
    Supports request caps, token caps, monetary caps and explicit revocation.
    Attempts are consumed even if the process crashes or the provider fails.
    """
    uri = os.getenv("LLM_BUDGET_MONGODB_URI")
    database = os.getenv("LLM_BUDGET_DB_NAME")
    if not uri or not database:
        return False
    client = None
    try:
        from pymongo import MongoClient, ReturnDocument
        from pymongo.errors import DuplicateKeyError
        from pymongo.write_concern import WriteConcern

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
            retryWrites=False,
        )
        records = client[database].get_collection(
            "llm_approval_budgets",
            write_concern=WriteConcern(w="majority", j=True, wtimeout=2000),
        )
        identity = {
            "_id": approval["approvalId"],
            "task": approval["task"],
            "model": approval["model"],
            "limit": approval["maxRequests"],
            "expiresAt": float(approval["expiresAt"]),
        }
        max_tokens = approval.get("maxTokens")
        max_cost_usd = approval.get("maxCostUsd")

        insert_doc: Dict[str, Any] = {
            **identity,
            "used": 0,
            "usedTokens": 0,
            "usedCostUsd": 0.0,
        }
        if max_tokens is not None:
            insert_doc["maxTokens"] = max_tokens
        if max_cost_usd is not None:
            insert_doc["maxCostUsd"] = float(max_cost_usd)

        try:
            records.update_one(
                {"_id": identity["_id"]},
                {"$setOnInsert": insert_doc},
                upsert=True,
            )
        except DuplicateKeyError:
            # A concurrent process created the same ID; the exact identity
            # predicate below still rejects conflicting approval records.
            pass

        filter_query: Dict[str, Any] = {
            **identity,
            "expiresAt": {"$eq": identity["expiresAt"], "$gt": time.time()},
            "used": {"$lt": identity["limit"]},
            "revokedAt": {"$exists": False},
        }
        if max_tokens is not None:
            filter_query["usedTokens"] = {"$lt": max_tokens}
        if max_cost_usd is not None:
            filter_query["usedCostUsd"] = {"$lt": float(max_cost_usd)}

        return bool(
            records.find_one_and_update(
                filter_query,
                {"$inc": {"used": 1}},
                return_document=ReturnDocument.AFTER,
            )
        )
    except Exception:
        # Do not log MongoDB URIs or credentials; failure denies dispatch.
        logger.warning("llm_budget_reservation_unavailable")
        return False
    finally:
        if client is not None:
            client.close()


def record_durable_usage(approval_id: str, tokens: int = 0, cost_usd: float = 0.0) -> bool:
    """Record durable token count and monetary cost to MongoDB after execution."""
    uri = os.getenv("LLM_BUDGET_MONGODB_URI")
    database = os.getenv("LLM_BUDGET_DB_NAME")
    if not uri or not database or not approval_id:
        return False
    client = None
    try:
        from pymongo import MongoClient
        from pymongo.write_concern import WriteConcern

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
            retryWrites=False,
        )
        records = client[database].get_collection(
            "llm_approval_budgets",
            write_concern=WriteConcern(w="majority", j=True, wtimeout=2000),
        )
        update_inc: Dict[str, Any] = {}
        if tokens > 0:
            update_inc["usedTokens"] = tokens
        if cost_usd > 0.0:
            update_inc["usedCostUsd"] = float(cost_usd)
        if not update_inc:
            return True
        records.update_one({"_id": approval_id}, {"$inc": update_inc})
        return True
    except Exception:
        logger.warning("llm_budget_usage_record_unavailable")
        return False
    finally:
        if client is not None:
            client.close()


def revoke_operator_approval(approval_id: str, reason: str = "operator_revocation") -> bool:
    """Explicitly revoke an active operator approval, stopping further requests immediately."""
    uri = os.getenv("LLM_BUDGET_MONGODB_URI")
    database = os.getenv("LLM_BUDGET_DB_NAME")
    if not uri or not database or not approval_id:
        return False
    client = None
    try:
        from pymongo import MongoClient
        from pymongo.write_concern import WriteConcern

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
            retryWrites=False,
        )
        records = client[database].get_collection(
            "llm_approval_budgets",
            write_concern=WriteConcern(w="majority", j=True, wtimeout=2000),
        )
        res = records.update_one(
            {"_id": approval_id, "revokedAt": {"$exists": False}},
            {"$set": {"revokedAt": time.time(), "revocationReason": reason}},
        )
        return bool(res.modified_count > 0)
    except Exception:
        logger.warning("llm_approval_revocation_unavailable")
        return False
    finally:
        if client is not None:
            client.close()


def get_approval_budget_status(approval_id: str) -> Optional[dict]:
    """Inspect durable budget usage and revocation state."""
    uri = os.getenv("LLM_BUDGET_MONGODB_URI")
    database = os.getenv("LLM_BUDGET_DB_NAME")
    if not uri or not database or not approval_id:
        return None
    client = None
    try:
        from pymongo import MongoClient
        from pymongo.read_concern import ReadConcern

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
        )
        records = client[database].get_collection(
            "llm_approval_budgets", read_concern=ReadConcern("majority")
        )
        doc = records.find_one({"_id": approval_id})
        if not doc:
            return None
        return {
            "approvalId": doc.get("_id"),
            "task": doc.get("task"),
            "model": doc.get("model"),
            "usedRequests": doc.get("used", 0),
            "limitRequests": doc.get("limit", 0),
            "usedTokens": doc.get("usedTokens", 0),
            "limitTokens": doc.get("maxTokens"),
            "usedCostUsd": doc.get("usedCostUsd", 0.0),
            "limitCostUsd": doc.get("maxCostUsd"),
            "revoked": "revokedAt" in doc,
            "revocationReason": doc.get("revocationReason"),
            "expiresAt": doc.get("expiresAt"),
        }
    except Exception:
        return None
    finally:
        if client is not None:
            client.close()


def _budget_still_active(approval):
    """Read the shared revocation state before dispatch and result delivery."""
    uri = os.getenv("LLM_BUDGET_MONGODB_URI")
    database = os.getenv("LLM_BUDGET_DB_NAME")
    if not uri or not database:
        return False
    client = None
    try:
        from pymongo import MongoClient
        from pymongo.read_concern import ReadConcern

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
        )
        records = client[database].get_collection(
            "llm_approval_budgets", read_concern=ReadConcern("majority")
        )
        return bool(
            records.find_one(
                {
                    "_id": approval["approvalId"],
                    "task": approval["task"],
                    "model": approval["model"],
                    "limit": approval["maxRequests"],
                    "expiresAt": {
                        "$eq": float(approval["expiresAt"]),
                        "$gt": time.time(),
                    },
                    "used": {"$gte": 1},
                    "revokedAt": {"$exists": False},
                },
                {"_id": 1},
            )
        )
    except Exception:
        logger.warning("llm_budget_status_unavailable")
        return False
    finally:
        if client is not None:
            client.close()


def get_model_tier(agent: str) -> str:
    """Return model tier ('compact' | 'capable') for given agent."""
    if agent not in AGENT_TIERS:
        raise KeyError(
            f"unknown llm agent: {agent!r} (known: {', '.join(AGENT_GROUPS)})"
        )
    return AGENT_TIERS[agent].value


@dataclass(frozen=True)
class LLMResult:
    """Sanitized LLM inference result with safe execution mode reporting."""

    text: str
    execution_mode: str
    model: str
    tier: str
    agent: str
    trace_id: str = ""
    fallback_used: bool = False
    usage: Optional[Dict[str, int]] = None
    latency_ms: Optional[float] = None
    # True when the text was served from the response cache. The original call was
    # a REAL_APPROVED call; no provider request was made for this result.
    cache_hit: bool = False


DEFAULT_CONFIG_PATH = Path(__file__).resolve().parents[1] / "litellm" / "config.yaml"

MockResponder = Callable[[str], str]
DeterministicFallback = Callable[[str], str]


def sanitize_text(text: str) -> str:
    """Scrub known API keys and tokens from text to guarantee zero credential leakage."""
    if not text:
        return text
    scrubbed = str(text)
    for env_var in PROVIDER_KEY_ENV.values():
        key_val = os.getenv(env_var, "")
        if key_val and len(key_val) >= 6:
            scrubbed = scrubbed.replace(key_val, "[REDACTED_API_KEY]")
    service_key = os.getenv("AI_SERVICE_API_KEY", "")
    if service_key and len(service_key) >= 6:
        scrubbed = scrubbed.replace(service_key, "[REDACTED_SERVICE_KEY]")
    return scrubbed


class LLMRequestError(RuntimeError):
    """A real LLM call failed after the router retries were exhausted."""


class LLMUnavailableError(LLMRequestError):
    """Inference cannot run because no provider credentials are configured."""

    state = "UNAVAILABLE"


class MissingMockResponderError(RuntimeError):
    """Explicit mock mode was requested but no ``mock_fn`` was given."""


@dataclass(frozen=True)
class AgentLLM:
    """Resolved wiring for one agent alias (from litellm/config.yaml)."""

    model: str
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    fallback_models: tuple[str, ...] = ()


_config: Optional[Dict[str, Any]] = None
_router: Optional["litellm.Router"] = None


def config_path() -> Path:
    overridden = os.getenv("LLM_CONFIG")
    return Path(overridden) if overridden else DEFAULT_CONFIG_PATH


def load_config() -> Dict[str, Any]:
    """Parse litellm/config.yaml (cached; use reload_config to clear)."""
    global _config
    if _config is None:
        import yaml

        with open(config_path(), "r", encoding="utf-8") as fh:
            _config = yaml.safe_load(fh) or {}
    return _config


def reload_config() -> None:
    """Drop the cached YAML config (used by tests between env changes)."""
    global _config, _router
    _config = None
    _router = None


def _deployment(name: str) -> Dict[str, Any]:
    for entry in load_config().get("model_list", []):
        if entry.get("model_name") == name:
            params = entry.get("litellm_params", {}) or {}
            return {"model": params.get("model", ""), "litellm_params": params}
    raise KeyError(f"no deployment named {name!r} in {config_path()}")


def _fallback_chain(agent: str) -> List[str]:
    cfg = load_config()
    for mapping in cfg.get("router_settings", {}).get("fallbacks", []):
        if agent in mapping:
            return list(mapping[agent])
    return []


def agent_config(agent: str) -> AgentLLM:
    """Resolve an agent's wiring from the YAML (model + defaults + fallbacks)."""
    if agent not in AGENT_GROUPS:
        raise KeyError(
            f"unknown llm agent: {agent!r} (known: {', '.join(AGENT_GROUPS)})"
        )
    params = _deployment(agent)["litellm_params"]
    return AgentLLM(
        model=params.get("model", ""),
        temperature=params.get("temperature"),
        max_tokens=params.get("max_tokens"),
        fallback_models=tuple(
            _deployment(fb)["litellm_params"].get("model", "")
            for fb in _fallback_chain(agent)
        ),
    )


def _provider_of(model: str) -> str:
    return model.split("/", 1)[0]


def _required_key_envs(agent: str) -> List[str]:
    """Env vars involved for an agent's primary model and its fallback chain."""
    cfg = agent_config(agent)
    envs: List[str] = []
    for model in (cfg.model, *cfg.fallback_models):
        if not model:
            continue
        key_env = PROVIDER_KEY_ENV.get(_provider_of(model))
        if key_env and key_env not in envs:
            envs.append(key_env)
    return envs


def _keys_available(agent: str) -> bool:
    """Any involved provider key present? (An explicit fallback works if primary
    is key-less, so we only require at least one real key.)"""
    for key_env in _required_key_envs(agent):
        value = os.getenv(key_env, "")
        if (
            value
            and value not in DUMMY_KEYS
            and not any(
                marker in value.lower()
                for marker in (
                    "synthetic",
                    "invalid",
                    "placeholder",
                    "test-",
                    "test_",
                    "dummy",
                    "changeme",
                )
            )
        ):
            return True
    return False


def _should_mock(_agent: str) -> bool:
    return os.getenv("LLM_MOCK") == "1"


def _extract_text(response) -> str:
    if hasattr(response, "choices"):
        return response.choices[0].message.content
    return response["choices"][0]["message"]["content"]


def build_router():
    """Build (once) the LiteLLM Router straight from litellm/config.yaml."""
    global _router
    if _router is not None:
        return _router

    import litellm

    litellm.drop_params = True
    cfg = load_config()
    router_settings = dict(cfg.get("router_settings", {}) or {})
    fallbacks = router_settings.pop("fallbacks", [])
    retry_kwargs: Dict[str, Any] = {
        key: router_settings.pop(key)
        for key in ("num_retries", "retry_after", "allowed_fails", "cooldown_time")
        if key in router_settings
    }
    for unused in router_settings:
        logger.warning("llm_router_unknown_setting", extra={"key": unused})

    # Router-level fallbacks are deliberately not enabled. `ask()` accepts only the
    # model named in the operator's approval (`approval["model"]`) and raises
    # "Provider/model identity did not match approval" for anything else. A fallback
    # deployment reporting a different model would therefore be discarded after
    # being paid for, and a same-family fallback would silently answer as the
    # approved model. Recovery is the caller's typed deterministic fallback instead,
    # which is reported as DETERMINISTIC_FALLBACK rather than passed off as
    # inference. The YAML still resolves these chains via `agent_config()` for
    # routing, documentation and so a fallback-aware approval model can adopt them.
    configured_fallbacks = _configured_fallback_agents()
    if configured_fallbacks:
        logger.info(
            "llm_router_fallbacks_not_routed",
            extra={
                "agents": configured_fallbacks,
                "reason": "approval_binds_exact_model",
            },
        )

    _router = litellm.Router(
        model_list=cfg.get("model_list", []),
        fallbacks=[],
        # Retries stay with the caller: each attempt needs its own approval budget
        # reservation, which the Router cannot make.
        **{**retry_kwargs, "num_retries": 0},
    )
    return _router


def _configured_fallback_agents() -> List[str]:
    """Agents whose YAML declares a fallback chain.

    Reported at router construction so an operator can see that a chain in the
    config is documentation rather than active routing.
    """
    chains = load_config().get("router_settings", {}).get("fallbacks", []) or []
    agents: List[str] = []
    for mapping in chains:
        if isinstance(mapping, dict):
            agents.extend(mapping.keys())
    return agents


def reset_router() -> None:
    """Drop the cached router (used by tests between env/config changes)."""
    global _router
    _router = None


# ----------------------------------------------------------- response cache #
# Opt-in per call (``cache=True``) and only for content that carries no learner
# data, so a repeated course-only request does not reach the provider again.
# Only validated REAL_APPROVED responses are stored; mock and fallback results
# never are. Cache failures degrade to a normal approved call.

LLM_CACHE_PREFIX = "llm:cache:"
DEFAULT_LLM_CACHE_TTL_SECONDS = 7 * 24 * 3600
_cache_redis = None


def _cache_ttl_seconds() -> int:
    try:
        return max(1, int(os.getenv("LLM_CACHE_TTL_SECONDS", DEFAULT_LLM_CACHE_TTL_SECONDS)))
    except ValueError:
        return DEFAULT_LLM_CACHE_TTL_SECONDS


def _cache_client():
    global _cache_redis
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    if _cache_redis is None:
        import redis

        _cache_redis = redis.Redis.from_url(
            url, socket_connect_timeout=1, socket_timeout=1, decode_responses=True
        )
    return _cache_redis


def _cache_key(
    agent: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
    temperature: Optional[float],
    max_tokens: Optional[int],
) -> str:
    material = json.dumps(
        [agent, model, system_prompt, user_prompt, temperature, max_tokens],
        ensure_ascii=False,
    )
    return LLM_CACHE_PREFIX + hashlib.sha256(material.encode("utf-8")).hexdigest()


def _cache_get(key: str) -> Optional[dict]:
    try:
        client = _cache_client()
        raw = client.get(key) if client else None
        return json.loads(raw) if raw else None
    except Exception as exc:
        logger.warning("llm_cache_read_failed", extra={"error": sanitize_text(str(exc))})
        return None


def _cache_set(key: str, payload: dict) -> None:
    try:
        client = _cache_client()
        if client:
            client.set(key, json.dumps(payload, ensure_ascii=False), ex=_cache_ttl_seconds())
    except Exception as exc:
        logger.warning("llm_cache_write_failed", extra={"error": sanitize_text(str(exc))})


@overload
def ask(
    agent: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    mock_fn: Optional[MockResponder] = None,
    fallback_fn: Optional[DeterministicFallback] = None,
    trace_id: str = "",
    cache: bool = False,
    return_metadata: Literal[False] = False,
) -> str: ...


@overload
def ask(
    agent: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    mock_fn: Optional[MockResponder] = None,
    fallback_fn: Optional[DeterministicFallback] = None,
    trace_id: str = "",
    cache: bool = False,
    return_metadata: Literal[True],
) -> LLMResult: ...


def ask(
    agent: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    mock_fn: Optional[MockResponder] = None,
    fallback_fn: Optional[DeterministicFallback] = None,
    trace_id: str = "",
    cache: bool = False,
    return_metadata: bool = False,
) -> Union[str, LLMResult]:
    """Complete a chat for ``agent`` and return the assistant text or LLMResult.

    System content is placed in its own trusted, guarded block — user content is
    never concatenated into it (COACH-03 protection kept for every agent).
    Per-call ``temperature``/``max_tokens`` override the YAML defaults when given
    (normally the deployment's litellm_params carry them).
    """
    if agent not in AGENT_GROUPS:
        raise KeyError(
            f"unknown llm agent: {agent!r} (known: {', '.join(AGENT_GROUPS)})"
        )

    tier = get_model_tier(agent)
    cfg = agent_config(agent)

    if _should_mock(agent):
        if mock_fn is None:
            raise MissingMockResponderError(
                f"LLM_MOCK=1 for agent {agent!r} but no mock_fn given"
            )
        start_time = time.perf_counter()
        text = mock_fn(user_prompt)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        logger.info(
            "llm_client_mock_response",
            extra={
                "agent": agent,
                "trace_id": trace_id,
                "execution_mode": ExecutionMode.MOCK_TEST.value,
                "tier": tier,
                "model": cfg.model,
            },
        )
        res = LLMResult(
            text=text,
            execution_mode=ExecutionMode.MOCK_TEST.value,
            model=cfg.model,
            tier=tier,
            agent=agent,
            trace_id=trace_id,
            fallback_used=False,
            latency_ms=latency_ms,
        )
        return res if return_metadata else res.text

    approval = _reserve_approved_call(agent) if _keys_available(agent) else None
    if approval and (
        _approval(agent) != approval or not _budget_still_active(approval)
    ):
        approval = None
    if not approval:
        if fallback_fn is not None:
            start_time = time.perf_counter()
            text = fallback_fn(user_prompt)
            latency_ms = (time.perf_counter() - start_time) * 1000.0
            logger.warning(
                "llm_client_deterministic_fallback",
                extra={
                    "agent": agent,
                    "trace_id": trace_id,
                    "execution_mode": ExecutionMode.DETERMINISTIC_FALLBACK.value,
                    "tier": tier,
                    "reason": "credentials_approval_or_budget_unavailable",
                },
            )
            res = LLMResult(
                text=text,
                execution_mode=ExecutionMode.DETERMINISTIC_FALLBACK.value,
                model="deterministic_fallback",
                tier=tier,
                agent=agent,
                trace_id=trace_id,
                fallback_used=True,
                latency_ms=latency_ms,
            )
            return res if return_metadata else res.text

        logger.warning(
            "llm_client_unavailable",
            extra={
                "agent": agent,
                "trace_id": trace_id,
                "execution_mode": ExecutionMode.UNAVAILABLE.value,
                "tier": tier,
            },
        )
        raise LLMUnavailableError(
            f"UNAVAILABLE: credentials, approval or durable budget unavailable for {agent!r}"
        )

    cache_key = (
        _cache_key(agent, cfg.model, system_prompt, user_prompt, temperature, max_tokens)
        if cache
        else None
    )
    if cache_key:
        cached = _cache_get(cache_key)
        if cached:
            logger.info(
                "llm_cache_hit",
                extra={"agent": agent, "trace_id": trace_id, "tier": tier, "model": cached["model"]},
            )
            res = LLMResult(
                text=cached["text"],
                execution_mode=ExecutionMode.REAL_APPROVED.value,
                model=cached["model"],
                tier=tier,
                agent=agent,
                trace_id=trace_id,
                fallback_used=False,
                cache_hit=True,
            )
            return res if return_metadata else res.text
        logger.info("llm_cache_miss", extra={"agent": agent, "trace_id": trace_id, "tier": tier})

    messages = [
        {"role": "system", "content": build_system_block(system_prompt)},
        {"role": "user", "content": user_prompt},
    ]
    kwargs: Dict[str, Any] = {"model": agent, "messages": messages}
    if temperature is not None:
        kwargs["temperature"] = temperature
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    start_time = time.perf_counter()
    try:
        response = build_router().completion(**kwargs)
        latency_ms = (time.perf_counter() - start_time) * 1000.0
        text = _extract_text(response)
        if not isinstance(text, str) or not text.strip():
            raise LLMRequestError("Invalid empty model response")
        current = _approval(agent)
        if current != approval or not _budget_still_active(approval):
            raise LLMUnavailableError("Approval revoked during inference")
        # Providers echo either the full LiteLLM route (nvidia_nim/meta/...) or the
        # bare model id (Groq: openai/gpt-oss-20b for groq/openai/gpt-oss-20b).
        # Only the approved model's own route or its bare id is accepted.
        approved_bare = approval["model"].split("/", 1)[1]
        if getattr(response, "model", None) not in (approval["model"], approved_bare):
            raise LLMRequestError("Provider/model identity did not match approval")
        _execution_records[agent] = {
            "approvalId": approval["approvalId"],
            "model": approval["model"],
            "executedAt": time.time(),
            "outputValidated": True,
            "executionMode": "REAL_APPROVED",
        }

        usage_dict = None
        if hasattr(response, "usage") and response.usage:
            usage_dict = {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(response.usage, "completion_tokens", 0),
                "total_tokens": getattr(response.usage, "total_tokens", 0),
            }
        elif isinstance(response, dict) and "usage" in response:
            u = response["usage"]
            usage_dict = {
                "prompt_tokens": u.get("prompt_tokens", 0),
                "completion_tokens": u.get("completion_tokens", 0),
                "total_tokens": u.get("total_tokens", 0),
            }

        if usage_dict and approval:
            record_durable_usage(
                approval["approvalId"],
                tokens=usage_dict.get("total_tokens", 0),
                cost_usd=float(getattr(response, "_response_cost", 0.0) or 0.0),
            )

        resolved_model = getattr(response, "model", cfg.model) or cfg.model
        logger.info(
            "llm_client_success",
            extra={
                "agent": agent,
                "trace_id": trace_id,
                "execution_mode": ExecutionMode.REAL_APPROVED.value,
                "tier": tier,
                "model": resolved_model,
            },
        )
        if cache_key:
            _cache_set(cache_key, {"text": text, "model": resolved_model})
        res = LLMResult(
            text=text,
            execution_mode=ExecutionMode.REAL_APPROVED.value,
            model=resolved_model,
            tier=tier,
            agent=agent,
            trace_id=trace_id,
            fallback_used=False,
            usage=usage_dict,
            latency_ms=latency_ms,
        )
        return res if return_metadata else res.text
    except Exception as exc:
        sanitized_err = sanitize_text(str(exc))
        logger.warning(
            "llm_client_error",
            extra={"agent": agent, "error": sanitized_err, "trace_id": trace_id},
        )
        if fallback_fn is not None:
            start_time_fallback = time.perf_counter()
            text = fallback_fn(user_prompt)
            latency_ms = (time.perf_counter() - start_time_fallback) * 1000.0
            logger.warning(
                "llm_client_deterministic_fallback",
                extra={
                    "agent": agent,
                    "trace_id": trace_id,
                    "execution_mode": ExecutionMode.DETERMINISTIC_FALLBACK.value,
                    "tier": tier,
                    "reason": "router_error",
                },
            )
            res = LLMResult(
                text=text,
                execution_mode=ExecutionMode.DETERMINISTIC_FALLBACK.value,
                model="deterministic_fallback",
                tier=tier,
                agent=agent,
                trace_id=trace_id,
                fallback_used=True,
                latency_ms=latency_ms,
            )
            return res if return_metadata else res.text
        raise LLMRequestError(f"{agent}: {sanitized_err}") from exc


def ask_with_metadata(
    agent: str,
    system_prompt: str,
    user_prompt: str,
    *,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    mock_fn: Optional[MockResponder] = None,
    fallback_fn: Optional[DeterministicFallback] = None,
    trace_id: str = "",
) -> LLMResult:
    """Complete a chat and return sanitized LLMResult with mode reporting (ED-03)."""
    return ask(
        agent,
        system_prompt,
        user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        mock_fn=mock_fn,
        fallback_fn=fallback_fn,
        trace_id=trace_id,
        return_metadata=True,
    )


def get_provider_status() -> Dict[str, Any]:
    """Configuration is never successful inference. Status contains no credentials."""
    mocked = os.getenv("LLM_MOCK") == "1"
    agents = {}
    for agent in AGENT_GROUPS:
        cfg = agent_config(agent)
        approval = _approval(agent)
        record = _execution_records.get(agent)
        verified = bool(
            approval
            and record
            and record["approvalId"] == approval["approvalId"]
            and _keys_available(agent)
            and _budget_still_active(approval)
        )
        agents[agent] = {
            "tier": get_model_tier(agent),
            "model": cfg.model,
            "fallback_models": list(cfg.fallback_models),
            "configured": True,
            "credentialsPresent": any(
                bool(os.getenv(key)) for key in _required_key_envs(agent)
            ),
            "approved": bool(approval),
            "connectivityVerified": verified,
            "identityVerified": verified,
            "successfullyExecuted": verified,
            "outputValidated": verified,
            "available": mocked or verified,
            "lastExecution": record if verified else None,
        }
    any_real = any(a["successfullyExecuted"] for a in agents.values())
    return {
        "status": "ok" if mocked else ("degraded" if any_real else "unavailable"),
        "execution_mode": (
            "MOCK_TEST" if mocked else ("REAL_APPROVED" if any_real else "UNAVAILABLE")
        ),
        "agents": agents,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

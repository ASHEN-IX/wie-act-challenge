"""LLM response cache (utils/llm_client.py): opt-in, approved real responses only.

Budget and approval gates are patched to pass, so these tests isolate the cache:
- a repeated opt-in call is served without a provider request
- calls that do not opt in never touch the cache
- changed prompts miss, mock and fallback results are never stored
- a Redis outage degrades to a normal approved call
- entries expire after LLM_CACHE_TTL_SECONDS
"""

import json
import time
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from utils import llm_client
from utils.llm_client import ask, reload_config, reset_router


class FakeRedis:
    def __init__(self):
        self.data = {}
        self.sets = []

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value, ex=None):
        self.data[key] = value
        self.sets.append((key, ex))


class BrokenRedis:
    def get(self, key):
        raise ConnectionError("redis unreachable")

    def set(self, key, value, ex=None):
        raise ConnectionError("redis unreachable")


class CountingRouter:
    def __init__(self):
        self.calls = 0

    def completion(self, **kwargs):
        self.calls += 1
        return SimpleNamespace(
            model=llm_client.agent_config("course_ingestion").model,
            choices=[
                SimpleNamespace(message=SimpleNamespace(content=f"answer-{self.calls}"))
            ],
        )


@pytest.fixture(autouse=True)
def _cache_env(monkeypatch):
    reload_config()
    reset_router()
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("LLM_CACHE_TTL_SECONDS", raising=False)
    for key in ("GEMINI_API_KEY", "NVIDIA_API_KEY", "OPENROUTER_API_KEY"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("GROQ_API_KEY", "real-key")
    monkeypatch.setenv(
        "LLM_APPROVALS_JSON",
        json.dumps(
            {
                "course_ingestion": {
                    "approvalId": "cache-test-" + str(time.time()),
                    "model": llm_client.agent_config("course_ingestion").model,
                    "task": "course_ingestion",
                    "expiresAt": time.time() + 60,
                    "maxRequests": 100,
                }
            }
        ),
    )
    monkeypatch.setattr(llm_client, "_reserve_durable_budget", lambda _: True)
    monkeypatch.setattr(llm_client, "_budget_still_active", lambda _: True)
    fake = FakeRedis()
    monkeypatch.setattr(llm_client, "_cache_client", lambda: fake)
    yield fake
    reload_config()
    reset_router()


def _call(prompt="course body", **kwargs):
    return ask("course_ingestion", "system", prompt, **kwargs)


def test_repeated_opt_in_call_is_served_from_cache(_cache_env):
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        first = ask("course_ingestion", "system", "course body", cache=True, return_metadata=True)
        second = ask("course_ingestion", "system", "course body", cache=True, return_metadata=True)
    assert router.calls == 1
    assert first.cache_hit is False
    assert second.cache_hit is True
    assert second.text == first.text == "answer-1"
    assert second.execution_mode == "REAL_APPROVED"


def test_calls_without_opt_in_never_use_the_cache(_cache_env):
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        _call()
        _call()
    assert router.calls == 2
    assert _cache_env.sets == []


def test_changed_user_prompt_misses_the_cache(_cache_env):
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        _call("course body", cache=True)
        _call("course body, revised", cache=True)
    assert router.calls == 2


def test_cache_key_does_not_contain_the_prompt_text(_cache_env):
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        _call("PRIVATE-COURSE-SENTENCE", cache=True)
    (key, _ttl), = _cache_env.sets
    assert key.startswith(llm_client.LLM_CACHE_PREFIX)
    assert "PRIVATE-COURSE-SENTENCE" not in key
    assert "PRIVATE-COURSE-SENTENCE" not in _cache_env.data[key]


def test_mock_responses_are_never_stored(monkeypatch, _cache_env):
    monkeypatch.setenv("LLM_MOCK", "1")
    result = ask(
        "course_ingestion",
        "system",
        "course body",
        mock_fn=lambda _: "mock-text",
        cache=True,
        return_metadata=True,
    )
    assert result.execution_mode == "MOCK_TEST"
    assert _cache_env.sets == []


def test_redis_outage_degrades_to_a_normal_approved_call(monkeypatch):
    monkeypatch.setattr(llm_client, "_cache_client", lambda: BrokenRedis())
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        text = _call(cache=True)
    assert text == "answer-1"
    assert router.calls == 1


def test_entries_expire_after_the_default_week(_cache_env):
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        _call(cache=True)
    (_key, ttl), = _cache_env.sets
    assert ttl == 7 * 24 * 3600


def test_ttl_is_configurable(monkeypatch, _cache_env):
    monkeypatch.setenv("LLM_CACHE_TTL_SECONDS", "60")
    router = CountingRouter()
    with patch.object(llm_client, "build_router", return_value=router):
        _call(cache=True)
    (_key, ttl), = _cache_env.sets
    assert ttl == 60

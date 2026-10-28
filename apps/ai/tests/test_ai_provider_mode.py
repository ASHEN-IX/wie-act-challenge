"""Truthful local provider gates. Simulated completions do not certify live inference."""

import json
import time
from types import SimpleNamespace
from unittest.mock import patch
import pytest
from utils import llm_client as llm


@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    for name in (
        "LLM_MOCK",
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "NVIDIA_API_KEY",
        "OPENROUTER_API_KEY",
        "LLM_APPROVALS_JSON",
    ):
        monkeypatch.delenv(name, raising=False)
    llm._execution_records.clear()
    used = {}

    def reserve(approval):
        count = used.get(approval["approvalId"], 0)
        if count >= approval["maxRequests"]:
            return False
        used[approval["approvalId"]] = count + 1
        return True

    monkeypatch.setattr(llm, "_reserve_durable_budget", reserve)
    monkeypatch.setattr(llm, "_budget_still_active", lambda _: True)
    llm.reset_router()
    llm.reload_config()


def approve(monkeypatch, agent="coach", max_requests=1):
    cfg = llm.agent_config(agent)
    monkeypatch.setenv(
        llm.PROVIDER_KEY_ENV[llm._provider_of(cfg.model)],
        "LocalFixtureCredential123456789",
    )
    monkeypatch.setenv(
        "LLM_APPROVALS_JSON",
        json.dumps(
            {
                agent: {
                    "approvalId": "local-unit-only",
                    "model": cfg.model,
                    "task": agent,
                    "expiresAt": time.time() + 60,
                    "maxRequests": max_requests,
                }
            }
        ),
    )
    return cfg.model


@pytest.mark.parametrize(
    "key", ["", "invalid-synthetic-key", "dummy_key_for_testing", "test-key-123"]
)
def test_configuration_is_not_execution(monkeypatch, key):
    monkeypatch.setenv("GEMINI_API_KEY", key)
    with patch.object(llm, "build_router") as router:
        report = llm.get_provider_status()
        assert report["execution_mode"] == "UNAVAILABLE"
        with pytest.raises(llm.LLMUnavailableError):
            llm.ask("coach", "system", "question")
        router.assert_not_called()


def test_missing_approval_even_with_credentials(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "LocalFixtureCredential123456789")
    with patch.object(llm, "build_router") as router:
        with pytest.raises(llm.LLMUnavailableError):
            llm.ask("coach", "system", "question")
        router.assert_not_called()


def test_explicit_mock_and_deterministic_fallback(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "1")
    result = llm.ask(
        "coach", "system", "q", mock_fn=lambda _: "local mock", return_metadata=True
    )
    assert result.execution_mode == "MOCK_TEST"
    monkeypatch.delenv("LLM_MOCK")
    result = llm.ask(
        "coach",
        "system",
        "q",
        fallback_fn=lambda _: "local extract",
        return_metadata=True,
    )
    assert result.execution_mode == "DETERMINISTIC_FALLBACK"


@pytest.mark.parametrize("failure", ["timeout", "invalid", "foreign_model", "revoked"])
def test_failed_or_revoked_provider_cannot_claim_success(monkeypatch, failure):
    model = approve(monkeypatch)

    class Router:
        def completion(self, **kwargs):
            if failure == "timeout":
                raise TimeoutError("fixture timeout secret=must-not-leak")
            if failure == "revoked":
                monkeypatch.delenv("LLM_APPROVALS_JSON")
            return SimpleNamespace(
                model="foreign" if failure == "foreign_model" else model,
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content="" if failure == "invalid" else "response"
                        )
                    )
                ],
            )

    with patch.object(llm, "build_router", return_value=Router()):
        with pytest.raises(llm.LLMRequestError):
            llm.ask("coach", "system", "q")
    assert llm.get_provider_status()["execution_mode"] == "UNAVAILABLE"


def test_simulated_approved_call_requires_identity_and_budget(monkeypatch):
    model = approve(monkeypatch)
    response = SimpleNamespace(
        model=model,
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content="valid local simulated response")
            )
        ],
    )
    with patch.object(
        llm,
        "build_router",
        return_value=SimpleNamespace(completion=lambda **_: response),
    ):
        assert llm.get_provider_status()["execution_mode"] == "UNAVAILABLE"
        result = llm.ask("coach", "system", "q", return_metadata=True)
        assert (
            result.execution_mode == "REAL_APPROVED"
        )  # Unit simulation of the approved response boundary only.
        with pytest.raises(llm.LLMUnavailableError):
            llm.ask("coach", "system", "again")
    monkeypatch.delenv("LLM_APPROVALS_JSON")
    assert llm.get_provider_status()["execution_mode"] == "UNAVAILABLE"


def test_unknown_agent():
    with pytest.raises(KeyError):
        llm.ask("unsupported", "s", "q")

"""LLM budget client behaviour; no model or provider requests are made.

The spend ledger (`llm_approval_budgets`) belongs to the Node API, which makes
every reservation one conditional UPDATE — its atomicity, caps and revocation are
covered by the API's own tests (`llmBudget.test.ts`). What this file pins is the
Python side of that contract: it asks the API, it treats anything but a clear
"yes" as "no", and a failed or revoked reservation never reaches a provider.
"""

import json
import time
from types import SimpleNamespace

import httpx
import pytest

from services import api_service
from utils import llm_client as llm


def _approval(**overrides):
    return {
        "approvalId": "test",
        "task": "coach",
        "model": "fixture",
        "maxRequests": 1,
        "expiresAt": time.time() + 60,
        **overrides,
    }


class _Api:
    """Records requests and answers from a script, in place of the API."""

    def __init__(self, monkeypatch, answer):
        self.calls = []
        self._answer = answer
        monkeypatch.setenv("API_SERVICE_URL", "http://api.test")
        monkeypatch.setenv("INTERNAL_API_SECRET", "fixture-secret")
        monkeypatch.setattr(api_service.httpx, "request", self._request)

    def _request(self, method, url, params=None, json=None, headers=None, timeout=None):
        self.calls.append(SimpleNamespace(method=method, url=url, json=json, headers=headers))
        status, body = self._answer(method, url, json)
        if isinstance(status, Exception):
            raise status
        return httpx.Response(status, json=body, request=httpx.Request(method, url))


class _FakeLedger:
    """An in-memory ledger, to test how `llm.ask` reacts to it."""

    def __init__(self, monkeypatch):
        self.rows = {}
        self.revoked = set()
        monkeypatch.setattr(api_service, "budget_reserve", self.reserve)
        monkeypatch.setattr(api_service, "budget_active", self.active)

    def reserve(self, approval):
        if approval["approvalId"] in self.revoked:
            return False
        self.rows[approval["approvalId"]] = self.rows.get(approval["approvalId"], 0) + 1
        return self.rows[approval["approvalId"]] <= approval["maxRequests"]

    def active(self, approval):
        return approval["approvalId"] not in self.revoked and self.rows.get(approval["approvalId"], 0) >= 1


def test_budget_is_required_and_failure_never_dispatches(monkeypatch):
    approval = _approval()
    # No API configured: the ledger cannot be consulted, so nothing is reserved.
    monkeypatch.delenv("API_SERVICE_URL", raising=False)
    monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
    assert llm._reserve_durable_budget(approval) is False
    assert llm._budget_still_active(approval) is False
    # Configured but unreachable.
    _Api(monkeypatch, lambda *_: (httpx.ConnectError("down"), None))
    assert llm._reserve_durable_budget(approval) is False


def test_only_a_clear_yes_reserves(monkeypatch):
    approval = _approval()
    for status, body in [
        (200, {"reserved": False}),
        (200, {}),
        (200, {"reserved": "true"}),
        (400, {"error": "Invalid approval"}),
        (503, {"error": "Budget unavailable"}),
    ]:
        _Api(monkeypatch, lambda *_a, s=status, b=body: (s, b))
        assert llm._reserve_durable_budget(approval) is False, (status, body)
    _Api(monkeypatch, lambda *_: (200, {"reserved": True}))
    assert llm._reserve_durable_budget(approval) is True


def test_reservation_sends_the_approval_with_the_internal_secret_and_nothing_else(monkeypatch):
    api = _Api(monkeypatch, lambda *_: (200, {"reserved": True}))
    approval = _approval(maxTokens=500, unrelated="never sent", providerKey="never sent")
    assert llm._reserve_durable_budget(approval) is True
    (call,) = api.calls
    assert call.method == "POST"
    assert call.url == "http://api.test/api/v1/study/internal/budget/reserve"
    assert call.headers == {"x-internal-secret": "fixture-secret"}
    assert call.json == {
        "approval": {
            "approvalId": "test",
            "task": "coach",
            "model": "fixture",
            "maxRequests": 1,
            "expiresAt": approval["expiresAt"],
            "maxTokens": 500,
        }
    }


def test_usage_revocation_and_status_go_through_the_api(monkeypatch):
    api = _Api(
        monkeypatch,
        lambda method, url, _json: (
            (200, {"usedTokens": 600, "revoked": True})
            if method == "GET"
            else (200, {"recorded": True, "revoked": True})
        ),
    )
    assert llm.record_durable_usage("a-1", tokens=600, cost_usd=0.3) is True
    assert api.calls[-1].json == {"approvalId": "a-1", "tokens": 600, "costUsd": 0.3}
    assert llm.revoke_operator_approval("a-1", reason="halt") is True
    assert api.calls[-1].json == {"approvalId": "a-1", "reason": "halt"}
    assert llm.get_approval_budget_status("a-1") == {"usedTokens": 600, "revoked": True}
    assert llm.record_durable_usage("", tokens=1) is False
    assert llm.revoke_operator_approval("") is False
    assert llm.get_approval_budget_status("") is None


def test_unknown_approval_has_no_status(monkeypatch):
    _Api(monkeypatch, lambda *_: (404, {"error": "Approval not found"}))
    assert llm.get_approval_budget_status("missing") is None


def test_unavailable_budget_never_calls_provider(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("API_SERVICE_URL", raising=False)
    monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
    cfg = llm.agent_config("coach")
    monkeypatch.setenv(
        llm.PROVIDER_KEY_ENV[llm._provider_of(cfg.model)],
        "LocalFixtureCredential123456789",
    )
    monkeypatch.setenv(
        "LLM_APPROVALS_JSON",
        json.dumps({"coach": _approval(approvalId="fixture", model=cfg.model)}),
    )
    monkeypatch.setattr(
        llm, "build_router", lambda: pytest.fail("Provider must not be called")
    )
    with pytest.raises(llm.LLMUnavailableError):
        llm.ask("coach", "system", "question")


def test_revocation_during_completion_discards_the_result(monkeypatch):
    ledger = _FakeLedger(monkeypatch)
    cfg = llm.agent_config("coach")
    live = _approval(approvalId="revocation-fixture", model=cfg.model, maxRequests=5)
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.setenv("LLM_APPROVALS_JSON", json.dumps({"coach": live}))
    monkeypatch.setenv(
        llm.PROVIDER_KEY_ENV[llm._provider_of(cfg.model)],
        "LocalFixtureCredential123456789",
    )

    def revoke_during_simulated_completion(**_):
        ledger.revoked.add(live["approvalId"])
        return SimpleNamespace(
            model=cfg.model,
            choices=[SimpleNamespace(message=SimpleNamespace(content="private result"))],
        )

    monkeypatch.setattr(
        llm,
        "build_router",
        lambda: SimpleNamespace(completion=revoke_during_simulated_completion),
    )
    with pytest.raises(llm.LLMRequestError):
        llm.ask("coach", "system", "question")
    assert llm.get_provider_status()["execution_mode"] == "UNAVAILABLE"
    assert not llm._reserve_durable_budget(live)

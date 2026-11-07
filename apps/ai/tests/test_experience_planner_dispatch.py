"""Experience-planner provider dispatch (Batch 4, M4.2).

The Gemini SDK is mocked throughout. What is under test is the boundary's own
behaviour: what it refuses before dispatch, what it reports as usage, and how it
classifies an outcome it cannot prove was free.

No live provider call is made, and none is authorized by this milestone.
"""

import hashlib
import os
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from services.api.routers import experience_planner as planner


MODEL = "gemini/gemini-3.6-flash"
KEY = "test-key-not-real"


def _request(**overrides):
    payload = {
        "requestId": "req-1",
        "contextFingerprint": "fnv1a64:0123456789abcdef",
        "model": MODEL,
        "systemPolicy": "policy",
        "task": "task",
        "outputSchema": {"type": "object"},
        "limits": {"maxInputCharacters": 1000, "maxOutputTokens": 512, "timeoutMs": 5000},
    }
    payload.update(overrides)
    return planner.PlanRequest(**payload)


def _approval(**overrides):
    approval = {
        "approvalId": "approval-1",
        "task": planner.PLANNER_TASK,
        "model": MODEL,
        "expiresAt": 9_999_999_999.0,
        "maxRequests": 1,
        "maxTokens": 100_000,
    }
    approval.update(overrides)
    return approval


@pytest.fixture
def controls(monkeypatch):
    """Present credentials, an approval and a healthy budget by default."""
    monkeypatch.setenv("GEMINI_API_KEY", KEY)
    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", "mongodb://budget.test/")
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", "budget")
    monkeypatch.setattr(planner, "_approval", lambda model: _approval())
    monkeypatch.setattr(planner, "_budget_active", lambda approval: True)
    monkeypatch.setattr(planner, "_has_headroom", lambda approval: True)
    monkeypatch.setattr(planner, "_reconcile", lambda approval, tokens: None)


def _refusal(excinfo):
    """A refusal is raised as HTTPException with a typed code in the detail."""
    detail = excinfo.value.detail
    assert isinstance(detail, dict)
    assert detail.get("refused") is True
    return detail.get("code")


def test_request_schema_is_strict():
    with pytest.raises(Exception):
        planner.PlanRequest(
            requestId="r",
            contextFingerprint="f",
            model=MODEL,
            systemPolicy="p",
            task="t",
            outputSchema={},
            limits={"maxInputCharacters": 1, "maxOutputTokens": 1, "timeoutMs": 1000},
            unexpected="field",
        )


def test_timeout_bound_is_enforced():
    with pytest.raises(Exception):
        _request(limits={"maxInputCharacters": 10, "maxOutputTokens": 10, "timeoutMs": 999_999})


def test_preflight_reports_available_when_controls_present(controls):
    assert planner.preflight(_request())["available"] is True


def test_refuses_without_credentials(monkeypatch, controls):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    with pytest.raises(HTTPException) as excinfo:
        planner.preflight(_request())
    assert _refusal(excinfo) == "PROVIDER_NOT_CONFIGURED"


def test_refuses_without_operator_approval(controls, monkeypatch):
    monkeypatch.setattr(planner, "_approval", lambda model: None)
    with pytest.raises(HTTPException) as excinfo:
        planner.preflight(_request())
    assert _refusal(excinfo) == "PROVIDER_APPROVAL_MISSING"


def test_refuses_when_budget_is_inactive(controls, monkeypatch):
    monkeypatch.setattr(planner, "_budget_active", lambda approval: False)
    with pytest.raises(HTTPException) as excinfo:
        planner.preflight(_request())
    assert _refusal(excinfo) == "PROVIDER_BUDGET_UNAVAILABLE"


def test_refuses_when_the_ledger_has_no_headroom(controls, monkeypatch):
    monkeypatch.setattr(planner, "_has_headroom", lambda approval: False)
    with pytest.raises(HTTPException) as excinfo:
        planner.plan(_request())
    assert _refusal(excinfo) == "PROVIDER_BUDGET_UNAVAILABLE"


def test_returns_output_and_usage_from_a_mocked_sdk(controls, monkeypatch):
    calls = {}

    class FakeModels:
        def generate_content(self, **kwargs):
            calls.update(kwargs)
            return SimpleNamespace(
                text='{"schemaVersion":"1.0.0"}',
                model_version="mock-v1",
                usage_metadata=SimpleNamespace(
                    total_token_count=150,
                    prompt_token_count=100,
                    candidates_token_count=50,
                ),
                candidates=[SimpleNamespace(finish_reason="STOP")],
            )

    class FakeClient:
        def __init__(self, **kwargs):
            calls["client"] = kwargs
            self.models = FakeModels()

        def close(self):
            pass

    import google.genai as genai

    monkeypatch.setattr(genai, "Client", FakeClient)
    result = planner.plan(_request())
    assert result["refused"] is False
    assert result["output"] == '{"schemaVersion":"1.0.0"}'
    assert result["usage"]["totalTokens"] == 150
    # Cost is never estimated here.
    assert result["usage"]["costUsd"] is None
    # Structured output is requested, and exactly one attempt is allowed.
    assert calls["config"].response_mime_type == "application/json"
    assert calls["config"].response_json_schema == {"type": "object"}
    assert calls["model"] == "gemini-3.6-flash"


def test_empty_output_is_reported_as_empty(controls, monkeypatch):
    class FakeModels:
        def generate_content(self, **kwargs):
            return SimpleNamespace(
                text="   ",
                model_version="mock-v1",
                usage_metadata=SimpleNamespace(total_token_count=5),
                candidates=[SimpleNamespace(finish_reason="STOP")],
            )

    class FakeClient:
        def __init__(self, **kwargs):
            self.models = FakeModels()

        def close(self):
            pass

    import google.genai as genai

    monkeypatch.setattr(genai, "Client", FakeClient)
    result = planner.plan(_request())
    assert result["code"] == "PROVIDER_EMPTY_OUTPUT"
    assert result["usage"]["totalTokens"] == 5


def test_truncated_output_is_reported(controls, monkeypatch):
    class FakeModels:
        def generate_content(self, **kwargs):
            return SimpleNamespace(
                text='{"partial":',
                model_version="mock-v1",
                usage_metadata=SimpleNamespace(total_token_count=2048),
                candidates=[SimpleNamespace(finish_reason="MAX_TOKENS")],
            )

    class FakeClient:
        def __init__(self, **kwargs):
            self.models = FakeModels()

        def close(self):
            pass

    import google.genai as genai

    monkeypatch.setattr(genai, "Client", FakeClient)
    result = planner.plan(_request())
    assert result["truncated"] is True
    assert result["code"] == "PROVIDER_TRUNCATED_OUTPUT"


def test_sdk_failure_is_reported_as_uncertain_not_refused(controls, monkeypatch):
    class FakeClient:
        def __init__(self, **kwargs):
            raise RuntimeError("network died")

        def close(self):
            pass

    import google.genai as genai

    monkeypatch.setattr(genai, "Client", FakeClient)
    with pytest.raises(HTTPException) as excinfo:
        planner.plan(_request())
    detail = excinfo.value.detail
    # Crucially not `refused`: the request may have reached the provider.
    assert detail.get("refused") is False
    assert detail.get("code") == "PROVIDER_TIMEOUT_AFTER_DISPATCH"


def test_python_never_adjusts_the_budget_ledger(monkeypatch):
    """NestJS owns the reservation, so this service must not touch the ledger.

    M4.2 had both services reserve and both reconcile, which charged one logical
    attempt twice. The guard is structural: there is no ledger write here at all.
    """
    writes = []

    class FakeCollection:
        def update_one(self, *args, **kwargs):
            writes.append(args)

        def find_one_and_update(self, *args, **kwargs):
            writes.append(args)

    class FakeDb:
        def get_collection(self, name):
            return FakeCollection()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __getitem__(self, name):
            return FakeDb()

        def close(self):
            pass

    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", "mongodb://budget.test/")
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", "budget")
    import pymongo

    monkeypatch.setattr(pymongo, "MongoClient", FakeClient)

    planner._reconcile(_approval(), None)
    planner._reconcile(_approval(), 150)
    assert writes == [], "the Python boundary must never write the budget ledger"


def test_headroom_check_refuses_when_insufficient(monkeypatch):
    """An independent affordability check still gates dispatch."""
    class FakeCollection:
        def find_one(self, query):
            return {"usedTokens": 990_000, "maxTokens": 1_000_000}

    class FakeDb:
        def get_collection(self, name):
            return FakeCollection()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __getitem__(self, name):
            return FakeDb()

        def close(self):
            pass

    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", "mongodb://budget.test/")
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", "budget")
    import pymongo

    monkeypatch.setattr(pymongo, "MongoClient", FakeClient)

    approval = _approval(maxTokens=1_000_000)
    # 990000 + 32768 > 1000000, so there is no headroom for this attempt.
    assert planner._has_headroom(approval) is False


def test_headroom_check_allows_when_affordable(monkeypatch):
    class FakeCollection:
        def find_one(self, query):
            return {"usedTokens": 0, "maxTokens": 1_000_000}

    class FakeDb:
        def get_collection(self, name):
            return FakeCollection()

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __getitem__(self, name):
            return FakeDb()

        def close(self):
            pass

    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", "mongodb://budget.test/")
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", "budget")
    import pymongo

    monkeypatch.setattr(pymongo, "MongoClient", FakeClient)

    assert planner._has_headroom(_approval(maxTokens=1_000_000)) is True

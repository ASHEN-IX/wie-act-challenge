"""Experience-planner provider dispatch (Batch 4, M4.2).

The Gemini SDK is mocked throughout. What is under test is the boundary's own
behaviour: what it refuses before dispatch, what it reports as usage, and how it
classifies an outcome it cannot prove was free.

No live provider call is made, and none is authorized by this milestone.
"""

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
    monkeypatch.setattr(planner, "_approval", lambda model: _approval())
    monkeypatch.setattr(planner, "_budget_active", lambda approval: True)
    monkeypatch.setattr(planner, "_has_headroom", lambda approval, request_id="": True)
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
    monkeypatch.setattr(planner, "_has_headroom", lambda approval, request_id="": False)
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
    attempt twice. The guard is structural: reconcile makes no call at all.
    """
    from services import api_service

    def forbidden(*args, **kwargs):
        raise AssertionError("the Python boundary must never write the budget ledger")

    for name in ("budget_reserve", "budget_reserve_tokens", "budget_record_usage", "budget_revoke"):
        monkeypatch.setattr(api_service, name, forbidden)
    monkeypatch.setattr(api_service, "_call", forbidden)

    assert planner._reconcile(_approval(), None) is None
    assert planner._reconcile(_approval(), 150) is None


def _ledger(approval, **overrides):
    row = {
        "approvalId": approval["approvalId"],
        "task": planner.PLANNER_TASK,
        "model": approval["model"],
        "limitTokens": approval["maxTokens"],
        "expiresAt": approval["expiresAt"],
        "usedTokens": 0,
        "revoked": False,
    }
    row.update(overrides)
    return row


def _request_row(approval, **overrides):
    row = {
        "approvalId": approval["approvalId"],
        "reservedTokens": planner.RESERVED_TOKENS,
        "state": "dispatched",
    }
    row.update(overrides)
    return row


def _api(monkeypatch, ledger_row, request_row):
    """The two reads the planner makes, answered by the API in place of Mongo."""
    from services import api_service

    monkeypatch.setattr(api_service, "budget_status", lambda approval_id: ledger_row)
    monkeypatch.setattr(api_service, "experience_reservation", lambda request_id: request_row)


def test_exactly_sufficient_budget_permits_dispatch(monkeypatch):
    """The boundary case that the old arithmetic got wrong.

    NestJS reserves first, so a ledger with exactly one attempt's budget left is
    already at its limit when Python looks. Refusing here would deadlock every
    exactly-funded attempt.
    """
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval, usedTokens=1_000_000), _request_row(approval))
    assert planner._has_headroom(approval, "req-1") is True


def test_insufficient_budget_refuses_dispatch(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval, usedTokens=1_100_000), _request_row(approval))
    assert planner._has_headroom(approval, "req-1") is False


def test_dispatch_without_an_owned_reservation_is_refused(monkeypatch):
    """A ledger with room is not enough: this attempt must have funded itself."""
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval), None)
    assert planner._has_headroom(approval, "req-1") is False


def test_reservation_for_another_approval_is_refused(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval), _request_row(approval, approvalId="someone-else"))
    assert planner._has_headroom(approval, "req-1") is False


def test_reservation_with_the_wrong_amount_is_refused(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval), _request_row(approval, reservedTokens=1))
    assert planner._has_headroom(approval, "req-1") is False


def test_reservation_no_longer_in_flight_is_refused(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, _ledger(approval), _request_row(approval, state="failed"))
    assert planner._has_headroom(approval, "req-1") is False


def test_unknown_approval_is_refused(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    _api(monkeypatch, None, _request_row(approval))
    assert planner._has_headroom(approval, "req-1") is False


def test_revoked_or_mismatched_ledger_is_refused(monkeypatch):
    approval = _approval(maxTokens=1_000_000)
    for override in ({"revoked": True}, {"model": "other"}, {"task": "other"}, {"limitTokens": 5}):
        _api(monkeypatch, _ledger(approval, **override), _request_row(approval))
        assert planner._has_headroom(approval, "req-1") is False, override


def test_unreachable_api_is_refused(monkeypatch):
    """With no API configured, nothing can be proven, so nothing is dispatched."""
    approval = _approval(maxTokens=1_000_000)
    monkeypatch.delenv("API_SERVICE_URL", raising=False)
    monkeypatch.delenv("INTERNAL_API_SECRET", raising=False)
    assert planner._has_headroom(approval, "req-1") is False
    assert planner._has_headroom(approval, "") is False

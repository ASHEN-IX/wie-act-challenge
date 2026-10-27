"""Shared approval reservations; no model or provider requests are made."""

import json
import os
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from urllib.parse import urlsplit

import pytest
from pymongo import MongoClient
from utils import llm_client as llm


def test_budget_is_required_and_failure_never_dispatches(monkeypatch):
    monkeypatch.delenv("LLM_BUDGET_MONGODB_URI", raising=False)
    monkeypatch.delenv("LLM_BUDGET_DB_NAME", raising=False)
    approval = {
        "approvalId": "test",
        "task": "coach",
        "model": "fixture",
        "maxRequests": 1,
        "expiresAt": time.time() + 60,
    }
    assert llm._reserve_durable_budget(approval) is False
    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", "mongodb://127.0.0.1:1")
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", "ednova_unreachable_test")
    assert llm._reserve_durable_budget(approval) is False


def test_unavailable_budget_never_calls_provider(monkeypatch):
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("LLM_BUDGET_MONGODB_URI", raising=False)
    monkeypatch.delenv("LLM_BUDGET_DB_NAME", raising=False)
    cfg = llm.agent_config("coach")
    monkeypatch.setenv(
        llm.PROVIDER_KEY_ENV[llm._provider_of(cfg.model)],
        "LocalFixtureCredential123456789",
    )
    monkeypatch.setenv(
        "LLM_APPROVALS_JSON",
        json.dumps(
            {
                "coach": {
                    "approvalId": "fixture",
                    "task": "coach",
                    "model": cfg.model,
                    "maxRequests": 1,
                    "expiresAt": time.time() + 60,
                }
            }
        ),
    )
    monkeypatch.setattr(
        llm, "build_router", lambda: pytest.fail("Provider must not be called")
    )
    with pytest.raises(llm.LLMUnavailableError):
        llm.ask("coach", "system", "question")


@pytest.mark.skipif(
    not os.getenv("P0_BUDGET_TEST_MONGODB_URI"),
    reason="isolated Mongo test URI not supplied",
)
def test_atomic_budget_across_processes_and_restart(monkeypatch):
    uri = os.environ["P0_BUDGET_TEST_MONGODB_URI"]
    assert urlsplit(uri).hostname in {"127.0.0.1", "localhost", "::1"}
    database = "ednova_budget_test_" + uuid.uuid4().hex
    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", uri)
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", database)
    approval = {
        "approvalId": "shared-fixture",
        "task": "coach",
        "model": "fixture-model",
        "maxRequests": 5,
        "expiresAt": time.time() + 120,
    }
    ai_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env = {
        **os.environ,
        "TEST_BUDGET_APPROVAL": json.dumps(approval),
        "PYTHONPATH": ai_root,
    }
    command = [
        sys.executable,
        "-c",
        "import json,os; from utils.llm_client import _reserve_durable_budget; print(int(_reserve_durable_budget(json.loads(os.environ['TEST_BUDGET_APPROVAL']))))",
    ]
    client = MongoClient(uri, serverSelectionTimeoutMS=3000)
    try:

        def run(_):
            result = subprocess.run(
                command, env=env, capture_output=True, text=True, timeout=30, check=True
            )
            return int(result.stdout.strip())

        with ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(run, range(10)))
        assert sum(results) == 5
        assert run(0) == 0  # A new process cannot reset the cap.
        record = client[database].llm_approval_budgets.find_one(
            {"_id": approval["approvalId"]}
        )
        assert record["used"] == 5
        assert not llm._reserve_durable_budget({**approval, "maxRequests": 6})
        assert not llm._reserve_durable_budget({**approval, "model": "foreign"})
        assert not llm._reserve_durable_budget(
            {**approval, "expiresAt": time.time() - 1}
        )
        bound = {**approval, "approvalId": "bound-fixture"}
        assert llm._reserve_durable_budget(bound)
        assert not llm._reserve_durable_budget({**bound, "maxRequests": 6})
        assert not llm._reserve_durable_budget({**bound, "model": "foreign"})
        assert (
            client[database].llm_approval_budgets.find_one(
                {"_id": bound["approvalId"]}
            )["used"]
            == 1
        )
        client[database].llm_approval_budgets.update_one(
            {"_id": bound["approvalId"]}, {"$set": {"revokedAt": time.time()}}
        )
        assert not llm._budget_still_active(bound)
        assert not llm._reserve_durable_budget(bound)
        revoked_env = {**env, "TEST_BUDGET_APPROVAL": json.dumps(bound)}
        revoked = subprocess.run(
            command,
            env=revoked_env,
            capture_output=True,
            text=True,
            timeout=30,
            check=True,
        )
        assert revoked.stdout.strip() == "0"
        cfg = llm.agent_config("coach")
        live = {**approval, "approvalId": "revocation-fixture", "model": cfg.model}
        monkeypatch.delenv("LLM_MOCK", raising=False)
        monkeypatch.setenv("LLM_APPROVALS_JSON", json.dumps({"coach": live}))
        monkeypatch.setenv(
            llm.PROVIDER_KEY_ENV[llm._provider_of(cfg.model)],
            "LocalFixtureCredential123456789",
        )

        def revoke_during_simulated_completion(**_):
            client[database].llm_approval_budgets.update_one(
                {"_id": live["approvalId"]}, {"$set": {"revokedAt": time.time()}}
            )
            return SimpleNamespace(
                model=cfg.model,
                choices=[
                    SimpleNamespace(message=SimpleNamespace(content="private result"))
                ],
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
        crash = {**approval, "approvalId": "crash-fixture", "maxRequests": 1}
        crash_env = {**env, "TEST_BUDGET_APPROVAL": json.dumps(crash)}
        crash_code = (
            "import json,os; from utils.llm_client import _reserve_durable_budget; "
            "ok=_reserve_durable_budget(json.loads(os.environ['TEST_BUDGET_APPROVAL'])); "
            "os._exit(137 if ok else 1)"
        )
        result = subprocess.run(
            [sys.executable, "-c", crash_code], env=crash_env, timeout=30
        )
        assert result.returncode == 137
        assert not llm._reserve_durable_budget(crash)
    finally:
        client.drop_database(database)
        client.close()


@pytest.mark.skipif(
    not os.getenv("P0_BUDGET_TEST_MONGODB_URI"),
    reason="isolated Mongo test URI not supplied",
)
def test_token_and_monetary_budget_accounting(monkeypatch):
    uri = os.environ["P0_BUDGET_TEST_MONGODB_URI"]
    database = "ednova_token_budget_test_" + uuid.uuid4().hex
    monkeypatch.setenv("LLM_BUDGET_MONGODB_URI", uri)
    monkeypatch.setenv("LLM_BUDGET_DB_NAME", database)
    client = MongoClient(uri, serverSelectionTimeoutMS=3000)

    try:
        # 1. Token cap test
        token_approval = {
            "approvalId": "token-cap-fixture",
            "task": "coach",
            "model": "fixture-model",
            "maxRequests": 10,
            "maxTokens": 500,
            "expiresAt": time.time() + 120,
        }
        # First reservation passes (usedTokens=0 < 500)
        assert llm._reserve_durable_budget(token_approval) is True
        status = llm.get_approval_budget_status(token_approval["approvalId"])
        assert status is not None
        assert status["usedRequests"] == 1
        assert status["usedTokens"] == 0

        # Record usage exceeding token cap
        assert llm.record_durable_usage(token_approval["approvalId"], tokens=600) is True
        status = llm.get_approval_budget_status(token_approval["approvalId"])
        assert status["usedTokens"] == 600

        # Next reservation must be rejected because usedTokens >= maxTokens
        assert llm._reserve_durable_budget(token_approval) is False

        # 2. Monetary cost cap test
        cost_approval = {
            "approvalId": "cost-cap-fixture",
            "task": "coach",
            "model": "fixture-model",
            "maxRequests": 10,
            "maxCostUsd": 0.25,
            "expiresAt": time.time() + 120,
        }
        # First reservation passes (usedCostUsd=0 < 0.25)
        assert llm._reserve_durable_budget(cost_approval) is True
        # Record usage exceeding monetary cap
        assert llm.record_durable_usage(cost_approval["approvalId"], cost_usd=0.30) is True
        status = llm.get_approval_budget_status(cost_approval["approvalId"])
        assert status["usedCostUsd"] == 0.30

        # Next reservation must be rejected because usedCostUsd >= maxCostUsd
        assert llm._reserve_durable_budget(cost_approval) is False

        # 3. Explicit operator revocation test
        revokable_approval = {
            "approvalId": "operator-revoke-fixture",
            "task": "coach",
            "model": "fixture-model",
            "maxRequests": 10,
            "expiresAt": time.time() + 120,
        }
        assert llm._reserve_durable_budget(revokable_approval) is True
        assert llm._budget_still_active(revokable_approval) is True

        # Operator triggers emergency revocation
        revoked = llm.revoke_operator_approval(
            revokable_approval["approvalId"], reason="operator_emergency_halt"
        )
        assert revoked is True
        assert llm._budget_still_active(revokable_approval) is False
        assert llm._reserve_durable_budget(revokable_approval) is False

        status = llm.get_approval_budget_status(revokable_approval["approvalId"])
        assert status["revoked"] is True
        assert status["revocationReason"] == "operator_emergency_halt"
    finally:
        client.drop_database(database)
        client.close()

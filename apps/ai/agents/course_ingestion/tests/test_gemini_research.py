import hashlib
import json
import time
from types import SimpleNamespace

import pytest

from agents.course_ingestion.research import gemini_formula as research


def attest(path, key="test-secret"):
    path.write_text(json.dumps({"free_tier": True, "billing_attached": False,
        "source_sha256": research.SOURCE_HASH, "key_sha256": hashlib.sha256(key.encode()).hexdigest(),
        "project_id": "test-project", "verified_by": "test-operator", "checked_at_unix": time.time(),
        "owner_consent": True}))
    path.chmod(0o600)


def test_missing_billing_evidence_blocks_before_approval_or_output(tmp_path, monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    monkeypatch.setattr(research.llm_client, "_approval", lambda _: pytest.fail("approval should not be reached"))
    output = tmp_path / "out.jsonl"
    with pytest.raises(research.ResearchUnavailable):
        research.run(tmp_path / "missing", output)
    assert not output.exists()


def test_evidence_is_private_recent_and_key_bound(tmp_path):
    path = tmp_path / "proof.json"
    attest(path)
    research._check_attestation(path, "test-secret")
    with pytest.raises(research.ResearchUnavailable):
        research._check_attestation(path, "another-key")
    with pytest.raises(research.ResearchUnavailable):
        research._check_attestation(path, "test-secret", now=time.time() + 3700)
    path.chmod(0o644)
    with pytest.raises(research.ResearchUnavailable):
        research._check_attestation(path, "test-secret")


def test_missing_operator_approval_blocks_dispatch(tmp_path, monkeypatch):
    path = tmp_path / "proof.json"
    attest(path)
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    monkeypatch.setattr(research.llm_client, "_approval", lambda _: None)
    with pytest.raises(research.ResearchUnavailable):
        research.run(path, tmp_path / "out")
    assert not (tmp_path / "out").exists()


def test_research_alias_uses_existing_exact_model_approval(monkeypatch):
    from utils import llm_client
    llm_client.reset_router()
    model = llm_client._deployment(research.ALIAS)["model"]
    approval = {"approvalId": "research-test", "task": research.ALIAS, "model": model,
                "maxRequests": 3, "maxTokens": 196608, "expiresAt": time.time() + 300}
    monkeypatch.setenv("LLM_APPROVALS_JSON", json.dumps({research.ALIAS: approval}))
    assert llm_client._approval(research.ALIAS) == approval
    approval["model"] = "gemini/another-model"
    monkeypatch.setenv("LLM_APPROVALS_JSON", json.dumps({research.ALIAS: approval}))
    assert llm_client._approval(research.ALIAS) is None
    assert research.ALIAS not in llm_client.AGENT_GROUPS


def test_reference_crops_match_the_pinned_source():
    cases = research._load_cases()
    assert [case["id"] for case, _ in cases] == list(research.CASE_IDS)
    assert all(image.startswith(b"\x89PNG") for _, image in cases)


def test_approved_research_path_is_bounded_and_keeps_proposals_pending(tmp_path, monkeypatch):
    pytest.importorskip("google.genai")
    import google.genai
    path = tmp_path / "proof.json"
    attest(path)
    monkeypatch.setenv("GEMINI_API_KEY", "test-secret")
    approval = {"approvalId": "test", "model": "gemini/test", "task": research.ALIAS,
                "maxRequests": 3, "maxTokens": 3 * research.RESERVED_TOKENS, "expiresAt": time.time() + 3600}
    monkeypatch.setattr(research.llm_client, "_approval", lambda _: approval)
    monkeypatch.setattr(research.llm_client, "_reserve_approved_call", lambda _: approval)
    monkeypatch.setattr(research.llm_client, "_budget_still_active", lambda _: True)
    monkeypatch.setattr(research, "_reserve_tokens", lambda _: True)
    monkeypatch.setattr(research.llm_client, "_deployment", lambda _: {"model": "gemini/test"})
    calls = []
    class Client:
        def __init__(self, **kwargs):
            self.models = self
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text=json.dumps({"status": "proposed", "representation": "latex",
                "content": "x", "uncertainty": []}), usage_metadata=SimpleNamespace(total_token_count=100),
                model_version="test-v1")
    monkeypatch.setattr(google.genai, "Client", Client)
    output = tmp_path / "out"
    research.run(path, output)
    records = [json.loads(line) for line in output.read_text().splitlines()]
    assert len(calls) == 3 and all(c["config"].max_output_tokens == 512 for c in calls)
    assert [r["case_id"] for r in records[1:-1]] == list(research.CASE_IDS)
    assert all(r["proposal"]["review_disposition"] == "pending" for r in records[1:-1])
    assert all(r["proposal"]["validation"]["mathematical_correctness"] == "not_verified" for r in records[1:-1])

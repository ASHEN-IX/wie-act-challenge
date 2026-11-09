"""Formula-recognition transport.

Real PostgreSQL for the dispatch marker (`ai.formula_dispatches`, the crash-safety
record this service owns); the API's job/consent/eligibility checks and its budget
ledger are an in-memory stand-in; source rendering and the Gemini SDK are mocked.
The ledger's own atomicity is covered by the API's tests.
"""
import hashlib
import json
import time
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from services import api_service, pg
from services.api.routers import formula_recognition as transport

KEY = 'test-only-never-sent'
MODEL = 'gemini/gemini-2.5-flash'


class FakeApi:
    """What the API answers: job controls (state it can change) and the ledger."""

    def __init__(self, approval, job, key):
        self.approval = approval
        self.job = job
        self.key_sha = hashlib.sha256(key.encode()).hexdigest()
        self.job_state = 'running'
        self.eligible = True
        self.consent = True
        self.used = 0
        self.used_tokens = 0
        self.revoked = False

    # -- controls -------------------------------------------------------
    def context(self, payload):
        if self.job_state != 'running':
            return 409, None
        if not (self.eligible and self.consent):
            return 503, None
        return 200, {'job': self.job, 'keySha256': self.key_sha, 'eligibleId': 'e-1', 'consentId': 'c-1'}

    def recheck(self, payload):
        return self.job_state == 'running', self.eligible and self.consent

    # -- ledger ---------------------------------------------------------
    def reserve(self, approval):
        if self.revoked or self.used >= approval['maxRequests']:
            return False
        self.used += 1
        return True

    def reserve_tokens(self, approval, tokens):
        if self.revoked or self.used_tokens + tokens > approval['maxTokens']:
            return False
        self.used_tokens += tokens
        return True

    def active(self, approval):
        return not self.revoked and self.used >= 1


@pytest.fixture
def setup_transport(monkeypatch, ai_db):
    approval = {'approvalId': 'transport-test', 'task': transport.ALIAS, 'model': MODEL,
                'expiresAt': time.time() + 600, 'maxRequests': 3, 'maxTokens': 196608}
    monkeypatch.setenv('GEMINI_API_KEY', KEY)
    monkeypatch.setenv('LLM_APPROVALS_JSON', json.dumps({transport.ALIAS: approval}))
    region = {'documentId': 'doc_' + 'a' * 16, 'documentHash': 'sha256:' + 'b' * 64,
              'regionId': 'region_' + 'c' * 20, 'page': 1, 'bbox': [1., 2., 30., 40.],
              'text': 'x2', 'cropHash': 'sha256:' + 'd' * 64}
    job_id = str(uuid.uuid4())
    job = {'cropHash': region['cropHash'], 'documentHash': region['documentHash'], 'model': MODEL}
    api = FakeApi(approval, job, KEY)
    monkeypatch.setattr(api_service, 'formula_recognition_context', api.context)
    monkeypatch.setattr(api_service, 'formula_recognition_recheck', api.recheck)
    monkeypatch.setattr(api_service, 'budget_reserve', api.reserve)
    monkeypatch.setattr(api_service, 'budget_reserve_tokens', api.reserve_tokens)
    monkeypatch.setattr(api_service, 'budget_active', api.active)
    monkeypatch.setattr(api_service, 'budget_reachable', lambda _: True)
    monkeypatch.setattr(transport, 'region_inspect', lambda _: region)
    monkeypatch.setattr(transport, 'region_crop', lambda _: SimpleNamespace(body=b'\x89PNG\r\n\x1a\nexample'))
    calls = []
    from google import genai
    class SDK:
        def __init__(self, **kwargs): self.models = self
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text=json.dumps({'status': 'proposed', 'representation': 'latex', 'content': 'x^2', 'uncertainty': []}), model_version='mock-v1', usage_metadata=SimpleNamespace(total_token_count=100))
        def close(self): pass
    monkeypatch.setattr(genai, 'Client', SDK)
    req = transport.Recognize(schemaVersion='1.0.0', courseId=str(uuid.uuid4()), revisionId='rev_test', contentHash='sha256:' + 'e' * 64,
        documents=[{'documentId': region['documentId']}], manifestDigest='sha256:' + 'f' * 64,
        documentId=region['documentId'], regionId=region['regionId'], jobId=job_id)
    return api, req, calls


def dispatch_rows():
    with pg.connection() as conn:
        return conn.execute('SELECT * FROM ai.formula_dispatches').fetchall()


def test_transport_reserves_durably_and_never_repeats_dispatch(setup_transport):
    api, req, calls = setup_transport
    result = transport.recognize(req)
    assert result['proposal']['review_disposition'] == 'pending'
    assert result['usage']['totalTokens'] == 100
    assert api.used == 1 and api.used_tokens == 65536
    (row,) = dispatch_rows()
    assert row['job_id'] == req.jobId and row['approval_id'] == 'transport-test'
    assert row['tokens'] == 100 and row['finished_at'] is not None
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 409
    assert len(calls) == 1


def test_dispatch_marker_survives_a_restart(setup_transport):
    _, req, calls = setup_transport
    transport.recognize(req)
    pg.reset_for_tests()  # a new process: the pool is gone, the row is not
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 409
    assert len(calls) == 1


def test_transport_blocks_missing_approval_without_request(setup_transport, monkeypatch):
    _, req, calls = setup_transport
    monkeypatch.setenv('LLM_APPROVALS_JSON', '{}')
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls


def test_transport_blocks_without_the_dispatch_store(setup_transport, monkeypatch):
    _, req, calls = setup_transport
    monkeypatch.delenv('AI_DATABASE_URL')
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 503
    assert not calls


def test_transport_blocks_exhausted_token_budget(setup_transport):
    api, req, calls = setup_transport
    api.used_tokens = api.approval['maxTokens']
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls


def test_transport_blocks_when_the_ledger_is_unreachable(setup_transport, monkeypatch):
    _, req, calls = setup_transport
    monkeypatch.setattr(api_service, 'budget_reachable', lambda _: False)
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 503
    assert not calls
    assert dispatch_rows() == []


@pytest.mark.parametrize('failure', ['timeout', 'quota429', 'malformed', 'missing_usage'])
def test_provider_failures_keep_reservation_and_never_redispatch(setup_transport, monkeypatch, failure):
    api, req, calls = setup_transport
    from google import genai
    class SDK:
        def __init__(self, **kwargs): self.models = self
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            if failure in ('timeout', 'quota429'):
                raise TimeoutError() if failure == 'timeout' else RuntimeError('429 simulated quota exhaustion')
            return SimpleNamespace(text='not JSON' if failure == 'malformed' else '{}', model_version='mock-v1', usage_metadata=SimpleNamespace(total_token_count=None if failure == 'missing_usage' else 100))
        def close(self): pass
    monkeypatch.setattr(genai, 'Client', SDK)
    with pytest.raises(HTTPException) as err:
        transport.recognize(req)
    assert err.value.status_code == 503
    assert api.used == 1
    assert len(dispatch_rows()) == 1
    with pytest.raises(HTTPException): transport.recognize(req)
    assert len(calls) == 1


@pytest.mark.parametrize('control', ['consent_revoked', 'eligibility_revoked', 'cancelled'])
def test_revoked_controls_block_provider_before_dispatch(setup_transport, control):
    api, req, calls = setup_transport
    if control == 'consent_revoked': api.consent = False
    elif control == 'eligibility_revoked': api.eligible = False
    else: api.job_state = 'cancelled'
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls
    assert dispatch_rows() == []


def test_consent_revoked_during_crop_blocks_external_processing(setup_transport, monkeypatch):
    api, req, calls = setup_transport
    def crop(_):
        api.consent = False
        return SimpleNamespace(body=b'\x89PNG\r\n\x1a\nexample')
    monkeypatch.setattr(transport, 'region_crop', crop)
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls
    # Conservative reservation remains durable; no automatic replay after partial work.
    assert api.used == 1


def test_job_cancelled_during_crop_blocks_dispatch(setup_transport, monkeypatch):
    api, req, calls = setup_transport
    def crop(_):
        api.job_state = 'cancelled'
        return SimpleNamespace(body=b'\x89PNG\r\n\x1a\nexample')
    monkeypatch.setattr(transport, 'region_crop', crop)
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 409
    assert not calls

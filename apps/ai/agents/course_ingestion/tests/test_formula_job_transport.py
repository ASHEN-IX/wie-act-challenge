"""Real MongoDB reservations; only source rendering and Gemini transport are mocked."""
import hashlib
import json
import time
import uuid
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace

import pytest
from bson import ObjectId
from fastapi import HTTPException
from pymongo import MongoClient
from services.api.routers import formula_recognition as transport

@pytest.fixture
def setup_transport(monkeypatch):
    name = 'test_formula_transport_' + uuid.uuid4().hex
    uri = 'mongodb://127.0.0.1:27017/' + name
    client = MongoClient(uri, serverSelectionTimeoutMS=2000)
    client.admin.command('ping')
    db = client[name]
    key = 'test-only-never-sent'
    model = 'gemini/gemini-2.5-flash'
    approval = {'approvalId': 'transport-test', 'task': transport.ALIAS, 'model': model,
                'expiresAt': time.time() + 600, 'maxRequests': 3, 'maxTokens': 196608}
    for k, v in {'MONGODB_URI': uri, 'GEMINI_API_KEY': key, 'LLM_BUDGET_MONGODB_URI': uri,
                 'LLM_BUDGET_DB_NAME': name, 'LLM_APPROVALS_JSON': json.dumps({transport.ALIAS: approval})}.items():
        monkeypatch.setenv(k, v)
    region = {'documentId': 'doc_' + 'a' * 16, 'documentHash': 'sha256:' + 'b' * 64,
              'regionId': 'region_' + 'c' * 20, 'page': 1, 'bbox': [1., 2., 30., 40.],
              'text': 'x2', 'cropHash': 'sha256:' + 'd' * 64}
    job_id = ObjectId()
    db.formularecognitionjobs.insert_one({'_id': job_id, 'state': 'running', 'courseId': 'a' * 24,
        'revisionTag': 'rev_test', 'documentId': region['documentId'], 'documentHash': region['documentHash'],
        'regionId': region['regionId'], 'cropHash': region['cropHash'], 'model': model})
    db.formula_provider_eligibility.insert_one({'provider': 'gemini', 'model': model, 'freeTier': True,
        'billingAttached': False, 'expiresAt': datetime.now(timezone.utc) + timedelta(minutes=10),
        'keySha256': hashlib.sha256(key.encode()).hexdigest()})
    db.formula_source_consents.insert_one({'courseId': 'a' * 24, 'documentHash': region['documentHash'], 'provider': 'gemini', 'revoked': False})
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
    req = transport.Recognize(schemaVersion='1.0.0', courseId='a' * 24, revisionId='rev_test', contentHash='sha256:' + 'e' * 64,
        documents=[{'documentId': region['documentId']}], manifestDigest='sha256:' + 'f' * 64,
        documentId=region['documentId'], regionId=region['regionId'], jobId=str(job_id))
    yield db, req, calls
    client.drop_database(name)
    client.close()


def test_transport_reserves_durably_and_never_repeats_dispatch(setup_transport):
    db, req, calls = setup_transport
    result = transport.recognize(req)
    assert result['proposal']['review_disposition'] == 'pending'
    assert result['usage']['totalTokens'] == 100
    budget = db.llm_approval_budgets.find_one({'_id': 'transport-test'})
    assert budget['used'] == 1 and budget['usedTokens'] == 65536
    with pytest.raises(HTTPException) as err: transport.recognize(req)
    assert err.value.status_code == 409
    assert len(calls) == 1


def test_transport_blocks_missing_approval_without_request(setup_transport, monkeypatch):
    _, req, calls = setup_transport
    monkeypatch.setenv('LLM_APPROVALS_JSON', '{}')
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls


def test_transport_blocks_exhausted_token_budget(setup_transport):
    db, req, calls = setup_transport
    approval = transport.llm_client._approval(transport.ALIAS)
    assert transport.llm_client._reserve_durable_budget(approval)
    db.llm_approval_budgets.update_one({'_id': approval['approvalId']}, {'$set': {'usedTokens': approval['maxTokens']}})
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls


@pytest.mark.parametrize('failure', ['timeout', 'quota429', 'malformed', 'missing_usage'])
def test_provider_failures_keep_reservation_and_never_redispatch(setup_transport, monkeypatch, failure):
    db, req, calls = setup_transport
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
    assert db.llm_approval_budgets.find_one({'_id':'transport-test'})['used'] == 1
    assert db.formula_dispatches.count_documents({}) == 1
    with pytest.raises(HTTPException): transport.recognize(req)
    assert len(calls) == 1


@pytest.mark.parametrize('control', ['consent_revoked', 'eligibility_revoked', 'cancelled'])
def test_revoked_controls_block_provider_before_dispatch(setup_transport, control):
    db, req, calls = setup_transport
    if control == 'consent_revoked': db.formula_source_consents.update_many({}, {'$set': {'revoked': True}})
    elif control == 'eligibility_revoked': db.formula_provider_eligibility.update_many({}, {'$set': {'revoked': True}})
    else: db.formularecognitionjobs.update_many({}, {'$set': {'state':'cancelled'}})
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls
    assert db.formula_dispatches.count_documents({}) == 0


def test_consent_revoked_during_crop_blocks_external_processing(setup_transport, monkeypatch):
    db, req, calls = setup_transport
    def crop(_):
        db.formula_source_consents.update_many({}, {'$set':{'revoked':True}})
        return SimpleNamespace(body=b'\x89PNG\r\n\x1a\nexample')
    monkeypatch.setattr(transport, 'region_crop', crop)
    with pytest.raises(HTTPException): transport.recognize(req)
    assert not calls
    # Conservative reservation remains durable; no automatic replay after partial work.
    assert db.llm_approval_budgets.find_one({'_id':'transport-test'})['used'] == 1

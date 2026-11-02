"""Internal Gemini recognition transport. Never authorizes itself by a local file."""
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pymongo import MongoClient
from utils import llm_client
from agents.course_ingestion.research.gemini_formula import ALIAS, PROMPT, RESERVED_TOKENS, _reserve_tokens
from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, ModelResponse, create_proposal
from agents.course_ingestion.enrichment.recognition_provider import RecognitionRequest, RecognitionResult, project_proposal
from services.api.routers.sources import RegionCropRequest, region_inspect, region_crop

router = APIRouter(prefix='/api/ai/sources', tags=['sources'])

class Preflight(BaseModel):
    model_config = ConfigDict(extra='forbid')
    model: str
    keySha256: str


def check(req):
    key = os.getenv('GEMINI_API_KEY', '')
    approval = llm_client._approval(ALIAS)
    if (not key or hashlib.sha256(key.encode()).hexdigest() != req.keySha256 or not approval
        or approval['model'] != req.model or not os.getenv('LLM_BUDGET_MONGODB_URI')
        or not os.getenv('LLM_BUDGET_DB_NAME') or not approval.get('maxTokens')):
        raise HTTPException(503, 'Recognition approval unavailable')
    budget_client = None
    try:
        budget_client = MongoClient(os.environ['LLM_BUDGET_MONGODB_URI'], serverSelectionTimeoutMS=2000, connectTimeoutMS=2000, socketTimeoutMS=3000)
        budget_client.admin.command('ping')
    except Exception:
        raise HTTPException(503, 'Durable budget unavailable') from None
    finally:
        if budget_client is not None:
            budget_client.close()
    return key, approval

@router.post('/recognition-preflight')
def preflight(req: Preflight):
    check(req)
    return {'available': True}

class Recognize(RegionCropRequest):
    jobId: str = Field(pattern=r'^[a-f0-9]{24}$')

@router.post('/recognize-formula')
def recognize(req: Recognize):
    from bson import ObjectId
    from google import genai
    from google.genai import types
    uri = os.getenv('MONGODB_URI')
    if not uri:
        raise HTTPException(503, 'Recognition controls unavailable')
    client = MongoClient(uri, serverSelectionTimeoutMS=2000, connectTimeoutMS=2000, socketTimeoutMS=3000)
    sdk = None
    try:
        db = client.get_default_database()
        job = db.formularecognitionjobs.find_one({'_id': ObjectId(req.jobId), 'state': 'running'})
        if not job or job['courseId'] != req.courseId or job['revisionTag'] != req.revisionId or job['documentId'] != req.documentId or job['regionId'] != req.regionId:
            raise HTTPException(409, 'Recognition job unavailable')
        eligible = db.formula_provider_eligibility.find_one({'provider': 'gemini', 'model': job['model'], 'freeTier': True,
            'billingAttached': False, 'expiresAt': {'$gt': datetime.now(timezone.utc)}, 'revoked': {'$ne': True}})
        consent = db.formula_source_consents.find_one({'courseId': req.courseId, 'documentHash': job['documentHash'], 'provider': 'gemini', 'revoked': False})
        if not eligible or not consent:
            raise HTTPException(503, 'Recognition controls unavailable')
        key, approval = check(Preflight(model=job['model'], keySha256=eligible['keySha256']))
        crop_req = RegionCropRequest.model_validate(req.model_dump(exclude={'jobId'}))
        region = region_inspect(crop_req)
        if region['cropHash'] != job['cropHash'] or region['documentHash'] != job['documentHash']:
            raise HTTPException(409, 'Source changed')
        # Unique per-job dispatch marker. A crash is uncertain; never redispatch automatically.
        marker = db.formula_dispatches.update_one({'_id': req.jobId}, {'$setOnInsert': {'at': datetime.now(timezone.utc)}}, upsert=True)
        if not marker.upserted_id:
            raise HTTPException(409, 'Dispatch already attempted')
        reserved = llm_client._reserve_approved_call(ALIAS)
        if reserved != approval or not _reserve_tokens(approval) or not llm_client._budget_still_active(approval):
            raise HTTPException(503, 'Budget unavailable')
        db.formula_dispatches.update_one({'_id': req.jobId}, {'$set': {'approvalId': approval['approvalId'], 'reservedTokens': RESERVED_TOKENS, 'reservedRequests': 1}})
        image = region_crop(crop_req).body
        if len(image) > 1_000_000:
            raise HTTPException(422, 'Crop too large')
        if not db.formularecognitionjobs.find_one({'_id': ObjectId(req.jobId), 'state': 'running'}):
            raise HTTPException(409, 'Job cancelled')
        # Crop rendering may take time; a revocation during that work must block dispatch.
        if (not db.formula_source_consents.find_one({'_id': consent['_id'], 'revoked': False})
            or not db.formula_provider_eligibility.find_one({'_id': eligible['_id'], 'provider': 'gemini',
                'model': job['model'], 'keySha256': eligible['keySha256'], 'freeTier': True, 'billingAttached': False,
                'expiresAt': {'$gt': datetime.now(timezone.utc)}, 'revoked': {'$ne': True}})):
            raise HTTPException(503, 'Recognition controls changed')
        if llm_client._approval(ALIAS) != approval:
            raise HTTPException(503, 'Approval changed')
        sdk = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=30000, retry_options=types.HttpRetryOptions(attempts=1)))
        response = sdk.models.generate_content(model=job['model'].split('/', 1)[1], contents=[PROMPT, types.Part.from_bytes(data=image, mime_type='image/png')],
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=512, response_mime_type='application/json', response_json_schema=ModelResponse.model_json_schema()))
        tokens = getattr(response.usage_metadata, 'total_token_count', None)
        # Record usage even if response validation subsequently fails.
        db.formula_dispatches.update_one({'_id': req.jobId}, {'$set': {'tokens': tokens, 'modelVersion': response.model_version, 'finishedAt': datetime.now(timezone.utc)}})
        if type(tokens) is not int or not 0 <= tokens <= RESERVED_TOKENS:
            raise HTTPException(503, 'Usage unavailable')
        if not llm_client._budget_still_active(approval) or llm_client._approval(ALIAS) != approval:
            raise HTTPException(503, 'Approval changed')
        source = SourceReference(document_id=req.documentId, revision_id=req.revisionId, source_sha256=region['documentHash'], region_id=req.regionId,
            page=region['page'], bbox=tuple(float(v) for v in region['bbox']))
        proposal = project_proposal(RecognitionRequest(source=source, course_id=req.courseId, image_png=image, extraction_text=region['text']),
            RecognitionResult(raw_json=response.text or '', provider='gemini', model=job['model'], model_version=response.model_version))
        return {'proposal': proposal, 'modelVersion': response.model_version, 'usage': {'totalTokens': tokens, 'reservedTokens': RESERVED_TOKENS, 'costUsd': None}}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, 'Recognition unavailable') from None
    finally:
        if sdk is not None:
            sdk.close()
        client.close()

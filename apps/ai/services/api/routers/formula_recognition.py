"""Internal Gemini recognition transport. Never authorizes itself by a local file."""
import hashlib
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from services import api_service, formula_dispatch, pg
from utils import llm_client
from agents.course_ingestion.research.gemini_formula import ALIAS, PROMPT, RESERVED_TOKENS, _reserve_tokens
from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, ModelResponse
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
        or approval['model'] != req.model or not approval.get('maxTokens')):
        raise HTTPException(503, 'Recognition approval unavailable')
    if not api_service.budget_reachable(approval['approvalId']):
        raise HTTPException(503, 'Durable budget unavailable')
    return key, approval

@router.post('/recognition-preflight')
def preflight(req: Preflight):
    check(req)
    return {'available': True}

class Recognize(RegionCropRequest):
    jobId: str = Field(pattern=r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')

@router.post('/recognize-formula')
def recognize(req: Recognize):
    from google import genai
    from google.genai import types
    # The dispatch marker is the crash-safety record; without it nothing is sent.
    if not pg.configured():
        raise HTTPException(503, 'Recognition controls unavailable')
    sdk = None
    try:
        # Job, provider eligibility and owner consent are API-owned.
        status, controls = api_service.formula_recognition_context({
            'jobId': req.jobId, 'courseId': req.courseId, 'revisionId': req.revisionId,
            'documentId': req.documentId, 'regionId': req.regionId})
        if status == 409:
            raise HTTPException(409, 'Recognition job unavailable')
        if status != 200 or not controls:
            raise HTTPException(503, 'Recognition controls unavailable')
        job = controls['job']
        key, approval = check(Preflight(model=job['model'], keySha256=controls['keySha256']))
        crop_req = RegionCropRequest.model_validate(req.model_dump(exclude={'jobId'}))
        region = region_inspect(crop_req)
        if region['cropHash'] != job['cropHash'] or region['documentHash'] != job['documentHash']:
            raise HTTPException(409, 'Source changed')
        # Unique per-job dispatch marker. A crash is uncertain; never redispatch automatically.
        if not formula_dispatch.claim(req.jobId):
            raise HTTPException(409, 'Dispatch already attempted')
        reserved = llm_client._reserve_approved_call(ALIAS)
        if reserved != approval or not _reserve_tokens(approval) or not llm_client._budget_still_active(approval):
            raise HTTPException(503, 'Budget unavailable')
        formula_dispatch.record_reservation(req.jobId, approval['approvalId'], RESERVED_TOKENS, 1)
        image = region_crop(crop_req).body
        if len(image) > 1_000_000:
            raise HTTPException(422, 'Crop too large')
        job_running, controls_hold = api_service.formula_recognition_recheck({
            'jobId': req.jobId, 'model': job['model'], 'keySha256': controls['keySha256'],
            'eligibleId': controls['eligibleId'], 'consentId': controls['consentId']})
        if not job_running:
            raise HTTPException(409, 'Job cancelled')
        # Crop rendering may take time; a revocation during that work must block dispatch.
        if not controls_hold:
            raise HTTPException(503, 'Recognition controls changed')
        if llm_client._approval(ALIAS) != approval:
            raise HTTPException(503, 'Approval changed')
        sdk = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=30000, retry_options=types.HttpRetryOptions(attempts=1)))
        response = sdk.models.generate_content(model=job['model'].split('/', 1)[1], contents=[PROMPT, types.Part.from_bytes(data=image, mime_type='image/png')],
            config=types.GenerateContentConfig(temperature=0, max_output_tokens=512, response_mime_type='application/json', response_json_schema=ModelResponse.model_json_schema()))
        tokens = getattr(response.usage_metadata, 'total_token_count', None)
        # Record usage even if response validation subsequently fails.
        formula_dispatch.record_finish(req.jobId, tokens if type(tokens) is int else None, response.model_version)
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

"""Experience-planner provider dispatch (Batch 4, Milestone 4.2).

The one place a real model is called for lesson planning. It sits inside the
existing Python AI boundary because that boundary already owns the Gemini SDK,
the operator-approval machinery and the durable budget ledger; putting a second
copy in Node would be a second implementation of a security control.

Division of responsibility:

  Node (NestJS)   authorization, owner consent, eligibility, revision pinning,
                  idempotency, the M4.1 validator, and everything the learner sees
  Python (here)   credential binding, budget reservation, the SDK call, usage
                  reporting, and a typed refusal for anything it can prove did
                  not dispatch

Nothing here validates a plan. The output is untrusted JSON by contract; the
caller must run the M4.1 validator before anything reaches a reader.
"""

import hashlib
import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/api/ai/experience", tags=["experience"])

# Planning is a distinct purpose from formula recognition: it has its own
# approval alias, its own budget task and its own eligibility row.
PLANNER_TASK = "experience_planning"
PLANNER_AGENT = "experience_planner"
# Conservative reservation covering a bounded lesson context plus the proposal.
RESERVED_TOKENS = 32768


class PlanLimits(BaseModel):
    model_config = ConfigDict(extra="forbid")
    maxInputCharacters: int = Field(ge=1, le=200_000)
    maxOutputTokens: int = Field(ge=1, le=8192)
    timeoutMs: int = Field(ge=1000, le=60_000)


class PlanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: str = Field(min_length=1, max_length=128)
    contextFingerprint: str = Field(min_length=1, max_length=71)
    model: str = Field(min_length=1, max_length=96)
    systemPolicy: str = Field(min_length=1, max_length=8000)
    task: str = Field(min_length=1, max_length=64_000)
    outputSchema: dict
    limits: PlanLimits


def _refuse(code: str, status: int = 503):
    """A refusal this service can prove happened before dispatch. Node treats it
    as 'known': no usage occurred and a retry is safe."""
    raise HTTPException(status, {"refused": True, "code": code})


def _approval(model: str):
    """Resolve the operator approval for this exact task and model."""
    from utils import llm_client

    approval = llm_client._approval(PLANNER_AGENT)
    if not approval or approval.get("model") != model:
        return None
    return approval


def _budget_active(approval: dict) -> bool:
    from utils import llm_client

    return bool(llm_client._budget_still_active(approval))


def _has_headroom(approval: dict) -> bool:
    """Verify the ledger can fund this attempt, without debiting it.

    M4.2 had both this service and NestJS increment `usedTokens` for the same
    logical attempt, so one request was charged twice. NestJS owns the
    reservation because it owns the request identity and lifecycle; this service
    keeps an *independent* check that dispatch is affordable, which is the part
    that matters for security, and stops charging for it.

    The read is deliberately strict: a ledger that cannot be read, an approval
    that does not match, or insufficient headroom all refuse dispatch.
    """
    if type(approval.get("maxTokens")) is not int or approval["maxTokens"] < RESERVED_TOKENS:
        return False
    from pymongo import MongoClient

    client = None
    try:
        client = MongoClient(
            os.environ["LLM_BUDGET_MONGODB_URI"],
            serverSelectionTimeoutMS=2000,
            connectTimeoutMS=2000,
            socketTimeoutMS=3000,
            retryWrites=False,
        )
        records = client[os.environ["LLM_BUDGET_DB_NAME"]].get_collection("llm_approval_budgets")
        row = records.find_one(
            {
                "_id": approval["approvalId"],
                "task": PLANNER_TASK,
                "model": approval["model"],
                "maxTokens": approval["maxTokens"],
                "expiresAt": {"$eq": float(approval["expiresAt"]), "$gt": time.time()},
                "revokedAt": {"$exists": False},
            }
        )
        if not row:
            return False
        # Headroom must cover a full reservation, including the one NestJS has
        # already taken for this attempt.
        return int(row.get("usedTokens", 0)) + RESERVED_TOKENS <= approval["maxTokens"]
    except Exception:
        return False
    finally:
        if client is not None:
            client.close()


def _reconcile(approval: dict, tokens) -> None:
    """Report usage to the caller; do not adjust the ledger.

    NestJS made the reservation and is the only place that reconciles it. A
    second reconcile here would refund against a reservation this service never
    made, which is how the double-debit surfaced in the first place.

    The observed token count is returned to the caller in the response and
    recorded there; this function exists to keep that contract explicit.
    """
    return None


@router.post("/preflight")
def preflight(req: PlanRequest):
    """Prove the controls are present without calling a model."""
    key = os.getenv("GEMINI_API_KEY", "")
    approval = _approval(req.model)
    if not key:
        _refuse("PROVIDER_NOT_CONFIGURED")
    if not approval:
        _refuse("PROVIDER_APPROVAL_MISSING")
    if not _budget_active(approval):
        _refuse("PROVIDER_BUDGET_UNAVAILABLE")
    return {"available": True, "model": req.model}


@router.post("/plan")
def plan(req: PlanRequest):
    from google import genai
    from google.genai import types

    key = os.getenv("GEMINI_API_KEY", "")
    if not key:
        _refuse("PROVIDER_NOT_CONFIGURED")

    approval = _approval(req.model)
    if not approval:
        _refuse("PROVIDER_APPROVAL_MISSING")
    if not _budget_active(approval):
        _refuse("PROVIDER_BUDGET_UNAVAILABLE")

    # Everything above is pre-dispatch and provable. From here on a failure is
    # uncertain: the request may have reached the model.
    if not _has_headroom(approval):
        _refuse("PROVIDER_BUDGET_UNAVAILABLE")

    sdk = None
    tokens = None
    model_version = None
    try:
        sdk = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(
                timeout=req.limits.timeoutMs,
                # Exactly one attempt: a retry here would silently double-charge.
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
        response = sdk.models.generate_content(
            model=req.model.split("/", 1)[1],
            contents=[req.systemPolicy, req.task],
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=req.limits.maxOutputTokens,
                response_mime_type="application/json",
                response_json_schema=req.outputSchema,
            ),
        )
        usage = getattr(response, "usage_metadata", None)
        tokens = getattr(usage, "total_token_count", None)
        model_version = getattr(response, "model_version", None)
        text = getattr(response, "text", None) or ""
        finish = getattr(getattr(response, "candidates", None) and response.candidates[0], "finish_reason", None)
        _reconcile(approval, tokens)
        if not _budget_active(approval) or _approval(req.model) != approval:
            _refuse("PROVIDER_BUDGET_UNAVAILABLE")
        if finish is not None and str(finish).endswith("MAX_TOKENS"):
            return {
                "refused": False,
                "truncated": True,
                "code": "PROVIDER_TRUNCATED_OUTPUT",
                "usage": {"totalTokens": tokens, "modelVersion": model_version},
            }
        if not text.strip():
            return {
                "refused": False,
                "truncated": False,
                "code": "PROVIDER_EMPTY_OUTPUT",
                "usage": {"totalTokens": tokens, "modelVersion": model_version},
            }
        return {
            "refused": False,
            "output": text,
            "usage": {
                "totalTokens": tokens if type(tokens) is int else None,
                "inputTokens": getattr(usage, "prompt_token_count", None),
                "outputTokens": getattr(usage, "candidates_token_count", None),
                "modelVersion": model_version,
                # Never estimated here. Null means "not measured".
                "costUsd": None,
            },
        }
    except HTTPException:
        raise
    except Exception:
        # Uncertain: the SDK may have reached the provider before failing.
        raise HTTPException(503, {"refused": False, "code": "PROVIDER_TIMEOUT_AFTER_DISPATCH"}) from None
    finally:
        if sdk is not None:
            sdk.close()

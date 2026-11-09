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

import os
import time

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


def _propagated_reservation(approval: dict, request_id: str) -> bool:
    """Verify this exact attempt already holds a valid reservation.

    M4.3 originally checked `usedTokens + RESERVED <= limit`, which is wrong for
    the boundary case: NestJS reserves *first*, so a ledger with exactly enough
    budget left for one attempt is already at its limit when Python looks. The
    check then refused an attempt that had legitimately funded itself.

    The correction is attempt-aware rather than arithmetic. NestJS owns the
    reservation and records it on the request row it already maintains:
    `approvalId`, `reservedTokens`, and a `dispatched` state. Python reads that
    row from the trusted application database — never from the caller — and
    confirms the reservation exists, belongs to this request and approval, is
    for the expected amount, and is still in flight.

    This is a read-only verification of a reservation somebody else owns. It
    creates no second reservation and adds no third accounting implementation.
    """
    if not request_id:
        return False
    from services import api_service

    row = api_service.experience_reservation(request_id)
    if not row:
        return False
    return (
        row.get("approvalId") == approval["approvalId"]
        and int(row.get("reservedTokens") or 0) == RESERVED_TOKENS
        and row.get("state") in ("dispatched", "validating")
    )


def _ledger_permits_dispatch(approval: dict) -> bool:
    """Independent affordability check over the shared budget ledger.

    Separate from the attempt check on purpose: this proves the approval is live
    and the ledger is reachable, so a service restart or a missing request row
    cannot turn into permission. It reads, and never writes.
    """
    if type(approval.get("maxTokens")) is not int or approval["maxTokens"] < RESERVED_TOKENS:
        return False
    from services import api_service

    row = api_service.budget_status(approval["approvalId"])
    if not row:
        return False
    if (
        row.get("task") != PLANNER_TASK
        or row.get("model") != approval["model"]
        or row.get("limitTokens") != approval["maxTokens"]
        or float(row.get("expiresAt", 0)) != float(approval["expiresAt"])
        or float(approval["expiresAt"]) <= time.time()
        or row.get("revoked")
    ):
        return False
    used = int(row.get("usedTokens", 0))
    # The attempt's own reservation is already counted in `used`, so the
    # ledger is merely required to be within its limit.
    return used <= approval["maxTokens"]


def _has_headroom(approval: dict, request_id: str = "") -> bool:
    """Both independent gates, in the order that cannot be gamed.

    The ledger check proves the approval and budget are live; the attempt check
    proves *this* request funded its own dispatch.
    """
    return _ledger_permits_dispatch(approval) and _propagated_reservation(approval, request_id)


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
    if not _has_headroom(approval, req.requestId):
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

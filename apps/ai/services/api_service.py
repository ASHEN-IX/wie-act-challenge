"""
Client for the Node API's internal endpoints.

The AI service owns its own data (coach history, pacing, schedules, embeddings,
signals) and keeps that in PostgreSQL through its own repositories. It does not
own the application's schema: courses, revisions, sessions, ingestion operations
and planning reservations belong to the Node API, which is the single writer.

Every function here is one bounded call to an `/api/v1/.../internal/...` route
guarded by `x-internal-secret` (reads, plus the ledger's reserve/usage/revoke). Callers treat a failure as "no context" —
the coach degrades to task-title-only and the ingestion worker refuses to
proceed — so this module never raises on an outage. It returns `None` instead,
which keeps the existing degradation paths working unchanged.

Environment
-----------
API_SERVICE_URL    Base URL of the Node API (default: http://localhost:3001)
INTERNAL_API_SECRET  Shared service credential; without it every call is refused
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Tuple

import httpx

from utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_TIMEOUT_SECONDS = 5.0


def _base_url() -> Optional[str]:
    url = (os.getenv("API_SERVICE_URL") or "").strip().rstrip("/")
    return url or None


def _headers() -> Optional[Dict[str, str]]:
    secret = os.getenv("INTERNAL_API_SECRET") or ""
    if not secret:
        return None
    return {"x-internal-secret": secret}


def _call(
    method: str,
    path: str,
    *,
    params: Optional[Dict[str, str]] = None,
    json: Optional[Dict[str, Any]] = None,
) -> Optional[Tuple[int, Any]]:
    """`(status, body)` for any answer the API gives, or None when it is unreachable.

    4xx answers are returned, not raised: callers branch on 404/409/503 because
    they mean different things ("no such row", "not current", "unavailable").
    """
    base = _base_url()
    headers = _headers()
    if not base or not headers:
        logger.warning(
            "api_service_not_configured",
            extra={"has_url": bool(base), "has_secret": bool(headers)},
        )
        return None
    try:
        response = httpx.request(
            method,
            f"{base}{path}",
            params=params,
            json=json,
            headers=headers,
            timeout=DEFAULT_TIMEOUT_SECONDS,
        )
        try:
            body = response.json()
        except ValueError:
            body = None
        return response.status_code, body
    except Exception as exc:
        logger.warning(
            "api_service_call_failed",
            extra={"path": path, "error_type": type(exc).__name__},
        )
        return None


def _get(path: str, params: Optional[Dict[str, str]] = None) -> Optional[Any]:
    """A JSON GET, or None when the API is unreachable or refuses the call."""
    result = _call("GET", path, params=params)
    if result is None:
        return None
    status, body = result
    if status in (404, 409):
        # A definitive "no such row" / "not current" answer, not an outage.
        return {"_status": status}
    return body if 200 <= status < 300 else None


def coach_catalog(user_id: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
    """The learner's newest courses as `{subject, title, keyConcepts}`.

    None on an outage, so the coach falls back to task-title-only context.
    """
    payload = _get("/api/v1/study/internal/coach/catalog", {"userId": user_id})
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    courses = payload.get("courses")
    if not isinstance(courses, list):
        return None
    return courses[:limit]


def coach_current_task(session_id: str) -> Optional[Dict[str, Any]]:
    """`{task_id, title, course_id, subject}` for a study session, or None."""
    payload = _get(f"/api/v1/study/internal/coach/sessions/{session_id}/current-task")
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    return payload


def planner_plans(user_id: str, limit: int = 10) -> Optional[List[Dict[str, Any]]]:
    """The learner's study plans, newest first, or None when the API is unreachable."""
    payload = _get(
        "/api/v1/study/internal/planner/plans",
        {"userId": user_id, "limit": str(limit)},
    )
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    plans = payload.get("plans")
    return plans if isinstance(plans, list) else None


def ingestion_revision(course_id: str, revision_tag: str) -> Optional[Dict[str, Any]]:
    """The draft revision's content hash and verified source manifest."""
    payload = _get(f"/api/v1/study/internal/ingestion/revisions/{course_id}/{revision_tag}")
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    return payload


def ingestion_operation_is_current(
    message_id: str,
    *,
    course_id: str,
    revision_id: str,
    user_id: str,
    job_id: str,
    correlation_id: str,
) -> bool:
    """Whether a dispatch is still current.

    Fails **closed**: if the API cannot answer, the worker must not ingest on a
    possibly-cancelled dispatch. A 404 means no operation record exists for the
    message — a legacy envelope — which keeps its prior behaviour (allowed).
    """
    payload = _get(
        f"/api/v1/study/internal/ingestion/operations/{message_id}",
        {
            "courseId": course_id,
            "revisionId": revision_id,
            "userId": user_id,
            "jobId": job_id,
            "correlationId": correlation_id,
        },
    )
    if not isinstance(payload, dict):
        return False
    status = payload.get("_status")
    if status == 404:
        return True
    if status == 409:
        return False
    return payload.get("current") is True


def experience_reservation(request_id: str) -> Optional[Dict[str, Any]]:
    """The API's own reservation record for an experience-planner attempt.

    Read from the API's request row — never from the caller — so the planner can
    confirm an attempt already funded itself. None when absent or unreachable.
    """
    payload = _get(f"/api/v1/study/internal/experience/requests/{request_id}/reservation")
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    return payload


# ---------------------------------------------------------------------------
# LLM spend ledger. The API owns `llm_approval_budgets`; every mutation is a
# request, and anything but a clear "yes" is a "no" so an uncertain write never
# authorises a provider call.
# ---------------------------------------------------------------------------

_BUDGET = "/api/v1/study/internal/budget"


def _post_flag(path: str, payload: Dict[str, Any], key: str) -> bool:
    """True only for a 200 whose body has `key: true`."""
    result = _call("POST", path, json=payload)
    if result is None:
        return False
    status, body = result
    return status == 200 and isinstance(body, dict) and body.get(key) is True


def _approval_body(approval: Dict[str, Any]) -> Dict[str, Any]:
    keys = ("approvalId", "task", "model", "maxRequests", "expiresAt", "maxTokens", "maxCostUsd")
    return {k: approval[k] for k in keys if approval.get(k) is not None}


def _budget_flag(path: str, payload: Dict[str, Any], key: str) -> bool:
    return _post_flag(f"{_BUDGET}/{path}", payload, key)


def budget_reserve(approval: Dict[str, Any]) -> bool:
    """Reserve one request against the approval."""
    return _budget_flag("reserve", {"approval": _approval_body(approval)}, "reserved")


def budget_reserve_tokens(approval: Dict[str, Any], tokens: int) -> bool:
    """Reserve a token allowance on a live approval."""
    return _budget_flag(
        "reserve-tokens", {"approval": _approval_body(approval), "tokens": tokens}, "reserved"
    )


def budget_active(approval: Dict[str, Any]) -> bool:
    """Whether the reserved approval is still live (not revoked or expired)."""
    return _budget_flag("active", {"approval": _approval_body(approval)}, "active")


def budget_record_usage(approval_id: str, tokens: int = 0, cost_usd: float = 0.0) -> bool:
    return _budget_flag(
        "usage", {"approvalId": approval_id, "tokens": tokens, "costUsd": cost_usd}, "recorded"
    )


def budget_revoke(approval_id: str, reason: str) -> bool:
    return _budget_flag("revoke", {"approvalId": approval_id, "reason": reason}, "revoked")


def budget_status(approval_id: str) -> Optional[Dict[str, Any]]:
    """Usage and revocation state, or None when unknown/unreachable."""
    payload = _get(f"{_BUDGET}/{approval_id}")
    if not isinstance(payload, dict) or "_status" in payload:
        return None
    return payload


# ---------------------------------------------------------------------------
# Formula recognition controls (job, provider eligibility, owner consent).
# ---------------------------------------------------------------------------


def formula_recognition_context(payload: Dict[str, str]) -> Tuple[int, Optional[Dict[str, Any]]]:
    """`(status, body)`; 409 = job unavailable, 503 = controls missing/unreachable."""
    result = _call("POST", "/api/v1/study/internal/formula/recognition-context", json=payload)
    if result is None:
        return 503, None
    status, body = result
    return status, body if isinstance(body, dict) else None


def formula_recognition_recheck(payload: Dict[str, str]) -> Tuple[bool, bool]:
    """`(job_running, controls_hold)`; an unreachable API is `(False, False)`."""
    result = _call("POST", "/api/v1/study/internal/formula/recognition-recheck", json=payload)
    if result is None or result[0] != 200 or not isinstance(result[1], dict):
        return False, False
    body = result[1]
    return body.get("jobRunning") is True, body.get("controlsHold") is True


def budget_reachable(approval_id: str) -> bool:
    """Whether the ledger answers at all (a missing approval row still counts)."""
    return _get(f"{_BUDGET}/{approval_id}") is not None


__all__ = [
    "coach_catalog",
    "coach_current_task",
    "planner_plans",
    "experience_reservation",
    "budget_reserve",
    "budget_reserve_tokens",
    "budget_active",
    "budget_record_usage",
    "budget_revoke",
    "budget_status",
    "budget_reachable",
    "formula_recognition_context",
    "formula_recognition_recheck",
    "ingestion_revision",
    "ingestion_operation_is_current",
]

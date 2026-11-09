"""
Crash-safety marker for formula-recognition dispatches (``ai.formula_dispatches``).

The marker is written *before* the provider is contacted and is never deleted. A
crash after that point is uncertain, so the job must not be dispatched again
automatically: losing the marker would allow a second provider call — a double
charge — for one job. If the table cannot be reached the claim fails and the
caller refuses to dispatch.
"""

from __future__ import annotations

from typing import Optional

from services import pg


def claim(job_id: str) -> bool:
    """Durably claim the one dispatch for `job_id`; False if it was already claimed.

    Raises `pg.PgUnavailable` when the marker cannot be stored — the caller must
    treat that as "do not dispatch".
    """
    with pg.connection() as conn:
        row = conn.execute(
            """
            INSERT INTO ai.formula_dispatches (job_id) VALUES (%s)
            ON CONFLICT (job_id) DO NOTHING RETURNING job_id
            """,
            (job_id,),
        ).fetchone()
    return row is not None


def record_reservation(job_id: str, approval_id: str, tokens: int, requests: int) -> None:
    with pg.connection() as conn:
        conn.execute(
            """
            UPDATE ai.formula_dispatches
               SET approval_id = %s, reserved_tokens = %s, reserved_requests = %s
             WHERE job_id = %s
            """,
            (approval_id, tokens, requests, job_id),
        )


def record_finish(job_id: str, tokens: Optional[int], model_version: Optional[str]) -> None:
    with pg.connection() as conn:
        conn.execute(
            """
            UPDATE ai.formula_dispatches
               SET tokens = %s, model_version = %s, finished_at = now()
             WHERE job_id = %s
            """,
            (tokens, model_version, job_id),
        )

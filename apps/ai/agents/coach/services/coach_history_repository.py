"""
CoachHistoryRepository — persist and retrieve coach actions from PostgreSQL.

Table: `ai.coach_actions` (unique `trace_id`)

Document schema:
  {
    user_id:        str,
    trace_id:       str,          # COACH-09 idempotency key (= job correlationId)
    correlation_id: str,          # explicit correlation id (same value as trace_id
                                  # at the worker boundary)
    ts:             datetime (UTC),
    action_type:    str,   # nudge | encourage | suggest_break | ...
    message:        str | null,
    reasoning:      str,
    focus_state:    str,
    fatigue_state:  str,
    affective_state: str,
  }

Persistence is idempotent by `trace_id`: a completed job is persisted exactly
once, so retried-then-succeeded or redelivered jobs cannot duplicate history
rows (COACH-09 AC#2).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List

from services import pg
from utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_HISTORY_LIMIT = 5


class CoachHistoryRepository:
    """
    Thin wrapper around the `ai.coach_actions` table.

    Falls back gracefully to no-ops when the AI database is unavailable. The
    unique constraint on `trace_id` (the COACH-09 key) is the database-level
    guarantee that a race cannot write a duplicate history row for one
    correlation id.
    """

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def save_action(
        self,
        user_id: str,
        action,  # CoachAction
        coach_input,  # CoachInput
        trace_id: str = "",
        correlation_id: str = "",
    ) -> None:
        """
        Persist a CoachAction alongside key signal context.

        Idempotent by `trace_id` (the job correlation id at the worker
        boundary): re-persisting a completed job is a no-op, so a retried or
        redelivered job cannot create a duplicate history row (COACH-09).

        Args:
            user_id:        User the action was generated for.
            action:         CoachAction Pydantic model.
            coach_input:    The CoachInput that triggered the action (for context).
            trace_id:       Correlation key; the worker passes `envelope.correlationId`.
            correlation_id: Optional explicit correlation id; defaults to
                            `trace_id` when empty.
        """
        if not pg.configured():
            return
        try:
            correlation_id = correlation_id or trace_id
            # Insert only when no record with the same trace_id exists yet;
            # a conflict is a no-op (the original write is preserved).
            with pg.connection() as conn:
                conn.execute(
                    """
                    INSERT INTO ai.coach_actions
                        (user_id, trace_id, correlation_id, ts, action_type, message,
                         reasoning, focus_state, fatigue_state, affective_state)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (trace_id) DO NOTHING
                    """,
                    (
                        user_id,
                        trace_id,
                        correlation_id,
                        datetime.now(tz=timezone.utc),
                        action.action_type,
                        action.message,
                        action.reasoning,
                        coach_input.focus_state.state,
                        coach_input.fatigue_state.state,
                        coach_input.affective_state,
                    ),
                )
            logger.info(
                "coach_action_saved",
                extra={
                    "user_id": user_id,
                    "action_type": action.action_type,
                    "trace_id": trace_id,
                },
            )
        except Exception as exc:
            logger.warning("coach_action_save_error", extra={"error": str(exc)})

    def get_recent_actions(
        self,
        user_id: str,
        limit: int = DEFAULT_HISTORY_LIMIT,
    ) -> List[Dict]:
        """
        Return the *limit* most recent coach actions for *user_id*.

        Args:
            user_id: User to query.
            limit:   Number of records to return (default 5).

        Returns:
            List of dicts (newest first), each with keys:
            ts, action_type, message, focus_state, fatigue_state, affective_state.
        """
        if not pg.configured() or not user_id:
            return []
        try:
            with pg.connection() as conn:
                return conn.execute(
                    """
                    SELECT ts, action_type, message, focus_state, fatigue_state,
                           affective_state
                      FROM ai.coach_actions
                     WHERE user_id = %s
                     ORDER BY ts DESC
                     LIMIT %s
                    """,
                    (user_id, limit),
                ).fetchall()
        except Exception as exc:
            logger.warning(
                "coach_history_read_error",
                extra={"user_id": user_id, "error": str(exc)},
            )
            return []

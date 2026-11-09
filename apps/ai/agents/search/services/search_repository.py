"""SearchRepository — persist and retrieve search exchanges from PostgreSQL.

Table: ``ai.search_history``

Document schema::

    {
        user_id:    str,
        session_id: str,
        trace_id:   str,
        ts:         datetime (UTC),
        question:   str,
        answer:     str,
        sources:    [str],   # URLs used to produce the answer
    }
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from psycopg.types.json import Jsonb

from services import pg
from utils.logger import get_logger

logger = get_logger(__name__)


class SearchRepository:
    """Thin wrapper around the ``ai.search_history`` table."""

    # ------------------------------------------------------------------ #

    def save_exchange(
        self,
        user_id: str,
        question: str,
        answer: str,
        sources: Optional[List[str]] = None,
        session_id: str = "",
        trace_id: str = "",
    ) -> None:
        if not pg.configured() or not user_id:
            return
        try:
            with pg.connection() as conn:
                conn.execute(
                    """
                    INSERT INTO ai.search_history
                        (user_id, session_id, trace_id, ts, question, answer, sources)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        session_id,
                        trace_id,
                        datetime.now(tz=timezone.utc),
                        question,
                        answer,
                        Jsonb(sources or []),
                    ),
                )
        except Exception as exc:
            logger.warning("search_repo_save_error", extra={"error": str(exc)})

    def get_history(self, user_id: str, limit: int = 20) -> List[Dict]:
        if not pg.configured() or not user_id:
            return []
        try:
            with pg.connection() as conn:
                return conn.execute(
                    """
                    SELECT user_id, session_id, trace_id, ts, question, answer, sources
                      FROM ai.search_history
                     WHERE user_id = %s
                     ORDER BY ts DESC
                     LIMIT %s
                    """,
                    (user_id, limit),
                ).fetchall()
        except Exception as exc:
            logger.warning("search_repo_get_error", extra={"error": str(exc)})
            return []

    def clear_history(self, user_id: str) -> None:
        if not pg.configured() or not user_id:
            return
        try:
            with pg.connection() as conn:
                conn.execute("DELETE FROM ai.search_history WHERE user_id = %s", (user_id,))
        except Exception as exc:
            logger.warning("search_repo_clear_error", extra={"error": str(exc)})

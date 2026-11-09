"""Repository for persisting and retrieving signal snapshots from PostgreSQL.

This module handles all database operations for user signals. Rows live in
``ai.signals`` with a ``kind``: ``snapshot`` (the fused SignalSnapshot the coach
reads) or ``frame_analysis`` (the per-frame analyze endpoint's result).
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from psycopg.types.json import Jsonb

from services import pg
from services.signal_processing_service.signal_snapshot import SignalSnapshot
from utils.logger import get_logger

logger = get_logger(__name__)


class SignalRepository:
    """Handles persistence of signal data in PostgreSQL."""

    def save_signal_snapshot(self, snapshot: SignalSnapshot) -> str:
        """
        Save a signal snapshot.

        Args:
            snapshot: The SignalSnapshot to persist

        Returns:
            The row id as a string
        """
        snapshot_dict = snapshot.model_dump()
        with pg.connection() as conn:
            row = conn.execute(
                """
                INSERT INTO ai.signals (user_id, kind, ts, doc)
                VALUES (%s, 'snapshot', %s, %s) RETURNING seq
                """,
                (snapshot.user_id, snapshot.timestamp, Jsonb(snapshot_dict)),
            ).fetchone()
        return str(row["seq"])

    def get_latest_signal_snapshot(self, user_id: str) -> Optional[SignalSnapshot]:
        """
        Retrieve the most recent signal snapshot for a user.

        Args:
            user_id: The user's unique identifier

        Returns:
            The latest SignalSnapshot, or None if no signals exist
        """
        with pg.connection() as conn:
            row = conn.execute(
                """
                SELECT doc FROM ai.signals
                 WHERE user_id = %s AND kind = 'snapshot'
                 ORDER BY seq DESC LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        return SignalSnapshot(**row["doc"]) if row else None

    def get_signal_history(self, user_id: str, limit: int = 10) -> list[SignalSnapshot]:
        """
        Retrieve recent signal history for a user.

        Args:
            user_id: The user's unique identifier
            limit: Maximum number of snapshots to return

        Returns:
            List of SignalSnapshot objects, ordered by timestamp (newest first)
        """
        with pg.connection() as conn:
            rows = conn.execute(
                """
                SELECT doc FROM ai.signals
                 WHERE user_id = %s AND kind = 'snapshot'
                 ORDER BY ts DESC LIMIT %s
                """,
                (user_id, limit),
            ).fetchall()
        return [SignalSnapshot(**row["doc"]) for row in rows]

    def save_frame_analysis(self, analysis: Dict[str, Any]) -> None:
        """Persist one analyze-frame result (JSON-safe dict with a user_id)."""
        with pg.connection() as conn:
            conn.execute(
                """
                INSERT INTO ai.signals (user_id, kind, ts, doc)
                VALUES (%s, 'frame_analysis', %s, %s)
                """,
                (analysis["user_id"], datetime.now(tz=timezone.utc), Jsonb(analysis)),
            )

    def get_frame_analyses(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """The user's most recent frame analyses, newest first, with an `_id`."""
        with pg.connection() as conn:
            rows = conn.execute(
                """
                SELECT seq, doc FROM ai.signals
                 WHERE user_id = %s AND kind = 'frame_analysis'
                 ORDER BY ts DESC LIMIT %s
                """,
                (user_id, limit),
            ).fetchall()
        return [{**row["doc"], "_id": str(row["seq"])} for row in rows]

    # ------------------------------------------------------------------ #
    # Productivity / trend analytics                                       #
    # ------------------------------------------------------------------ #

    def get_hourly_focus_profile(
        self,
        user_id: str,
        days_back: int = 30,
    ) -> Dict[int, float]:
        """
        Return a mapping of {hour_of_day: avg_focus_score} built from historical
        signal data for *user_id* over the last *days_back* days.

        Uses a SQL aggregation that:
          1. Filters to the relevant time window.
          2. Projects the hour-of-day from the timestamp.
          3. Groups and averages focus_score per hour.

        Args:
            user_id:   User to query.
            days_back: How many calendar days of history to include.

        Returns:
            Dict[int, float] mapping 0–23 → average focus score.
            Missing hours (no data) are omitted from the dict.
        """
        since = datetime.now(tz=timezone.utc) - timedelta(days=days_back)
        try:
            with pg.connection() as conn:
                results = conn.execute(
                    """
                    SELECT EXTRACT(HOUR FROM ts AT TIME ZONE 'UTC')::int AS hour,
                           AVG((doc->>'focus_score')::float8) AS avg_focus
                      FROM ai.signals
                     WHERE user_id = %s AND kind = 'snapshot' AND ts >= %s
                     GROUP BY 1
                    """,
                    (user_id, since),
                ).fetchall()
            profile: Dict[int, float] = {
                int(r["hour"]): round(r["avg_focus"], 4)
                for r in results
                if r["hour"] is not None and r["avg_focus"] is not None
            }
            logger.info(
                "hourly_focus_profile_built",
                extra={"user_id": user_id, "hours_with_data": len(profile)},
            )
            return profile
        except Exception as exc:
            logger.warning(
                "hourly_focus_profile_error",
                extra={"user_id": user_id, "error": str(exc)},
            )
            return {}

    def compute_focus_trend(
        self,
        user_id: str,
        window_minutes: int = 5,
    ) -> Optional[float]:
        """
        Compute the linear trend (slope) of focus_score over the last
        *window_minutes* minutes using ordinary least squares.

        A negative slope means focus is declining; positive means improving.

        Args:
            user_id:        User to compute the trend for.
            window_minutes: Time window to consider (default 5 minutes).

        Returns:
            Slope (float) or None if fewer than 2 data-points exist.
        """
        since = datetime.now(tz=timezone.utc) - timedelta(minutes=window_minutes)
        try:
            with pg.connection() as conn:
                docs = conn.execute(
                    """
                    SELECT ts AS timestamp, (doc->>'focus_score')::float8 AS focus_score
                      FROM ai.signals
                     WHERE user_id = %s AND kind = 'snapshot' AND ts >= %s
                     ORDER BY ts ASC
                    """,
                    (user_id, since),
                ).fetchall()
        except Exception as exc:
            logger.warning(
                "focus_trend_query_error",
                extra={"user_id": user_id, "error": str(exc)},
            )
            return None

        if len(docs) < 2:
            return None

        # Convert timestamps to seconds from the first observation
        t0: datetime = docs[0]["timestamp"]
        xs = [(d["timestamp"] - t0).total_seconds() for d in docs]
        ys = [d["focus_score"] for d in docs]

        # OLS slope
        n = len(xs)
        mean_x = sum(xs) / n
        mean_y = sum(ys) / n
        numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
        denominator = sum((x - mean_x) ** 2 for x in xs)

        if denominator == 0.0:
            return 0.0

        slope = numerator / denominator
        return round(slope, 6)

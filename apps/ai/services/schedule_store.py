"""
Persistence for the schedules the AI service owns (``ai.task_scheduling``,
``ai.schedule_history``, ``ai.schedule_snapshots``).

A schedule is one JSONB document; its ``sessions`` carry datetimes that the
orchestrator compares and shifts, which `services.pg` round-trips as datetimes.
Every write that must be atomic (a schedule change + its history row + its
snapshot) goes through one connection/transaction opened with
``pg.connection()``.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from psycopg.types.json import Jsonb



def _with_id(row: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """A schedule document with its row id exposed as `_id`."""
    if row is None:
        return None
    return {**row["doc"], "_id": str(row["id"]), "user_id": row["user_id"]}


def latest(conn, user_id: Optional[str] = None, *, lock: bool = False):
    """The newest schedule (for one user, or overall), optionally row-locked."""
    row = conn.execute(
        f"""
        SELECT id, user_id, doc FROM ai.task_scheduling
         WHERE (%s::text IS NULL OR user_id = %s)
         ORDER BY seq DESC LIMIT 1 {"FOR UPDATE" if lock else ""}
        """,
        (user_id, user_id),
    ).fetchone()
    return _with_id(row)


def insert(conn, doc: Dict[str, Any]) -> str:
    """Add a schedule document; returns its id."""
    row = conn.execute(
        "INSERT INTO ai.task_scheduling (user_id, doc) VALUES (%s, %s) RETURNING id",
        (doc.get("user_id"), Jsonb(doc)),
    ).fetchone()
    return str(row["id"])


def update(conn, schedule_id: str, fields: Dict[str, Any]) -> None:
    """Merge top-level fields into a schedule document."""
    conn.execute(
        "UPDATE ai.task_scheduling SET doc = doc || %s WHERE id = %s",
        (Jsonb(fields), schedule_id),
    )


def add_history(conn, entry: Dict[str, Any]) -> None:
    conn.execute(
        "INSERT INTO ai.schedule_history (user_id, doc) VALUES (%s, %s)",
        (entry["user_id"], Jsonb(entry)),
    )


def add_snapshot(conn, doc: Dict[str, Any], created_at: datetime) -> None:
    conn.execute(
        "INSERT INTO ai.schedule_snapshots (user_id, created_at, doc) VALUES (%s, %s, %s)",
        (doc["user_id"], created_at, Jsonb(doc)),
    )


def latest_snapshot(conn, user_id: str) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        """
        SELECT doc FROM ai.schedule_snapshots
         WHERE user_id = %s ORDER BY created_at DESC, seq DESC LIMIT 1
        """,
        (user_id,),
    ).fetchone()
    return row["doc"] if row else None

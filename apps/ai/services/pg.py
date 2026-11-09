"""
PostgreSQL access for the data the AI service owns.

The Node API owns the application schema (courses, plans, sessions, ...) and the
AI service reaches that data over HTTP (`services.api_service`). What the AI
service itself produces — coach history, pacing, schedules, signals, review
schedule, embeddings, search history, formula dispatch markers — lives in the
dedicated ``ai`` schema created below. Nothing here touches the API's tables.

Why psycopg (not SQLAlchemy): the footprint is a handful of small tables with
JSONB documents and a few atomic statements (``INSERT .. ON CONFLICT``,
``SELECT .. FOR UPDATE``). Raw SQL states that directly; an ORM and a migration
toolchain would be more machinery than the queries themselves.

Environment
-----------
AI_DATABASE_URL   PostgreSQL connection string for the AI service. Unset means
                  "no database": repositories degrade exactly as they did when
                  MongoDB was unreachable.

Documents round-trip datetimes through JSONB as ``{"$date": <iso>}`` so values
the schedulers compare and shift stay ``datetime`` objects after a read.
"""

from __future__ import annotations

import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator, Optional

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import set_json_dumps, set_json_loads
from psycopg_pool import ConnectionPool, PoolTimeout

from utils.logger import get_logger

logger = get_logger(__name__)

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS ai;

CREATE TABLE IF NOT EXISTS ai.task_scheduling (
    seq     bigserial PRIMARY KEY,
    id      uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    user_id text,
    doc     jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS task_scheduling_user_idx ON ai.task_scheduling (user_id, seq DESC);

CREATE TABLE IF NOT EXISTS ai.schedule_history (
    seq     bigserial PRIMARY KEY,
    user_id text NOT NULL,
    doc     jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS ai.schedule_snapshots (
    seq        bigserial PRIMARY KEY,
    user_id    text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    doc        jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS schedule_snapshots_user_idx ON ai.schedule_snapshots (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai.coach_actions (
    seq             bigserial PRIMARY KEY,
    user_id         text NOT NULL,
    trace_id        text NOT NULL UNIQUE,
    correlation_id  text NOT NULL,
    ts              timestamptz NOT NULL,
    action_type     text,
    message         text,
    reasoning       text,
    focus_state     text,
    fatigue_state   text,
    affective_state text
);
CREATE INDEX IF NOT EXISTS coach_actions_user_idx ON ai.coach_actions (user_id, ts DESC);

CREATE TABLE IF NOT EXISTS ai.signals (
    seq     bigserial PRIMARY KEY,
    user_id text NOT NULL,
    kind    text NOT NULL,
    ts      timestamptz NOT NULL,
    doc     jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS signals_user_idx ON ai.signals (user_id, kind, ts DESC);

CREATE TABLE IF NOT EXISTS ai.pacing_data (
    seq         bigserial PRIMARY KEY,
    user_id     text NOT NULL,
    task_id     text,
    subject_tag text NOT NULL DEFAULT '',
    estimated   integer NOT NULL,
    actual      integer NOT NULL,
    ratio       double precision NOT NULL,
    ts          timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS pacing_data_user_idx ON ai.pacing_data (user_id, subject_tag, ts DESC);

CREATE TABLE IF NOT EXISTS ai.review_schedule (
    seq                  bigserial PRIMARY KEY,
    review_id            text NOT NULL UNIQUE,
    user_id              text NOT NULL,
    original_task_id     text NOT NULL,
    original_task_title  text,
    subject_tag          text NOT NULL DEFAULT '',
    key_concepts         jsonb NOT NULL DEFAULT '[]',
    review_number        integer NOT NULL,
    ease_factor          double precision NOT NULL,
    interval_days        integer NOT NULL,
    next_review_date     timestamptz NOT NULL,
    last_review_date     timestamptz,
    quality_history      jsonb NOT NULL DEFAULT '[]',
    status               text NOT NULL,
    created_at           timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS review_schedule_user_idx ON ai.review_schedule (user_id, status, next_review_date);

CREATE TABLE IF NOT EXISTS ai.chunk_embeddings (
    course_id   text NOT NULL,
    revision_id text NOT NULL DEFAULT '',
    chunks      jsonb NOT NULL,
    metas       jsonb NOT NULL,
    dim         integer NOT NULL,
    embeddings  bytea NOT NULL,
    PRIMARY KEY (course_id, revision_id)
);

CREATE TABLE IF NOT EXISTS ai.search_history (
    seq        bigserial PRIMARY KEY,
    user_id    text NOT NULL,
    session_id text NOT NULL DEFAULT '',
    trace_id   text NOT NULL DEFAULT '',
    ts         timestamptz NOT NULL,
    question   text,
    answer     text,
    sources    jsonb NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS search_history_user_idx ON ai.search_history (user_id, ts DESC);

-- Crash-safety marker: written *before* the provider is contacted and never
-- deleted, so a restart cannot dispatch (and charge) the same job twice.
CREATE TABLE IF NOT EXISTS ai.formula_dispatches (
    job_id             text PRIMARY KEY,
    at                 timestamptz NOT NULL DEFAULT now(),
    approval_id        text,
    reserved_tokens    integer,
    reserved_requests  integer,
    tokens             integer,
    model_version      text,
    finished_at        timestamptz
);
"""


class PgUnavailable(Exception):
    """The AI database is not configured or cannot be reached."""


def _encode(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"$date": value.isoformat()}
    raise TypeError(f"not JSON serializable: {type(value).__name__}")


def _decode(obj: dict) -> Any:
    if len(obj) == 1 and "$date" in obj and isinstance(obj["$date"], str):
        return datetime.fromisoformat(obj["$date"])
    return obj


def _dumps(value: Any) -> str:
    return json.dumps(value, default=_encode)


def _loads(value: Any) -> Any:
    return json.loads(value, object_hook=_decode)


set_json_dumps(_dumps)
set_json_loads(_loads)

_pool: Optional[ConnectionPool] = None
_pool_lock = threading.Lock()
_schema_ready = False


def database_url() -> Optional[str]:
    return (os.getenv("AI_DATABASE_URL") or "").strip() or None


def configured() -> bool:
    return database_url() is not None


def _get_pool() -> ConnectionPool:
    global _pool, _schema_ready
    url = database_url()
    if not url:
        raise PgUnavailable("AI_DATABASE_URL is not set")
    with _pool_lock:
        if _pool is None:
            pool = ConnectionPool(
                url,
                min_size=0,
                max_size=int(os.getenv("AI_DATABASE_POOL_MAX", "5")),
                kwargs={"row_factory": dict_row, "connect_timeout": 5},
                open=False,
            )
            pool.open()
            _pool = pool
        if not _schema_ready:
            try:
                with _pool.connection(timeout=5) as conn:
                    conn.execute(SCHEMA_SQL)
                _schema_ready = True
            except Exception as exc:
                logger.warning(
                    "ai_database_schema_failed",
                    extra={"error_type": type(exc).__name__},
                )
                raise PgUnavailable("AI database schema unavailable") from None
    return _pool


@contextmanager
def connection() -> Iterator[psycopg.Connection]:
    """A pooled connection; the transaction commits on a clean exit.

    Raises PgUnavailable (never a driver error carrying the URL) when the
    database cannot be reached.
    """
    pool = _get_pool()
    try:
        with pool.connection(timeout=5) as conn:
            yield conn
    except (psycopg.OperationalError, PoolTimeout) as exc:
        logger.warning(
            "ai_database_unavailable", extra={"error_type": type(exc).__name__}
        )
        raise PgUnavailable("AI database unavailable") from None
    except Exception:
        raise


def reset_for_tests() -> None:
    """Drop the pool so a changed AI_DATABASE_URL takes effect."""
    global _pool, _schema_ready
    with _pool_lock:
        if _pool is not None:
            _pool.close()
        _pool = None
        _schema_ready = False

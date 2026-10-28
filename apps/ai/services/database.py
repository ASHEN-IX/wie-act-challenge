"""
Shared MongoDB connection singleton.

Every service/agent that needs a raw pymongo Database should do:

    from services.database import get_db
    db = get_db()

The singleton is initialised once per process and reused thereafter.
Connection parameters are resolved from environment variables with
sensible defaults for local development.

Environment variables
---------------------
MONGODB_URI   MongoDB connection string  (default: mongodb://localhost:27017)
DB_NAME       Database name              (default: study_partner)
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database

from utils.logger import get_logger

logger = get_logger(__name__)

_MONGO_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
_DB_NAME: str = os.getenv("DB_NAME", "study_partner")


class _DatabaseUnavailable(Exception):
    """Private sanitized connection failure; exceptions are never cached."""


@lru_cache(maxsize=1)
def _get_client() -> MongoClient:
    """Cache a successful client only so startup outages remain recoverable."""
    client = None
    try:
        client = MongoClient(
            _MONGO_URI,
            serverSelectionTimeoutMS=5_000,
            connectTimeoutMS=5_000,
            socketTimeoutMS=10_000,
        )
        # Trigger a lightweight ping to confirm connectivity early
        client.admin.command("ping")
        logger.info("database_connected")
        return client
    except Exception as exc:
        if client is not None:
            client.close()
        logger.warning(
            "database_connection_failed",
            extra={"error_type": type(exc).__name__},
        )
        raise _DatabaseUnavailable("Database connection unavailable") from None


def get_db() -> Optional[Database]:
    """
    Return the pymongo Database singleton.

    Returns None (instead of raising) when MongoDB is unavailable so that
    components that optionally use the database can degrade gracefully.
    Callers that *require* a DB should handle None explicitly.
    """
    try:
        client = _get_client()
    except _DatabaseUnavailable:
        return None
    if client is None:
        return None
    return client[_DB_NAME]


def require_db() -> Database:
    """
    Like get_db() but raises RuntimeError if no connection is available.
    Use this in request handlers that cannot proceed without a database.
    """
    db = get_db()
    if db is None:
        raise RuntimeError(
            "MongoDB is unavailable. Check MONGODB_URI and DB_NAME privately."
        )
    return db

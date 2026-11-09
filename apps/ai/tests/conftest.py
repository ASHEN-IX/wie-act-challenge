"""Shared test gating for optional features and live services.

Every skip here is *conditional*: the test runs when its dependency is present.
Nothing is skipped unconditionally, and a genuine assertion failure is never
converted into a skip. That distinction is the whole point of this file — a
suite that silently skips its way to green is worse than one that fails.

Groups map to pytest markers declared in pyproject.toml:

    -m "not integration and not requires_postgres and not optional_elevenlabs and not optional_piper"   # core
    -m optional_elevenlabs                                                                              # optional feature
    -m "integration or requires_postgres"                                                                # live services
"""

from __future__ import annotations

import importlib.util
import os

import pytest


def _has(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


# --- optional runtime features ------------------------------------------------

def _conditional_marker(name: str, missing: bool, reason: str):
    """Keep CI selection independent of whether the prerequisite is installed."""
    def decorate(item):
        selected = getattr(pytest.mark, name)(item)
        return pytest.mark.skipif(missing, reason=reason)(selected)

    return decorate


needs_av = _conditional_marker(
    "optional_elevenlabs", not _has("av"),
    "optional dependency 'av' not installed; install av to run decoder tests",
)
needs_piper = _conditional_marker(
    "optional_piper", not _has("piper"),
    "optional dependency 'piper' not installed; install piper-tts to run runtime tests",
)


# --- live services ------------------------------------------------------------

def _postgres_configured() -> bool:
    """`AI_TEST_DATABASE_URL` is set *and* a socket accepts a connection.

    Checking the URL alone is not enough: a stale URL pointing at a container
    that is not running is exactly the case that produced confusing failures in
    whole-tree runs.
    """
    url = os.environ.get("AI_TEST_DATABASE_URL")
    if not url:
        return False
    try:
        import socket
        from urllib.parse import urlsplit

        parts = urlsplit(url)
        with socket.create_connection((parts.hostname or "127.0.0.1", parts.port or 5432), timeout=1):
            return True
    except OSError:
        return False


needs_postgres = _conditional_marker(
    "requires_postgres", not _postgres_configured(),
    "no reachable PostgreSQL; set AI_TEST_DATABASE_URL to run database-backed tests",
)

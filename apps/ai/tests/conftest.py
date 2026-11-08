"""Shared test gating for optional features and live services.

Every skip here is *conditional*: the test runs when its dependency is present.
Nothing is skipped unconditionally, and a genuine assertion failure is never
converted into a skip. That distinction is the whole point of this file — a
suite that silently skips its way to green is worse than one that fails.

Groups map to pytest markers declared in pyproject.toml:

    -m "not integration and not requires_mongo and not optional_elevenlabs and not optional_piper"   # core
    -m optional_elevenlabs                                                                          # optional feature
    -m "integration or requires_mongo"                                                               # live services
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

def _mongo_configured() -> bool:
    """A MongoDB URI is configured *and* a socket accepts a connection.

    Checking the URI alone is not enough: a stale URI pointing at a container
    that is not running is exactly the case that produced four confusing
    failures in the whole-tree run.
    """
    uri = os.environ.get("MONGODB_URI") or os.environ.get("P0_DATABASE_TEST_MONGODB_URI")
    if not uri:
        return False
    host_port = uri.split("://", 1)[-1].split("/")[0]
    if "@" in host_port:
        host_port = host_port.rsplit("@", 1)[-1]
    if host_port.startswith("mongodb+srv"):
        return True
    host, _, port = host_port.partition(":")
    try:
        import socket

        with socket.create_connection((host or "127.0.0.1", int(port or 27017)), timeout=1):
            return True
    except OSError:
        return False


needs_mongo = _conditional_marker(
    "requires_mongo", not _mongo_configured(),
    "no reachable MongoDB; set MONGODB_URI to run database-backed tests",
)

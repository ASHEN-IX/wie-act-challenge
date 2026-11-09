"""
Root conftest.py — project-wide pytest configuration.

• Excludes manual/integration scripts that contain bare exit() calls from
  automatic test collection (they are not meant to be run by pytest).
• Adds the project root to sys.path so that `services.*` and `agents.*`
  imports resolve correctly regardless of how pytest is invoked.
"""

import os
import sys
from pathlib import Path

import pytest

# Ensure project root is always on the path
ROOT = Path(__file__).parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------------------
# Tell pytest to ignore manual scripts that use exit() at module level.
# Add relative paths (from rootdir) as strings.
# ---------------------------------------------------------------------------
collect_ignore: list[str] = []

collect_ignore_glob: list[str] = [
    "**/demo_*.py",  # interactive demo scripts
    "**/test_*_manual.py",  # explicitly manual scripts
]


@pytest.fixture
def ai_db(monkeypatch):
    """A clean `ai` schema in the test database, for tests that need real SQL.

    Set AI_TEST_DATABASE_URL to a throwaway PostgreSQL database; without one the
    test is skipped (never silently passed).
    """
    url = os.environ.get("AI_TEST_DATABASE_URL")
    if not url:
        pytest.skip("AI_TEST_DATABASE_URL not set; no PostgreSQL for database-backed tests")
    from services import pg

    monkeypatch.setenv("AI_DATABASE_URL", url)
    pg.reset_for_tests()
    with pg.connection() as conn:
        conn.execute(
            "TRUNCATE ai.task_scheduling, ai.schedule_history, ai.schedule_snapshots, "
            "ai.coach_actions, ai.signals, ai.pacing_data, ai.review_schedule, "
            "ai.chunk_embeddings, ai.search_history, ai.formula_dispatches"
        )
    yield pg
    pg.reset_for_tests()

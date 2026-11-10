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


# ---------------------------------------------------------------------------
# Tests that need inputs which are not committed are skipped (never silently
# passed) when those inputs are absent, as the PostgreSQL tests above are.
# The reference course PDFs are private course material and are git-ignored.
# ---------------------------------------------------------------------------
_BENCHMARKS = ROOT / "agents" / "course_ingestion" / "extraction" / "benchmarks"
_PRIVATE_PDF_TESTS = {
    "reference-course.pdf": {
        "test_formula_samples_have_valid_source_geometry_and_pending_review",
        "test_all_cases_have_source_and_pending_independent_decisions",
        "test_reference_crops_match_the_pinned_source",
        "test_approved_research_path_is_bounded_and_keeps_proposals_pending",
        "test_v2_primary_region_recovers_final_summand_preserves_all_v1_region_text",
        "test_ambiguous_multiline_and_mixed_source_is_marked_not_verified",
        "test_manifest_version_resolves_legacy_and_v2_independently",
        "test_v1_still_matches_published_reference_output",
        "test_reference_preserves_quantifiers_accents_and_canonical_geometry",
        "test_reference_retains_only_the_real_framed_algorithm",
        "test_bounded_vector_figure_survives_and_quality_requires_review",
        "test_reference_regions_survive_manifest_sections_and_canonical",
        "test_math_context_recovers_adjacent_glyphs_without_changing_exact_crop",
        "test_reference_formula_region_ids_remain_resolvable",
    },
    "networking-qa.pdf": {
        "test_networking_fixture_preserves_indentation_spaced_table_and_rectangle",
    },
}
_AI_DATABASE_TESTS = {"test_coach_fatigue_integration", "test_fatigue_integration"}


def pytest_collection_modifyitems(config, items):
    for item in items:
        for pdf, names in _PRIVATE_PDF_TESTS.items():
            if item.name in names and not (_BENCHMARKS / pdf).exists():
                item.add_marker(pytest.mark.skip(reason=f"{pdf} is a private fixture and is not committed"))
        if item.name in _AI_DATABASE_TESTS and not os.environ.get("AI_DATABASE_URL"):
            item.add_marker(pytest.mark.skip(reason="AI_DATABASE_URL not set; no PostgreSQL for this integration test"))

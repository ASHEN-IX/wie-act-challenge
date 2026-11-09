"""
Tests for PacingStore against real PostgreSQL (the `ai_db` fixture).

Run with:
    AI_TEST_DATABASE_URL=postgresql://... pytest agents/planner/tests/test_pacing_store.py -v
"""

import pytest

from agents.planner.memory.pacing_store import (
    DEFAULT_FACTOR,
    MAX_RECORDS,
    MIN_RECORDS,
    PacingStore,
)


def _record(store, ratios, subject_tag="", user_id="u1"):
    """Record completions whose actual/estimated ratio is each of `ratios`."""
    for index, ratio in enumerate(ratios):
        store.record_task_completion(user_id, f"t{index}", 100, int(ratio * 100), subject_tag)


class TestGetUserPacingFactor:
    def test_returns_default_when_no_user_id(self, ai_db):
        assert PacingStore().get_user_pacing_factor("") == DEFAULT_FACTOR

    def test_returns_default_when_no_db(self, monkeypatch):
        monkeypatch.delenv("AI_DATABASE_URL", raising=False)
        assert PacingStore().get_user_pacing_factor("u1") == DEFAULT_FACTOR

    def test_returns_default_with_insufficient_records(self, ai_db):
        store = PacingStore()
        _record(store, [1.2] * (MIN_RECORDS - 1))
        assert store.get_user_pacing_factor("u1") == DEFAULT_FACTOR

    def test_computes_median_with_enough_records(self, ai_db):
        store = PacingStore()
        _record(store, [1.5, 1.0, 2.0, 1.5, 1.0])  # median = 1.5
        assert store.get_user_pacing_factor("u1") == pytest.approx(1.5)

    def test_clamps_to_maximum(self, ai_db):
        store = PacingStore()
        _record(store, [10.0] * (MIN_RECORDS + 1))
        assert store.get_user_pacing_factor("u1") == 3.0

    def test_clamps_to_minimum(self, ai_db):
        store = PacingStore()
        _record(store, [0.1] * (MIN_RECORDS + 1))
        assert store.get_user_pacing_factor("u1") == 0.5

    def test_falls_back_to_global_when_subject_has_no_history(self, ai_db):
        store = PacingStore()
        _record(store, [1.2] * (MIN_RECORDS + 1), subject_tag="")
        assert store.get_user_pacing_factor("u1", "math") == pytest.approx(1.2)

    def test_uses_subject_history_when_present(self, ai_db):
        store = PacingStore()
        _record(store, [2.0] * MIN_RECORDS, subject_tag="math")
        _record(store, [1.0] * (MIN_RECORDS + 2), subject_tag="")
        assert store.get_user_pacing_factor("u1", "math") == pytest.approx(2.0)

    def test_history_is_per_user(self, ai_db):
        store = PacingStore()
        _record(store, [2.5] * MIN_RECORDS, user_id="someone-else")
        assert store.get_user_pacing_factor("u1") == DEFAULT_FACTOR


class TestRecordTaskCompletion:
    def test_inserts_row(self, ai_db):
        PacingStore().record_task_completion("u1", "t1", 30, 45, "math")
        with ai_db.connection() as conn:
            row = conn.execute("SELECT * FROM ai.pacing_data").fetchone()
        assert (row["user_id"], row["estimated"], row["actual"], row["subject_tag"]) == (
            "u1",
            30,
            45,
            "math",
        )
        assert abs(row["ratio"] - 1.5) < 0.001

    def test_skips_when_no_db(self, monkeypatch):
        monkeypatch.delenv("AI_DATABASE_URL", raising=False)
        PacingStore().record_task_completion("u1", "t1", 30, 45)  # must not raise

    def test_skips_invalid_times(self, ai_db):
        PacingStore().record_task_completion("u1", "t1", 0, 45)
        with ai_db.connection() as conn:
            assert conn.execute("SELECT count(*) AS n FROM ai.pacing_data").fetchone()["n"] == 0

    def test_prunes_to_the_rolling_window_per_user_and_subject(self, ai_db):
        store = PacingStore()
        _record(store, [1.0] * (MAX_RECORDS + 5), subject_tag="math")
        _record(store, [1.0] * 2, subject_tag="art")
        with ai_db.connection() as conn:
            counts = {
                r["subject_tag"]: r["n"]
                for r in conn.execute(
                    "SELECT subject_tag, count(*) AS n FROM ai.pacing_data GROUP BY 1"
                ).fetchall()
            }
        assert counts == {"math": MAX_RECORDS, "art": 2}

    def test_prune_keeps_the_newest_records(self, ai_db):
        store = PacingStore()
        _record(store, [float(i + 1) for i in range(MAX_RECORDS + 3)])
        with ai_db.connection() as conn:
            kept = {r["task_id"] for r in conn.execute("SELECT task_id FROM ai.pacing_data")}
        assert "t0" not in kept and f"t{MAX_RECORDS + 2}" in kept

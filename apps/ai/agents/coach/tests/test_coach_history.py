"""
Unit tests for CoachHistoryRepository.

Run with:
    pytest agents/coach/tests/test_coach_history.py -v
"""

from datetime import datetime, timezone

import pytest

from agents.coach.models.schemas import (
    CoachAction,
    CoachInput,
    FocusState,
    FatigueState,
)
from agents.coach.services.coach_history_repository import CoachHistoryRepository

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_coach_input(**overrides):
    defaults = dict(
        scheduled_tasks=[],
        current_time=datetime.now(tz=timezone.utc),
        focus_state=FocusState(state="Drifting", score=0.5),
        fatigue_state=FatigueState(state="Moderate", score=0.3),
        affective_state="engaged",
    )
    defaults.update(overrides)
    return CoachInput(**defaults)


def _make_action(**overrides):
    defaults = dict(
        action_type="nudge",
        message="Focus up!",
        reasoning="Drifting.",
    )
    defaults.update(overrides)
    return CoachAction(**defaults)


# ---------------------------------------------------------------------------
# Tests (real PostgreSQL via the `ai_db` fixture)
# ---------------------------------------------------------------------------


class TestCoachHistoryRepository:
    def test_save_action_inserts_row(self, ai_db):
        CoachHistoryRepository().save_action(
            "u1", _make_action(), _make_coach_input(), trace_id="t-1", correlation_id="c-1"
        )
        with ai_db.connection() as conn:
            row = conn.execute("SELECT * FROM ai.coach_actions").fetchone()
        assert (row["user_id"], row["trace_id"], row["correlation_id"]) == ("u1", "t-1", "c-1")
        assert (row["action_type"], row["focus_state"], row["fatigue_state"]) == (
            "nudge",
            "Drifting",
            "Moderate",
        )
        assert row["affective_state"] == "engaged"

    def test_correlation_id_defaults_to_trace_id(self, ai_db):
        CoachHistoryRepository().save_action(
            "u1", _make_action(), _make_coach_input(), trace_id="t-2"
        )
        with ai_db.connection() as conn:
            assert conn.execute("SELECT correlation_id FROM ai.coach_actions").fetchone()[
                "correlation_id"
            ] == "t-2"

    def test_save_action_idempotent_by_trace_id(self, ai_db):
        repo = CoachHistoryRepository()
        repo.save_action("u1", _make_action(message="first"), _make_coach_input(), trace_id="t-3")
        repo.save_action("u1", _make_action(message="second"), _make_coach_input(), trace_id="t-3")
        with ai_db.connection() as conn:
            rows = conn.execute("SELECT message FROM ai.coach_actions").fetchall()
        assert [r["message"] for r in rows] == ["first"]  # the original write is preserved

    def test_trace_id_is_unique_at_the_database(self, ai_db):
        """The constraint, not just the upsert, is the COACH-09 guarantee."""
        import psycopg

        insert = (
            "INSERT INTO ai.coach_actions (user_id, trace_id, correlation_id, ts) "
            "VALUES ('u', 'dup', 'dup', now())"
        )
        with ai_db.connection() as conn:
            conn.execute(insert)
        with pytest.raises(psycopg.errors.UniqueViolation):
            with ai_db.connection() as conn:
                conn.execute(insert)

    def test_save_action_no_db_silently_skips(self, monkeypatch):
        monkeypatch.delenv("AI_DATABASE_URL", raising=False)
        CoachHistoryRepository().save_action(
            "u1", _make_action(), _make_coach_input(), trace_id="t-4"
        )  # must not raise

    def test_get_recent_actions_newest_first_and_limited(self, ai_db):
        repo = CoachHistoryRepository()
        for index in range(4):
            repo.save_action(
                "u1", _make_action(message=f"m{index}"), _make_coach_input(), trace_id=f"t-{index}"
            )
        repo.save_action("other", _make_action(message="x"), _make_coach_input(), trace_id="o-1")
        history = repo.get_recent_actions("u1", limit=3)
        assert [h["message"] for h in history] == ["m3", "m2", "m1"]
        assert set(history[0]) == {
            "ts",
            "action_type",
            "message",
            "focus_state",
            "fatigue_state",
            "affective_state",
        }

    def test_get_recent_actions_empty_user_returns_empty(self, ai_db):
        assert CoachHistoryRepository().get_recent_actions("") == []

    def test_get_recent_actions_no_db_returns_empty(self, monkeypatch):
        monkeypatch.delenv("AI_DATABASE_URL", raising=False)
        assert CoachHistoryRepository().get_recent_actions("u1") == []

    def test_get_recent_actions_swallows_database_errors(self, ai_db, monkeypatch):
        def boom(*args, **kwargs):
            raise RuntimeError("down")

        monkeypatch.setattr(ai_db, "connection", boom)
        assert CoachHistoryRepository().get_recent_actions("u1") == []

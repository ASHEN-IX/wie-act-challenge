"""Real FAISS/retrieval; deterministic embeddings/decomposition, no providers."""
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from threading import Barrier, Event

import numpy as np
import pytest

from agents.planner.agent import PlannerAgent
from agents.planner.models.task_graph import PlannerInput
from agents.planner.rag.indexer import VectorStore
from agents.planner.rag.retriever import ContentRetriever


class FixedEmbedding:
    def encode(self, texts):
        return np.ones((len(texts), 384), dtype="float32")


@pytest.fixture
def planner(monkeypatch):
    agent = PlannerAgent.__new__(PlannerAgent)
    agent.embed_model = FixedEmbedding()
    agent.vector_store = VectorStore(384)
    agent.retriever = ContentRetriever(agent.vector_store, agent.embed_model)
    agent.clarifier = SimpleNamespace(check_goal=lambda _: False)
    agent.pacing_store = SimpleNamespace(
        get_user_pacing_factor=lambda _: 1,
        update_from_execution=lambda *_: None,
    )
    seen = {}

    def decompose(_self, goal, concepts, *_args, **_kwargs):
        seen[goal] = list(concepts)
        return []

    monkeypatch.setattr(PlannerAgent, "_decompose_goal", decompose)
    monkeypatch.setattr(PlannerAgent, "_apply_rules", lambda _self, tasks, *_: tasks)
    monkeypatch.setattr("agents.planner.agent.load_index", lambda _: (None, None))
    monkeypatch.setattr("agents.planner.agent.load_embeddings", lambda _: None)
    monkeypatch.setattr("agents.planner.agent.save_index", lambda *_args, **_kwargs: None)
    return agent, seen


def request(user, secret, course=None):
    return PlannerInput(
        goal=secret, user_id=user, deadline_iso="2030-01-01T00:00:00",
        available_minutes=30, course_documents=[secret], course_knowledge=course,
    )


def test_sequential_requests_never_retrieve_another_users_source(planner):
    agent, seen = planner
    agent.plan(request("owner-a", "PRIVATE_SOURCE_A"))
    agent.plan(request("owner-b", "PRIVATE_SOURCE_B"))
    assert "PRIVATE_SOURCE_A" not in " ".join(seen["PRIVATE_SOURCE_B"])
    assert "PRIVATE_SOURCE_B" in " ".join(seen["PRIVATE_SOURCE_B"])


def test_overlapping_requests_have_distinct_retrieval_state(planner, monkeypatch):
    agent, seen = planner
    barrier = Barrier(2)
    first_ready = Event()

    def decompose(_self, goal, concepts, *_args, **_kwargs):
        if goal == "PRIVATE_A":
            first_ready.set()
        barrier.wait(timeout=5)
        seen[goal] = list(concepts)
        return []

    monkeypatch.setattr(PlannerAgent, "_decompose_goal", decompose)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(agent.plan, request("a", "PRIVATE_A"))]
        assert first_ready.wait(timeout=5)
        futures.append(pool.submit(agent.plan, request("b", "PRIVATE_B")))
        for future in futures:
            future.result(timeout=10)
    assert "PRIVATE_A" not in " ".join(seen["PRIVATE_B"])
    assert "PRIVATE_B" not in " ".join(seen["PRIVATE_A"])


def test_failed_indexing_cannot_reuse_previous_private_chunks(planner, monkeypatch):
    agent, seen = planner
    agent.plan(request("a", "PREVIOUS_PRIVATE_SOURCE"))

    def fail(*_args, **_kwargs):
        raise RuntimeError("synthetic indexing outage")

    monkeypatch.setattr(PlannerAgent, "_load_retrieval_context", fail)
    agent.plan(request("b", "CURRENT_SOURCE"))
    assert seen["CURRENT_SOURCE"] == []


def test_disk_cache_is_actor_and_content_scoped(planner, monkeypatch):
    agent, _ = planner
    loaded = []
    monkeypatch.setattr("agents.planner.agent.load_index",
                        lambda key: (loaded.append(key) or None, None))
    agent.plan(request("a", "SOURCE_ONE", {"_id": "same-course", "title": "same title"}))
    agent.plan(request("b", "SOURCE_ONE", {"_id": "same-course", "title": "same title"}))
    agent.plan(request("a", "SOURCE_TWO", {"_id": "same-course", "title": "same title"}))
    agent.plan(request("a", "SOURCE_ONE", {"_id": "same-course", "title": "same title"}))
    assert len(loaded) == 4
    assert loaded[0] == loaded[3]
    assert len(set(loaded)) == 3
    assert all(len(key) == 64 and "/" not in key for key in loaded)


def test_title_without_stable_course_id_cannot_address_shared_cache(planner, monkeypatch):
    agent, _ = planner

    def forbidden(*_args, **_kwargs):
        pytest.fail("A title is not a source identity or cache permission")

    monkeypatch.setattr("agents.planner.agent.load_index", forbidden)
    monkeypatch.setattr("agents.planner.agent.save_index", forbidden)
    agent.plan(request("a", "SOURCE", {"course_title": "same private title"}))


@pytest.mark.asyncio
async def test_planning_api_does_not_log_private_source_or_goal(monkeypatch, capsys):
    from services.api.routers import planning
    course = {"_id": "course-a", "course_title": "PRIVATE_COURSE_TITLE", "topics": [{"subtopics": [{"tokenized_chunks": ["PRIVATE_CHUNK_TEXT"], "summary": "PRIVATE_SUMMARY_TEXT"}]}]}
    output = SimpleNamespace(task_graph=SimpleNamespace(tasks=[]), warning=None)
    monkeypatch.setattr(planning, "get_planner_agent", lambda: SimpleNamespace(plan=lambda _: output))
    result = await planning.create_study_plan(planning.PlannerRequest(user_id="a", goal="PRIVATE_USER_GOAL", available_time_minutes=30, course_id="course-a", course_knowledge=course))
    assert result["success"] is True
    captured = capsys.readouterr()
    assert "PRIVATE_" not in captured.out + captured.err


@pytest.mark.asyncio
async def test_raw_course_id_without_authorized_context_is_unavailable(monkeypatch):
    from fastapi import HTTPException
    from services.api.routers import planning

    def forbidden(*_args):
        raise AssertionError("Raw course ID must not trigger unscoped lookup")

    monkeypatch.setattr(planning, "get_planner_agent", forbidden)
    with pytest.raises(HTTPException) as error:
        await planning.create_study_plan(planning.PlannerRequest(
            user_id="a", goal="Synthetic", available_time_minutes=30, course_id="foreign-course"
        ))
    assert error.value.status_code == 503


@pytest.mark.asyncio
async def test_mismatched_forwarded_course_context_is_rejected_before_planning(monkeypatch):
    from fastapi import HTTPException
    from services.api.routers import planning

    def forbidden():
        raise AssertionError("Mismatched context must not reach planner")

    monkeypatch.setattr(planning, "get_planner_agent", forbidden)
    with pytest.raises(HTTPException) as error:
        await planning.create_study_plan(planning.PlannerRequest(
            user_id="a", goal="Synthetic", available_time_minutes=30,
            course_id="course-a", course_knowledge={"_id": "course-b"}
        ))
    assert error.value.status_code == 422

"""Compact vs capable tier split (docs/llm-config.md, spec: deliberate model choice)."""

from unittest.mock import patch

from agents.facilitator.agent import run_facilitator
from agents.facilitator.schemas import FacilitatorObservationInput
from utils import llm_client


def test_compact_and_capable_assignments_are_explicit():
    assert llm_client.get_model_tier("coach") == "compact"
    assert llm_client.get_model_tier("course_ingestion") == "compact"
    for agent in ("facilitator", "planner", "search", "reflection", "evaluator"):
        assert llm_client.get_model_tier(agent) == "capable", agent


def test_facilitator_alias_runs_on_the_capable_model():
    cfg = llm_client.agent_config("facilitator")
    assert cfg.model == "groq/openai/gpt-oss-120b"
    assert "nvidia_nim/meta/llama-3.2-11b-vision-instruct" in cfg.fallback_models


def test_facilitator_llm_path_calls_the_facilitator_alias():
    calls = []

    def recording_ask(agent, system_prompt, user_prompt, **kwargs):
        calls.append(agent)
        return "{}"

    obs = FacilitatorObservationInput(
        roomId="room-1",
        transcriptText="I think the answer is 42 because the formula gives it directly",
        actionType="ask_facilitator",
    )
    with patch("utils.llm_client.ask", side_effect=recording_ask):
        run_facilitator(obs)
    assert calls == ["facilitator"]

"""AI Learning Experience Planner for the Visual Learning Lab.

Two bounded model steps, both through the existing ``utils.llm_client.ask``
routing (compact selector, capable planner) and both validated structurally:

1. selection  — which registered engine (if any) honestly demonstrates the concept;
2. planning   — the structured scenario and learner guidance for that engine.

There is exactly one repair attempt, then the caller receives an explicit
``unsupported``/``unavailable`` result. No model output is ever executed.
"""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import ValidationError

from agents.visual_lab.prompts import (
    GUIDE_SYSTEM,
    PLANNER_SYSTEM,
    SELECTION_SYSTEM,
    guide_prompt,
    planner_prompt,
    selection_prompt,
    system_block,
)
from agents.visual_lab.schemas import (
    Engine,
    GuideRequest,
    GuideResponse,
    LabCandidate,
    PlanRequest,
    PlanResponse,
    Selection,
)
from utils.llm_client import (
    LLMRequestError,
    LLMResult,
    LLMUnavailableError,
    ask,
)
from utils.logger import get_logger

logger = get_logger(__name__)


class PlannerUnavailableError(RuntimeError):
    """The planner could not produce a usable proposal, with a safe reason."""


def _extract_json(text: str) -> Any:
    """Parse exactly one JSON object. Markdown fences and prose are rejected."""
    candidate = (text or "").strip()
    if not candidate or len(candidate) > 20_000:
        raise ValueError("empty or oversized planner output")
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ValueError("planner output was not valid JSON") from exc


def _ask(agent: str, system: str, prompt: str) -> tuple[str, str]:
    """Return (text, execution mode). Raises PlannerUnavailableError."""
    try:
        result = ask(agent, system_block(system), prompt, max_tokens=2048)
    except LLMUnavailableError as exc:
        raise PlannerUnavailableError("AI model unavailable") from exc
    except LLMRequestError as exc:
        raise PlannerUnavailableError("AI model request failed") from exc
    if isinstance(result, LLMResult):
        return result.text, result.execution_mode
    return str(result), "REAL_APPROVED"


def _course_context(req: PlanRequest) -> str:
    lines = []
    for passage in req.passages:
        page = passage.get("pageNumber")
        where = f"{passage['documentId']}" + (f" p.{page}" if isinstance(page, int) else "")
        lines.append(f"[{where}] {passage['text'][:1200]}")
    return "\n\n".join(lines)


def select_engine(req: PlanRequest) -> tuple[Selection, str]:
    text, mode = _ask(
        "visual_lab_selector",
        SELECTION_SYSTEM,
        selection_prompt(req.concept, _course_context(req)),
    )
    selection = Selection.model_validate(_extract_json(text))
    return selection, mode


def plan_candidate(
    req: PlanRequest, engine: Engine
) -> tuple[LabCandidate, str]:
    """Plan with one bounded repair attempt; never returns an invalid candidate."""
    context = _course_context(req)
    prompt = planner_prompt(req.concept, engine, context, req.language)
    text, mode = _ask("visual_lab_planner", PLANNER_SYSTEM, prompt)
    try:
        candidate = LabCandidate.model_validate(_extract_json(text))
        if candidate.engine != engine:
            raise ValueError(f"planner chose {candidate.engine} instead of {engine}")
        return candidate, mode
    except (ValueError, ValidationError) as first:
        logger.warning(
            "visual_lab_candidate_invalid",
            extra={"engine": engine, "reason": str(first)[:200]},
        )
        repair = (
            f"The previous proposal was rejected: {str(first)[:200]}. "
            f"Return a corrected JSON object for engine {engine} only. "
            "No prose, no markdown, no extra fields."
        )
        text, mode = _ask(
            "visual_lab_planner",
            PLANNER_SYSTEM,
            planner_prompt(req.concept, engine, context, req.language, repair),
        )
        candidate = LabCandidate.model_validate(_extract_json(text))
        if candidate.engine != engine:
            raise PlannerUnavailableError("planner could not honour the selected engine")
        return candidate, mode


def plan_lab(req: PlanRequest) -> PlanResponse:
    """Select an engine and configure it. Refusal is a first-class outcome."""
    try:
        selection, selection_mode = select_engine(req)
    except PlannerUnavailableError:
        return PlanResponse(
            status="unavailable",
            reason="AI planning is unavailable right now; a supported example can still be used.",
            executionMode="UNAVAILABLE",
        )
    except (ValueError, ValidationError):
        return PlanResponse(
            status="unsupported",
            reason="The AI could not match this concept to a supported visual lab.",
            executionMode="UNAVAILABLE",
        )

    if selection.engine == "unsupported":
        return PlanResponse(
            status="unsupported",
            reason=selection.reason,
            executionMode=selection_mode,  # type: ignore[arg-type]
        )

    try:
        candidate, mode = plan_candidate(req, selection.engine)
    except PlannerUnavailableError:
        return PlanResponse(
            status="unavailable",
            reason="The AI planner is unavailable right now; the deterministic example still works.",
            executionMode="UNAVAILABLE",
        )
    except (ValueError, ValidationError):
        return PlanResponse(
            status="unsupported",
            reason=(
                "The AI could not produce a valid configuration for this concept. "
                "Its scenario was rejected by the simulator's own rules."
            ),
            executionMode="UNAVAILABLE",
        )
    return PlanResponse(status="planned", candidate=candidate, reason=selection.reason, executionMode=mode)  # type: ignore[arg-type]


def guide_experiment(req: GuideRequest) -> GuideResponse:
    """Explain authoritative state. Failure is explicit, never invented."""
    state = json.dumps(req.state, ensure_ascii=False, sort_keys=True)[:6000]
    prompt = guide_prompt(
        req.question,
        req.concept,
        req.learningObjective,
        req.engine,
        req.guidanceMode,
        state,
        req.language,
    )
    try:
        text, mode = _ask("visual_lab_planner", GUIDE_SYSTEM, prompt)
        parsed = _extract_json(text)
        answer = parsed.get("text") if isinstance(parsed, dict) else None
        if not isinstance(answer, str) or not answer.strip() or len(answer) > 2000:
            raise ValueError("invalid guidance text")
        return GuideResponse(
            status="guided",
            text=answer.strip(),
            reason="",
            executionMode=mode,  # type: ignore[arg-type]
        )
    except (PlannerUnavailableError, ValueError):
        return GuideResponse(
            status="unavailable",
            text="",
            reason="The AI guide is unavailable; the simulation and its computed results still work.",
            executionMode="UNAVAILABLE",
        )

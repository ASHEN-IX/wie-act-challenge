"""Model-backed review of an extracted course outline.

One model call through the shared ``utils.llm_client.ask`` routing (capable
tier), strict validation, and exactly one repair attempt. The result is a
*proposal*: the instructor applies or ignores it. Unavailable or invalid model
output is reported as such; nothing is invented.
"""

from __future__ import annotations

import json
from typing import Any

from pydantic import ValidationError

from agents.course_review.prompts import REVIEW_SYSTEM, review_prompt, system_block
from agents.course_review.schemas import Proposal, ReviewRequest, ReviewResponse
from utils.llm_client import LLMRequestError, LLMResult, LLMUnavailableError, ask
from utils.logger import get_logger

logger = get_logger(__name__)

AGENT = "course_review"


class _Unavailable(RuntimeError):
    pass


def _outline_text(req: ReviewRequest) -> str:
    lines: list[str] = []
    for chapter in req.chapters:
        lines.append(f"CHAPTER id={chapter.id} title={chapter.title!r}")
        for lesson in chapter.lessons:
            lines.append(f"  LESSON id={lesson.id} title={lesson.title!r}")
            if lesson.objectives:
                lines.append(f"    current objectives: {' | '.join(lesson.objectives)}")
            lines.append(f"    excerpt: {lesson.excerpt.strip()[:1200] or '(empty)'}")
    return "\n".join(lines)


def _parse(text: str) -> Any:
    candidate = (text or "").strip()
    if not candidate or len(candidate) > 60_000:
        raise ValueError("empty or oversized model output")
    try:
        return json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise ValueError("model output was not valid JSON") from exc


def _check_ids(proposal: Proposal, req: ReviewRequest) -> None:
    chapter_ids = {c.id for c in req.chapters}
    lesson_ids = {l.id for c in req.chapters for l in c.lessons}
    got_chapters = [c.id for c in proposal.chapters]
    got_lessons = [l.id for l in proposal.lessons]
    if set(got_chapters) - chapter_ids or set(got_lessons) - lesson_ids:
        raise ValueError("proposal referenced an id that does not exist")
    if len(got_chapters) != len(set(got_chapters)) or len(got_lessons) != len(set(got_lessons)):
        raise ValueError("proposal repeated an id")


def _ask(prompt: str) -> tuple[str, str]:
    try:
        result = ask(AGENT, system_block(REVIEW_SYSTEM), prompt, max_tokens=3000)
    except LLMUnavailableError as exc:
        raise _Unavailable("AI model unavailable") from exc
    except LLMRequestError as exc:
        raise _Unavailable("AI model request failed") from exc
    if isinstance(result, LLMResult):
        return result.text, result.execution_mode
    return str(result), "REAL_APPROVED"


def review_outline(req: ReviewRequest) -> ReviewResponse:
    outline = _outline_text(req)
    repair = ""
    mode = "UNAVAILABLE"
    for attempt in range(2):
        try:
            text, mode = _ask(review_prompt(req.courseTitle, req.language, outline, repair))
        except _Unavailable:
            return ReviewResponse(
                status="unavailable",
                reason="AI review is unavailable right now. The automatic checks still apply.",
                executionMode="UNAVAILABLE",
            )
        try:
            proposal = Proposal.model_validate(_parse(text))
            _check_ids(proposal, req)
            return ReviewResponse(status="proposed", proposal=proposal, executionMode=mode)  # type: ignore[arg-type]
        except (ValueError, ValidationError) as exc:
            logger.warning(
                "course_review_proposal_invalid",
                extra={"attempt": attempt, "reason": str(exc)[:200]},
            )
            repair = (
                f"The previous answer was rejected: {str(exc)[:200]}. "
                "Return one corrected JSON object using only the given ids. No prose."
            )
    return ReviewResponse(
        status="invalid",
        reason="The AI suggestion did not pass validation, so nothing was changed.",
        executionMode="UNAVAILABLE",
    )

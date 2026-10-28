"""FastAPI router for course-grounded tutor Q&A (ED-10)."""

from fastapi import APIRouter, HTTPException
from agents.tutor.grounding import (
    TutorAnswerResult,
    TutorQuestionInput,
    answer_grounded_question,
)
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/tutor", tags=["tutor"])


@router.post("/ask", response_model=TutorAnswerResult)
def ask_tutor(req: TutorQuestionInput) -> TutorAnswerResult:
    """Answer a student's question grounded in the authorized course revision materials."""
    try:
        logger.info(
            "tutor_ask_request",
            extra={"courseId": req.courseId, "revisionId": req.revisionId},
        )
        result = answer_grounded_question(req)
        return result
    except Exception as exc:
        logger.error(
            "tutor_ask_error",
            extra={"error": str(exc), "courseId": req.courseId},
        )
        raise HTTPException(
            status_code=503,
            detail="Tutor grounding unavailable",
        ) from exc

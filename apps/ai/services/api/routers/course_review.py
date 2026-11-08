"""Internal course draft review endpoint.

Instructor authorization and the outline projection are established by the Node
gateway; this service sees only titles, bounded excerpts and objective text.
"""

from fastapi import APIRouter

from agents.course_review.reviewer import review_outline
from agents.course_review.schemas import ReviewRequest, ReviewResponse
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/course-review", tags=["course-review"])


@router.post("/propose", response_model=ReviewResponse)
def propose(req: ReviewRequest) -> ReviewResponse:
    logger.info(
        "course_review_request",
        extra={"chapters": len(req.chapters), "language": req.language},
    )
    return review_outline(req)

"""Internal Visual Learning Lab planning endpoints.

Browser identities and course authorization are established by the Node gateway;
this service receives only an authorized, minimized projection of the concept and
the already-verified source excerpts.
"""

from fastapi import APIRouter, HTTPException

from agents.visual_lab.planner import PlannerUnavailableError, guide_experiment, plan_lab
from agents.visual_lab.schemas import GuideRequest, GuideResponse, PlanRequest, PlanResponse
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/ai/visual-lab", tags=["visual-lab"])


@router.post("/plan", response_model=PlanResponse)
def plan_visual_lab(req: PlanRequest) -> PlanResponse:
    logger.info(
        "visual_lab_plan_request",
        extra={"mode": req.mode, "courseId": req.courseId, "revisionId": req.revisionId},
    )
    try:
        return plan_lab(req)
    except PlannerUnavailableError as exc:
        raise HTTPException(status_code=503, detail="Visual lab planner unavailable") from exc


@router.post("/guide", response_model=GuideResponse)
def guide_visual_lab(req: GuideRequest) -> GuideResponse:
    try:
        return guide_experiment(req)
    except PlannerUnavailableError as exc:
        raise HTTPException(status_code=503, detail="Visual lab guide unavailable") from exc

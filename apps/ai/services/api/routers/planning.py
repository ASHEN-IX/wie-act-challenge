"""Study plan generation endpoints."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.api.deps import get_planner_agent
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class PlannerRequest(BaseModel):
    user_id: str
    goal: str
    available_time_minutes: int
    start_date: Optional[datetime] = None
    course_id: Optional[str] = None
    course_knowledge: Optional[dict] = None
    calendar_events: Optional[list] = (
        []
    )  # User's blocked time slots from Node.js backend


class RecordCompletionRequest(BaseModel):
    user_id: str
    task_id: str
    estimated_minutes: int
    actual_minutes: int
    subject_tag: str = ""


@router.post("/api/ai/planner/create-plan")
async def create_study_plan(request: PlannerRequest):
    """
    Create a personalized study plan by generating tasks.

    This endpoint creates tasks directly instead of a separate study plan concept.
    Tasks are saved to the database and can be accessed via /api/v1/study/tasks

    Args:
        request: PlannerRequest with goal, time, and optional course

    Returns:
        List of generated tasks with metadata
    """
    try:
        from agents.planner.models.task_graph import PlannerInput

        # Node supplies the owner-authorized, minimized source projection.
        # A service credential alone is not a license to resolve arbitrary IDs.
        course_knowledge = request.course_knowledge
        if request.course_id:
            if course_knowledge is None:
                raise HTTPException(status_code=503, detail="Authorized course context unavailable")
            if str(course_knowledge.get("_id", "")) != request.course_id:
                raise HTTPException(status_code=422, detail="Course context mismatch")
        elif course_knowledge is not None:
            raise HTTPException(status_code=422, detail="Course identity required")
        # Create planner input
        if request.start_date:
            deadline_iso = request.start_date.isoformat()
        else:
            deadline_iso = (datetime.now() + timedelta(days=7)).isoformat()

        planner_input = PlannerInput(
            goal=request.goal,
            deadline_iso=deadline_iso,
            available_minutes=request.available_time_minutes,
            user_id=request.user_id,
            course_knowledge=course_knowledge,
        )

        # Generate plan using planner agent
        planner_agent = get_planner_agent()
        plan_output = planner_agent.plan(planner_input)

        # Convert AtomicTasks to Task format for database
        tasks = []
        for atomic_task in plan_output.task_graph.tasks:
            # Map difficulty to priority
            if atomic_task.difficulty < 0.4:
                priority = "low"
            elif atomic_task.difficulty < 0.7:
                priority = "medium"
            else:
                priority = "high"

            task = {
                "title": atomic_task.title,
                "description": atomic_task.description,
                "priority": priority,
                "estimatedTime": atomic_task.estimated_minutes,
                "tags": (
                    [request.goal[:50]] if request.goal else []
                ),  # Use goal as a tag
            }
            tasks.append(task)

        return {
            "success": True,
            "tasks": tasks,
            "count": len(tasks),
            "total_time": sum(t["estimatedTime"] for t in tasks),
            "warning": plan_output.warning if hasattr(plan_output, "warning") else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Study plan creation failed: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail="Failed to create study plan. Please try again later."
        )


@router.get("/api/ai/planner/plans/{user_id}")
async def get_user_plans(user_id: str):
    """Get all study plans for a user."""
    try:
        from agents.planner.rag.prompt_builder import SchedulingService

        scheduling_service = SchedulingService()
        plans = scheduling_service.get_user_plans(user_id)
        return {"plans": plans}
    except Exception as e:
        logger.error("get_user_plans_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to fetch plans. Please try again later.")


@router.post("/api/ai/planner/record-completion")
async def record_task_completion(request: RecordCompletionRequest):
    """
    Record actual vs estimated task completion time to improve future pacing.
    """
    try:
        from agents.planner.memory.pacing_store import PacingStore

        store = PacingStore()
        store.record_task_completion(
            user_id=request.user_id,
            task_id=request.task_id,
            estimated_minutes=request.estimated_minutes,
            actual_minutes=request.actual_minutes,
            subject_tag=request.subject_tag,
        )
        factor = store.get_user_pacing_factor(request.user_id, request.subject_tag)
        return {"status": "ok", "new_pacing_factor": factor}
    except Exception as e:
        logger.error("record_completion_failed", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to record completion. Please try again later.")

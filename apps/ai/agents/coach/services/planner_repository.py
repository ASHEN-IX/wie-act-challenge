"""The learner's scheduled tasks, for the coach prompt.

The schedule itself is AI-owned (`ai.task_scheduling`). Task titles and
difficulty come from the study plan, which the API owns, so they are read
through `services.api_service`. When anything is missing the result is an empty
list — never invented tasks, because these titles go straight into the prompt.
"""

from datetime import datetime
from typing import Any, Dict, Optional

from agents.coach.models.schemas import ScheduledTask
from services import api_service, pg, schedule_store
from utils.logger import get_logger

logger = get_logger(__name__)


def _as_datetime(value: Any) -> datetime:
    return value if isinstance(value, datetime) else datetime.fromisoformat(value)


class PlannerRepository:
    def get_scheduled_tasks(self, user_id: Optional[str] = None) -> list[ScheduledTask]:
        """The user's latest schedule as tasks, or `[]` when there is none.

        Scoped to `user_id` — one learner's schedule never reaches another
        learner's prompt.
        """
        if not user_id or not pg.configured():
            return []
        try:
            with pg.connection() as conn:
                doc = schedule_store.latest(conn, user_id)
            if not doc:
                return []

            tasks_by_id: Dict[str, Dict[str, Any]] = {}
            plans = api_service.planner_plans(user_id) or []
            for plan in plans:
                if str(plan.get("id")) == str(doc.get("study_plan_id")):
                    graph = plan.get("taskGraph") or {}
                    tasks_by_id = {
                        t["id"]: t for t in graph.get("tasks", []) if t.get("id")
                    }
                    break

            tasks = []
            for session in doc.get("sessions", []):
                task_id = session["task_id"]
                info = tasks_by_id.get(task_id, {})
                difficulty = info.get("difficulty")
                tasks.append(
                    ScheduledTask(
                        task_id=task_id,
                        title=info.get("title", task_id),
                        start_time=_as_datetime(session["start_datetime"]),
                        end_time=_as_datetime(session["end_datetime"]),
                        priority=int((difficulty if difficulty is not None else 0.5) * 10),
                    )
                )
            return tasks
        except Exception as exc:
            logger.warning(
                "planner_repository_read_failed", extra={"error_type": type(exc).__name__}
            )
            return []

"""Course context for the coach (F03 / COACH-14).

The catalog and the learner's current task are read **through the Node API**, not
from a database. `courses`, `subjects` and `studysessions` are owned by the API
(PostgreSQL), and it exposes bounded read endpoints on
`/api/v1/study/internal/coach/*` for exactly this purpose.

This replaces the previous direct MongoDB reads. Those returned nothing once the
collections moved to PostgreSQL, so the coach silently lost its grounding; the
API call restores it and keeps the schema in one owner.

What leaves the system is bounded, as before:

- `fetch_catalog` — the user's NEWEST ≤ `COURSE_CATALOG_MAX` (10) courses, each
  reduced to subject title + course title + ≤ `KEY_CONCEPTS_MAX` (15) key
  concepts (flattened from `topics[].subtopics[].key_concepts`). No files, URLs,
  descriptions, ids or any other field reaches the prompt, and those are
  user-supplied content wrapped as UNTRUSTED DATA at prompt-build time
  (COACH-03/12).
- `fetch_current_task` — the live StudySession's in-progress task
  (`taskProgress.tasks[currentTaskIndex]`), mapped to its course subject. This
  is the COACH-14 AC#2 "current task → its course/subject" mapping.

Every read is failure-safe: an API outage yields `[]`/`None` and the orchestrator
degrades to task-title-only context — the coach job never fails.
"""

from typing import Any, Dict, List, Optional

from agents.coach.models.schemas import CourseContext
from services import api_service

COURSE_CATALOG_MAX = 10
KEY_CONCEPTS_MAX = 15
CONCEPT_MAX_CHARS = 100
SUBJECT_MAX_CHARS = 60
TITLE_MAX_CHARS = 100


def _text(value: Any, maximum: int) -> str:
    return value.strip()[:maximum] if isinstance(value, str) else ""


def _concepts(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    out: List[str] = []
    for value in values[:KEY_CONCEPTS_MAX]:
        concept = _text(value, CONCEPT_MAX_CHARS)
        if concept:
            out.append(concept)
    return out


class CourseRepository:
    """Thin, failure-safe wrapper over the API's coach context endpoints."""

    def __init__(self, client: Any = None, db: Any = None):
        # `client`/`db` are accepted for compatibility with callers that used to
        # inject a Mongo handle; they are no longer used.
        del client, db

    def fetch_catalog(self, user_id: str) -> List[CourseContext]:
        """The user's newest ≤ COURSE_CATALOG_MAX courses. Any failure → `[]`."""
        if not user_id:
            return []
        try:
            courses = api_service.coach_catalog(user_id, COURSE_CATALOG_MAX)
        except Exception:
            return []
        if not courses:
            return []

        contexts: List[CourseContext] = []
        for course in courses:
            if not isinstance(course, dict):
                continue
            contexts.append(
                CourseContext(
                    subject=_text(course.get("subject"), SUBJECT_MAX_CHARS) or "Unknown",
                    title=_text(course.get("title"), TITLE_MAX_CHARS),
                    key_concepts=_concepts(course.get("keyConcepts")),
                )
            )
        return contexts

    def fetch_current_task(self, session_id: Optional[str]) -> Optional[Dict[str, Any]]:
        """The session's current task mapped to its course subject.

        Returns `{task_id, title, course_id, subject}` or None when the session
        is unreachable. `title` may be None when the session has no tasks yet —
        the orchestrator then logs task-title-only.
        """
        if not session_id:
            return None
        try:
            task = api_service.coach_current_task(session_id)
        except Exception:
            return None
        if not isinstance(task, dict):
            return None
        return {
            "task_id": task.get("task_id"),
            "title": _text(task.get("title"), 200) or None,
            "course_id": task.get("course_id"),
            "subject": _text(task.get("subject"), SUBJECT_MAX_CHARS) or "Unknown",
        }

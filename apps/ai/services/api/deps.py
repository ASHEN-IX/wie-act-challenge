"""Shared dependencies and lazy-loaded services for API routers."""

import os
import sys
from pathlib import Path

from utils.logger import get_logger

logger = get_logger(__name__)

# Ensure project root is on sys.path
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


# --- Environment validation ---
# Required secrets cause a hard failure (fail-fast): the process cannot boot
# securely without them, so log an error and exit. Optional secrets only log a
# warning so the service can still start for features that do not need them.
_REQUIRED_ENV: list[str] = []
_OPTIONAL_ENV: list[str] = ["GEMINI_API_KEY", "APIFY_API_KEY", "HF_API_KEY"]
for _key in _REQUIRED_ENV:
    if not os.getenv(_key):
        logger.error(
            "missing_required_env_var",
            extra={
                "var": _key,
                "hint": "Set this environment variable before starting the service",
            },
        )
        sys.exit(1)
for _key in _OPTIONAL_ENV:
    if not os.getenv(_key):
        logger.warning(
            "missing_optional_env_var",
            extra={
                "var": _key,
                "hint": "Features that use this key will fail at runtime",
            },
        )


# Per-user timing gate for analyze-frame endpoint
_frame_last_request: dict[str, float] = {}

# --- Lazy-loaded services ---

_planner_agent = None
_ai_orchestrator = None
_schedule_orchestrator = None
_signal_service = None


def get_planner_agent():
    global _planner_agent
    if _planner_agent is None:
        from agents.planner.agent import PlannerAgent

        _planner_agent = PlannerAgent()
    return _planner_agent


def get_ai_orchestrator():
    global _ai_orchestrator
    if _ai_orchestrator is None:
        from services.ai_orchestrator.orchestrator import AIOrchestrator

        _ai_orchestrator = AIOrchestrator()
    return _ai_orchestrator


def get_schedule_orchestrator():
    global _schedule_orchestrator
    if _schedule_orchestrator is None:
        from services.schedule_orchestrator.orchestrator import ScheduleOrchestrator

        _schedule_orchestrator = ScheduleOrchestrator()
    return _schedule_orchestrator


def get_focus_detector():
    from services.signal_processing_service.focus_detector import get_focus_detector as _impl

    return _impl()


def get_fatigue_detector(user_id=None):
    from services.signal_processing_service.fatigue_detector import get_fatigue_detector as _impl

    return _impl(user_id)


def get_signal_service():
    """Lazy-load the SignalProcessingService to avoid startup crashes."""
    global _signal_service
    if _signal_service is None:
        try:
            from services.signal_processing_service.service import (
                SignalProcessingService,
            )

            _signal_service = SignalProcessingService()
            logger.info(
                "SignalProcessingService initialised (ready=%s)",
                _signal_service.is_ready(),
            )
        except Exception as e:
            logger.warning("SignalProcessingService unavailable: %s", e)
            _signal_service = False  # sentinel: attempted and failed
    return _signal_service if _signal_service is not False else None

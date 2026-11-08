"""FastAPI service for AI features: course ingestion, planning, coaching, and signals.

This service provides RESTful endpoints for the frontend to interact with all AI agents.
"""

from fastapi import FastAPI, Depends
from services.api.security import require_service
from fastapi.middleware.cors import CORSMiddleware

from services.api.routers.ingestion import router as ingestion_router
from services.api.routers.planning import router as planning_router
from services.api.routers.coaching import router as coaching_router
from services.api.routers.signals import router as signals_router
from services.api.routers.search import router as search_router
from services.api.routers.reflection import router as reflection_router
from services.api.routers.schedule import router as schedule_router
from services.api.routers.facilitator import router as facilitator_router
from services.api.routers.provider import router as provider_router
from services.api.routers.tutor import router as tutor_router
from services.api.routers.sources import router as sources_router
from services.api.routers.formula_recognition import router as formula_recognition_router
from services.api.routers.visual_lab import router as visual_lab_router
from services.api.routers.course_review import router as course_review_router
from services.api.routers.nardouch import router as nardouch_router
from services.api.routers.experience_planner import router as experience_planner_router
from utils.llm_client import get_provider_status

app = FastAPI(title="EdNova AI API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
for router in (
    ingestion_router,
    planning_router,
    coaching_router,
    signals_router,
    search_router,
    reflection_router,
    schedule_router,
    facilitator_router,
    provider_router,
    tutor_router,
    sources_router,
    formula_recognition_router,
    visual_lab_router,
    course_review_router,
    nardouch_router,
    experience_planner_router,
):
    app.include_router(router, dependencies=[Depends(require_service)])


# ==================== Health Check ====================


@app.get("/health")
async def health_check():
    """Health check endpoint - fast response for docker healthcheck.

    Does NOT initialize services to avoid timeouts during startup.
    Services are lazy-loaded on first actual request.
    """
    return {"status": "healthy"}


@app.get("/provider/status")
async def public_provider_status():
    """Unauthenticated provider health/status endpoint for monitoring and preflight."""
    return get_provider_status()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

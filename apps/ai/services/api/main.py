"""FastAPI service for AI features: course ingestion, planning, coaching, and signals.

This service provides RESTful endpoints for the frontend to interact with all AI agents.
"""

import sys
from pathlib import Path

from fastapi import FastAPI, Depends
from services.api.security import require_service
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent))

from routers.ingestion import router as ingestion_router
from routers.planning import router as planning_router
from routers.coaching import router as coaching_router
from routers.signals import router as signals_router
from routers.search import router as search_router
from routers.reflection import router as reflection_router
from routers.schedule import router as schedule_router

app = FastAPI(title="Study Partner AI API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
for router in (ingestion_router, planning_router, coaching_router, signals_router,
               search_router, reflection_router, schedule_router):
    app.include_router(router, dependencies=[Depends(require_service)])


# ==================== Health Check ====================


@app.get("/health")
async def health_check():
    """Health check endpoint - fast response for docker healthcheck.
    
    Does NOT initialize services to avoid timeouts during startup.
    Services are lazy-loaded on first actual request.
    """
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

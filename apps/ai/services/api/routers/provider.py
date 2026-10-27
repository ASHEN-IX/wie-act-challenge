"""Provider execution mode and capability reporting (ED-03)."""
from typing import Any, Dict
from fastapi import APIRouter

from utils.llm_client import get_provider_status

router = APIRouter(prefix="/api/ai/provider", tags=["provider"])


@router.get("/status", response_model=Dict[str, Any])
async def provider_status() -> Dict[str, Any]:
    """Return sanitized AI provider status, model tiers, and execution mode."""
    return get_provider_status()

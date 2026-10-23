"""Facilitator API router for ED-09 (Collaborative Peer-First Facilitator).

Provides RESTful endpoints for the backend to request pedagogical facilitation
and handle explicit learner actions (hints, questions, phase checks).
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorInterventionProposal,
    FacilitatorStrategy,
    FacilitatorTrigger,
    ParticipantSnapshot,
    DialogueTurn,
)
from agents.facilitator.agent import run_facilitator
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class FacilitatorActionRequest(BaseModel):
    """Explicit learner action directed at the facilitator."""
    roomId: str
    actionType: str  # ask_facilitator | request_hint | phase_transition | decline_prompt
    userId: Optional[str] = ""
    userName: Optional[str] = "Student"
    promptText: Optional[str] = ""
    hintLevel: int = 1
    currentPhase: str = "peer_discussion"
    activeActivityId: Optional[str] = None
    learningContext: Optional[Dict[str, Any]] = None
    participants: List[ParticipantSnapshot] = Field(default_factory=list)
    recentDialogue: List[DialogueTurn] = Field(default_factory=list)


@router.post("/api/ai/facilitator/observe", response_model=FacilitatorInterventionProposal)
async def observe_dialogue(obs: FacilitatorObservationInput):
    """
    Ingests dialogue turns or group events and evaluates whether an educational
    facilitation intervention should be triggered according to peer-first policies.
    """
    try:
        logger.info("facilitator_observe_request", extra={"roomId": obs.roomId, "actionType": obs.actionType})
        proposal = run_facilitator(obs)
        return proposal
    except Exception as e:
        logger.error("facilitator_observe_error", extra={"error": str(e), "roomId": obs.roomId})
        raise HTTPException(status_code=500, detail=f"Facilitator evaluation failed: {str(e)}")


@router.post("/api/ai/facilitator/action", response_model=FacilitatorInterventionProposal)
async def handle_facilitator_action(req: FacilitatorActionRequest):
    """
    Handles explicit learner interactions such as:
    - ask_facilitator: Asking a question directly
    - request_hint: Graduated conceptual hint request
    - phase_transition: Checking readiness / consensus to change phase
    - decline_prompt: Quiet learner politely declining a prompt
    """
    try:
        if req.actionType == "decline_prompt":
            logger.info("facilitator_prompt_declined", extra={"roomId": req.roomId, "userId": req.userId})
            return FacilitatorInterventionProposal(
                interventionId=f"dec_{req.roomId}",
                roomId=req.roomId,
                strategy=FacilitatorStrategy.INCLUSIVE_INVITATION,
                trigger=FacilitatorTrigger.EXPLICIT_ASK,
                targetSpeakerId=req.userId,
                targetSpeakerName=req.userName,
                reasoning="Learner opted out of facilitator intervention (honoring quiet learner agency).",
                messageText="",
                shouldIntervene=False,
                cooldownSeconds=30,
            )

        obs = FacilitatorObservationInput(
            roomId=req.roomId,
            speakerUserId=req.userId,
            speakerName=req.userName,
            transcriptText=req.promptText or "",
            actionType=req.actionType,
            currentPhase=req.currentPhase,
            activeActivityId=req.activeActivityId,
            learningContext=req.learningContext or {},
            participants=req.participants,
            recentDialogue=req.recentDialogue,
            hintLevel=req.hintLevel,
        )

        proposal = run_facilitator(obs)
        return proposal
    except Exception as e:
        logger.error("facilitator_action_error", extra={"error": str(e), "roomId": req.roomId})
        raise HTTPException(status_code=500, detail=f"Facilitator action processing failed: {str(e)}")


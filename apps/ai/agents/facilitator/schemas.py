"""Pydantic schemas for the Facilitator Agent (Contracts 14, 15, 16)."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FacilitatorStrategy(str, Enum):
    PEER_CHALLENGE = "PEER_CHALLENGE"
    SOCRATIC_NUDGE = "SOCRATIC_NUDGE"
    CONCEPT_PROMPT = "CONCEPT_PROMPT"
    INCLUSIVE_INVITATION = "INCLUSIVE_INVITATION"
    CONSENSUS_CHECK = "CONSENSUS_CHECK"
    DISAGREEMENT_RESOLUTION = "DISAGREEMENT_RESOLUTION"


class FacilitatorTrigger(str, Enum):
    EXPLICIT_ASK = "explicit_ask"
    REQUEST_HINT = "request_hint"
    MISCONCEPTION_DETECTED = "misconception_detected"
    CONFUSION_SIGNAL = "confusion_signal"
    PHASE_TRANSITION = "phase_transition"
    CONSENSUS_CHECK = "consensus_check"


class DialogueTurn(BaseModel):
    speaker: str
    text: str
    userId: Optional[str] = None


class ParticipantSnapshot(BaseModel):
    userId: str
    name: str
    role: str = "participant"
    hasSubmitted: bool = False
    isSpeaking: bool = False
    isOnline: bool = True


class FacilitatorObservationInput(BaseModel):
    """Contract 14: Telemetry and dialogue input for facilitator reasoning."""

    roomId: str
    speakerUserId: Optional[str] = ""
    speakerName: Optional[str] = "Student"
    transcriptText: str = ""
    actionType: str = "statement"  # statement | ask_facilitator | request_hint | phase_transition
    currentPhase: str = "peer_discussion"
    activeActivityId: Optional[str] = None
    learningContext: Optional[Dict[str, Any]] = None  # currentTopic, targetObjective, courseTitle
    recentDialogue: List[DialogueTurn] = Field(default_factory=list)
    participants: List[ParticipantSnapshot] = Field(default_factory=list)
    hintLevel: int = 1


class ProposedUICommand(BaseModel):
    """Contract 16: Proposed UI updates (must be authorized by control plane)."""

    action: str  # DISPLAY_ACTIVITY | ADVANCE_PHASE | HIGHLIGHT_SOURCE
    activityId: Optional[str] = None
    targetPhase: Optional[str] = None
    reason: str


class FacilitatorInterventionProposal(BaseModel):
    """Contract 15: Output proposal for peer-first facilitation."""

    interventionId: str
    executionMode: str = "DETERMINISTIC_FALLBACK"
    roomId: str
    strategy: FacilitatorStrategy
    trigger: FacilitatorTrigger
    targetSpeakerId: Optional[str] = None
    targetSpeakerName: Optional[str] = None
    reasoning: str
    messageText: str
    proposedUICommand: Optional[ProposedUICommand] = None
    cooldownSeconds: int = 15
    shouldIntervene: bool = True


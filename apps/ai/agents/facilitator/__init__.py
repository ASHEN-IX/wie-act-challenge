"""Pedagogical AI Facilitator Agent for Collaborative Study Rooms (ED-09).

Implements Peer-First Facilitation Guardrails:
- Detects student misconceptions and prompts peers to reason together rather than offering direct answers.
- Offers progressive Socratic nudges.
- Handles explicit facilitator triggers (ask_facilitator, request_hint, phase_check).
- Respects learner agency (allows voluntary participation / decline).
"""

from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorInterventionProposal,
    FacilitatorStrategy,
)
from agents.facilitator.agent import run_facilitator

__all__ = [
    "FacilitatorObservationInput",
    "FacilitatorInterventionProposal",
    "FacilitatorStrategy",
    "run_facilitator",
]


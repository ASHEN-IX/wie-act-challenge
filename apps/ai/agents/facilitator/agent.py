"""Main entry point for the Pedagogical Facilitator Agent (ED-09)."""

import json
import uuid
from typing import Optional
from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorInterventionProposal,
    FacilitatorStrategy,
    FacilitatorTrigger,
)
from agents.facilitator.policy import evaluate_rules
from agents.facilitator.prompts import build_facilitator_prompt, FACILITATOR_SYSTEM_PROMPT
from utils.logger import get_logger

logger = get_logger(__name__)


def run_facilitator(
    obs: FacilitatorObservationInput,
    trace_id: str = "",
) -> FacilitatorInterventionProposal:
    """
    Evaluates room dialogue or an explicit action and produces an educational intervention.

    Guarantees:
    - Never exposes direct answers to problems.
    - Prompts peers to reason collaboratively.
    - Honors quiet learner agency.
    - Operates reliably even if external LLMs are degraded or unavailable.
    """
    logger.info(
        "facilitator_run_start",
        extra={
            "roomId": obs.roomId,
            "speaker": obs.speakerName,
            "actionType": obs.actionType,
            "trace_id": trace_id,
        },
    )

    # Step 1: Rule-based evaluation (hard guards & deterministic misconception checks)
    rule_intervention = evaluate_rules(obs)
    if rule_intervention is not None:
        logger.info(
            "facilitator_rule_fired",
            extra={
                "strategy": rule_intervention.strategy.value,
                "reasoning": rule_intervention.reasoning,
                "trace_id": trace_id,
            },
        )
        return rule_intervention

    # If this was an explicit question to the facilitator but no hard rule matched:
    if obs.actionType in ("ask_facilitator", "request_hint") or len(obs.transcriptText.strip()) > 10:
        # Step 2: Try LLM decision with fallback
        try:
            from utils.llm_client import ask

            peers_data = [p.model_dump() if hasattr(p, "model_dump") else p.dict() for p in obs.participants]
            dialogue_data = [d.model_dump() if hasattr(d, "model_dump") else d.dict() for d in obs.recentDialogue]

            user_prompt = build_facilitator_prompt(
                transcript=obs.transcriptText,
                speaker_name=obs.speakerName or "Student",
                action_type=obs.actionType,
                current_phase=obs.currentPhase,
                learning_context=obs.learningContext or {},
                recent_dialogue=dialogue_data,
                peers=peers_data,
                hint_level=obs.hintLevel,
            )

            response = ask(
                "facilitator",  # capable tier: weighs several learners' dialogue
                FACILITATOR_SYSTEM_PROMPT,
                user_prompt,
                mock_fn=lambda _: _generate_mock_response(obs),
                trace_id=trace_id,
            )

            parsed = _parse_llm_json(response)
            if parsed and parsed.get("shouldIntervene", True):
                strategy_val = parsed.get("strategy", "PEER_CHALLENGE")
                try:
                    strategy = FacilitatorStrategy(strategy_val)
                except ValueError:
                    strategy = FacilitatorStrategy.SOCRATIC_NUDGE

                chosen_target = parsed.get("targetSpeakerName")
                target_peer = next((p for p in obs.participants if p.name == chosen_target), None)

                return FacilitatorInterventionProposal(
                    interventionId=f"int_{uuid.uuid4().hex[:12]}",
                    roomId=obs.roomId,
                    strategy=strategy,
                    trigger=FacilitatorTrigger.EXPLICIT_ASK if obs.actionType == "ask_facilitator" else FacilitatorTrigger.MISCONCEPTION_DETECTED,
                    targetSpeakerId=target_peer.userId if target_peer else None,
                    targetSpeakerName=chosen_target,
                    reasoning=parsed.get("reasoning", "Fostering peer collaborative reasoning."),
                    messageText=parsed.get("messageText", _generate_mock_response(obs)),
                    cooldownSeconds=15,
                    shouldIntervene=True,
                )
        except Exception as err:
            logger.warning(
                "facilitator_llm_fallback",
                extra={"error": str(err), "trace_id": trace_id},
            )

    # Step 3: Default graceful response for explicit requests when LLM didn't return
    if obs.actionType in ("ask_facilitator", "request_hint"):
        peers = [p for p in obs.participants if p.name and p.name != obs.speakerName]
        peer_name = peers[0].name if peers else "your peers"
        return FacilitatorInterventionProposal(
            interventionId=f"int_{uuid.uuid4().hex[:12]}",
            roomId=obs.roomId,
            strategy=FacilitatorStrategy.SOCRATIC_NUDGE,
            trigger=FacilitatorTrigger.EXPLICIT_ASK,
            targetSpeakerId=peers[0].userId if peers else None,
            targetSpeakerName=peer_name,
            reasoning="Default Socratic deflection promoting peer reasoning.",
            messageText=f"That's an interesting question. {peer_name}, how would you approach this problem using the concepts covered so far?",
            cooldownSeconds=15,
            shouldIntervene=True,
        )

    # If casual conversation and no rule matched, do not intervene
    return FacilitatorInterventionProposal(
        interventionId=f"int_{uuid.uuid4().hex[:12]}",
        roomId=obs.roomId,
        strategy=FacilitatorStrategy.SOCRATIC_NUDGE,
        trigger=FacilitatorTrigger.MISCONCEPTION_DETECTED,
        reasoning="No intervention warranted for casual dialogue.",
        messageText="",
        shouldIntervene=False,
    )


def _generate_mock_response(obs: FacilitatorObservationInput) -> str:
    peers = [p for p in obs.participants if p.name and p.name != obs.speakerName]
    peer_name = peers[0].name if peers else "your peers"
    return f"{peer_name}, {obs.speakerName} raised an important question. What key concept from the lesson helps clarify this?"


def _parse_llm_json(raw: str) -> Optional[dict]:
    try:
        # Strip code markdown fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            if text.endswith("```"):
                text = text.rsplit("```", 1)[0]
        return json.loads(text.strip())
    except Exception:
        return None

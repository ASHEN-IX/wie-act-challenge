"""Rule-based decision logic and pedagogical safety policies for the Facilitator Agent (ED-09)."""

import re
import uuid
from typing import Optional
from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorInterventionProposal,
    FacilitatorStrategy,
    FacilitatorTrigger,
)

# Common pedagogical misconception patterns
KNOWN_MISCONCEPTIONS = [
    {
        "pattern": r"(1nf|first normal form).*unique.*(key|id)|(unique.*(key|id).*(1nf|first normal form))",
        "topic": "Database Normalization (1NF)",
        "flaw": "Confusing 1NF (atomic values) with entity integrity (primary key uniqueness).",
        "peer_prompt": "{peer}, {speaker} suggested that having a unique primary key is sufficient for 1NF. Looking at the definition of atomicity, what do you think?",
    },
    {
        "pattern": r"(comma.*separated|list.*inside.*column|multiple.*values.*one.*(field|column|cell))",
        "topic": "Database Normalization (1NF)",
        "flaw": "Believing multi-valued attributes or lists are permitted in a relational column.",
        "peer_prompt": "{peer}, {speaker} mentioned storing multiple values in a single column. How does 1NF address repeating groups or non-atomic values?",
    },
    {
        "pattern": r"(binary search.*unsorted|unsorted.*binary search)",
        "topic": "Algorithms (Binary Search)",
        "flaw": "Assuming binary search operates on unsorted collections without prerequisite ordering.",
        "peer_prompt": "{peer}, {speaker} considered running binary search on unsorted data. What precondition must hold before binary search can eliminate half the search space?",
    },
]

# Direct answer requests that must be deflected to Socratic peer reasoning
DIRECT_ANSWER_PATTERNS = [
    r"what('s| is) the (exact )?answer",
    r"give me the (solution|answer|result)",
    r"just tell (me|us) the answer",
    r"what should (i|we) (pick|choose|select)",
    r"is it (a|b|c|d)\?",
]


def evaluate_rules(obs: FacilitatorObservationInput) -> Optional[FacilitatorInterventionProposal]:
    """
    Applies deterministic pedagogical rules before or in absence of LLM inference.
    Guarantees that direct answers are forbidden and peer-first facilitation is enforced.
    """
    text = (obs.transcriptText or "").strip().lower()
    peers = [p for p in obs.participants if p.name and p.name != obs.speakerName]
    chosen_peer = peers[0] if peers else None
    peer_name = chosen_peer.name if chosen_peer else "your peers"
    peer_id = chosen_peer.userId if chosen_peer else None

    # 1. Deflect direct answer requests
    for pattern in DIRECT_ANSWER_PATTERNS:
        if re.search(pattern, text):
            return FacilitatorInterventionProposal(
                interventionId=f"int_{uuid.uuid4().hex[:12]}",
                roomId=obs.roomId,
                strategy=FacilitatorStrategy.SOCRATIC_NUDGE,
                trigger=FacilitatorTrigger.EXPLICIT_ASK,
                targetSpeakerId=obs.speakerUserId,
                targetSpeakerName=obs.speakerName,
                reasoning="Student asked for a direct answer; deflecting to peer reasoning and fundamental principles.",
                messageText=f"I cannot provide the direct answer because working through the reasoning together is where real learning happens. {peer_name}, how would you break down the problem statement?",
                cooldownSeconds=15,
                shouldIntervene=True,
            )

    # 2. Detect explicit known misconceptions
    for item in KNOWN_MISCONCEPTIONS:
        if re.search(item["pattern"], text, re.IGNORECASE):
            prompt_text = item["peer_prompt"].format(
                peer=peer_name,
                speaker=obs.speakerName or "your peer"
            )
            return FacilitatorInterventionProposal(
                interventionId=f"int_{uuid.uuid4().hex[:12]}",
                roomId=obs.roomId,
                strategy=FacilitatorStrategy.PEER_CHALLENGE,
                trigger=FacilitatorTrigger.MISCONCEPTION_DETECTED,
                targetSpeakerId=peer_id,
                targetSpeakerName=peer_name,
                reasoning=item["flaw"],
                messageText=prompt_text,
                cooldownSeconds=15,
                shouldIntervene=True,
            )

    # 2b. Learner signalled they are stuck (tentative): peers reason first, no explanation
    confusion = (obs.learningContext or {}).get("confusion") or {}
    if obs.actionType == "statement" and confusion.get("tentative"):
        reasons = ", ".join(str(r) for r in confusion.get("reasons", []))
        return FacilitatorInterventionProposal(
            interventionId=f"int_{uuid.uuid4().hex[:12]}",
            roomId=obs.roomId,
            strategy=FacilitatorStrategy.PEER_CHALLENGE,
            trigger=FacilitatorTrigger.CONFUSION_SIGNAL,
            targetSpeakerId=peer_id,
            targetSpeakerName=peer_name,
            reasoning=f"Tentative confusion signal ({reasons}): peer-first reasoning before explanation.",
            messageText=f"{obs.speakerName or 'A teammate'} may be stuck on this step. {peer_name}, how would you approach it from first principles?",
            cooldownSeconds=15,
            shouldIntervene=True,
        )

    # 3. Handle explicit hint requests
    if obs.actionType == "request_hint":
        hint_text = (
            f"{peer_name}, let's look at the foundational rule on screen together. What is the key invariant we need to verify first?"
            if obs.hintLevel == 1
            else f"Hint: Consider whether each attribute holds atomic, indivisible values. {peer_name}, what does your teammate's example show?"
        )
        return FacilitatorInterventionProposal(
            interventionId=f"int_{uuid.uuid4().hex[:12]}",
            roomId=obs.roomId,
            strategy=FacilitatorStrategy.SOCRATIC_NUDGE,
            trigger=FacilitatorTrigger.REQUEST_HINT,
            targetSpeakerId=obs.speakerUserId,
            targetSpeakerName=obs.speakerName,
            reasoning=f"Provided graduated Socratic hint Level {obs.hintLevel}.",
            messageText=hint_text,
            cooldownSeconds=10,
            shouldIntervene=True,
        )

    # 4. Handle consensus checks (e.g. moving from discussion to attempt)
    if obs.actionType == "phase_transition" and obs.currentPhase == "peer_discussion":
        return FacilitatorInterventionProposal(
            interventionId=f"int_{uuid.uuid4().hex[:12]}",
            roomId=obs.roomId,
            strategy=FacilitatorStrategy.CONSENSUS_CHECK,
            trigger=FacilitatorTrigger.PHASE_TRANSITION,
            targetSpeakerId=None,
            targetSpeakerName=None,
            reasoning="Validating team consensus before advancing to individual practice.",
            messageText="Before opening individual practice, does everyone in the group feel comfortable with the core concept discussed?",
            cooldownSeconds=15,
            shouldIntervene=True,
        )

    return None


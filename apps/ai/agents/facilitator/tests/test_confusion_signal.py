"""P0-6: a tentative confusion signal routes a statement to peer-first help."""

import unittest

from agents.facilitator.policy import evaluate_rules
from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorStrategy,
    FacilitatorTrigger,
    ParticipantSnapshot,
)

PARTICIPANTS = [
    ParticipantSnapshot(userId="learner-1", name="Amina"),
    ParticipantSnapshot(userId="peer-1", name="Youssef"),
]
STUCK = {"tentative": True, "reasons": ["help_requested"]}


def observation(text, action="statement", confusion=None):
    context = {"courseId": "course-1", "title": "Databases"}
    if confusion is not None:
        context["confusion"] = confusion
    return FacilitatorObservationInput(
        roomId="room-1",
        speakerUserId="learner-1",
        speakerName="Amina",
        transcriptText=text,
        actionType=action,
        learningContext=context,
        participants=PARTICIPANTS,
    )


class ConfusionSignalRuleTests(unittest.TestCase):
    def test_tentative_signal_routes_statement_to_peer_first_help(self):
        proposal = evaluate_rules(observation("I am lost on this step", confusion=STUCK))
        self.assertIsNotNone(proposal)
        self.assertEqual(proposal.strategy, FacilitatorStrategy.PEER_CHALLENGE)
        self.assertEqual(proposal.trigger, FacilitatorTrigger.CONFUSION_SIGNAL)
        self.assertEqual(proposal.targetSpeakerId, "peer-1")
        self.assertIn("Youssef", proposal.messageText)
        self.assertIn("help_requested", proposal.reasoning)

    def test_no_signal_leaves_routine_statements_alone(self):
        self.assertIsNone(evaluate_rules(observation("The key should be the student id")))
        self.assertIsNone(
            evaluate_rules(observation("The key should be the student id", confusion={"tentative": False, "reasons": []}))
        )

    def test_direct_answer_requests_are_still_deflected_first(self):
        proposal = evaluate_rules(
            observation("just give me the answer, I am stuck", action="ask_facilitator", confusion=STUCK)
        )
        self.assertEqual(proposal.trigger, FacilitatorTrigger.EXPLICIT_ASK)

    def test_known_misconceptions_are_still_flagged_first(self):
        proposal = evaluate_rules(
            observation(
                "I think 1NF is satisfied once a unique key exists, I am lost",
                confusion=STUCK,
            )
        )
        self.assertEqual(proposal.trigger, FacilitatorTrigger.MISCONCEPTION_DETECTED)

    def test_hint_requests_keep_the_graduated_hint_path(self):
        proposal = evaluate_rules(observation("", action="request_hint", confusion=STUCK))
        self.assertEqual(proposal.trigger, FacilitatorTrigger.REQUEST_HINT)


if __name__ == "__main__":
    unittest.main()

"""Unit tests for the Facilitator Agent (ED-09)."""

import unittest
from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    ParticipantSnapshot,
    FacilitatorStrategy,
    FacilitatorTrigger,
)
from agents.facilitator.agent import run_facilitator


class TestFacilitatorAgent(unittest.TestCase):
    def setUp(self):
        self.sample_participants = [
            ParticipantSnapshot(userId="usr_111", name="Habib", isOnline=True),
            ParticipantSnapshot(userId="usr_222", name="Tasnim", isOnline=True),
            ParticipantSnapshot(userId="usr_333", name="QuietLearner", isOnline=True),
        ]

    def test_direct_answer_request_is_deflected_to_peer(self):
        """Pedagogical Rule 1: Direct answer requests are forbidden and deflected to peers."""
        obs = FacilitatorObservationInput(
            roomId="room_test_01",
            speakerUserId="usr_222",
            speakerName="Tasnim",
            transcriptText="Can you just give me the answer to question 2?",
            actionType="ask_facilitator",
            currentPhase="peer_discussion",
            participants=self.sample_participants,
        )

        intervention = run_facilitator(obs)

        self.assertTrue(intervention.shouldIntervene)
        self.assertEqual(intervention.strategy, FacilitatorStrategy.SOCRATIC_NUDGE)
        # Must NOT contain a solution or direct answer
        self.assertTrue("answer" not in intervention.messageText.lower() or "cannot provide the direct answer" in intervention.messageText.lower())
        # Must prompt peer to reason
        self.assertTrue("Habib" in intervention.messageText or "break down" in intervention.messageText)

    def test_misconception_triggers_peer_challenge(self):
        """Pedagogical Rule 2: A misconception triggers a PEER_CHALLENGE targeting another student."""
        obs = FacilitatorObservationInput(
            roomId="room_test_01",
            speakerUserId="usr_222",
            speakerName="Tasnim",
            transcriptText="I think a table is in 1NF as long as every student has a unique primary key ID.",
            actionType="statement",
            currentPhase="peer_discussion",
            participants=self.sample_participants,
        )

        intervention = run_facilitator(obs)

        self.assertTrue(intervention.shouldIntervene)
        self.assertEqual(intervention.strategy, FacilitatorStrategy.PEER_CHALLENGE)
        self.assertEqual(intervention.trigger, FacilitatorTrigger.MISCONCEPTION_DETECTED)
        self.assertEqual(intervention.targetSpeakerName, "Habib")
        self.assertIn("Habib", intervention.messageText)
        self.assertIn("Tasnim", intervention.messageText)
        self.assertIn("atomicity", intervention.messageText.lower())

    def test_graduated_hint_request(self):
        """Pedagogical Rule 3: a hint refers to the current course activity."""
        obs = FacilitatorObservationInput(
            roomId="room_test_01",
            speakerUserId="usr_111",
            speakerName="Habib",
            transcriptText="We are stuck on this problem.",
            actionType="request_hint",
            hintLevel=2,
            currentPhase="peer_discussion",
            participants=self.sample_participants,
            learningContext={"courseId": "physics", "activityTitle": "Heat transfer"},
        )

        intervention = run_facilitator(obs)

        self.assertTrue(intervention.shouldIntervene)
        self.assertEqual(intervention.strategy, FacilitatorStrategy.SOCRATIC_NUDGE)
        self.assertEqual(intervention.trigger, FacilitatorTrigger.REQUEST_HINT)
        self.assertIn("Level 2", intervention.messageText)
        self.assertIn("Heat transfer", intervention.messageText)
        self.assertIn("course material", intervention.messageText)

    def test_phase_transition_consensus_check(self):
        """Pedagogical Rule 4: Phase advancement prompts team consensus check."""
        obs = FacilitatorObservationInput(
            roomId="room_test_01",
            speakerUserId="usr_111",
            speakerName="Habib",
            transcriptText="Ready to move on?",
            actionType="phase_transition",
            currentPhase="peer_discussion",
            participants=self.sample_participants,
        )

        intervention = run_facilitator(obs)

        self.assertTrue(intervention.shouldIntervene)
        self.assertEqual(intervention.strategy, FacilitatorStrategy.CONSENSUS_CHECK)
        self.assertIn("consensus", intervention.reasoning.lower())

    def test_casual_chat_does_not_intervene(self):
        """Casual chit-chat without pedagogical relevance must not spam the room."""
        obs = FacilitatorObservationInput(
            roomId="room_test_01",
            speakerUserId="usr_111",
            speakerName="Habib",
            transcriptText="Hello everyone, good morning!",
            actionType="statement",
            currentPhase="peer_discussion",
            participants=self.sample_participants,
        )

        intervention = run_facilitator(obs)
        self.assertFalse(intervention.shouldIntervene)


if __name__ == "__main__":
    unittest.main()



def test_model_execution_mode_is_returned(monkeypatch):
    from types import SimpleNamespace
    from agents.facilitator import agent
    from utils import llm_client

    monkeypatch.setattr(agent, "evaluate_rules", lambda _: None)
    monkeypatch.setattr(
        llm_client,
        "ask",
        lambda *args, **kwargs: SimpleNamespace(
            text='{"shouldIntervene": true, "strategy": "SOCRATIC_NUDGE", "messageText": "What would your peer try?"}',
            execution_mode="REAL_APPROVED",
        ),
    )
    result = run_facilitator(FacilitatorObservationInput(
        roomId="room", actionType="ask_facilitator", transcriptText="How should we start?"
    ))
    assert result.executionMode == "REAL_APPROVED"
    assert result.messageText == "What would your peer try?"

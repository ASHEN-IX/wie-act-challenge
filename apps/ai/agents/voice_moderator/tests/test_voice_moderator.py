"""Tests for Voice Moderator Agent (ED-17, ED-25)."""

import time
import pytest
from agents.voice_moderator.agent import VoiceModeratorAgent
from agents.facilitator.schemas import FacilitatorStrategy


def test_voice_moderator_drops_non_consented_audio():
    agent = VoiceModeratorAgent(room_id="room_test_123")
    agent.register_participant(user_id="usr_no_consent", name="Alice", has_voice_consent=False)

    fake_pcm = b"\x00\x01" * 100
    res = agent.process_audio_chunk(
        speaker_id="usr_no_consent",
        speaker_name="Alice",
        pcm_bytes=fake_pcm,
        is_speech=True,
    )
    assert res is None
    # Buffer must remain empty because consent is false
    assert agent.has_active_audio_retention() is False


def test_voice_moderator_processes_consented_speech_and_wipes_buffer():
    agent = VoiceModeratorAgent(room_id="room_test_456", vad_threshold_ms=10)
    agent.register_participant(user_id="usr_consented", name="Bob", has_voice_consent=True)
    agent.register_participant(user_id="usr_peer", name="Charlie", has_voice_consent=True)

    fake_pcm = b"\x02\x03" * 50
    # Stream active speech chunk
    res = agent.process_audio_chunk(
        speaker_id="usr_consented",
        speaker_name="Bob",
        pcm_bytes=fake_pcm,
        is_speech=True,
    )
    assert res is None
    assert agent.has_active_audio_retention() is True

    # Wait past VAD threshold
    time.sleep(0.02)

    # Deliver silence (end of turn) with misconception transcript
    res2 = agent.process_audio_chunk(
        speaker_id="usr_consented",
        speaker_name="Bob",
        pcm_bytes=b"",
        is_speech=False,
        transcription_override="I think having a unique key is enough for 1nf normalization.",
    )

    assert res2 is not None
    assert res2.strategy == FacilitatorStrategy.PEER_CHALLENGE
    assert "Charlie" in res2.messageText  # Addresses peer, not direct answer
    # Verify zero audio retention: buffer cleared completely after turn
    assert agent.has_active_audio_retention() is False


def test_consent_revocation_wipes_active_buffer():
    agent = VoiceModeratorAgent(room_id="room_test_789")
    agent.register_participant(user_id="usr_active", name="Dave", has_voice_consent=True)

    fake_pcm = b"\x05\x06" * 50
    agent.process_audio_chunk(
        speaker_id="usr_active",
        speaker_name="Dave",
        pcm_bytes=fake_pcm,
        is_speech=True,
    )
    assert agent.has_active_audio_retention() is True

    # User revokes consent mid-session
    agent.set_participant_consent("usr_active", False)
    assert agent.has_active_audio_retention() is False


def test_voice_moderator_latency_below_1500ms():
    """ED-25-A005: Actual speech-pause to response-onset latency is below 1500 ms."""
    agent = VoiceModeratorAgent(room_id="room_latency_test", vad_threshold_ms=10)
    agent.register_participant(user_id="usr_spk", name="Amina", has_voice_consent=True)
    agent.register_participant(user_id="usr_peer", name="Karim", has_voice_consent=True)

    agent.process_audio_chunk(
        speaker_id="usr_spk",
        speaker_name="Amina",
        pcm_bytes=b"\x01\x02" * 50,
        is_speech=True,
    )

    time.sleep(0.015)  # Pause longer than vad_threshold_ms

    res = agent.process_audio_chunk(
        speaker_id="usr_spk",
        speaker_name="Amina",
        pcm_bytes=b"",
        is_speech=False,
        transcription_override="I think having a unique key is enough for 1nf normalization.",
    )

    assert res is not None
    assert agent.last_response_latency_ms is not None
    # Latency must be strictly below 1500ms (typically < 50ms in deterministic execution)
    assert agent.last_response_latency_ms < 1500.0
    print(f"Measured speech-pause to response latency: {agent.last_response_latency_ms:.2f} ms")


def test_voice_moderator_muting_leaves_peer_audio_intact():
    """ED-25-A006: Muting the AI leaves peer audio intact."""
    agent = VoiceModeratorAgent(room_id="room_mute_test", vad_threshold_ms=10)
    agent.register_participant(user_id="peer_1", name="Leila", has_voice_consent=True)
    agent.register_participant(user_id="peer_2", name="Omar", has_voice_consent=True)

    # 1. AI is muted
    agent.mute()
    assert agent.mode == "muted"

    # Leila speaks with misconception
    agent.process_audio_chunk(
        speaker_id="peer_1",
        speaker_name="Leila",
        pcm_bytes=b"\x03\x04" * 40,
        is_speech=True,
    )
    time.sleep(0.015)

    res = agent.process_audio_chunk(
        speaker_id="peer_1",
        speaker_name="Leila",
        pcm_bytes=b"",
        is_speech=False,
        transcription_override="I think having a unique key is enough for 1nf normalization.",
    )
    # Because AI is muted, no intervention is emitted
    assert res is None

    # Peer audio transmission between Leila and Omar remains 100% intact
    peer_audio_streamed = agent.route_peer_audio(
        sender_id="peer_1",
        receiver_id="peer_2",
        pcm_bytes=b"\x05\x06" * 100,
    )
    assert peer_audio_streamed is True


def test_voice_moderator_disconnection_leaves_peer_audio_intact():
    """ED-25-A007: AI disconnection leaves peer audio intact."""
    agent = VoiceModeratorAgent(room_id="room_disconnect_test", vad_threshold_ms=10)
    agent.register_participant(user_id="peer_a", name="Sara", has_voice_consent=True)
    agent.register_participant(user_id="peer_b", name="Youssef", has_voice_consent=True)

    # AI agent disconnects from room
    agent.disconnect()
    assert agent.connected is False
    assert agent.has_active_audio_retention() is False

    # AI ignores audio chunks when disconnected
    res = agent.process_audio_chunk(
        speaker_id="peer_a",
        speaker_name="Sara",
        pcm_bytes=b"\x07\x08" * 50,
        is_speech=True,
    )
    assert res is None

    # Peer audio between human participants continues seamlessly through media plane
    peer_audio_intact = agent.route_peer_audio(
        sender_id="peer_a",
        receiver_id="peer_b",
        pcm_bytes=b"\x09\x10" * 100,
    )
    assert peer_audio_intact is True


def test_voice_moderator_interruption_handling():
    """ED-25: Interruption handling halts AI speech when human learner speaks."""
    agent = VoiceModeratorAgent(room_id="room_interrupt_test")
    agent.register_participant(user_id="usr_interrupter", name="Tariq", has_voice_consent=True)

    # Simulate AI moderator speaking an intervention
    from agents.facilitator.schemas import FacilitatorInterventionProposal, FacilitatorStrategy
    proposal = FacilitatorInterventionProposal(
        interventionId="prop_interrupt_1",
        roomId="room_interrupt_test",
        trigger="misconception_detected",
        reasoning="Test pedagogical intervention for 1NF",
        strategy=FacilitatorStrategy.SOCRATIC_NUDGE,
        messageText="Consider whether 1NF allows multi-valued attributes in a row.",
    )
    synth_pcm = agent.synthesize_speech(proposal)
    assert len(synth_pcm) > 0
    assert agent.is_speaking is True
    assert agent.interrupted is False

    # Human learner interrupts mid-speech
    agent.process_audio_chunk(
        speaker_id="usr_interrupter",
        speaker_name="Tariq",
        pcm_bytes=b"\x01\x02" * 50,
        is_speech=True,
    )

    # AI speech is immediately interrupted
    assert agent.interrupted is True
    assert agent.is_speaking is False


def test_voice_moderator_buffer_lifetime_limits():
    """ED-25: Bounded in-memory audio lifetime enforces strict memory ceiling."""
    # Configure tiny 1000 byte limit for testing
    agent = VoiceModeratorAgent(room_id="room_limit_test", max_buffer_seconds=0.03, sample_rate_hz=16000)
    agent.register_participant(user_id="usr_spk", name="Nadia", has_voice_consent=True)

    # Stream 5000 bytes (exceeds max_buffer_bytes)
    oversized_pcm = b"\x01\x02" * 2500
    agent.process_audio_chunk(
        speaker_id="usr_spk",
        speaker_name="Nadia",
        pcm_bytes=oversized_pcm,
        is_speech=True,
    )

    # Buffer must be capped at max_buffer_bytes
    current_bytes = len(agent._streaming_buffers["usr_spk"])
    assert current_bytes <= agent.max_buffer_bytes
    assert current_bytes > 0


def test_voice_moderator_failure_isolation():
    """ED-25: Agent failure isolation prevents external policy/STT errors from crashing room."""
    agent = VoiceModeratorAgent(room_id="room_fail_isolation", vad_threshold_ms=10)
    agent.register_participant(user_id="usr_err", name="Ziad", has_voice_consent=True)

    agent.process_audio_chunk(
        speaker_id="usr_err",
        speaker_name="Ziad",
        pcm_bytes=b"\x01\x02" * 40,
        is_speech=True,
    )
    time.sleep(0.015)

    # Monkeypatch evaluate_rules to simulate an unexpected exception
    import agents.voice_moderator.agent as vma
    orig_eval = vma.evaluate_rules
    try:
        def bad_eval(_):
            raise RuntimeError("Simulated policy crash")
        vma.evaluate_rules = bad_eval

        # Must not raise; fails safely returning None
        res = agent.process_audio_chunk(
            speaker_id="usr_err",
            speaker_name="Ziad",
            pcm_bytes=b"",
            is_speech=False,
            transcription_override="Test utterance",
        )
        assert res is None
    finally:
        vma.evaluate_rules = orig_eval



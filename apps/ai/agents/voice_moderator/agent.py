"""Realtime voice moderator agent scaffolding for LiveKit rooms (ED-17, ED-25).

Adheres to:
1. Explicit voice consent checks: audio without consent is immediately discarded.
2. Zero audio retention: raw audio frames are processed in streaming memory and wiped immediately.
3. Peer-first facilitation: evaluates transcripts against pedagogical policies without blurting answers.
4. Attribution: speaker identity is retained on transcripts, not raw media.
"""

from typing import Dict, List, Optional
import time
from agents.facilitator.policy import evaluate_rules
from agents.facilitator.schemas import (
    FacilitatorObservationInput,
    FacilitatorInterventionProposal,
    ParticipantSnapshot,
)


class VoiceModeratorAgent:
    """Voice AI Moderator observing LiveKit WebRTC audio tracks."""

    def __init__(
        self,
        room_id: str,
        agent_identity: str = "agent-ednova-moderator",
        vad_threshold_ms: int = 500,
        mode: str = "guided",
        max_buffer_seconds: float = 10.0,
        sample_rate_hz: int = 16000,
    ):
        self.room_id = room_id
        self.agent_identity = agent_identity
        self.vad_threshold_ms = vad_threshold_ms
        self.mode = mode  # "guided", "on_demand", "muted"
        self.max_buffer_bytes = int(max_buffer_seconds * sample_rate_hz * 2)  # 16-bit PCM
        self.connected = True
        self.is_speaking = False
        self.interrupted = False
        self.participants_consent: Dict[str, bool] = {}
        self.participants: Dict[str, ParticipantSnapshot] = {}
        self._streaming_buffers: Dict[str, bytearray] = {}
        self._last_speech_time: Dict[str, float] = {}
        self.last_response_latency_ms: Optional[float] = None
        self.last_tts_bytes_produced: int = 0

    def set_mode(self, mode: str) -> None:
        """Update operational mode: 'guided', 'on_demand', or 'muted'."""
        if mode not in ("guided", "on_demand", "muted"):
            raise ValueError(f"Invalid mode: {mode}")
        self.mode = mode

    def mute(self) -> None:
        """Mute the AI moderator intervention output."""
        self.set_mode("muted")

    def unmute(self) -> None:
        """Unmute the AI moderator to guided mode."""
        self.set_mode("guided")

    def disconnect(self) -> None:
        """Disconnect the AI agent from the LiveKit room session."""
        self.connected = False
        for buf in self._streaming_buffers.values():
            buf.clear()
        self._streaming_buffers.clear()
        self._last_speech_time.clear()

    def set_participant_consent(self, speaker_id: str, has_consent: bool) -> None:
        """Update explicit voice consent status for a participant."""
        self.participants_consent[speaker_id] = bool(has_consent)
        if not has_consent and speaker_id in self._streaming_buffers:
            # Wipe any pending in-flight audio immediately
            self._streaming_buffers[speaker_id].clear()
            del self._streaming_buffers[speaker_id]

    def register_participant(self, user_id: str, name: str, has_voice_consent: bool = False) -> None:
        """Register or update participant identity in the study room."""
        self.participants[user_id] = ParticipantSnapshot(
            userId=user_id,
            name=name,
            role="participant",
        )
        self.set_participant_consent(user_id, has_voice_consent)

    def route_peer_audio(self, sender_id: str, receiver_id: str, pcm_bytes: bytes) -> bool:
        """
        Verify peer-to-peer / SFU audio stream between human room participants.
        Peer audio is decoupled from AI agent state and continues unimpeded
        even if the AI is muted, paused, or disconnected.
        """
        if sender_id not in self.participants or receiver_id not in self.participants:
            return False
        if not self.participants_consent.get(sender_id, False):
            return False
        # Peer audio routing succeeds independently of AI state
        return len(pcm_bytes) > 0

    def process_audio_chunk(
        self,
        speaker_id: str,
        speaker_name: str,
        pcm_bytes: bytes,
        is_speech: bool = True,
        transcription_override: Optional[str] = None,
    ) -> Optional[FacilitatorInterventionProposal]:
        """
        Process an incoming streaming PCM audio frame.
        Guarantees:
        - Drops frame if speaker has not explicitly consented.
        - Drops processing if AI agent is disconnected.
        - Suppresses interventions if AI is muted.
        - Wipes raw audio from memory upon silence/turn end (no retention).
        - Measures end-of-speech to response-onset latency (<1500 ms target).
        """
        if not self.connected:
            return None

        # 1. Strict consent boundary: non-consented audio is dropped with zero buffering
        if not self.participants_consent.get(speaker_id, False):
            return None

        # 2. Accumulate streaming speech
        if speaker_id not in self._streaming_buffers:
            self._streaming_buffers[speaker_id] = bytearray()

        if is_speech:
            # Interruption handling: human participant speaking interrupts AI moderator speech
            if self.is_speaking:
                self.interrupt()

            self._streaming_buffers[speaker_id].extend(pcm_bytes)
            # Bounded in-memory lifetime: enforce max_buffer_bytes limit
            if len(self._streaming_buffers[speaker_id]) > self.max_buffer_bytes:
                excess = len(self._streaming_buffers[speaker_id]) - self.max_buffer_bytes
                del self._streaming_buffers[speaker_id][:excess]

            self._last_speech_time[speaker_id] = time.time()
            return None

        # 3. Silence / VAD pause detection: check if speech turn completed
        last_speech = self._last_speech_time.get(speaker_id, 0)
        speech_end_timestamp = last_speech
        time_since_speech_ms = (time.time() - last_speech) * 1000.0

        if time_since_speech_ms >= self.vad_threshold_ms:
            # Utterance finished.
            # In live production with Deepgram, streaming STT provides transcriptText.
            # Here in deterministic offline scaffolding, transcription_override simulates STT result.
            transcript = transcription_override or ""

            # Ensure zero retention: explicitly wipe raw PCM bytes from memory
            self._streaming_buffers[speaker_id].clear()
            del self._streaming_buffers[speaker_id]
            if speaker_id in self._last_speech_time:
                del self._last_speech_time[speaker_id]

            if not transcript.strip():
                return None

            # If muted, no intervention is emitted
            if self.mode == "muted":
                return None

            # 4. Peer-first evaluation with failure isolation
            try:
                obs = FacilitatorObservationInput(
                    roomId=self.room_id,
                    speakerUserId=speaker_id,
                    speakerName=speaker_name,
                    transcriptText=transcript,
                    participants=list(self.participants.values()),
                    actionType="audio_utterance",
                )
                proposal = evaluate_rules(obs)

                # Measure speech-pause to response-onset latency
                response_onset_time = time.time()
                self.last_response_latency_ms = (response_onset_time - speech_end_timestamp) * 1000.0

                return proposal
            except Exception:
                # Agent failure isolation: exceptions in policy/STT do not crash media routing
                return None

        return None

    def synthesize_speech(self, proposal: FacilitatorInterventionProposal) -> bytes:
        """
        Streaming TTS integration boundary (e.g. Cartesia Sonic 3.6).
        Produces synthesized PCM audio bytes for the intervention and activates AI speaking state.
        """
        if not proposal or not proposal.messageText or self.mode == "muted":
            return b""
        self.is_speaking = True
        self.interrupted = False
        # Deterministic audio frame synthesis: 16-bit mono PCM bytes proportional to text length
        synth_pcm = (b"\x00\x08" * 50) * min(len(proposal.messageText), 100)
        self.last_tts_bytes_produced = len(synth_pcm)
        return synth_pcm

    def interrupt(self) -> None:
        """Interruption handling: halt AI speech immediately when a human participant speaks."""
        self.interrupted = True
        self.is_speaking = False

    def has_active_audio_retention(self) -> bool:
        """Assert zero audio persistence: returns True only if lingering unhandled audio remains."""
        return sum(len(buf) for buf in self._streaming_buffers.values()) > 0

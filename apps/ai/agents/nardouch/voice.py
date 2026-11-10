"""Replaceable ASR/TTS adapters. No server microphone, audio files or retry loops."""

import sqlite3
import base64
import binascii
import io
import os
import re
import wave
import threading
from contextlib import contextmanager
from typing import Literal, Protocol
from pydantic import Field
from agents.tutor.grounding import StrictModel

MAX_BYTES = 960_044  # 30 seconds, mono signed PCM16, 16 kHz + WAV header


_slots = threading.BoundedSemaphore(2)


@contextmanager
def voice_slot():
    if not _slots.acquire(blocking=False):
        raise VoiceUnavailable("Speech is busy; retry shortly")
    try:
        yield
    finally:
        _slots.release()


class VoiceUnavailable(Exception):
    pass


class TranscriptionRequest(StrictModel):
    audioBase64: str = Field(min_length=1, max_length=1_300_000)
    locale: Literal["ar-TN", "fr-FR", "en-US"] = "ar-TN"
    consent: Literal[True]


class SpeechRequest(StrictModel):
    # Only the private gateway may supply a previously validated stored answer.
    speechText: str = Field(min_length=1, max_length=12000)
    speechLanguage: Literal["ar", "fr", "en"] | None = None
    generationKey: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")


class ASRProvider(Protocol):
    def transcribe(self, audio: bytes, locale: str) -> str: ...


class TTSProvider(Protocol):
    def synthesize(self, text: str) -> bytes: ...


def decode_audio(encoded: str) -> bytes:
    try:
        audio = base64.b64decode(encoded, validate=True)
        if len(audio) > MAX_BYTES or len(audio) < 46:
            raise ValueError("Audio size limit")
        with wave.open(io.BytesIO(audio), "rb") as wav:
            if (
                wav.getnchannels() != 1
                or wav.getsampwidth() != 2
                or wav.getframerate() != 16000
                or wav.getcomptype() != "NONE"
            ):
                raise ValueError("Use mono PCM16 16 kHz WAV")
            frames = wav.getnframes()
            if (
                frames < 1600
                or frames > 480000
                or len(wav.readframes(frames)) != frames * 2
            ):
                raise ValueError("Audio must be 0.1–30 seconds")
        return audio
    except (wave.Error, EOFError, binascii.Error) as exc:
        raise ValueError("Invalid WAV audio") from None


class LocalWhisperASRProvider:
    def transcribe(self, audio: bytes, locale: str) -> str:
        from .local_speech import infer

        return infer("asr", audio, locale)


class LocalTunisianTTSProvider:
    def synthesize(self, text: str) -> bytes:
        from .local_speech import infer
        from .speech_adaptation import adapt_for_speech

        return infer("tts", adapt_for_speech(text))


class LocalPiperTTSProvider:
    def synthesize(self, text: str) -> bytes:
        from .speech_adaptation import prepare_piper_text
        from .local_speech import infer

        return infer("piper", prepare_piper_text(text))


def asr_provider() -> ASRProvider:
    if os.getenv("NARDOUCH_ASR_PROVIDER", "local_whisper") == "local_whisper":
        return LocalWhisperASRProvider()
    raise VoiceUnavailable(
        "Local ASR disabled or unsupported; cloud fallback is prohibited"
    )


def tts_provider() -> TTSProvider:
    if os.getenv("NARDOUCH_TTS_PROVIDER") == "vibi":
        from .vibi import VibiTTSProvider

        return VibiTTSProvider()
    if os.getenv("NARDOUCH_TTS_PROVIDER") == "elevenlabs":
        from .elevenlabs import ElevenLabsTTSProvider

        return ElevenLabsTTSProvider()
    if os.getenv("NARDOUCH_TTS_PROVIDER", "local_piper") == "local_piper":
        return LocalPiperTTSProvider()
    if os.getenv("NARDOUCH_TTS_PROVIDER", "disabled") == "local_silma":
        from .silma import LocalSilmaTTSProvider

        return LocalSilmaTTSProvider()
    if os.getenv("NARDOUCH_TTS_PROVIDER", "disabled") == "local_tunisian":
        return LocalTunisianTTSProvider()
    raise VoiceUnavailable("Local TTS disabled; read the text response")


def transcribe(req: TranscriptionRequest) -> str:
    audio = decode_audio(req.audioBase64)
    try:
        with voice_slot():
            text = asr_provider().transcribe(audio, req.locale)
        if not isinstance(text, str) or not text.strip() or len(text) > 4000:
            raise VoiceUnavailable("No usable transcript; type your question")
        return text.strip()
    except (KeyError, TypeError, ValueError):
        raise VoiceUnavailable(
            "Transcription failed; retry or type your question"
        ) from None


def synthesize(req: SpeechRequest) -> str:
    try:
        with voice_slot():
            provider = tts_provider()
            if os.getenv("NARDOUCH_TTS_PROVIDER") in ("elevenlabs", "vibi"):
                audio = provider.synthesize(
                    req.speechText, generation_key=req.generationKey, language=req.speechLanguage
                )
            else:
                if req.speechLanguage in ("en", "fr"):
                    raise VoiceUnavailable("The local voice supports Arabic only.")
                audio = provider.synthesize(req.speechText)
            return base64.b64encode(audio).decode("ascii")
    except (OSError, ValueError, sqlite3.Error, ImportError):
        raise VoiceUnavailable(
            "Speech generation failed; the text answer is available"
        ) from None

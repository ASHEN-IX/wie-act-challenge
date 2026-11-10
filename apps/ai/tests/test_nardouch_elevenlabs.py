"""Deterministic HTTP doubles only; paid smoke is a separate explicit command."""

from pathlib import Path
import hashlib
import sqlite3
import pytest
import requests
from agents.nardouch import elevenlabs as e
from agents.nardouch.voice import tts_provider
from tests.conftest import needs_av

AUDIO = (Path(__file__).parent / "fixtures/elevenlabs-tone.mp3").read_bytes()
KEY = "a" * 64


@pytest.fixture(autouse=True)
def configured(monkeypatch, tmp_path):
    monkeypatch.setenv("NARDOUCH_TTS_DEMO_ENABLED", "true")
    monkeypatch.setenv("ELEVENLABS_API_KEY", "test-secret-never-log")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "authorized-test-voice")
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", "elevenlabs")
    monkeypatch.setenv("NARDOUCH_TTS_BUDGET_DB", str(tmp_path / "budget.sqlite"))


class Response:
    status_code = 200
    headers = {"Content-Type": "audio/mpeg"}

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def iter_content(self, *args):
        yield AUDIO


@needs_av
def test_payload_auth_and_only_text(monkeypatch):
    seen = []

    def post(url, **kwargs):
        seen.append(kwargs)
        assert (
            url == "https://api.elevenlabs.io/v1/text-to-speech/authorized-test-voice"
        )
        assert kwargs["headers"]["xi-api-key"] == "test-secret-never-log"
        assert kwargs["json"] == {
            "text": "شنوة stack و queue؟ LIFO x=3",
            "model_id": "eleven_v4",
        }
        assert kwargs["allow_redirects"] is False
        return Response()

    monkeypatch.setattr(e.requests, "post", post)
    assert isinstance(tts_provider(), e.ElevenLabsTTSProvider)
    assert tts_provider().synthesize("شنوة stack و queue؟ LIFO x=3", KEY) == AUDIO
    with pytest.raises(e.ElevenLabsFailure):
        tts_provider().synthesize("again", KEY)
    assert len(seen) == 1


@needs_av
@pytest.mark.parametrize(("language", "text"), [
    ("ar", "شنوّة تبدّل كي نزيدو في الوزن؟"),
    ("fr", "Que se passe-t-il si le poids augmente ?"),
    ("en", "What changes if the weight increases?"),
])
def test_v4_routes_each_language_to_one_voice(monkeypatch, language, text):
    voice = f"configured-{language}"
    monkeypatch.setenv(f"ELEVENLABS_VOICE_ID_{language.upper()}", voice)

    def post(url, **kwargs):
        assert url == f"https://api.elevenlabs.io/v1/text-to-speech/{voice}"
        assert kwargs["json"] == {
            "text": text, "model_id": "eleven_v4", "language_code": language,
        }
        return Response()

    monkeypatch.setattr(e.requests, "post", post)
    assert e.ElevenLabsTTSProvider().synthesize(text, KEY, language) == AUDIO


def test_missing_language_voice_does_not_fall_back(monkeypatch):
    monkeypatch.delenv("ELEVENLABS_VOICE_ID_FR", raising=False)
    with pytest.raises(e.ElevenLabsFailure) as error:
        e.settings("fr")
    assert error.value.category == "configuration"


@needs_av
@pytest.mark.parametrize("status", [401, 402, 403, 422, 429, 500, 302])
def test_safe_provider_failures(monkeypatch, status):
    response = Response()
    response.status_code = status
    monkeypatch.setattr(e.requests, "post", lambda *a, **k: response)
    with pytest.raises(e.ElevenLabsFailure) as error:
        e.ElevenLabsTTSProvider().synthesize("عسلامة", KEY)
    assert "test-secret" not in str(error.value)


@pytest.mark.parametrize(
    "field,value",
    [
        ("ELEVENLABS_API_KEY", ""),
        ("ELEVENLABS_VOICE_ID", ""),
        ("ELEVENLABS_MODEL_ID", "invented"),
        ("ELEVENLABS_OUTPUT_FORMAT", "wav_44100"),
        ("NARDOUCH_TTS_DEMO_ENABLED", "false"),
    ],
)
def test_configuration_before_dispatch(monkeypatch, field, value):
    monkeypatch.setenv(field, value)
    monkeypatch.setattr(
        e.requests, "post", lambda *a, **k: pytest.fail("must not dispatch")
    )
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("عسلامة", KEY)


def test_budget_and_global_single_flight(monkeypatch):
    monkeypatch.setenv("NARDOUCH_TTS_DAILY_REQUESTS", "1")
    first = e.reserve(KEY, "hello", "model")
    with pytest.raises(e.ElevenLabsFailure, match="unavailable"):
        e.reserve("different", "hello", "model")
    e.finish(first, "failed", 1)
    with pytest.raises(e.ElevenLabsFailure) as error:
        e.reserve("different", "hello", "model")
    assert error.value.category == "budget_exhausted"


@needs_av
def test_timeout_not_retried(monkeypatch):
    calls = []

    def post(*a, **k):
        calls.append(1)
        raise requests.Timeout("sensitive-provider-body")

    monkeypatch.setattr(e.requests, "post", post)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    assert len(calls) == 1


@needs_av
def test_invalid_audio_and_limits(monkeypatch):
    assert e.validate_mp3(AUDIO) > 0
    for data in [b'{"error":"credits"}', b"ID3" + b"x" * 100, b""]:
        with pytest.raises(e.ElevenLabsFailure):
            e.validate_mp3(data)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("x" * 601, KEY)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("x")


def test_multilingual_model_config(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    assert e.settings()[2] == "eleven_multilingual_v2"


def test_identity_preparation_preserves_math_and_code():
    text = "Binary search O(log n). stack LIFO, queue FIFO; x=3; f(0)=1."
    assert e.prepare_text(text) == text


@needs_av
def test_character_budget_fails_before_dispatch(monkeypatch):
    monkeypatch.setenv("NARDOUCH_TTS_DAILY_CHARACTERS", "2")
    monkeypatch.setattr(
        e.requests,
        "post",
        lambda *a, **k: pytest.fail("No paid call after budget exhausted"),
    )
    with pytest.raises(e.ElevenLabsFailure) as error:
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    assert error.value.category == "budget_exhausted"


@needs_av
def test_stream_cancellation_consumes_reservation_without_replay(monkeypatch):
    calls = []

    class Cancelled(Response):
        def iter_content(self, *args):
            raise requests.ConnectionError("private detail")

    def post(*args, **kwargs):
        calls.append(1)
        return Cancelled()

    monkeypatch.setattr(e.requests, "post", post)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    with pytest.raises(e.ElevenLabsFailure):
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    assert len(calls) == 1


def test_supplied_v3_model_is_supported(monkeypatch):
    monkeypatch.setenv("ELEVENLABS_MODEL_ID", "eleven_v3")
    monkeypatch.setenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    assert e.settings()[1:] == ("21m00Tcm4TlvDq8ikWAM", "eleven_v3")


@needs_av
def test_structured_free_plan_rejection_is_sanitized(monkeypatch):
    class Rejected(Response):
        status_code = 402

        def iter_content(self, *args):
            yield b'{"detail":{"status":"paid_plan_required","message":"private-provider-text"}}'

    monkeypatch.setattr(e.requests, "post", lambda *a, **k: Rejected())
    with pytest.raises(e.ElevenLabsFailure) as error:
        e.ElevenLabsTTSProvider().synthesize("hello", KEY)
    assert error.value.category == "paid_plan_required"
    assert "private-provider-text" not in str(error.value)

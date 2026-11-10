import json
from pathlib import Path

import pytest

from agents.nardouch import vibi
from agents.nardouch.voice import SpeechRequest, synthesize
from tests.conftest import needs_av

TASK = "9b19d3e2-7c68-4eca-be48-e9917682d73e"
AUDIO = (Path(__file__).parent / "fixtures/elevenlabs-tone.mp3").read_bytes()


class Response:
    def __init__(self, status, data):
        self.status_code = status
        self.data = json.dumps(data).encode() if isinstance(data, dict) else data

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def iter_content(self, _):
        yield self.data


@pytest.fixture(autouse=True)
def configuration(monkeypatch, tmp_path):
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", "vibi")
    monkeypatch.setenv("NARDOUCH_TTS_DEMO_ENABLED", "true")
    monkeypatch.setenv("NARDOUCH_TTS_BUDGET_DB", str(tmp_path / "budget.sqlite3"))
    monkeypatch.setenv("VIBI_API_KEY", "fixture-key")
    for language in vibi.LANGUAGES:
        monkeypatch.setenv(f"VIBI_VOICE_ID_{language.upper()}", f"voice-{language}")
    monkeypatch.setattr(vibi.time, "sleep", lambda _: None)


@needs_av
@pytest.mark.parametrize("language", vibi.LANGUAGES)
def test_vibi_routes_one_language_and_one_voice(monkeypatch, language):
    import base64

    calls = []
    audio_url = f"{vibi.BASE}/audio/{TASK}.mp3"
    replies = iter([
        Response(202, {"id": TASK, "status": "pending"}),
        Response(200, {"status": "processing"}),
        Response(200, {"status": "completed", "result": {"audio_url": audio_url}}),
        Response(200, AUDIO),
    ])

    def request(method, url, **kwargs):
        calls.append((method, url, kwargs))
        return next(replies)

    monkeypatch.setattr(vibi.requests, "request", request)
    req = SpeechRequest(speechText="A tutor reply", speechLanguage=language, generationKey="a" * 64)
    assert base64.b64decode(synthesize(req)) == AUDIO
    assert calls[0][0:2] == ("POST", f"{vibi.BASE}/v1/text-to-speech/voice-{language}")
    assert calls[0][2]["json"] == {
        "text": req.speechText, "provider": "elevenlabs",
        "model_id": "eleven_v4", "language_code": language,
    }
    assert [call[1] for call in calls[1:3]] == [f"{vibi.BASE}/v1/history/{TASK}"] * 2
    assert calls[0][2]["headers"]["xi-api-key"] == "fixture-key"
    assert calls[-1][0:2] == ("GET", audio_url)
    assert "xi-api-key" not in calls[-1][2]["headers"]
    assert all(not call[2]["allow_redirects"] for call in calls)
    with pytest.raises(vibi.ElevenLabsFailure, match="Voice playback"):
        synthesize(req)
    assert len(calls) == 4


@needs_av
def test_vibi_rejects_foreign_audio_url(monkeypatch):
    replies = iter([
        Response(202, {"id": TASK}),
        Response(200, {"status": "completed", "result": {"audio_url": "https://example.org/audio/file.mp3"}}),
    ])
    monkeypatch.setattr(vibi.requests, "request", lambda *_a, **_k: next(replies))
    with pytest.raises(vibi.ElevenLabsFailure) as error:
        vibi.VibiTTSProvider().synthesize("Hello", "a" * 64, "en")
    assert error.value.category == "invalid_audio_url"

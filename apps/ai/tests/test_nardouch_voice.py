import base64
import io
import wave
import pytest
import requests
from agents.nardouch import voice as v


def wav(seconds=1, rate=16000, channels=1):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as out:
        out.setnchannels(channels)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(b"\0\0" * int(rate * seconds) * channels)
    return base64.b64encode(buf.getvalue()).decode()


def test_valid_audio_without_persistence():
    assert len(v.decode_audio(wav())) == 32044


@pytest.mark.parametrize(
    "data",
    [
        lambda: "notbase64!",
        lambda: wav(31),
        lambda: wav(rate=48000),
        lambda: wav(channels=2),
        lambda: wav(0.01),
    ],
)
def test_audio_limits(data):
    with pytest.raises(ValueError):
        v.decode_audio(data())


def test_truncated_audio_header_rejected():
    value = base64.b64decode(wav())[:100]
    with pytest.raises(ValueError):
        v.decode_audio(base64.b64encode(value).decode())


def test_asr_failure_preserves_text_alternative(monkeypatch):
    monkeypatch.setenv("NARDOUCH_ASR_PROVIDER", "disabled")
    with pytest.raises(v.VoiceUnavailable):
        v.transcribe(v.TranscriptionRequest(audioBase64=wav(), consent=True))


def test_correctable_transcript_and_exact_output(monkeypatch):
    class ASR:
        def transcribe(self, audio, locale):
            assert locale == "ar-TN" and audio[:4] == b"RIFF"
            return "mafhemtech le stack"

    monkeypatch.setattr(v, "asr_provider", lambda: ASR())
    assert (
        v.transcribe(v.TranscriptionRequest(audioBase64=wav(), consent=True))
        == "mafhemtech le stack"
    )


@pytest.mark.parametrize("provider", ["azure", "google"])
def test_cloud_provider_configuration_fails_closed(monkeypatch, provider):
    monkeypatch.setenv("NARDOUCH_ASR_PROVIDER", provider)
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", provider)
    with pytest.raises(v.VoiceUnavailable):
        v.asr_provider()
    with pytest.raises(v.VoiceUnavailable):
        v.tts_provider()


def test_local_provider_selection(monkeypatch):
    monkeypatch.setenv("NARDOUCH_ASR_PROVIDER", "local_whisper")
    monkeypatch.setenv("NARDOUCH_TTS_PROVIDER", "local_tunisian")
    assert isinstance(v.asr_provider(), v.LocalWhisperASRProvider)
    assert isinstance(v.tts_provider(), v.LocalTunisianTTSProvider)


def test_missing_weights_fail_without_network(monkeypatch, tmp_path):
    from agents.nardouch.local_speech import infer

    monkeypatch.setenv("NARDOUCH_SPEECH_MODEL_DIR", str(tmp_path))
    with pytest.raises(v.VoiceUnavailable):
        infer("asr", b"bytes")


def test_pronunciation_preserves_math_and_code():
    from agents.nardouch.speech_adaptation import adapt_for_speech

    assert (
        adapt_for_speech("stack LIFO; queue FIFO; f(x)=x**2; 3lech?")
        == "stack L I F O; queue F I F O; f(x)=x**2; 3lech?"
    )


def test_voice_concurrency_is_bounded(monkeypatch):
    class Busy:
        def acquire(self, **kwargs):
            return False

    monkeypatch.setattr(v, "_slots", Busy())
    with pytest.raises(v.VoiceUnavailable, match="busy"):
        with v.voice_slot():
            pytest.fail("Busy speech must not dispatch")


def test_benchmark_strict_normalization():
    from agents.nardouch.evaluation.speech import wer, normalize

    assert normalize("stack  queue") == "stack queue"
    assert wer("stack queue", "stack") == 0.5
    assert wer("", "") is None


def test_worker_backpressure(monkeypatch):
    from agents.nardouch import local_speech as local

    class Busy:
        def acquire(self, **kwargs):
            return False

    monkeypatch.setattr(local, "_lock", Busy())
    with pytest.raises(v.VoiceUnavailable, match="busy"):
        local.infer("asr", b"")


def test_worker_timeout_discards_process(monkeypatch):
    from agents.nardouch import local_speech as local

    class Process:
        pid = 1

        def is_alive(self):
            return True

    class Pipe:
        def send(self, value):
            pass

        def poll(self, timeout):
            return False

    stopped = []
    monkeypatch.setattr(local, "_process", Process())
    monkeypatch.setattr(local, "_pipe", Pipe())
    monkeypatch.setattr(local, "shutdown", lambda: stopped.append(True))
    with pytest.raises(v.VoiceUnavailable, match="timed out"):
        local.infer("asr", b"")
    assert stopped

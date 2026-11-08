"""Unit tests with labeled runtime doubles; real inference is piper_smoke."""

import io
import json
import wave
from types import SimpleNamespace
import pytest
from agents.nardouch.piper_runtime import load_piper, validate_wav, synthesize_piper
from agents.nardouch.voice import tts_provider, LocalPiperTTSProvider, VoiceUnavailable
from agents.nardouch.speech_adaptation import prepare_piper_text
from tests.conftest import needs_piper


def files(tmp_path):
    (tmp_path / "manifest.json").write_text(
        json.dumps(
            {
                "usage": "deployment_approved",
                "model": "voice.onnx",
                "config": "voice.json",
                "files": {"voice.onnx": "hash", "voice.json": "hash"},
            }
        )
    )
    (tmp_path / "voice.json").write_text(
        json.dumps({"audio": {"sample_rate": 22050}, "num_speakers": 1})
    )
    return tmp_path


def test_selection(monkeypatch):
    monkeypatch.delenv("NARDOUCH_TTS_PROVIDER", raising=False)
    assert isinstance(tts_provider(), LocalPiperTTSProvider)


@needs_piper
def test_forced_cpu(monkeypatch, tmp_path):
    import piper

    def load(model, config_path, use_cuda):
        assert use_cuda is False
        return SimpleNamespace(
            session=SimpleNamespace(get_providers=lambda: ["CPUExecutionProvider"])
        )

    monkeypatch.setattr(piper.PiperVoice, "load", load)
    voice = load_piper(files(tmp_path))
    assert voice.use_tashkeel is False


def test_gpu_rejected(monkeypatch, tmp_path):
    monkeypatch.setenv("NARDOUCH_PIPER_DEVICE", "cuda")
    with pytest.raises(ValueError, match="CPU"):
        load_piper(files(tmp_path))


def test_research_voice_blocked_in_production(monkeypatch, tmp_path):
    root = files(tmp_path)
    manifest = json.loads((root / "manifest.json").read_text())
    manifest["usage"] = "noncommercial_evaluation"
    (root / "manifest.json").write_text(json.dumps(manifest))
    monkeypatch.setenv("NARDOUCH_PIPER_ALLOW_NONCOMMERCIAL", "1")
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValueError, match="restricted"):
        load_piper(root)


def test_invalid_config(tmp_path):
    root = files(tmp_path)
    (root / "voice.json").write_text('{"audio":{"sample_rate":0}}')
    with pytest.raises(ValueError):
        load_piper(root)


def test_wav_generation_and_validation():
    class Voice:
        def synthesize_wav(self, text, out):
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(22050)
            out.writeframes(b"\0\0" * 22050)

    data = synthesize_piper(Voice(), "عسلامة")
    assert validate_wav(data) == 1
    with pytest.raises(ValueError):
        validate_wav(data[:-20])
    with pytest.raises(ValueError):
        synthesize_piper(Voice(), "x" * 601)


def test_no_unreviewed_transliteration():
    text = "شنوة الفرق بين stack و queue؟ f(3)=9، LIFO و FIFO."
    assert prepare_piper_text(text) == text
    with pytest.raises(VoiceUnavailable):
        prepare_piper_text("El récursivité lezimha condition d'arrêt.")


def test_missing_piper_weights(monkeypatch, tmp_path):
    monkeypatch.setenv("NARDOUCH_SPEECH_MODEL_DIR", str(tmp_path))
    monkeypatch.setenv("NARDOUCH_PIPER_MODEL_DIR", str(tmp_path / "piper"))
    with pytest.raises(VoiceUnavailable):
        LocalPiperTTSProvider().synthesize("عسلامة")


def test_stereo_output_is_rejected():
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as out:
        out.setnchannels(2)
        out.setsampwidth(2)
        out.setframerate(22050)
        out.writeframes(b"\0" * 400)
    with pytest.raises(ValueError):
        validate_wav(buffer.getvalue())

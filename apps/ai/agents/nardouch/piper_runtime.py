"""Piper CPU-only runtime; no Hub access, no Torch, no CUDA initialization."""

import io
import json
import os
import wave


def load_piper(root):
    if os.getenv("NARDOUCH_PIPER_DEVICE", "cpu") != "cpu":
        raise ValueError("Piper requires CPU")
    manifest = json.loads((root / "manifest.json").read_text())
    if manifest.get("usage") == "noncommercial_evaluation":
        if (
            os.getenv("NARDOUCH_PIPER_ALLOW_NONCOMMERCIAL") != "1"
            or os.getenv("APP_ENV") == "production"
            or os.getenv("NODE_ENV") == "production"
        ):
            raise ValueError(
                "Voice is restricted to explicit non-commercial evaluation"
            )
    elif manifest.get("usage") != "deployment_approved":
        raise ValueError("Voice rights not approved")
    model = manifest["model"]
    config = manifest["config"]
    if model not in manifest["files"] or config not in manifest["files"]:
        raise ValueError("Voice files not verified")
    cfg = json.loads((root / config).read_text())
    if (
        not 8000 <= cfg["audio"]["sample_rate"] <= 48000
        or cfg.get("num_speakers", 1) != 1
    ):
        raise ValueError("Unsupported voice config")
    from piper import PiperVoice

    voice = PiperVoice.load(root / model, config_path=root / config, use_cuda=False)
    voice.use_tashkeel = False  # Do not download an optional diacritization model.
    if voice.session.get_providers() != ["CPUExecutionProvider"]:
        raise ValueError("Unexpected ONNX execution provider")
    return voice


def validate_wav(data):
    if not 44 < len(data) <= 5_000_000:
        raise ValueError("Invalid WAV size")
    with wave.open(io.BytesIO(data), "rb") as audio:
        rate = audio.getframerate()
        frames = audio.getnframes()
        if (
            audio.getnchannels() != 1
            or audio.getsampwidth() != 2
            or not 8000 <= rate <= 48000
            or audio.getcomptype() != "NONE"
            or not 0 < frames / rate <= 60
            or len(audio.readframes(frames)) != frames * 2
        ):
            raise ValueError("Invalid synthesized WAV")
        return frames / rate


def synthesize_piper(voice, text):
    if not text.strip() or len(text) > 600:
        raise ValueError("Spoken response must be 1–600 characters")
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as audio:
        voice.synthesize_wav(text, audio)
    data = buffer.getvalue()
    validate_wav(data)
    return data

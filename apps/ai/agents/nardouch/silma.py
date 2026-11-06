"""SILMA integration boundary, fail closed until checkpoint/runtime review.

F5-TTS 1.1.7 is reference-conditioned. Its constructor does not accept an
arbitrary config.yaml path. We cannot infer this inaccessible fine-tune's
architecture, vocoder, or a reference-free voice contract from its name.
"""

from pathlib import Path
import os
from .voice import VoiceUnavailable

MODEL_REPO = "Ghazouaniwala/silma-tts-derja-v2"
REQUIRED_FILES = ("model.pt", "vocab.txt", "config.yaml")


def silma_readiness():
    root = Path(os.getenv("NARDOUCH_SPEECH_MODEL_DIR", "/models/nardouch")) / "silma"
    missing = [
        name
        for name in (*REQUIRED_FILES, "manifest.json")
        if not (root / name).is_file()
    ]
    return {
        "provider": "local_silma",
        "ready": False,
        "status": (
            "missing_verified_checkpoint"
            if missing
            else "runtime_and_voice_review_required"
        ),
        "missingFiles": missing,
        "reason": "Checkpoint rights, architecture, local vocoder and a non-cloning voice contract must be verified before synthesis.",
    }


class LocalSilmaTTSProvider:
    """Explicit selection; never substitutes VoxCPM, cloud or fabricated audio.

    This is a blocked provider boundary, not a validated SILMA inference adapter.
    Installing arbitrary files cannot automatically make this provider ready.
    """

    def synthesize(self, text: str) -> bytes:
        state = silma_readiness()
        if state["missingFiles"]:
            raise VoiceUnavailable(
                "SILMA weights are unavailable; provision an accessible, pinned, rights-reviewed checkpoint. Text remains available."
            )
        from .local_speech import model_path

        try:
            model_path("silma")
        except (OSError, ValueError, KeyError):
            raise VoiceUnavailable(
                "SILMA checkpoint verification failed; text remains available"
            ) from None
        raise VoiceUnavailable(
            "SILMA runtime and non-cloning voice review is incomplete; synthesis remains disabled"
        )

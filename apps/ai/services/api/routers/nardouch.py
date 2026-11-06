"""Private service endpoints. The Study gateway supplies authorized context."""

from fastapi import APIRouter, HTTPException
from agents.nardouch.schemas import TurnRequest, TurnResponse
from agents.nardouch.orchestrator import respond, NardouchUnavailable

from agents.nardouch.voice import (
    TranscriptionRequest,
    SpeechRequest,
    transcribe,
    synthesize,
    VoiceUnavailable,
)

router = APIRouter(prefix="/api/ai/nardouch", tags=["nardouch"])


@router.post("/turn", response_model=TurnResponse)
def turn(req: TurnRequest):
    try:
        return respond(req)
    except NardouchUnavailable:
        raise HTTPException(
            503, "Nardouch is unavailable; retry your question"
        ) from None


@router.post("/transcribe")
def transcription(req: TranscriptionRequest):
    try:
        return {"transcript": transcribe(req)}
    except ValueError:
        raise HTTPException(
            400, "Use a valid mono PCM16 16 kHz WAV of 0.1–30 seconds"
        ) from None
    except VoiceUnavailable:
        raise HTTPException(
            503, "Transcription is unavailable. Type your question or retry."
        ) from None


@router.post("/speech")
def speech(req: SpeechRequest):
    try:
        import os

        mime = (
            "audio/mpeg"
            if os.getenv("NARDOUCH_TTS_PROVIDER") == "elevenlabs"
            else "audio/wav"
        )
        return {"audioBase64": synthesize(req), "mimeType": mime}
    except VoiceUnavailable:
        raise HTTPException(
            503, "Speech generation is unavailable. Your text answer is preserved."
        ) from None


@router.get("/speech/readiness")
def speech_readiness():
    from agents.nardouch.local_speech import readiness
    import os

    result = readiness()
    result["ttsProvider"] = os.getenv("NARDOUCH_TTS_PROVIDER", "local_piper")
    if result["ttsProvider"] == "elevenlabs":
        from agents.nardouch.elevenlabs import settings, ElevenLabsFailure

        try:
            _, _, model = settings()
            result["tts"] = {
                "configured": True,
                "external": True,
                "model": model,
                "accountVerified": False,
            }
        except ElevenLabsFailure:
            result["tts"] = {
                "configured": False,
                "external": True,
                "accountVerified": False,
            }
    if result["ttsProvider"] == "local_piper":
        try:
            from agents.nardouch.local_speech import model_path
            import json

            manifest = json.loads((model_path("piper") / "manifest.json").read_text())
            approved = manifest.get("usage") == "deployment_approved"
            result["tts"] = {
                "weightsVerified": True,
                "deploymentApproved": approved,
                "usage": manifest.get("usage"),
                "device": "cpu",
            }
        except (OSError, ValueError, KeyError):
            result["tts"] = {
                "weightsVerified": False,
                "deploymentApproved": False,
                "device": "cpu",
            }
    if result["ttsProvider"] == "local_silma":
        from agents.nardouch.silma import silma_readiness

        result["tts"] = silma_readiness()
    return result

"""Metered demo TTS. No retries, redirects, SDK, local model loading or raw-audio input."""

from contextlib import contextmanager
import hashlib
import io
import os
from pathlib import Path
import re
import sqlite3
import time
from datetime import datetime, timezone
import requests
from .voice import VoiceUnavailable
from utils.logger import get_logger

logger = get_logger(__name__)
BASE = "https://api.elevenlabs.io"


class ElevenLabsFailure(VoiceUnavailable):
    def __init__(self, category):
        self.category = category
        super().__init__(
            "Voice playback is unavailable right now. You can still read Nardouch's answer."
        )


def settings():
    key = os.getenv("ELEVENLABS_API_KEY", "")
    voice = os.getenv("ELEVENLABS_VOICE_ID", "")
    model = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")
    if os.getenv("NARDOUCH_TTS_DEMO_ENABLED", "false").lower() != "true":
        raise ElevenLabsFailure("disabled")
    if not key or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", voice):
        raise ElevenLabsFailure("configuration")
    if (
        model not in ("eleven_flash_v2_5", "eleven_multilingual_v2", "eleven_v3")
        or os.getenv("ELEVENLABS_OUTPUT_FORMAT", "mp3_44100_128") != "mp3_44100_128"
    ):
        raise ElevenLabsFailure("configuration")
    return key, voice, model


@contextmanager
def budget_db():
    configured = os.getenv("NARDOUCH_TTS_BUDGET_DB")
    if not configured or not Path(configured).is_absolute():
        raise ElevenLabsFailure("budget_configuration")
    path = Path(configured)
    # Use a persistent, private mounted directory in deployment. Losing this DB
    # loses demo accounting; it is not an in-memory cache.
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_CREAT | os.O_WRONLY, 0o600)
    os.close(fd)
    con = sqlite3.connect(path, timeout=2)
    con.execute(
        "CREATE TABLE IF NOT EXISTS generations (id TEXT PRIMARY KEY, day TEXT, characters INTEGER, state TEXT, lease_until REAL, model TEXT, latency REAL, duration REAL)"
    )
    try:
        with con:
            yield con
    finally:
        con.close()


def reserve(generation_key, text, model):
    today = datetime.now(timezone.utc).date().isoformat()
    limit_chars = int(os.getenv("NARDOUCH_TTS_DAILY_CHARACTERS", "3000"))
    limit_requests = int(os.getenv("NARDOUCH_TTS_DAILY_REQUESTS", "10"))
    # Stable message key remains stable across provider/model changes; an A/B
    # audition uses separate explicit case IDs instead.
    identity = hashlib.sha256(generation_key.encode()).hexdigest()
    with budget_db() as con:
        con.execute("BEGIN IMMEDIATE")
        if con.execute("SELECT 1 FROM generations WHERE id=?", (identity,)).fetchone():
            raise ElevenLabsFailure("already_attempted")
        if con.execute(
            "SELECT 1 FROM generations WHERE state='reserved' AND lease_until>?",
            (time.time(),),
        ).fetchone():
            raise ElevenLabsFailure("busy")
        count, chars = con.execute(
            "SELECT COUNT(*),COALESCE(SUM(characters),0) FROM generations WHERE day=?",
            (today,),
        ).fetchone()
        if count >= limit_requests or chars + len(text) > limit_chars:
            raise ElevenLabsFailure("budget_exhausted")
        con.execute(
            "INSERT INTO generations VALUES (?,?,?,?,?,?,?,?)",
            (
                identity,
                today,
                len(text),
                "reserved",
                time.time() + 120,
                model,
                None,
                None,
            ),
        )
    return identity


def finish(identity, state, latency, duration=None):
    with budget_db() as con:
        con.execute(
            "UPDATE generations SET state=?,latency=?,duration=?,lease_until=0 WHERE id=?",
            (state, latency, duration, identity),
        )


def validate_mp3(data):
    import av  # Already part of the local Whisper runtime; CPU decode only.

    if not 64 <= len(data) <= 4_000_000 or not (
        data.startswith(b"ID3") or (data[0] == 255 and data[1] & 224 == 224)
    ):
        raise ElevenLabsFailure("invalid_audio")
    try:
        with av.open(io.BytesIO(data), format="mp3") as container:
            stream = container.streams.audio[0]
            if stream.codec_context.name not in ("mp3", "mp3float"):
                raise ValueError()
            duration = 0.0
            for frame in container.decode(audio=0):
                if frame.sample_rate != 44100 or len(frame.layout.channels) > 2:
                    raise ValueError()
                duration += frame.samples / frame.sample_rate
                if duration > 90:
                    raise ValueError()
            if duration <= 0:
                raise ValueError()
            return duration
    except Exception:
        raise ElevenLabsFailure("invalid_audio") from None


def prepare_text(text):
    # No new facts, formula changes or unreviewed Arabizi transliteration.
    # Identity adaptation is intentionally the safe demo default.
    return text


class ElevenLabsTTSProvider:
    def synthesize(self, text, generation_key=None):
        key, voice, model = settings()
        text = prepare_text(text)
        maximum = min(600, max(1, int(os.getenv("NARDOUCH_TTS_MAX_CHARACTERS", "600"))))
        if not text.strip() or len(text) > maximum:
            raise ElevenLabsFailure("text_limit")
        if not generation_key:
            raise ElevenLabsFailure("missing_generation_key")
        import av  # Validate decoder availability before any paid dispatch.

        identity = reserve(generation_key, text, model)
        start = time.monotonic()
        state = "failed"
        duration = None
        try:
            # No user identity/history/source metadata, no voice options from browser.
            with requests.post(
                f"{BASE}/v1/text-to-speech/{voice}",
                headers={
                    "xi-api-key": key,
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                },
                params={"output_format": "mp3_44100_128"},
                json={"text": text, "model_id": model},
                timeout=(3, 15),
                stream=True,
                allow_redirects=False,
            ) as response:
                if response.status_code != 200:
                    category = {
                        401: "credentials",
                        403: "voice_or_access",
                        402: "credits",
                        422: "unsupported",
                        429: "rate_or_credits",
                    }.get(response.status_code, "provider_failure")
                    # Inspect only bounded structured error codes, never surface
                    # provider messages or credential-bearing response bodies.
                    try:
                        import json

                        body = bytearray()
                        for chunk in response.iter_content(1024):
                            body.extend(chunk)
                            if len(body) > 4096:
                                break
                        detail = json.loads(body[:4096]).get("detail", {})
                        code = (
                            detail.get("status") if isinstance(detail, dict) else None
                        )
                        if code in (
                            "paid_plan_required",
                            "payment_required",
                            "quota_exceeded",
                            "insufficient_credits",
                            "missing_permissions",
                            "invalid_api_key",
                            "detected_unusual_activity",
                        ):
                            category = code
                    except (ValueError, TypeError, AttributeError):
                        pass
                    raise ElevenLabsFailure(category)
                if (
                    response.headers.get("Content-Type", "").split(";")[0].strip()
                    != "audio/mpeg"
                ):
                    raise ElevenLabsFailure("invalid_audio")
                chunks = []
                size = 0
                for chunk in response.iter_content(16384):
                    size += len(chunk)
                    if size > 4_000_000 or time.monotonic() - start > 18:
                        raise ElevenLabsFailure("response_limit")
                    chunks.append(chunk)
                data = b"".join(chunks)
                duration = validate_mp3(data)
                state = "success"
                return data
        except requests.Timeout:
            raise ElevenLabsFailure("timeout") from None
        except requests.RequestException:
            raise ElevenLabsFailure("network") from None
        finally:
            latency = time.monotonic() - start
            finish(identity, state, latency, duration)
            logger.info(
                "elevenlabs_tts",
                extra={
                    "model": model,
                    "characters": len(text),
                    "state": state,
                    "latency_ms": round(latency * 1000),
                    "audio_seconds": duration,
                },
            )


def account_catalog():
    key, voice, model = settings()
    try:
        with requests.get(
            BASE + "/v1/models",
            headers={"xi-api-key": key},
            timeout=(3, 10),
            allow_redirects=False,
        ) as response:
            if response.status_code != 200:
                raise ElevenLabsFailure("catalog_access")
            models = response.json()
        if not any(
            m.get("model_id") == model and m.get("can_do_text_to_speech")
            for m in models
        ):
            raise ElevenLabsFailure("unsupported_model")
        with requests.get(
            BASE + "/v1/voices/" + voice,
            headers={"xi-api-key": key},
            timeout=(3, 10),
            allow_redirects=False,
        ) as response:
            if response.status_code != 200:
                raise ElevenLabsFailure("voice_access")
        return {"model": model, "voice": voice, "available": True}
    except (requests.RequestException, ValueError):
        raise ElevenLabsFailure("catalog_access") from None


def usage_status():
    today = datetime.now(timezone.utc).date().isoformat()
    with budget_db() as con:
        rows = con.execute(
            "SELECT state,COUNT(*),SUM(characters) FROM generations WHERE day=? GROUP BY state",
            (today,),
        ).fetchall()
    return {
        "utcDay": today,
        "attempts": [
            {"state": state, "requests": count, "submittedCharacters": characters}
            for state, count, characters in rows
        ],
        "exactMonetaryCost": None,
    }

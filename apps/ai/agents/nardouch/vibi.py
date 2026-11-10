"""Metered single-speaker Eleven v4 synthesis through Vibi."""
import json
import logging
import os
import re
import time
from urllib.parse import urlsplit

import requests

from .elevenlabs import ElevenLabsFailure, finish, reserve, validate_mp3

BASE = "https://api.vibi.pro"
MODEL = "eleven_v4"
LANGUAGES = ("ar", "fr", "en")
USER_AGENT = "Noveris/1.0"
logger = logging.getLogger(__name__)


def settings(language: str):
    if os.getenv("NARDOUCH_TTS_DEMO_ENABLED", "false").lower() != "true":
        raise ElevenLabsFailure("disabled")
    if language not in LANGUAGES:
        raise ElevenLabsFailure("unsupported_language")
    key = os.getenv("VIBI_API_KEY", "")
    voice = os.getenv(f"VIBI_VOICE_ID_{language.upper()}", "")
    if not key or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", voice):
        raise ElevenLabsFailure("configuration")
    return key, voice


def _request(method, url, deadline, headers, status, limit, **kwargs):
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise ElevenLabsFailure("timeout")
    with requests.request(
        method, url, headers=headers, timeout=(min(2, remaining), min(4, remaining)),
        stream=True, allow_redirects=False, **kwargs
    ) as response:
        if response.status_code != status:
            category = {401: "credentials", 402: "credits", 403: "voice_or_access",
                        422: "unsupported", 429: "rate_or_credits"}
            raise ElevenLabsFailure(category.get(response.status_code, "provider_failure"))
        content = bytearray()
        for chunk in response.iter_content(16384):
            if time.monotonic() >= deadline:
                raise ElevenLabsFailure("timeout")
            content.extend(chunk)
            if len(content) > limit:
                raise ElevenLabsFailure("response_limit")
        return bytes(content)


def _json_request(method, path, deadline, key, status=200, **kwargs):
    headers = {"xi-api-key": key, "User-Agent": USER_AGENT, "Accept": "application/json"}
    body = _request(method, BASE + path, deadline, headers, status, 32768, **kwargs)
    try:
        result = json.loads(body)
        if isinstance(result, dict):
            return result
    except (ValueError, UnicodeError):
        pass
    raise ElevenLabsFailure("invalid_response")


class VibiTTSProvider:
    def synthesize(self, text, generation_key=None, language=None):
        key, voice = settings(language)
        maximum = min(600, max(1, int(os.getenv("NARDOUCH_TTS_MAX_CHARACTERS", "600"))))
        if not text.strip() or len(text) > maximum:
            raise ElevenLabsFailure("text_limit")
        if not generation_key:
            raise ElevenLabsFailure("missing_generation_key")
        import av  # Require a working decoder before starting a paid task.

        identity = reserve(generation_key, text, f"vibi:{MODEL}")
        started = time.monotonic()
        deadline = started + 35
        duration = None
        try:
            task = _json_request(
                "POST", f"/v1/text-to-speech/{voice}", deadline, key, status=202,
                json={"text": text, "provider": "elevenlabs", "model_id": MODEL,
                      "language_code": language},
            )
            task_id = task.get("id")
            if not isinstance(task_id, str) or not re.fullmatch(
                r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}", task_id
            ):
                raise ElevenLabsFailure("invalid_response")
            while deadline - time.monotonic() > 1:
                time.sleep(1)
                task = _json_request("GET", f"/v1/history/{task_id}", deadline, key)
                status = task.get("status")
                if status == "completed":
                    result = task.get("result")
                    url = result.get("audio_url") if isinstance(result, dict) else None
                    if not isinstance(url, str):
                        raise ElevenLabsFailure("invalid_response")
                    parsed = urlsplit(url)
                    if parsed.scheme != "https" or parsed.netloc != "api.vibi.pro" or not parsed.path.startswith("/audio/"):
                        raise ElevenLabsFailure("invalid_audio_url")
                    data = _request("GET", url, deadline, {"User-Agent": USER_AGENT},
                                    200, 4_000_000)
                    duration = validate_mp3(data, sample_rates=(22050, 24000, 32000, 44100, 48000))
                    return data
                if status not in ("pending", "processing"):
                    raise ElevenLabsFailure("provider_failure")
            raise ElevenLabsFailure("timeout")
        except ElevenLabsFailure as error:
            logger.info("Vibi speech unavailable (%s)", error.category)
            raise
        except requests.Timeout:
            raise ElevenLabsFailure("timeout") from None
        except requests.RequestException:
            raise ElevenLabsFailure("network") from None
        finally:
            finish(identity, "success" if duration else "failed",
                   time.monotonic() - started, duration)

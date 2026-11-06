"""One bounded, killable local worker; no request-time downloads or remote inference."""

import atexit
import socket
import hashlib
import io
import json
import multiprocessing as mp
import os
from pathlib import Path
import threading
import time
import wave
from utils.logger import get_logger

logger = get_logger(__name__)
_lock = threading.Lock()
_process = None
_pipe = None
_state = "cold"
_metrics = {}


def model_path(kind):
    root = Path(os.environ.get("NARDOUCH_SPEECH_MODEL_DIR", "/models/nardouch")) / kind
    if kind == "piper":
        root = Path(os.getenv("NARDOUCH_PIPER_MODEL_DIR", str(root)))
    manifest = json.loads((root / "manifest.json").read_text())
    if (
        manifest.get("licenseReviewed") is not True
        or len(manifest.get("revision", "")) != 40
    ):
        raise ValueError("Unreviewed or unpinned model")
    for name, digest in manifest["files"].items():
        target = (root / name).resolve()
        if (
            not target.is_relative_to(root.resolve())
            or hashlib.sha256(target.read_bytes()).hexdigest() != digest
        ):
            raise ValueError("Model integrity check failed")
    return root


def _worker(pipe):
    os.environ.update(
        HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1"
    )

    def deny_network(*args, **kwargs):
        raise OSError("Speech worker network access is prohibited")

    socket.socket.connect = deny_network
    models = {}
    while True:
        message = pipe.recv()
        if message is None:
            pipe.close()
            return
        kind, payload, locale = message
        try:
            started = time.perf_counter()
            cpu_started = time.process_time()
            initialization = 0.0
            root = model_path(kind) if kind not in models else None
            if kind not in models:
                available = next(
                    int(line.split()[1])
                    for line in Path("/proc/meminfo").read_text().splitlines()
                    if line.startswith("MemAvailable:")
                )
                if (
                    available
                    < (512 if kind == "piper" else 1024 if kind == "asr" else 6144)
                    * 1024
                ):
                    raise MemoryError("Insufficient available RAM for local speech")
            if kind == "piper":
                from .piper_runtime import load_piper, synthesize_piper, validate_wav

                if kind not in models:
                    models[kind] = load_piper(root)
                    initialization = time.perf_counter() - started
                output = synthesize_piper(models[kind], payload)
            elif kind == "asr":
                import numpy as np
                from faster_whisper import WhisperModel

                if kind not in models:
                    models[kind] = WhisperModel(
                        str(root),
                        device=os.getenv("NARDOUCH_ASR_DEVICE", "cpu"),
                        compute_type=os.getenv("NARDOUCH_ASR_COMPUTE_TYPE", "int8"),
                        local_files_only=True,
                        cpu_threads=4,
                        num_workers=1,
                    )
                with wave.open(io.BytesIO(payload), "rb") as audio:
                    samples = (
                        np.frombuffer(
                            audio.readframes(audio.getnframes()), dtype="<i2"
                        ).astype(np.float32)
                        / 32768
                    )
                if np.max(np.abs(samples)) < 0.0001:
                    raise ValueError("Silence")
                hint = os.getenv("NARDOUCH_ASR_LANGUAGE", "auto")
                segments, _ = models[kind].transcribe(
                    samples,
                    language=None if hint == "auto" else hint,
                    task="transcribe",
                    vad_filter=True,
                    beam_size=5,
                    condition_on_previous_text=False,
                )
                output = " ".join(s.text.strip() for s in segments).strip()
                if not output:
                    raise ValueError("No speech detected")
            else:
                # Documented VoxCPM2 API. No reference audio / speaker cloning.
                from voxcpm import VoxCPM
                import numpy as np

                if len(payload) > 600:
                    raise ValueError("Spoken answer too long; read the full text")
                if kind not in models:
                    models[kind] = VoxCPM.from_pretrained(
                        str(root),
                        load_denoiser=False,
                        local_files_only=True,
                        optimize=False,
                        device=os.getenv("NARDOUCH_TTS_DEVICE", "cpu"),
                    )
                samples = np.asarray(
                    models[kind].generate(text="(Tunisian Dialect) " + payload)
                ).reshape(-1)
                if not np.isfinite(samples).all() or not 0 < len(samples) <= 48000 * 60:
                    raise ValueError("Invalid TTS waveform")
                buffer = io.BytesIO()
                with wave.open(buffer, "wb") as audio:
                    audio.setnchannels(1)
                    audio.setsampwidth(2)
                    audio.setframerate(48000)
                    audio.writeframes(
                        (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
                    )
                output = buffer.getvalue()
            metrics = {
                "kind": kind,
                "initializationSeconds": initialization,
                "requestSeconds": time.perf_counter() - started,
                "cpuSeconds": time.process_time() - cpu_started,
            }
            if kind == "piper":
                metrics["audioSeconds"] = validate_wav(output)
                metrics["realTimeFactor"] = (
                    metrics["requestSeconds"] / metrics["audioSeconds"]
                )
                metrics["executionProviders"] = models[kind].session.get_providers()
            pipe.send(("ok", (output, metrics)))
        except Exception as error:
            pipe.send(("error", type(error).__name__))


def shutdown():
    global _process, _pipe, _state
    if _process is not None:
        try:
            if _process.is_alive() and _pipe is not None:
                _pipe.send(None)
        except (OSError, EOFError):
            pass
        _process.join(timeout=3)
        if _process.is_alive():
            _process.kill()
            _process.join()
    if _pipe is not None:
        _pipe.close()
    _process = _pipe = None
    _state = "cold"


def infer(kind, payload, locale=None):
    global _process, _pipe, _state, _metrics
    from .voice import VoiceUnavailable

    if not _lock.acquire(blocking=False):
        raise VoiceUnavailable("Local speech is busy; retry shortly")
    start = time.perf_counter()
    try:
        if _process is None or not _process.is_alive():
            shutdown()
            # Validate before spawning or importing heavyweight runtimes.
            model_path(kind)
            context = mp.get_context("spawn")
            _pipe, child = context.Pipe()
            _process = context.Process(target=_worker, args=(child,), daemon=True)
            _process.start()
            child.close()
        _state = "busy"
        _pipe.send((kind, payload, locale))
        if not _pipe.poll(
            min(120, max(1, float(os.getenv("NARDOUCH_SPEECH_TIMEOUT_SECONDS", "18"))))
        ):
            shutdown()
            raise VoiceUnavailable("Local speech timed out; text remains available")
        status, output = _pipe.recv()
        _state = "ready" if status == "ok" else "failed"
        if status != "ok":
            raise VoiceUnavailable(
                "Local speech failed; check weights, runtime and available memory"
            )
        output, _metrics = output
        return output
    except (OSError, ValueError, KeyError, EOFError) as error:
        _state = "unavailable"
        raise VoiceUnavailable(
            "Local speech unavailable; provision verified model weights and runtime"
        ) from None
    finally:
        logger.info(
            "local_speech_request",
            extra={
                "kind": kind,
                "state": _state,
                "latency_ms": round((time.perf_counter() - start) * 1000),
                "worker_pid": _process.pid if _process else None,
            },
        )
        _lock.release()


def readiness():
    memory = {}
    if _process and _process.is_alive():
        try:
            memory = {
                line.split(":")[0]: line.split(":")[1].strip()
                for line in Path(f"/proc/{_process.pid}/status")
                .read_text()
                .splitlines()
                if line.startswith(("VmRSS:", "VmHWM:"))
            }
        except OSError:
            pass
    return {
        "metrics": _metrics,
        "memory": memory,
        "state": _state,
        "workerPid": _process.pid if _process and _process.is_alive() else None,
        "workerAlive": bool(_process and _process.is_alive()),
        "queueCapacity": 0,
        "maxConcurrency": 1,
    }


atexit.register(shutdown)

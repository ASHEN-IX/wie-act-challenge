# Noveris AI service — course ingestion and learning agents

Independent Python FastAPI and RabbitMQ workers. See [AI operations](../docs/ai-service.md) for compatible Python/Poetry setup, separate HTTP/worker launch, secrets and uploads; [AI specification](../docs/ai-specification.md) distinguishes actual agents/models/fallback from the PLANNED peer facilitator.

Without provider credentials the service runs in explicit mock mode (`LLM_MOCK=1`); real calls require an operator-issued, bounded approval from the API ledger. See [model configuration](../docs/llm-config.md).

## Docker dependencies and build cache

Build from the repository root with:

```sh
docker build -t ednova-ai:local apps/ai
```

The Linux x86_64 environment uses CPU-only PyTorch from the explicit
[PyTorch wheel index](https://download.pytorch.org/whl/cpu). PyTorch is required
by `sentence-transformers` for course and tutor embeddings; the container does
not need its CUDA libraries. GPU deployments need a different PyTorch source.

The CPU-only `tensorflow-cpu` package runs focus detection (the Python import
remains `tensorflow`). MediaPipe and SciPy run fatigue detection,
and `opencv-contrib-python` supplies `cv2` for both. Keep one OpenCV
distribution installed: MediaPipe requires the contrib distribution, which
already includes the standard OpenCV modules. PDF/OCR dependencies are used
by course ingestion. Training notebooks and camera demos have separate
requirements under `ML/focus` and are excluded from the image.

TensorFlow is pinned to the previously locked version, `2.20.0`. For the
Python 3.12 Linux x86_64 wheels, this replaces a roughly 621 MB download with
a 259 MB download, saving about 362 MB. These are package download sizes,
not the final image size.

Unused direct `structlog` and `pydantic-settings` declarations were removed.
Logging uses the standard library, and configuration uses environment variables.
LiteLLM still installs `pydantic-settings` as a transitive dependency.

The Docker build installs production dependencies before copying source, shares
the native-library layer between stages, and caches APT, pip and Poetry downloads.
Source-only rebuilds reuse the dependency layer. Keep BuildKit caching enabled
and avoid `--no-cache` for routine builds. Poetry and development tools are
excluded from the runtime image. Initial builds still download the inference
libraries; cached rebuilds should be substantially faster.

APT package archives and indexes use persistent BuildKit cache mounts, so
completed package downloads survive interrupted builds. These caches remain
outside the runtime image. The first build still needs to fetch native
libraries and Python wheels; allow it to finish on slow connections. Changes
to the APT build instruction require that layer to run again once. Editing
the Dockerfile does not change a build that is already running.

Python dependency installation uses at most four concurrent workers, a
120-second HTTP read timeout, and up to five download retries where the
server supports resuming. This reduces failures on slow connections to
`files.pythonhosted.org`. Rebuild normally after a download timeout to reuse
the existing APT, pip, and Poetry caches; do not use `--no-cache` or prune
the builder cache to troubleshoot network failures.

### Study Together voice moderator

Run the worker in a separate Python 3.12 environment from the `apps/ai` directory:

```sh
python3.12 -m venv .venv-voice
.venv-voice/bin/pip install -r requirements-voice-moderator.txt
.venv-voice/bin/python -m agents.voice_moderator.worker start
```

Export `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` for the same
LiveKit server used by the study API. Set `LIVEKIT_MODERATOR_AGENT_NAME` to the
same name on the worker and API (for example, `ednova-study-moderator`).
The worker also requires `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, and
`CARTESIA_VOICE_ID`.

When the presenter requests moderation, the worker subscribes to authorized
microphone tracks. Deepgram transcribes the audio and Cartesia speaks prompts
selected by Noveris's peer-first policy. The worker keeps a bounded turn
transcript in memory and does not write room audio or transcripts to disk.

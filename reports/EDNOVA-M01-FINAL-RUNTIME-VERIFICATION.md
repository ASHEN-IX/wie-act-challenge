# EdNova M01 final runtime verification — 23 October 2026

**Decision: PASS. M01 is complete and ED-01 is DONE for the canonical local engineering baseline.** M02 has not started. No staging, commits, pushes, publication, deployment or external provider inference occurred.

Repository `/home/ashenix/Projects/mindflow`; mission-start HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`, branch `main`. Prerequisites: [M00 audit](EDNOVA-M00-SOURCE-AUDIT.md), [M01 baseline](EDNOVA-M01-BASELINE.md), [M01 continuation](EDNOVA-M01-CONTINUATION-VERIFICATION.md). This report supersedes their remaining Python/runtime gate, while preserving their historical results. Dates use Africa/Tunis.

## Dependency root cause and runtime decision

The failed heavy installation was an artifact-transfer failure, not a resolver conflict, unsupported Python platform or exhausted disk/inodes. The required Linux x86_64/Python 3.12 wheels exist on PyPI and match the canonical lock. One measured transfer delivered approximately 1.7 MB in 20 seconds (86 KB/s). Native Debian package downloads also stalled during an earlier image attempt. A later OpenCV wheel transfer failed with `SSL: DECRYPTION_FAILED_OR_BAD_RECORD_MAC`; TLS verification was retained. Refreshing the builder artifact cache from the complete host installation admitted 282 lock-verified wheel files (including platform variants) and removed that download from the final install. Increasing complete-download retries discarded useful progress; interrupted processes and temporary-directory loss additionally interrupted verification. The original failures and bounded stops remain in the local evidence, including the interrupted Docker RPC EOF. An interrupted process without a captured exit is not recorded as a pass.

The canonical graph is **CUDA-capable**, with Torch 2.10.0, TorchVision 0.25.0, TorchAudio 2.10.0 and TensorFlow 2.20.0. It was preserved without a CPU-wheel substitution, dependency deletion, alternate lock or relaxed TLS/hash validation. Local embeddings use SentenceTransformer automatic device selection; FAISS CPU, OCR/PDF and image operations can execute on CPU. Evaluator, tutor, planner enrichment and facilitator model requests use the shared remote transport. Optional focus/face features use local TensorFlow/MediaPipe. No explicit mandatory CUDA device selection was found in embedding wrappers.

The host reports an RTX 4050 Laptop GPU, but GPU execution and live camera behavior were deliberately not tested. Passing CPU operations in the canonical CUDA-capable environment does not validate a separate CPU-only package profile or GPU deployment. [PyTorch documents a version-aligned CPU distribution](https://pytorch.org/get-started/previous-versions/); adopting a separate source/profile would require a reviewed single-manifest/lock change and the same verification matrix. None was implemented.

All 22 heavy packages below are pinned. The trusted availability inventory records the compatible wheel filename, Linux/x86_64 marker, exact URL, expected bytes and SHA256 for each. NVIDIA/CUDA packages are transitive through Torch and its runtime libraries; Torch/TensorFlow/TorchVision/TorchAudio are direct manifest dependencies. The target CPU checks do not require an exposed GPU, but the unchanged canonical Linux graph still installs these artifacts.

| Package | Locked version | Dependency | Required by |
|---|---|---|---|
| cuda-bindings | 12.9.4 | transitive | torch |
| cuda-pathfinder | 1.3.3 | transitive | cuda-bindings |
| nvidia-cublas-cu12 | 12.8.4.1 | transitive | nvidia-cudnn-cu12, nvidia-cusolver-cu12, torch |
| nvidia-cuda-cupti-cu12 | 12.8.90 | transitive | torch |
| nvidia-cuda-nvrtc-cu12 | 12.8.93 | transitive | torch |
| nvidia-cuda-runtime-cu12 | 12.8.90 | transitive | torch |
| nvidia-cudnn-cu12 | 9.10.2.21 | transitive | torch |
| nvidia-cufft-cu12 | 11.3.3.83 | transitive | torch |
| nvidia-cufile-cu12 | 1.13.1.3 | transitive | torch |
| nvidia-curand-cu12 | 10.3.9.90 | transitive | torch |
| nvidia-cusolver-cu12 | 11.7.3.90 | transitive | torch |
| nvidia-cusparse-cu12 | 12.5.8.93 | transitive | nvidia-cusolver-cu12, torch |
| nvidia-cusparselt-cu12 | 0.7.1 | transitive | torch |
| nvidia-nccl-cu12 | 2.27.5 | transitive | torch |
| nvidia-nvjitlink-cu12 | 12.8.93 | transitive | nvidia-cufft-cu12, nvidia-cusolver-cu12, nvidia-cusparse-cu12, torch |
| nvidia-nvshmem-cu12 | 3.4.5 | transitive | torch |
| nvidia-nvtx-cu12 | 12.8.90 | transitive | torch |
| tensorflow | 2.20.0 | direct | application manifest |
| torch | 2.10.0 | direct | sentence-transformers, torchaudio, torchvision |
| torchaudio | 2.10.0 | direct | application manifest |
| torchvision | 0.25.0 | direct | application manifest |
| triton | 3.6.0 | transitive | torch |

Trusted artifacts were fetched from `pypi.org` metadata and `files.pythonhosted.org`, with bounded range/resume transfers and complete SHA256 verification against the unchanged Poetry lock before cache admission. All 22 heavy wheels, approximately 4.75 GB combined, were verified. No partial artifact was promoted into the cache. Disk/RAM/inode checks showed sufficient capacity. Index configuration was inspected without exposing credentials.

## Complete Python installation and runtime

Supported tooling: Python 3.12.15 and Poetry 2.5.1. The full existing environment completed:

```bash
poetry check --lock
poetry install --with dev --no-interaction --no-ansi
python -m pip check
```

The exact executable paths, environment overrides, working directories, deadlines and exits are retained per command in the evidence ledger. Full cached installation exits 0 in 109.26 seconds. `pip check` exits 0. Installed-version comparison finds **261 packages matching the lock and zero mismatches**; four uninstalled lock entries have incompatible Darwin/Windows/Python-3.11 markers. The lock itself remains byte-for-byte identical to mission start.

The existing public embedding model `sentence-transformers/all-MiniLM-L6-v2` was cached at commit `1110a243fdf4706b3f48f1d95db1a4f5529b4d41` from its [official repository](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2). Ten configuration/tokenizer/safetensors files were downloaded without credentials or remote code; file hashes are recorded. This is a local CPU embedding prerequisite, not hosted provider inference. The subsequent suite ran with Hugging Face offline flags.

The complete configured Python collection contains **823 tests**. Final headless execution passes **818, with five existing skips and 59 warnings**, exit 0. Camera/GPU device nodes were hidden using `bwrap`; a verification-only socket guard permitted loopback test infrastructure and denied external provider sockets. No repository test was excluded or marked skipped by this mission. The five pre-existing manual prerequisites are:

- One scheduler test requires a live MongoDB with its hardcoded seeded course document.
- Two full-workflow tests and one ingestion/planner test require the absent `agents/course_ingestion/tests/test.pdf`.
- One ingestion/planner test requires the absent `agents/tests/course_ingestion/tests/testing.pdf`.

These manual end-to-end scenarios remain unverified; their existing skip reasons are explicit. The canonical ED-01 criterion requires applicable tests to pass and Python/skips policy to be explicit. No learning-outcome, approved-provider, media or full-feature acceptance is inferred from this baseline.

The CI-selected set passes **97** tests (89 existing plus eight new runtime/unavailable cases); the separate learning/evaluator set passes **176**, both inside the complete environment. These subsets overlap the 818 total and are not additional independent coverage counts.

Eleven host runtime probes pass: actual API bootstrap; ingestion/evaluator/planner/coach/search/schedule worker imports; retrieval/index imports; provider-client imports; Torch/TensorFlow CPU operations; FAISS indexing/query; OpenCV image encoding and MediaPipe import; synthetic PDF rendering through PyMuPDF/Poppler; installed Tesseract; and missing-credential unavailability. CUDA initialization warnings under intentionally hidden devices are not GPU acceptance.

## Narrow baseline repairs

- Shared LLM transport now runs caller mocks only under explicit `LLM_MOCK=1`. Missing usable provider credentials otherwise raise `LLMUnavailableError` with state `UNAVAILABLE`, before invoking either router or mock responder. Explicit test responses log `MOCK_TEST`. Configured provider failures retain their existing error/retry behavior. No `REAL_APPROVED` inference was attempted or claimed.
- API bootstrap uses package-qualified router/dependency imports. Removing its `sys.path` prepend prevents `services/api/security.py` from shadowing the shared `security` package in combined import/test collection. Routes and business contracts are preserved.
- Pytest uses importlib mode so coach and evaluator `test_agent.py` files both collect. No test path exclusion or dependency graph change was introduced.
- Explicit planner mock mode without a responder returns an empty task list to select the caller's existing deterministic rule fallback. It previously returned the malformed-output sentinel, retried and raised instead. The higher-level regression now verifies one attempt and fallback selection; malformed configured output still retries/fails as before. This is `DETERMINISTIC_FALLBACK`, not model-generated success.
- The workspace browser assertion filters its denial alert by the existing denial text, avoiding collision with Next's route-announcer alert. Application UI/runtime is unchanged.
- Docker retains verified Poetry artifacts in a BuildKit cache mount. Downloads stay outside the image layer, following [Docker cache-mount guidance](https://docs.docker.com/build/cache/optimize/). A temporary outside-repository seed context imported only wheels whose SHA256 matches this same lock. It adds no competing manifest or package source.

Initial unavailable-policy tests failed before the repair. Combined imports reproduced the shadowing failure; default collection reproduced duplicate module names; the full suite reproduced missing model weights and then the planner fallback failure. Native probe setup initially asserted the wrong matrix sum (16 instead of 8); the probe arithmetic was corrected without a runtime workaround. Failed attempts remain evidence, not successful acceptance.

## Docker/runtime gate

The actual canonical build passes, exit 0 in **254.55 seconds**, using:

```bash
docker --context default build --progress=plain -t ednova-m01-ai:verification apps/ai
```

The locked dependency layer completes in 31.5 seconds; export/unpack is included in the successful total, not treated as a partial build. Image manifest ID: `sha256:3d2d905c680812fafdc5ce332fa2ad5887401475db3f28d8e17a96a308ad7208`; Linux amd64, Python 3.12.15. Docker reports 17,031,966,754 bytes for the unchanged heavyweight runtime graph. No separate lightweight/CPU distribution is claimed.

Two fresh loopback-bound containers pass real startup and configured Docker health, remaining alive until clean stop with exit 0. `/health` returns 200. Missing service authentication configuration returns 503; invalid service key returns 401; authenticated invalid schema returns 422; the existing deterministic decline/opt-out returns 200 without inference. Image `pip check` and all eleven native/import/unavailable probes pass. Runtime checks assert no `/app/.env`, host `.venv` or mounted Poetry artifact cache appears in the image. Both container logs were checked and do not contain the synthetic service key. The API starts with Mongo/provider services unavailable; health is explicitly application readiness.

The first image smoke harness assumed Docker always emits an empty `Config.User` field; Docker omitted it. The harness was corrected to use its default value, with no image/source workaround, then the complete smoke passed (55.55 seconds). This failed harness attempt remains recorded.

After image health, the existing Node publisher/broker fixture also passes with its Python worker launched **from this image**, using only the fixture's isolated RabbitMQ/Redis and synthetic envelopes. It verifies completion, duplicates, Redis persistence over worker restart, fresh work, three retries, terminal failure/DLQ, malformed envelopes, ACK/drain and clean process shutdown. The handler is explicitly deterministic. The image does not start broker workers implicitly; the HTTP entry point and separately configured workers retain their existing roles.

The canonical Dockerfile retains Python 3.12 slim Bookworm, Poetry 2.5.1 in a separate tooling environment, a locked `/opt/venv`, existing native document/OCR/image libraries and `uvicorn services.api.main:app` on port 8000. Its existing `/health` check establishes application readiness, not provider readiness. Build context excludes `.env` files, local `.venv` and Python caches. No host virtualenv, provider key, downloaded wheel archive or external embedding-cache directory is copied into the image. Existing repository model assets are retained.

The host's Docker context changed during execution. Final infrastructure/image commands explicitly use context `default`, which owns the verification images and isolated test services. A failed attempt on `desktop-linux` hit ports already held by the mission's existing services; those services were reused on their owning daemon. No global context change or unrelated container cleanup was performed.

## Preserved regression gates

| Final gate | Result |
|---|---|
| Root lint | Exit 0; zero errors, 120 existing warnings |
| Root strict TypeScript | Exit 0 |
| Root tests | Exit 0: routes 6; Jest 55 suites / 520 tests; Node unit 10; real Node integration 88; auth 17; web 29 |
| Root production build | Exit 0, API and web |
| Contract generation | Exit 0; generated adapters preserved |
| Auth/smoke/workspace Playwright | Exit 0; eight passed |
| Production room/replay/security browser runner | Exit 0 |
| Production presence browser runner | Exit 0 |
| Production peer-text browser runner | Exit 0 |
| Fresh API/web image builds and container smoke | Exit 0; API Mongo health, landing HTML, proxied health and anonymous room 401 |
| Real RabbitMQ/Redis + complete Python worker | Exit 0; confirms/results, deduplication, worker restart recovery, retries, failed result/DLQ, malformed envelope and clean drain |
| Full Python / selected CI / learning sets | Exit 0; 818 passed + five existing skips / 97 passed / 176 passed |
| Full Python native import/operation probes | Exit 0; eleven checks |
| Actual AI image build / runtime | Exit 0; complete image, two healthy containers, eleven native checks, clean stop |
| Image-based Python broker worker | Exit 0; real transport, deterministic handler |

The 88 real Node integration tests include 81 ED-07 and seven existing deterministic ED-09 tests; they do not complete either feature's canonical acceptance. Browser room stage logs represent scenarios rather than independent test counts. Broker handlers return explicit synthetic fixture results (`MOCK_TEST`); actual transport, acknowledgments, Redis state, retry/dead-letter behavior and process restarts are real. No provider request was made.

Two verification attempts overlapped and collided on the browser server port. The outside-repository command wrapper was corrected to propagate failure exits; the final eight-test browser suite and all three production scenarios were rerun sequentially and pass. Earlier failed port attempts are retained and not counted as passes. No repository setting was changed to reuse an unrelated server.

## Attribution, cleanup and completion

The mission-start manifest fingerprints **1,730 existing files**: **1,713 preserved byte-for-byte, 17 deliberately changed, zero missing**. The two new source files are `apps/ai/tests/test_api_runtime.py` and `apps/ai/tests/test_llm_unavailable.py`; the third new Git-eligible deliverable is this authored report. The mission-only patch records changes relative to the original dirty tree, not HEAD. Earlier M01/ED-07/ED-09 work is not attributed to this mission.

Changed existing paths: AI Dockerfile/pytest configuration; shared LLM client and its tests; API bootstrap and four router dependency imports; planner decomposer and regression; one web E2E locator; five current documentation files. `apps/ai/poetry.lock`, Node manifests/lock, CI configuration, existing room/replay/presence/peer-text runtime, source projections and earlier reports/evidence remain unchanged from this mission's start. Backlog ED-01 is the only task promoted to DONE.

Both named synthetic Python databases were removed. Owned smoke/worker/broker containers were removed; dedicated Mongo/Mailpit were stopped to restore their initial state. No unrelated database, container, image or cache was removed. Local verification image tags and trusted dependency/model caches remain for reproducibility. Staging is empty and HEAD is unchanged.

Authored reports remain Git-eligible. Raw logs, screenshots, patches, inventories and command records remain local under ignored `reports/evidence/ednova-m01-final-runtime-2026-10-23/`, following the existing ignore policy. The [command ledger](evidence/ednova-m01-final-runtime-2026-10-23/command-ledger.json) records exact arguments, cwd, exits and durations; the [before/after manifest](evidence/ednova-m01-final-runtime-2026-10-23/working-tree.json) and [mission-only patch](evidence/ednova-m01-final-runtime-2026-10-23/mission-change.patch) distinguish this work from the pre-existing dirty tree.

**M01: PASS; ED-01: DONE.** Every canonical baseline gate is evidenced locally. There are no remaining M01 blockers. The five existing manual-fixture skips, 120 lint warnings and Python deprecation warnings remain explicit limitations; they were not hidden or promoted into feature acceptance. Remote GitHub Actions, approved external inference, GPU execution, live camera/voice, learning outcomes, multi-instance room behavior and the skipped manual workflows were not verified.

**Exactly one next mission: M02 — resource/transport isolation (ED-02).** M02 has not started. ED-03 and all downstream feature statuses retain their existing separate acceptance gates.

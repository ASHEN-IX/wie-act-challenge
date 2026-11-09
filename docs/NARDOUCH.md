# Nardouch implementation

## Phase 0: repository audit and plan

The actual application uses Next.js 16 / React 19, a NestJS modular monolith
hosting Study domain contracts, Better Auth sessions, PostgreSQL/Prisma, a private
FastAPI service, and RabbitMQ workers. Redis supports rate limiting and optional
LLM response caching. Older descriptions of independently deployed Node APIs and
browser-side Python authentication are obsolete; the gateway authorizes students
and Python requires `AI_SERVICE_API_KEY`.

Reuse: `resourceAccess`, `coursePublication`, `revisionSources`, exact-revision
`tutor.grounding` retrieval, shared LiteLLM `ask`, published activities, the private
attempt/evaluator/Bloom workflow, and existing Study Circle facilitation. The old
search voice helper uses the server microphone and desktop TTS; it is unsuitable
for browser audio and will not be used. Existing UI branding has evolved to
Noveris/Nova Orbit tokens; the assistant inherits those tokens without rebranding.

Missing: multilingual conversation orchestration, durable private history, language
and writing preferences, bounded model selection, browser recording/review, and
replaceable cloud speech adapters.

Implementation sequence: (1) course workspace text slice, shared RAG and typed
contracts, session-derived identity, PostgreSQL continuity, compact/capable routing,
validation and failure tests; (2) explicit push-to-talk and speech providers;
(3) deeper targeted assessment integration through the existing attempt workflow;
(4) shared Study Circle facilitation through its existing membership/projection
boundary; (5) provider and native-speaker evaluation. Generated conversation text
never grants Bloom mastery or updates competency state.

API contract: authenticated `/api/v1/study/nardouch`, course/revision-bound
`POST /turn`, owner-only `GET /conversations/:id`, response-specific
`POST /conversations/:id/feedback`, `POST /transcribe`, and
`POST /conversations/:id/speech`. Browser payloads cannot choose user IDs, histories,
source manifests, competency records, provider URLs, or speech text. Unknown fields
are rejected. Reauthorization is required before and after inference.

Model configuration: new `nardouch_compact` and `nardouch_capable` LiteLLM aliases,
with environment-selected identifiers. Preserve existing exact-model approvals,
durable budgets and server-side provider credentials. Compact only handles short
clarifications; explanations, reasoning, practice and peer synthesis use capable.
A capable outage is shown explicitly, never relabeled as a successful explanation.

Privacy/reliability: no peer-profile input or room broadcast, no raw-audio storage,
bounded audio and history, owner-scoped records, rate limits, generation locks,
revision pins and exact artifact checks. Source identity validation does not prove
that every generated academic claim is correct. Prompt examples require human
review; no native-speaker validation is claimed.

Verification: Python unit/integration tests for language/routing/RAG/invalid outputs,
Node authorization/persistence/provenance tests, frontend component/recording tests,
TypeScript checks, and browser checks where the local service stack is available.
Provider quality and dialect naturalness require live credentials, a configured
published course, and native-speaker reviewers. Report measurements only after runs.

## Implemented slices and file map

Text slice:

- `apps/ai/agents/nardouch/{orchestrator,language,schemas}.py`, configurable
  `prompts.json` and `glossary.json`: educational/language separation and closed
  structured responses. `tutor/grounding.py` now exposes shared retrieval without
  changing the existing tutor response contract.
- `apps/ai/utils/llm_client.py`, `litellm/config.yaml`, and `services/api/main.py`:
  the two new aliases and the private router, retaining existing approvals.
- `apps/api/shared/ednova/nardouch.ts`: shared typed, closed input/output schemas.
  Study `models/NardouchConversation.ts`, `services/nardouch.ts`, and
  `routes/nardouch.ts`: owner-scoped history, feedback, exact source verification,
  optimistic versions, expiring generation locks, 80-message limit, and 30-day
  retention. `src/domain-definitions.ts` and its generated Study controller expose
  the operations in the actual Nest application; the retained Express app also
  mounts them. Nothing is sent to RabbitMQ or a room broadcast channel.
- `apps/web/src/features/nardouch/`: assistant, selectors, conversation/messages,
  source links, follow-ups and safe Server Action results. The existing
  `learning-workspace.tsx` embeds the panel and preserves excerpt lookup.

Voice slice:

- `apps/ai/agents/nardouch/voice.py`: ASR/TTS provider protocols, Azure and Google
  ASR, Azure Hedi/Reem TTS, real WAV size/format/duration checks, 3-second connect /
  18-second read timeouts, two concurrent voice dispatches per Python process.
- `apps/web/public/nardouch-recorder.js`, `recording.ts`, `voice-recorder.tsx` and
  `audio-player.tsx`: local AudioWorklet PCM capture, 16 kHz mono WAV encoding,
  explicit consent, 30-second stop, editable transcript, retry and discard,
  manual audio generation, native play/pause and explicit replay. Unmount closes
  the audio graph and microphone tracks. HTTPS or localhost is required.
- No new production dependencies. Speech uses existing `requests` and Python's
  `wave` module; browser audio uses native APIs. Display and speech text are kept
  equal in this iteration to avoid changing technical meaning. This is a safe
  identity speech adaptation, not a claim of optimized Arabizi pronunciation.

Educational integration currently hands the selected published objective back to
`startActivity("practice")` in the existing workspace. Reviewed activities continue
through its existing evaluator/attempt/Bloom pathway. Generated conversation
practice and feedback remain formative. A full assessment interaction inside the
chat is a later step. Peer mode currently prepares a **private** peer explanation;
it neither observes a group nor replaces the existing Study Circle facilitator.
Shared multilingual facilitation is not implemented in this slice.

## Configuration and running

Use the existing repository setup (`pnpm dev:setup`, `pnpm dev:infra:up`). Python
needs the locked `apps/ai/pyproject.toml` environment, including embedding runtime
and LiteLLM; Node and Python must share matching authorized revision source mounts.
Set these variables in the appropriate server environment, never `NEXT_PUBLIC_*`:

| Variable | Service / behavior |
| --- | --- |
| `AI_SERVICE_URL` | Node gateway; normally `http://localhost:8000` |
| `AI_SERVICE_API_KEY` | Same secret of at least 32 characters in Node and Python |
| `DATABASE_URL` | Existing application persistence settings (PostgreSQL) |
| `INGEST_UPLOADS_DIR`, `FAISS_INDEX_DIR` | Existing shared source/artifact paths |
| `REDIS_URL` | Existing shared rate limiting; existing middleware falls back locally during Redis outages |
| `NARDOUCH_COMPACT_MODEL` | Python; default existing compact deployment `groq/openai/gpt-oss-20b` |
| `NARDOUCH_CAPABLE_MODEL` | Python; default existing capable deployment `groq/openai/gpt-oss-120b` |
| Provider key, e.g. `GROQ_API_KEY` | Python; must match the selected model's provider |
| `LLM_APPROVALS_JSON` | Existing operator-configured approval for **each new alias**, bound to exact model and task, with valid expiry and request budget |
| `DATABASE_URL` (budget tables) | Existing durable LLM accounting, required by `ask` |
| `NARDOUCH_CONCURRENCY` | Python; default 4, clamped 1–16 per process |
| `NARDOUCH_PROMPTS_PATH` | Optional trusted JSON override; examples must be reviewed before approval |
| `NARDOUCH_ASR_PROVIDER` | `disabled` (default), `azure`, or `google` |
| `NARDOUCH_TTS_PROVIDER` | `disabled` (default) or `azure` |
| `AZURE_SPEECH_REGION`, `AZURE_SPEECH_KEY` | Server-side Azure speech configuration |
| `NARDOUCH_AZURE_VOICE` | `ar-TN-HediNeural` (default) or `ar-TN-ReemNeural` |
| `GOOGLE_SPEECH_API_KEY` | Google ASR key with Speech-to-Text enabled |

Each approval has the existing shape `{approvalId, model, task, expiresAt,
maxRequests}`; `task` is `nardouch_compact` or `nardouch_capable`, `model` matches
the configured full provider/model string, and `expiresAt` is a future Unix time.
Existing approvals for `coach` or `planner` do not grant the new aliases. This
implementation does not mint approvals or edit existing budgets. An absent key,
approval, revoked budget or failed capable provider returns an explicit 503.
Generation uses an 18-second model timeout, a 26-second Node upstream timeout and
no automatic retries. A user retry makes a fresh authorized reservation; a stale
conversation must first reload. This bounds retries without unmetered replay.

Run `pnpm dev:ai` (or set `EDNOVA_AI_PYTHON` to your prepared interpreter), then
`pnpm dev`. Sign in, open a published course's existing learning workspace, select
an objective, and ask Nardouch. Enable voice tools only when wanted; consent is
required separately before recording. The corrected transcript moves into the
composer and is never automatically submitted. Listening sends only a selected
stored assistant answer to TTS. EdNova stores no raw audio; cloud-provider data
handling depends on the chosen account's settings.

The API is limited to 12 generation/voice/feedback requests per minute per learner.
Conversation reads recheck current course and publication access. Provision the
expiry sweep (`ednova_sweep_expired_rows`, created by the Prisma migrations) on
`nardouchconversations.expiresAt`; reads reject expired rows even before the sweep runs.

## Provider evidence and evaluation

Provider documentation confirms advertised Tunisian support, **not** recognition
accuracy or native pronunciation:

- [Azure languages and voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)
- [Azure short-audio REST formats](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text-short)
- [Azure TTS REST contract](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech)
- [Google V1 language support](https://docs.cloud.google.com/speech-to-text/docs/v1/speech-to-text-supported-languages)
- [Google synchronous recognition](https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v1/speech/recognize)

`apps/ai/agents/nardouch/evaluation/cases.json` has ten seed university questions
covering Arabizi, Arabic Darija, code-switching, recursion, derivatives, matrices,
probability, word correction, missing context and privacy. These cases are **not
native-speaker reviewed**. The configurable prompt's approved examples array is
intentionally empty until review.

The evaluation runner measures actual gateway latency and failure rate and leaves
correctness/naturalness/technical-preservation scores unset for human reviewers.
Provide `NARDOUCH_EVAL_URL`, `NARDOUCH_EVAL_COOKIE`, `NARDOUCH_EVAL_COURSE_ID`,
`NARDOUCH_EVAL_REVISION_ID`, and optionally `NARDOUCH_EVAL_ORIGIN` privately, then:

```sh
cd apps/ai
python -m agents.nardouch.evaluation.run --output /private/new-results.json
```

It uses authenticated published-course calls, writes a new mode-0600 result file,
never prints cookies, and refuses to overwrite an existing report. It has not been
run against live models/providers in this implementation. No live success rate,
native quality rating, ASR word-error rate, or TTS naturalness measurement is claimed.
Next evaluation: recruit Tunisian native speakers, review examples and glossary,
record consented Darija/French technical clips, compare Azure/Google ASR word-error
and technical-term error rates, and listen to both Azure voices. Arabizi and code
pronunciation especially need review before enabling spoken responses widely.

## Executed validation

The following checks were executed on this change. Inference and cloud speech are
injected **only in tests**; the Nest integration uses real Better Auth cookies,
PostgreSQL, and real revision bytes/FAISS artifacts.

| Check | Actual result |
| --- | --- |
| Python Nardouch, voice, grounding and shared LiteLLM regression tests | 82 passed; one existing PyMuPDF `fitz` deprecation warning |
| Gateway Nardouch unit/HTTP tests | 23 passed |
| Real Nest/Better Auth/PostgreSQL integration | 6 passed |
| Frontend component and WAV encoding tests | 8 passed |
| Chromium interactive checks at a mobile viewport | 8 passed |
| API typecheck and production build | Passed |
| Web TypeScript check and production build | Passed |
| ESLint on changed Nardouch gateway/frontend code | Passed |
| `git diff --check` | Passed |

Reproduce with the repository's configured environments:

```sh
# From apps/ai, with prepared Python dependencies:
python -m pytest tests/test_llm_tier_split.py tests/test_llm_unavailable.py tests/test_llm_client.py tests/test_nardouch.py tests/test_nardouch_voice.py tests/test_tutor_grounding.py -q

# From the repository root:
pnpm --filter api exec jest modules/study/src/tests/nardouch.test.ts --runInBand
pnpm test:infra:up
pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/nardouch.node.test.ts
pnpm --filter web exec vitest run src/features/nardouch src/features/learning/learning-workspace.test.tsx --maxWorkers=2
pnpm --filter api typecheck
pnpm --filter web exec tsc --noEmit
pnpm --filter api build
pnpm --filter web build

# Browser harness: start in one terminal, run in another.
pnpm --filter web exec vite --config e2e/nardouch/vite.config.ts
node apps/web/e2e/nardouch/browser.mjs
```

The integration test uses the isolated test PostgreSQL at port 5433 by default;
`DATABASE_URL` can select a different test server. It always generates
and removes its own uniquely named database and source directory. The browser
harness uses test-only action adapters in `e2e/nardouch`, never production routes;
it exercises recording using Chromium's fake microphone, transcript editing,
conversation continuation, provider failure messages, denied microphone access,
text preservation, mobile overflow and native-track cleanup. Set
`NARDOUCH_BROWSER_PATH` if Chromium is installed outside `/usr/bin/chromium`.
The local Python checks used an isolated interpreter under
`var/tmp/nardouch-venv`; no repository dependency lockfiles were changed.

Live academic correctness and Tunisian speech quality were not measured. The
checks above must not be interpreted as native-language or provider success rates.
The next implementation stages are deeper in-chat reviewed assessment integration
and multilingual shared facilitation through the existing Study Circle boundary.

## Local speech migration sprint (supersedes cloud setup above)

Cloud ASR/TTS implementations have been removed from the serving path. Old
`azure`/`google` provider settings now fail closed, including when credentials
remain in the environment. LiteLLM, approvals, budgets and educational text
orchestration are unchanged. Browser WAV input and editable transcripts remain.

ASR uses faster-whisper 1.2.1 / CTranslate2, CPU INT8 with four threads. Install
`pip install -r apps/ai/requirements-speech.txt` in the prepared AI environment.
Provision explicitly from the AI directory, with an immutable reviewed revision:

```sh
python -m agents.nardouch.provision_speech --repo Systran/faster-whisper-small --revision 536b0662742c02347bc0e980a01041f333bce120 --directory /models/nardouch/asr --license-reviewed
```

The provisioner records file SHA256 hashes and refuses existing destinations.
Runtime validates them, requires the review flag, uses local paths exclusively,
sets HF/Transformers offline flags, and blocks socket connections in the speech
worker. Downloads are allowed only in provisioning. Cache weights outside git.
The model is multilingual Whisper small (MIT); preserve its LICENSE/model card.
Tunisian ASR candidates are not drop-in CTranslate2 weights: ghayth123's card
identifies Transformers Whisper medium/MIT but references a checkpoint subfolder;
verify actual files and convert offline using CTranslate2's documented converter
before considering deployment. TuniSpeech-AI's large-v2 checkpoint is CC-BY-NC-4.0:
evaluation only, never a commercial default.

`LocalTunisianTTSProvider` implements the documented VoxCPM API with a local
checkpoint, `local_files_only=True`, no denoiser, no reference audio or speaker
cloning, and compilation disabled. Provision only after reviewing the model,
runtime, base-model and source-corpus rights. The SILMA candidate returns HTTP 401
for its model API/card in this session, so its files, compatible configuration,
LinTO attribution and licensing could not be verified. No SILMA loading API was
invented. VoxCPM's model card says Apache-2.0 but explicitly leaves source-corpus
licensing unspecified. It remains disabled pending that review. No TTS weights
have been approved or installed by this sprint. This is an implemented adapter,
not a verified natural Tunisian voice. F5/SILMA and VoxCPM cannot share loaders.

New configuration (server-side only): `NARDOUCH_ASR_PROVIDER=local_whisper`,
`NARDOUCH_ASR_DEVICE=cpu`, `NARDOUCH_ASR_COMPUTE_TYPE=int8`,
`NARDOUCH_ASR_LANGUAGE=auto` (or Whisper `ar`, `fr`, `en` hints),
`NARDOUCH_TTS_PROVIDER=disabled` (opt-in `local_tunisian` after review),
`NARDOUCH_TTS_DEVICE=cpu` (or explicit CUDA),
`NARDOUCH_SPEECH_MODEL_DIR=/models/nardouch`,
`NARDOUCH_SPEECH_TIMEOUT_SECONDS=18`. Offline operation is mandatory; there is no
online switch. Cloud keys are unnecessary. Keep `AI_SERVICE_API_KEY` unchanged.
Run the existing `pnpm dev:ai`; the existing synchronous FastAPI speech routes run
in its thread pool, while expensive inference executes in a persistent spawned
process. One speech worker per API process, one request at a time, no queue;
concurrent submissions return backpressure. Timeout kills and joins the worker,
releasing model memory, and the next request can reload. Process exit cleans up.
The Compose AI command now uses one Uvicorn worker and mounts persistent model
files read-only. The AI Docker build installs the optional ASR requirements by default; use
`--build-arg INSTALL_LOCAL_SPEECH=0` for text-only images. This Docker image build
was not executed in this sprint. Multiple API replicas multiply memory requirements.

Readiness: authenticated internal `GET /api/ai/nardouch/speech/readiness` exposes
cold/busy/ready/failed/unavailable state and worker RSS/high-water memory. ASR has
a 1 GiB minimum available-RAM guard, TTS 6 GiB; these conservative guards are not
measured model peaks. First request includes loading, so warm up explicitly with
the smoke runner before exposing voice to learners. Keep its deadline within the
existing 23-second speech gateway timeout. Longer CPU jobs are currently refused
rather than queued. TTS is capped at 600 characters and 60 seconds, returns mono
PCM16 WAV at 48 kHz; the gateway accepts WAV while preserving existing MP3 playback
compatibility. No audio is persisted by the service. Serving is local but still
has hardware, electricity and operations costs.

Speech adaptation is deliberately conservative: only LIFO/FIFO initialisms are
spelled for pronunciation. Code identifiers, formulas, numbers, Arabizi digits and
ambiguous dialect words remain unchanged. Display and approved stored speech text
remain intact; the TTS adapter applies this meaning-preserving formatting just
before inference. General Arabizi transliteration and formula verbalization are
deferred until native/subject review, rather than silently changing mathematics.

Extended benchmark: `python -m agents.nardouch.evaluation.speech manifest.json
--output new-private-results.json`. Manifest format is documented in that module:
explicit consent, relative WAV path, original reference transcript, language mix
and technical terms. It records predicted transcript, duration, strict WER and
technical-term omission rate. WER uses NFC + whitespace only, retaining case,
punctuation, diacritics, Arabic-letter distinctions and Arabizi digits. Omission
rate is literal term presence, not a semantic correctness score. Human
naturalness, intelligibility, educational correctness and semantic-preservation
fields remain null until actual reviewers score them. Use dialect/region/noise
strata in case IDs and languageMix; include silence, short speech and corrections.

Real-model smoke (requires installed weights and consented input):
`python -m agents.nardouch.evaluation.smoke clip.wav --tts-text '...' --output-wav
new-answer.wav`. Omit TTS flags for ASR-only. It prints actual latency, transcript,
worker RSS/high-water memory and optional generated byte count; failures propagate,
never fake audio. Test offline by disabling host egress as an additional deployment
check. No complete sign-in → real Tunisian ASR → LLM → real TTS scenario or
native-speaker quality score is claimed unless explicitly recorded below.

Observed hardware: Intel i5-12450H, 12 logical CPUs, 15 GiB RAM (about 5.2 GiB
available at audit), RTX 4050 Laptop 6 GiB VRAM (about 5.8 GiB free). This is a
constrained shared workstation; TTS CPU feasibility has not been measured because
verified TTS weights/runtime are unavailable. No latency or naturalness comparison
between the two TTS candidates can honestly be supplied yet.

Primary references: https://github.com/SYSTRAN/faster-whisper,
https://huggingface.co/Systran/faster-whisper-small,
https://huggingface.co/Code-Quasar/voxcpm-tn,
https://github.com/OpenBMB/VoxCPM/blob/main/src/voxcpm/core.py,
https://huggingface.co/TuniSpeech-AI/whisper-tunisian-dialect,
https://huggingface.co/ghayth123/tunisian-asr-whisper_medium.

### Observed local sprint validation

Installed faster-whisper 1.2.1 and CTranslate2 4.8.5 in
`var/tmp/nardouch-venv`. Provisioned the pinned MIT Whisper-small checkpoint:
486,215,847 bytes across six files, with recorded SHA256 manifest. No TTS model
was installed. Real local ASR on a synthetic English espeak calibration clip
completed with speech-worker socket connections blocked: second cold run 6.270 s,
RSS 793,156 kB and high-water 835,064 kB. It transcribed “last” as “lost”; this
is a real runtime smoke, not Tunisian quality evidence. The fixture was resampled
only during test preparation; production input remains native 16 kHz PCM WAV.
No real Tunisian consented recording was available, and no real TTS waveform or
complete real-model voice conversation was produced. Native WER, semantic quality,
TTS latency, GPU memory peaks and native-speaker ratings remain unmeasured.

Executed regressions: 86 Python tests passed (including 18 voice tests), 23 gateway
unit tests passed, six real Nest/Better Auth/PostgreSQL integration checks passed,
eight frontend tests and eight Chromium checks passed. Cloud-specific tests were
replaced by assertions that cloud selection fails closed; original input validation,
transcript, privacy and educational tests remain. Both builds and TypeScript checks
passed. Targeted ESLint passed. One existing PyMuPDF deprecation warning remains.
The first browser run failed after the consent copy changed; its locator was
updated and the complete eight-check browser run passed afterward.

Remaining acceptance gaps: verified/licensed local Tunisian TTS runtime and weights,
real consented Tunisian code-switching recordings, native pronunciation/semantic
review, full real-model voice scenario, and sustained-load/GPU benchmarks. Safe
text-only behavior remains available throughout. No blanket migration-complete or
native-naturalness claim is made.

## SILMA preferred-provider checkpoint verification

`local_silma` is now a recognized provider, implemented by
`agents/nardouch/silma.py:LocalSilmaTTSProvider`. **It is a blocked integration
boundary, not a working or ready-to-enable inference adapter.** Default TTS remains
`disabled`; `local_tunisian` continues to select the optional VoxCPM implementation.
No LiteLLM or educational workflow was changed. Selecting SILMA with unavailable
weights produces the existing service-unavailable response and preserves text.
The internal authenticated speech readiness response includes SILMA's missing
files and explicit non-ready status. Dropping arbitrary files into the cache
cannot enable unverified synthesis.

Access was checked again for the exact requested repository. All these anonymous
Hub operations returned HTTP 401: repository metadata API, raw README/model card,
and HEAD requests to `resolve/main/model.pt`, `vocab.txt`, and `config.yaml`.
There was no locally configured Hugging Face credential (`get_token()` returned
none). These are checkpoint/model-card requests, not calls to hosted inference;
no paid inference service was invoked. A generic Hub 401 does not distinguish a
private, inaccessible/gated, renamed or nonexistent repository reliably. Therefore
we cannot identify the precise repository-side cause, list its actual files,
resolve an immutable SHA, or verify the claimed Apache-2.0/LinTO terms. No access
restrictions were bypassed, credentials fabricated, files downloaded, revision
invented, or SILMA file hashes reported.

Licensing review remains incomplete: SILMA's own model, base-model lineage,
dataset attribution and default voice rights are unavailable. The F5-TTS **code**
license at tag 1.1.7 is MIT; the public SWivid/F5-TTS **weights** card declares
CC-BY-NC-4.0 and Emilia dataset provenance. These are distinct artifacts and do not
establish SILMA's actual lineage or its derivative rights. The requested LinTO
attribution must be verified from the accessible SILMA card and underlying dataset
license. No claim that its fine-tuned weights inherit the code's MIT license is
made.

Verified F5-TTS v1.1.7 API details from upstream `src/f5_tts/api.py`:

- `F5TTS(model=..., ckpt_file=..., vocab_file=..., vocoder_local_path=..., device=...)`
  loads a packaged `f5_tts/configs/{model}.yaml` through OmegaConf. It does **not**
  accept an arbitrary `config.yaml` constructor argument. The downloaded SILMA
  architecture/config must be examined before choosing a packaged config or using
  the documented lower-level loader.
- `infer(ref_file, ref_text, gen_text, ...)` returns `(wav, sample_rate, spec)`.
  Both reference audio and its transcript are required; calling with an empty
  reference is not an established reference-free voice mode. Omitting the
  transcript can trigger reference ASR in preprocessing, which is inappropriate
  for this offline, non-cloning path.
- Both the acoustic checkpoint/vocabulary and a verified local vocoder are needed
  to prevent fallback downloads. No user's recording will be used as a voice
  reference. An upstream documented non-cloning/default-voice contract compatible
  with the user's constraint must be established before this provider can run.

The SILMA-specific provisioning profile is ready for use **after access and rights
review**, from `apps/ai`:

```sh
python -m agents.nardouch.provision_speech \
  --repo Ghazouaniwala/silma-tts-derja-v2 \
  --revision ACTUAL_40_CHARACTER_COMMIT_SHA \
  --directory /models/nardouch/silma \
  --profile silma --license-reviewed --rights-record /private/silma-rights.json
```

`ACTUAL_40_CHARACTER_COMMIT_SHA` is deliberately a placeholder; no revision was
obtainable. The CLI rejects it until replaced with an actual immutable SHA. The
rights JSON must contain nonempty `model`, `baseModel`, `dataset`, `voice`,
`vocoder`, and `reviewer` provenance strings. It records that provenance with
SHA256 hashes, rejects missing `model.pt`, `vocab.txt` or `config.yaml`, and never
creates a verified manifest for an incomplete checkpoint. Existing destinations
are refused. Models stay outside Git. This provisioning manifest is not approval
to execute an unreviewed architecture or impersonate a reference speaker.

Once the repository/runtime can be reviewed, prepare a dedicated environment with
`python -m pip install 'f5-tts==1.1.7'` and verify all transitive Torch, vocoder and
configuration dependencies against that checkpoint. F5-TTS was not installed in
this sprint because the checkpoint/default-voice contract remains unavailable.
`NARDOUCH_TTS_PROVIDER=local_silma` currently produces an explicit unavailable
result; use `disabled` for normal text-only operation. Existing model directory,
CPU/CUDA selection, single-worker concurrency, timeout and cleanup settings remain
unchanged, but no SILMA worker loading is dispatched until compatibility is known.

New meaning-preservation tests cover recursion, binary search, stack/queue,
LIFO/FIFO, derivatives, formulas, code identifiers, numbers and French/Darija
mixed text. They verify deterministic text preservation, not pronunciation.
Display answers and original transcripts remain untouched. There were no native
reviewers, no SILMA-generated WAV and no full Whisper → LiteLLM → SILMA execution.
Initialization time, peak RAM/VRAM, generation time, real-time factor, WAV validity
and Tunisian pronunciation for SILMA are all **unmeasured**, rather than zero or
inferred from Whisper/VoxCPM. RTX 4050 6 GB feasibility is likewise unverified.

To unblock: obtain legitimate checkpoint access or a corrected public repository
identifier, inspect an immutable snapshot and its model/data/voice/vocoder rights,
and establish its documented non-cloning voice inference path. Only then implement
and run the actual compatible loader in the existing bounded speech worker and
require a real playable WAV plus regression checks before enabling it.

Sources:
[requested model](https://huggingface.co/Ghazouaniwala/silma-tts-derja-v2),
[F5-TTS 1.1.7 API](https://github.com/SWivid/F5-TTS/blob/1.1.7/src/f5_tts/api.py),
[F5-TTS code license](https://github.com/SWivid/F5-TTS/blob/1.1.7/LICENSE),
[SWivid weights card](https://huggingface.co/SWivid/F5-TTS).

SILMA checkpoint-verification regression results: 93 Python tests, 23 gateway unit
tests, six real authorization/persistence integration checks, eight frontend tests
and eight Chromium checks passed. API/web typechecks, both production builds,
targeted ESLint and `git diff --check` passed. Browser/model fixture checks remain
separate from real synthesis: zero SILMA inference runs were possible.

## Lightweight CPU Piper prototype (supersedes default TTS choice above)

Piper is now the default provider selection (`local_piper`), using the existing
persistent, bounded, killable speech worker and existing authenticated WAV endpoint.
Whisper, LiteLLM aliases/approvals/budgets, RAG, conversation storage, Bloom and the
reviewed-practice workflows are unchanged. `disabled`, `local_silma` and
`local_tunisian` remain recognized choices; the experimental alternatives are not
automatically enabled or used as fallbacks.

### Voice and rights investigation

The maintained runtime is OHF-Voice/piper1-gpl; installed release **piper-tts
1.8.0**, GPL-3.0. The runtime's code license is separate from voice rights. Preserve
its license/source obligations when distributing the runtime; no claim that the
runtime or its voice files are MIT-licensed is made.

The official `rhasspy/piper-voices` snapshot
`e7229f7d33a10e145e109b886d661984201ac3c4` contains `ar_JO-kareem-low` and
`ar_JO-kareem-medium`. Their cards name an Arabic dataset at
`AliMokhammad/arabicttstrain` (repository/license returned 404 during this audit)
and Lessac fine-tuning ancestry. The medium Lessac card points to the Blizzard
2013 corpus/license. Because these records do not establish unrestricted
redistribution, Kareem was **not approved or provisioned**. Regional Arabic support
alone does not establish Tunisian pronunciation or deployment rights.

An alternative with explicit author-provided terms was provisioned **only for
non-commercial evaluation**: `OpenVoiceOS/phoonnx_ar-SA_miro_espeak`, revision
`d5cf31ab113941464d4a9e5e0b81b64b7454b234`. It is a VITS/ONNX Arabic model,
trained on `TigreGotico/tts-train-synthetic-miro_ar-SA`; the card identifies the
voice/model/data owner as **TigreGotico Lda** and permits non-commercial use and
sharing under **CC-BY-NC-ND-4.0**, with attribution, no model derivatives or
voice-identity derivatives. This is the card's provenance/rights attestation,
not independent evidence of every underlying recording consent. Do not modify
or convert these evaluation weights, or redistribute them commercially. This is
an Arabic Miro voice, **not a Tunisian voice and not Kareem**.

The provisioner caches the original model/config/card outside Git and records:

| File | SHA256 |
| --- | --- |
| `miro_ar.onnx` | `082c0accd697ff4962f6603fed2368e37a6b0daa3ae9a05ae7431e2fb0cb50c1` |
| `miro_ar.piper.json` | `c874670b1b353f8dfca2bf1841006cd0b5831a5eff55b6a28cc701a1bd1b4e38` |
| `README.md` | `feefa7a6d4a125d27e6b4011577f3c0ed02cf9f665b159ad3ecd56af6a9bbbe7` |

Total downloaded artifacts: **63,448,558 bytes**. Production is blocked for this
voice even if the non-commercial opt-in is set. A deployment-approved voice with
verified rights is still needed for commercial rollout. The generic runtime can
use a separately provisioned, hash-verified voice manifest with
`usage=deployment_approved`; changing a label does not grant missing legal rights.

### Installation and local evaluation

From the repository root install the updated optional speech requirements in the
prepared AI environment (`piper-tts==1.8.0` is now included), then provision:

```sh
pip install -r apps/ai/requirements-speech.txt
PYTHONPATH=apps/ai python -m agents.nardouch.provision_piper \
  --directory "$PWD/var/nardouch-models/piper" --noncommercial-evaluation
```

Only explicit provisioning downloads files. Serving verifies manifest hashes and
loads local files. The provisioner pins its repository/revision and refuses an
existing destination. Preserve the card and attribution with any permitted copies.
The Docker build includes the updated optional requirements; rebuilding that
image was not performed in this sprint. The existing read-only model mount is
reused.

For a non-commercial development prototype, set the following on the Python AI
service and start it using the existing `pnpm dev:ai` command:

```env
NARDOUCH_TTS_PROVIDER=local_piper
NARDOUCH_PIPER_DEVICE=cpu
NARDOUCH_SPEECH_MODEL_DIR=/absolute/path/to/mindflow/var/nardouch-models
NARDOUCH_PIPER_ALLOW_NONCOMMERCIAL=1
```

Optional `NARDOUCH_PIPER_MODEL_DIR` overrides only the Piper subdirectory. `cpu` is
the only accepted Piper device. Leave the opt-in at `0` for normal installations;
`APP_ENV=production` or `NODE_ENV=production` rejects this evaluation voice
regardless of that opt-in. `NARDOUCH_TTS_PROVIDER=disabled` remains available.
No new browser settings, credentials, endpoints, queue or microservice are needed.

`LocalPiperTTSProvider` routes to the existing speech process under kind `piper`.
`PiperVoice.load(..., use_cuda=False)` explicitly requests only
`CPUExecutionProvider`; the session provider list is checked. The Piper path
imports neither Torch nor CUDA. Optional Arabic automatic diacritization is
turned off to prevent an auxiliary download and unreviewed textual alteration.
Speech-worker socket connections are blocked as before. Input is capped at 600
characters; output must be a nonempty, complete, mono PCM16 WAV, 8–48 kHz, at most
60 seconds and 5 MB. The installed voice outputs **22,050 Hz**. Native WAV playback
uses the existing browser player. Models load once per worker; one active request,
zero queued requests, existing deadline/kill/reload recovery, and graceful shutdown
remain. Piper's available-RAM guard is 512 MiB (a startup guard, not a measured
maximum); the earlier 6 GiB guard remains for the experimental heavy TTS branch.
The shared worker may also host ASR, so combined memory/GPU usage differs from a
fresh TTS-only process.

### Pronunciation policy and benchmark

`pronunciation_glossary.json` contains human-reviewable technical-term examples
with separate `nativeSpeakerReviewed` and `meaningReviewed` flags, all currently
false. Only entries with both flags true can replace tokens. No unreviewed Arabizi
transliteration, numeric conversion, formula rewriting or technical translation
is performed. Mixed Arabic/Latin answers are preserved; a fully Latin/Arabizi
answer without a verified Arabic speech form returns unavailable, leaving its
original display/storage intact. Code fences or phoneme-block markup likewise
skip synthesis rather than alter program semantics. This conservative policy can
reduce spoken-answer availability. It does not ensure that the Arabic phonemizer
pronounces French/English words correctly.

The real benchmark runner is
`agents/nardouch/evaluation/piper_smoke.py`. It synthesizes all five requested
phrases, writes WAVs only when explicitly invoked, validates each output, records
initialization/inference CPU time, RSS/high-water RAM, duration and real-time
factor, and checks the worker PID against `nvidia-smi` compute-process accounting.
Naturalness, intelligibility and technical-preservation ratings remain null.
Run it with a new output directory:

```sh
PYTHONPATH=apps/ai NARDOUCH_SPEECH_MODEL_DIR="$PWD/var/nardouch-models" \
  NARDOUCH_PIPER_ALLOW_NONCOMMERCIAL=1 python -m agents.nardouch.evaluation.piper_smoke \
  --output-dir "$PWD/var/tmp/new-piper-review"
```

Measured real TTS-only run on the i5-12450H workstation (five phrases, a fresh
worker, no ASR model loaded): initialization **1.531 s**; first wall request
**2.032 s** including spawn/verification/IPC; warm worker synthesis requests
**0.061–0.086 s**, producing **2.10–3.03 s** audio. Warm synthesis real-time factor
**0.0266–0.0335**; cold request factor **0.607**. Worker RSS/high-water peaked at
**256,776 kB (~251 MiB)**. ONNX reported only `CPUExecutionProvider`, and NVIDIA
compute-process accounting reported **0 MiB for the TTS worker PID** on every
sample. Warm process CPU use was approximately **772–793% of one CPU core**
(multithreaded, about 7.7–7.9 cores), not 793% of the entire machine. Timing varies
with load and stochastic voice output; these are observations, not guarantees.
No shared ASR+TTS resource measurement or long-duration load test is claimed.

Generated review audio is under `var/tmp/piper-measured/`, with machine-readable
`results.json`. No native speakers reviewed these files, and no native Tunisian
accent, educational listening comprehension or French pronunciation score is
claimed. The real synthesis and format-validation criteria passed for the local
non-commercial prototype; commercial-voice rights remain a deployment blocker.
SILMA/VoxCPM investigation history above is preserved.

Primary sources:
[maintained Piper runtime](https://github.com/OHF-Voice/piper1-gpl),
[Piper 1.8.0 release](https://github.com/OHF-Voice/piper1-gpl/releases/tag/v1.8.0),
[Kareem model card](https://huggingface.co/rhasspy/piper-voices/blob/e7229f7d33a10e145e109b886d661984201ac3c4/ar/ar_JO/kareem/medium/MODEL_CARD),
[selected Miro model card](https://huggingface.co/OpenVoiceOS/phoonnx_ar-SA_miro_espeak/blob/d5cf31ab113941464d4a9e5e0b81b64b7454b234/README.md).

Piper sprint executed checks: **102 Python**, **23 gateway unit**, **6 real
Nest/Better Auth/PostgreSQL integration**, **8 frontend** and **9 Chromium** checks
passed; both production builds, TypeScript checks, targeted ESLint and
`git diff --check` passed. These are the selected Nardouch/LLM/grounding regression
suites, not a claim that every unrelated repository test was run. The ninth
Chromium check loads and plays a genuine generated WAV; the other browser action
transports and the integration LLM response are explicitly test fixtures. This
is not a claim of a live LiteLLM → real ASR → real TTS student conversation.

Reproduce Python checks by adding `tests/test_nardouch_piper.py` to the existing
Nardouch test selection (or `tests/test_nardouch*.py`). Run the browser harness as
previously documented and enable real-WAV playback with:

```sh
NARDOUCH_PIPER_WAV="$PWD/var/tmp/piper-measured/1.wav" node apps/web/e2e/nardouch/browser.mjs
```

New/updated implementation files: `piper_runtime.py`, `provision_piper.py`,
`voice.py`, `local_speech.py`, `speech_adaptation.py`,
`pronunciation_glossary.json`, `evaluation/piper_smoke.py`, the private readiness
router, `requirements-speech.txt`, `.env.example`, Compose defaults, Piper unit
tests, the SILMA provider-selection regression, and the optional browser playback
check. Existing SILMA/VoxCPM paths and their investigation records remain.

## ElevenLabs metered demonstration sprint (intentional external TTS)

This demo intentionally changes the earlier offline-only **TTS** policy. Local
Whisper ASR, its cached weights and socket-restricted local worker are unchanged.
LiteLLM remains the educational reasoning service with the same model aliases,
approvals and budgets. Only the selected approved assistant response is sent to
ElevenLabs, from the private Python API. No ElevenLabs STT, conversational agent,
voice cloning, local TTS model loading or TTS GPU inference is used. Existing
local Piper/SILMA/VoxCPM choices and their licensing restrictions remain; there is
no fallback when the configured ElevenLabs provider fails.

Files: `agents/nardouch/elevenlabs.py` (HTTP adapter, MP3 validation, durable demo
accounting), `voice.py`/private router (selection and dynamic MP3 MIME),
`evaluation/elevenlabs_audition.py`, gateway `services/nardouch.ts` (server-derived
generation identity), frontend `audio-player.tsx`/`speech-cache.ts` (single-flight,
session-memory replay and Stop), awareness copy, environment/Compose examples,
and new provider/cache/browser tests. No SDK or additional production package was
introduced: requests/SQLite are already available; PyAV comes with local Whisper
and is checked before paid dispatch. MP3 fixtures are synthetic test audio, never
an ElevenLabs success claim.

### Secure setup

Configure these **only on the Python server**, e.g. in its ignored `.env`:

```env
NARDOUCH_ASR_PROVIDER=local_whisper
NARDOUCH_TTS_PROVIDER=elevenlabs
NARDOUCH_TTS_DEMO_ENABLED=true
ELEVENLABS_API_KEY=YOUR_PRIVATE_ACCOUNT_KEY
ELEVENLABS_VOICE_ID=AUTHORIZED_VOICE_FROM_YOUR_ACCOUNT
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
NARDOUCH_TTS_MAX_CHARACTERS=600
NARDOUCH_TTS_DAILY_CHARACTERS=3000
NARDOUCH_TTS_DAILY_REQUESTS=10
NARDOUCH_TTS_BUDGET_DB=/absolute/persistent/private-directory/elevenlabs.sqlite3
```

The placeholders above are not credentials or invented voice IDs. In the account's
voice library choose an authorized existing voice and copy its ID. Audition for
warm, clear young-adult academic speech and French/Arabic transitions; availability
or an Arabic label does not establish a Tunisian accent. No voice is chosen
silently. Flash v2.5 is the configured demo candidate; Multilingual v2 can be
selected through `ELEVENLABS_MODEL_ID` for a separate deliberate A/B request.
Only these two model IDs and MP3 44.1 kHz/128 kbps are accepted in this adapter.
Account access, model availability and subscription compatibility are unverified
until the operator runs preflight and an explicit generation. Unsupported output
formats/plans fail safely; the adapter never upgrades a format or invokes a new
provider automatically.

Create the private budget directory before starting the service (`mkdir -p` and
`chmod 700`, owned by its service user). The Compose example mounts
`./var/nardouch-tts-state:/app/tts-state` and selects the ledger path there. Prepare
that directory for container UID/GID 10001; a failed permission check must remain
fail-closed. Use one AI instance / one durable ledger for the demo; separate
replicas with independent ledgers would each have separate caps and are not a
global deployment budget. Keep `AI_SERVICE_API_KEY` unchanged and matching between
Node and Python. Existing model volumes stay mounted read-only. No TTS weights
were downloaded during this sprint. Docker image deployment was not executed.
Allow outbound TLS to **api.elevenlabs.io:443** for this adapter under the existing
deployment egress policy; no unrelated network restriction was changed. The URL
is fixed in code, voice IDs are validated server configuration and redirects are
refused. No browser request contains an ElevenLabs key.

Run the existing `pnpm dev:ai` and `pnpm dev`. Keep enabled flags false or choose
`NARDOUCH_TTS_PROVIDER=disabled` to disable the demo without affecting text or ASR.
Returning to `local_piper`, `local_silma` or `local_tunisian` requires the existing
local setup and rights checks; disabled/missing ElevenLabs credentials do not
silently select any of them.

### Account validation, paid smoke and auditions

From `apps/ai`, with server environment variables loaded:

```sh
# Metadata only: confirms configured voice access and selected model TTS capability.
python -m agents.nardouch.evaluation.elevenlabs_audition --check-account
# Local ledger aggregates; no provider request.
python -m agents.nardouch.evaluation.elevenlabs_audition --usage
# ONE explicit paid generation; choose a new directory and a deliberate case ID.
python -m agents.nardouch.evaluation.elevenlabs_audition --generate \
  --phrase 1 --case-id flash-voice-review-01 --output-dir /private/new-voice-review
```

The six evaluation phrases are in that runner. Each invocation generates at most
one phrase, never an automatic batch or A/B loop. Switch to Multilingual v2 only
when deliberately budgeting a separate case ID. The script saves `answer.mp3` and
`result.json` with model/voice, submitted character count, actual latency and
decoded duration. Naturalness, intelligibility, code-switching, pacing, warmth,
provider-metered characters and monetary cost remain unset until reliably observed
or reviewed. The account-model check does not spend a TTS generation, and does
not imply that every subscription feature is available. No API key is printed.
The real-provider smoke was **not run**: neither a key nor an authorized voice ID
is configured in the process or existing `.env` files. No live credit usage,
latency, selected-speaker quality or full real-provider voice scenario is claimed.

### Credit protections and request contract

The browser still sends only `{messageId}` to authenticated
`POST /api/v1/study/nardouch/conversations/:id/speech`. The gateway resolves the
owner-visible stored assistant message and current course/publication grant,
validates its approved answer, and derives an opaque SHA256 generation key from
server-owned user/conversation/message IDs. Only speech text and this opaque key
cross the private AI boundary; the key is **not** sent to ElevenLabs. The provider
POST body contains only `{text, model_id}` plus configured voice in the URL and
`xi-api-key` authentication. It sends no user ID, name, email, profile, history,
source metadata or raw recording as a separate field.

SQLite reserves characters and request count **before** network dispatch, inside
an atomic transaction shared by all processes using the same ledger. Daily caps
use UTC days. There is one active generation globally per ledger, with a crash
lease; duplicate message identities are never dispatched again, even on a later
day or model change. Attempts, including failures and uncertain outcomes, consume
the conservative application budget. They are not assumed to equal the provider's
metered characters or monetary charge. Do not delete/reset/change the ledger path
to retry a demo response. Losing the durable ledger loses this protection.

The per-learner gateway limiter remains 12 requests/minute shared with existing
Nardouch metered actions. Maximum generated text is 600 characters or a lower
configured cap; longer answers remain readable and are not silently truncated.
No automatic synthesis or playback occurs on a new educational response. Listen
is explicit; duplicate clicks/components share one promise. Up to ten generated
blobs remain in tab-runtime memory, with object URLs revoked when players unmount.
Pause/resume/native controls, Replay and Stop reuse existing bytes. Toggling voice
off/on reuses cached bytes. Neither audio nor text is saved in PostgreSQL by TTS;
the ledger stores only an opaque key, counters, state, model and timings. On tab
reload/cache eviction, already-attempted generations are refused rather than
silently billed again. There is no same-message regeneration operation in this
sprint. A failed/ambiguous generation cannot be automatically retried, including
a client cancellation; its paid outcome may already be uncertain.

Requests use bounded connect/read timeouts and a streaming response deadline and
size limit, with no HTTP retries and no redirects. Successful output must have
`audio/mpeg` content type and MP3 framing and must decode as MP3 at 44.1 kHz,
mono/stereo, duration up to 90 seconds and at most 4 MB. JSON errors, redirects,
invalid/oversized audio, 401/402/403/422/429, provider failures and timeouts all
preserve text. The gateway continues to accept existing authorized WAV/MP3
responses. Server logs contain only model, submitted character count, success or
failure, latency and decoded duration—not keys, response bodies or answer text.
Ledger usage reports distinguish successful, failed and pending reservations.

### Preparation and privacy

The demo uses identity speech preparation: the existing approved speech text is
sent unchanged, preserving formulas, numbers, code, LIFO/FIFO and French technical
terms. Speech adaptation is effectively disabled by default; no second LLM call
or unreviewed Arabizi-to-Arabic explanation is generated. The existing reviewed
local pronunciation glossary remains available for future separately validated
adaptation but is not silently applied to ElevenLabs output.

The voice-tools checkbox now explicitly states that listening may send the
selected answer to an external metered voice service. Whisper recording remains
local and has its own consent. ElevenLabs documents default retention and an
enterprise-only zero-retention option. This adapter does not assume that option
or send `enable_logging=false`; review the actual account's plan, data-use and
retention settings before demonstrating sensitive material. Do not describe this
path as offline or zero-retention. There is no native-speaker review yet; generic
Arabic support is not evidence of Tunisian naturalness.

Official references:
[Convert speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[model catalog](https://elevenlabs.io/docs/overview/models),
[retention documentation](https://elevenlabs.io/docs/resources/zero-retention-mode).

### Demo walkthrough and executed validation

1. Configure the server-only provider/key/authorized voice, private persistent
   ledger and conservative limits. Run account metadata preflight and deliberately
   budget one paid audition before the demonstration.
2. Start the existing API, AI service and web app; sign in and open an authorized
   published course with an objective. Ask a text question or record locally,
   review/correct its transcript and submit it.
3. Read the grounded response and sources. Enable the clearly disclosed voice tools
   and click Listen for one selected answer. Native controls pause/resume; Replay
   and Stop reuse its bytes. Turning voice tools off stops playback and revokes
   object URLs while retaining a bounded session blob cache.
4. Missing configuration, exhausted budget, uncertain paid outcome or provider
   failure leaves the written response readable. Text/ASR continue independently.

Executed selected regression checks in this sprint: **122 Python**, **23 gateway
unit**, **6 real Nest/Better Auth/PostgreSQL integration**, **9 frontend**, and **11
Chromium** checks passed. Both production builds, API/web TypeScript checks,
targeted ESLint and `git diff --check` passed. Browser checks include synthetic
MP3 decoding, duplicate clicks, Replay/Stop and voice-toggle cache reuse. The MP3
fixture is a generated tone; no native-quality or ElevenLabs inference score can
be inferred from it. The integration tests use an explicitly labeled inference
fixture, not a live provider. One existing PyMuPDF deprecation warning remains.

Run the existing regression commands above, adding
`tests/test_nardouch_elevenlabs.py` to the Python selection (or using
`tests/test_nardouch*.py`), and keep `src/features/nardouch` in the Vitest selection
to cover the new browser-session cache test. The normal browser harness now
includes the paid-request-prevention checks without making any external requests.

No real ElevenLabs key/voice was found, so no live synthesis or account selection
was attempted. Submitted live TTS characters, account credit charges, live latency,
Tunisian pronunciation, intelligibility and speaker quality are unmeasured. This
is an implemented and regression-tested demo integration that still needs operator
configuration and a successful authorized real-provider smoke before being called
an end-to-end working voice demonstration.

Listen now attempts playback after that explicit user-triggered generation; if the
mobile browser blocks delayed playback, the accessible native Play control remains
available. Cached audio is not automatically played merely by remounting a player
or toggling voice tools. Short answers must fit the configured character cap;
ask for a concise explanation during the demo rather than expecting automatic
truncation or a second generated speech summary.

The supplied ElevenLabs quickstart configuration is now supported:
`ELEVENLABS_MODEL_ID=eleven_v3`,
`ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM`. These were configured in the ignored
server `apps/ai/.env` along with the existing demo caps and a private persistent
ledger. This user-supplied voice ID has not yet been checked against the account;
it is not an API key. No actual `ELEVENLABS_API_KEY` was present in the message,
process or checked environment files. Fill that key directly in `apps/ai/.env`
and restart `pnpm dev:ai`; this repository's launcher reads that file. The generic
quickstart's `.env.local` is not automatically read by the Python launcher.
The small HTTP adapter remains in use; no second standalone SDK chatbot/script
was introduced. Flash remains the code default when no model override is set.
All three configured model IDs remain subject to account metadata preflight and
credit controls. No paid test was dispatched without the missing credential.

### First authorized live request outcome

After the key was added privately, account voice metadata returned 200. Model
catalog and subscription metadata requests returned 401 `missing_permissions`.
One explicitly authorized live `eleven_v3` generation was then attempted for the
39-character greeting. ElevenLabs returned HTTP 402 (payment/credit-access
rejection); no playable audio was returned. No automatic retry, alternative model
or fallback provider was invoked. The durable demo ledger conservatively records
one failed attempt / 39 submitted characters. Provider-charged credits and monetary
cost could not be verified with this key. The account balance and precise reason
for the 402 remain unknown because subscription metadata is inaccessible.

A private outcome record is saved at
`var/nardouch-demo/eleven-v3-first/result.json`; no `answer.mp3` exists for this
attempt. Check the key's spending limit and the account's model/voice payment
access. Metadata permissions are also needed to run the complete account preflight.
Do not reset the ledger or silently retry the same generation identity. Text chat
and local ASR remain available. Earlier notes stating no key was configured describe
the prior state; the credential is now present only in the ignored server file.

### Free-plan-compatible live test succeeded

At the user's request to use the free version, the server configuration was
changed to `eleven_flash_v2_5` and account-discovered default voice
`Xb7hH8MSUJpSbSDYk0k2` (Alice — Clear, Engaging Educator). The account's `/v2/voices`
response lists this voice as `default`/`premade`; no voice ID was invented or
shared Voice Library voice selected. ElevenLabs distinguishes free API premade
voice access from restricted shared-library API access. No subscription, billing
settings or top-ups were enabled or modified.

One deliberate new test succeeded: 39 submitted Unicode characters, valid MP3 at
44.1 kHz, 62,736 bytes, decoded audio 3.855 seconds, end-to-end generation/validation
0.842 seconds (provider adapter observed ~0.700 seconds). Output:
`var/nardouch-demo/eleven-free-first/answer.mp3`, with `result.json` beside it.
Exact charged credits/cost and the account's current balance remain unverified
because the key cannot read subscription metadata. No native Tunisian pronunciation
rating is claimed. Existing conservative caps and durable reservations remain:
one earlier failed v3 attempt and this single successful Flash attempt, 78 total
submitted characters reserved by the demo ledger. The earlier v3 failure was not
retried; the user explicitly authorized changing to the free-compatible choice.

Provider errors now retain only allowlisted structured error categories such as
`paid_plan_required`, instead of interpreting every HTTP 402 as an exhausted
balance. Raw provider messages remain private. Restart an already-running AI
service after changing `apps/ai/.env`; newly started services read the new choice.

### Local Tunisian evaluation after rejected Alice sample

The user rejected the Alice/Flash voice as insufficiently Tunisian. The private
server configuration now selects `disabled` and turns off the external demo.
This change does not revoke or expose the existing key, reset its ledger, or
make further ElevenLabs synthesis calls. Restart a previously running service
to pick up the private configuration. Text tutoring and Whisper are unchanged.

A separate CPU evaluation uses
[oddadmix/lahgtna-chatterbox-v1](https://huggingface.co/oddadmix/lahgtna-chatterbox-v1)
at revision `6b37e50d1952f07306dc9ff3f3d4ff4ddaf32541`. Its author card labels
it MIT and lists Tunisian support. The card does not establish training-data
provenance or individual voice permissions; this is **evaluation only**, with
production rights review pending. No native pronunciation assessment is claimed.
The author also documents repetition problems. The base Chatterbox runtime is
MIT. Preserve its attribution and watermarking.

The author's dialect code at
`Oddadmix/lahgtna-chatterbox@433cb74200b55457bffa8ee6965a02ecab546a1c`
maps Tunisian `tn` to the `da` token slot in these fine-tuned weights. That token
mapping is specific to this checkpoint; using the base model with `da` would
select Danish. The isolated evaluator uses official Chatterbox source at
`ab55923c27757c90cfcc407baa57dc25a7d25217`, with its CPU-safe `from_local`
method and explicit multilingual filename. It uses the checkpoint's published
`conds.pt` preset and never accepts a reference recording. Runtime network
connections are denied and Hugging Face offline mode is enabled.

Weights stay under ignored `var/nardouch-models/lahgtna`, outside Git. The
selective download includes `t3_mtl23ls_v2.safetensors`, `s3gen.pt`, `ve.pt`,
`conds.pt`, tokenizer JSON files and the author README, approximately 3.21 GB.
The provisioning command records SHA256 values in a local `manifest.json`;
the evaluator checks these before loading and rejects another model revision.
The committed `evaluation/lahgtna_checkpoint.json` records the expected values;
weight hashes match Hugging Face LFS metadata at the pinned revision. Small-file
hashes were computed from the pinned download. These are integrity checks, not
separately signed publisher attestations.

```bash
PYTHONPATH=apps/ai python -m agents.nardouch.evaluation.provision_lahgtna \
  --directory var/nardouch-models/lahgtna-new
# In an isolated environment with the pinned CPU Chatterbox runtime installed:
timeout --kill-after=10s 300s python \
  apps/ai/agents/nardouch/evaluation/lahgtna_smoke.py \
  --model-dir var/nardouch-models/lahgtna-new \
  --output-dir var/nardouch-demo/lahgtna-new
```

The output directory must be new. Only the fixed synthetic greeting is written
as a review artifact; student audio is never stored. Results report model
initialization, generation duration, audio duration, real-time factor and peak
process RSS. CPU evaluation hides CUDA, so VRAM use is zero by configuration.
The existing interactive provider remains disabled pending an actual valid WAV,
native review and latency/memory measurements; this evaluator is not a new
production provider. No LiteLLM or educational-workflow changes are involved.

#### Reproduce the isolated CPU runtime

This evaluation uses Python 3.14.8, CPU PyTorch/Torchaudio 2.10.0, Chatterbox
0.1.7 from the pinned source above, and Perth 1.0.1 from PyPI. Resemble AI is
the Chatterbox/Perth author; retain its MIT attribution. The evaluation's pinned
Python package set is `agents/nardouch/evaluation/requirements-lahgtna.txt`.
It deliberately excludes the Gradio UI and the unused Chinese `spacy-pkuseg`
segmenter, whose default initialization needs additional downloaded resources.
Upstream handles the absent segmenter through its optional-import branch.
Safetensors 0.8.0 was used instead of upstream's declared 0.5.3; this environment
is an isolated compatibility evaluation, not the service's production dependency
set. Do not install it into the running AI service or silently change the
existing `requirements-speech.txt`.

```bash
python3 -m venv var/tmp/lahgtna-venv
var/tmp/lahgtna-venv/bin/python -m pip install \
  torch==2.10.0 torchaudio==2.10.0 \
  --index-url https://download.pytorch.org/whl/cpu
var/tmp/lahgtna-venv/bin/python -m pip install \
  -r apps/ai/agents/nardouch/evaluation/requirements-lahgtna.txt
curl --fail --location \
  https://codeload.github.com/resemble-ai/chatterbox/zip/ab55923c27757c90cfcc407baa57dc25a7d25217 \
  -o var/tmp/chatterbox-runtime.zip
python3 -m zipfile -e var/tmp/chatterbox-runtime.zip var/tmp/chatterbox-source
var/tmp/lahgtna-venv/bin/python -m pip install --no-deps \
  ./var/tmp/chatterbox-source/chatterbox-ab55923c27757c90cfcc407baa57dc25a7d25217
```

Run the provisioning/evaluation commands above with the isolated environment's
Python. The Cangjie converter also logs a missing offline cache warning; Chinese
is outside this Arabic evaluation. No missing resource is downloaded during
inference. The direct GitHub Perth install was replaced with the published PyPI
version after slow source downloads; this deviation is explicit and pinned.

#### Actual local synthesis result — 2026-11-06

The offline CPU run succeeded on the Intel Core i5-12450H (16 GB installed RAM),
using four Torch threads. CUDA was hidden and the CPU-only Torch wheel was used.
The fixed test text was `عسلامة، أنا نردوش. شنوة تحب تقرا اليوم؟`.

| Measurement | Observed value |
| --- | --- |
| Model initialization | 8.066 seconds |
| Generation including vocoder/watermarking | 35.137 seconds |
| Total evaluator wall time including hashing/imports | 52.048 seconds |
| Output duration | 4.960 seconds |
| Real-time factor | 7.084 |
| Peak process RSS | 6,170,200 KiB (5.884 GiB) |
| VRAM | 0 bytes (CPU-only run) |
| WAV | 238,124 bytes, PCM16, mono, 24 kHz, 119,040 decoded frames |
| Native Tunisian pronunciation rating | Pending; none claimed |

Both Python `wave` inspection and independent PyAV decoding passed. The sample
is `var/nardouch-demo/lahgtna-cpu-first/answer.wav`; measurements, WAV SHA256 and
decoder verification are in `result.json` alongside it. No user microphone audio
or course conversation was used. This is a single cold-model run, not a sustained
load/concurrency benchmark. French code-switching, formulas and technical-term
pronunciation have **not** been evaluated with this candidate.

Generation exceeds the existing 18-second interactive speech timeout, so this
candidate was **not enabled as a production provider**. The current server voice
configuration remains disabled. A separate CUDA run and any claims about RTX
4050 performance remain untested. Before enabling, resolve latency and shared
memory limits, confirm voice/data rights, and obtain a native review of actual
technical speech samples. No paid speech call was made during this evaluation.

Validation for this change: all 83 existing Nardouch Python tests passed, both
new evaluator scripts pass Black and compilation checks, every checkpoint file
passed its pinned hash check, the real offline CPU synthesis completed within the
300-second evaluation bound, and the resulting WAV decoded correctly. API,
frontend and browser files were not changed in this evaluation; their earlier
results are historical, not newly rerun checks.

## Per-course Nardouch growth

Each learner starts a separate Baby Nardouch for each published course revision.
The course overview, source-faithful reader and lesson presentation show the
companion. Use **Complete lesson** to save reading completion; this is an explicit
learner action and never an assessment or an XP award. Returning to a course
restores its saved progress. Another course or a new revision starts fresh.

| Stage | Unlock rule |
| --- | --- |
| Baby | No lessons completed |
| Learner | First lesson completed, below 40% |
| Explorer | At least 40% of lessons completed |
| Expert | At least 75% completed, including finished reading while checks remain |
| Graduate | Every lesson completed AND accepted mastery evidence for every course objective |

Short courses can skip intermediate stages. Graduation uses the existing reviewed
activity checks and grader, not a separate generated final exam. A wrong,
unavailable or unreviewed result cannot unlock Graduate. Courses with no objectives
or no reviewed checks cannot graduate. Reading completion alone never changes
competency, grades or learning XP. The rewards summary no longer derives a
mascot's stage from global motivation XP.

`course_nardouch_progress` stores completed lesson IDs with a unique
`(userId, courseId, revisionId)` index. The authenticated principal supplies the
owner; clients cannot submit a user, stage, score or graduation flag. The service
validates lesson IDs against the verified published source/canonical document,
checks current course access and uses atomic `$addToSet` writes. Repeated and
concurrent completion requests converge on one row. Graduation is recomputed
from current, pinned accepted evidence rather than persisted as a client flag.

The existing authenticated learning router exposes:

- `GET /api/v1/study/learning/courses/:courseId/nardouch?revisionId=...`
- `POST /api/v1/study/learning/courses/:courseId/nardouch/lessons`, with exactly
  `{ "revisionId": "...", "lessonId": "..." }`.

Next Server Actions forward the authenticated session and use uncached API
requests. Completion and graded attempts refresh the companion; focus/reload also
refresh its state. A save failure retains the last confirmed stage and offers a
retry. No local storage is used for production course progress.

### Supplied artwork

The initial ZIP contained 512×512 opaque PNGs (and SVGs embedding those same
rasters). These have been superseded by the six newly supplied 1254×1254 RGBA
cutouts. All six have actual transparent pixels (alpha range 0–255), not just
an alpha-capable format. They were visually compared with the course stages and
renamed without changing their bytes:

| Original generated filename ending | Picture | New filename |
| --- | --- | --- |
| `09_05_49 PM-1.png` | Reading a book | `nardouch-learner-transparent.png` |
| `09_05_49 PM-2.png` | Laptop and floating rock | `nardouch-hero-transparent.png` |
| `09_05_50 PM-3.png` | Graduation cap and diploma | `nardouch-graduate-transparent.png` |
| `09_05_50 PM-4.png` | Backpack and magnifying glass | `nardouch-explorer-transparent.png` |
| `09_05_51 PM-5.png` | Code and chart panel | `nardouch-expert-transparent.png` |
| `09_05_52 PM-6.png` | Baby holding a star | `nardouch-baby-transparent.png` |

All paths live in `apps/web/public/images`. A single `nardouchImage()` mapping
selects the new artwork for the landing hero, growth timeline, graduation banner
and course companion. New URLs avoid reusing cached opaque art. Image quality 90
is allowed explicitly in Next configuration. The old image masks and rounded
image clipping were removed so the supplied transparent silhouettes stay whole;
responsive containment still keeps stage images clear of labels. Course growth
rules and saved progress are unchanged by this artwork update.

### Validation

- API growth/persistence rule tests and existing Nardouch unit regressions: 35 passed.
- Frontend companion, reader, practice and assistant tests: 28 passed.
- Real PostgreSQL integration: 7 passed, including concurrent idempotent writes,
  reconnect persistence, separate courses/revisions, permission denial, incorrect
  checks staying at Expert, and the real reviewed grader unlocking Graduate.
- Existing real Nest/Better Auth conversation regressions: 6 passed.
- Playwright: growth, reload, course isolation, failed saves, mobile layout and
  real Next landing image loading. The component interaction harness substitutes
  only Server Action/router transport; database and grading behavior are covered
  by the real integration test above.
- API/frontend type checks and production builds passed. Targeted lint checks
  passed on the changed implementation files.

Reproduce the browser checks with
`pnpm --filter web exec playwright test --config e2e/course-growth/playwright.config.ts`.
The harness starts a Vite component fixture on 4181 and Next on 5373 with a separate
`.next-growth-qa` output directory. Screenshots are written under ignored `var/tmp`.

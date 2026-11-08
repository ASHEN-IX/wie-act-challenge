# EdNova — Batch 4 RC regression closure

**Date:** 2026-11-08 (Africa/Tunis)  
**Verdict: GO for the defined RC technical regression gates.** Both reported API
failures are resolved, and every final check run for this task passes. This is
not production readiness, academic certification, accessibility conformance or
live-provider certification. The existing controlled internal
[pilot policy](EDNOVA-BATCH4-PILOT-POLICY.md) remains binding.

## Baseline and preservation

Read the [previous build closure](EDNOVA-BATCH4-RC-FINAL-BUILD-CLOSURE.md),
[pilot readiness](EDNOVA-BATCH4-PILOT-READINESS.md), and pilot policy before editing.
Branch is `main`; HEAD remains `6dc3796d2a1d9367aa0688d5f4791247683841ea`. The index was empty at entry and
remains empty. No staging, commit, stash, history rewrite, deployment or live
provider enablement occurred.

Both reported failures reproduced before changes: **2 failed / 16 passed** in
the two targeted suites, exit 1. The coach case received `unavailable` with
configured `compact` / `groq/openai/gpt-oss-20b`; the artwork case looked for the
five retired opaque stage PNGs.

Only four test files changed in this task:

| File | Workstream ownership | Correction |
|---|---|---|
| `apps/api/modules/ai-orchestrator/src/tests/coach.test.ts` | AI status contract regression | Mock the actual status HTTP boundary; preserve the unavailable/null case and add configured-unavailable, missing-agent, real and mock execution cases |
| `apps/api/tests/shared/duplicate-bugs.test.ts` | Approved Nardouch artwork regression | Use the real mapping, compare stage vocabularies, and verify six actual RGBA PNGs |
| `apps/web/src/features/nardouch/course-growth.test.tsx` | Nardouch companion/avatar regression | Render and inspect the actual image URL for all five stages |
| `apps/web/e2e/course-growth/growth.spec.ts` | Nardouch artwork browser verification | Advance the existing desktop scroll timeline before asserting stage visibility; retain every original image/visibility assertion |

This report is the only new tracked-scope artifact. All other pre-existing paths
were checked against entry SHA-256 hashes, including all artwork bytes,
landing/marketing source, `cinematic-scroll.spec.ts`, the Nardouch mismatch fix
and its tests, Python classification, release-integrity code, dependency files
and previous reports. They remain unchanged. Next dev temporarily appended two
`.next-growth-qa` type includes; only that generated edit was removed, restoring
`apps/web/tsconfig.json` to its entry bytes.

## Coach status: contract and root cause

Authoritative evidence is the outbound `ProviderAgentStatus` /
`ProviderStatusReport` in `apps/api/shared/aiClient.ts`, the sanitized status
producer `apps/ai/utils/llm_client.py:get_provider_status`, its HTTP router
`services/api/routers/provider.py`, and the API projection in
`modules/ai-orchestrator/src/routes/ai.ts`. The separate operational endpoint
`src/framework/infrastructure.controller.ts:aiStatus` returns the provider report.
The existing M06 integration test checks these contracts over a local HTTP double.

| Concept | Established meaning and limit |
|---|---|
| Configured | An agent has a configured tier/model. This remains useful diagnostic metadata when execution is unavailable. A model name alone proves neither credentials nor approval nor successful execution. |
| Reachable | Receiving the Python status report proves the API can reach that status service. This metadata request does not contact an LLM provider or prove that provider is currently reachable. Python's connectivity verification comes from qualifying execution evidence, not a fresh health inference. |
| Available | The API projects each upstream agent's `available` boolean independently. Missing reports/entries fail closed. Python allows explicit mock mode or qualifying verified real execution; `MOCK_TEST` must stay distinguishable. |
| Operational real inference | Python requires an execution record matching current approval, credentials and an active budget. Its identity/connectivity/execution/output flags are derived from that evidence. They are not an uptime or live-certification guarantee. |

Thus **a configured tier/model while `status: unavailable` is valid**. Nulls mean
there is no upstream configuration report for that agent, not that every
unavailable agent loses its configured identity. The global `executionMode`
does not make every agent operational.

The failing test mocked `moduleClient`, but `/ai/status` uses the independent
`aiClient.getProviderStatus()` boundary. That unmocked call reached the local
Python service, so the test accidentally depended on its configuration and
assumed it was unreachable. The runtime projection was already consistent with
the product contract; changing it to erase valid metadata would be a regression.

The corrected suite retains the original unavailable/null assertion with an
explicit rejected status call, asserts **all six** agents fail closed, and adds
four cases covering configured-but-unavailable metadata, another operational
agent with no coach entry, verified real mode, and explicit mock mode. Every case
asserts one bounded status request with the existing **2,000 ms** timeout.
No production status fields or implementation changed, and no assertion was
changed merely to match the observed local model.

UI inspection found no learner UI using configured model truthiness as availability.
`src/features/ai-status/ai-status.ts` / `ai-status-view.tsx` and the learning,
private-help, collaboration and visual-lab consumers describe per-answer
execution mode. `MOCK_TEST`, deterministic fallback and `UNAVAILABLE` remain
explicitly distinct from `REAL_APPROVED`. No UI change was necessary.

## Nardouch artwork: approved contract and root cause

`docs/NARDOUCH.md` (Supplied artwork) explicitly supersedes the 512px opaque set
with the supplied **1254×1254 RGBA cutouts**. The live mapping in
`apps/web/src/lib/brand.ts` already returns
`/images/nardouch-${stage}-transparent.png`. `NardouchAvatar`, `CourseNardouchView`,
`HeroSection`, `NardouchEvolution`, and `FinalCTA` all call this mapping.
`next.config.mjs` already allows image qualities **75 and 90**.

| Stage/use | Existing approved asset | Decoded source | Production serving |
|---|---|---|---|
| Baby | `nardouch-baby-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |
| Learner | `nardouch-learner-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |
| Explorer | `nardouch-explorer-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |
| Expert | `nardouch-expert-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |
| Graduate | `nardouch-graduate-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |
| Landing hero | `nardouch-hero-transparent.png` | 1254×1254 RGBA; alpha 0–255 | Original + q75/q90 optimized: 200 |

All six transparent files are already tracked. Pillow decoded the actual PNG
pixels, not just their headers. Production HTTP originals matched source SHA-256
bytes; **12 optimized variants** (`w=128`, q75/q90) decoded in Chromium as
128×128 images with alpha **0–255**. Across originals and optimized variants,
**18 HTTP responses were 200**. There is no demonstrated rendering defect and
no artwork, image mapping, image configuration or visual design was modified.

The retired set is the five stage PNG/WebP pairs plus the hero PNG/WebP pair,
and `nardouch_png_svg_pack.zip` — **13 pre-existing deletions**, preserved.
A source audit of **486 runtime files** across web source/public and API
modules/shared/framework found **zero** references to the deleted PNG/WebP URLs,
including templated `nardouch-${...}.png` / `.webp` references. Historical docs
and tests are not runtime consumers. The stale synthetic filename in the API
asset test was the source of the reported failure.

The replacement coverage invokes the real mapping, checks its approved URLs,
reads each file, validates PNG signature/IHDR/dimensions/RGBA color type, and
checks frontend stages exactly cover the shared API stage vocabulary. The five
new web cases inspect companion and avatar image URLs; they cannot pass by
rendering the same default stage for every input.

Running the full existing growth browser suite also exposed a verification
assumption: its screenshot helper scrolled each character into view but expected
all desktop stages to reveal immediately. `NardouchEvolution` deliberately pins
a scrubbed progression and starts later stages at opacity 0. The helper now uses
bounded ordinary wheel scrolling to advance that timeline, then runs the same
opacity/image-load assertions. Desktop and mobile tests pass without forcing
styles, suppressing animations, adding skips or changing the design.

## Reproducible verification and exact final results

Runtime: **Node 24.20.0**, **pnpm 11.3.0**, Next **16.4.1**. A fresh source snapshot
at `/tmp/ednova-rc-regression/clean` had no installed dependencies or build cache.
`pnpm install --frozen-lockfile --offline` installed **1,120 packages**, reused
1,120 cached packages, downloaded zero, and completed in **1.2 s**, exit 0.
No manifest/lockfile versions changed in this task.

The broad API command includes its existing real Mongo/RabbitMQ formula-job
suite. Mongo on **27017** and the QA broker on **5672** are prerequisites. For the
clean snapshot, only `RABBITMQ_USER`, `RABBITMQ_PASS`, and `RABBITMQ_VHOST` were
loaded from the existing ignored local QA `.env` into the test environment;
credentials were not printed or copied into source/evidence. Node's provider
status integration uses a local HTTP fixture. Nardouch integrations select
isolated databases and use HTTP inference doubles where applicable.

| Check / command | Exact final result | Exit |
|---|---|---:|
| Targeted Jest: `modules/ai-orchestrator/src/tests/coach.test.ts tests/shared/duplicate-bugs.test.ts --runInBand` | **28 passed / 2 suites**, 1.035 s | 0 |
| `pnpm --filter api test:unit` (clean snapshot with QA broker environment) | **1,185 passed / 81 suites**, 12.499 s | 0 |
| `pnpm --filter web test` (clean snapshot) | **221 passed / 33 files**, 6.21 s | 0 |
| API `typecheck` (`tsc -p tsconfig.check.json`) | Pass, including API test types | 0 |
| API `build` (`tsc`) | Pass | 0 |
| Web `typecheck` (`next typegen && tsc --noEmit`) | Pass | 0 |
| Web `build` (`next build --webpack`) | Compiled **22.4 s**; TypeScript **6.8 s**; **27/27** static pages; complete route table | 0 |
| M06 provider-mode/status Node integration | **4 passed**, 597.263 ms | 0 |
| Real Mongo course-growth Node integration | **7 passed**, 1,972.970 ms | 0 |
| Real Nest/Better Auth/Mongo Nardouch conversation Node integration | **6 passed**, 3,963.160 ms | 0 |
| Course-growth browser suite, including real Next landing/artwork | **3 passed**, 16.5 s | 0 |
| Nardouch conversation/voice browser fixture | **11 checks passed** | 0 |
| Production asset HTTP/decode probe | **6 originals + 12 optimized variants**, all 200; transparent pixels retained | 0 |
| Batch 3/4 authenticated acceptance | **2 passed**, 2.2 min; `PLAYWRIGHT_EXIT=0` | 0 |
| Batch 4 M4.1 authenticated planning acceptance | **6 passed**, 38.4 s | 0 |
| `git diff --check` | Pass | 0 |

The API total grows from the previous 1,175 to 1,185 by **four status cases and
six asset cases**; both previously failing cases are now green. The web total
adds five stage-rendering cases to the inherited **216**, reaching **221**.
The **20 Nardouch web tests in six files** are included in 221, not added again.
Node runner integration counts include their parent tests. Tables list distinct
commands; no inflated cross-command total is claimed.

Reproduction from the checkout, with the same QA services and environment:

```bash
pnpm install --frozen-lockfile
pnpm --filter api typecheck
pnpm --filter api build
pnpm --filter api exec jest modules/ai-orchestrator/src/tests/coach.test.ts tests/shared/duplicate-bugs.test.ts --runInBand
pnpm --filter api test:unit
pnpm --filter web test
pnpm --filter web typecheck
pnpm --filter web build
pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/m06-ai-provider-mode.node.test.ts
NARDOUCH_GROWTH_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/course-nardouch.node.test.ts
NARDOUCH_TEST_MONGODB_URI=mongodb://127.0.0.1:27017 pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/nardouch.node.test.ts
pnpm --filter web exec playwright test --config e2e/course-growth/playwright.config.ts
```

The conversation browser fixture runs `node e2e/nardouch/browser.mjs` from web
with its existing Vite fixture server (`vite --config e2e/nardouch/vite.config.ts`).
The retained `verify-artwork-http.cjs` probe runs from the repository root against
`ARTWORK_ORIGIN` (default `http://localhost:5383`) after starting the built Next
application for local asset QA.

Authenticated acceptance commands (run sequentially; they share ports 5360–5362):

```bash
DOCKER_HOST=unix:///var/run/docker.sock FINAL_QA_DOCKER_NETWORK=ednova-api_default FINAL_QA_RABBITMQ_CONTAINER=ednova-qa-rabbitmq bash scripts/qa-run-final.sh
DOCKER_HOST=unix:///var/run/docker.sock FINAL_QA_DOCKER_NETWORK=ednova-api_default FINAL_QA_RABBITMQ_CONTAINER=ednova-qa-rabbitmq pnpm --filter web exec playwright test --config playwright.m41.config.ts
```

These journeys use real browser/authentication, Mongo, RabbitMQ, Python ingestion/
indexing, Nest and Next, with the **existing offline Gemini SDK replay and explicit
mock planner boundary unchanged**. The original 2-chapter / 16-lesson assertions
are unchanged. No live LLM, TTS provider or inference key was enabled.

Diagnostic failures are retained rather than hidden: the baseline two failures;
a clean run lacking broker credentials (**7 formula-job setup failures / 1,178
passed**, followed by termination of the stranded test process); the initial
landing-helper reveal failure (**2 passed / 1 failed**); and five errors in an
initial added unit helper that decoded whole HTML containing literal percentage
text as a URI. The unit helper now parses only the image URL, and the final
221-test run passes. These were verification/setup corrections, not assertion
removals or additional product changes.

Non-blocking diagnostics remain visible: Vitest's standalone SSR image context
warns about quality 90 because it defaults to 75; the real Next configuration and
production HTTP checks accept both configured qualities. The temporary `next
start` asset probe emitted the existing standalone-output startup advisory;
it served the measured images and is not a deployment recipe. Existing test/
framework deprecation and hydration diagnostics are retained in logs.

## Release hygiene: proposed path-scoped attribution and commit plan

**Proposal only; nothing below was staged or committed.** Each row is an
independently reviewable path set. Generated adapters stay with their owning
route change. Do not combine landing design, Nardouch behavior, Python
classification and release-integrity runtime edits into one commit.

| Proposed commit/workstream | Exact path scope and attribution |
|---|---|
| RC coach status contract tests | `apps/api/modules/ai-orchestrator/src/tests/coach.test.ts` — this task; test-only contract clarification |
| RC approved-artwork regression tests | `apps/api/tests/shared/duplicate-bugs.test.ts`, `apps/web/src/features/nardouch/course-growth.test.tsx`, `apps/web/e2e/course-growth/growth.spec.ts` — this task; test-only artwork/interaction verification |
| Web build dependency closure | `apps/web/package.json`, `pnpm-lock.yaml` — inherited explicit Vite declaration; keep manifest and lock together |
| Operator metrics authorization | `apps/api/modules/study/src/routes/learning.ts`, `apps/api/src/framework/domains/study.module.ts`, `apps/api/modules/study/src/tests/metrics-authorization.test.ts` — inherited release-integrity work; route and generated adapter are one change |
| Durable plan storage and trusted recovery | `apps/api/modules/study/src/services/experiencePlanGeneration.ts`, `experiencePlanStore.ts`, `apps/api/modules/study/src/tests/experience-plan-store.test.ts`, `plan-generation-persistence-order.test.ts` (same test directory) — inherited ordering, stored-shape and recovery-integrity work |
| Revision-manifest fail-closed ingestion | `apps/ai/workers/ingestion_worker.py`, `apps/ai/tests/test_ingestion_manifest_failclosed.py`, `test_ingestion_manifest_outage.py` (same test directory) — inherited ingestion work |
| Python prerequisite/CI classification | `apps/ai/pyproject.toml`, `apps/ai/tests/conftest.py`, `test_coach_course_context.py`, `test_nardouch_elevenlabs.py`, `test_nardouch_piper.py` (same test directory), `apps/ai/tests/integration/test_signal_pipeline.py` — inherited classification; decorators must travel with registration/helper |
| Nardouch course/revision mismatch | `apps/web/src/features/nardouch/course-growth.tsx`, `course-growth-mismatch.test.tsx` (same directory) — inherited pilot behavior fix, separate from artwork/status work |
| QA broker/network harness | `apps/api/tests/final-acceptance-server.ts` — inherited local-harness corrections; no provider boundary expansion |
| Earlier Nardouch artwork retirement | The 12 deleted `apps/web/public/images/nardouch-{baby,learner,explorer,expert,graduate,hero}.{png,webp}` files and deleted `nardouch_png_svg_pack.zip` — prior artwork workstream; preserve deletion intent, review separately |
| Existing landing/marketing work | `apps/web/src/components/landing/SiteNav.tsx`, `apps/web/src/components/marketing/marketing.css`, `apps/web/e2e/cinematic-scroll.spec.ts` — unrelated inherited work; exclude from RC regression commits |
| Evidence by milestone | `apps/api/scripts/m46b-release-integrity-proof.ts`, `m47-post-store-crash-proof.ts`, `m48-recovery-integrity-proof.ts` (same scripts directory); `apps/web/e2e/batch4b-reader-a11y.mjs`, `batch4rc-reader-a11y.mjs` (same E2E directory); the five untracked Batch 4 closure/pilot reports listed below — split by milestone after the corresponding runtime commits, not a combined implementation commit |
| Diagnostic-only probes | `apps/api/scripts/_probe_parse.ts`, `_probe_read.ts`, `_probe_roundtrip.ts` — retain for owner disposition; exclude from the proposed release commits unless explicitly promoted |

Review order: foundational ingestion/metrics/storage corrections and their tests;
Python classification and build dependency; separately attributed Nardouch and QA
harness work; these two RC regression-test commits; then milestone evidence and
this verdict report. Each candidate needs its own diff review and applicable
verification. Reports aggregate evidence but do not transfer implementation
ownership between workstreams.

## Remaining gates and final RC verdict

- **Accessibility:** authenticated-reader behavior, keyboard interaction and
  reflow acceptance passed. No fresh axe-based conformance audit or assistive-
  technology/screen-reader assessment was performed. Earlier enrolled-reader
  contrast, semantic/ARIA and surface-specific measurement gaps remain open;
  WCAG conformance is not established.
- **Academic correctness:** independent mathematical adjudication/certification
  remains blocked. Review labels and source-faithful fallback behavior are
  technical safeguards, not independent proof of correctness.
- **Educational effectiveness:** comprehension, retention and learning outcomes
  have not been established.
- **Provider certification:** no live Gemini, ElevenLabs or other provider was
  exercised. Status configuration and mocked availability are not live execution
  certification. Optional decoder/runtime coverage remains bounded by the prior
  Python report's explicit skips.
- **Production operations:** no deployment, production load/scale certification,
  full DR rehearsal or production operational approval. C4 legacy planner cleanup
  remains a separate open workstream.

The previous Python classification and 17-scenario plan-recovery evidence are
carried from the earlier closure; their runtime/test files are byte-identical to
entry and no new rerun of the Python sweep or proof is claimed here. The broad
API suite does rerun the existing storage/recovery unit regressions.

**GO applies only to this RC's defined technical regression gates**, with the
recorded QA prerequisites and provider-mock boundary. It does not remove any
pilot restriction or certify the categories above. Both originally reported
broad API regressions are closed without changing production behavior or
recreating retired artwork. Work stops at this closure.

## Exact final Git state and retained evidence

HEAD is unchanged; index empty. `git status --porcelain=v1`:

```text
 M apps/ai/pyproject.toml
 M apps/ai/tests/integration/test_signal_pipeline.py
 M apps/ai/tests/test_coach_course_context.py
 M apps/ai/tests/test_nardouch_elevenlabs.py
 M apps/ai/tests/test_nardouch_piper.py
 M apps/ai/workers/ingestion_worker.py
 M apps/api/modules/ai-orchestrator/src/tests/coach.test.ts
 M apps/api/modules/study/src/routes/learning.ts
 M apps/api/modules/study/src/services/experiencePlanGeneration.ts
 M apps/api/modules/study/src/services/experiencePlanStore.ts
 M apps/api/modules/study/src/tests/experience-plan-store.test.ts
 M apps/api/src/framework/domains/study.module.ts
 M apps/api/tests/final-acceptance-server.ts
 M apps/api/tests/shared/duplicate-bugs.test.ts
 M apps/web/e2e/cinematic-scroll.spec.ts
 M apps/web/e2e/course-growth/growth.spec.ts
 M apps/web/package.json
 D apps/web/public/images/nardouch-baby.png
 D apps/web/public/images/nardouch-baby.webp
 D apps/web/public/images/nardouch-expert.png
 D apps/web/public/images/nardouch-expert.webp
 D apps/web/public/images/nardouch-explorer.png
 D apps/web/public/images/nardouch-explorer.webp
 D apps/web/public/images/nardouch-graduate.png
 D apps/web/public/images/nardouch-graduate.webp
 D apps/web/public/images/nardouch-hero.png
 D apps/web/public/images/nardouch-hero.webp
 D apps/web/public/images/nardouch-learner.png
 D apps/web/public/images/nardouch-learner.webp
 D apps/web/public/images/nardouch_png_svg_pack.zip
 M apps/web/src/components/landing/SiteNav.tsx
 M apps/web/src/components/marketing/marketing.css
 M apps/web/src/features/nardouch/course-growth.test.tsx
 M apps/web/src/features/nardouch/course-growth.tsx
 M pnpm-lock.yaml
?? apps/ai/tests/conftest.py
?? apps/ai/tests/test_ingestion_manifest_failclosed.py
?? apps/ai/tests/test_ingestion_manifest_outage.py
?? apps/api/modules/study/src/tests/metrics-authorization.test.ts
?? apps/api/modules/study/src/tests/plan-generation-persistence-order.test.ts
?? apps/api/scripts/_probe_parse.ts
?? apps/api/scripts/_probe_read.ts
?? apps/api/scripts/_probe_roundtrip.ts
?? apps/api/scripts/m46b-release-integrity-proof.ts
?? apps/api/scripts/m47-post-store-crash-proof.ts
?? apps/api/scripts/m48-recovery-integrity-proof.ts
?? apps/web/e2e/batch4b-reader-a11y.mjs
?? apps/web/e2e/batch4rc-reader-a11y.mjs
?? apps/web/src/features/nardouch/course-growth-mismatch.test.tsx
?? reports/EDNOVA-BATCH4-PILOT-POLICY.md
?? reports/EDNOVA-BATCH4-PILOT-READINESS.md
?? reports/EDNOVA-BATCH4-RC-FINAL-BUILD-CLOSURE.md
?? reports/EDNOVA-BATCH4-RC-REGRESSION-CLOSURE.md
?? reports/EDNOVA-BATCH4-RELEASE-INTEGRITY-CLOSURE.md
```

Local raw logs, the production asset probe, decoded image metadata, runtime URL
audit, initial/final Git snapshots and preservation hashes are retained under
`reports/evidence/batch4-rc-regression-closure/` (repository-ignored evidence).
The clean source/dependency/build snapshot is `/tmp/ednova-rc-regression/clean`.
Temporary local QA servers were stopped; harness-created databases/containers
were cleaned up. Unrelated services and workstreams were preserved.

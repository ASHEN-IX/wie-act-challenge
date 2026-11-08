# EdNova — Batch 4 RC final build and integrity closure

Date: 2026-11-08 (Africa/Tunis). Scope: narrow RC correction and verification only.
No Batch 5 work, deployment, live-provider inference, or Git history changes.

**Verdict:** web production build and recovery-integrity gates pass; Python CI
classification is corrected. The complete regression gate is **not green**:
the unchanged API coach assertion and existing missing-image coverage failure
remain visible. This report does not authorize a deployment or broaden the pilot.
It supersedes the build, recovery and Python-count conclusions in the earlier
[pilot-readiness report](EDNOVA-BATCH4-PILOT-READINESS.md).

## Exact Git state and attribution

Branch: `main`. HEAD: `6dc3796d2a1d9367aa0688d5f4791247683841ea`. Index: empty at entry and at closure.
No commit, stash, reset, rebase or staging was performed. The source snapshot used
for the clean installation copied existing tracked and untracked source files,
respecting pre-existing deletions, into `/tmp/ednova-rc-final/clean`; it had no
inherited `node_modules` or Next build cache.

The entry tree already contained the Vite declaration/lock importer and a draft
trusted-reader/recovery correction. Those runtime changes were retained and
verified, rather than overwritten or attributed as newly authored here.
This closure changed only:

- `apps/ai/tests/conftest.py`: apply the registered classification marker as well
  as the existing conditional prerequisite skip.
- `apps/ai/tests/test_nardouch_elevenlabs.py`: mark the seven parametrized status
  cases and timeout case that also import `av` before dispatch.
- `apps/ai/tests/integration/test_signal_pipeline.py`: classify the two database-backed
  service tests; leave the six detector tests in core.
- `apps/api/modules/study/src/tests/experience-plan-store.test.ts`: exercise the
  actual persisted published shape, removing the test-only proposal conversion.
- `apps/api/modules/study/src/tests/plan-generation-persistence-order.test.ts`:
  update the recovery mock to the trusted reader and assert its input binding.
- `apps/api/scripts/m48-recovery-integrity-proof.ts`: repair invalid fixtures,
  test persisted review revocation, concurrency and ledger invariants.
- The pilot-readiness report's supersession note/CI instructions and this report.

SHA-256 comparisons against the entry snapshot confirmed the landing navigation,
marketing CSS, cinematic-scroll edits, and both Nardouch mismatch source/test
files were preserved byte for byte. All 13 pre-existing image/archive deletions
remain deletions. The mismatch fix and its two tests belong to the earlier
Nardouch workstream; they are not new RC-build coverage.

Final `git status --porcelain=v1` (including this report):

```text
 M apps/ai/pyproject.toml
 M apps/ai/tests/integration/test_signal_pipeline.py
 M apps/ai/tests/test_coach_course_context.py
 M apps/ai/tests/test_nardouch_elevenlabs.py
 M apps/ai/tests/test_nardouch_piper.py
 M apps/ai/workers/ingestion_worker.py
 M apps/api/modules/study/src/routes/learning.ts
 M apps/api/modules/study/src/services/experiencePlanGeneration.ts
 M apps/api/modules/study/src/services/experiencePlanStore.ts
 M apps/api/modules/study/src/tests/experience-plan-store.test.ts
 M apps/api/src/framework/domains/study.module.ts
 M apps/api/tests/final-acceptance-server.ts
 M apps/web/e2e/cinematic-scroll.spec.ts
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
?? reports/EDNOVA-BATCH4-RELEASE-INTEGRITY-CLOSURE.md
```

## Web dependency and reproducible production build

Compared with HEAD, `apps/web/devDependencies` adds exactly `"vite": "^7.3.7"`.
The lockfile adds only its three-line web importer entry and resolves **Vite
7.3.7**, already present in the lock's package graph. Vitest remains **3.2.7**
(manifest `^3.2.1`); its installed dependency range is
`^5.0.0 || ^6.0.0 || ^7.0.0-0`, which accepts 7.3.7. Node is **24.20.0** and
pnpm is **11.3.0**, matching the repository's required pnpm version.

Both `e2e/course-growth/vite.config.ts` and `e2e/nardouch/vite.config.ts` import
`defineConfig` from Vite. Declaring that direct dependency is the smallest
correct fix for pnpm's dependency isolation. No E2E config or TypeScript include/
exclude setting was changed. No latest-version upgrade or new Vite package graph
was introduced.

Commands and measured results:

| Command / check | Result | Exit |
|---|---|---:|
| `pnpm install --lockfile-only --offline` | Lockfile already consistent; retained existing versions | 0 |
| Clean snapshot: `pnpm install --frozen-lockfile --offline` | Blocked: `@better-auth/mongo-adapter@1.7.7` tarball absent from local store | 1 |
| Clean snapshot: `pnpm install --frozen-lockfile` | **1,120 packages installed**, resolution skipped, 51.5 s | 0 |
| Clean snapshot: `pnpm --filter web typecheck` | `next typegen && tsc --noEmit`: **pass** | 0 |
| Clean snapshot: `pnpm --filter web build` | Next **16.4.1**, webpack compile 20.3 s; TypeScript 6.3 s; **27/27 static pages**, route table emitted | 0 |
| Clean snapshot: `pnpm --filter web test` | **216 passed, 33 files**, 5.10 s = existing **214** + inherited **2** mismatch tests | 0 |
| Clean snapshot: `vite build --config e2e/course-growth/vite.config.ts` | **1,819 modules**, 5.93 s | 0 |
| Clean snapshot: `vite build --config e2e/nardouch/vite.config.ts` | **1,823 modules**, 5.66 s | 0 |

The Vite builds emitted `use client` directive warnings for fixture bundles;
these did not fail bundling. The earlier reported production-build failure is
closed by a clean installed build, not by excluding files from checking.

## Recovery integrity: reproduced defect and verified contract

`peekStoredPlan(input)` returns **`Promise<boolean>`**, specifically
`(await checkStoredPlanAvailability(input)) === 'available'`. It never returns
a validated plan or an availability object. For `mode === 'read'`, availability
is immediately `available`, even without a stored plan. For other modes, it
queries the exact course/revision/lesson/mode, excludes superseded rows, then
checks invalidation plus plan-schema, registry and presentation-schema versions.
It does **not** verify content hash, context fingerprint, body integrity, digest,
or current asset-review authority. Therefore `true` cannot justify adoption.

Two defects were reproduced in the isolated source snapshot:

1. Restoring the pilot's weak peek-based adoption lets a tampered record become
   `validated`/`already_accepted` while the actual reader returns `rejected`.
   The proof fails with `adopted plan is not retrievable` (exit 1).
2. Restoring the HEAD reader shows that it parses a persisted **published plan**
   as a **proposal**. The real-shape round-trip test fails (`available` expected,
   `rejected` received); **2 failed / 17 passed**, exit 1. The old unit fixture
   manually converted the stored shape, concealing that incompatibility.

The verified correction uses `loadAcceptedPlan()` for uncertain-row adoption.
That reader parses the actual published body, reconstructs the proposal for the
existing seven-stage validator, and returns a newly validated projection. Its
contract checks the exact revision, current content hash and context fingerprint,
plan/registry/presentation compatibility, canonical coverage, component policy,
current trusted asset/review bindings, and equality between body, record and
recomputed plan digests. Authorization and context loading remain the existing
trusted caller's responsibility. No existence/availability shortcut can promote
an uncertain request.

Promotion uses a conditional `{ _id, state: 'uncertain' }` update; a losing caller
rereads the row. Invalid or absent plans stay `uncertain` with
`PROVIDER_UNCERTAIN_PREVIOUS`; they do not fall through to dispatch.

`pnpm --filter api exec tsx scripts/m48-recovery-integrity-proof.ts`:
**ALL 17 SCENARIOS PASS**, exit 0, against real MongoDB.

| Scenario | Observed |
|---|---|
| Valid durable plan | Adopted; request validated; exact plan retrievable and digests equal |
| Unknown component in stored canonical body | Refused, uncertain |
| Stale content hash | Refused, uncertain |
| Persisted approved CodeWalkthrough review revoked | Valid/retrievable before revocation; live review binding resolves `revoked`; adoption refused afterward |
| Wrong revision in body; wrong revision on record | Both refused |
| Three concurrent stale-request recoveries | Exactly one total transition per seeded crash window |
| Three concurrent adoptions | Three accepted replies, one request, one plan, one terminal state |
| Peek versus trusted read | `peek=true`, `availability=available` on stale data; trusted adoption refuses |
| Record/body fingerprint changes | Refused |
| Plan schema, registry and presentation-schema changes | Refused |
| Record digest, body digest, and well-formed disclosure tampering | Refused |
| No durable plan | Honest uncertain failure |

Every adoption attempt, including rejected cases and concurrent callers, asserts
**0 provider dispatches, 0 reservations and 0 reconciliations/refunds**, identical
before/after durable budget documents, and unchanged request accounting fields.
The seeded ledger retains **32,768 used tokens / one used request**. Successful
adoption is also read back through the trusted contract. The digest is the
existing deterministic equality contract, not a claim of cryptographic signing.

## Python CI classification and distinct counts

Actual registered names (`pytest --markers`) are `integration`, `requires_mongo`,
`optional_elevenlabs`, and `optional_piper`. `needs_av`, `needs_piper` and
`needs_mongo` are Python decorator aliases, not registered marker names.
Originally those aliases only added `skipif`, so the documented `-m` selectors
did not classify their tests. They now add the corresponding registered marker
and retain the conditional prerequisite gate.

The first run also reproduced eight additional missing-`av` failures: all seven
HTTP-status parameters and the timeout test import `av` before HTTP dispatch.
Only those specific tests received the additional marker. The two signal-service
tests construct Mongo repositories and now carry both `requires_mongo` and
`integration`. The six detector tests continue to run in core. No coach assertion
or blanket skip was added, removed or weakened.

Authoritative final Python runs use the existing AI image, **Python 3.12.15**,
and the exact dev-runner versions in `poetry.lock`: **pytest 9.0.2** and
**pytest-asyncio 1.3.0**, installed ephemerally. This is not a new complete Poetry
environment installation. Earlier diagnostic runs used pytest 9.2.0 / asyncio
1.4.1.post1 and are retained separately in evidence. `LLM_MOCK=1`; Mongo-backed
runs use the isolated local QA database, and model downloads are disabled.

Collection of `tests/` with `--strict-markers` yields **1,135 distinct node IDs**:

| Disjoint group | Selected | Passed | Skipped | Failed |
|---|---:|---:|---:|---:|
| Core, excluding the separate pair and service/optional markers | 1,075 | 1,072 | 3 | 0 |
| `test_llm_client.py` + `test_experience_planner_dispatch.py`, separate process | 40 | 40 | 0 | 0 |
| Optional ElevenLabs (`13`) + Piper (`1`) | 14 | 0 | 14 | 0 |
| `integration or requires_mongo`, reachable isolated Mongo | 6 | 6 | 0 | 0 |
| **Distinct total** | **1,135** | **1,118** | **17** | **0** |

The six `requires_mongo` tests include the two `integration` tests: **6 + 2 must
not be reported as eight**. Three core skips are existing opt-in tests: database
startup-outage recovery (one) and Mongo budget tests (two), requiring their
specific isolated-local-test URI variables. Fourteen optional tests were
selected and conditionally skipped because `av`/`piper` are absent; this is not
optional-runtime certification. The Mongo/service processes emitted a non-fatal
MediaPipe finalizer warning after passing, including the locked-runner run.

Additional overlapping checks are evidence, not extra distinct coverage:

- Ingestion/outage/base-worker/topology/EDNOVA-contract/dispatch selection:
  **250 passed**; **230** are already in core and **20** in the pair.
- The actual seven-file `.github/workflows/ci.yml` AI command:
  **95 passed**; **75** are already in core and **20** in the pair.
- These two targeted selections overlap by **12** node IDs. Their counts must
  not be added to the 1,135-test union or to each other without deduplication.
- `agents/` and `services/` as independent collection roots were not swept;
  this is explicitly the `tests/` classification and the existing focused CI gate.

Correct CI commands, from `apps/ai` with the project's Python environment:

```bash
# Supply MONGODB_URI and DB_NAME for a reachable isolated QA database.
# One unmarked core coach initialization also needs Mongo.
poetry run python -m pytest tests --strict-markers \
  -m "not integration and not requires_mongo and not optional_elevenlabs and not optional_piper" \
  --ignore=tests/test_llm_client.py --ignore=tests/test_experience_planner_dispatch.py

poetry run python -m pytest --strict-markers \
  tests/test_llm_client.py tests/test_experience_planner_dispatch.py

# In an environment with av/piper installed; otherwise conditional skips are explicit.
# There is no Poetry group named "optional" in this project.
poetry run python -m pytest tests --strict-markers -m "optional_elevenlabs or optional_piper"

poetry run python -m pytest tests --strict-markers -m "integration or requires_mongo"
```

The GitHub workflow itself uses seven explicit filenames, not marker selectors.
The defect was missing selection marks on the decorator aliases; the registered
names and documented `-m` names already matched. The workflow was not broadened. The
pilot-readiness CI instructions now point here and no longer prescribe the
nonexistent `poetry install --with optional` group.

## Other regression evidence and remaining failures

| Check | Exact result | Exit |
|---|---|---:|
| API affected store/persistence suites | **25 passed, 2 suites**, 0.953 s | 0 |
| API broad `jest modules src shared --runInBand` | **1,173 passed, 2 failed; 79 suites passed / 2 failed**, 16.999 s | 1 |
| API `pnpm --filter api typecheck` | Pass | 0 |
| API `pnpm --filter api build` | Pass | 0 |
| M4.3 accounting proof | **ALL SCENARIOS MATCH** | 0 |
| M4.5 independent-process proof | **2/2 pass**; 2 and 5 processes each yield one reservation, 32,768 tokens | 0 |
| M4.6 recovery/refund proof | 32,768 refunded before dispatch; retry reserves once; uncertain charge retained | 0 |
| Real-service browser acceptance | **2 passed**, 2.1 min; `PLAYWRIGHT_EXIT=0` | 0 |
| Course-growth browser fixtures | **2 passed**, 33.4 s | 0 |
| Nardouch conversation/voice browser fixture | **11 checks passed** | 0 |
| `git diff --check` | Pass | 0 |

The broad API failures remain unmodified and visible:

1. `modules/ai-orchestrator/src/tests/coach.test.ts` —
   `GET /api/v1/ai/status / reports the provider state instead of assuming every agent is up`:
   expects unavailable with `tier: null, model: null`; receives unavailable with
   `tier: "compact", model: "groq/openai/gpt-oss-20b"`. This is the preserved
   genuine coach assertion failure; no blanket skip or assertion rewrite.
2. `tests/shared/duplicate-bugs.test.ts` — growth-stage asset coverage expects no
   missing images, but the existing deletions leave `baby`, `learner`, `explorer`,
   `expert`, and `graduate` missing. Assets/landing work were not restored or edited.

The earlier Python report called
`test_coach_session_stats.py::test_orchestrator_malformed_stats_default_to_none_never_fail`
a pre-existing assertion failure. Fresh evidence is more specific: without
Mongo it fails during `AIOrchestrator` initialization (`ServerSelectionTimeoutError`),
before its assertions. With the same test unchanged and Mongo available it passes
in the full core group. That historical assertion diagnosis is not reproduced;
the actual API coach assertion above remains open. The no-Mongo diagnostic run
is retained: **1,071 passed / 1 failed / 3 skipped / 20 deselected**, exit 1.

The real-service command was:

```bash
DOCKER_HOST=unix:///var/run/docker.sock \
FINAL_QA_DOCKER_NETWORK=ednova-api_default \
FINAL_QA_RABBITMQ_CONTAINER=ednova-qa-rabbitmq \
bash scripts/qa-run-final.sh
```

Its first invocation without the explicit broker name selected an old stopped
`rabbitmq` container and failed harness startup (exit 1). Supplying the active QA
broker name fixed only the invocation; no new harness/product change was made.
The passing run used `test_formula_final_1794110623`, real Mongo/RabbitMQ/Python
source ingestion/indexing, NestJS, Next and Chromium. Gemini SDK responses were
**offline fixtures**, guarded by the existing QA entrypoint; no live provider was
called. The original **2 chapters / 16 lessons** assertions remain unchanged.
The course-growth run selected its two fixture journeys; the third landing-art
journey was not run or claimed. Vite fixture browser transports are doubles.

## Remaining pilot limitations and evidence

- No unconditional RC/release-green claim while the two API regressions above remain.
- Authenticated-reader WCAG conformance, axe/screen-reader coverage and the earlier
  accessibility gaps are not closed by functional journeys or this production build.
- No independent mathematical certification or educational-effectiveness evidence.
- No live Gemini/ElevenLabs/provider certification; optional decoder/runtime tests
  remain unexecuted where prerequisites are absent.
- Whole-tree Python co-residence of the isolated LLM-client/dispatch pair remains
  a known limitation; the three opt-in database tests remain skipped.
- C4 legacy planner cleanup remains its separate open workstream.
- No production deployment, full production load/DR/on-call certification, or pilot
  scope expansion. Existing [pilot policy](EDNOVA-BATCH4-PILOT-POLICY.md) restrictions remain.

Raw local logs, the collected Python node IDs, group counts and preservation
hashes are retained under `reports/evidence/batch4-rc-final-build-closure/`
(repository-ignored evidence). The scratch source and logs remain at
`/tmp/ednova-rc-final/`. Temporary RC-created test containers/servers and isolated
Mongo test databases were cleaned up; unrelated running services were preserved.

This is the end of the requested Batch 4 RC closure.

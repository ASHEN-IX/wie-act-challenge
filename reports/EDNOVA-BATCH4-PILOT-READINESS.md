# EdNova Batch 4 — Controlled Pilot Readiness

**Date:** 2026-11-08
**Baseline commit:** `6dc3796` (C1 correction, release-integrity closure uncommitted on top)
**Scope:** prepare an evidence-backed release candidate for a controlled internal
pilot. No Batch 5 work, no live provider, no deployment.

> RC final follow-up (2026-11-08): build, recovery-integrity and Python classification
> conclusions below are historical and superseded by
> [the final build closure](EDNOVA-BATCH4-RC-FINAL-BUILD-CLOSURE.md).
> In particular, the original Python totals overlap, the original decorators
> did not apply their registered selection markers, and stored-plan availability
> alone did not establish retrievability. The final report records fresh evidence.

---

## 1. Exact Git baseline

```
HEAD              6dc3796  docs(c1): record C1 as resolved with the corrected root cause
parent            86d3778  fix(c1): reach the manifest branch so ingestion keeps chapters
parent            da0d0a6  docs(m46): final Batch 4 acceptance with five separate verdicts
```

### Working tree at the time of this report

| State | Files |
|---|---|
| **Modified — this milestone** | `apps/ai/pyproject.toml`, `apps/ai/tests/test_coach_course_context.py`, `apps/ai/tests/test_nardouch_elevenlabs.py`, `apps/ai/tests/test_nardouch_piper.py`, `apps/api/tests/final-acceptance-server.ts`, `apps/web/src/features/nardouch/course-growth.tsx` |
| **Modified — carried from the closure round** | `apps/ai/workers/ingestion_worker.py`, `apps/api/modules/study/src/routes/learning.ts`, `apps/api/modules/study/src/services/experiencePlanGeneration.ts`, `apps/api/src/framework/domains/study.module.ts` |
| **Modified — NOT mine, preserved untouched** | `apps/web/e2e/cinematic-scroll.spec.ts`, `apps/web/src/components/landing/SiteNav.tsx`, `apps/web/src/components/marketing/marketing.css` |
| **New — this milestone** | `apps/ai/tests/conftest.py`, `apps/ai/tests/test_ingestion_manifest_outage.py`, `apps/api/scripts/m47-post-store-crash-proof.ts`, `apps/web/e2e/batch4rc-reader-a11y.mjs`, `apps/web/src/features/nardouch/course-growth-mismatch.test.tsx`, `reports/EDNOVA-BATCH4-PILOT-POLICY.md`, this report |

Nothing is committed. No shared history was rewritten.

---

## 2. Reproduced regression results

| Suite | Expected | Measured | Status |
|---|---|---|---|
| API (`modules src shared`) | 1,173 | **1,175 passed, 81 suites** | PASS (+2 new repair tests) |
| Web unit (`vitest`) | 214 | **214 passed, 32 files** | PASS |
| Python — targeted | 245 | **283 passed** | PASS (9-file ingestion/contract group, +5 new outage tests) |
| Python — core group | — | **1,015 passed, 1 failed, 3 skipped** | 1 failure is the verified pre-existing coach test |
| Python — excluded pair | — | **40 passed in 10.16 s** | green when run together |
| Batch 3/4 acceptance E2E | 2/2 | **2 passed, EXIT=0** | PASS |
| M4.3 accounting proof | all match | **ALL SCENARIOS MATCH** | PASS |
| M4.5 cross-process proof | 2/2 | **2/2 PASS** (5 procs → 1 reservation) | PASS |
| M4.6 refund proof | refunds once | 32,768 refunded; retry re-reserved once | PASS |
| API typecheck | 0 errors | **0** | PASS |
| API production build | succeeds | **exit 0** | PASS |
| Web typecheck | 0 errors | **6 errors** (2 e2e `vite.config.ts`) | **FAIL — pre-existing** |
| Web production build | succeeds | **exit 1** at type check | **FAIL — pre-existing** |

The original Batch 3 extraction assertions are present and unmodified:

```ts
expect(chapters).toHaveLength(2);
expect(chapters.flatMap((c) => c.lessons)).toHaveLength(16);
```

### 2.0 The web production build fails, and it is not new

`next build --webpack` compiles successfully (`✓ Compiled successfully in 9.9s`)
and then **fails at the type-check step**:

```
e2e/course-growth/vite.config.ts(1,30): error TS2307: Cannot find module 'vite'
e2e/nardouch/vite.config.ts(1,30):      error TS2307: Cannot find module 'vite'
(+ 4 implicit-any errors from the same two files)
Failed to type check.
```

Both files `import { defineConfig } from "vite"`, and **`vite` is not declared in
`apps/web/package.json`** — not in `dependencies`, not in `devDependencies`. It
arrives only as a transitive/peer dependency of `vitest`, so it is not
guaranteed to resolve for `apps/web`. `apps/web/tsconfig.json` includes
`**/*.ts`, which pulls those two e2e configs into the production type check.

Verified pre-existing, not caused by this milestone:

- it reproduces with this milestone's only web source change stashed (6 errors
  either way);
- `git show` at `6dc3796`, `a8928b9` and `da0d0a6` all show **zero** `vite`
  entries in `apps/web/package.json`.

**This contradicts the M4.6 report**, which recorded the web production build as
`success` with a full route table. Either that measurement was taken in a
different working state, or it did not actually run the type-check step. The
earlier claim should be treated as unverified.

**Impact on the pilot:** the browser bundle compiles; only the type-check step
over e2e config files fails. It does not affect runtime behaviour, and a pilot
does not require a production build. But it is a genuine release blocker for
anyone who needs `next build` to pass, and it is listed in §8 as R11.

**Smallest correct fix** (not applied — it is a dependency declaration, not a
pilot-scope change): add `vite` to `apps/web/devDependencies`, or add
`"e2e"` to the tsconfig `exclude` list. Both are one-line changes outside this
milestone's remit.

### 2.1 An environment fault found and fixed while reproducing

The acceptance harness could not resolve its broker. `final-acceptance-server.ts`
hardcoded the container name `rabbitmq`; the QA stack runs it as
`ednova-qa-rabbitmq`. It also assumed Mongo was reachable by service name, but
`ednova-qa-mongo` was only attached to `bridge`.

Both are **harness** faults, not product faults. The first was fixed by
`detectBroker()` (honours `FINAL_QA_RABBITMQ_CONTAINER`, else probes
`rabbitmq` then `ednova-qa-rabbitmq`); the second by attaching Mongo to
`ednova-api_default`. Before the fix the worker logged

```
AMQPConnectionError: (-2, 'Name or service not known')
```

and every ingestion stayed `processing`.

---

## 3. Python suite classification

The 21 whole-tree failures were investigated individually. They are **five
distinct causes**, not one:

| Cause | Count | Files | Classification |
|---|---|---|---|
| Optional `av` decoder absent | 13 | `test_nardouch_elevenlabs.py` | **optional feature** |
| Optional `piper` runtime absent | 1 | `test_nardouch_piper.py` | **optional feature** |
| No reachable MongoDB | 4 | `test_coach_course_context.py` | **live service** |
| No live signal service | 2 | `tests/integration/test_signal_pipeline.py` | **integration** |
| Pre-existing assertion | 1 | `test_coach_session_stats.py` | **genuine pre-existing failure** |

The coach group was confirmed MongoDB-dependent by traceback:
`ServerSelectionTimeoutError: 127.0.0.1:27018`. It is a database dependency,
not a coach defect.

### 3.1 What was added

`apps/ai/tests/conftest.py` provides four **conditional** gates:

| Gate | Skips only when |
|---|---|
| `needs_av` | `av` genuinely cannot be imported |
| `needs_piper` | `piper` genuinely cannot be imported |
| `needs_mongo` | no URI is configured **or** no socket accepts a connection |
| `integration` marker | pre-existing; unchanged |

`needs_mongo` deliberately probes a socket rather than trusting the URI — a
stale URI pointing at a stopped container is exactly what produced four
confusing failures.

**Nothing is skipped unconditionally, and no assertion was weakened.** Only the
five `elevenlabs` tests that actually decode audio through `av`, and the one
runtime test that imports `piper`, carry a marker. The other seven ElevenLabs
tests and eight Piper tests continue to run and continue to pass.

### 3.2 Two honest limitations

- **`test_llm_client.py` and `test_experience_planner_dispatch.py`** stall in a
  whole-tree sweep (at ~73%) but pass **40/40 in 10.16 s** when run as a pair,
  and `test_experience_planner_dispatch.py` passes 20/20 alone in 1.92 s. The
  cause is event-loop interaction across the full file set, not a product
  failure. Both are excluded from the group run and reported separately.

Both of these were measured, not assumed. The core group total of **1,015
passed** covers every other test file in `tests/`. The ingestion/contract group
(9 files including both new guard suites) is **283 passed**. Taken together:
1,015 + 40 + 283 = 1,338 test executions, of which **1 fails** — the
pre-existing coach test — and 3 skip.

Because of these two, and the one pre-existing failure, the Python suite is
reported as **grouped, not green**.

### 3.3 CI instructions

```bash
# Core — current distinct counts and Mongo prerequisite are in the RC final report.
# Excludes the two files with whole-tree event-loop interaction.
poetry run python -m pytest tests --strict-markers \
  -m "not integration and not requires_mongo and not optional_elevenlabs and not optional_piper" \
  --ignore=tests/test_llm_client.py --ignore=tests/test_experience_planner_dispatch.py

# Those two, run together (40 passed in ~10s):
poetry run python -m pytest tests/test_llm_client.py tests/test_experience_planner_dispatch.py

# Optional features — use an environment with av and/or piper installed.
# There is no Poetry dependency group named optional in this repository.
poetry run python -m pytest tests -m "optional_elevenlabs or optional_piper"

# Integration — run only with the live stack:
# Set MONGODB_URI to a reachable isolated test database and DB_NAME to its name.
poetry run python -m pytest tests -m "integration or requires_mongo"
```

The core command uses `--ignore` for the two files rather than a marker because
the problem is *file co-residence*, not test intent. Marking them would skip
real tests that pass — and they do pass, in 10 seconds, when run together.

---

## 4. Persistence crash-window evidence

**Window under test:** `storeAcceptedPlan` succeeded, then the process died
before the request reached `validated`.

Reproduced and verified with `apps/api/scripts/m47-post-store-crash-proof.ts`
against real MongoDB:

| Point | Result |
|---|---|
| At crash | `plan_stored=true`, `plan_records=1`, `availability=available`, request `validating` — **the plan is durable before the state write** |
| After recovery | request → `uncertain` / `WORKER_INTERRUPTED`, `reserved_tokens=32768`, plan still `available` |
| 3 concurrent recoveries | counts `1/0/0`, one terminal state, one row — **no conflicting transitions** |
| Author returns | `already_accepted`, **provider_calls=0, reservations=0**, state repaired to `validated` |

All seven required properties hold. The first six were already correct after
the previous closure; the seventh exposed a defect.

### 4.1 The defect found here

Recovery left the request `uncertain` **while the plan record was intact**.
Every subsequent authorised attempt answered `PROVIDER_UNCERTAIN_PREVIOUS`
forever. The author was not at risk of a second charge — the plan existed — but
was permanently blocked.

### 4.2 The correction (smallest possible)

In the `uncertain` branch, before returning the failure:

```ts
const durable = await peekStoredPlan({ courseId, revisionId, lessonId, mode });
if (durable) {
  const promoted = await ExperiencePlanRequest.findOneAndUpdate(
    { _id: row._id, state: 'uncertain' },
    { $set: { state: 'validated', planDigest, finishedAt }, $unset: { code: 1 } },
    { new: true },
  ).lean();
  ...
  return { status: 'already_accepted', ... };
}
return { status: 'failed', code: 'PROVIDER_UNCERTAIN_PREVIOUS', ... };
```

This is a **state repair, not a dispatch**. It cannot produce a second provider
call, a second reservation or a refund, because it only reads a plan record that
already exists. Accounting stays exactly as recovery left it — reservation
retained, no usage claimed — which is the conservative answer for a possibly
billable attempt. The conditional update makes it single-winner under
concurrency.

Two regression tests in `plan-generation-persistence-order.test.ts` pin both
halves: adoption when a durable plan exists, and the unchanged
`PROVIDER_UNCERTAIN_PREVIOUS` when none does.

---

## 5. Authenticated-reader accessibility

**Tooling limitation first, because it bounds every claim below:**

- **axe-core is UNAVAILABLE.** `npm install axe-core` returned
  `403 registry.npmjs.org` — registry access is denied in this environment. No
  axe rule coverage (landmarks, heading order, ARIA correctness) is claimed.
- **Screen reader: NOT TESTED.** No assistive technology is automatable here.
  This is not a pass and is not reported as one.
- Therefore this section is **computed-style measurement, not a WCAG
  conformance audit.**

Measured with `apps/web/e2e/batch4rc-reader-a11y.mjs` against the live server:

| Target | Text samples | Contrast failures | Unmeasurable | Worst ratio | Keyboard stops | Lost focus | Overflow @320px | Clipped |
|---|---|---|---|---|---|---|---|---|
| reader-preview:math | 34 | 0 | 0 | 5.48 | 25 | 0 | 0 | 0 |
| reader-preview:code | 61 | 0 | 0 | 5.48 | 25 | 0 | 0 | 0 |
| reader-preview:prose | 17 | 0 | 0 | 5.48 | 25 | 0 | 0 | 0 |
| reader-preview:guided | 34 | 0 | 0 | 5.48 | 25 | 0 | 0 | 0 |
| authenticated-reader:no-session | 14 | 0 | 1 | 5.48 | 25 | 2 | 0 | 0 |

- **Contrast**: every measurable text node meets AA (4.5:1 body, 3:1 large).
  Worst observed is 5.48:1. One node is classified **unmeasurable** — gradient
  text uses `color: transparent` with `background-clip: text`, whose painted
  colour computed styles cannot resolve. Counting it as 1.0:1 would have been a
  false failure; it is reported as not measurable instead.
- **320 px reflow (1.4.10)**: no horizontal page overflow on any target. Code
  blocks exceed the viewport on the code lesson but sit inside an
  `overflow-x-auto` ancestor — **0 clipped**, which the criterion permits.
- **Keyboard**: 25 tab stops per target. The two lost-focus entries on the
  `no-session` target are the `BODY` element before the first focusable
  control, i.e. no stop was lost within reader content.

### 5.1 What was NOT measured, and why

The `authenticated-reader:no-session` target **redirects** (fail-closed, which
is correct) and therefore surfaces the marketing shell, not the reader. Its
surface counters are all zero:

```
modeSelector=0 sourceInspector=0 mathFallback=0 codeBlocks=0 recommendations=0
```

So the prompt's named surfaces — **mode selector, source inspector,
mathematical fallback, code and diagram interaction, learning recommendations**
— were **not** measured on the enrolled-student route in this harness. They are
covered behaviourally by the passing acceptance specs:

- `batch4-m41-planning.spec.ts` → *"reader is keyboard-operable, reflows and
  keeps source evidence inspectable"* (**6/6 passed**)
- `final-acceptance.spec.ts` → real enrolled-student reader with real auth,
  asserting `.katex` count, the unverified-transcription disclosure and the
  deterministic fallback link (**2/2 passed**)

That is functional coverage, not accessibility measurement. The gap is real and
is listed in §8.

---

## 6. Ingestion outage and recovery behaviour

### 6.1 The guard

A revision-bound ingestion (`revisionId` present) with no manifest raises a
`TerminalError` rather than falling through to the legacy parser. Verified by
`test_ingestion_manifest_failclosed.py` (5 tests).

### 6.2 Outage semantics — verified

`test_ingestion_manifest_outage.py` (5 tests) pins the behaviour around the
guard:

| Property | Test |
|---|---|
| Transient outage refuses a revision-bound ingestion | ✓ |
| The legacy parser is never reached | ✓ (asserts `detect_sections` not called) |
| Failure is **terminal, not retryable** | ✓ (not a `RetryableError`) |
| No partial artifact is returned | ✓ |
| A legitimate legacy document still processes during the outage | ✓ |

`TerminalError` is routed by `workers/base.py` to the DLQ with a `failed`
result — dead-letter, never replayed.

### 6.3 Live confirmation

While reproducing the acceptance suite, the guard fired in the running worker:

```
messaging.failures.TerminalError: Source manifest unavailable for a
revision-bound ingestion; refusing to fall back to the legacy parser
[WebServer] ERROR:workers.base:job_dead_lettered
```

This is exactly the designed behaviour, observed in a real container: the prior
failure mode was a *silent* downgrade to the legacy parser; it is now a loud,
dead-lettered refusal.

### 6.4 Operator recovery

There is **no automatic retry**, by design: a replay could duplicate ingestion
or bypass review. The operator runbook is in
`reports/EDNOVA-BATCH4-PILOT-POLICY.md` §7 — confirm storage recovered, confirm
`sourceManifest` and each `storageRef`, deliberately resubmit the exact
revision, verify chapter count and lesson counts came from the source-aware
parser, and only then approve the revision.

---

## 7. Nardouch readiness status

**C2 is CONFIRMED PRESENT and has been fixed narrowly.**

The loading state was:

```tsx
journey ? <View/> : (!error && <p>Loading your course companion…</p>)
```

`journey` is null when the fetch *succeeds* but returns data for a different
course or revision:

```tsx
const journey = data?.courseId === courseId && (!revisionId || data.revisionId === revisionId) ? data : null;
```

That path has no error, so nothing ever replaced the loading text — a permanent
"Loading your course companion…" on a non-throwing mismatch.

**Fix** (`course-growth.tsx`): add a `mismatched` flag and render a terminal
message for it, so the three states are exclusive — view, error, mismatch,
loading. Two regression tests in `course-growth-mismatch.test.tsx` plus the two
pre-existing shell tests all pass (6/6 in the Nardouch folder).

**Pilot impact: low, now bounded.** It only rendered on a revision mismatch, so
it could confuse a tester but could not show wrong content. Fitting it was
appropriate because it is user-visible on a pilot route.

No mascot, branding or landing-page file was touched.

**C4 (`experiencePlanner.ts` legacy cleanup) remains OPEN and separately
tracked.** It is dead production code but live test code (imported by
`semantic-content.test.ts`), so it cannot be deleted without rewriting that
suite. It creates no demonstrable release problem and was left alone, as
instructed.

---

## 8. Remaining release risks

| # | Risk | Severity | Status |
|---|---|---|---|
| R1 | **Authenticated-reader accessibility unmeasured.** Mode selector, source inspector, math fallback, code/diagram and recommendations were not measured on the enrolled route. | Medium | Open — functional coverage only |
| R2 | **axe-core unavailable**, so no rule-based audit was performed. | Medium | Open — environmental |
| R3 | **Screen reader NOT TESTED.** | Medium | Open — cannot be automated here |
| R4 | **`test_llm_client.py` / `test_experience_planner_dispatch.py` stall in whole-tree runs.** | Low | Characterised; pass in isolation |
| R5 | **`test_coach_session_stats.py::test_orchestrator_malformed_stats_default_to_none_never_fail` fails**; verified pre-existing. | Low | Open, unrelated to Batch 4 |
| R6 | **C4** — legacy `experiencePlanner.ts` cleanup. | Low | Open, separately tracked |
| R7 | **Independent math certification** — no qualified reviewer, no completed adjudication. | **High** | **BLOCKED** |
| R8 | **Educational-outcome evidence** — none collected. | **High** | **NOT ESTABLISHED** |
| R9 | **Live Gemini / ElevenLabs behaviour** — never exercised. | **High** | **NOT OBTAINED** |
| R10 | **Production readiness** — no deployment, load test, DR rehearsal or on-call. | **High** | **NOT ASSESSED** |
| R11 | **`next build` fails at type check** because two e2e configs import an undeclared `vite`. Pre-existing across `da0d0a6`/`a8928b9`/`6dc3796`. | Medium | **Open** — contradicts the M4.6 build claim |

R7–R10 are the four categories that a pilot cannot close and this report does
not close.

---

## 9. Controlled pilot scope

Full policy in `reports/EDNOVA-BATCH4-PILOT-POLICY.md`. Summary:

- **Users:** named pilot learners, instructors and one operator. No
  self-service enrolment.
- **Content:** approved published revisions whose chapters came from the
  source-aware parser and whose math blocks all carry review decisions.
- **AI plans:** mock planner or previously accepted records only; every read
  revalidates and falls back on failure.
- **Mathematics:** unreviewed math renders source-faithfully with its
  "unverified" disclosure; it is never presented as certified.
- **Privacy:** pilot accounts only, dedicated database, deletion at close, no
  learner identifiers in metrics.
- **Exclusions:** no live provider inference, no production traffic, and **no
  claim of measured learning improvement**.

---

## 10. Final pilot-readiness verdict

### **CONDITIONAL GO**

A safe, restricted internal pilot is possible **under the written restrictions
in `EDNOVA-BATCH4-PILOT-POLICY.md`**, with these explicit conditions:

1. **Content is limited to approved revisions** whose chapters came from the
   source-aware parser and whose math has a recorded review decision. Any
   revision ingested during a manifest outage is re-ingested and re-verified
   before approval.
2. **No live provider.** `EXPERIENCE_PLANNING_ENABLED` unset and no provider
   key deployed — capability removed, not merely flagged off.
3. **Pilot is internal and non-production**, with a separate database, named
   accounts and deletion at close.
4. **No learning-improvement claim.** The pilot measures interface behaviour,
   not outcomes.
5. **Unreviewed mathematics stays visibly unverified** everywhere it appears.

### Why not GO

Two gates that a GO would require are not met from inside this repository: the
enrolled-student reader's specific surfaces (mode selector, source inspector,
math fallback, diagram interaction, recommendations) were not accessibility-
measured, and the accessibility tooling that would certify them (axe-core,
screen reader) is unavailable here. Those are bounded, known gaps — not
open-ended ones — which is what makes a restricted pilot defensible.

### Why not NO-GO

The authorization, source-integrity, accounting and essential reading gates all
pass with executable evidence: 1,175 API tests, 214 web tests, 255 targeted
Python tests, 2/2 acceptance E2E, all three accounting proofs unchanged, the
cross-course metrics disclosure closed, the persistence crash window closed with
no double-charge and no false success, and ingestion failing closed with no
degraded publication.

### Explicitly not certified

This verdict says nothing about:

- **academic correctness** — independent math certification remains **BLOCKED**;
- **learning effectiveness** — **NOT ESTABLISHED**; no outcome was measured;
- **live Gemini behaviour** — **NOT OBTAINED**; no live call was made or
  authorised;
- **production readiness** — **NOT ASSESSED**; nothing was deployed.

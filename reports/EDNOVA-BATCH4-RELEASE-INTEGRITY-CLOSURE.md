# EdNova Batch 4 — Release-Integrity Closure

**Date:** 2026-11-07
**Baseline commit:** `6dc3796` (C1 correction)
**Scope:** three narrowly scoped release-integrity concerns, plus the accounting,
accessibility and remaining-risk re-verification asked for in this round.
**No live provider was called. Nothing was deployed.**

---

## 1. Verdict

### Technical release integrity — **CONDITIONAL GO**

All three concerns were real. All three are now closed with executable
evidence, and the two that were reachable by a user (cross-course metrics
disclosure, and a request claiming a validated plan that does not exist) are
covered by regression tests.

The condition is not implementation. It is that this closure verified the
categories it can verify from inside this repository:

| Category | Status | Why |
|---|---|---|
| Technical correctness | **GO** | 1173 API tests, 214 web tests, 245 targeted Python tests, 2 browser acceptance runs |
| Cross-course authorization | **GO** (closed this round) | metrics route removed from course scope; 5 regression tests |
| Durable-state honesty | **GO** (closed this round) | persistence reordered; 4 regression tests |
| Fail-closed ingestion | **GO** (closed this round) | manifest guard added; 5 regression tests |
| Accounting invariants | **GO** (re-measured) | M4.3, M4.5, M4.6 proofs all pass unchanged |
| Reader accessibility | **PARTIAL** | contrast, reflow, keyboard measured; **screen reader NOT TESTED** |
| Independent math certification | **BLOCKED** | unchanged from M4.6 — no reviewer exists here |
| Educational-effectiveness evidence | **NOT ESTABLISHED** | unchanged — no outcome data was collected |
| Live-provider certification | **NOT OBTAINED** | unchanged — no live Gemini call was authorised |
| Production readiness | **NOT ASSESSED** | unchanged — no deployment was performed |

`CONDITIONAL GO` applies to the technical release gate only. The four
carried-forward items above remain exactly as open as they were at M4.6 and this
report does not close any of them.

---

## 2. Concern 1 — Manifest-path failover safety

### What was suspected

That modern, source-backed ingestion could silently fall back to the legacy
parser when the manifest or database is unavailable, producing a weaker but
still publishable artifact.

### What was found — **CONFIRMED**

The branch decision was:

```python
db = getattr(self.vector_store, "_db", None)
if db is not None and request.revisionId:
    ...build revision_manifest...
if manifest:
    all_sections = detect_sections_with_sources(zip(chunks, metas))   # chapters + regions
else:
    all_sections.extend(detect_sections(text))                        # no chapters, no regions
```

The `TerminalError("Exact immutable source revision unavailable")` guard sits
*inside* the `db is not None` branch. So when the database was unavailable the
condition was false, `manifest` stayed `None`, and a request carrying a
`revisionId` — a modern, source-backed revision — took the `else` branch
without any warning.

`detect_sections` contains **0** occurrences of `chapter`: it structurally
cannot produce chapter identity. The degraded artifact therefore lost:

- chapter identity (chapters and lesson grouping),
- source-region provenance (no `regions`, no spans),
- extraction review state and formula review state (both keyed off regions),
- the canonical checksum's meaningful inputs.

It did **not** lose publication eligibility. That is the defect: a silently
weaker artifact remained publishable.

This is the same mechanism the C1 investigation identified from the other
direction — a QA harness that could not resolve its Mongo host took this exact
branch, and the symptom was `ingest_parse_path=legacy` for a revision that
required the manifest.

### Correction

Fail closed for revision-bound ingestion only. Genuinely legacy documents —
those arriving without a `revisionId` — keep working unchanged.

```python
if request.revisionId and not manifest:
    raise TerminalError(
        "Source manifest unavailable for a revision-bound ingestion; "
        "refusing to fall back to the legacy parser"
    )
```

`TerminalError` is the existing non-retryable failure class, which is the
correct classification: a missing manifest is a deployment or storage fault, and
retrying would re-run the same degraded path once storage recovered.

### Tests

`apps/ai/tests/test_ingestion_manifest_failclosed.py` — **5 passed**

| Test | Distinguishes |
|---|---|
| refuses when the manifest is missing | modern request, no manifest → refused |
| does not fall back to the legacy parser | asserts `detect_sections` was never called |
| refusal is terminal, not retryable | no automatic retry of a degraded path |
| a document without a revision uses the legacy parser | **legacy compatibility preserved** |
| a revision-bound request with a manifest uses the source parser | modern happy path unchanged |

The fourth and fifth tests are the pair that matters: they prove the guard
separates *authorised legacy documents* from *unexpected modern degradation*,
rather than disabling legacy support.

---

## 3. Concern 2 — Process-global metrics disclosure

### What was suspected

That a user managing Course A could observe process-global planning activity
generated by Course B.

### What was found — **CONFIRMED**

`planningMetrics.ts` contains **0** occurrences of `courseId`. Its counters are
module-level `let counters = new Map()`, process-wide by construction.

The route returned them at:

```
GET /courses/:courseId/planning/metrics     guarded by canManageCourse(courseId)
```

and described them as `scope: 'process'`. The label was honest — the
authorization was not. A `scope` label is a description of the payload; it
cannot authorize it. Any single course author received one shared aggregate.

Reproduced against real MongoDB as
`course_a_endpoint_sees_course_b_activity: true`.

### Choice made

Two options were available: an operator-only endpoint, or genuinely
course-scoped aggregation. I chose **operator-only**, for a reason grounded in
the data rather than convenience: the counters carry no course dimension. Real
per-course aggregation would mean adding a `courseId` label to every counter,
which converts an operational health signal into a per-course activity feed —
a new disclosure surface, and one that would need its own retention and access
design. The endpoint exists to answer "is the planning path healthy", which is
an operator question.

### Correction

```
GET /planning/metrics     requireRole('admin')
```

Scope is removed from the path because there is no scope to address.
`requireRole` is the canonical mechanism from `shared/auth.ts`, whose own
comment forbids callers re-implementing role checks. The generated Nest module
was regenerated so the contract layer and the runtime agree.

### Tests

`apps/api/modules/study/src/tests/metrics-authorization.test.ts` — **5 passed**

- no metrics operation exists under any `:courseId` path;
- a Course-A author is refused (403) and receives no counters;
- a Course-B author is refused identically;
- an unauthenticated caller is refused (401);
- an admin is served, and the payload's *data* (counters, latency) contains no
  course or learner identifier.

Two independent courses and two distinct authors are exercised; the refusal is
identical for both, which is the property the concern asked for.

---

## 4. Concern 3 — Validation-to-persistence crash window

### What was suspected

That the system could retain `request.state = 'validated'` with no
corresponding accepted-plan record.

### What was found — **CONFIRMED**

The ordering was:

```ts
await ExperiencePlanRequest.updateOne(... { state: 'validated' } ...);   // first
const stored = await storeAcceptedPlan({ ... });                        // second
```

A process that died between the two writes left a request claiming a usable
plan with no plan record. Reproduced against real MongoDB:
`state='validated', plan_records=0, availability='unavailable'`.

The failure branch made it worse: a store failure wrote
`state: 'validated', code: 'PLAN_NOT_STORED'` — still `validated`.

### Correction

Persistence is now ordered before the state transition, and a store failure is
recorded as `failed`:

```ts
const stored = await storeAcceptedPlan({ ... });
if (!stored.stored) {
  await ExperiencePlanRequest.updateOne(... { state: 'failed', code: 'PLAN_NOT_STORED' } ...);
  return { status: 'failed', code: 'PLAN_NOT_STORED', requestId, uncertain: false };
}
await ExperiencePlanRequest.updateOne(... { state: 'validated' } ...);
```

`validated` now means "a validated plan exists and is retrievable", not
"validation returned an object".

### The five required properties

| Property | How it holds |
|---|---|
| No false indication a usable plan exists | `validated` is written only after the record exists |
| No permanent unresolvable in-flight state | a crash now leaves `validating`; recovery moves it to `uncertain` |
| No silent second provider dispatch | `validating`/`dispatched` are recovered as `uncertain`, never replayed |
| No duplicate reservation or refund | unchanged atomic claim + idempotent `releaseMarkers` (re-measured below) |
| Conservative accounting for possibly-billed attempts | `uncertain` retains the reservation; no automatic refund |

### Tests

`apps/api/modules/study/src/tests/plan-generation-persistence-order.test.ts` —
**4 passed**, including an `invocationCallOrder` assertion that the store call
precedes the `validated` write, and that a store failure yields `failed` and
never writes `validated`.

Closure proof: `apps/api/scripts/m46b-release-integrity-proof.ts` now asserts
invariants rather than constructing broken state. It reports:

```
C-2 course-scoped metrics route        → CLOSED: metrics are operator-only
C-3 interrupted attempt after recovery → CLOSED: uncertain, WORKER_INTERRUPTED, unavailable
ALL 2 INVARIANTS HOLD
```

**A note on the first version of that script.** It wrote the broken row by hand
and re-reported "CONFIRMED" after the fix — because any string can be written to
a document. Constructing a failure state proves the failure is *expressible*,
not that the code still produces it. The rewritten script drives the corrected
code and checks the invariant; that is why it can report closure.

---

## 5. Accounting invariants — re-measured

All three historical proofs were re-run against the fixed tree and pass
unchanged. None of them was relaxed.

| Proof | Command | Result |
|---|---|---|
| M4.3 ten-scenario budget | `scripts/m43-budget-proof.ts` | **ALL SCENARIOS MATCH** |
| M4.5 cross-process concurrency | `scripts/m45-concurrency-proof.ts` | **2/2 PASS** (5 processes → 1 reservation, 4 suppressed, 32 768 tokens) |
| M4.6 recovery / refund | `scripts/m46-recovery-proof.ts` | reservation-before-dispatch refunded 32 768; retry re-reserved once; no double charge |

The persistence reordering in concern 3 does not alter reservation or
reconciliation: the reserve → dispatch → reconcile sequence is untouched, and
the M4.6 proof re-confirms the refund path still fires exactly once.

---

## 6. Accessibility re-verification

Measured against the real reader at `reader-preview`, three lesson types
(math, engineering-with-code, prose), via
`apps/web/e2e/batch4b-reader-a11y.mjs`.

| Scenario | Text samples | Contrast failures | Worst ratio | Small targets | Keyboard stops | Focus lost | Overflow at 320px | Clipped |
|---|---|---|---|---|---|---|---|---|
| math-read | 32 | 0 | 5.48 | 0 | 25 | 0 | 0 | 0 |
| engineering-read | 60 | 0 | 5.48 | 0 | 25 | 0 | 0 | 0 |
| prose | 17 | 0 | 5.48 | 0 | 25 | 0 | 0 | 0 |

- **Contrast**: every measured text node meets its WCAG AA threshold
  (4.5:1 body, 3:1 large). Worst observed is 5.48:1.
- **200% reflow (1.4.10)**: no horizontal page overflow at 320 CSS px.
  `engineering-read` has 18 elements wider than the viewport; all 18 are inside
  an `overflow-x-auto` ancestor, and **0 are clipped**. Contained scrolling for
  code is permitted by the criterion.
- **Keyboard**: 25 tab stops per scenario, **0** without a visible focus
  indicator.
- **Reduced motion**: no infinite animations under `prefers-reduced-motion`.
- **Screen reader**: **NOT TESTED.** No screen reader could be automated in
  this environment. This is not a pass and is not reported as one.

**Not covered**: this is computed-style measurement, not a WCAG conformance
audit. `axe-core` could not be installed (no registry access), so structural
rules such as landmark completeness, heading order and ARIA correctness were
not machine-checked.

---

## 7. Regression ledger

| Suite | Result |
|---|---|
| API (`modules src shared`) | **81 suites, 1173 tests passed** |
| Web unit (`vitest`) | **32 files, 214 tests passed** |
| Python — targeted (authoritative) | **245 passed** |
| Python — whole tree | 1106 passed, 21 failed (all pre-existing/environmental), 3 skipped — see §7.1 |
| Browser acceptance (`qa-run-final.sh`) | **2 passed, PLAYWRIGHT_EXIT=0** |
| New regression tests | 14 (5 Python, 5 metrics, 4 persistence) |
| TypeScript (`tsc --noEmit`, API and web) | **0 errors each** |

The two original Batch 3 extraction assertions remain in place and unmodified:

```ts
expect(chapters).toHaveLength(2);
expect(chapters.flatMap((c) => c.lessons)).toHaveLength(16);
```

### 7.1 Python suite status

Run under the AI image, which ships without `pytest` (a dev dependency), so
`pytest` is installed ephemerally per run.

**Targeted run (authoritative for this round): 245 passed.**

```
tests/test_ingestion_manifest_failclosed.py
tests/test_base_worker.py
tests/test_topology_parity.py
tests/test_ednova_contracts.py
tests/test_experience_planner_dispatch.py
```

This covers every suite this round's Python edit could affect — the ingestion
worker, the worker base it inherits, and the contract/topology parity checks
that would catch a payload-shape regression.

**Whole-tree run: `21 failed, 1106 passed, 3 skipped` in 329.91 s.**

Every one of the 21 failures is an environment dependency, verified by cause:

| Count | Cause | Files |
|---|---|---|
| 13 | `ModuleNotFoundError: No module named 'av'` | `test_nardouch_elevenlabs.py` |
| 1 | `ModuleNotFoundError: No module named 'piper'` | `test_nardouch_piper.py` |
| 4 | `test_coach_course_context.py` — same optional-dependency family | coach orchestrator |
| 2 | `tests/integration/test_signal_pipeline.py` — needs a live service | integration |
| 1 | `test_coach_session_stats.py` — **verified pre-existing** (fails identically with this round's changes stashed) | coach orchestrator |

None of these files is touched by this round's edits.

Two harness notes, recorded because they changed the numbers between runs and
the difference matters:

- `pytest tests` needs the **repository root** mounted, not just `apps/ai`.
  `tests/test_topology_parity.py` resolves `docs/contracts/topology-fixture.json`
  via `.parents[3]`; with only `/app` mounted it raises `IndexError: 3` at
  collection for four files. With `$PWD:/work` those four pass 4/4. This is a
  mount artifact, not a defect.
- A whole-tree run under `agents` + `services` can stall once it reaches
  `test_experience_planner_dispatch.py`; the file itself passes 20/20 in
  isolation in 1.92 s. Reported as a harness interaction, not a test failure.

The 21 failures are therefore **pre-existing and environmental**, not
regressions, but the suite is not claimed green.

---

## 8. Carried forward — unchanged, not closed

Each of these was open at M4.6 and remains open. No progress is claimed.

| Item | State | Note |
|---|---|---|
| **C2** | open | unchanged this round |
| **C4** — `experiencePlanner.ts` dead-code question | open | still imported by `semantic-content.test.ts`; the M4.5 "dead code" claim was wrong and was corrected at M4.6 |
| **Independent math certification** | **BLOCKED** | no qualified independent reviewer and no completed 16-case adjudication exists here. Automated structural checks confirm provenance and fidelity; they cannot confirm mathematical correctness. |
| **Educational-outcome evaluation** | **NOT ESTABLISHED** | no comprehension, retention or grade outcome was measured. Five modes producing distinct arrangements is not evidence of learning benefit. |
| **Live Gemini certification** | **NOT OBTAINED** | every provider-facing test in this round used mocked responses. No live call was made or authorised. |
| **Production operations** | **NOT ASSESSED** | no deployment, no load test against real traffic, no on-call or rollback rehearsal. |

---

## 9. Files changed

| File | Change |
|---|---|
| `apps/ai/workers/ingestion_worker.py` | +19 — fail closed on missing manifest for revision-bound requests |
| `apps/api/modules/study/src/services/experiencePlanGeneration.ts` | +57/−20 — persist before `validated`; store failure → `failed` |
| `apps/api/modules/study/src/routes/learning.ts` | +26/−14 — metrics route moved to `/planning/metrics`, `requireRole('admin')` |
| `apps/api/src/framework/domains/study.module.ts` | regenerated contract module |

New tests:

- `apps/ai/tests/test_ingestion_manifest_failclosed.py`
- `apps/api/modules/study/src/tests/metrics-authorization.test.ts`
- `apps/api/modules/study/src/tests/plan-generation-persistence-order.test.ts`

New evidence:

- `apps/api/scripts/m46b-release-integrity-proof.ts` (rewritten to assert closure)
- `apps/web/e2e/batch4b-reader-a11y.mjs`
- `reports/evidence/batch4b/reader-accessibility.json`

No unrelated Nardouch or landing-page work was modified.

---

## 10. What this report does not claim

- It does not claim the system is secure in general; it claims three specific
  disclosure and consistency defects are closed.
- It does not claim WCAG conformance. Screen-reader behaviour was not tested and
  no conformance audit was run.
- It does not claim the Python suite is fully green. §7.1 states exactly what
  was covered and what was not.
- It does not claim any provider behaviour, model quality, or educational
  benefit. None was measured.
- `CONDITIONAL GO` is the technical gate only. The four carried-forward
  categories in §8 are the conditions that remain outside this repository's
  ability to verify.

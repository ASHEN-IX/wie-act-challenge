# EdNova Batch 4 — M4.1 Acceptance

**Milestone:** 4.1 — AI Experience Plan Contract, Validation Engine & Governance
**Date:** 2026-11-06
**Scope completed:** M4.1 only. M4.2 not started.

---

## 1. Verdict

# CONDITIONAL GO

The implemented slice is sound: the contract, the independent validator, the
mock planner, the planning workflow, the reader integration and the security
suite all pass, and the browser evidence shows a validated mock plan rendering
through the real Batch 3 registry while hostile proposals fall back safely.

The "conditional" is carried by two **bounded, non-critical** items:

1. **Review governance is bounded** by the current persistence schema. A review
   claim is verified for internal consistency and correct binding, not against
   an independent approval record. No shortcut marks a generated proposal as
   reviewed, and unreviewed generated assets stay learner-invisible, but a full
   approval workflow is deferred (as the brief allows).
2. **The Batch 3 acceptance harness does not pass in this environment**, for
   reasons unrelated to M4.1 and reproduced without any M4.1 change (see §6).

Neither is a security, source-integrity, authorization or renderer failure.

---

## 2. Gate ledger

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | `LearningExperiencePlanV1` implemented and versioned | **PASS** | `experiencePlan.ts`, `EXPERIENCE_PLAN_SCHEMA_VERSION = '1.0.0'` |
| 2 | Untrusted proposals separated from validated plans | **PASS** | private-symbol brand; `cannot be forged by setting validated:true in JSON` |
| 3 | Batch 3 component capabilities reused | **PASS** | validator imports `COMPONENT_CAPABILITIES`; no second list |
| 4 | Canonical block coverage preserved | **PASS** | positional coverage; missing/duplicate/reordered/cross-lesson tests |
| 5 | Source identities verified against trusted published data | **PASS** | identity stage + `getPublishedPresentation` boundary |
| 6 | Review claims cannot be forged by planner output | **PASS (bounded)** | `verifyAssetBindings`; see §7 risk R1 |
| 7 | Unreviewed generated assets learner-invisible | **PASS** | `PLAN_ASSET_GENERATED_PROPOSAL`; service test with real rows |
| 8 | Unsupported components and unsafe props rejected | **PASS** | component + schema stages; 16 attack scenarios |
| 9 | Valid mock plan renders through the real registry | **PASS** | browser test, screenshot `02-validated-plan.png` |
| 10 | Failed mock plan safely falls back | **PASS** | browser test, screenshot `03-rejected-plan-fallback.png` |
| 11 | Canonical revisions unchanged | **PASS** | no write path touches `course_revisions` content |
| 12 | Historical source references remain compatible | **PASS** | asset contract unchanged; Batch 3 asset tests still green |
| 13 | Real authorization controls in force | **PASS** | browser outsider assertion; boundary reused unchanged |
| 14 | Unit and integration tests pass | **PASS** | 85 M4.1 unit tests; see §4 |
| 15 | QA browser scenarios pass or are marked blocked with evidence | **PASS** | 2/2 browser tests; see §5 |
| 16 | No live AI calls | **PASS** | mock only; no provider SDK imported or invoked |
| 17 | No production deployment | **PASS** | local QA harness only |

---

## 3. Test-count reconciliation

The brief asked to verify the reported counts rather than repeat them.

| Suite | Reported | Measured | Note |
|---|---|---|---|
| API unit | 338 | **338** | exact match |
| Web unit | 194 | **195** | +1 from unrelated `nardouch` test |
| Integration | 19 | **19** | matches with MongoDB/RabbitMQ up |
| **Total** | **551** | **552** | |

The report's figures were correct when written; the tree later gained one
unrelated web test. **Neither number was invented, and no missing result was
fabricated.**

---

## 4. Automated test ledger

### New M4.1 unit tests — 85, all passing

| Suite | Tests | Covers |
|---|---|---|
| `experience-plan.test.ts` | 58 | contract, identity, coverage, capability, assets, limits, all 21 mock scenarios, determinism |
| `experience-planning.test.ts` | 18 | planning workflow, QA flag, asset verification, projection, fallback |
| `published-experience-plan.test.ts` | 9 | browser-boundary parser |

Run:
```
PASS modules/study/src/tests/experience-plan.test.ts
PASS modules/study/src/tests/experience-planning.test.ts
PASS modules/study/src/tests/published-experience-plan.test.ts
Tests: 85 passed, 85 total
```

### Web — 205 passed / 31 files

Baseline was 195/30. The 10 added tests live in
`lesson-reader.test.tsx` under `validated experience plan integration (M4.1)`:
provenance label, plan-honoured component, coverage under a plan, and ignoring
a plan bound to another revision / lesson / course, plus the no-plan baseline.

### API — 1017 passed / 1037

`npx jest --runInBand` → **1017 passed, 20 failed, 79 suites (4 failed)**.

The 20 failures are **pre-existing and unrelated**:

| Suite | Why it fails |
|---|---|
| `tests/integration/gateway.integration.test.ts` | needs the full gateway stack on its own ports |
| `tests/integration/ai-jobs.integration.test.ts` | needs the AI service + broker |
| `tests/integration/bloom-loop.integration.test.ts` | needs the AI service |
| `tests/shared/duplicate-bugs.test.ts` | asserts badge PNGs the Noveris rebrand removed |

None imports or exercises M4.1 code. The study module — which contains all
M4.1 code — is **36/36 suites, 454/454 tests** with MongoDB and RabbitMQ up.

---

## 5. Real browser evidence

Command (through the established QA path, with the QA-only network flag):

```
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm exec playwright test --config playwright.m41.config.ts
```

Result: **2 passed (21.1 s)**.

| Scenario | Result |
|---|---|
| Enrolled student opens the published lesson | pass |
| Deterministic reader works with no plan | pass (`01-deterministic-reader.png`) |
| Valid mock plan renders trusted components | pass (`02-validated-plan.png`) |
| Plan provenance inspectable | pass (`data-experience-plan`, `-planner`, `-digest`) |
| Source evidence still reachable | pass |
| Unreviewed mathematics stays source-faithful | pass |
| Invalid plan falls back | pass (`03-rejected-plan-fallback.png`) |
| Unauthorized student blocked | pass (403/404, no planner detail leaked) |
| Reader usable after planner failure | pass |
| Anonymous request rejected | pass (401) |

The server log from the same run is the security evidence in miniature:

```
[experience-plan] rejected PLAN_COVERAGE_BLOCK_MISSING   at coverage
[experience-plan] rejected PLAN_COVERAGE_BLOCK_UNKNOWN   at coverage
[experience-plan] rejected PLAN_COMPONENT_UNKNOWN        at component
[experience-plan] rejected PLAN_SCHEMA_UNSAFE_MARKUP     at schema
[experience-plan] rejected PLAN_COVERAGE_BLOCK_REORDERED at coverage
[experience-plan] rejected PLAN_COVERAGE_BLOCK_MISSING   at coverage
```

Each hostile scenario produced its own typed code, and the valid plan in the
same run was accepted.

### Fixture disclosure

The QA harness's own ingestion journey does not complete in this environment
(§6), so the M4.1 suite seeds its own published revision through
`apps/api/tests/m41-fixture.ts`. It writes the **same artifacts ingestion
writes** — a real source blob, a real index file, real hashes, a real manifest
digest, a real canonical checksum — and the application still verifies every
one before rendering. It is a fixture, not a bypass: when any hash was wrong,
the reader refused with its own integrity errors, which is how the fixture was
debugged. This is opt-in via `FINAL_QA_SEED_M41=true` and never runs in
production.

---

## 6. Compatibility and the Batch 3 harness

**The Batch 3 acceptance suite does not pass in this environment, with or
without M4.1.** Verified by stashing every M4.1 change and re-running
`scripts/qa-run-final.sh`:

| Run | Result |
|---|---|
| Batch 3 suite, M4.1 changes present | 2 failed |
| Batch 3 suite, M4.1 changes stashed | 2 failed |

Both failures are **content-extraction assertions**, not infrastructure:

1. `real reference upload … enrolled student reader` — expects 2 chapters from
   the reference PDF, receives 1.
2. `representative networking PDF …` — expects lesson titles
   `["1 Networking: reliable delivery", "2 Failure handling"]`, receives only
   the first.

An environment problem *was* found and fixed along the way: RabbitMQ publishes
on `127.0.0.1` only, so the QA AI container could not reach it through
`host.docker.internal`. `final-acceptance-server.ts` now accepts an opt-in
`FINAL_QA_DOCKER_NETWORK` that joins the project network for the broker while
keeping MongoDB on the host gateway. After that fix, ingestion runs to
completion (zero `AMQPConnectionError`) and the two content assertions above
are what remain.

That fix is a QA-harness change only. It does not weaken the loopback binding,
which is a deliberate security choice.

---

## 7. Performance

Measured with `apps/api/scripts/m41-perf.ts` (200 iterations each, no model, no
network, no database):

| Blocks | Context fingerprint | Schema parse | **Full validation** | Proposal size |
|---|---|---|---|---|
| 20 | 0.021 ms | 0.037 ms | **0.090 ms** (p95 0.123) | 4 963 B |
| 100 | 0.025 ms | 0.108 ms | **0.319 ms** (p95 0.385) | 22 701 B |
| 400 (canonical max) | 0.099 ms | 0.412 ms | **1.304 ms** (p95 1.416) | 89 801 B |

Worst-case malformed input:

| Case | 20 blocks | 400 blocks |
|---|---|---|
| missing block | 0.036 ms | 0.502 ms |
| oversized array | 0.431 ms | 0.460 ms |

Bounds are enforced, not advisory: 424 placements, 24 supplements, 8 groups,
8 interaction entries, depth 3, 256 KiB payload.

A defect this measurement exposed, and fixed: the original `maxPlacements: 120`
was **below** the canonical contract's own 400-block lesson bound, which would
have made a long but legitimate lesson permanently unplannable. It is now
derived from that bound plus supplement headroom.

---

## 8. Remaining risks

| # | Risk | Severity | Mitigation / status |
|---|---|---|---|
| R1 | Review verification proves consistency and binding, not an independent approval record | **Medium** | Deferred approval workflow; generated proposals remain invisible; no forgeable shortcut exists. Must close before learner-facing production use. |
| R2 | Batch 3 ingestion assertions fail in this environment | **Low** (unrelated) | Reproduced without M4.1; extraction/content issue |
| R3 | Mock planner proves the validation path, not model behaviour | **Low** (by design) | No model claims made; M4.2 owns provider integration |
| R4 | Planner context carries no source text, so a future provider cannot reason over content yet | **Low** (by design) | Deliberate: content-grounding design belongs to M4.2 |
| R5 | `experiencePlanner.ts` (older Batch 3 boundary) is now dead code | **Low** | Left untouched; removing it is a separate cleanup |
| R6 | M4.1 route is development/QA only | **None** | Double-gated: env flag + planner allowlist |

---

## 9. What this milestone does not claim

- No model quality, pedagogical accuracy or educational adaptation.
- No live provider behaviour.
- No production readiness of the review workflow.
- No completion of Batch 3's ingestion content assertions.

---

## 10. Files added or changed

**New contracts and engine (API, shared):**
- `apps/api/shared/ednova/experiencePlan.ts`
- `apps/api/shared/ednova/experiencePlanValidator.ts`
- `apps/api/shared/ednova/mockExperiencePlanner.ts`
- `apps/api/shared/ednova/publishedExperiencePlan.ts`

**New service and route (API, study):**
- `apps/api/modules/study/src/services/experiencePlanning.ts`
- `apps/api/modules/study/src/routes/learning.ts` (one route added)
- `apps/api/src/framework/domains/study.module.ts` (generated method added)

**Tests:**
- `apps/api/modules/study/src/tests/experience-plan.test.ts`
- `apps/api/modules/study/src/tests/experience-planning.test.ts`
- `apps/api/modules/study/src/tests/published-experience-plan.test.ts`
- `apps/api/scripts/m41-perf.ts`
- `apps/api/tests/m41-fixture.ts`
- `apps/web/e2e/batch4-m41-planning.spec.ts`
- `apps/web/playwright.m41.config.ts`

**Web integration:**
- `apps/web/src/features/reader/lesson-reader.tsx` (optional plan prop)
- `apps/web/src/features/reader/lesson-reader.test.tsx` (10 tests)
- `apps/web/src/features/learning/journey-actions.ts` (planner action)
- `apps/web/src/app/(workspace)/courses/[courseId]/present/page.tsx` (`?plan=`)

**QA harness:**
- `apps/api/tests/final-acceptance-server.ts` (opt-in seed + network flag)

**Unrelated workstream left untouched:** all `nardouch` files and their edits
to `learning.ts`, `lesson-reader.tsx`, `present.tsx`.

---

## 11. Next milestone

Milestone 4.2 is **not started**, as instructed. The seam it should use:
`ALLOWED_PLANNERS` in `experiencePlanning.ts` and
`planMockExperience` behind the same `MockPlannerResult` shape. Nothing else in
the contract needs to change to accept a real provider.

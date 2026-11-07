# EdNova Batch 4 — M4.5 Final Acceptance

**Milestone:** 4.5 — Experience Plan Caching, Operational Reliability, Quota
Safety & Observability
**Date:** 2026-11-07
**Scope completed:** M4.5 only. M4.6 not started.

---

## 1. Verdict

# CONDITIONAL GO

Every mandatory gate passes, including a **new cross-process proof that found and
fixed a real concurrency defect**. The conditions are bounded verification gaps,
not defects:

1. **No live provider behaviour observed.** All provider paths are stubbed, as
   required. Production provider certification remains a separate release gate.
2. **Load figures are local, single-process and bounded.** They are not capacity
   certification and do not model network latency.
3. **C1, C2 and C4 remain open** with their existing owners.

---

## 2. Git baseline

```
<this commit>  fix(m45): make plan claiming atomic across processes (+ docs)
436e3a4        docs(m44): adaptation, privacy and acceptance reports
1663412        feat(m44): evidence-based learner adaptation with explicit student control
```

Verified: HEAD was `436e3a4`; the reported M4.4 baseline (1,137 API · 214 web ·
5 browser · 20 Python) reproduced exactly before any change. Two path-scoped
commits added; **zero Nardouch files**. Three landing-page files remain dirty
from the unrelated workstream and were left alone. No history rewritten.

---

## 3. Gate ledger

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Validated plans reused without redispatch | **PASS** | `reuses a stored accepted plan…`, `already_accepted` |
| 2 | Cached plans revision-bound and revalidated | **PASS** | 12-property read path, unchanged |
| 3 | Asset review revocation invalidates plans | **PASS** | wired trigger + read-time refusal |
| 4 | Canonical and registry changes handled | **PASS** | stale checks, digest equality |
| 5 | Student data does not leak through shared plans | **PASS** | identity excludes learner data |
| 6 | Concurrent duplicates do not duplicate inference | **PASS** | cross-process proof 2/2 |
| 7 | One reservation per logical attempt | **PASS** | 5 processes → 1 reservation |
| 8 | Python cannot bypass the reservation check | **PASS** | zero ledger writes, asserted |
| 9 | Uncertain outcomes never auto-retried | **PASS** | sticky `uncertain`, recovery |
| 10 | Invalid or stale plans use safe fallback | **PASS** | 3-state availability + read validation |
| 11 | Authorization and integrity fail closed | **PASS** | unchanged boundaries |
| 12 | Recommendations do not advertise unusable plans | **PASS** | availability widened from `exists()` |
| 13 | Evidence resolved by authoritative semantics | **PASS** | 11 monotonic-precedence tests |
| 14 | Monitoring useful without private data | **PASS** | 14 metrics tests incl. privacy assertions |
| 15 | Bounded load testing reproducible | **PASS** | 3 levels, 0 errors |
| 16 | Real-service authenticated reader flows pass | **PASS** | browser 5/5 |
| 17 | Regressions pass | **PASS** | 1,163 API · 214 web · 20 Python |
| 18 | No live provider request | **PASS** | stubbed throughout |
| 19 | No production deployment | **PASS** | local QA harness only |

---

## 4. The defect this milestone found

The audit listed four suspects. The concurrency one was real and severe:

```
one logical attempt, five independent processes
before:  reserved=5  duplicates=0  charged=163,840 (expected 32,768)
after:   reserved=1  duplicates=4  charged= 32,768
```

The cause was check-then-act: each process read `state: 'requested'`, concluded
the attempt was its own, and reserved. The claim is now one conditional update,
so only one caller can move the row forward.

**This is the second accounting defect found only by running both halves
together** — M4.3's double debit was the first. Both were invisible to
single-process tests, and both are now covered by a proof that spawns real
processes rather than concurrent promises.

---

## 5. Test ledger

| Suite | Before | After |
|---|---|---|
| API unit | 1,137 / 77 | **1,163 / 79** |
| Web unit | 214 / 32 | **214 / 32** |
| Browser | 5 | **5** |
| Python | 20 | 20 |
| Cross-process proof | — | **2 / 2** |
| M4.3 budget proof | 10 / 10 | **10 / 10** |
| Typechecks | 0 / 0 | **0 / 0** |

New: 11 precedence tests, 14 metrics tests, 2 cross-process scenarios.
Two assertions replaced by design change, each asserting more than before.

### Commands

```bash
cd apps/api && npx jest modules src shared --runInBand
cd apps/web && npx vitest run --maxWorkers=2
cd apps/api && npx tsc -p tsconfig.check.json --noEmit
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m43-budget-proof.ts
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m45-concurrency-proof.ts
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m45-load-test.ts
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm --filter web exec playwright test --config playwright.m41.config.ts
```

---

## 6. Operational measurements

| Level | p50 | p95 | p99 | Errors | Event-loop lag |
|---|---|---|---|---|---|
| 1 concurrent | 0.76 ms | 1.21 ms | 10.8 ms | 0 | +0.34 ms |
| 10 concurrent | 3.45 ms | 7.01 ms | 13.3 ms | 0 | +0.24 ms |
| 25 concurrent | 7.37 ms | 12.6 ms | 25.9 ms | 0 | +0.25 ms |
| repeat hits | 2.15 ms | 4.78 ms | 6.08 ms | 0 | +0.18 ms |

Heap 45–61 MB, RSS 146–166 MB throughout. Zero errors at every level.

**These are local, single-process, bounded measurements.** Not production
capacity, not network-inclusive, and the AI service is not exercised.

---

## 7. What this milestone does not claim

- No live provider behaviour, cost, or quota behaviour has been observed.
- No educational effectiveness — unchanged from M4.4.
- Load results do not certify production capacity.
- C1 (Batch 3 extraction assertions), C2 (Nardouch loading state) and C4
  (unused legacy planner) remain open and untouched.

---

## 8. Remaining risks

| # | Risk | Severity | Owner |
|---|---|---|---|
| R1 | No live-provider certification | Medium | release gate |
| R2 | Load measured locally, single process | Low | ops |
| R3 | Recovery window (120 s) is a judgment call, not measured against real traffic | Low | ops |
| R4 | C1 / C2 / C4 | Low–Medium | their workstreams |

None blocks M4.6.

---

## 9. Files

**New**
- `apps/api/modules/study/src/services/planningMetrics.ts`
- `apps/api/modules/study/src/tests/adaptation-evidence-precedence.test.ts`
- `apps/api/modules/study/src/tests/planning-metrics.test.ts`
- `apps/api/scripts/m45-concurrency-proof.ts`
- `apps/api/scripts/m45-identity-worker.ts`
- `apps/api/scripts/m45-load-test.ts`

**Changed**
- `experiencePlanGeneration.ts` — atomic claim, working recovery, plan reuse
- `experiencePlanStore.ts` — 3-state availability, invalidation metric
- `learnerAdaptation.ts` — objective-scoped evidence read
- `structuredAssets.ts`, `assetReviewProvenance.ts`, `coursePublication.ts` — invalidation triggers
- `learning.ts`, `study.module.ts` — metrics route
- one existing test updated to the atomic-claim behaviour

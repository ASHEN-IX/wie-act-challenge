# EdNova Batch 4 — M4.6 Architecture and Traceability

**Purpose:** final technical acceptance for Batch 4. Trace every claim to the
artifact that owns it, and distinguish categories that are routinely conflated.

---

## 1. Source baseline

```
96d5475  fix(m46): refund reservations for provably pre-dispatch failures
da5599a  feat(m45): reuse an accepted plan on the provider planning path
faf24e1  docs(m45): cache, operations, security and acceptance evidence
38829f8  fix(m45): make plan claiming atomic across processes
```

HEAD was `da5599a` at audit start; the reported M4.5 baseline reproduced exactly
before any change. Three landing-page files remain dirty from the unrelated
workstream and were not touched. No history rewritten.

---

## 2. Reproduction of the reported baseline

| Reported | Reproduced |
|---|---|
| API 1,163 / 79 suites | **1,163 / 79** ✅ |
| Web 214 / 32 files | **214 / 32** ✅ |
| Browser 5 | **5** → **6** after adding accessibility evidence |
| Python 20 | 20 (untouched) |
| Cross-process 2 | **2 / 2** ✅ |
| M4.3 accounting 10 | **10 / 10** ✅ |
| Both typechecks | 0 errors each ✅ |

---

## 3. Acceptance matrix

Legend: **I** implemented · **U** unit tested · **X** integrated against real
services · **B** browser tested · **R** independently reviewed · **P** provider
verified · **O** production operationally tested.

| Capability | I | U | X | B | R | P | O |
|---|---|---|---|---|---|---|---|
| CanonicalDocumentV1 immutability | ✅ | ✅ | ✅ | — | ⚠️ math open | — | — |
| PublishedPresentationV1 | ✅ | ✅ | ✅ | ✅ | — | — | — |
| PublishedPresentationPlanV1 | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Component registry (35) | ✅ | ✅ | ✅ | ✅ | — | — | — |
| StructuredAssetV1 + review decisions | ✅ | ✅ | ✅ | ✅ | — | — | — |
| LearningExperiencePlanV1 | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Seven-stage validator | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Durable plan store + revalidation | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Learning modes (5) | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Adaptation (M4.4) | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Caching + invalidation (M4.5/46) | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Budget accounting | ✅ | ✅ | ✅ | — | — | ❌ mock only | — |
| Gemini adapter | ✅ | ✅ | ❌ stub only | — | — | ❌ | — |
| Observability | ✅ | ✅ | ✅ | — | — | — | ❌ no backend |

**P is empty for every provider row.** That is the central honesty of this
report: no live Gemini request was made in Batch 4, so no provider behaviour is
verified. **O is empty everywhere** — nothing has been run in production.

---

## 4. Defects found and fixed in this milestone

### D1 — reservations leaked on provably pre-dispatch crash *(fixed)*

Traced by measuring the crash window, not by reading code.

```
ledger after reserve           32,768
crash before dispatch marker
recovery marks failed, refunds      0
retry reserves again          65,536 total, zero inference
```

Root cause was twofold: recovery never reconciled, and the row carried
`approvalId`/`reservedTokens` only *after* the dispatch marker, so recovery
could not know what to refund. Fixed by writing the reservation before the
marker and releasing it per attempt via an idempotent marker. An uncertain
(payable) outcome is still never refunded — the distinction the accounting
policy turns on.

### D2 — metrics route overstated its scope *(fixed)*

`GET /courses/:courseId/planning/metrics` is course-scoped in path and
authorization, but returned process-global counters. One course author could
infer another course's planning activity. The payload now states
`scope: 'process'` with a note, so the figures cannot be read as a measurement
of the named course. Metrics remain process-local and are not distributed.

### D3 — C4 is **not** clean *(recorded, not fixed)*

`shared/ednova/experiencePlanner.ts` is **still imported** by
`modules/study/src/tests/semantic-content.test.ts`. The M4.5 report's
"unused, cleanup only" assumption is wrong. It is dead production code but live
test code; removing it requires rewriting that suite, which is out of scope
here. **C4 remains open.**

---

## 5. Evidence hierarchy used throughout

| Category | Meaning in these reports |
|---|---|
| Working software | routes, services, models that execute |
| Unit tested | jest/vitest, no external service |
| Integrated | real NestJS + MongoDB + BetterAuth |
| Browser tested | Playwright against the real published reader |
| Independently reviewed | a qualified human examined the artifact |
| Provider verified | a real Gemini call was made and observed |
| Production operational | run in production with real traffic |

Batch 4 reaches **browser tested**. It does not reach independently reviewed,
provider verified, or production operational. No report here claims otherwise.

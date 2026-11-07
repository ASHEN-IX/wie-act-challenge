# EdNova Batch 4 — M4.3 Post-Acceptance Hardening: Final Acceptance

**Question:** is the system ready for Batch 4.4?
**Date:** 2026-11-07

---

## 1. Verdict

# GO

All mandatory hardening gates pass, **including the real combined-service
accounting test** the M4.3 acceptance could not provide. The exact-budget defect
this review was asked to investigate was real, is fixed, and is now covered by
both a unit test and a cross-service scenario.

---

## 2. What was confirmed versus corrected

### Confirmed as reported

| Item | Verified |
|---|---|
| 1,075 API tests / 74 suites | yes, before the fix |
| 207 web tests | yes |
| 4 browser tests | yes |
| Zero TypeScript errors | yes |
| Five modes, durable plans, author-only generation | yes |
| No live provider calls, no deployment | yes |

### Corrected

| Finding | Severity |
|---|---|
| **Exact-budget dispatch refused** — Python required a second reservation for an already-funded attempt | **High**, fixed |
| Documentation said "eight scenarios", listed seven | Low, corrected with a note |
| Bonus: the extra tests raised coverage 1,075→1,085 and 14→20 Python | — |

### Repository state correction

The brief's "19 untracked Nardouch entries" no longer applies: another workstream
committed them (`021185f`, 84 files tracked). The working tree is clean apart
from dotfiles. No Nardouch file was modified here.

---

## 3. Gate ledger

| Gate | Status | Evidence |
|---|---|---|
| Lifecycle mapped before changing code | **PASS** | architecture note §2 |
| Exact-budget boundary investigated | **PASS** | defect reproduced, then fixed |
| One authoritative reservation per attempt | **PASS** | Node writes; Python reads |
| Independent Python check retained | **PASS** | `_ledger_permits_dispatch` + `_propagated_reservation` |
| No third accounting implementation | **PASS** | zero Python writes, asserted |
| Combined Node+Python test | **PASS** | 10/10, real MongoDB |
| Machine-readable per-scenario evidence | **PASS** | `cross-service-accounting.json` |
| Durable-plan security (12 properties) | **PASS** | security regression §2 |
| Canonical coverage under all modes | **PASS** | validator stage 3 + browser |
| Formula governance preserved | **PASS** | Deep Dive prefers source-faithful |
| Provider isolation | **PASS** | read route has no provider |
| Full regressions | **PASS** | §5 |
| No test weakened | **PASS** | suites grew; only corrected tests replaced |
| No live provider call / no deploy | **PASS** | SDK stubbed throughout |

---

## 4. The defect, in one table

| Ledger state | Before | After |
|---|---|---|
| used 0, limit 1,000,000 | dispatch, 150 charged | unchanged |
| **used 967,232, limit 1,000,000** | **refused** | **dispatch, 967,382** |
| used 1,000,001, limit 1,000,000 | refused | refused |
| two concurrent, room for one | one wins | one wins |

The middle row is the finding. It is now asserted at two levels: the unit test
`test_exactly_sufficient_budget_permits_dispatch`, and combined scenario #5.

---

## 5. Final regression counts

| Suite | Result |
|---|---|
| API unit | **1,085 / 1,085**, 75 suites |
| Web unit | **207 / 207**, 32 files |
| Browser (real services) | **4 / 4** |
| Python boundary | **20 / 20** |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |
| `m43-budget-proof.ts` | ALL SCENARIOS MATCH (7) |
| `m43-cross-service-proof.ts` | **10 / 10** |

---

## 6. Learning mode quality

| Mode | Observable difference | Verified |
|---|---|---|
| Read | none — deliberately. No planner request. | yes |
| Guided | definition/example/proof preference, collapsed disclosure | yes |
| Explore | interactive components only with a structured asset; **reports indistinguishability otherwise** | yes |
| Practice | `ExerciseBlock` first; lesson's own exercises | yes |
| Deep Dive | proof/derivation/source preference, expanded | yes |

Every mode preference resolves to a component the registry actually owns
(`every mode preference names a component the registry actually owns`), and the
four planned modes have distinct preference signatures.

**No pedagogical benefit is claimed.** Arrangement differs; student outcomes were
not measured and are not in scope.

---

## 7. Remaining risks

| # | Risk | Severity | Evidence | Owner |
|---|---|---|---|---|
| R1 | No live provider behaviour observed | Medium | stub throughout | M4.4+, needs fresh authorization |
| R2 | Combined test runs the Python router in-process against real DBs, not over HTTP | Low | control flow is identical; documented | — |
| R3 | Mode pedagogy unmeasured | Low | arrangement only | product |
| R4 | C1 — Batch 3 extraction assertions target the wrong hierarchy | Medium | out of scope, untouched | Batch 3 |
| R5 | C2 — Nardouch loading state on non-throwing revision mismatch | Low | out of scope, untouched | Nardouch |
| R6 | C4 — legacy `experiencePlanner.ts` unused | Low | out of scope, untouched | cleanup |

C1, C2 and C4 remain outside this scope, as instructed. None blocks M4.4.

---

## 8. M4.4 readiness

**Ready, with the conditions above.**

The evidence that matters: the two services that share a budget ledger now agree
on *which* attempt owns *which* reservation, proven against one real database
across ten scenarios. That was the specific gap M4.3 left open, and it is the
kind of gap that only appears when both halves run together — which is exactly
why it was missed twice.

What M4.4 must not assume: that provider behaviour has been validated. It has
not, and no test in this milestone should be read as if it had.

---

## 9. Changes made

| File | Change |
|---|---|
| `apps/ai/services/api/routers/experience_planner.py` | attempt-aware affordability check |
| `apps/ai/tests/test_experience_planner_dispatch.py` | 14 → 20 tests |
| `apps/api/scripts/m43-cross-service-proof.ts` | new combined proof |
| `apps/api/modules/study/src/tests/learning-mode-quality.test.ts` | new, 10 tests |
| `reports/EDNOVA-BATCH4-M43-VALIDATION.md` | seven-vs-eight correction |
| `reports/EDNOVA-BATCH4-M43-ARCHITECTURE.md` | rewritten for this review |
| three new reports | INTEGRATION-VALIDATION, SECURITY-REGRESSION, this file |

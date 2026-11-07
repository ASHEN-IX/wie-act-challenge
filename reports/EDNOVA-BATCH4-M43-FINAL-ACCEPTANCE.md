# EdNova Batch 4 — M4.3 Final Acceptance

**Milestone:** 4.3 — AI Learning Modes, Durable Experience Plans & Student
Integration
**Date:** 2026-11-07
**Scope completed:** M4.3 only. Batch 4.4 not started.

---

## 1. Verdict

# CONDITIONAL GO

All mandatory technical and security gates pass with a mocked provider SDK:
durable plans persist and revalidate, the accounting double-debit is fixed and
measured, five modes work on real source-backed lessons, and author/student
privileges are separated.

The conditions are bounded and non-critical:

1. **No live provider behaviour is verified** — by design, and stated throughout.
2. **The Node+Python ledger invariant is proven from both sides separately**, not
   in one combined process. A combined harness was attempted and abandoned
   because it would have been a third implementation of the thing under test.
3. **C1, C2 and C4 remain open** and are not this milestone's to close.

---

## 2. Git baseline

```
<this commit>  feat(m43): durable experience plans and five learning modes
a0ebda4        docs(m42): provider, budget, security and acceptance evidence
4f10461        feat(m42): provider-independent planner with Gemini, consent and budget
d5c8e77        docs(m41): final closure and workstream isolation
a8928b9        (mixed nardouch commit — preserved, never rewritten)
```

One path-scoped commit, **zero nardouch files**. No history rewritten.

---

## 3. Gate ledger

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Validated plan safely persisted and retrieved | **PASS** | 19 store tests; 4 browser tests |
| 2 | Retrieved plans revalidated against trusted records | **PASS** | 9 read-path negative tests |
| 3 | Budget cannot charge twice for one attempt | **PASS** | 7-scenario ledger proof; 14 Python tests |
| 4 | At least two meaningfully distinct modes on real lessons | **PASS** | 5 modes; browser evidence |
| 5 | All modes preserve canonical coverage | **PASS** | validator stage 3; browser per-mode checks |
| 6 | Unreviewed mathematics stays source-faithful | **PASS** | policy gate; reader disclosure |
| 7 | Author/reviewed assets retain correct provenance | **PASS** | M4.2 C3 provenance unchanged |
| 8 | Enrolled students access authorized plans | **PASS** | stored-plan route; browser test |
| 9 | Students cannot invoke provider calls | **PASS** | read route has no provider; 403 on generate |
| 10 | Mode switching and browser navigation work | **PASS** | reload, back, forward |
| 11 | Planning failure never blocks deterministic reading | **PASS** | unavailable state + fallback |
| 12 | No arbitrary model-generated code executed | **PASS** | M4.1 structural guarantees retained |
| 13 | Critical authorization/integrity regressions pass | **PASS** | 1075 API + 207 web |
| 14 | Real-service browser validation passes | **PASS** | 4/4 against real BetterAuth/NestJS/Mongo |
| 15 | No live Gemini call | **PASS** | SDK mocked throughout |
| 16 | No production deployment | **PASS** | local QA harness only |

---

## 4. Test counts

| Suite | Count | Notes |
|---|---|---|
| API unit | **1075 / 1075**, 74 suites | +32 M4.3 |
| Web unit | **207 / 207**, 32 files | unchanged count, 1 test rewritten |
| Browser | **4 / 4** | +1 M4.3 scenario |
| Python boundary | **14 / 14** | +2 net |

### New M4.3 tests (32 API + 1 browser)

| Suite | Tests |
|---|---|
| `learning-modes.test.ts` | 13 |
| `experience-plan-store.test.ts` | 19 |
| `learning modes render from a persisted plan…` (browser) | 1 |

### Commands

```bash
cd apps/api && npx jest modules src shared --runInBand
cd apps/web && npx vitest run --maxWorkers=2
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m43-budget-proof.ts
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm --filter web exec playwright test --config playwright.m41.config.ts
```

---

## 5. The defect this milestone found

M4.2 shipped two reservations for one attempt. Both were individually atomic,
which is why neither side's tests caught it. Running them together charged
**twice** the real usage.

| Scenario | Before | After |
|---|---|---|
| one provider call, 150 tokens reported | 300 charged | **150** |
| no usage report | 65 536 | **32 768** |
| timeout after dispatch | 65 536 | **32 768** |

Fixed by giving the reservation one owner while keeping both security checks.
This is the clearest evidence for the brief's instruction not to assert that
"both reservation functions are individually atomic" and call it verified.

---

## 6. Browser evidence

`reports/evidence/batch4-m41/`:

| File | Shows |
|---|---|
| `01-deterministic-reader.png` | Read mode, no plan, source-faithful |
| `02-validated-plan.png` | AI-arranged plan with learner-facing label |
| `03-rejected-plan-fallback.png` | invalid plan → deterministic fallback |
| `04-mode-selector.png` | **all five modes**, Read active, content readable |
| `05-guided-mode.png` | Guided mode rendering the same lesson |

Desktop viewport captured. The selector wraps on narrow widths by design
(`flex-wrap`), so it remains operable on mobile.

---

## 7. Upstream conditions (not this milestone's)

| # | Condition | Owner | Status |
|---|---|---|---|
| C1 | Batch 3 extraction assertions target the wrong hierarchy | Batch 3 | open, untouched, assertions not weakened |
| C2 | Nardouch can show an indefinite loading state on a non-throwing revision mismatch | Nardouch | open, untouched; visible in `04-mode-selector.png` |
| C4 | Legacy `experiencePlanner.ts` unused | cleanup | open, untouched |

C2's loading text appears in the M4.3 screenshot because the QA fixture has no
Nardouch route. That is the pre-existing behaviour, not a M4.3 regression, and
this milestone deliberately did not modify Nardouch code.

---

## 8. Remaining risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | No live-provider verification | **Medium** | out of scope; requires fresh authorization |
| R2 | Combined Node+Python ledger run not achieved in one process | **Low** | proven from both sides; residual listed |
| R3 | Stored plans are re-planned, not cached across contexts | **Low** | deliberate; caching policy is a later milestone |
| R4 | Explore is only as useful as a lesson's structured assets | **Low** | explicitly reported as indistinguishable from Read |
| R5 | Mode pedagogy unmeasured | **Low** | arrangement only; no learning claim made |

---

## 9. What this milestone does not claim

- No learning-outcome or pedagogical improvement from any mode.
- No live provider behaviour, cost or retention verification.
- No mastery inference, personalisation, voice or generated lesson content.
- No resolution of C1, C2 or C4.
- No production deployment, and no production data touched.

---

## 10. Files

**New**
- `apps/api/shared/ednova/learningModes.ts`
- `apps/api/modules/study/src/models/ExperiencePlanRecord.ts`
- `apps/api/modules/study/src/services/experiencePlanStore.ts`
- `apps/api/modules/study/src/tests/learning-modes.test.ts`
- `apps/api/modules/study/src/tests/experience-plan-store.test.ts`
- `apps/api/scripts/m43-budget-proof.ts`

**Changed**
- `apps/api/modules/study/src/services/planningBudget.ts` (pooled client; single-owner reservation)
- `apps/api/modules/study/src/services/experiencePlanGeneration.ts` (persists accepted plan)
- `apps/api/modules/study/src/services/experiencePlanning.ts` (mode-aware read path)
- `apps/api/modules/study/src/routes/learning.ts` (author-gated generate; learner read)
- `apps/api/src/framework/domains/study.module.ts` (generated route method)
- `apps/api/shared/ednova/planningContext.ts` (mode objective in the task)
- `apps/ai/services/api/routers/experience_planner.py` (`_has_headroom`; no ledger write)
- `apps/ai/tests/test_experience_planner_dispatch.py` (14 tests)
- `apps/web/src/features/reader/lesson-reader.tsx` (five-mode selector, states)
- `apps/web/src/features/learning/journey-actions.ts` (`storedLessonPlan`)
- `apps/web/src/app/(workspace)/courses/[courseId]/present/page.tsx` (mode wiring)
- `apps/web/e2e/batch4-m41-planning.spec.ts` (+1 scenario, 2 assertions tightened)

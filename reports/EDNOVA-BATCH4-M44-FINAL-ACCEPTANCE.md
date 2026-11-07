# EdNova Batch 4 — M4.4 Final Acceptance

**Milestone:** 4.4 — Evidence-Based Learner Adaptation & Personalised Learning
Navigation
**Date:** 2026-11-07
**Scope completed:** M4.4 only. M4.5 not started.

---

## 1. Verdict

# CONDITIONAL GO

Every mandatory technical, privacy and authorization gate passes against real
services. The implementation is deliberately bounded, and the conditions are the
boundaries themselves rather than defects:

1. **No learning-outcome benefit is claimed or measured.** Modes differ in
   arrangement; whether that improves comprehension requires a study that has
   not been run.
2. **Evidence was exercised through labelled QA fixtures**, not real learner
   history. The records use the real collection, real shape and real evaluator
   version, but they are seeded.
3. **C1, C2 and C4 remain open**, owned by their workstreams as before.

A GO would overstate the second point. A NO-GO would understate the first two
being honest scope boundaries rather than failures.

---

## 2. Git scope

```
<this commit>  feat(m44): evidence-based learner adaptation with explicit student control
c0f32dd        docs(m43): hardening reports with the combined-service evidence
6a0b2c3        fix(m43): make the Python affordability check attempt-aware
```

Verified: HEAD was `c0f32dd`, matching the M4.3 hardening commit. Two path-scoped
commits added. **Zero Nardouch files touched.** Nardouch is *committed*
(`021185f`, 84 files), not untracked — the brief's "19 untracked files" no longer
applies. Three landing-page files remain modified by that workstream and were
left alone. No history rewritten.

---

## 3. Gate ledger

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Uses existing trusted progress/assessment records | **PASS** | `LearningEvidence`, accepted only |
| 2 | No unsupported mastery inference | **PASS** | reuses `masteryAchieved`; no new score |
| 3 | Explicit preferences respected | **PASS** | rules 2–5 precede evidence rule 6 |
| 4 | Deterministic, explainable reasons | **PASS** | closed vocabulary; record cannot validate without one |
| 5 | No recommendation references invalid evidence | **PASS** | eligibility filter + post-query recheck |
| 6 | User state cannot leak across students | **PASS** | `userId` filter on every read and write |
| 7 | Course and revision isolation | **PASS** | filters + binding check on parse |
| 8 | Modes use validated plans or safe fallbacks | **PASS** | `peekStoredPlan`; no plan ⇒ not offered |
| 9 | Students retain full control | **PASS** | no auto-navigation; dismiss/disable verified |
| 10 | Unreviewed mathematics source-faithful | **PASS** | untouched; disclosure visible in evidence |
| 11 | Review and assessment governance intact | **PASS** | M4.1–M4.3 suites all green |
| 12 | Adaptation dispatches no provider request | **PASS** | no provider import in the path |
| 13 | Reader works with adaptation disabled | **PASS** | browser: readable with suggestions off |
| 14 | Authenticated real-service tests pass | **PASS** | 5/5 browser |
| 15 | Regressions pass | **PASS** | 1,137 API · 214 web · 20 Python |
| 16 | No production deployment | **PASS** | local QA harness only |

---

## 4. What was built

| Layer | Artifact |
|---|---|
| Contract | `LearningAdaptationV1` — strict, versioned, bound to course/revision/lesson |
| Policy | seven ordered deterministic rules, seven closed reason codes |
| Preferences | user-scoped, editable, resettable, version-guarded |
| Evidence | eligibility filter over accepted assessment only, bounded read |
| Reader | optional suggestion with accept / dismiss / disable |
| Routes | 5, all learner-scoped, none touching a provider |

---

## 5. Test ledger

| Suite | Result |
|---|---|
| API unit | **1,137 / 1,137**, 77 suites |
| Web unit | **214 / 214**, 32 files |
| Browser (real BetterAuth + MongoDB) | **5 / 5** |
| Python boundary | 20 / 20 |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |

New: 35 policy tests, 17 service tests, 7 reader tests, 1 browser scenario.
**No existing assertion was weakened.** Two were replaced, and both were
*strengthened*: the recommendation/reason invariant was split into four sharper
cases after the contract gained an explicit neutral-reason rule.

---

## 6. The honest limits

**No pedagogical claim.** The product copy says a lesson covers an objective the
learner has not confirmed through practice. It does not say the mode will help,
and neither do these reports. Measuring that needs a controlled study.

**Evidence is real-shaped, not real.** The browser scenario seeds
`learning_evidences` with the exact shape, evaluator block and `accepted` status
the application writes, for a QA student. That is a fixture, labelled as one,
not a claim about a real learner's performance.

**One suggestion, not a ranked profile.** The policy returns a single explained
recommendation. That is a deliberate ceiling: an opaque multi-factor score would
be harder to justify and impossible for a learner to contest.

---

## 7. Remaining risks

| # | Risk | Severity | Owner |
|---|---|---|---|
| R1 | No student-outcome measurement | Medium | product / research |
| R2 | QA-seeded evidence rather than live learner history | Low | QA |
| R3 | C1 — Batch 3 extraction assertion hierarchy | Medium | Batch 3 |
| R4 | C2 — Nardouch loading state on non-throwing mismatch | Low | Nardouch |
| R5 | C4 — unused legacy `experiencePlanner.ts` | Low | cleanup |

None blocks M4.5. R1 is the one that should be closed before any claim of
personalised learning effectiveness is made publicly.

---

## 8. Files

**New**
- `apps/api/shared/ednova/learningAdaptation.ts`
- `apps/api/shared/ednova/adaptationPolicy.ts`
- `apps/api/modules/study/src/models/LearnerAdaptationPreference.ts`
- `apps/api/modules/study/src/services/learnerAdaptation.ts`
- `apps/api/modules/study/src/services/lessonAdaptation.ts`
- `apps/api/modules/study/src/tests/adaptation-policy.test.ts`
- `apps/api/modules/study/src/tests/learner-adaptation.test.ts`
- `apps/api/scripts/m44-adaptation-perf.ts`

**Changed**
- `apps/api/modules/study/src/services/experiencePlanStore.ts` (`peekStoredPlan`, availability only)
- `apps/api/modules/study/src/routes/learning.ts` (5 routes)
- `apps/api/src/framework/domains/study.module.ts` (5 generated methods)
- `apps/web/src/features/reader/lesson-reader.tsx` (suggestion UI)
- `apps/web/src/features/learning/journey-actions.ts` (read/dismiss/disable)
- `apps/web/src/app/(workspace)/courses/[courseId]/present/page.tsx` (wiring)
- `apps/api/tests/m41-fixture.ts` (objective, evidence, validated plan)
- reader test and browser spec

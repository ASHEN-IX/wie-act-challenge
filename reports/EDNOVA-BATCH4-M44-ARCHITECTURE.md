# EdNova Batch 4 — M4.4 Architecture: Evidence-Based Learner Adaptation

**Scope:** recommend existing learning modes from trusted evidence and explicit
preferences. No live provider call, no production deployment, no M4.5.

---

## 1. Baseline verified

| Reported | Verified |
|---|---|
| API 1,085 tests | **1,085 / 74 suites** before this milestone |
| Web 207 tests | **207** |
| Browser 4 | **4** |
| Python 20 | 20 (untouched) |
| Both typechecks | 0 errors |
| HEAD | `c0f32dd` — matches the M4.3 hardening commit |

The brief named report files that do not exist
(`EDNOVA-BATCH4-M43-POST-ACCEPTANCE-*`). The real ones are
`EDNOVA-BATCH4-M43-ARCHITECTURE.md`, `-INTEGRATION-VALIDATION.md`,
`-SECURITY-REGRESSION.md`, `-FINAL-ACCEPTANCE.md`.

**Nardouch is committed**, not untracked: `021185f` tracked 84 files. Three
landing-page files remain modified by that workstream and were left alone.

---

## 2. Existing evidence sources (Phase A audit)

| Source | What it actually is | Trusted for adaptation? |
|---|---|---|
| `LearningEvidence` | accepted assessment verdicts, per objective, with evaluator version | **yes** — the only decision-grade source |
| `learnerProgress` | objective mastery derived from accepted evidence; already documents "no inferred ability level" | reused as the semantics |
| `StudentAttempt` | submitted attempt receipts, with an assessment result | indirectly, via evidence |
| `UserProfile.preferences` | study time, notifications, theme | not relevant to mode choice |
| `LearningStyleProfile` | a *provisional* self-report probe | **no** — M4.4 must not create permanent style labels |
| Nardouch growth stage | companion progression artwork | **no** — never a substitute for assessment |
| Page views, timers, slider moves | interaction state | **no** — viewing is not understanding |

The classification the brief asks for, made explicit in the contract as
`EvidenceClass`:

- `accepted_assessment` — a trusted verdict. **The only class that may recommend.**
- `explicit_preference` — the learner's own choice.
- `interaction_state` — recorded by the type, ignored by the policy.
- `inference` — recorded by the type, ignored by the policy.

---

## 3. The contract

`shared/ednova/learningAdaptation.ts` → `LearningAdaptationV1`, three versions
carried independently: schema `1.0.0`, policy `1.0.0`, preferences `1.0.0`.

Carries: course, revision, lesson, evidence fingerprint, recommended mode,
eligible modes, **one** reason code, objective ids, generated/expiry times.

Deliberately absent: any ability score, mastery estimate, psychological label,
raw answers, complete history, or internal row identifier.

### The reason vocabulary is closed and small

| Code | What it says | Backed by |
|---|---|---|
| `explicit_preference` | the mode you chose | a stored preference |
| `guided_requested` | you asked for more explanation | preference + worked examples exist |
| `proof_material_requested` | you asked for proofs | preference + proof material exists |
| `visual_asset_available` | interactive material exists | preference + **review-verified** asset |
| `objective_not_yet_mastered` | an objective not yet confirmed | accepted evidence + objective→lesson join |
| `neutral_default` | nothing to suggest | absence of the above |
| `preference_unavailable_for_lesson` | the lesson lacks what your mode needs | preference + support check |

Validation rejects: unknown fields, unknown reason codes, an unavailable
recommended mode, a cross-course/revision/lesson record, and — importantly —
**a recommendation with no reason, or a reason with no recommendation**.

---

## 4. Deterministic policy (Phase E)

`shared/ednova/adaptationPolicy.ts`. Pure and ordered:

```
1  recommendations disabled        → nothing, at all
2  explicit mode preference        → honour it, or explain the limitation
3  guided request + examples       → Guided
4  proof request + proof material  → Deep Dive
5  visual request + eligible asset → Explore
6  accepted evidence, objective unmastered on this lesson → Guided
7  otherwise                       → neutral default
```

**Rule 2 runs before rule 6 by design.** A learner's stated wish is never
overridden by an assessment outcome. That ordering *is* the student-control
guarantee, and it is asserted directly
(`a preference outranks assessment evidence`).

Explores are only recommended when a **review-verified** asset exists, because
without one Explore renders exactly Read — offering it would be a manufactured
difference.

---

## 5. The objective → lesson join

Objectives live on a revision's **subtopics**, and a canonical lesson's id **is**
that subtopic's id (`build_canonical_document`: `lesson_id = lesson.get("id")`).
`lessonObjectiveIdsForRevision` reads that from the revision the learner is
already authorized for.

This is a real identity, not a heuristic. When it is absent the function returns
`[]` rather than guessing, so a recommendation can never claim a lesson covers
something it does not. The browser run confirms it: the response carried
`objectiveIds: ["obj_summation"]`, derived from the published revision.

---

## 6. Preferences (Phase C)

`LearnerAdaptationPreference`, one row per learner.

| Property | How |
|---|---|
| user-scoped | `userId` unique index; every query filters on it |
| editable | partial `PUT`; unknown keys rejected |
| optional | absence ≠ `false`; a learner who never chose gets defaults |
| resettable | `DELETE` removes the row, so "never chose" stays distinguishable |
| concurrent-safe | `version` counter; a stale write is `409`, never a silent overwrite |
| dismissible | bounded last-50 list per lesson+mode |

No learning-style classification is accepted: `parsePreferences` rejects
`visual`, `auditory`, `kinesthetic`, `abilityLevel`, `masteryScore` — tested.

---

## 7. Plan compatibility (Phase F)

Adaptation reads `peekStoredPlan` to learn which modes have a validated plan and
offers only those. It never generates one, never dispatches, and the plan that
eventually renders is still fully revalidated by the M4.3 read path — a
recommendation cannot skip validation, only point at it.

---

## 8. Privacy (Phase H)

- Evidence is **read live**, not copied into a second store.
- The query is bounded (`limit(200)`) and selects identity fields only — the
  returned record carries no answers and no score, asserted by
  `returns identity and verdict only, never the learner’s answers`.
- No external model receives learner data; adaptation has no provider import.
- Gemini content consent is a different consent and is never reused here.
- Turning suggestions off suppresses the evidence query entirely — asserted by
  `suppresses evidence entirely when the learner disallowed it`.

---

## 9. Code changes

| File | Change |
|---|---|
| `shared/ednova/learningAdaptation.ts` | new contract + strict parsers |
| `shared/ednova/adaptationPolicy.ts` | new deterministic policy |
| `modules/study/src/models/LearnerAdaptationPreference.ts` | new model |
| `modules/study/src/services/learnerAdaptation.ts` | preferences, eligibility, support |
| `modules/study/src/services/lessonAdaptation.ts` | objective join + envelope |
| `modules/study/src/services/experiencePlanStore.ts` | `peekStoredPlan` (availability only) |
| `modules/study/src/routes/learning.ts` | 5 routes |
| `src/framework/domains/study.module.ts` | 5 generated methods |
| `web/.../lesson-reader.tsx` | suggestion UI, dismiss state |
| `web/.../journey-actions.ts` | read/dismiss/disable actions |
| `web/.../present/page.tsx` | wires the suggestion |
| `apps/api/tests/m41-fixture.ts` | seeds objective, evidence, a validated plan |

No canonical, presentation, validator, provider or plan-store semantics changed.

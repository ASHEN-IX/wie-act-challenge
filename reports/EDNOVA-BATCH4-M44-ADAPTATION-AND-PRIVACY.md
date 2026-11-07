# EdNova Batch 4 — M4.4 Adaptation and Privacy

What the recommendation layer is allowed to know, what it refuses to infer, and
how a learner keeps control.

---

## 1. Trusted versus excluded evidence

| Evidence | Class | Used? | Why |
|---|---|---|---|
| `LearningEvidence` with `status: 'accepted'` | assessment | **yes** | a trusted evaluator produced a verdict |
| Objective mastered | assessment | **yes**, to *stop* recommending | established semantics reused |
| Objective not mastered | assessment | **yes**, to suggest a lesson that teaches it | the only evidence-driven rule |
| Explicit mode preference | preference | **yes** | the learner said so |
| Worked-example / proof / visual preference | preference | **yes** | the learner said so |
| Attempt receipt without accepted evidence | interaction | no | not a verdict |
| Lesson opened, time on page, slider moved | interaction | no | viewing is not understanding |
| Tutor suggestion | inference | no | not a grade |
| Nardouch growth stage | inference | no | companion art is not assessment |
| Learning-style probe result | inference | no | M4.4 must not create permanent labels |
| Another student's row | — | no | filtered by `userId` |
| Another course / revision | — | no | filtered, and re-checked after the query |

**No mastery model was invented.** `objective_not_yet_mastered` reuses the
existing `masteryAchieved` flag from accepted evidence — the same semantics
`learnerProgress` already documents as "no inferred ability level or
submission-count mastery".

---

## 2. What a recommendation may and may not say

**May:** name a mode, state one reason from the closed vocabulary, and name the
objectives it rests on (server-side only).

**May not:** describe the learner, estimate ability, predict a score, claim the
mode will improve outcomes, or reveal an assessment result.

The learner-facing copy was tested against this. Every reason string is checked
to contain no `improve | better results | proven | guarantee`, and the
`objective_not_yet_mastered` copy is checked for `struggl | weak | behind | poor`
— it says *"this lesson covers an objective you have not yet confirmed through
practice"*, which is a statement about the lesson and the record, not the person.

---

## 3. Student control

| Guarantee | Mechanism | Test |
|---|---|---|
| Learner choice outranks evidence | rule order: preference rules 2–5 before evidence rule 6 | `a preference outranks assessment evidence` |
| Never auto-navigates | the reader renders a `<aside>`; mode change is a link the learner clicks | browser: Read stays `aria-current` with a suggestion visible |
| Dismissible | per-lesson, per-mode dismissal, bounded to the last 50 | `does not surface a suggestion the learner dismissed` |
| Disable globally | `recommendationsEnabled: false` suppresses the query itself | `suppresses evidence entirely when the learner disallowed it` |
| Opt out of evidence only | `allowAssessmentEvidence: false` keeps preference-based help | `ignores evidence when the learner disallowed assessment evidence` |
| Resettable | `DELETE` removes the row | `resets by deleting, so "never chose" stays distinguishable` |
| Reader works without adaptation | no suggestion is a normal state | browser: lesson readable with suggestions off |

---

## 4. Isolation guarantees

| Boundary | Enforcement | Test |
|---|---|---|
| Between students | every query filters `userId`; write filter is `{ userId, version }` | `never writes another learner’s preference row` |
| Between students (browser) | outsider gets 403/404 on the adaptation route, and their own defaults on preferences | browser scenario |
| Between courses | course filter on the evidence query and on the route path | `queries only the learner’s own accepted rows for this course` |
| Between revisions | `activity.revisionId` filter **plus** a post-query re-check | `drops a row whose revision does not match, even if the query returned it` |
| Stale recommendation | bound to course+revision+lesson; `expiresAt`; fingerprint over inputs | `rejects a record for another course or revision` |
| Concurrent preference writes | version guard → `409` | `rejects a write carrying a stale version`, `rejects a write that loses the concurrency race` |

The post-query revision re-check matters: a query filter is a request, not a
guarantee, and this is the second line.

---

## 5. Privacy properties

**Data minimisation.** Evidence is read live from the trusted collection on each
recommendation. Nothing is copied into a second store, and no history is
embedded in the payload.

**Selected fields only.** The query selects revision, objective, mastery flag and
evaluator version — never answers, never score. Asserted by
`returns identity and verdict only, never the learner’s answers`, which
stringifies the returned record and checks it contains neither a planted answer
nor a planted score.

**Bounded reads.** `limit(200)` and a `userId`-indexed filter; a learner with
thousands of rows does not load them for one suggestion.

**No external processing.** Adaptation has no provider import and cannot dispatch.
Gemini content-processing consent is a *different* consent and is not reused for
learner performance data.

**Preference persistence scope.** Stored: the seven stated preferences, a version
counter, and a bounded dismissal list. Not stored: evidence, scores, history, or
any derived profile.

**Logs.** The route logs no answers and no evidence rows. Rejections surface as
typed codes without payloads.

---

## 6. What is *not* claimed

- **No learning-outcome benefit.** Modes differ in arrangement; whether a
  learner learns more in Guided than Read has not been measured and is not
  claimed anywhere in the product copy or this report.
- **No personalisation quality claim.** The policy is deterministic and
  explainable, not adaptive-by-learning.
- **No mastery inference beyond existing semantics.** If the trusted records do
  not say an objective is mastered, the recommendation may suggest a lesson that
  covers it — it never asserts a level.

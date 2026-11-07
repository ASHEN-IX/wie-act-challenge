# EdNova Batch 4 — M4.6 Educational Quality

What was measured about content fidelity, mode distinctness and educational
design — and, just as importantly, what was **not** measured.

---

## 1. Golden dataset

| Subject | Source | Provenance |
|---|---|---|
| Mathematics | `reference-course.pdf` | real extracted document; sha256 `ff830402…fa02` (byte-identical to the Batch 3 GO run) |
| Networking | `networking-qa.pdf` | real extracted document; authored QA fixture |
| Programming | M4.1 fixture lesson 2 | authored QA fixture, not independent content |
| Prose | M4.1 fixture lesson 1 | authored QA fixture |

**Labelled honestly:** none of these is independently certified academic
material. Passing an automated test does not certify a textbook.

---

## 2. Content fidelity — measured structurally

All properties below are asserted by the existing suites against real services,
not re-derived here:

| Property | Status |
|---|---|
| No missing canonical blocks | ✅ validator stage 3 (one placement per block) |
| No duplicated blocks | ✅ duplicate rejected |
| Correct order | ✅ positional binding |
| Chapter/lesson relationships | ✅ from the published revision |
| Stable source references | ✅ evidence spans bound to revision |
| Reviewed vs unreviewed state | ✅ runtime disclosure + policy gate |
| Source fallback for unreviewed maths | ✅ `SourceMathFallback` |
| Code/table representation | ✅ `CodeViewer`, `EducationalTable` |
| Honest absence of missing assets | ✅ `missing_source_asset` reason |

Every one of those is enforced **at validation time on every plan**, so an AI
plan cannot upgrade, fabricate or reorder content. That is the strongest claim
this milestone can make about fidelity, and it is structural rather than
editorial.

---

## 3. Mode quality matrix

Evaluated against the same published lesson. **Observable interface difference**
is separated from **assumed pedagogical benefit**.

| Mode | Coverage | Source faithfulness | Distinctness | Component eligibility | Review fidelity | Accessibility | Fallback |
|---|---|---|---|---|---|---|---|
| Read | 100% | exact extraction | baseline | registry-only | preserved | ✅ | n/a |
| Guided | 100% | unchanged content | **distinct** — collapsed proof disclosure, definition/example preference | ✅ | preserved | ✅ | ✅ |
| Explore | 100% | unchanged | **conditional** — distinct only with a review-verified asset; otherwise *reported as indistinguishable* | ✅ | preserved | ✅ | ✅ |
| Practice | 100% | unchanged | **distinct** — exercise-first arrangement | ✅ | preserved | ✅ | ✅ |
| Deep Dive | 100% | unchanged | **distinct** — expanded disclosure, proof/derivation/source preference | ✅ | preserved | ✅ | ✅ |

**Explore is the honest edge case.** With no structured asset and no interactive
block it renders identically to Read, and the application says so rather than
manufacturing a difference. The predicate is tested
(`says a mode is indistinguishable only when it genuinely is`).

**No mode claims more mathematical verification than another.** Deep Dive
prefers `SourceMathFallback` for unreviewed formulas precisely so it cannot
appear more authoritative than Read.

---

## 4. Educational quality rubric

Ten dimensions. Automated structural checks only; semantic judgment requires a
human, and none was available.

| # | Dimension | Automated result | Human review |
|---|---|---|---|
| 1 | Source fidelity | **PASS** — structural | NOT TESTED |
| 2 | Instructional coherence | **PASS (structural)** — order preserved | NOT TESTED |
| 3 | Presentation hierarchy | **PASS** — heading levels never skip | NOT TESTED |
| 4 | Explanation accuracy | not automatable | **NOT TESTED** |
| 5 | Component selection | **PASS** — registry-constrained | NOT TESTED |
| 6 | Interactivity relevance | **PASS** — asset-gated | NOT TESTED |
| 7 | Mathematical uncertainty comms | **PASS** — runtime disclosure | NOT TESTED |
| 8 | Programming/engineering correctness | **PASS** — code rendered verbatim, never executed | NOT TESTED |
| 9 | Accessibility | **PARTIAL** — see §6 | NOT TESTED |
| 10 | Student control and transparency | **PASS** — no auto-navigation, dismiss/disable | NOT TESTED |

**The automated checks cannot determine mathematical truth or educational
effectiveness.** Stating that plainly is the point of separating these columns.

---

## 5. Mathematics review status

The Batch 2 independent mathematical adjudication remains **incomplete**. No
qualified independent reviewer and no completed 16-case adjudication exist in
this environment.

```
INDEPENDENT_MATH_CERTIFICATION: BLOCKED
```

No evaluator verdicts, accuracy percentages or reviewer sign-offs are reported
here, because none were produced. The 2-of-85 reviewed-formula ratio for the
reference revision is a **provenance** fact, not an accuracy claim.

---

## 6. Accessibility findings

Measured in the real authenticated reader (not a preview route), no axe
available:

| Check | Result |
|---|---|
| Mode controls keyboard reachable, operable | **PASS** — anchors, focusable |
| Accessible names on all five modes | **PASS** |
| Source-verification disclosure visible | **PASS** |
| No horizontal overflow at 640 px | **PASS** (≤1 px) |
| Touch targets ≥24 px | **PASS** |
| `prefers-reduced-motion` honoured | **PASS** — page intact |
| Screen-reader session | **NOT TESTED** — no assistive technology available |
| WCAG conformance | **NOT CLAIMED** |

Evidence: `reports/evidence/batch4-m41/07-mobile-640.png` shows the reader at
640 px with all five modes legible and no overflow.

**Contrast was not computed for the authenticated reader.** The existing Batch 3
harness measures contrast but targets a preview route; running it would not be
real-service evidence, so it is reported as not measured here rather than
substituting a preview figure.

---

## 7. What this milestone cannot say

- **No learning-outcome claim.** No comprehension, retention or grade effect was
  measured. A working recommendation interface is not evidence of effectiveness.
- **No independent educational review.** Every human-review row is `NOT TESTED`.
- **No mathematical certification.** BLOCKED upstream, and not worked around.
- **No claim that authored fixtures are real courses.** They are labelled.

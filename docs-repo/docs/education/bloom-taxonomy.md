# Bloom's Taxonomy — Technical & Educational Reference (F14 / BLOOM-DOC)

> **Primary reference:** Anderson, L. W., & Krathwohl, D. R. (Eds.) (2001). *A Taxonomy for Learning, Teaching, and Assessing: A Revision of Bloom's Taxonomy of Educational Objectives.* New York: Longman.
>
> This document is the authoritative written reference for the two-dimensional competency model implemented in **F14 — Bloom Competency Engine**. Implementation debates resolve against the constants and math documented here. Where this document and code diverge, the code is wrong.

---

## 1. 1956 vs. 2001 Revision

Bloom's original taxonomy (Bloom, Engelhart, Furst, Hill, & Krathwohl, 1956) modelled only the **cognitive process** dimension as a one-dimensional hierarchy:

| 1956 noun form | 2001 verb form (revised) |
|---|---|
| Knowledge | Remember |
| Comprehension | Understand |
| Application | Apply |
| Analysis | Analyze |
| Synthesis | Evaluate* |
| Evaluation | Create* |

*Note the swap:* in the 2001 revision the top two levels were reordered — **Create** (formerly Synthesis) is now the highest, and **Evaluate** (formerly Evaluation) sits below it. The revision also converted every level from a noun to a **verb** (the action being performed) and renamed the dimension from "knowledge categories" to **cognitive processes**.

The single most important change for this engine: the 2001 revision treats *knowledge* (remembering facts) as **not a separate top-level category** but as a **type of knowledge** that can operate at *any* cognitive level. That is the foundation of the two-dimensional model.

---

## 2. Two Dimensions

The revised taxonomy is explicitly **two-dimensional**:

### Dimension 1 — Cognitive Process (`bloomLevel`)

Ordered low → high. This is the "thinking" axis.

| Level | Key | Lower / Higher order |
|---|---|---|
| 1 | `remember` | Lower-order thinking |
| 2 | `understand` | Lower-order thinking |
| 3 | `apply` | Lower-order thinking |
| 4 | `analyze` | Higher-order thinking |
| 5 | `evaluate` | Higher-order thinking |
| 6 | `create` | Higher-order thinking |

The canonical ordered tuple, as implemented in [`bloom/taxonomy.py`](study-partner-ai/bloom/taxonomy.py) (Python) and mirrored in `study-partner-api/shared/bloom/taxonomy.js` (Node):

```text
remember, understand, apply, analyze, evaluate, create
```

`UNLOCK_THRESHOLD = 0.7` — level N is unlocked only when level N−1 scores ≥ 0.7; `remember` is always unlocked.

### Dimension 2 — Knowledge Type (`knowledgeType`)

This is the "what is known" axis — *not* ordered. Any knowledge type can be exercised at any cognitive level.

| Key | Meaning |
|---|---|
| `factual` | Basic elements students must know (terminology, specific details) |
| `conceptual` | Interrelationships among basic elements (models, theories, classifications) |
| `procedural` | How to do something (methods, techniques, algorithms) |
| `metacognitive` | Knowledge of cognition in general and awareness of one's own cognition |

The canonical tuple:

```text
factual, conceptual, procedural, metacognitive
```

### Why two dimensions matter

A competency is therefore not a single number — it is a **per-key** score:

```text
competency key = (userId × topicId × knowledgeType × bloomLevel)
```

Each key evolves **independently**. There is deliberately **no cross-level inference**: scoring "Understand" high never moves "Create". The only way to raise a higher level is to produce *evidence at that level* subject to the progression gate (BLOOM-10).

---

## 3. Lower- vs. Higher-Order Split

- **Lower-order thinking** (LOT): `remember`, `understand`, `apply` — recalling, explaining, and using knowledge in familiar contexts.
- **Higher-order thinking** (HOT): `analyze`, `evaluate`, `create` — breaking down, judging, and generating new structures.

The engine treats this split as a **progression concern, not a quality judgment**. The progression gate means a student typically must demonstrate LOT before HOT is unlocked and thus targeted — but once unlocked, HOT is a *separate* scoring axis, not a bonus on top of LOT.

---

## 4. Verb Tables

Bloom levels are named after verbs. When classifying a learning objective, the verb is the primary signal for the cognitive level, and the taxonomy ships a canonical verb map (used for the verb-consistency penalty in the classifier):

| Level | Canonical verbs (from `VERB_MAP`) |
|---|---|
| `remember` | Define, List |
| `understand` | Explain, Summarize |
| `apply` | Solve, Implement |
| `analyze` | Compare, Diagnose |
| `evaluate` | Justify, Critique |
| `create` | Design, Compose |

**Classifier verb handling (as implemented in `bloom/classifier.py`):**
- When the LLM-classified level **does not match** the objective's verb, the classification confidence is **halved** (`VERB_DISAGREEMENT_PENALTY = 0.5`).
- Objectives whose final confidence falls below the **confidence gate** (`GATE_THRESHOLD = 0.6`) are flagged `needsReview`.

---

## 5. Assessment Design Mapping

A competency is only as good as the evaluation that feeds it. Map assessment items to the level they actually measure:

| If you want to measure | Ask the student to | Corresponding level |
|---|---|---|
| Recall of terminology/facts | `Define`, `List` | `remember` |
| Grasp of meaning | `Explain`, `Summarize` | `understand` |
| Use in a new situation | `Solve`, `Implement` | `apply` |
| Break into parts / find relations | `Compare`, `Diagnose` | `analyze` |
| Judge against criteria | `Justify`, `Critique` | `evaluate` |
| Produce something new | `Design`, `Compose` | `create` |

Design guidance: an item's verb alone is insufficient — the **task demand** decides the level. "Explain how you would solve X" often measures `understand` unless the student actually solves a novel instance; use the question type, the required output, and the rubric to pin the level, not just the stem verb.

---

## 6. Competency Formula

A competency is a growing score produced from **evidence-weighted observations** of student performance on evaluation steps.

```text
competency score  = EWMA over demonstrated-bloom-level evidence
competency key    = (userId, topicId, knowledgeType, bloomLevel)
```

Each evaluation step emits a `demonstratedBloomLevel` (what the answer actually showed — see EVAL-02b/EVAL-08). That evidence is routed to the matching competency key and the score is updated. The raw feed (`demonstratedBloomLevel` + `targetBloomLevel`, joined with `objectiveId`) is the source of truth for BLOOM-08 updates.

---

## 7. Estimator Math (implemented)

### EWMA update step

The score is updated with an **exponentially weighted moving average (EWMA)**:

```text
score_new  = score_prev + α × (observation − score_prev)
```

with:

- `ALPHA (α) = 0.4`
- `MAX_STEP = 0.12` — the per-step |delta| is **clamped** to 0.12 (a single observation can never swing the score more than 12 points on the 0–1 scale)
- score is re-clamped to `[0, 1]` and rounded to 3dp

Recency decay: because each new observation pulls the score toward itself, older evidence is implicitly dampened. The equivalent exponential-decay half-life is:

```text
half-life ≈ ln(2) / ln(1/(1−α)) ≈ 1.3 updates   (for α = 0.4)
```

### Evidence replay (canonical score)

Rather than storing only a running mean, the profile **replays EWMA over stored evidence**, sorted oldest → newest by `evaluatedAt`:

1. Filter to items with a non-null `masteryScore`.
2. Sort ascending by `evaluatedAt`.
3. Seed at **0.5 (neutral)** — this matches EVAL's `last_valid_score` default.
4. Apply `ewmaStep` for each evidence item in order.
5. Return the final score and confidence.

A fresh profile with **no evidence** returns `{ score: 0, confidence: 0 }` — deliberately distinguished from "neutral" 0.5, so "no data" is never mistaken for "average".

### Confidence

Confidence accumulates with evidence count and asymptotes to 1:

```text
confidence = 1 − (1 − α)^n        (n = number of evidence items)
```

`α = 0.4` ⇒ each new observation is worth ~2.5× less marginal confidence than the previous.

### Evidence cap

`MAX_EVIDENCE = 20` — only the 20 most recent evidence items are retained; EWMA is replayed over those (so the score is fully reproducible from stored evidence, and idempotent replay of a step does not double-count).

### Example

| Evidence (evaluatedAt order) | masteryScore |
|---|---|
| t1 | 0.6 |
| t2 | 0.8 |
| t3 | 0.9 |

- seed = 0.5
- after t1: `0.5 + 0.4×(0.6−0.5) = 0.54`
- after t2: `0.54 + 0.4×(0.8−0.54) = 0.644`
- after t3: `0.644 + 0.4×(0.9−0.644) = 0.7464 → 0.746`
- confidence = `1 − (1−0.4)^3 = 0.784 → 0.784`

### Progression gate (BLOOM-10)

```text
unlocked(level N)  = score(level N−1) ≥ UNLOCK_THRESHOLD (0.7)
unlocked(remember) = true            (always)
missing predecessor score = 0         (not unlocked)
```

Plans target the **highest unlocked weak** level (weakest-first), so a learner is never asked to `create` before their `apply`/`analyze` bases are gated open.

---

## 8. Anti-Patterns

### ⚠️ Anti-pattern: "score % ≠ Bloom level"

**A percentage score is not a Bloom level.** Getting 80% on a quiz of `remember` items measures *remember*, not *apply* — no matter how high the percentage. The two dimensions must not be conflated:

- **Percentage / accuracy** answers *how well* the student performed on a given set of items.
- **Bloom level** answers *what kind of thinking* was demonstrated.

Consequence in this engine: `demonstratedBloomLevel` is the **cognitive operation the answer actually showed** and it is what drives the competency key — not the raw percentage. A 100% recall of facts raises `remember`, not `create`. Conversely, a 60% on a `create` item *does* move `create` (evidence is evidence), subject only to the progression gate.

### ⚠️ Anti-pattern: cross-level inference

Never move a higher Bloom level from evidence at a lower level. This engine enforces the opposite by keying every competency update independently and relying on BLOOM-10's gate for progression.

### ⚠️ Anti-pattern: treating Bloom level as linear "difficulty"

Bloom levels are a **hierarchy of cognitive process**, not a strict difficulty ladder. A hard `understand` question may be harder than an easy `analyze` question. The gate orders *unlocking*, but scoring is per-key and evidence-driven.

### ⚠️ Anti-pattern: mixing knowledge types into one score

A `procedural` `apply` score and a `metacognitive` `apply` score are different competencies. Rolling them together destroys the granularity BLOOM-09/BLOOM-10 rely on for weakest-first targeting.

---

## 9. Where It Lives

| Concern | Location |
|---|---|
| Shared taxonomy constants (levels/types/verb map/unlock) | `bloom/taxonomy.py` · `study-partner-api/shared/bloom/taxonomy.js` |
| Objective classification | `bloom/classifier.py` |
| Objective extraction | `objective_extractor.py`, `learning_objective.py` |
| Competency estimator (EWMA) | `study-partner-api/services/study/src/services/competency.js` |
| Competency profile store | `CompetencyProfile` model (`services/study/src/models`) |
| Planner weakest-first targeting | BLOOM-10 (Python planner + Node plan service) |
| Frontend competency radar | BLOOM-11 (`study-partner-web` Competency Map) |
| E2E validation | BLOOM-12 |

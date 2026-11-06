# EdNova Batch 3 — Implementation report (Milestones 3.2 – 3.5)

Date: 2026-11-06. Baseline: `f7895fc` (Batch 2 release candidate `db3b802` / tag `ednova-batch2-v2-rc1`, plus Milestone 3.1 in `455c0a6`).

Scope: the educational component registry (3.2), the student reader (3.3), the interactive components (3.4) and the deterministic presentation engine (3.5). Batch 4 is not started.

**Verdict for this report: PASS within the validated scope, with the limitations recorded in §7 and in `EDNOVA-BATCH3-FINAL-ACCEPTANCE.md`.**

---

## 1. What Milestone 3.1 actually contained

The brief said not to recreate 3.1. It was inspected rather than assumed:

| Claimed | Verified |
| --- | --- |
| `PublishedPresentationV1` `1.0.0` in `apps/api/shared/ednova/presentationDocument.ts` | Present; strict parser, derived render policy, fixed disclosure vocabulary |
| `loadPublishedReading` shared boundary | Present in `modules/study/src/services/courseReader.ts` |
| `presentationReader.ts` + `GET .../presentation` | Present |
| `presentation-view.tsx` + `/courses/[courseId]/present` | Present |
| Existing deterministic reader kept as fallback | Present, and re-verified by `course-reader.test.ts` |

Two discrepancies against the 3.1 report, both benign and documented here rather than silently changed:

1. The 3.1 report describes `presentation-view.tsx` as "the learner surface". It rendered **every chapter and every lesson in one continuous page** — the exact "single enormous QA-style vertical view" the Batch 3 brief prohibits. This milestone replaced it with a lesson-scoped reader and removed the orphaned component and its test (its assertions were re-expressed against the new reader in `lesson-reader.test.tsx`).
2. The 3.1 report lists **85 display-math blocks (2 reviewed, 83 fallback)**. That is a property of the reference revision, not of the contract. Nothing in 3.2–3.5 assumes that ratio; the contractual facts (2 reviewed / 83 source-faithful) are exercised by the real-service harness only.

Milestone 3.1's contract, its strict parse and its two-level fallback are unchanged and still pass (8/8 of its own tests).

---

## 2. Architecture

```
canonical revision (immutable)
        │  loadPublishedReading (authorization + artifact + checksum + revision pin)
        ▼
PublishedPresentationV1  (1.0.0, strict parse)
        │  buildPresentationPlan — deterministic, no model call
        ▼
PublishedPresentationPlanV1 (1.0.0)          COMPONENT_CAPABILITIES (1.0.0)
        │  instance.component                     │ trusted literal vocabulary
        ▼                                         ▼
LessonReader (client) ──► PlannedBlockView ──► RENDERERS table (static imports only)
        │
        └─ failure of any layer → deterministic source-faithful reader, same revision
```

### 2.1 Files added

| File | Responsibility |
| --- | --- |
| `apps/api/shared/ednova/componentRegistry.ts` | Frozen capability table, `resolveComponent`, semantic-role classification |
| `apps/api/shared/ednova/presentationPlan.ts` | Deterministic canonical → component plan, reader modes, selection rules |
| `apps/web/src/features/reader/lesson-reader.tsx` | Three-area learner workspace, modes, navigation, source inspector |
| `apps/web/src/features/reader/components/registry.tsx` | Browser renderer table; the only trusted component source |
| `apps/web/src/features/reader/components/semantic.tsx` | Definition / theorem / proof / example / exercise / note |
| `apps/web/src/features/reader/components/math-blocks.tsx` | Reviewed, derivational and source-faithful mathematics |
| `apps/web/src/features/reader/components/structured.tsx` | Code, table, figure, process, chart |
| `apps/web/src/features/reader/math/expression.ts` | Restricted expression parser/evaluator (security boundary) |
| `apps/web/src/features/reader/math/function-graph.tsx` | `FunctionGraph2D` + parameter explorer |
| `apps/web/src/features/reader/math/sequence-visualizer.tsx` | Term / partial-sum exploration |
| `apps/web/src/features/reader/math/derivation-stepper.tsx` | Step navigation over reviewed derivation lines |
| `apps/web/src/features/reader/code/code-walkthrough.tsx` | Guided line-by-line progression |
| `apps/web/src/features/reader/diagrams/interactive-diagram.tsx` | Trusted topology / architecture exploration |
| `apps/web/src/features/reader/explorations.ts` | Frozen deterministic demo set, matched by concept |
| `apps/web/src/features/reader/preview-fixture.ts` + `app/(marketing)/reader-preview/page.tsx` | Development-only browser verification of the real reader |

### 2.2 Files changed

- `presentationDocument.ts` — additive optional `plan`; strict plan parser bound positionally to the projected blocks.
- `app/(workspace)/courses/[courseId]/present/page.tsx` — lesson-scoped reader with URL-driven lesson and mode; fallback branch unchanged.
- `pipeline` and ingestion were **not touched**. Detector V2, region identities and FAISS artifacts are untouched.

---

## 3. Milestone 3.2 — component registry

`COMPONENT_CAPABILITIES` is a frozen record of 35 components. Each declares accepted canonical block types, semantic roles, evidence requirement (`none` / `block_evidence` / `source_region` / `reviewed_formula` / `structured_fixture`), render-policy compatibility, interaction kind, accessibility contract, performance tier and bounds, a trusted fallback, and a one-line summary for Batch 4 planning metadata.

Resolution is a dictionary lookup over literal strings. `isComponentType` uses `Object.hasOwn`, so `__proto__`, `constructor` and arbitrary paths are rejected. An unknown component degrades to `ConceptExplanation`; it never becomes an import.

`resolveComponent` refuses, in order: unknown component, incompatible block, incompatible role, incompatible policy, missing evidence, missing source region, unreviewed formula, missing structured fixture. Every refusal returns the fallback capability rather than throwing.

Evidence requirements were tightened during implementation after tests exposed three wrong assumptions:

- `DerivationBlock` requires `reviewed_formula`, not `block_evidence` — trust comes from the review record.
- `ProcessDiagram` / `StepSequence` require no separate evidence — the step list is structure carried and validated in the block itself.
- `SourceDiagram` requires no source region — a diagram whose crop is missing must still render its faithful "asset not attached" state rather than disappear.

---

## 4. Milestone 3.5 — deterministic presentation engine

`buildPresentationPlan` maps each canonical block to exactly one instance. Order is canonical order; nothing is sorted, deduplicated or dropped. Same input yields byte-identical output (`plansEqual`).

Selection rules implemented: heading → `SectionHeading`; paragraph/quote → `ConceptExplanation`; list → `ConceptList`; callout by semantic role → `DefinitionCard` / `TheoremCard` / `ProofBlock` / `ExampleBlock` / `ExerciseBlock` / `ImportantNote`; reviewed math → `ReviewedFormula`; reviewed math with `aligned`/`gather`/`cases`/`array`/`\\` → `DerivationBlock`; unreviewed math → `SourceMathFallback`; code → `CodeViewer`; table → `EducationalTable`; image → `FigureViewer`; diagram → `ProcessDiagram`; chart → `DataChart`; anything else → `ConceptExplanation` with `unsupported_block`.

A block with `render: 'source_faithful'` always takes the source path regardless of type. `Read` mode never sets `interactive`; `Explore` sets it only for `ProofBlock`, `ProcessDiagram`, `DataChart`, `DerivationBlock`, and never for unreviewed mathematics. `Practice` is a layout policy and sets nothing interactive.

### 4.1 Plan validation is fail-closed

`parsePresentationPlan` binds the plan positionally to the document's own blocks: same count, same ids in the same order, same `render`/`reason`, same block type, and `instanceId === lessonId + ':' + blockId`. Counts must equal the recomputed counts, `unclassified` must equal the recomputed total, and the plan's `courseId`/`revisionId`/`contentHash` must equal the document's. A plan that adds, drops, reorders, relabels or promotes unreviewed mathematics is rejected with `INVALID_PRESENTATION_DOCUMENT`.

The `plan` field is optional on parse, so a `1.0.0` document produced before this milestone still parses (tested).

---

## 5. Milestone 3.3 — student reader

Three areas, one workspace:

- **Outline** (left, ≥`lg`): course title, chapter groups, lesson list, search filter, current-lesson indication, revision label. Collapsible drawer below `lg`.
- **Learning surface** (centre): chapter badge and position, focusable lesson heading, summary, mode switch, lesson-scoped verification disclosure, components, previous/next.
- **Tools** (right, ≥`xl`): practice/tutor, deterministic reader, original sources, objectives. Drawer below `xl`.

Behaviour that is verifiable rather than asserted:

- Selection and mode live in the URL (`?revisionId=…&lesson=…&mode=…`), so lessons are deep-linkable and browser history works. `read` is the default and stays out of the URL.
- The reader takes a `basePath`, so the same component mounts on the production route and on the preview route without hard-coded links (a bug found in the browser and fixed).
- An unknown lesson id shows "This lesson is not in this revision" instead of silently showing a different lesson (also found in the browser).
- Focus moves to the lesson heading on navigation; `Escape` closes whichever overlay is open and restores focus to its trigger; the source dialog is `aria-modal` with a labelled title.
- Source references open a dialog with the page number and, when the crop exists, the crop. The link is described as a **download** of the preserved file, because the API route calls `res.download` — an earlier `#page=` fragment promised an HTML viewer that does not exist.

No lesson completion or mastery is claimed anywhere: the progress model is objective-level accepted-assessment evidence (`learningJourney.learnerProgress`), which this milestone does not touch. The Practice panel says so explicitly.

---

## 6. Milestone 3.4 — interactive components

| Component | Interaction | Grounding |
| --- | --- | --- |
| `FunctionGraph2D` + parameter sliders | pan-free zoom, pointer readout, bounded parameters | restricted expression parser; explicit "not a proof" |
| `SequenceVisualizer` | terms / partial sums, term-count slider | restricted expression in `n` only |
| `DerivationStepper` | previous/next/restart, keyboard, full text list | reviewed LaTeX only |
| `CodeWalkthrough` | next/previous/restart, line highlight, state panel, keyboard | authored annotations; never executed |
| `InteractiveDiagram` | node selection, keyboard, textual element/edge list | authored topology; connectivity never inferred |

All five mount only in Explore mode and only from the frozen `EXPLORATIONS` set, each labelled **"Deterministic demo"** with the disclosure *"not source content, not instructor-reviewed and not a proof"*. Matching requires both a concept keyword **and** quantitative material in the lesson; a prose lesson that merely mentions "theorem" gets nothing (a defect found in the browser and fixed).

### 6.1 The expression evaluator is the security boundary

`math/expression.ts` tokenises a small arithmetic grammar and evaluates an AST. There is no `eval`, no `Function`, no dynamic import. Unknown identifiers, host globals and prototype members are rejected (`RESERVED_IDENTIFIERS`). Limits: 400 characters, 400 nodes, depth 32, 20 000 evaluation steps, final-value magnitude 1e12. Domain gaps return `null` and render as a gap, never a fabricated value.

A real defect was found and fixed here: the magnitude guard originally applied to **intermediates**, so `1 / 2^n` reported 21 undefined terms from n=40 onward because `2^40` exceeded 1e12. It now applies to the final value only, and `expression.test.ts` pins the regression across n = 1…100.

---

## 7. Explicit non-claims and residual risks

1. **Structured fixtures are authored, not extracted.** The canonical projection carries no code annotations or topology graphs. `hasStructuredFixture` is therefore `false` for every projected block, so `CodeWalkthrough`, `InputOutputExample`, `CodeComparison`, `AnnotatedDiagram`, `ArchitectureDiagram`, `NetworkTopology` and `Timeline` **degrade to their static fallbacks in the reader**. They are implemented and tested, but the reader shows them only through the authored exploration set.
2. **`ParameterExplorer` and `LimitExplorer` are drawn by one component.** Parameter variation is implemented inside `FunctionGraph2D`; a separate limit explorer was not built. Limits are shown as sampled estimates with an explicit "not a proof" disclosure.
3. **Module names differ from the brief.** `FunctionGraph2D`, `ParameterExplorer`, `SequenceVisualizer`, `DerivationStepper`, `GuidedCodeWalkthrough`, `InteractiveDiagram`, `ProcessStepper` are realised as `FunctionGraph`, `(parameters within FunctionGraph)`, `SequenceVisualizer`, `DerivationStepper`, `CodeWalkthrough`, `InteractiveDiagram`, `ProcessDiagram`. No behaviour from the brief is missing except the separate `LimitExplorer` and `NetworkFlowExplorer`.
4. **`NetworkFlowExplorer` (packet walkthrough) is not implemented.** The validated-topology explorer exists; a deterministic packet-flow simulation was not built.
5. **Independent mathematical accuracy is unchanged and still BLOCKED** upstream. Nothing in this milestone certifies a formula.
6. **Live Gemini calls** were not made.
7. **Real-service measurement** was not possible in this environment — see the acceptance report for exactly what could not run and why.

---

## 8. Reproducing the verification

```bash
pnpm --filter web test
pnpm --filter api exec jest modules/study/src/tests --runInBand --forceExit --testPathIgnorePatterns integration
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec tsc -p tsconfig.check.json
pnpm --filter web build
```

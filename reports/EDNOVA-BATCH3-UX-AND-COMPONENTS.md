# EdNova Batch 3 — UX and components report

Date: 2026-11-06. Evidence: `reports/evidence/batch3/` (screenshots at 2× device scale, `reader-journeys.json`).

All observations below come from the real reader driven in a real browser against a real `PublishedPresentationV1` built by the production builder. They are not inferred from the type definitions.

---

## 1. Component inventory (35 registered)

### Core textual
`LessonHeader`, `SectionHeading`, `ConceptExplanation`, `DefinitionCard`, `TheoremCard`, `ProofBlock`, `ExampleBlock`, `ExerciseBlock`, `ImportantNote`, `SourceReference`, `SourceCitation`.

### Mathematics
`FormulaBlock`, `ReviewedFormula`, `SourceMathFallback`, `DerivationBlock`, `MathematicalDefinition`, `EquationGroup`.

### Programming
`CodeViewer`, `CodeExplanation`, `CodeWalkthrough`, `InputOutputExample`, `CodeComparison`.

### Engineering and diagrams
`FigureViewer`, `SourceDiagram`, `AnnotatedDiagram`, `ProcessDiagram`, `ArchitectureDiagram`, `NetworkTopology`.

### Structured information
`EducationalTable`, `ComparisonTable`, `KeyValueTable`, `StepSequence`, `Timeline`, `ConceptList`, `DataChart`.

"Registered" is not "rendered in the reader". The distinction is recorded in §4.

---

## 2. What each component actually shows

### Semantic treatments are visually distinct
Verified in `math-read.png` and by computed style in the live page:

| Role | Treatment |
| --- | --- |
| Definition | 12 px-radius tinted panel (emerald, 7 % wash), `DEFINITION` label, bookmark icon |
| Theorem / proposition / lemma / corollary | tinted panel (violet, 9 % wash), label is the **actual** kind, sigma icon |
| Example | tinted panel (sky, 7 % wash), lightbulb |
| Exercise | tinted panel (amber, 8 % wash), "From the source · not graded here" |
| Proof | **no panel** — in-flow text with a 1 px rule, collapsible with `aria-expanded`/`aria-controls`, collapsed text retained for assistive technology |
| Remark / note | **no panel** — in-flow text with a 1 px rule |

Two tiers, not six decorated cards: a **formal** stated result earns a quiet tinted surface, while **supporting** material (proof, remark) sits inside the reading flow. Computed style confirms the two tiers differ in background and radius (panel: tinted, `12px`; in-flow: transparent, `0px`), so the hierarchy reads without relying on the label text.

An earlier iteration used a `border-l-4` coloured side tab on every role. That is the most recognisable tell of a generated UI and it repeated down an entire lesson, so it was replaced with the surface-based hierarchy above.

### Reviewed versus unreviewed mathematics
`ReviewedFormula` shows `Instructor-accepted` or `Instructor-corrected`, plus the standing line *"Reviewed representation · not independently verified"*, and a disclosure containing the reviewer, the original extraction and the model proposal. `SourceMathFallback` is dashed-bordered, carries an `Unverified transcription` badge, shows the preserved crop, and keeps the extracted text in a `<details>`; it states that it is not typeset so that nothing claims a mathematical interpretation.

In the browser (`math-read`): 2 reviewed formulas typeset by KaTeX, 1 unreviewed rendered from source, 1 definition, 1 theorem, 1 proof, 1 exercise — matching the fixture exactly.

### Code
Line numbers, exact whitespace, tokenised highlighting, copy control, language label, horizontal scroll on the `<pre>` only. Blank lines are preserved (verified by reconstructing the source from the rendered spans). No execution path exists.

### Tables and charts
Real `<table>` with `<caption>` and `scope="col"` headers. Charts render an SVG with `role="img"` and an always-present "View data table" alternative.

### Figures
`FigureViewer` shows the source image, or a faithful "the source asset is not attached to this revision" state. A non-image response (error JSON, expired authorization) is detected via `naturalWidth === 0` and replaced by a status message rather than a broken-image icon — a defect found in the browser and fixed in both `FigureViewer` and `SourceMathFallback`.

### Diagrams
`ProcessDiagram` renders the block's validated step list as an ordered walkthrough. `InteractiveDiagram` renders an authored topology with selectable nodes, a description panel, and a textual element/edge list.

---

## 3. Reader UX

### Desktop (1440 × 900, measured)
Grid: `256px | 769px | 304px`. The reading column is 769 px at 16 px / 28 px, roughly 75 characters — the intended measure. The tools panel does not compete with the text.

- Outline shows chapter groups, current lesson highlighted with `aria-current="page"`, a search filter, and the revision id.
- Lesson header shows chapter badge, "Lesson 1 of 3", title, summary, and the mode switch.
- Previous/next are labelled buttons with `rel="prev"` / `rel="next"`.

### Mobile (390 × 844, measured)
Desktop outline and tools are `display:none`; `Outline` and `Tools` buttons are visible; `document.scrollWidth` equals `innerWidth` (no horizontal overflow). The outline drawer is `aria-modal`, lists all lessons, and closes on `Escape` with focus returned to its trigger. The mobile screenshot shows the lesson-scoped disclosure reading "This lesson: 2 of 3 display formulas have instructor review."

### Modes
`Read` / `Explore` / `Practice` are links carrying `mode` in the URL, so a mode is shareable and back/forward restore it. Read collapses interactions; Explore adds the deterministic demo panel; Practice surfaces the link to the existing practice and tutor surface and states that reading records neither completion nor mastery.

### Source inspection
Every source-backed block offers "Inspect source" / "View source". The dialog shows the page, the crop when available, and the download link, with the explanation that the link downloads the preserved file. Internal region ids and hashes never appear in the reading text.

### Disclosure scoping
The math disclosure is revision-level in the contract, but showing it on a networking lesson misdescribes the page. The reader now renders it only when the **lesson** contains display mathematics, and states both lesson and revision counts. Verified: the TCP lesson shows no banner after the fix.

---

## 4. Components registered but not rendered from canonical content

`hasStructuredFixture` is hard-coded `false` in the plan because the canonical projection carries no code annotations or topology. Consequently these require a fixture and therefore render their fallback when selected from a canonical block:

`CodeWalkthrough` → `CodeViewer`; `InputOutputExample` → `CodeViewer`; `CodeComparison` → `CodeViewer`; `AnnotatedDiagram` → `SourceDiagram`; `ArchitectureDiagram` → `ProcessDiagram`; `NetworkTopology` → `ProcessDiagram`; `Timeline` → `StepSequence`.

They are implemented and unit-tested. In the running reader they appear only through the authored exploration set (`CodeWalkthrough`, `InteractiveDiagram`), which is honest about being authored.

---

## 5. Component appearance problems found and fixed

| Problem | Fix |
| --- | --- |
| Source headings started at `h4`, skipping `h2`/`h3` | Levels now clamp to `h2…h6`; verified `H1 → H2` with no skipped rank |
| Broken-image icon when a crop request returned error JSON | `naturalWidth === 0` check replaces the image with a status message |
| Exploration forced onto prose that merely mentions "theorem" | Eligibility now requires quantitative material in the lesson |
| Topology canvas had a fixed 16:9 box leaving large empty space | Fixed height (`h-64` mobile / `h-56` desktop) |
| Mode switch used `router.replace`, breaking deep links and throwing outside an App Router context | Modes are links; URL stays authoritative |
| Reader links hard-coded `/courses/<id>/present` | `basePath` prop; preview stays on its own route |
| Unknown lesson silently showed lesson 1 | Explicit "This lesson is not in this revision" state |
| `#page=` fragment promised an HTML viewer the API does not serve | Link described as a download |
| Every semantic role used a `border-l-4` side tab — the classic generated-UI tell, repeated down the lesson | Replaced with a two-tier surface hierarchy (tinted panel for formal results, in-flow rule for supporting material) |

---

## 6. UX validation against learning tasks

| Question | Answer |
| --- | --- |
| Can a student identify the current lesson? | Yes — chapter badge, "Lesson *n* of *m*", title, and outline highlight |
| Can a student find the next concept? | Yes — outline search and filtered lesson list |
| Is where an exercise begins clear? | Yes — amber rule, `EXERCISE` label, "not graded here" |
| Are definitions visually distinct from proofs? | Yes — green vs neutral, different labels and icons |
| Is mathematical notation readable? | Reviewed formulas typeset by KaTeX; unreviewed shown as source |
| Can the source be inspected without leaving the lesson? | Yes — modal crops; the full document opens in a new tab |
| Is code easy to read and copy? | Yes — line numbers, exact whitespace, copy control |
| Are interactive elements discoverable? | Yes — Explore mode is a visible switch with a hint line |
| Does the reader work without interaction data? | Yes — Read is the default and every instance has a static path |
| Are practice and tutor accessible without clutter? | Yes — a tools panel on desktop, a drawer on mobile |
| Is mobile navigation usable? | Yes — no horizontal overflow, drawers close on Escape |
| Is uncertain source content labelled? | Yes — dashed border, badge, and explicit non-typesetting statement |

---

## 7. Remaining UX gaps

1. The preview route renders inside the marketing layout, so the preview banner overlaps the marketing navbar. **Preview-only**; the production route mounts inside the workspace shell.
2. No "mark complete" control exists, by design; progress still comes only from accepted assessment evidence.
3. Chapter-level collapse is present through grouping, but there is no per-chapter expand/collapse toggle.
4. No virtualisation. A 60-component lesson rendered 1 566 DOM nodes and was responsive; beyond that, virtualisation would need measurement first.
5. The exploration panel is concept-matched, not lesson-specific. Two exploration sets exist for series and one for TCP; a course outside those concepts receives none.

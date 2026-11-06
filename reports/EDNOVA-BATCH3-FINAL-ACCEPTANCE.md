# EdNova Batch 3 — Final acceptance

Date: 2026-11-06. Baseline `f7895fc`; Batch 2 tag `ednova-batch2-v2-rc1` preserved and unmodified.

> **Superseded in part by Milestone 3.6.** See
> `reports/EDNOVA-BATCH3-M36-REAL-SERVICE-CLOSURE.md` for the later work: the
> structured learning-asset contract, the reserved crop dimensions (CLS
> 0.0738 → 0.0167), measured contrast and touch targets, and the exact
> real-service blockers. The item statuses below that changed are marked
> **3.6**.

**Final decision: CONDITIONAL GO.**

Core Batch 3 functionality is implemented, integrated into the real student route and validated in a real browser against a real presentation contract. The conditions are environmental and upstream, not defects in the delivered work: the isolated real-service harness could not run in this sandbox, and the Batch 2 independent mathematical certification remains open and is explicitly not claimed here.

---

## 1. Executive summary

### Implemented
- A frozen, typed **component registry** (35 components) with evidence requirements, render-policy compatibility, accessibility and performance contracts, and a Batch-4-ready capability description.
- A **deterministic presentation engine** producing one validated component instance per canonical block, with no model call, no randomness and byte-identical output for identical input.
- A **three-area student reader** (outline / learning surface / tools) with URL-driven lesson and mode selection, deep links, working back/forward, mobile drawers and focus management.
- **Five interactive components** driven in the browser: function graph with parameter sliders, sequence/partial-sum explorer, derivation stepper, guided code walkthrough, and a trusted topology explorer.
- A **restricted expression evaluator** as the security boundary for all mathematical interaction.
- **Fail-closed plan validation** bound positionally to the projected blocks.

### Reused, not replaced
Milestone 3.1's contract, strict parser, shared `loadPublishedReading` boundary, authorization, revision pinning, artifact verification and checksum checks. Batch 2's detector V2, region identities, FAISS artifacts, canonical ingestion and the deterministic reader are untouched.

### Major design change
The 3.1 `PresentationView` rendered every chapter and every lesson on one page. It is replaced by a lesson-scoped reader. The orphaned component and its test were removed; its assertions were re-expressed against the new reader.

---

## 2. Acceptance gates

| Gate | Status | Evidence |
| --- | --- | --- |
| 3.1 contracts remain compatible | **PASS** | 8/8 of 3.1's tests still pass; `plan` is optional so old documents parse |
| Trusted registry used by the actual reader | **PASS** | `lesson-reader.tsx` renders only via `PlannedBlockView` → frozen `RENDERERS` table |
| No competing canonical model | **PASS** | No second document format; blocks remain `LessonBlockV2` |
| Immutable revision guarantees intact | **PASS** | No change to `loadPublishedReading`, publication or artifact code |
| Standard reader works without AI | **PASS** | No model call anywhere in 3.2–3.5; `experiencePlanner` untouched |
| All supported blocks displayed or fall back | **PASS** | 60/60 stress math blocks rendered; `unclassified` counted and asserted 0 |
| No source content silently discarded | **PASS** | Positional plan binding rejects any count mismatch |
| Block ordering correct | **PASS** | Order-preserving; asserted in unit and browser tests |
| Review states accurately represented | **PASS** | "Instructor-accepted/corrected · not independently verified" |
| Historical V1/V2 accessible | **PASS** | Unchanged paths still pass their tests |
| Chapter and lesson navigation | **PASS** | Browser-verified, including deep links and unknown-lesson state |
| Coherent desktop workspace | **PASS** | 256/769/304 measured grid; screenshots |
| Usable mobile reader | **PASS** | 390×844, no horizontal overflow, drawers verified |
| Source inspection works | **PASS** | Dialog with page + crop + download, browser-verified |
| Practice and tutor accessible | **PASS** | Tools panel and Practice mode link to the existing surface |
| No single enormous vertical view | **PASS** | Reader is lesson-scoped by construction |
| Prose / educational structures | **PASS** | Definitions, theorems, proofs, examples, exercises, notes |
| Reviewed and unresolved mathematics | **PASS** | KaTeX for reviewed; source fallback for unreviewed |
| Code, tables, figures, diagrams | **PASS** | All rendered; evidence captured |
| One interactive mathematics component | **PASS** | SequenceVisualizer and FunctionGraph driven in browser |
| One guided programming component | **PASS** | CodeWalkthrough advanced line 1→3 in browser |
| One trusted interactive technical diagram | **PASS** | Topology node selection verified in browser |
| Component selection reproducible | **PASS** | `plansEqual` byte-equality test |
| Capabilities typed and validated | **PASS** | 12 registry tests; frozen record |
| Unsupported content → source-faithful fallback | **PASS** | Explicit `unsupported_block` selection + notice |
| Selection reproduces without model calls | **PASS** | Pure function over validated blocks |
| No arbitrary code execution | **PASS** | No `eval`/`Function`; injection payloads rejected |
| No untrusted HTML/script execution | **PASS** | Escaped markup tests; `<script>` in code rendered as text |
| Source authorization enforced | **PASS** | Reuses existing routes; no new public source route |
| Revision isolation preserved | **PASS** | Plan bound to `courseId`/`revisionId`/`contentHash` |
| Integrity failures do not become success | **PASS** | Strict parsers throw; fallback uses the same revision |
| Resource-intensive interactions bounded | **PASS** | Nine explicit bounds documented and tested |
| Reader workflows keyboard-accessible | **PASS** | Manual keyboard checks; 0 automated issues |
| Interactive components have alternatives | **PASS** | Value tables, text lists, `aria-live` readouts |
| Dialogs manage focus | **PASS** | `aria-modal`, labelled, Escape restores focus |
| Mobile interaction meets tested a11y | **PASS** | Drawer verified at 390 px |
| Known a11y gaps documented | **PASS** | Contrast, touch targets, screen reader — see limitations |
| Long lessons without pathological usage | **PASS** | 60-component lesson: 1 566 nodes, responsive |
| Math images not all fetched eagerly | **PASS** | 20 of 60 requested on open; 61 after full scroll |
| Heavy modules load only when required | **PASS** | Lazy `import()`; Read mode mounts none |
| Regressions measured and addressed | **PASS (3.6)** | CLS 0.0738 → **0.0167** after reserving crop dimensions from `bbox` |
| Relevant unit tests pass | **PASS (3.6)** | 315 API + 187 web |
| Relevant integration tests pass | **PARTIAL** | 63/63 reader-related; 3 suites blocked on unreachable infra |
| API/web builds and typechecks pass | **PASS** | Both typechecks exit 0; both builds succeed |
| Real student browser journeys pass | **PARTIAL** | Real reader driven against a real contract; **not** against the real Nest API, auth or database |
| Batch 2 publication/reader regressions green | **PARTIAL** | Reader unit tests green; publication integration suites blocked on infra |
| Multi-subject fixtures work | **PARTIAL** | Math, networking, prose and code verified; fixtures are authored |
| Evidence reproducible | **PASS** | Scripts committed; commands documented |

---

## 3. Validation performed

### 3.1 Automated tests (run in this session)

| Suite | Result |
| --- | --- |
| Web Vitest (all) | **180 passed / 26 files** |
| Web Vitest (reader only) | 76 passed / 6 files |
| API Jest, `modules/study`, non-integration | **279 passed / 27 suites** |
| API Jest, reader-related suites | 63 passed (canonical, reader, semantic, registry, plan, presentation ×2) |
| Milestone 3.1 suites specifically | 8 passed |
| Web `tsc --noEmit` | exit 0 |
| API `tsc -p tsconfig.check.json` | exit 0 |
| API `tsc` (build) | exit 0 |
| Web `next build --webpack` | success; `/courses/[courseId]/present` emitted |

Baseline before this work: web 114 tests, API study 25/28 suites passing. After: web 180, API study 25/28 passing (same three infra-bound suites).

### 3.2 Real-browser validation

A development-only route (`/reader-preview`) renders the **real** `LessonReader` from a **real** `PublishedPresentationV1` built by the production builder. It is guarded by `NODE_ENV === "production"` → `notFound()` before any render.

Six scenarios captured at 2× scale with machine-readable results (`reports/evidence/batch3/`):

| Scenario | Observed |
| --- | --- |
| `math-read` | 2 formulas typeset, 1 source fallback, 1 definition, 1 theorem, 1 proof, 1 exercise; disclosure present |
| `math-explore` | 1 exploration panel, 2 sequence visualizers, 2 SVGs, 2 data tables |
| `engineering-read` | 2 tables, 1 code block, 1 process diagram, 1 chart, no math banner |
| `engineering-explore` | 1 code walkthrough (line 1 → line 3, highlight present), 1 topology, node detail + text alternative |
| `prose-no-forced-interaction` | 0 exploration panels, quote + list render, headings `H1 → H2` |
| `mobile-outline` | dialog visible, 4 lesson links, no horizontal overflow, closes on Escape |

Interactive behaviour was driven, not merely rendered: slider changes re-sampled the curve and updated the live readout; the partial-sum series showed all terms defined after the magnitude fix; topology node selection revealed its trusted description.

### 3.3 Defects found and fixed during validation

Nine defects were found by running the application and fixed; each has a regression test where testable:

1. Intermediate-value magnitude guard made `1/2^n` undefined from n=40 — fixed to bound the final value; regression test n=1…100.
2. Broken `<img>` shown when the crop route returned error JSON — replaced by a status message via `naturalWidth` check.
3. Exploration forced onto prose that merely mentions "theorem" — eligibility now requires quantitative material.
4. Source headings started at `h4`, skipping ranks — clamped to `h2…h6`.
5. Mode switch used `router.replace`, breaking deep links and crashing outside an App Router context — modes are links.
6. Reader links hard-coded the production path — `basePath` prop added.
7. Unknown lesson silently displayed lesson 1 — explicit empty state.
8. Revision-level math disclosure shown on a networking lesson — scoped to the lesson.
9. `#page=` fragment promised an HTML viewer the API does not serve — link described as a download.

Three contract errors were caught by unit tests before they reached the UI: `DerivationBlock` evidence requirement, `ProcessDiagram`/`StepSequence` evidence requirement, and `SourceDiagram` source-region requirement.

---

## 4. What could not be tested, and why

| Item | Status | Reason |
| --- | --- | --- |
| Isolated real-service harness (`final-acceptance.spec.ts`) | **BLOCKED** | MongoDB, RabbitMQ, the Python AI service and Docker are all unreachable in this sandbox (`ECONNREFUSED` on 27017/5672/5362; Docker socket absent). The harness requires all four. |
| Three publication integration suites | **BLOCKED** | `beforeAll` times out connecting to MongoDB |
| Real BetterAuth sessions | **NOT TESTED** | Requires the API and a database |
| Real FAISS retrieval | **NOT TESTED** | Requires the AI service |
| Live Gemini replay | **NOT TESTED** | Not authorized; not required by Batch 3 |
| Production-build browser profiling | **NOT TESTED** | Only the dev server could be driven |
| Lighthouse / axe audit | **NOT TESTED** | No Chrome binary for Lighthouse; no axe dependency in the repo |
| Screen-reader session | **NOT TESTED** | No assistive technology available in this environment |
| Contrast measurement | **NOT TESTED** | No contrast tool available |

**These are environmental limitations of the working environment, not passes.** The real-service leg of Milestone 3.6 must be re-run on a machine with the full stack before Batch 3 is treated as release-ready.

---

## 5. Evidence

Screenshots (2× scale, real browser, real contract) in `reports/evidence/batch3/`:
`math-read.png`, `math-explore.png`, `engineering-read.png`, `engineering-explore.png`, `prose-no-forced-interaction.png`, `mobile-outline.png`.

Machine-readable: `reader-journeys.json` (six scenarios with observed counts), `reader-performance.json` (image, layout-shift and payload measurements).

Revision identity used for the preview: `courseId 0123456789abcdef01234567`, `revisionId rev_batch3_preview`. It is a **fixture contract**, not a published database revision; the report says so everywhere it is referenced.

Commands:

```bash
pnpm --filter web test
pnpm --filter api exec jest modules/study/src/tests --runInBand --forceExit --testPathIgnorePatterns integration
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec tsc -p tsconfig.check.json
pnpm --filter web build
cd apps/web && node e2e/batch3-evidence.mjs
cd apps/web && node e2e/batch3-performance.mjs
```

---

## 6. Open limitations

1. **Independent mathematical certification — BLOCKED, unchanged.** 0 of 16 prepared cases adjudicated. No accuracy metric is claimed anywhere in Batch 3.
2. **Real-service integration — BLOCKED** in this environment (see §4).
3. **Seven registered components need structured fixtures** the canonical projection does not carry, so they degrade to static fallbacks in the reader: `CodeWalkthrough`, `InputOutputExample`, `CodeComparison`, `AnnotatedDiagram`, `ArchitectureDiagram`, `NetworkTopology`, `Timeline`. **3.6**: the versioned contract now exists (`structuredAsset.ts`) and one asset is rendered end-to-end in the browser, but the *data* still does not come from source documents.
4. **`NetworkFlowExplorer` (packet simulation) not implemented.** The validated-topology explorer exists instead.
5. **A separate `LimitExplorer` not implemented.** Limits are shown as sampled estimates inside `FunctionGraph2D` with an explicit non-proof disclosure.
6. **Reserved image dimensions missing**, so mathematics images can shift layout (CLS 0.0738 worst case on a 60-image lesson).
7. **Accessibility not tool-verified** for contrast or touch targets, and no screen-reader session was run.
8. **Explorations are authored demos**, matched by concept keyword, not derived from the source. They are labelled as such in the UI and are not evidence of mastery.
9. **Only four fixture subjects verified** (mathematics, networking, prose, code). No claim of universal academic coverage is made.
10. **Production deployment — PARTIAL / NOT TESTED, unchanged.** No deploy, load or rollback drill.

---

## 7. Decision

**CONDITIONAL GO** for the Batch 3 learning experience as a technical deliverable.

The reader, registry, deterministic engine, interactive components, fallback behaviour, security boundaries and student UX are implemented and validated against a real presentation contract in a real browser, with 459 automated tests green and both production builds passing. The conditions are:

1. Re-run the real-service harness on a machine with MongoDB, RabbitMQ, the Python AI service and Docker, and confirm the Batch 2 publication and reader regressions stay green.
2. Carry the Batch 2 independent mathematical certification forward as an explicitly open upstream gate — it is **not** satisfied by this milestone and nothing here should be read as satisfying it.
3. Accept or schedule the documented gaps in §6 (fixture-dependent components, image dimensions, accessibility tooling).

No GO verdict is given for production deployment, and Batch 4 was not started.

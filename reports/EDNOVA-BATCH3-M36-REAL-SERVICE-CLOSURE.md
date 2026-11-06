# EdNova Batch 3.6 — Real-service closure

Date: 2026-11-06. Baseline `f7895fc`.

**Final decision: CONDITIONAL GO** — unchanged in kind from Batch 3, but now with the real blockers named precisely, one measurable release gap closed, and two genuine defects found and fixed by stronger accessibility measurement.

This report does not claim a real-service pass. The isolated harness could not run here; §1 records exactly why, with the machine's own output as evidence.

---

## 1. Environment, and why the harness did not run

Raw output: `reports/evidence/batch3/service-probe.txt`.

| Requirement | Status on this machine |
| --- | --- |
| Node | 24.20.0 present |
| pnpm | 11.3.0 present |
| Python | 3.14.8 present |
| MongoDB (27017, 27018) | **REFUSED** |
| RabbitMQ (5672) | **REFUSED** |
| Python AI service (5362) | **REFUSED** |
| NestJS backend (3001) | **REFUSED** |
| `mongod` / `mongosh` binary | **NOT INSTALLED** |
| `rabbitmq-server` binary | **NOT INSTALLED** |
| Docker daemon | **PERMISSION DENIED** on `/var/run/docker.sock` (`srw-rw---- nobody:nobody`; session user is `ashenix`) |

`deploy/compose.test.yml` defines the isolated stack (MongoDB 7 on 27018, Mailpit), but starting it requires the Docker daemon, which this session cannot reach. There is no local MongoDB or RabbitMQ binary to start instead.

**Therefore the following are BLOCKED, not passed:**

- `playwright.final.config.ts` / `final-acceptance.spec.ts` — the real BetterAuth + Nest + Python + RabbitMQ + FAISS mathematics and networking journeys.
- `formula-jobs.integration.test.ts`, `formula-proposal.integration.test.ts`, `formula-publication.integration.test.ts` — all three fail in `beforeAll` timing out on a MongoDB connection, which was confirmed by reading the failure, not assumed.

Per the brief, preview results are **not** substituted for real-service PASS. Everything below is labelled for what it actually is.

---

## 2. Requirement classification

### 2.1 Feature implementation (Batch 3 code)

| Requirement | Status |
| --- | --- |
| 35 trusted components | **PASS** |
| Deterministic presentation engine | **PASS** |
| Versioned presentation plan | **PASS** |
| Lesson-scoped reader | **PASS** |
| Read/Explore/Practice modes | **PASS** |
| Five interactive component types | **PASS** |
| Restricted expression evaluator | **PASS** |
| Source-faithful fallbacks | **PASS** |
| Canonical revision integration | **PASS** |
| **Structured learning-asset contract** | **PASS** (new, §3) |
| **Narrow structured-asset integration** | **PASS** (new, §3.3) |
| **Reserved crop dimensions** | **PASS** (new, §4) |
| Contrast defect in step badges | **PASS** (found and fixed, §5) |

### 2.2 Full real-service integration

| Requirement | Status |
| --- | --- |
| Real BetterAuth student session on `/present` | **BLOCKED** |
| Real Nest presentation route | **BLOCKED** |
| Real source-crop authorization | **BLOCKED** |
| Real MongoDB/RabbitMQ/Python pipeline | **BLOCKED** |
| Real FAISS retrieval | **BLOCKED** |
| Batch 2 publication integration regression | **BLOCKED** |
| Production-route browser journey | **NOT TESTED** (needs the above) |
| Security negative cases against the live API | **PARTIAL** — contract-level and unit-level PASS; live HTTP NOT TESTED |

### 2.3 Educational content fidelity

| Requirement | Status |
| --- | --- |
| Reference course structure (2 chapters, 16 lessons, 85 math regions) | **NOT TESTED** here — requires ingestion |
| Mathematical review states rendered correctly | **PASS** (fixture contract) |
| Independent mathematical certification | **BLOCKED** (Batch 2 gate, unchanged) |
| Multi-subject rendering | **PASS** (fixture: math, networking, prose, code) |
| Authored demos not presented as source | **PASS** (§3, labelled) |

### 2.4 Production deployment readiness

| Requirement | Status |
| --- | --- |
| Production build succeeds | **PASS** |
| Production route emitted | **PASS** |
| Production-build browser profiling | **NOT TESTED** (no Chrome for Lighthouse; dev server only) |
| Deployment, load, rollback | **NOT TESTED** (out of scope, not attempted) |

---

## 3. Structured learning-asset contract (new)

### 3.1 The problem

Seven registry components need input the canonical projection cannot supply:

`CodeWalkthrough`, `InputOutputExample`, `CodeComparison`, `AnnotatedDiagram`, `ArchitectureDiagram`, `NetworkTopology`, `Timeline`.

Extracting line annotations or network topology from a PDF is a Batch 4 concern. This milestone does **not** claim those are generated from source documents — they are not.

### 3.2 Contract

`apps/api/shared/ednova/structuredAsset.ts`, schema `1.0.0`, registry version pinned.

Provenance is a required, closed enum, and it drives what an asset may claim:

| Provenance | Learner-visible | Review required | Source refs |
| --- | --- | --- | --- |
| `source_derived` | yes | yes | **required** |
| `instructor_authored` | yes | no | forbidden |
| `reviewed_supplemental` | yes | **required** | forbidden |
| `generated_proposal` | **no — never projected** | must be unreviewed | forbidden |
| `deterministic_demo` | yes | not applicable | forbidden |

Each asset carries: stable `assetId`, `courseId`, `revisionId`, optional `blockId`, `lessonId`, `registryVersion`, `component`, validated `payload`, `provenance`, `review`, optional `sourceReferences`, `audience`, `fallback`, `disclosure`.

Enforced invariants (all covered by tests):

1. Schema and registry version must match the build.
2. The payload's `component` must equal the declared component.
3. `source_derived` **must** carry source references; every other provenance **must not** — an authored demo cannot imply it came from the PDF.
4. `reviewed_supplemental` must carry a review record; `generated_proposal` must not claim one.
5. A non-reviewed status must not carry `reviewedBy`/`reviewedAt` — a forged review is rejected by code.
6. Markup in any payload string is rejected (`STRUCTURED_ASSET_MARKUP_REJECTED`).
7. Annotation lines must be in range and strictly advancing.
8. Topology links must reference declared nodes — connectivity is never inferred; duplicate node ids rejected.
9. Resource limits are enforced by rejecting, never by silent truncation.
10. The fallback must be a component the trusted registry actually knows.

`projectStructuredAsset` re-binds the asset to the caller's course and revision and returns `null` for a non-learner-visible provenance, so an unreviewed generated proposal can never reach a browser.

### 3.3 Narrow integration in the published route

- `GET /api/v1/study/learning/courses/:courseId/presentation` now returns the presentation **plus** `assets`, loaded only after `loadPublishedReading` has authorized the actor and pinned the revision.
- Every stored asset is **re-validated on read**: the database is not a trust boundary, so a row written before a contract change cannot reach the browser.
- A malformed stored asset is skipped, not thrown — an optional supplement must not take the lesson down; the static fallback remains.
- `parsePublishedPresentation` re-validates assets and rejects one bound to another revision, one pointing at a lesson this document lacks, and one whose label misstates its provenance.
- `POST /api/v1/study/learning/courses/:courseId/presentation/assets` (new, regenerated into the Nest adapter) lets an authorized course author attach an asset. The binding fields are overwritten with authorized values, the revision must exist, and a duplicate `assetId` is a 409 rather than a silent replace.
- The reader renders an asset **after** the block it annotates, inside a dashed, provenance-labelled boundary, keeping the canonical block visible.

**Verified in the browser** (`reports/evidence/batch3/structured-asset.json`, `structured-asset.png`):

| Observation | Value |
| --- | --- |
| Assets rendered | 1 |
| Provenance attribute | `deterministic_demo` |
| Label | "Demonstration content" |
| Interactive walkthrough mounted | yes |
| Canonical `CodeViewer` still present | yes |
| Live interaction | stepping Next → "Line 3: Creates a TCP socket." |
| Lesson with no asset | 0 asset nodes, static content intact |

Canonical content was never mutated: assets live in their own collection and are an additive projection.

### 3.4 What this is not

Not an AI planner. Not a content-generation pipeline. No model was called. No asset is derived from a PDF by this milestone.

---

## 4. Image dimensions and layout shift

**Gap from Batch 3:** crop images had no reserved dimensions; measured CLS reached 0.0738 on a 60-image lesson.

**Fix:** `crop-aspect.ts` derives an aspect ratio from the detector's validated `bbox` already present in `sourceMeta`, and the crop reserves that space. The box is re-checked here because a stored region may predate a contract change; a malformed or degenerate box degrades to "no reservation" rather than a broken layout. Implausible ratios (beyond 0.05–20) are refused.

| Metric | Before | After |
| --- | --- | --- |
| CLS, 60-math-image lesson | 0.0738 (worst), 0.0522 | **0.0167** |
| CLS, ordinary math lesson | 0.006 | 0.006 |
| Images requested on open | 20 / 60 | 17 / 61 |
| All images fetched eagerly | no | **no** |
| `loading="lazy"` share | 42/43 | 45/46 |
| DOM nodes (stress lesson) | 1 566 | 1 628 |

CLS fell **77%** with no change to the fetch strategy. Lazy loading is intact: images are still not all fetched on open.

**Not measured with the real source-crop route**, because that route needs the AI service. The ratio derivation is unit-tested against real detector-shaped boxes; the end-to-end figure uses fixture boxes.

---

## 5. Accessibility measurements

**Tool:** no axe installable (registry network denied: `E403`, `registry.npmjs.org:443` denied). The measurements below are computed-style measurements in a real browser at 1440×1000 with `reducedMotion: "reduce"`, sampling every element that directly owns visible text inside the article. This is a **measurement, not a WCAG conformance audit**, and no certification is claimed.

### Automated contrast (after fix)

| Scenario | Text samples | Failures | Worst ratio (required 4.5) |
| --- | --- | --- | --- |
| math-read | 79 | **0** | 5.48 |
| engineering-read | 49 | **0** | 5.48 |
| prose | 15 | **0** | 5.48 |

### Defect found and fixed

The first run failed on the engineering lesson: the process-step number badges ("1", "2", "3") measured **3.05:1** — `text-primary` (#7b3ff2) on a 10 % violet wash. That is below the 4.5:1 text threshold, and the step number is text, not decoration. Fixed to the lighter `brand-violet-soft` token on a bordered violet wash; re-measured at **0 failures across all three scenarios**.

### Touch targets

0 elements below 24 × 24 CSS px across all three scenarios (threshold from WCAG 2.2 SC 2.5.8).

### Reduced motion

0 infinite CSS animations and 0 transitions longer than 0.4 s inside the article, with `prefers-reduced-motion: reduce` emulated.

### Manual keyboard checks (unchanged, re-verified)

Focus reaches the lesson heading on navigation; mode toggles reflect `aria-pressed`; sliders focus with a visible ring; walkthrough and topology respond to keyboard; `Escape` closes overlays and restores focus; no trap observed.

### Still not tested

Screen-reader session (no AT available), production-build contrast, and 200 % zoom / reflow. Automated contrast covers only elements this script sampled.

---

## 6. Regression results

| Suite | Before 3.6 | After 3.6 |
| --- | --- | --- |
| Web Vitest | 180 / 26 files | **187 / 27 files** |
| API Jest, `modules/study` non-integration | 279 / 27 suites | **315 / 28 suites** |
| Web `tsc --noEmit` | pass | **pass** |
| API `tsc -p tsconfig.check.json` | pass | **pass** |
| API `tsc` build | pass | **pass** |
| Web `next build --webpack` | pass | **pass**, both routes emitted |
| Study integration suites | 3 blocked | **3 blocked** (unchanged) |

New tests: 32 structured-asset contract tests, 3 presentation-document asset-binding tests, 7 crop-aspect tests.

**No existing assertion was weakened.** The three blocked suites are unchanged in count and cause (MongoDB unreachable in `beforeAll`).

Historical V1/V2 documents, source region identities, canonical checksums and FAISS artifacts were not modified; no ingestion or detector code was touched.

---

## 7. Security negative cases

Verified at contract and unit level (live HTTP blocked):

| Case | Result |
| --- | --- |
| Unknown schema/registry version | rejected |
| Component outside the asset set | rejected |
| Payload component mismatch | rejected |
| Markup in a payload string | rejected |
| Annotation outside code range | rejected |
| Non-advancing annotations | rejected |
| Dangling topology link | rejected |
| Duplicate node id | rejected |
| Oversized payload | rejected (not truncated) |
| Position outside canvas | rejected |
| Untrusted fallback | rejected |
| Extra/unknown key | rejected |
| Malformed course id | rejected |
| Source refs claimed without source derivation | rejected |
| Source derivation without source refs | rejected |
| Forged review on non-reviewed status | rejected |
| `reviewed_supplemental` without review | rejected |
| `generated_proposal` claiming review | rejected |
| Asset bound to a foreign revision | rejected at projection **and** at presentation parse |
| Asset pointing at a missing lesson | rejected at presentation parse |
| Mislabelled asset | rejected at presentation parse |
| Generated proposal reaching a learner | **never projected** |
| Representation of tampered plan | rejected (Batch 3, unchanged) |
| Relabelled unreviewed formula | rejected (Batch 3, unchanged) |

Not tested live: unauthorized/ineligible actor, cross-course access, crop authorization denial, tampered checksum against the real API. Those require the blocked stack.

---

## 8. Outstanding limitations

1. **Real-service integration remains BLOCKED.** This is the single largest open condition. It cannot be closed on this machine.
2. **Three components remain unrendered from canonical content:** still no canonical source for `InputOutputExample`, `CodeComparison`, `ArchitectureDiagram`, `AnnotatedDiagram`, `NetworkTopology`, `Timeline`. The contract now exists; the data does not. The reader keeps the static fallback.
3. **No screen-reader session and no axe run.** Contrast and touch targets are measured; conformance is not certified.
4. **CLS measured on fixture boxes**, not the live crop route.
5. **No production-build browser profiling**, no Lighthouse.
6. **Asset write path is untested against a live database** — unit-validated, route-generated, but no integration test ran.
7. **`generated_proposal` assets are stored but never shown.** There is no review workflow yet to promote one; that is Batch 4 scope and was deliberately not built.
8. **Batch 2 independent mathematical certification remains BLOCKED** and is not affected by this milestone.

---

## 9. Decision

**CONDITIONAL GO.**

All core safety and functional requirements that *can* be validated here pass: contract strictness, provenance integrity, authorization shape, fallback behaviour, determinism, contrast, touch targets, reduced motion, and the full regression suite. Two real defects were found by measurement — a contrast failure and a 77 % layout-shift regression — and both were fixed and re-measured.

The condition is singular and unchanged in nature: **the real-service leg has not run, and no acceptance of authorization, integrity or the live reader is claimed until it does.** A GO would require MongoDB, RabbitMQ, the Python AI service, ingestion and formula workers, FAISS and a disposable database, on a machine with Docker access, and the existing `final-acceptance` and publication integration suites green.

Not deployed. Batch 4 not started.

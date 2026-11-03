# EdNova Batch 2 — Detector V2 end-to-end acceptance and release candidate

Date: 2026-11-03. Scope: acceptance validation of the completed Mathematical Region Detector V2 against the complete application. No detector redesign, no new recognition model, no new live Gemini call, no Batch 3 work, no production data modification.

**Recommendation: CONDITIONAL GO for Batch 2's technical implementation as a release candidate.** The versioned end-to-end workflow, structural extraction fidelity and historical compatibility all pass against the real application. Two gates remain open and prevent an unconditional GO: independently verified mathematical accuracy (BLOCKED — zero qualified independent approvals) and production deployment readiness (PARTIAL — no deployment, load or rollback drill; live provider certification BLOCKED). Nothing in this report equates structural classification with mathematical verification.

## 1. Versioned end-to-end integration — PASS (Gemini SDK replay only)

The reference mathematics PDF (SHA-256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`) was re-ingested through the real isolated QA harness (`playwright.final.config.ts`): real BetterAuth instructor session, real Nest API (port 5361), real Python AI service (port 5362, containerized, `apps/ai` mounted read-only so the uncommitted V2 detector is the code under test), separate Python ingestion worker, separate Node recognition worker, real RabbitMQ vhost and MongoDB database (`test_formula_final_<ts>`, dropped by owned teardown), real FAISS construction. Only the Gemini SDK is mocked (`tests/final_acceptance_app.py` replays previously authorized offline outputs keyed by crop hash; the fake credential `isolated-qa-never-sent` raises on any non-QA use; `EDNOVA_FINAL_QA=1` + `test_formula_final_` DB-name guards fail closed).

Observed on the live run (evidence regenerated at [application-run.json](evidence/batch2-final/application-run.json)):

| Workflow stage | Result |
| --- | --- |
| Authenticated upload (`POST /api/v1/study/courses`, 202) | PASS — original bytes retained, manifest hash equals file SHA-256 |
| Python extraction with V2 (`courses.ts` passes `'2.0'`; `_page_regions_v2` inside the unchanged 45 s / 512 MiB / 2000-page sandbox child) | PASS — 2 chapters / 16 lessons, published source spans contain exactly **85 distinct V2 math region ids** (matches the detector census) |
| Canonical construction | PASS — schema 1.0.0, no `f′ = f` title regression |
| Draft source inspection (Studio formula workspace) | PASS — V2 region ids selectable, source geometry = V2 bboxes (e.g. eq-000 `[263.76, 384.24, 322.23, 418.8]`) |
| Mathematical recognition job ×3 (real HTTP boundary, budgets, worker) | PASS — all `completed`, dispatch count 3, budget used 3 |
| Proposal persistence | PASS — correction/accept/reject states persisted and audited |
| Instructor review + acknowledgement + immutable publication | PASS — `rev_formula_2edd1e5cde51a6c6a03a00122d85e597` committed; approved route HTTP 200 |
| Revision-specific FAISS indexing | PASS — 26 indexed chunks, `formula_review` metadata present for reviewed units |
| Enrolled-student reader | PASS — 2 KaTeX reviewed formulas, unverified-transcription caption, rejected-region fallback image loads (exact rejected region id, not an arbitrary image) |
| Original PDF source inspection | PASS — inspector crop image loads; "Open original" downloads byte-identical PDF (`Buffer.compare` = 0) |
| Authorization negatives | PASS — uncredentialed internal AI request → 401; outsider source request → 403 |

**Integration finding (fixed during this acceptance):** the E2E spec and QA replay mapping referenced two **stale intermediate V2 region identities** — `region_2fdfbbe92bff6db427e9` (eq-001) and `region_434492347d5b2247384e` (eq-017) — which the final detector never produces (current identities: `region_66ae1f964f8407b30376`, `region_aec9301c4a673be7a909`, verified by running the exact `_document_regions` → `regions_from_pages([page])` pipeline path). Both fixture references were refreshed to the current identities with test intent unchanged (correct/accept/reject selection, eq-001 expanded-crop assertion ≥ 210 px). No expectation was weakened; this was identity drift between the spec authoring time and the final detector.

**Non-mathematical document — PASS (bounded).** The authored two-page networking fixture traversed the same real ingestion → approval → prepare → publish → reader path in the same run (4.9 s): code indentation preserved (`\n    if sequence < 0:`), pipe-table cells exact, captioned diagram image loads, misleading "verified" language absent ([networking-run.json](evidence/batch2-final/networking-run.json)). It remains an authored fixture, not an independent real-world corpus.

## 2. Region fidelity — structural acceptance PASS, mathematical verification still open

Independently inspected (fresh renders from the original PDF at the V2 geometry, separate from reading detector text):

- **eq-001 (p1):** the V2 crop `[239.85, 450.51, 346.14, 485.3]` contains the complete final summand `uₚ.`; the V1 crop `[239.85, 451.26, 330.29, 485.3]` visibly clips it. Verified twice: independent PyMuPDF render and the live reader crop endpoint (PNG ≥ 210 px, 200 OK for the enrolled student).
- **eq-084 (p20):** the band `[187.87, 123.48, 398.12, 165.02]` now contains only the display derivation `F(0) = ∫₀^+∞ 1/(1+t²) dt = [arctan(t)]₀^+∞ = π/2 ·` (flagged `math_band_split`); the wrapped sentence `On a donc, ﬁnalement, F(x) = π 2 e−|x|.` is its own paragraph flagged `math_inline_mixed`. Integral, explanatory prose and concluding formula are separated without loss.
- **Page 17 (`[81.86, 351.26, 199.55, 377.56]`, `math_boundary_extended`):** the integrand row `f(x, t)dt` is inside the crop; independent render shows `F(x) = ∫^+∞ f(x, t)dt`. Note: the extension's upper edge touches the "Définition 4.2.3" heading line — flagged for review, not silently absorbed into text.
- **Page 19 (`[192.05, 173.8, 390.92, 210.23]`, `math_boundary_extended`):** complete `∫₀^+∞ |cos(tx)/(t²+1)| dt ≤ ∫₀^+∞ 1/(t²+1) dt < +∞` including the previously clipped `dt < +∞` right edge.
- **Mixed/ambiguous flags persist in the live artifacts:** V2 grouping census 28 `single_expression` / 36 `multiline_derivation` / 13 `structurally_ambiguous` / 8 `mixed_prose`; flag census: 9 `math_absorbed_fragment`, 5 `math_band_split`, 5 `math_boundary_extended`, 12 `math_grouping_ambiguous`, 8 `math_prose_contamination`. Minor traceability gap: one p19 region (`region_90f3a58e942685334d75`) carries the `structurally_ambiguous` **label** via merge combination (`_combine_math_grouping` correctly keeps the weakest label) without the `math_grouping_ambiguous` **issue flag** — the review-routing label is conservative and correct; only the issue list omits the flag.
- **Cross-service identity consistency:** the same V2 ids and crop hashes resolved across Node manifest → Studio workspace → Python recognition transport → published reader crop routes in the live run; `test_region_crop.py` (10 tests, passing) additionally rejects forged manifests, foreign regions and invalid geometry, and proves the context view is opt-in while the exact recognition crop is unchanged.

**Inline mathematics in paragraphs remains accessible:** three paragraphs carry `math_inline_mixed` (p12 continuity conditions, p18 exercise instruction, p20 concluding formula); their text survives verbatim (see §4) and paragraphs remain first-class reader/source units after the display-band splits.

## 3. Historical compatibility — PASS

| Check | Result |
| --- | --- |
| V1 published revisions resolve their original regions | PASS — fresh V1 output is value-identical to the committed-HEAD golden baseline; merged V1 stays 510 regions / 85 math; ids deterministic. Manifest resolution re-derives through each document's own `extractionVersion` |
| Proposal and review hashes remain valid | PASS — 34 targeted Jest tests (publication/jobs/proposal/reader/canonical) + M08 publication suite (8) + live browser review finalization with crop-hash binding |
| Previous canonical and FAISS artifacts unchanged | PASS — publication integration suite asserts prior canonical content and exact `.faiss`/`.meta.json` bytes remain unchanged; M08 rerun 2026-11-03 passed |
| New V2 revisions never resolve through V1 geometry | PASS — identity salt (`"v2\x1f"`) keeps id sets disjoint (`test_v2_identity_is_stable_and_version_salted`); mixing versions in a manifest raises `ValueError`; the live run resolved crops only through V2 identities |
| Version-specific manifests and crop requests use matching algorithms | PASS — `revision_artifacts.py` validates `extractionVersion ∈ {1.0, 2.0}` at every entry point and threads it into the matching extractor; `test_manifest_version_resolves_legacy_and_v2_independently` proves independent resolution and old-manifest stability |

## 4. Content preservation — PASS (no silent discards)

Full re-verification on 2026-11-03: all **617** non-empty V1 lines (raw sandbox and merged layout alike) survive verbatim inside one V2 line — **0 missing**, on both the raw sandbox output and the merged layout. All 85 historical math regions map to exactly one V2 math region by maximal overlap; one new V2 math region (p14 band-split segment) is explicitly recorded as unmapped rather than hidden. Split-out prose survives in its own paragraph regions in original reading order.

## 5. Independent review preparation — PASS as preparation; approvals remain absent

The existing 16-case package was validated, not fabricated: 16/16 cases in `review-package.json`, `dataset.json` and `decisions.template.json`; every case's `source_sha256` matches the reference PDF; every original crop and page image exists; 16/16 provisional transcriptions present; **all reviewer fields, decisions and dates are `pending_review`/`null` — no approval was invented or transferred**. The V2 census maps all 16 named cases and 85/85 historical regions ([review package](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/detector-v2/index.html), regenerable without model calls).

**Mathematical fidelity metrics that still cannot be calculated** (zero adjudicated labels): detection precision/recall, symbol-level accuracy, LaTeX exact-match/CER, fraction/script/limit fidelity rates, reading-order correctness, missing/invented-term rates, multiline-expression fidelity, human correction rate, and semantic retrieval relevance. These remain null — not zero, not inferred from detector counts.

## 6. Regression and security evidence

| Command / scope | Result |
| --- | --- |
| `pnpm exec playwright test -c playwright.final.config.ts` (real services, V2, SDK replay) | **2 passed** — reference math journey + networking journey |
| Targeted Jest (5 suites: publication, jobs, proposal, reader, canonical) | **34 passed** |
| M08 publication node test (fresh QA DB, dropped afterwards) | **8 passed** |
| `pnpm --filter web test` (Vitest) | **90 passed / 17 files** |
| `pnpm exec playwright test -c playwright.formula.config.ts` (Studio browser) | **4 passed** |
| Python: full `course_ingestion` suite + `test_llm_budget`, `test_sources_index_idempotency`, `test_api_runtime` | **113 passed** (incl. 13 detector-V2 tests, 10 crop tests) |
| `pnpm --filter api typecheck` / `api build` / `web typecheck` / `EDNOVA_NEXT_DIST_DIR=.next-closure-build pnpm --filter web build` | PASS (build-side `tsconfig.json` auto-append reverted; not intended work) |
| `git diff --check` | PASS |

**Security review of the V2 changes (source-boundary inspection, not an exhaustive scan):**

- No new endpoints, no dynamic execution (`eval`/`exec`/`subprocess`), file writes, or network access in the detector diff; all V2 logic is pure in-process geometry/text classification inside the existing sandboxed child (limits unchanged: 45 s wall, 512 MiB, 2000 pages).
- Expansion chains are hard-bounded (`range(24)` iterations, 14 pt hops, `min(120, 0.75 × width)` total, page-envelope clamps); all V2 regexes are linear (no nested quantifiers / catastrophic backtracking).
- `mathGrouping` values come from a fixed four-label vocabulary; the review builder HTML-escapes every interpolated value; fixture PDFs are removed from the working tree.
- QA controls fail closed: the SDK mock rejects non-QA credentials, the QA app refuses to boot outside `EDNOVA_FINAL_QA=1` + `test_formula_final_*`, and the harness rejects non-isolated DB names.
- Live authorization negatives re-verified in this run (401 uncredentialed Python route, 403 outsider source access, exact-byte PDF for the enrolled student).
- Housekeeping: the harness's own teardown left no `test_formula_final_*` databases or vhosts; pre-existing `test_formula_browser_*`/`test_formula_pub_*` QA leftovers from earlier documented runs were left untouched (disposable local dev DB; real databases `ednova`, `study_partner` untouched), and the one database created by this closure's M08 run was dropped.

## 7. Acceptance classification

| Dimension | Status | Boundary |
| --- | --- | --- |
| Technical workflow acceptance | **PASS** | Full versioned journey on real services; only SDK responses replayed |
| Structural extraction acceptance | **PASS** | Reference + 7 synthetic behavior classes; 0 content loss; flags surface every uncertain boundary |
| Independently verified mathematical accuracy | **BLOCKED** | 0/16 independently approved; all accuracy metrics null; review package ready but unadjudicated |
| Production deployment readiness | **PARTIAL / NOT TESTED** | No deployment, load/capacity test, supervision drill or rollback exercise; live Gemini eligibility/budget remains BLOCKED (no fresh authorization) |

## 8. Remaining ambiguities and conditions

1. **13 `structurally_ambiguous` and 8 `mixed_prose` regions** (plus one ambiguous-label-without-flag traceability gap on p19) route to human review by design; text-layer geometry cannot certify reading order.
2. **Generalization is proven only for the reference document and behavior-class fixtures** — not as a recall measurement over a document corpus.
3. **Independent qualified review of the 16 cases** must happen before any content is presented as verified; reviewer fields stay pending until then.
4. **Production readiness** requires the existing operational gates: live-provider eligibility/budget authorization, deployment with matching API/web/Python changes, load/supervision certification and a rollback drill.
5. Do not transfer old V1 review decisions to V2 revisions: identities are versioned and disjoint by design.

**Final decision: CONDITIONAL GO** — Batch 2's technical implementation is accepted as a release candidate on the strength of the real end-to-end, compatibility, preservation and regression evidence above. Upgrade to full GO only after a qualified independent reviewer adjudicates the prepared annotations (mathematical accuracy gate) and the production operational gates are executed. No Batch 3 work was started.

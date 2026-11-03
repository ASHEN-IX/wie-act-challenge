# Batch 2: mathematical region detector V2

**Status: versioned detector available; unverified in mathematics.** The V2 extraction (`extractionVersion` `"2.0"`) repairs *general* row-grouping defects in display-math detection — absorption of limit/script rows, separation of wrapped prose from display bands, bounded edge growth, and explicit ambiguity labelling — without any hardcoded coordinate or phrase logic. V1 (`"1.0"`) remains frozen and byte-identical for all historical artifacts. The reprocessed 16-case review package shows structural before/after evidence for every affected region. Nothing in this report is a semantic-correctness or mathematical-approval claim: all 85 math regions still require a qualified independent reviewer.

## Root causes (generalized)

All causes are in `_page_regions(page)` (the V1 row builder in `pdf_loader.py`) and are repaired only in the V2-only pass `_page_regions_v2(page)`:

1. **Script, limit and continuation rows.** PyMuPDF emits summation bounds, `lim` fragments, integrands and final summands (e.g. page 1 `lim` + final `uₚ.`) as separate small visual rows. V1 groups rows by geometry only, so those rows either become independent paragraphs or stay outside the band. V2's `_v2_absorbs_script_row` re-attaches them when the candidate has math-text evidence, a contained horizontal reach, no sentence-shaped content, and — the generalized guard — a sentence-final row is refused unless it opens with math evidence (`lim`, an integral/relational glyph run). This is a structural rule about glyph evidence, not a phrase whitelist for one PDF.
2. **Prose welded into display bands.** A display equation followed by a wrapped sentence (page 20: `On a donc, ﬁnalement, F(x) = π2 e−|x|.`; page 12 xy-condition lines) becomes one candidate band whose prose stays inside the math text. V2's `_v2_split_math_bands` reclassifies every row inside a math region with sentence-shaped lexical evidence (sentence-ending run, wide flowing run, left-margin sentence start, or a sentence continuation after an already-prose row, e.g. `2 e−|x|.`) and emits prose rows as separate paragraph regions in original reading order. A paragraph that retains formula cues receives `math_inline_mixed`; the remaining math rows receive `math_band_split`. No row text is dropped or reordered silently.
3. **Clipped band edges.** V1 never grows a band, so partial glyph chains and half-emitted integrand rows leave symbols outside the region bbox. V2's `_v2_expand_over_math_glyphs` grows band edges only through neighboring math-font glyph boxes whose vertical share of the band reaches 40%, one bounded hop (14 pt) at a time, total growth capped at `min(120, 0.75 × width)` pt (56 pt floor), clamped to the page envelope, and reported as `math_boundary_extended`.
4. **Same-baseline ambiguities.** Nested limit rows and partially overlapping rows share a visual baseline but are separate row boxes. V2 refuses to resolve their reading order: any such pair (centre distance ≤ 4 pt) labels the band `structurally_ambiguous` with `math_grouping_ambiguous`.
5. **Mixed bands.** A prose row inside a band (≥ 4 words in a base row) labels the band `mixed_prose` with `math_prose_contamination` rather than silently accepting or discarding it.

Grouping labels: `single_expression`, `multiline_derivation`, `mixed_prose`, `structurally_ambiguous`. Structural issues introduced: `math_band_split`, `math_boundary_extended`, `math_absorbed_fragment`, `math_prose_contamination`, `math_grouping_ambiguous`, `math_inline_mixed`. Every math region additionally carries `math_boundary_unverified` and `math_reading_order_unverified`, because text-layer order is not certified.

## Versioning and compatibility

- `extract_pages_from_pdf_sandboxed(path, extraction_version=...)` selects the pass: `"1.0"` runs the frozen V1 builder, `"2.0"` runs `_page_regions_v2`; unknown versions raise.
- Layout identity hashes are salted with `"v2\x1f"` for V2, so V1 and V2 region identities never collide: identical page content resolves distinct versioned ids (`test_v2_identity_is_stable_and_version_salted`, `test_manifest_version_resolves_legacy_and_v2_independently`).
- Manifest digests change with the version, and `source_regions` resolves each document's regions from its own version's ids — historical revisions and FAISS vectors keep resolving through V1 identities, untouched.
- [courses.ts](../apps/api/modules/study/src/routes/courses.ts) passes `'2.0'` for new ingestion; the `/region-inspect`/`/region-crop` cropHash endpoints used for review verification are unchanged; the legacy `crops/eq-*.png` files were not rewritten (V2 crops live in `review/detector-v2/`).
- **V1 freeze verified:** fresh V1 sandbox output is value-identical to the committed HEAD baseline captured earlier via a stash round-trip (`/tmp/opencode/v1_committed.json`), merged V1 is still **510 regions / 85 math**, and all ids are deterministic across reruns.

## Reprocessed reference (20-page course PDF, sha256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`)

- Merged layout census: V1 **510 / 85 math** (frozen invariant, unchanged), V2 **502 / 85**. Raw sandbox: V1 513/88, V2 506/89.
- V2 grouping census (85 math): `single_expression` 28 · `multiline_derivation` 36 · `structurally_ambiguous` 13 · `mixed_prose` 8.
- **No V1 content loss:** every non-empty V1 line was checked for verbatim survival inside one V2 region line, both on the raw sandbox output and on the merged layout — 0 missing lines. All 85 historical math regions map to exactly one V2 math region by maximal overlap; one new V2 math region (page 14 `region_af54b2c790cfed87f8d7`, the band-split segment carrying the `∀t ∈ [a, b], … ⇒ |g(x, t) − g(x₀, t)| ≤ ε|x − x₀|.` predicate) has no historical counterpart and is recorded in the census under `unmapped_v2_math`.
- Structural assessment census of the 85 mapped regions: `complete` 63 · `ambiguous` 13 · `mixed` 9 · `clipped` 0 · `review` 0. These are structural observations for review triage, not approvals.

[Review package (16 named cases + full census, regenerated)](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/detector-v2/index.html) with contact sheets `contact-v2-0..3.png`. Rebuild: `PYTHONPATH=apps/ai python apps/ai/agents/course_ingestion/extraction/benchmarks/formula/build_detector_v2_review.py` (no model calls).

## Before/after on changed regions (19 of 85)

Full text evidence is in [census.json](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/detector-v2/census.json) (`changed: true`) and the contact sheets. "preserved" refers to the mapped region's own text after splitting; split-out prose survives in its own paragraph region (verified line-level, see above).

| Page | Historical id | Case | V1 bbox | V2 bbox | V2 grouping | Structural issue |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | `region_22d55ef3c62c7aefa2da` | eq-000 | [263.76, 384.76, 322.23, 418.8] | [263.76, 384.24, 322.23, 418.8] | single_expression | math_absorbed_fragment |
| 01 | `region_42116d94dec3d2a81d58` | eq-001 | [239.85, 451.26, 330.29, 485.3] | [239.85, 450.51, 346.14, 485.3] | multiline_derivation | math_absorbed_fragment |
| 01 | `region_84094eabebe8648865da` | eq-002 | [170.97, 626.61, 415.02, 660.24] | [170.97, 625.51, 415.02, 660.24] | multiline_derivation | math_absorbed_fragment |
| 03 | `region_283a8011a0e31e17f904` | — | [249.49, 349.19, 336.5, 371.91] | [249.49, 348.67, 336.5, 371.91] | single_expression | math_absorbed_fragment |
| 04 | `region_76765c6249290c3b8651` | eq-017 | [230.66, 173.09, 409.1, 206.71] | [230.66, 165.43, 409.1, 206.71] | structurally_ambiguous | math_absorbed_fragment, math_grouping_ambiguous |
| 05 | `region_10ca1a3f2d2237f71378` | — | [190.96, 119.24, 395.03, 153.28] | [190.96, 118.14, 395.03, 153.28] | structurally_ambiguous | math_absorbed_fragment, math_grouping_ambiguous |
| 05 | `region_941c933c5cd02e661704` | — | [72.5, 321.9, 317.64, 362.2] | [72.5, 313.04, 317.64, 362.2] | multiline_derivation | math_absorbed_fragment |
| 07 | `region_c8cb92fea5fd19b214d7` | — | [146.76, 490.71, 324.86, 530.56] | [146.76, 490.71, 368.76, 530.56] | multiline_derivation | math_boundary_extended |
| 08 | `region_5b8717234e9e125a3b4e` | — | [194.18, 596.52, 241.99, 609.07] | [194.18, 596.52, 260.66, 609.07] | single_expression | math_boundary_extended |
| 10 | `region_be46fbfe15dea91c93e0` | — | [254.53, 188.16, 325.11, 214.19] | [254.53, 188.16, 331.46, 214.19] | single_expression | math_boundary_extended |
| 12 | `region_65ef032bbef3beea2fae` | — | [88.86, 308.15, 484.51, 401.93] | [134.21, 308.15, 484.51, 343.62] | multiline_derivation | math_band_split |
| 14 | `region_966e44b2051e21ee7375` | — | [72.5, 261.26, 491.81, 323.23] | [72.5, 261.26, 491.81, 355.75] | mixed_prose | math_absorbed_fragment, math_prose_contamination |
| 14 | `region_da0103f7e8181c793dbe` | — | [283.5, 320.28, 399.56, 355.75] | [72.5, 261.26, 491.81, 355.75] | mixed_prose | math_absorbed_fragment, math_prose_contamination |
| 14 | `region_40dcacee49a46f3b3498` | — | [72.5, 491.2, 450.31, 557.27] | [151.4, 521.81, 434.6, 557.27] | multiline_derivation | math_band_split |
| 17 | `region_1d25fbaa39d3d236393e` | — | [81.86, 351.26, 145.62, 377.56] | [81.86, 351.26, 199.55, 377.56] | single_expression | math_boundary_extended |
| 18 | `region_4f2ceff848d48e9bcabb` | — | [72.5, 565.08, 334.62, 610.12] | [72.5, 557.97, 334.62, 610.12] | mixed_prose | math_absorbed_fragment, math_prose_contamination |
| 18 | `region_494b73067ee1aef37ae3` | eq-079 | [72.5, 704.17, 513.49, 750.21] | [72.5, 704.17, 513.49, 750.21] | mixed_prose | math_band_split, math_prose_contamination |
| 19 | `region_2866ae5d7f5d27ac41b5` | — | [198.11, 173.8, 335.17, 210.23] | [192.05, 173.8, 390.92, 210.23] | multiline_derivation | math_boundary_extended |
| 20 | `region_41d94453246492aa5bcc` | eq-084 | [72.5, 123.48, 398.12, 191.19] | [187.87, 123.48, 398.12, 165.02] | multiline_derivation | math_band_split |

Representative evidence, verified visually on the contact sheets against the full pages:

- **eq-001 (regression case, p1):** V1 text `∑ un =\nn→+∞ n=0 p=0` clipped the final summand; V2 text `n\n+∞ lim up.\n∑ un =\nn→+∞ n=0 p=0` — the `lim` fragment and final `uₚ` (to x=346.14) are absorbed into the band and labelled `math_absorbed_fragment`, grouping `multiline_derivation`.
- **eq-084 (p20):** the wrapped sentence `On a donc, ﬁnalement, F(x) = π2 e−|x|.` left the band (V2 bbox now [187.87, 123.48, 398.12, 165.02]) and appears as its own p20 paragraph `On a donc, ﬁnalement, F(x) = π 2 e−|x|.` flagged `math_inline_mixed`.
- **p19 integral `[192.05, 173.8, 390.92, 210.23]`:** the right edge now reaches the `dt <+∞` chain instead of cutting at `1/t² +`. Sheet-verified against the page.
- **p17 def-4.2.5 `[81.86, 351.26, 199.55, 377.56]`:** `math_boundary_extended` reaches the integrand row; still `single_expression`.
- **eq-083 (p19):** unchanged crop; the bottom `F″(x).` row stays and the band is labelled `structurally_ambiguous`.
- Sixteen named cases resolve to structural states (10 `complete`, 5 `structurally_ambiguous`, 1 `mixed_prose`); eq-017 gains absorbed limit rows and eq-084 the wrapped-prose split; all historical lines survive, and none is approved mathematically.

## Synthetic regression tests

`tests/test_math_detector_v2.py` builds deterministic single-decision pages (`fitz`, no fonts, no model calls) and asserts structure only:

- `absorb` — a `lim up.` fragment row above the display band joins it (`math_absorbed_fragment`), while V1 keeps it prose-classified.
- `split` — a wrapped sentence across a display band is split out (`math_band_split`, `math_inline_mixed`, original order) and loses every welded-prose property of V1.
- `mixed` — a prose row inside a band yields `mixed_prose` + `math_prose_contamination`.
- `ambig` — same-baseline rows yield `structurally_ambiguous` + `math_grouping_ambiguous`.
- `multi` — stacked math rows group as one `multiline_derivation` with no grouping warning.
- `sep` — expressions around prose stay separate, ordered by reading order, and explicitly unverified.
- `edge` — a band at the right page edge is bounded by the page rect (x1 239.5 ≤ 240).
- Unit checks for `_v2_expand_over_math_glyphs`: chaining within the cap, refusal without a vertical envelope, refusal of a single hop beyond the limit.
- Identity: deterministic repeated ids on the same content; version salt keeps V1 and V2 id sets disjoint.

## Test log (venv `/tmp/ednova-b2-venv`, `PYTHONPATH=apps/ai`, no Gemini calls)

- `test_math_detector_v2.py` — **13 passed** (3 reference + freeze + manifest + identity + expand unit + 7 synthetic).
- Full course_ingestion suite — **100 passed**.
- Focused rerun: `test_pdf_sandbox`, `test_region_crop`, `test_formula_review_package`, `test_ocr_sandbox`, `test_multimodal_extraction` — **40 passed**.
- V1 freeze re-verification after all detector changes: raw V1 value-identical to committed baseline, merged V1 510/85, 0 line-level content loss (raw and merged), ids deterministic. V1 also re-verified from the working tree against the HEAD output captured via a stash round-trip, so the frozen output is committed-code reproducible.
- `git diff --check` — clean. Detector changes remain uncommitted on top of `61d433e` ("fast push").

## Unresolved and explicit limitations

- **No semantic claims.** Grouping labels and completeness assessments are structural; a correct-looking bbox does not prove a correct formula. All regions keep `math_boundary_unverified` + `math_reading_order_unverified` and the review package leaves reviewer fields empty; the independent decision template is untouched.
- **Ambiguity is unresolved by design:** 13 regions stay `structurally_ambiguous` (same-baseline limit runs) because text-layer geometry cannot certify reading order. They route to human review.
- **Mixed bands:** 9 regions remain `mixed_prose` — French prose and formulas genuinely share the band structure (e.g. p14 "Or" narrative, p18 exercises); V2 separates what is separable per row and flags the rest. eq-079's partial annotation stands as-is.
- **One new math region** (p14 `region_af54b2c790cfed87f8d7`) appears through a band split with no V1 counterpart; its quantifier-heavy text is explicitly flagged and non-mapped so reviewers see it.
- **Unchanged from V1 by evidence, not by approval:** eq-005, eq-006, eq-008, eq-010, eq-039, eq-045, eq-047, eq-054, eq-063, eq-083, and case eq-017's residual structure still require review; generalization to other PDFs is asserted only through the synthetic fixtures, which prove behavior classes, not recall.
- **No recall/precision metric** was or could be produced here; the synthetic fixtures are behavior-class regressions, and OCR/pix2tex/model paths are untouched (no new Gemini calls).
- Glyph-repair transparency is unchanged: sandboxed CMap rewrites and per-page `glyphRepairs` reports remain in place.

# Batch 2: mathematical source-region remediation

**Status: partial remediation; NO-GO for complete mathematical fidelity.** The student-facing contextual crop now includes the previously clipped final summand in `eq-001`, while the original detector geometry, region IDs, exact recognition crop and published artifacts remain intact. The detector's plain-text reading order and general region grouping have not been repaired, and other source crops remain visibly incomplete. There are no independently approved formula annotations.

## Root cause and evidence

The source is the 20-page reference PDF, SHA-256 `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`. On page 1, `_merge_visual_rows` creates separate overlapping visual rows: the detected math region `[239.85, 451.26, 330.29, 485.30]` contains the sums and limits, while a separate row containing `lim` and the final summand is classified as a paragraph. The source glyph boxes put `u` at x=332.1–338.4, its subscript `p` at x=338.4–342.6, and punctuation through x=346.14. They are outside the math region's right edge; the old four-point image padding reaches only x=334.29. This is a row grouping/classification boundary defect; adding a fixed page-wide margin would include unrelated material and does not repair the source text.

[Original source page](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/pages/page-01.png) · [old padded crop](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/crops/eq-001.png) · [new context view](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/remediation/eq-001.png) · [earlier provisional expanded candidate](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/corrected/eq-001.png). The new contextual bounds are `[239.85, 451.26, 347.14, 485.30]`; the visible final `uₚ` and punctuation are now inside that view. This is an image-boundary observation, not independent mathematical approval.

## General correction and compatibility

`pdf_loader.py` now supplies an opt-in, sandboxed `math_context` crop. Within the original vertical band, it looks for adjacent glyph boxes in mathematical fonts, follows a gap of at most three PDF points, grows at most 24 points per horizontal edge and stops after 12 glyphs, clipping to the source page. A one-point margin is added only on a side actually extended. It does not infer formula semantics or certify completeness. The reader's protected published-region route opts into this context view; the caption warns that source material can still be missing and points to the original PDF. Figure crops retain their previous behavior.

The original detector output, region types, text, bbox and ID algorithm remain unchanged. The exact view remains the default for `/region-crop`, and `/region-inspect` forces that exact view even if a context view is requested. Existing recognition and instructor review crop hashes therefore continue to identify the original image; the enlarged reader context is a separate display view, not the reviewed crop. The source PDF, published canonical data, revision IDs and indexes are not migrated or regenerated. All 16 historical fixture region IDs and geometries resolved against the new extraction. The public reader URL now presents a bounded contextual image for math, so its displayed pixels may differ from older deployments; that image must not be substituted for a prior proposal's exact crop hash. No split, merge or region ID change was introduced by this remediation.

This is a **display-context correction**, not a complete correction of the underlying region grouping: `eq-001`'s source region bbox and deterministic text still omit the separate row. The change deliberately avoids silently rewriting old region identity or source text. A future extractor version needs a separately versioned region mapping, prior-version resolution and explicit immutable-revision behavior before changing the primary grouping. Source inspection already offers the original PDF when the context view is incomplete.

## Sixteen benchmark cases

[Review all old and new crops, page links, geometry, provisional transcriptions and warnings](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/remediation/index.html). The old padded fixture is preserved; new crops show the exact display-context bounds and may omit old padding. The decision template remains untouched, with no invented reviewer identity. Rebuild the package using `PYTHONPATH=apps/ai python apps/ai/agents/course_ingestion/extraction/benchmarks/formula/build_region_remediation.py`.

| Case | Context-bound change | Remaining source-review concern |
| --- | --- | --- |
| eq-000 | No expansion | Scripts and sum bounds still require review. |
| eq-001 | Right edge 330.29 → 347.14 | Final summand recovered in context view; detector text and identity remain old. |
| eq-002 | No expansion | Mixed quantifiers and French prose; source reading order still uncertain. |
| eq-005 | No expansion | Old padded crop has preceding-line contamination; narrow view is not a completeness guarantee. |
| eq-006 | No expansion | Integral and neighboring line need visual review. |
| eq-008 | No expansion | Long multistep derivation and surrounding text require review. |
| eq-010 | No expansion | Multiple expressions grouped in one region; hierarchy unresolved. |
| eq-017 | No expansion | Fraction/limit structure and neighboring lower-edge prose require review. |
| eq-039 | No expansion | Fraction and connective remain unverified. |
| eq-045 | No expansion | Neighboring prose and integral boundaries remain uncertain. |
| eq-047 | No expansion | Mixed quantifiers and prose remain unverified. |
| eq-054 | No expansion | Nested fraction and evaluation bounds remain unverified. |
| eq-063 | No expansion | Integral bounds and nearby marks remain unverified. |
| eq-079 | No expansion | French instruction and multiple expressions; annotation is explicitly partial. |
| eq-083 | No expansion | Multiline derivation and sign/order fidelity; annotation is partial. |
| eq-084 | No expansion | Separate expressions and prose remain grouped. |

## Full mathematical census and reading order

The actual sandboxed Python extraction reprocessed all 20 pages and identified **85 math regions**. The bounded glyph rule expanded **two** source views: `eq-001` and page 19 `region_2866ae5d7f5d27ac41b5`. All region IDs and primary bbox values were left unchanged. [Census records](../apps/ai/agents/course_ingestion/extraction/benchmarks/formula/review/remediation/results.json) include every region and bounds; five contact sheets in the same directory provide an overview. A visual overview found obvious remaining clipped or mixed regions, including the right side of that page-19 integral and multiple incomplete page-17 formulas. Small contact-sheet inspection is not a complete symbol-level audit or a detection recall measurement.

No deterministic plain-text mathematical reading-order algorithm was changed. The `eq-001` context image restores visual ordering to the reader, while the plain text still misorders summation limits and omits the final summand. Fractions, subscripts, integral limits, multiline work and mixed prose remain unverified. Every detected math region continues to require review, and users can inspect the original page. We do not claim that a correctly bounded image proves a correct formula or that all nearby prose has been excluded.

## Independent review checklist

For each of the 16 entries, a qualified instructor should compare the old and new images with the complete original PDF page; check whether crop edges omit symbols, bounds, superscripts or neighboring equation rows; identify included prose and separate equations; check symbol and fraction/limit order against the provisional transcription; correct the transcription and bbox where appropriate; and record accept, correct or reject, reviewer and date in the existing decision template. No entry was independently approved by this implementation.

## Regression evidence

- The exact-source crop test checks that page-1 `eq-001` reaches x=346.14, remains on-page, does not extend into the next paragraph vertically, produces a valid PNG and leaves the exact legacy crop unchanged.
- The opt-in endpoint test verifies the contextual view and that `region-inspect` forces exact cropping for recognition hashes, even when a context view is requested.
- All 16 legacy IDs, page numbers and bboxes were verified against fresh extraction. These checks prove identity/geometry compatibility for this reference fixture, not all historical PDFs or semantic correctness.
- Focused extraction/canonical/semantic/source-crop tests passed (34 before additional compatibility assertions); source-crop and formula-job transport rerun passed 20. The reader registry suite passed 7 tests and API typecheck passed. The real-service browser integration result is recorded below.

## Remaining acceptance blockers

The global no-clipping criterion remains **FAIL**; mathematical reading order, prose separation and semantic completeness remain **PARTIAL**. No independently qualified labels exist and no general accuracy or recall score is justified. The page-19 and page-17 clipping observations require further geometry work and review. Subject-diverse documents, scanned pages, RTL text and deployment-scale resource costs are not covered by the 16-case corpus. Full Batch 2 acceptance remains **NO-GO**; no Gemini calls, published revision changes or Batch 3 work were performed.

The isolated full-service browser suite passed **2/2** after the display-context change, covering real upload/ingestion, authenticated Node-to-Python traffic, publication, enrolled-student and outsider source access, and the authored networking fixture. Gemini SDK output was replayed; no Gemini call was made. The focused source-crop/formula-job suite after the exact-view safeguard passed **20 tests**. `git diff --check` passed.

The additional crop-only regression suite passed **10 tests**, including a synthetic page-edge and ordinary-prose-font case. The `view` request field is an additive internal API contract, but an older AI service that rejects unknown fields cannot serve the updated Node reader route; deploy and roll back matching Node and AI versions together. No mixed-version deployment was tested.

A further focused real-service reference run passed **1/1** after adding an explicit enrolled-student request for the historical `eq-001` region. It checked a successful authorized PNG response and the expanded image width, in addition to the existing publication, rejected/unresolved fallback and outsider-access assertions. The Python glyph test checks the original final-summand coordinates; image width alone does not establish semantic completeness.

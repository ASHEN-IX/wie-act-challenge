# EdNova — Batch 2: Multimodal Extraction Implementation and Validation

Date: 2026-11-02. Status: implemented incremental extraction and review safeguards; **full high-fidelity acceptance remains unmet**. Stop here for independent architecture review before Batch 3.

The reference PDF has been processed through source extraction, section parsing, normalization and canonical construction. The saved preview contains two chapters, 17 lessons, 85 math blocks, eight definitions, 13 propositions, three exercises and one source-backed algorithm figure. Equations remain unverified plain notation. This is not a claim of universal document or equation accuracy.

## 1. Existing architecture verification

Reviewed `EDNOVA-COURSE-PIPELINE-FORENSIC-AUDIT.md` and `EDNOVA-BATCH1-CONTENT-INTEGRITY.md` and traced the current source. Uploads retain immutable content-addressed originals, ingestion executes asynchronously, revision manifests bind source documents, and Batch 1 canonical documents preserve full extracted lesson bodies. Reader projections and retrieval use revision-linked source evidence. Batch 1 did not validate the visual correctness of extracted glyphs or reconstruct PDF equations.

The existing PyMuPDF process boundary provides CPU/address-space/time limits. Previous extraction treated PDF text order and embedded mappings too optimistically. Whole-document OCR fallback also reprocessed native pages unnecessarily. The updated path extracts per-page visual regions and carries their identity and quality into indexing, section construction, canonical blocks and reader metadata.

A final integration regression exposed and fixed an important gap: `extract_documents()` was consuming raw regions without their canonical region IDs/types. It now normalizes regions before creating source passages. Figure metadata travels with page passages and attaches once to the owning section; matching source crop IDs resolve against the same immutable manifest. Document-scoped IDs prevent identical pages in different source files from colliding.

## 2. Golden benchmark specification

Reference: `apps/ai/agents/course_ingestion/extraction/benchmarks/reference-course.pdf`, byte-identical to `/home/ashenix/Desktop/cours-chap3et4.pdf`, 480,022 bytes, 20 pages. SHA-256: `ff83040269166027d02937563af93b6686ba9a02a0fd449c93a74747003faa02`.

Explicit regression expectations include page-1 accents/quantifiers/inequality markers, numbered headings, definition labels, the page-2 algorithm frame at `[122.92,105.72,463.08,392.31]`, and the page-11 wrapped chapter title. Three additional generated documents are specified in `representative-fixtures.json`: prose with English/French text, a pipe-delimited table with known headers/cells, and fenced Python. A mixed-content PDF checks paragraph/table/code boundaries and prose after code. Malformed, encrypted, scanned, blank and oversized-page fixtures exercise failure behavior.

**These are implementation-authored regression fixtures, not an independently reviewed golden corpus.** There is no signed-off transcription of all formulas, proofs, exercises, tables or reading order. Therefore CER/WER, equation exact-match, structural precision/recall and multilingual accuracy cannot honestly be reported. A reviewer must independently annotate representative source regions and their hierarchy before those acceptance metrics are available.

Reproduction: run `python apps/ai/agents/course_ingestion/extraction/benchmarks/run_benchmark.py` in an AI environment with PyMuPDF <2.0, optional pdfplumber, and local Tesseract. Results are stored at `reports/evidence/ednova-batch2/benchmark.json` and the versionable `extraction/benchmarks/measured-results.json`. The four page-1 marker checks are deliberately narrow exact-string checks; they are not a denominator for formula accuracy.

## 3. Extraction engine comparison

Measured locally in fresh processes, Python 3.14.8, PyMuPDF 1.26.7 and pdfplumber 0.11.10. Single runs include imports. CPU only; no GPU or remote inference. Parent and child RSS are separate maxima in KiB, not total concurrent peak.

- Native PyMuPDF `get_text()`: 20 pages, 34,115 characters, 0.0973 seconds, parent RSS 54,096 KiB. None of the four sampled page-1 strings matched.
- pdfplumber default text extraction: 20 pages, 34,753 characters, 1.0535 seconds, parent RSS 98,324 KiB. None of the four strings matched. This does not evaluate every pdfplumber configuration or its table engine.
- Local English Tesseract through the existing bounded raster/OCR helper: **page 1 only**, 1,380 characters, 0.9328 seconds, parent RSS 65,848 KiB, maximum child RSS 89,996 KiB, mean OCR confidence 81.48. None of the four strings matched. Confidence did not establish mathematical correctness. Its latency is not directly comparable to the full-document runs.
- Selected hybrid path: 20 pages, 33,726 characters, 0.4812 seconds, parent RSS 20,852 KiB, maximum child RSS 59,912 KiB, serialized raw-page JSON 213,863 bytes. All four sampled strings matched.

Native extraction is faster. The hybrid path was retained for the sampled symbol recovery, region geometry and figure retention. pdfplumber default text and forced page-1 OCR did not improve these sampled markers, so neither replaced native extraction. Local OCR remains a selective fallback for scanned pages.

Docling, Marker, PaddleOCR, EasyOCR, formula-recognition models and local VLMs were **not empirically evaluated**. No comparative quality, memory or licensing suitability is asserted for them. The requested broad candidate evaluation is incomplete.

## 4. Selected architecture and rationale

Use the existing bounded PyMuPDF parser, adding glyph geometry, visual-row grouping, source font identities and narrow in-memory CMap repair when embedded `/Differences` glyph names provide explicit identity. Accents compose only with adjacent overlapping glyphs. Original PDF bytes remain untouched. There are no unrestricted text replacements such as `X → Σ`.

Pages retain width/height, bounding boxes, line counts and extraction method. Classification recognizes numbered/bold headings, semantic labels, mathematical cues, fenced code, explicit pipe tables and figures from embedded images or coherent bounded vector frames. A wrapped display title joins only adjacent large bold lines with matching font/size and left alignment. Page-scoped OCR handles weak native-text pages.

Table merging requires adjacent table regions with overlapping horizontal geometry. Short delimiter/numeric rows retain table type and require review. Absolute-value bars in prose do not alone identify a table. Fences close code regions without consuming following prose; cross-page code merging is intentionally disabled. Canonical projection uses region-derived blocks when available, avoiding duplicate Markdown-derived copies.

Quality records separate source integrity, extraction completeness, structural validity, semantic fidelity and human review. Every recognized plain equation requires review because geometry does not verify scripts, fractions or reading order. Acknowledgement is recorded by the server with a timestamp and changes the canonical checksum. Publication rejects review-required documents without acknowledgement. Acknowledgement does not change `source_text_unverified` into verified mathematical fidelity.

Studio keeps a compact chapter/lesson workflow and one selected, scroll-bounded source passage inspector under Source tools and audit. The reader uses existing safe block renderers, displays extraction warnings and avoids rendering the entire source lesson a second time when region blocks exist. Media retrieval validates course authorization, published revision, manifest, document, region and geometry; PNGs are private/no-store.

## 5. Files and modules modified

- AI extraction: `extraction/pdf_loader.py`, `extraction/layout.py`, new `extraction/table_fallback.py`, benchmark source/specification/runner.
- AI propagation: `services/vector_store/revision_artifacts.py`, `parsing/semantic_structure.py`, `parsing/section_builder.py`, `normalization/canonical_document.py`, `normalization/schema.py`.
- Crop service: `services/api/routers/sources.py`; API route/delegation in `modules/study/src/routes/courses.ts` and `src/framework/domains/study.module.ts`.
- API revision/reader: `courseDraft.ts`, `coursePublication.ts`, `courseReader.ts`, `learningJourney.ts`, `revisionSources.ts`.
- Additive contracts: `shared/ednova/canonicalDocument.ts`, `shared/ednova/learningDocumentV2.ts`.
- Web: `features/courses/actions.ts`, `studio-actions.ts`, `course-studio.tsx`, `features/reader/registry.tsx`, `math-content.tsx`, `course-reader.tsx`.
- Tests: new `test_multimodal_extraction.py`, `test_region_crop.py`; adjusted `test_pdf_sandbox.py`, canonical/reader Jest tests and Studio rendering tests.

Paths above are relative to their app roots (`apps/ai`, `apps/api`, `apps/web`). The existing `pdf_glyph_names.py` supplies glyph identities; it was already tracked before these final changes.

Validation executed:

- Selected Python extraction/OCR/canonical/semantic/crop suites: **42 passed**, 8.69 seconds in the final run. Includes the real reference PDF through manifest extraction, sections and canonical output, and a matching figure lookup.
- API canonical and reader Jest suites: **14 passed**.
- Web Vitest: **84 passed**.
- Live MongoDB M07 draft/M08 publication integration suites in a separate test database: **17 passed**.
- Total selected automated tests: **157 passed**, plus the browser/API flow below.
- API and web typechecks: passed.
- API TypeScript build and web Next.js production build: passed.
- `git diff --check`: passed.

The local environment initially installed out-of-contract PyMuPDF 2.0 and failed resource-bound parser tests (17 failed, 20 passed). Reinstalling compatible PyMuPDF 1.26.7 resolved those failures. Docker Desktop was initially unavailable, so Python suites ran in a disposable local venv. After Docker became available, both AI containers were updated to the current parser and the complete targeted browser/upload/broker/worker/index/review/publication/reader/media flow was executed. The full repository integration suite was not run. The earlier Batch 1 browser smoke is superseded by the final Batch 2 evidence below.

### Live validation after Docker became available

Uploaded the original PDF through the authenticated browser into separately labelled QA courses. Final course: `6ae8ac195cacc7a9c7f09a7e`; published QA revision: `rev_68e631bfa6444c9a9a8886f65cc0b6f7`. Open locally at `http://localhost:3000/courses/6ae8ac195cacc7a9c7f09a7e/learn`. Automatic QA acknowledgement exercised the publication branch; it is **not independent instructor verification of the 99 flagged blocks**. The canonical verification and reader fidelity warnings remain unverified/review-required.

Observed upload acceptance, RabbitMQ delivery, worker parse/enrichment fallback/local embeddings, persisted canonical document and FAISS index. Saving reviewed content without extraction acknowledgement returned HTTP 400; Studio also blocked the command. Saving with a QA acknowledgement, preparing the exact new revision and publishing each returned HTTP 200. The final reader returned V2 with two source chapters and all 85 math blocks in plain notation, all flagged and all with exact per-block provenance. The browser rendered the original plain expression without KaTeX interpretation (zero KaTeX nodes), and the first formula's source action opened the original at page 1.

The algorithm image loaded at 682 × 574 pixels. Its authorized endpoint returned HTTP 200, `image/png`, a valid PNG signature, 59,091 bytes and `Cache-Control: private, no-store`; anonymous access returned HTTP 401. Final browser run recorded no page exceptions. Screenshots, summaries and logs are in `reports/evidence/ednova-batch2/live/`.

Live testing found and fixed: canonical paragraphs missing from the API allowlist; executable-key detection accidentally matching `extractionMethod`; repeated text hashes reusing another region's page metadata; plain formulas being interpreted as LaTeX; exact source links relying on bounded chapter-level evidence; and an inaccurate OCR warning for native-text math review flags. Regression coverage was extended for canonical metadata/event rejection, repeated source identity and projected block provenance.

The first attempt also found a local configuration mismatch: API and Docker services used different RabbitMQ virtual hosts/credentials. Runtime compose overrides aligned the local containers with the API configuration without logging credentials or rewriting repository environment files. Standard compose invocations still depend on matching local environment configuration.

Preservation check: all 11 baseline course records retained their original active-revision pointers/timestamps, and none of their 19 existing revisions were updated during live checks. Only separately created QA courses were saved/published. The M07/M08 tests used a separate MongoDB database.

## 6. Before/after content examples

The native page-1 string contains corrupted quantifier/symbol mappings; the historical audit records `8✏ > 0, 9N✏ 2 N`. Current output contains `∀ε > 0, ∃Nε ∈N`, implication `⇒` and `≤ε`. The benchmark JSON retains actual candidate excerpts for inspection.

Accented headings now include `Séries de Fonctions` and `3.1 Quelques rappels sur les séries numériques`. The page-11 title is one heading, `Fonctions déﬁnies par des intégrales à paramètre`; the source ligature remains in the text. Matching uses Unicode compatibility normalization without claiming the author used a different spelling.

The source algorithm is retained as a media block on page 2 with the original frame bbox. Tables with explicit known cells become typed table blocks; code stays code and following prose stays separate.

A generated output preview is saved at `reports/evidence/ednova-batch2/reference-canonical.json`; its summary is `reference-summary.json`. This preview is an offline derived artifact, not a new published course or an update to an existing revision.

## 7. Formula, layout, table and figure accuracy

Final source-region census: 510 regions — 31 headings, 85 math, 327 paragraphs, 32 semantic labels, 33 unknown, one figure and one figure caption. 119 regions require review. These are detector counts, not accuracy scores.

Canonical preview: two chapters, 17 lessons, 509 source text chunks; 452 region-derived blocks — eight definitions, three exercises, two headings inside lessons, 85 math, one media, 340 paragraphs and 13 propositions. Of those blocks 99 require review. Counts differ because chapter/section boundaries and running matter are handled by the semantic parser. Full source lesson text remains in canonical source blocks. These counts do not establish exhaustive visual coverage.

The four selected symbol checks pass; valid bounding boxes and deterministic figure lookup pass. The one expected algorithm frame survives and a synthetic page-decoration fixture is rejected. Synthetic pipe tables preserve their expected headers/rows. English/French prose and mixed-content fixtures pass.

No full-equation accuracy, LaTeX accuracy, merged-cell table accuracy, arbitrary diagram recall or multi-column reading-order score is available. Some formula bands still absorb short explanatory prose; some equations remain fragmented or have misplaced limits/scripts. Mathematics uses `notation: plain`; syntactic LaTeX validity is not represented as source correctness.

## 8. Resource and deployment costs

No paid model calls, new model weights or GPU are required. Existing parser defaults remain a 45-second wall timeout, 512 MiB child address-space limit, CPU limit, 2,000-page cap and 8 MiB extracted-text cap. OCR uses bounded rasterization and a local Tesseract subprocess. Heavy extraction occurs in ingestion/preparation rather than ordinary reader rendering.

Media retrieval currently recomputes manifest regions in a bounded parser and then renders the requested crop in the API process. Output geometry/pixel limits are enforced, but crop rendering itself is not yet isolated in a separate limited worker. Cache/persist reviewed region geometry and move rendering behind the same worker boundary before scaling this endpoint. Per-request re-extraction is also a latency cost.

Measured parser resource numbers are listed in section 3; they exclude embedding/indexing, database services and concurrent uploads. They are single-machine observations, not production capacity or cost estimates. `pdfplumber` was installed only in the disposable evaluation environment and is not a production dependency.

Installed PyMuPDF reports dual AGPL/commercial licensing; the existing deployment must meet its chosen license obligations. Tesseract is locally installed; no hosted OCR service was added. Any future model/engine needs its code, weight, dependency and commercial-use licenses checked separately. No claim is made that every proposed candidate is deployable under the application's distribution model.

## 9. Compatibility and rollback plan

Canonical schema remains `1.0.0`; region metadata, quality and review acknowledgement are additive. Legacy revisions without these fields continue through existing fallbacks. Original bytes, old indexes and published revisions are not migrated or rewritten by this implementation. Parser changes affect newly derived artifacts; old published content does not repair itself merely by deploying this code.

To roll back, restore this batch's source changes, rebuild API/web/AI services, and use previously published revision/index references. Preserve originals and existing revision artifacts. Do not overwrite immutable index identities to retrofit new extraction. A repaired existing course should be ingested into a new draft/revision, reviewed against the source, then explicitly published.

Region IDs are deterministic within this extractor and document identity; changed grouping/algorithm versions can change derived IDs. Do not treat cross-extractor ID stability as guaranteed. The two pre-existing audit baseline files were preserved.

## 10. Remaining limitations

- Independent golden annotations, broad candidate evaluation and general accuracy metrics remain missing.
- Formula recognition/LaTeX reconstruction, matrix/fraction/script semantics and dependable equation reading order remain incomplete.
- OCR is English-only; French native text is sampled, while Arabic/RTL and multilingual scans remain unvalidated.
- Native-text presence and the meaningful-character threshold do not reliably detect every damaged hidden text layer or partially scanned region.
- Figure support covers embedded images and some bounded frames. Arbitrary unframed vector diagrams and media-only documents require more work; failure retains original source bytes but does not create a complete readable course.
- Tables require explicit delimiters; visual-rule tables, merged cells and complex header relationships are unsupported.
- Semantic labels identify source structures, but multi-paragraph proof/definition parent-child grouping is incomplete. There is no general document-type/language classifier.
- Source inspection is selected-passage rendering, but passage payloads are still returned with Studio context; it is not a paginated server-side region browser. The selector exposes every returned passage and warns on flagged passages, but media-only regions and per-region outcomes still need a dedicated inspection interface.
- Aggregate acknowledgement requires an instructor assertion; it does not record a disposition for every flagged region or establish expert-reviewed mathematical truth.
- Targeted live upload, broker, publication, reader and media checks passed. Broader multilingual, multi-user and production-scale acceptance remains unvalidated.
- The section parser still promotes an equation fragment (`f′ = f,`) to one lesson title in this PDF, producing 17 lessons. This is a known structural false positive, not a reviewed ground-truth lesson count.

Temporary host extraction probes under `var/dev-uploads/batch2-temp` and specified `/tmp` page/glyph probes were removed. The shared upload mount no longer contains the temporary extraction folder.

## 11. Readiness recommendation for Batch 3

**Ready for independent review of the incremental extraction/review implementation; not ready to certify the full Batch 2 fidelity mission or proceed to the AI Experience Planner.**

Before Batch 3, obtain independent annotations of the reference and diverse real documents; measure equation/reading-order/table/figure metrics; evaluate at least one specialized layout/formula candidate against those annotations; add complete flagged-region inspection with per-region outcomes; isolate crop rendering; and broaden the completed targeted end-to-end ingestion/review/publication/reader checks to independently annotated documents and additional authorization scenarios. No Batch 3 planner was implemented.

### Continuation: structural classification correction

The false lesson originated in `detect_sections_with_sources`: it treated a leading `#` in a PDF math region as a Markdown heading, ignoring the upstream region classification. The parser now accepts Markdown and numbered section markers only when the region is classified as a heading, or when no region type is available for legacy text input. The reference extraction now yields 16 lessons rather than 17, and retains the equation in its preceding section. The reference regression asserts the lesson count. This is an automated check; independent review of every source heading remains outstanding.

The targeted multimodal and semantic suites pass (20 tests). The updated extraction has not yet been rerun through the live worker and browser. Formula-recognition evaluation, independently reviewed golden equations, per-region review dispositions and broad multimodal validation remain outstanding. **Batch 2 remains NO-GO for fidelity acceptance and Batch 3.**

### CodeFormulaV2 continuation (2026-11-02)

The independent-review package now includes all 16 original formula crops, provisional source transcriptions, full-page context and nine proposed alternative crops. None is independently approved. The pinned CodeFormulaV2 safetensors checkpoint was evaluated offline in a 2-core, 3-GiB CPU container: all 16 original and nine candidate attempts hit a nominal 40-second per-crop timeout, with no generated outputs. Peak observed process RSS was 2,560,564 KiB; GPU inference and verified mathematical accuracy were not measured. The experiment supports improving source-region detection and retaining human review, but provides no model-quality ranking. See [the detailed evaluation](EDNOVA-BATCH2-CODEFORMULA-EVALUATION.md). **Production formula-recognizer integration remains NO-GO; Batch 2 remains incomplete.**

### Gemini hybrid continuation

An inactive Gemini LiteLLM alias and a standalone, unreviewed source-bound proposal validation contract were added. The user approved selected reference-PDF crops and free-tier use, but the running service lacks the existing operator approval and durable budget configuration, and free-tier billing status is unverified. No Gemini requests or hybrid end-to-end test were made. The Gemini adapter, durable per-region review workflow and acceptance validation remain incomplete. See [the Gemini continuation report](EDNOVA-BATCH2-GEMINI-HYBRID.md). **Batch 2 remains NO-GO.**

### Bounded Gemini evaluation completed

Following owner consent, a free-tier project screenshot and a scoped operator approval with durable budget, the Gemini 2.5 Flash research adapter processed three source crops. All three yielded pending structured proposals; 1,681 total tokens were reported and no provider cost was returned. Provisional visual inspection found the displayed sums, integral and limit/fraction hierarchy consistent with those three crops; no independent mathematical review was performed. See [the detailed results](EDNOVA-BATCH2-GEMINI-HYBRID.md). This small sample does not establish general fidelity; Batch 2 and production integration remain NO-GO.

### Gemini integration continuation

A provider-independent, source-bound proposal contract was added and tested. It is not wired to ingestion, persistence, Studio or the reader. No additional remote calls were made. The remaining job, authorization, per-region review and end-to-end validation work is documented in [the integration report](EDNOVA-BATCH2-GEMINI-INTEGRATION.md); **Batch 2 remains incomplete and integration is NO-GO**.

### Asynchronous recognition jobs

The backend now has owner-consent and recognition-job endpoints, durable MongoDB job state, RabbitMQ dispatch, a separate worker, and a guarded Gemini transport creating pending FormulaProposals. The real-MongoDB/RabbitMQ integration test uses a separate worker process and mocked internal AI transport; separate Python tests exercise real budget reservations with a mocked SDK. The targeted API suites passed 26 tests and AI suites passed 16 tests. No new real Gemini calls were made. See [the job report](EDNOVA-BATCH2-GEMINI-JOBS.md) for operational eligibility controls, uncertain-call handling and consistency limitations. This completes the mocked asynchronous backend milestone; production rollout and broader Batch 2 fidelity acceptance remain open.

### Studio formula review experience

The existing Studio now supports formula selection, protected PDF crops, recognition submission/status/cancellation, persisted proposal comparison, safe preview, versioned accept/correct/reject decisions and history after reload. Four application browser tests passed with real sessions, Nest, isolated MongoDB, RabbitMQ and a separate worker using mocked AI transport; 89 web tests and 26 targeted API tests passed. See [the Studio report](EDNOVA-BATCH2-STUDIO-FORMULA-REVIEW.md) for screenshots, boundaries and limitations. No real Gemini calls or published reader projection were added; broader Batch 2 fidelity acceptance remains open.

### Reviewed formula publication and reader integration

Exact-snapshot accepted/corrected reviews now freeze into a separate immutable publication revision with matching retrieval units, KaTeX reader rendering and original-source inspection. Pending/rejected/stale reviews retain source fallback; new editable drafts do not inherit old approvals. Validation passed: 33 targeted API tests, eight existing publication tests, 89 web tests, ten Python tests, one publication browser journey and four Studio browser regressions, plus API/web builds and typechecks. Browser infrastructure uses real sessions/MongoDB/RabbitMQ/worker with mocked AI/index transport and native synthetic FAISS vectors. No new real Gemini calls or mathematical-accuracy certification. See [the publication report](EDNOVA-BATCH2-REVIEWED-FORMULA-PUBLICATION.md) for screenshots, preservation evidence, concurrency boundaries and recovery limits. **GO for this tested vertical slice; wider Batch 2 fidelity acceptance remains NO-GO.**

### Final acceptance audit (2026-11-02)

**Final decision: NO-GO for full Batch 2 acceptance / production readiness.** The actual reference PDF now completes authenticated upload, real RabbitMQ/Python ingestion, real local embedding/indexing, three recognition jobs across the real Node/Python boundary (only SDK responses replayed offline), instructor review, immutable publication and an enrolled-student reader/source-inspection journey. Two chapters and 16 lessons are confirmed in the live canonical output. A two-page authored networking fixture also passes real ingestion/publication/reader checks for two numbered lessons, indented Python code, pipe-table cells, caption and diagram. Desktop/mobile and outsider source denial were tested.

This continuation fixes unresolved formula display with protected source images; limits PDF crop work in fresh bounded processes; corrects verification language; separates extraction acknowledgement from content edits; exposes the required acknowledgement; preserves fenced-code indentation; merges spaced table rows; supports captioned rectangle figures and trusted single-level headings; places figures near source content; avoids treating ordinary arrow labels as equations; retains source math beyond the old 600-character cut; and rechecks consent/eligibility after crop work.

Current validation: 96 Python tests, 34 targeted API Jest tests, eight existing publication tests, 90 web tests, two real-service browser cases and four existing Studio browser regressions pass. API/web typechecks and builds pass. Repeated affected-case confirmations are not counted as additional distinct tests. The current extraction census is 510 regions / 85 math regions / 119 review-required regions, not a mathematical accuracy score. All 20 source pages and 16 crops were visually inspected provisionally; zero qualified independent formula approvals are available. Known clipping (notably the final summand of eq-001), mixed prose/equation boundaries and reading-order damage remain. No new real Gemini requests or production deployment occurred.

See [the final acceptance report](EDNOVA-BATCH2-FINAL-ACCEPTANCE.md) for the complete PASS/FAIL/BLOCKED/NOT TESTED/PARTIAL matrix, source hashes, measurements, screenshots, test commands, operational boundaries and remaining release blockers. Do not proceed to Batch 3 automatically.

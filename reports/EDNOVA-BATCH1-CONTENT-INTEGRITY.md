# EdNova — Batch 1: Canonical Course Content Integrity

**Status:** Batch 1 implementation complete; ready for independent architecture review. Batch 2 extraction work has not started.

## 1. Verified root causes

The forensic findings were reproduced against the current code rather than accepted from stale line references. The content-loss chain had several independent breaks:

- `tokenizer.py` deleted `full_content` after tokenisation. The later workers, persistence adapters and reader therefore had summaries and derived chunks, but no complete lesson body.
- `section_builder.py` retained only a short extract for some lessons, and merged sections by concatenating content with a space. That erased paragraph boundaries and made exact source spans impossible to retain.
- The worker allowed model-generated `cleaned_text` to replace extracted text, and could rename explicit source section headings. Generation quality was therefore able to alter content while appearing to be a normal ingestion step.
- Worker-result sanitisation and the revision model did not preserve `source_spans`, `structured_blocks`, figures or tables. A body that survived ingestion could still lose structure at persistence.
- The reader's legacy path rebuilt lessons from summaries and derived source artefacts. It did not consume the persisted lesson bodies or the provenance that the ingestion parser had seen.
- Draft updates could discard source spans and canonical document fields. A successful save could make the editable copy less complete than the uploaded source.
- Retrieval was generated separately from rendering. Index text and lesson text could therefore represent different material, and index chunks had no reliable link back to canonical blocks.
- Course Studio opened any old retry shell with an empty topic list. After publication, that stale draft could hide the current material. The newer 409 protection correctly prevented genuine concurrent edits from overwriting each other, so the empty shell was a separate selection defect.
- The compose configuration used an inconsistent AI image name for the two services. That makes a healthy-looking deployment capable of running workers against a different service image than the source-preparation endpoint.
- The source-index endpoint attempted to replace an already present immutable revision artifact. A repeated preparation could fail on idempotent input or trigger a conflicting-index rejection during recovery.

The original PDF extraction was not the cause of *body loss after extraction*. Its glyph, symbol, formula and table damage is a remaining input-fidelity problem, documented in section 7; this batch preserves what the extractor produced without claiming to repair it.

## 2. Files modified

The implementation touched the following Batch 1 files. Existing unrelated working-tree changes were left in place. Files marked **new** are additive.

**AI ingestion and indexing**

- `apps/ai/agents/course_ingestion/normalization/canonical_document.py` (**new**)
- `apps/ai/agents/course_ingestion/parsing/semantic_structure.py` (**new**)
- `apps/ai/agents/course_ingestion/normalization/tokenizer.py`
- `apps/ai/agents/course_ingestion/normalization/normalizer.py`
- `apps/ai/agents/course_ingestion/normalization/schema.py`
- `apps/ai/agents/course_ingestion/parsing/section_builder.py`
- `apps/ai/agents/course_ingestion/agent.py`
- `apps/ai/agents/course_ingestion/enrichment/llm_enricher.py`
- `apps/ai/agents/course_ingestion/enrichment/objective_extractor.py`
- `apps/ai/agents/course_ingestion/services/database_service.py`
- `apps/ai/workers/ingestion_worker.py`
- `apps/ai/services/api/routers/sources.py`
- `apps/ai/services/vector_store/revision_artifacts.py`

**API models, persistence, review and reader**

- `apps/api/shared/ednova/canonicalDocument.ts` (**new**)
- `apps/api/shared/ednova/learningDocumentV2.ts`
- `apps/api/shared/ednova/semanticContent.ts`
- `apps/api/modules/study/src/models/CourseRevision.ts`
- `apps/api/modules/study/src/services/courseDraft.ts`
- `apps/api/modules/study/src/services/coursePublication.ts`
- `apps/api/modules/study/src/services/courseReader.ts` (**new**)
- `apps/api/modules/study/src/services/revisionSources.ts`
- `apps/api/modules/study/src/services/ingestStatus.ts`
- `apps/api/modules/study/src/services/ingestionControl.ts`
- `apps/api/modules/study/src/services/ingestionJob.ts`

**Web and deployment**

- `apps/web/src/features/courses/course-studio.tsx`
- `apps/web/src/features/reader/course-reader.tsx`
- `docker-compose.yml`

The focused tests added or extended for this work are listed in section 6 and their test paths are included there.

## 3. Architecture and schema changes

### Canonical document and source evidence

`CanonicalDocumentV1` is a versioned, strict model stored on the revision as `contentDocument`, with a separate `contentDocumentHash`. It records the course, chapters and lessons, and gives each lesson:

- a title and a short derived summary;
- `source_spans`, containing verified chunk and document identifiers, page number where available, and a one-based line range;
- an ordered set of typed blocks. These include a `source_lesson` block holding the complete extracted lesson text, plus deterministic `heading`, `math`, `table`, `media`, `code` and `callout` blocks where the source has an unambiguous structure.

Each `source_lesson` and structured block has a stable ID derived from its owning lesson and semantic position. Repeated extraction produces the same IDs and document content. Duplicate objective IDs across repeated lesson titles are prevented by objective extraction that addresses the owning lesson and topic. The canonical document is not a model-generated replacement for the source: its provenance is `extracted` / `deterministic`, and its verification state is deliberately `source_text_unverified`.

The model keeps the raw prose and source boundaries together. Summaries remain in `summary` as derived review and navigation metadata and are never used to fill an empty canonical body. The deterministic parser also preserves chapter boundaries and creates one topic per declared chapter, without inventing a topic for every paragraph.

### Persistence, editing and publication

The ingestion worker builds the canonical document after normalisation and writes it with the revision. The API result sanitiser accepts only bounded source spans and structured blocks, validates their identifiers and ranges, and copies the canonical fields onto the revision alongside the existing topics. A review save re-anchors the canonical document to the sanitised topic hierarchy and recomputes its checksum. Publication requires a matching canonical checksum before the existing source-artifact verification and final publication checks. A missing checksum or a mismatched checksum is rejected rather than publishing content that cannot be tied to its review state.

`courseDraft.ts` prefers a non-empty draft with canonical content, then the most recently updated usable draft. When only empty shells exist, it creates a new editable revision from the active published revision, carrying the topics, source manifest and canonical document forward. It never deletes or rewrites the older shells. When a usable draft exists, its contents and evidence are updated in place under the existing optimistic revision protections, so a stale save still receives the established 409 conflict.

### Reader projection

`courseReader.ts` validates and consumes the stored canonical document rather than rebuilding lessons from lossy artefacts. It projects the complete source lesson through the existing strict V2 reading contract and retains block and source links. The raw extraction is appended as a **Source audit** section after the instructional chapters, giving readers access to the original text and page/chunk evidence without presenting the audit as a third lesson. Legacy revisions use the previous projection when no canonical document exists.

The V2 reader contract bounds evidence lists per block and section. Complete lesson span lists remain on the canonical document; the projected reader keeps the precise chunk on each content block and a bounded provenance sample for navigation. This keeps a large, multi-page source within the strict browser contract without discarding the underlying provenance.

### Retrieval as a derived representation

`retrieval_units()` and `canonicalUnitsForIndex()` derive search units from the canonical `source_lesson` bodies. Units split at paragraph boundaries, and only an oversized paragraph is split further to meet the index limit. Every unit carries its `lessonId`, `blockIds` and `source_chunk_ids` / `chunkIds`. The index metadata in the AI service validates these links against the revision manifest. The manifest remains limited to immutable document identity; retrieval units are deliberately not folded into it.

The source-index endpoint first checks for the exact existing revision artifact and reports readiness without re-embedding it. This makes repeated preparation safe. If it is absent, canonical units are indexed against verified source passages. A conflicting artifact is not silently replaced.

### Simplified Studio flow

The primary Studio action is now **Review & Publish**. It saves the review, prepares exact source and publishes through the existing server operations in one command. Source verification, recovery and local practice controls are under **Advanced source tools** instead of competing with the normal review path. The reader presents source provenance as **Source audit** after the lessons. Mobile reader overflow was corrected, and the Studio opens current material after publication instead of an older empty draft.

## 4. Migration and compatibility strategy

The schema change is additive. `contentDocument` and `contentDocumentHash` are optional on `CourseRevision`; an absent pair is valid for every legacy revision. `math`, `table`, `media`, `code` and `callout` block types are additions inside the canonical document and its bounded reader projection. Existing topic, objective, activity and source-manifest fields remain in place.

No migration or destructive reindex ran as part of Batch 1. No existing course, draft or published revision was deleted, changed in place or re-published to obtain the new representation. Old records remain readable through the previous reader projection, and selecting an old course for editing does not fabricate a canonical document.

New ingestion and newly saved reviewed drafts write the canonical fields. A new revision created from an active published revision starts as an unreviewed draft so that copying content forward cannot silently approve it. The existing checksum verification applies only when a canonical document is present, which prevents a partially written canonical record from being published while leaving legacy revisions compatible.

Rollback is a code and deployment rollback, not a data migration. See section 9.

## 5. Before/after content preservation evidence

The regression course was `cours-chap3et4.pdf`. The baseline is the course `6ae7ed9452ac7f7233074cd6`, revision `rev_09e56ba0adb6481c843b4ab4447020e8`. The fresh run after the repair is course `6ae80a1d71bfc9d2c1b2cb5c`, published revision `rev_431c3efef2b34b15b643c01607d0e775`. Both runs used the same source document. Character counts are evidence of coverage, not a claim of glyph fidelity.

| Property | Baseline revision | Canonical revision |
|---|---:|---:|
| Chapters | 2 | 2 |
| Lessons | 16 | 16 |
| Empty lesson bodies | 16 | 0 |
| Unique objective IDs | — | 16 |
| Canonical blocks | 0 | 32 |
| Source lesson blocks | 0 | 16 |
| Callout blocks | 0 | 16 |
| Source prose retained | 0 characters | 32,490 characters |
| All canonical block text | — | 33,462 characters |
| Summaries (derived metadata) | 5,326 characters | 5,326 characters |
| Source spans | — | 956 |
| Unique source chunks in spans | — | 25 |

The baseline had lesson outlines but no lesson bodies: the entire reading path depended on summaries. The canonical revision retains complete extracted prose independently of the summaries, with every lesson tied to its source evidence. No blank lesson body or duplicate block ID remained. Objective IDs are unique for all 16 lessons, including repeated titles.

The reader endpoint returned HTTP 200. Its projection contained **194 blocks**: 40 headings, 89 paragraphs, 49 lists and 16 callouts. Lesson content was **33,760 characters across 96 blocks**. The separate Source audit narrative/list content was **31,269 characters across 98 blocks**, or **32,664 characters including source headings**, and appeared after the final lesson. It was not represented as an additional lesson.

The reviewed search index contained **24 canonical units** and **32,484 characters**. All 24 units had block identifiers and source-chunk identifiers. This demonstrates that rendering and retrieval are derived from the same source lesson blocks while the retrieval representation remains separate.

The recorded identities for the fresh revision are:

- Manifest: `sha256:0a70e1db5a7f617e64bfbff5d2a940c0728f97b8e724356ace03e867af56c97e`
- Index: `sha256:82d3da727913e27aa52be7b24553d89ffa9f8b2dba4be1e7260e8b53fff78b20`
- Published content hash: `dfe206133d505413851205ed3e05f0a993efc01eb4580e3a76dbdaa0b18cd62c`
- Canonical document hash: `sha256:8cffdb4d9810c23da17c60d6216a243004cc9a787135f7c2445c865529afe2fd`

A live Studio check selected draft `rev_ace409c0901a45ab904169a195632f4e`. It was created from the active published revision and retained 2 chapters, 16 lessons, 16 objectives and the canonical document. The older empty drafts remained present, and the active published revision was unchanged.

The browser checks used the desktop and mobile layouts of the Studio and reader. They found no page or console errors and no horizontal overflow. Studio presented 2 chapters and 16 lessons; the reader presented 194 blocks and placed Source audit after the lessons; the mobile outline dialog opened and closed correctly.

Screenshots are in `docs/submission/screenshots/`:

- `ednova-batch1-studio-desktop.png`
- `ednova-batch1-studio-mobile.png`
- `ednova-batch1-reader-desktop.png`
- `ednova-batch1-reader-mobile.png`
- `ednova-batch1-reader-mobile-outline.png`

## 6. Automated test results

The following checks passed on the completed implementation:

| Scope | Result |
|---|---|
| Focused Python suite | 56 passed |
| API canonical, reader and status tests | 27 passed |
| M07 lifecycle integration | 9 passed |
| Web Studio and reader tests | 10 passed |
| API typecheck and build | passed |
| Web typecheck | passed |
| Web production build | passed |

The tests include complete-body survival through tokenisation and normalisation, stable block IDs across repeated builds, paragraph-bounded retrieval, summaries unable to substitute for empty canonical bodies, exact line evidence for structured blocks, safe handling of malformed tables and media, bounded reader projection with many source spans, schema-version and executable-content rejection, legacy reading behaviour, canonical index links, repeated index idempotency, conflicting artifact protection, checksum checks on publication, duplicate objective IDs, source-span persistence through editing, and the `ED-30.5b` stale-empty-shell regression. The M07 suite also confirms that publishing and editing cannot overwrite reviewed or active material through a late or conflicting operation.

## 7. Remaining extraction defects

The PDF remains text-damaged at extraction. This batch preserves those exact characters and does not label them corrected. Observed examples include `S´eries`, `´e`, `ˆetre`, `ﬁ`, `` `a param`etre ``, `✏`, `8✏`, and `\uf8ff`. Accents, ligatures and mathematical symbols can be detached, replaced or left as private-use glyphs. Normalisation and paragraph joining cannot recover the author's intended characters from those artefacts.

No structured Markdown mathematics or tables survived from this PDF. The deterministic table and formula blocks therefore do not recover equations or tables that the extractor emitted as flattened, damaged text. The canonical document is faithful to that extracted text, not to the visual page. Page and line spans identify the available evidence; they do not prove glyph-level fidelity.

The ingestion metadata retains the extractor's OCR confidence, `review_required` and extraction warning rather than clearing them. A reviewer must still treat the source as text-unverified. Batch 2 should add a layout-aware extractor, mathematical notation recognition and OCR/glyph fidelity benchmarks before claiming visual or formula fidelity. The comparison in section 5 measures preservation of the extractor's output, not correctness of what it read from the PDF.

## 8. Known risks

- **Large canonical revisions:** a full course body and many source spans increase revision document size. The reader contract is bounded, but storage and serialisation costs should be monitored as multi-document courses grow.
- **Reader provenance sampling:** each projected block keeps its exact source chunk, while section and block provenance lists are bounded for the strict V2 contract. The complete source spans remain in the canonical record. Any future contract change must preserve that distinction.
- **Single-structure support:** formulas and tables are only recognised when the extracted text has an unambiguous delimiter. Flattened PDF equations and tables remain prose, as expected for this batch.
- **Index drift:** retrieval units are derived and can be regenerated. Treating canonical content and index identities together must remain a verification step; an old index is not evidence that it matches a newly reviewed revision.
- **Review dependency:** canonical preservation prevents silent loss but does not make damaged source text educationally correct. Publisher review and source-audit visibility are still necessary.
- **Legacy variation:** legacy revisions are preserved and projected through the previous path. Their older, potentially incomplete canonical metadata should not be backfilled in place without a separately reviewed migration.
- **Deployment consistency:** both AI services now reference `ednova-api-ai-service:latest`. A deployment must still publish or pull the same build under that name for API and worker behaviour to match.

## 9. Rollback instructions

This change requires no data migration, so rollback can preserve all course records.

1. Record the current active revision identities and back up the course/revision collections, including drafts and source manifests, before deploying a rollback.
2. Roll back the API, AI service and web application to the previous release as one unit. Restore the previous compose image settings if using an earlier container release.
3. Do not delete `contentDocument` or `contentDocumentHash` while rolling back. They are additive and optional, and retaining them preserves the audit trail. A previous application will ignore them.
4. Do not delete, replace or reindex immutable source artefacts, and do not rewrite old drafts or published revisions. Leave existing vector indexes intact.
5. If a previously deployed schema rejected the new optional fields, restore the pre-Batch-1 schema and application without dropping course data, then verify a published legacy revision and a newly created canonical revision remain readable.
6. Re-enable Batch 1 only after checking checksum validation, source preparation and publication against an existing revision and a fresh one.

No existing course record, immutable source file or published revision was removed by this batch, so there is no Batch 1 deletion to reverse.

## 10. Batch 2 readiness recommendation

**Recommendation: proceed to independent architecture review, then start Batch 2 extraction work.** The foundation now preserves the extractor's complete output and its provenance throughout ingestion, review, persistence, publication and reader projection. Retrieval and rendering share those canonical blocks, and legacy courses remain readable.

Batch 2 should focus on fidelity rather than another persistence refactor: layout-aware extraction, mathematical recognition, table and figure recovery, OCR confidence, and visual-to-text comparison benchmarks. The known root cause is upstream of the canonical model, and `cours-chap3et4.pdf` supplies a useful regression case with measurable accent, ligature and symbol damage.

Batch 2 is not complete or approved by this report. This batch stops here for independent architecture review.

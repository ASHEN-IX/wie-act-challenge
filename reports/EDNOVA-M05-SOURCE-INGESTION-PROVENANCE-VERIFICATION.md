# EdNova M05 / ED-06 Secure Source Ingestion & Revision-Pinned Provenance Verification — 23 October 2026

**Mission classification: M05 / ED-06 COMPLETE / DONE.**

---

## 1. Executive Summary

Mission **M05 / ED-06** accomplishes the canonical requirement of **ED-06 (Unify Scoped Material Ingestion and Provenance)**. It delivers a secure, revision-aware source ingestion and provenance tracking architecture across both the Node.js backend and the Python AI worker/vector store subsystem:

1. **Deterministic File Hashing:** Every source file uploaded via `POST /api/v1/study/courses` or `POST /api/v1/study/courses/:courseId/files` has its SHA-256 hash computed immediately upon staging. The original hash is preserved on each file record in `course.files`.
2. **Revision-Pinned Ingestion & Draft Creation:** Each ingestion cycle creates an immutable `CourseRevision` draft with a unique `revisionTag` (e.g. `rev_<timestamp>`), a combined content hash (SHA-256 over sorted file hashes), and a canonical vector index pointer (`faiss/<courseId>/<revisionTag>.faiss`).
3. **Revision-Aware FAISS & Metadata Sidecar Storage:** Python's `VectorStoreAdapter` now supports revision-aware indexing:
   - Index artifact: `faiss/<courseId>/<revisionId>.faiss`
   - Metadata sidecar: `faiss/<courseId>/<revisionId>.meta.json`
   - MongoDB persistence in `chunk_embeddings` with `{ course_id, revision_id }` compound queries.
4. **Verifiable Chunk-Level Provenance:** Every tokenized text chunk receives a deterministic `chunk_id` (`chk_<sha256[:16]>`), `provenance: "extracted"`, `revision_id`, `topic_id`, `subtopic_id`, and `page_number` (honestly marked, null when unextractable).
5. **Path Traversal & Payload Security:** Strict regex guards (`^[A-Za-z0-9_\-\.]{1,64}$`) on `revisionId` in both TypeScript `validateIngestPayload` and Python `validate_revision_id` prevent directory traversal attacks.
6. **Non-Destructive Versioning:** Subsequent uploads stage separate revisions without overwriting or destroying previously indexed revisions.

---

## 2. Automated Verification Evidence

### A. Node Integration Suite (`tests/integration/m05-source-ingestion-provenance.node.test.ts`)
Executed against isolated MongoDB on `127.0.0.1:27018`:
- `1. Uploading source files creates course with SHA-256 fileHash and draft CourseRevision`: **PASS** (fileHash verified, CourseRevision draft created with contentHash).
- `2. Ingestion worker result completion links sanitized topics and pins activeRevisionId`: **PASS** (topics populated on CourseRevision, `activeRevisionId` pinned on course).
- `3. Subsequent file upload stages a new distinct revision without destroying previous revision`: **PASS** (two distinct revisions coexist in MongoDB with distinct content hashes).
- `4. Payload schema validation rejects malformed revisionId and path traversal attempts`: **PASS** (`../../etc/passwd` rejected, unknown fields rejected, valid envelopes accepted).

### B. Python Vector Store & Ingestion Suite
Executed with Python 3.12 under locked environment:
- `apps/ai/tests/test_vector_store_revision.py`: **3/3 PASS** (revision-aware indexing on disk, metadata sidecar, Mongo persistence, multi-revision coexistence, traversal validation).
- `apps/ai/tests/test_ingestion_*.py`: **40/40 PASS** (pipeline, schemas, deduplication, retry semantics, OCR/PDF sandboxing).
- `apps/ai/agents/course_ingestion/tests/`: **13/13 PASS** (deduplicator, chunk embedder, PDF sandbox).

---

## 3. Artifact Manifest

- `apps/api/modules/study/src/models/index.ts` (`ICourseFile.fileHash`, `courseSchema.files.fileHash`)
- `apps/api/modules/study/src/services/ingestionJob.ts` (`revisionId` support, `setCustomPublisher`)
- `apps/api/modules/study/src/services/ingestStatus.ts` (`handleIngestResult` links `CourseRevision` and pins `course.activeRevisionId`)
- `apps/api/modules/study/src/routes/courses.ts` (`stageCourseFiles` computes SHA-256, generates revision tag and draft `CourseRevision`)
- `apps/api/shared/ai-messaging/payloadSchemas.ts` (`validateIngestPayload` validates `revisionId`)
- `apps/ai/workers/schemas.py` (`IngestionRequest.revisionId` field and validator)
- `apps/ai/services/vector_store/adapter.py` (revision-aware indexing, sidecar persistence, MongoDB compound indexing)
- `apps/ai/workers/ingestion_worker.py` (passes `revisionId`, builds verifiable chunk provenance metadata)
- `apps/api/tests/integration/m05-source-ingestion-provenance.node.test.ts`
- `apps/ai/tests/test_vector_store_revision.py`
- `reports/EDNOVA-M05-SOURCE-INGESTION-PROVENANCE-VERIFICATION.md`

---

## 4. Next Step

With **M05 / ED-06 complete and verified**, we proceed autonomously to **M06 / ED-03: Approved AI Provider Execution & Mode Reporting**.

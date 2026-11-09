"""IngestionWorker — consumes `study.ingest.course` jobs (INGEST-06).

Implements the background pipeline that INGEST-05 triggers asynchronously:

    parse → normalize → enrich (LLM) → objectives (BLOOM-04/05)
         → chunk → embed → deduplicate → vector store

Design decisions:

- payload is validated into the strict `IngestionRequest` (INGEST-05); malformed
  input is TERMINAL — retrying cannot fix a bad envelope
- files are read from the shared uploads volume (``INGEST_UPLOADS_DIR``) using
  the storage-relative paths from the envelope; the payload never inlines raw
  content (sandboxed PDF parse is reused from INGEST-04)
- each blocking stage (parsing, enrichment, embedding) runs off the event loop
  via ``asyncio.to_thread`` so the broker loop never blocks (INGEST-06 AC)
- per-stage progress events (parsing/enriching/embedding/indexing) are published
  on ``ai.results`` routing key ``progress`` for INGEST-07
- deduplicated chunks + embeddings land in the FAISS + Mongo vector store via
  ``VectorStoreAdapter.add_course``; replays rebuild the index idempotently,
  so retries (AI-COM-06) never duplicate vectors
- the completed result carries the course JSON (sans embedding vectors — those
  live in the vector store) + pipeline stats; the Node backend persists the
  course document from that payload (INGEST-07)
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from pydantic import ValidationError

from messaging.failures import TerminalError
from services import api_service
from workers.base import BaseAIWorker
from workers.schemas import IngestionRequest

logger = logging.getLogger(__name__)

# Default location of the shared uploads volume inside the ai-service container.
UPLOADS_ROOT_DEFAULT = "/app/uploads"


class IngestionWorker(BaseAIWorker):
    job_type = "study.ingest.course"

    def __init__(
        self,
        rabbitmq_url: Optional[str] = None,
        idempotency_store=None,
        prefetch: int = 1,
        uploads_root: Optional[str] = None,
        vector_store=None,
    ) -> None:
        super().__init__(
            rabbitmq_url=rabbitmq_url,
            idempotency_store=idempotency_store,
            prefetch=prefetch,
        )
        # Uploads root is configurable; injected in tests (tmp dirs).
        self._uploads_root = Path(
            uploads_root or os.getenv("INGEST_UPLOADS_DIR", UPLOADS_ROOT_DEFAULT)
        )
        # Vector store is heavy (FAISS + Mongo) → built lazily on first job, or
        # injected in tests.
        self._vector_store = vector_store
        self._course_title: Optional[str] = None

    @property
    def vector_store(self):
        if self._vector_store is None:
            from services.vector_store.adapter import get_vector_store

            self._vector_store = get_vector_store()
        return self._vector_store

    # ------------------------------------------------------------------ API

    async def handle(self, payload: Dict[str, Any], envelope) -> Dict[str, Any]:
        request = self._build_request(payload)
        # Titles are display metadata. Every title decision stays local to this
        # job and the requested sources remain the authority for the outline.
        self._course_title = request.courseTitle
        await asyncio.to_thread(self._ensure_current_operation, request, envelope)
        revision_manifest = None
        if request.revisionId:
            from services.vector_store.revision_artifacts import manifest_digest

            revision = await asyncio.to_thread(
                api_service.ingestion_revision, request.courseId, request.revisionId
            )
            if (
                not revision
                or not revision.get("sourceManifest")
                or any(not d.get("storageRef") for d in revision["sourceManifest"])
            ):
                raise TerminalError("Exact immutable source revision unavailable")
            revision_manifest = {
                "schemaVersion": "1.0.0",
                "courseId": request.courseId,
                "revisionId": request.revisionId,
                "contentHash": "sha256:"
                + str(revision["contentHash"]).removeprefix("sha256:"),
                "documents": revision["sourceManifest"],
            }
            revision_manifest["manifestDigest"] = manifest_digest(revision_manifest)

        await self._publish_progress(
            envelope,
            stage="parsing",
            progress=0.1,
            detail=f"parsing {len(request.files)} file(s)",
        )

        subtopics, section_count, source_files = await asyncio.to_thread(
            self._parse_stage, request, revision_manifest
        )
        if not subtopics:
            raise TerminalError("no subtopics could be derived from the uploaded files")
        await asyncio.to_thread(self._ensure_current_operation, request, envelope)

        await self._publish_progress(
            envelope,
            stage="enriching",
            progress=0.35,
            detail=f"enriching {len(subtopics)} subtopic(s)",
        )
        enriched, objective_stats, classification_stats = await asyncio.to_thread(
            self._enrich_stage, subtopics, self._course_title
        )
        await asyncio.to_thread(self._ensure_current_operation, request, envelope)

        await self._publish_progress(
            envelope, stage="embedding", progress=0.6, detail="chunking and embedding"
        )
        embedded, dedup_removed = await asyncio.to_thread(self._embed_stage, enriched)
        await asyncio.to_thread(self._ensure_current_operation, request, envelope)

        await self._publish_progress(
            envelope,
            stage="indexing",
            progress=0.8,
            detail="upserting chunks into the vector store",
        )
        result = await asyncio.to_thread(
            self._index_stage,
            request.courseId,
            embedded,
            source_files,
            objective_stats,
            classification_stats,
            dedup_removed,
            revision_id=request.revisionId,
            manifest=revision_manifest,
        )
        await asyncio.to_thread(self._ensure_current_operation, request, envelope)

        await self._publish_progress(
            envelope, stage="indexing", progress=1.0, detail="ingestion complete"
        )
        return result

    # ------------------------------------------------------------- stages

    def _ensure_current_operation(self, request, envelope):
        """Cooperative cancellation/fencing between bounded blocking stages.

        Existing legacy envelopes without an operation record retain their
        behavior. New operations must match the current server-owned pointer; the
        API owns that state, so an unreachable API fails closed.
        Running blocking work is bounded but is not claimed to be hard-cancelled.
        """
        if not api_service.ingestion_operation_is_current(
            envelope.messageId,
            course_id=request.courseId,
            revision_id=request.revisionId,
            user_id=envelope.userId,
            job_id=envelope.messageId,
            correlation_id=envelope.correlationId,
        ):
            raise TerminalError("Ingestion operation is no longer current")

    def _parse_stage(
        self, request: IngestionRequest, manifest=None
    ) -> Tuple[List[dict], int, List[str]]:
        """Extract text from every file, split into sections, build subtopics.

        Returns (subtopics, section_count, source_files) — pure CPU/IO, runs off
        the event loop.
        """
        from agents.course_ingestion.parsing.layout_parser import detect_sections
        from agents.course_ingestion.parsing.section_builder import build_subtopics


        source_files: List[str] = []
        all_sections = []
        # Fail closed for modern, revision-bound ingestion.
        #
        # A request that carries `revisionId` is a modern, source-backed
        # revision: its publication policy depends on manifest evidence
        # (chapter identity, source regions, extraction review, formula
        # review). If the manifest is unavailable — a database outage, a
        # missing storageRef, a deployment misconfiguration — the legacy text
        # parser below would silently produce a weaker artifact with no
        # chapters and no source regions, and that artifact would still be
        # publishable. Refusing is the only safe outcome: better no revision
        # than a silently degraded one.
        #
        # Genuinely legacy documents remain supported: those arrive without a
        # `revisionId` and take the else branch by design.
        if request.revisionId and not manifest:
            raise TerminalError(
                "Source manifest unavailable for a revision-bound ingestion; "
                "refusing to fall back to the legacy parser"
            )
        if manifest:
            from services.vector_store.revision_artifacts import (
                extract_documents,
                original_path,
            )
            from agents.course_ingestion.parsing.semantic_structure import (
                detect_sections_with_sources,
            )

            chunks, metas = extract_documents(manifest)
            # Keep the verified chunk/page identity while detecting sections.
            # Joining chunks and re-splitting text would make topic spans
            # impossible to prove after enrichment.
            all_sections = detect_sections_with_sources(zip(chunks, metas))
            source_files = [str(original_path(d)) for d in manifest["documents"]]
        else:
            for meta in request.files:
                path = self._resolve_path(meta, request.fileRef)
                text = self._extract_text(meta, path)
                source_files.append(str(path))
                all_sections.extend(detect_sections(text))

        if not all_sections:
            logger.warning("ingest_no_sections", extra={"courseId": request.courseId})
        return build_subtopics(all_sections), len(all_sections), source_files

    def _extract_text(self, meta, path: Path) -> str:
        """Read a staged file. PDFs go through the INGEST-04 sandboxed parser
        with OCR fallback; text files are read as UTF-8 directly."""
        from agents.course_ingestion.extraction.pdf_loader import (
            EncryptedPdfError,
            PdfParseLimitError,
            PdfParseTimeoutError,
            PdfValidationError,
            extract_text_from_pdf_sandboxed,
        )

        is_pdf = (
            meta.mimetype or ""
        ).lower() == "application/pdf" or meta.filename.lower().endswith(".pdf")
        if not is_pdf:
            try:
                return path.read_text(encoding="utf-8")
            except UnicodeDecodeError as exc:
                # Data problem: retrying cannot fix an undecodable file.
                raise TerminalError(
                    f"text file is not valid UTF-8: {meta.filename}"
                ) from exc

        try:
            text = extract_text_from_pdf_sandboxed(str(path))
        except (PdfParseTimeoutError, PdfParseLimitError):
            # Named first: they subclass PdfValidationError but are transient
            # resource pressure → retryable, never terminal.
            raise
        except (EncryptedPdfError, PdfValidationError) as exc:
            # The upload flunks what the sandbox can parse — data, not infra.
            raise TerminalError(f"PDF rejected by the sandbox parser: {exc}") from exc

        # Scanned/imaged PDFs produce little or no text → OCR fallback. Imported
        # lazily: pytesseract/poppler are heavy and only needed on this path.
        if len(text.strip()) < 50:
            from agents.course_ingestion.extraction.ocr import ocr_pdf

            logger.info("ingest_ocr_fallback", extra={"file": path.name})
            text = ocr_pdf(str(path))
        return text

    def _resolve_path(self, meta, fileRef: str) -> Path:
        """Map an envelope file entry onto the uploads volume with containment.

        ``files[].path`` is relative to the uploads root (e.g.
        ``courses/<courseId>/<filename>``); ``fileRef`` is ``uploads/courses/
        <courseId>``. A missing volume/file is terminal (data, not transient).
        """
        root = self._uploads_root.resolve()
        if not root.is_dir():
            raise TerminalError(f"uploads root not mounted: {root}")

        file_ref = fileRef.lstrip("/")
        if file_ref.startswith("uploads/"):
            file_ref = file_ref[len("uploads/") :]
        rel = (meta.path or os.path.join(file_ref, meta.filename)).replace("\\", "/")
        path = (root / rel).resolve()

        if path != root and root not in path.parents:
            raise TerminalError(f"file path escapes the uploads root: {meta.filename}")
        if not path.is_file():
            raise TerminalError(f"ingestion source file not found: {meta.filename}")
        return path

    def _enrich_stage(
        self, subtopics: List[dict], course_title: Optional[str] = None
    ) -> Tuple[List[dict], Dict[str, Any], Dict[str, Any]]:
        """LLM enrichment + BLOOM-04 objectives + BLOOM-05 classification."""
        from agents.course_ingestion.enrichment.llm_enricher import (
            enrich_subtopic_with_llm,
            generate_subtopic_title,
        )
        from agents.course_ingestion.enrichment.objective_extractor import (
            extract_objectives_for_document,
        )
        from bloom.classifier import classify_objectives_for_document

        enriched = []
        for st in subtopics:
            enriched_data = enrich_subtopic_with_llm(st["title"], st["full_content"])
            # Model-cleaned text is only a suggestion. It must never replace
            # canonical source prose; source and generated content stay separate.
            cleaned = st["full_content"]
            st["key_concepts"] = enriched_data.get(
                "key_concepts", st.get("key_concepts", [])
            )
            st["definitions"] = enriched_data.get("definitions", [])
            st["formulas"] = enriched_data.get("formulas", [])
            st["examples"] = enriched_data.get("examples", [])
            from agents.course_ingestion.parsing.semantic_structure import (
                _source_section_title,
            )

            # An author/source chapter heading is stronger evidence than a
            # model summary. Only descriptive fallbacks should be refined.
            if not _source_section_title(st.get("title", "")):
                try:
                    refined_title = generate_subtopic_title(cleaned)
                    if refined_title:
                        # Titles can be refined, but source-backed section
                        # headings stay untouched above.
                        st["title"] = refined_title
                except Exception as title_err:  # refinement is best-effort
                    logger.warning(
                        "ingest_title_refinement_failed", extra={"error": str(title_err)}
                    )
            enriched.append(st)

        objective_stats = extract_objectives_for_document(
            enriched, course_title=course_title or self._course_title
        )
        classification_stats = classify_objectives_for_document(enriched)
        return enriched, objective_stats, classification_stats

    def _embed_stage(self, subtopics: List[dict]) -> Tuple[List[dict], int]:
        """Chunk (tokenize), embed, then deduplicate near-identical chunks."""
        from agents.course_ingestion.enrichment.chunk_embedder import (
            embed_all_subtopics,
        )
        from agents.course_ingestion.enrichment.deduplicator import deduplicate_chunks
        from agents.course_ingestion.normalization.tokenizer import tokenize_subtopics

        tokenized = tokenize_subtopics(subtopics, chunk_size=200, overlap=50)
        embedded = embed_all_subtopics(tokenized)

        removed = 0
        for st in embedded:
            chunks = st.get("tokenized_chunks", [])
            embeddings = st.get("chunk_embeddings", [])
            if not chunks or not embeddings:
                continue
            unique_chunks, unique_embeddings = deduplicate_chunks(chunks, embeddings)
            removed += len(chunks) - len(unique_chunks)
            st["tokenized_chunks"] = unique_chunks
            st["chunk_embeddings"] = unique_embeddings
        logger.info(
            "ingest_dedup_done",
            extra={
                "removedChunks": removed,
                "remainingChunks": sum(
                    len(st.get("tokenized_chunks", [])) for st in embedded
                ),
            },
        )
        return embedded, removed

    def _index_stage(
        self,
        course_id: str,
        subtopics: List[dict],
        source_files: List[str],
        objective_stats: Dict[str, Any],
        classification_stats: Dict[str, Any],
        dedup_removed: int,
        revision_id: Optional[str] = None,
        manifest=None,
    ) -> Dict[str, Any]:
        """Normalize into course JSON, flatten chunk records, index the vector
        store. Returns the completed-result payload for the Node backend."""
        from agents.course_ingestion.normalization.normalizer import normalize_course

        rev_tag = revision_id or "rev_1"
        course_json = normalize_course(
            self._course_title or course_id, subtopics, source_files
        )
        from agents.course_ingestion.normalization.canonical_document import (
            build_canonical_document,
            retrieval_units,
        )

        # The canonical document is the reading projection. Search chunks are
        # derived from these blocks and retain links to their source block ids.
        canonical = build_canonical_document(
            course_id, self._course_title or course_id, course_json.topics
        )
        units = retrieval_units(canonical)
        chunks, embeddings, metadatas = _flatten_chunk_records(
            course_id, course_json, revision_id=rev_tag
        )

        if manifest:
            from services.vector_store.revision_artifacts import (
                canonical_units_for_index,
            )
            from services.vector_store.embedder import get_embedder

            # Search uses the canonical document's source blocks. These units
            # retain their canonical block ids while remaining exact source
            # text for artifact verification.
            chunks, metadatas = canonical_units_for_index(manifest, units)
            embeddings = get_embedder().encode(chunks)
        indexed = False
        if chunks and embeddings.size:
            if manifest:
                self.vector_store.add_course(
                    course_id,
                    chunks,
                    embeddings,
                    metadatas,
                    revision_id=rev_tag,
                    artifact=manifest,
                )
            else:
                # Legacy artifacts remain explicitly unverified; never reclassify
                # unknown document metadata as a published source index.
                self.vector_store.add_course(
                    course_id, chunks, embeddings, metadatas, revision_id=rev_tag
                )
            indexed = True

        stats = {
            "files": len(source_files),
            "subtopics": len(subtopics),
            "chunks": len(chunks),
            "canonicalChapters": len(canonical["chapters"]),
            "canonicalLessons": sum(len(c["lessons"]) for c in canonical["chapters"]),
            "canonicalBlocks": sum(len(l["blocks"]) for c in canonical["chapters"] for l in c["lessons"]),
            "retrievalUnits": len(units),
            "indexedChunks": len(chunks) if indexed else 0,
            "deduplicatedChunks": dedup_removed,
            "objectivesExtracted": int(objective_stats.get("extracted", 0)),
            "objectivesClassified": int(classification_stats.get("classified", 0)),
            "objectivesNeedingReview": int(classification_stats.get("needs_review", 0)),
            "vectorStoreIndexed": indexed,
        }
        logger.info(
            "ingest_completed",
            extra={"courseId": course_id, "revisionId": rev_tag, "stats": stats},
        )
        return {
            "courseId": course_id,
            "revisionId": rev_tag,
            "vectorIndexRef": f"faiss/{course_id}/{rev_tag}.faiss",
            "status": "completed",
            "stats": stats,
            "contentDocument": canonical,
            "course": _strip_vectors(course_json.model_dump(mode="json")),
        }

    # ------------------------------------------------------------ internals

    def _build_request(self, payload: Any) -> IngestionRequest:
        if not isinstance(payload, dict):
            raise TerminalError("invalid ingest payload: must be an object")
        try:
            return IngestionRequest.model_validate(payload)
        except ValidationError as exc:
            raise TerminalError(f"invalid ingest payload: {exc}") from exc


def _flatten_chunk_records(
    course_id: str, course_json, revision_id: Optional[str] = None
) -> Tuple[List[str], Any, List[Dict[str, Any]]]:
    """Flatten per-subtopic tokenized chunks + embeddings into index-ready arrays.

    Returns (chunks, np.ndarray float32 (N, 384) embeddings, metadatas). Each
    metadata record carries stable chunk_id, revision_id, topic/subtopic,
    provenance, and page location so retrieval maintains verifiable provenance.
    """
    import hashlib
    import numpy as np

    chunks: List[str] = []
    vectors: List[Any] = []
    metadatas: List[Dict[str, Any]] = []
    rev_tag = revision_id or "rev_1"
    for topic in course_json.topics:
        for sub in topic.subtopics:
            sub_chunks = sub.tokenized_chunks or []
            sub_vecs = sub.chunk_embeddings or []
            for idx, chunk in enumerate(sub_chunks):
                if idx >= len(sub_vecs):
                    continue
                chunk_hash = hashlib.sha256(chunk.encode("utf-8")).hexdigest()[:16]
                chunks.append(chunk)
                vectors.append(sub_vecs[idx])
                metadatas.append(
                    {
                        "chunk_id": f"chk_{chunk_hash}",
                        "course_id": course_id,
                        "revision_id": rev_tag,
                        "topic_id": topic.id,
                        "topic_title": topic.title,
                        "subtopic_id": sub.id,
                        "subtopic_title": sub.title,
                        "provenance": "extracted",
                        "page_number": None,
                        "ambiguity_flag": False,
                    }
                )
    embeddings = (
        np.asarray(vectors, dtype="float32")
        if vectors
        else np.zeros((0, 0), dtype="float32")
    )
    return chunks, embeddings, metadatas


def _strip_vectors(course: dict) -> dict:
    """Remove heavy vector data from the result payload — chunks/embeddings live
    in the vector store, not in ai.results events."""
    for topic in course.get("topics", []):
        for sub in topic.get("subtopics", []):
            sub.pop("tokenized_chunks", None)
            sub.pop("chunk_embeddings", None)
    return course


if __name__ == "__main__":  # pragma: no cover - manual run entrypoint
    logging.basicConfig(level=logging.INFO)
    IngestionWorker().run()

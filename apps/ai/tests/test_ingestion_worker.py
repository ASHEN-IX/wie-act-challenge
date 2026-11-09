"""IngestionWorker tests (INGEST-06) — no broker, no Mongo, no FAISS, no LLM.

Patches:
- the blocking stage methods (_parse_stage/_enrich_stage/_embed_stage) with
  lightweight fakes, except where a real stage is under test;
- normalize_course stays REAL (schema-only) so _index_stage exercises the real
  flatten + strip + vector-store-adder path;
- the vector store is a recording fake (no FAISS/Mongo);
- _publish_result / _publish_progress are overridden to record events.

The REAL _publish_progress wire path (channel + envelope validation + routing
key) is covered by test_real_progress_publish_uses_progress_routing_key.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from types import SimpleNamespace

import pytest

from messaging.envelope import validate_job_envelope
from messaging.failures import TerminalError
from services import api_service
from workers.idempotency import InMemoryIdempotencyStore
from workers.ingestion_worker import (
    IngestionWorker,
    _flatten_chunk_records,
    _strip_vectors,
)

UUID_B = "0f8e2d1a-3b4c-4d6e-8f80-91a2b3c4d5e6"

INGEST_PAYLOAD = {
    "courseId": "course-1",
    "fileRef": "uploads/courses/course-1",
    "files": [
        {
            "filename": "lecture-notes-c8f2.pdf",
            "originalName": "lecture-notes.pdf",
            "mimetype": "application/pdf",
            "size": 2048,
            "path": "courses/course-1/lecture-notes-c8f2.pdf",
        }
    ],
}

VALID_BASE = {
    "messageId": str(uuid.uuid4()),
    "correlationId": UUID_B,
    "type": "study.ingest.course",
    "version": "1",
    "userId": "user-1",
    "requestId": "req-ingest",
    "timestamp": "2026-08-19T08:00:00Z",
}


class FakeVectorStore:
    def __init__(self):
        self.added = []

    def add_course(
        self,
        course_id,
        chunks,
        embeddings,
        metadatas=None,
        revision_id=None,
        artifact=None,
    ):
        self.added.append(
            {
                "course_id": course_id,
                "chunks": list(chunks),
                "num": len(chunks),
                "shape": (
                    tuple(embeddings.shape) if hasattr(embeddings, "shape") else None
                ),
                "metas": metadatas,
            }
        )


class RecordingIngestionWorker(IngestionWorker):
    def __init__(self, uploads_root, vector_store=None):
        super().__init__(
            uploads_root=str(uploads_root),
            vector_store=vector_store or FakeVectorStore(),
            idempotency_store=InMemoryIdempotencyStore(),
        )
        self.results = []
        self.progress = []

    async def _publish_result(self, env, *, status, payload=None, error=None):
        self.results.append((status, payload, error))

    async def _publish_progress(self, env, *, stage, progress=None, detail=None):
        self.progress.append({"stage": stage, "progress": progress, "detail": detail})


def make_subtopics():
    return [
        {
            "id": "sub-1",
            "title": "Graphs 101",
            "summary": "overview",
            "full_content": "Graphs are structures made of nodes and edges.",
            "tokenized_chunks": [
                "Graphs are structures made of nodes.",
                "Edges connect nodes.",
            ],
            "chunk_embeddings": [[0.1] * 384, [0.2] * 384],
        }
    ]


def test_index_stage_uses_canonical_units_when_source_manifest_exists(worker, monkeypatch):
    subtopics = make_subtopics()
    subtopics[0]["source_spans"] = [
        {
            "chunkId": "chk_source",
            "documentId": "doc_source",
            "pageNumber": 1,
            "lineStart": 1,
            "lineEnd": 1,
        }
    ]
    calls = []

    def canonical_units(manifest, units):
        calls.append((manifest, units))
        return ["Graphs connect nodes."], [{"chunk_id": "chk_source"}]

    monkeypatch.setattr(
        "services.vector_store.revision_artifacts.canonical_units_for_index",
        canonical_units,
    )
    monkeypatch.setattr(
        "services.vector_store.embedder.get_embedder",
        lambda: SimpleNamespace(encode=lambda chunks: __import__("numpy").zeros((len(chunks), 384), dtype="float32")),
    )
    result = worker._index_stage(
        "6ae7ff644dd60a8f44879e84",
        subtopics,
        [],
        {},
        {},
        0,
        revision_id="rev_test",
        manifest={
            "schemaVersion": "1.0.0",
            "courseId": "6ae7ff644dd60a8f44879e84",
            "revisionId": "rev_test",
            "contentHash": "sha256:" + "a" * 64,
            "documents": [],
            "manifestDigest": "sha256:" + "b" * 64,
        },
    )
    assert calls and calls[0][1][0]["text"] == subtopics[0]["full_content"]
    assert result["contentDocument"]["chapters"][0]["lessons"][0]["blocks"][0]["type"] == "source_lesson"
    assert result["stats"]["indexedChunks"] == 1


def _envelope():
    return SimpleNamespace(messageId=str(uuid.uuid4()), correlationId="c", userId="u")


@pytest.fixture(autouse=True)
def operation_is_current(monkeypatch):
    """The fencing check is an API call; default to a still-current dispatch."""
    monkeypatch.setattr(
        api_service, "ingestion_operation_is_current", lambda *a, **k: True
    )


@pytest.fixture
def worker(tmp_path):
    return RecordingIngestionWorker(tmp_path)


async def test_pipeline_completes_and_emits_progress_in_order(worker, tmp_path):
    subtopics = make_subtopics()
    worker._parse_stage = lambda req, manifest: (
        subtopics,
        3,
        ["uploads/courses/course-1/a.pdf"],
    )
    worker._enrich_stage = lambda st, _title=None: (
        st,
        {"extracted": 5, "truncated": 0, "dropped_duplicates": 1, "warnings": []},
        {"classified": 4, "needs_review": 1, "failed": 0, "warnings": []},
    )
    worker._embed_stage = lambda st: (st, 2)

    env = _envelope()
    result = await worker.handle(dict(INGEST_PAYLOAD), env)

    assert [p["stage"] for p in worker.progress] == [
        "parsing",
        "enriching",
        "embedding",
        "indexing",
        "indexing",
    ]
    assert [p["progress"] for p in worker.progress] == [0.1, 0.35, 0.6, 0.8, 1.0]

    assert result["courseId"] == "course-1"
    assert result["status"] == "completed"
    assert result["stats"]["subtopics"] == 1
    assert result["stats"]["chunks"] == 2
    assert result["stats"]["vectorStoreIndexed"] is True
    assert result["stats"]["objectivesExtracted"] == 5
    assert result["stats"]["objectivesClassified"] == 4

    # vector store received flattened chunks + embeddings + metadata
    assert len(worker.vector_store.added) == 1
    added = worker.vector_store.added[0]
    assert added["course_id"] == "course-1"
    assert added["num"] == 2
    assert added["metas"][0]["subtopic_id"] == "sub-1"

    # result course JSON is stripped of vectors
    sub = result["course"]["topics"][0]["subtopics"][0]
    assert "tokenized_chunks" not in sub
    assert "chunk_embeddings" not in sub


async def test_no_dedup_defaults_when_stages_produce_nothing(worker, tmp_path):
    worker._parse_stage = lambda req, manifest: ([], 0, [])
    worker._enrich_stage = lambda st, _title=None: (st, {}, {})
    worker._embed_stage = lambda st: (st, 0)

    with pytest.raises(TerminalError):
        await worker.handle(dict(INGEST_PAYLOAD), _envelope())


async def test_concurrent_jobs_keep_their_own_revision_manifest(worker, monkeypatch):
    first, second = str(uuid.uuid4()), str(uuid.uuid4())

    def revision(course_id, revision_tag):
        return {
            "contentHash": "sha256:" + course_id[0] * 64,
            "sourceManifest": [
                {"documentId": course_id, "storageRef": "originals/example"}
            ],
        }

    monkeypatch.setattr(api_service, "ingestion_revision", revision)
    arrived = 0
    ready = asyncio.Event()
    observed = []

    async def progress(envelope, *, stage, **kwargs):
        nonlocal arrived
        if stage == "parsing":
            arrived += 1
            if arrived == 2:
                ready.set()
            await asyncio.wait_for(ready.wait(), timeout=5)

    def parse(request, manifest):
        observed.append(("parse", request.courseId, manifest["courseId"]))
        return make_subtopics(), 1, []

    def index(course, *args, manifest, **kwargs):
        observed.append(("index", course, manifest["courseId"]))
        return {"courseId": course}

    worker._publish_progress = progress
    worker._parse_stage = parse
    worker._enrich_stage = lambda subtopics, _title=None: (subtopics, {}, {})
    worker._embed_stage = lambda subtopics: (subtopics, 0)
    worker._index_stage = index
    payloads = [
        {**INGEST_PAYLOAD, "courseId": course, "revisionId": "rev_1"}
        for course in (first, second)
    ]
    results = await asyncio.gather(
        *(worker.handle(p, _envelope()) for p in payloads)
    )
    assert {r["courseId"] for r in results} == {first, second}
    assert len(observed) == 4
    assert all(course == manifest_course for _, course, manifest_course in observed)


def test_build_request_rejects_invalid_payload(worker):
    with pytest.raises(TerminalError):
        worker._build_request({"courseId": "c"})  # fileRef missing
    with pytest.raises(TerminalError):
        worker._build_request("not-an-object")
    with pytest.raises(TerminalError):
        worker._build_request({**INGEST_PAYLOAD, "extraField": True})


# ------------------------------------------------------------------ resolve


def test_resolve_path_reads_staged_text_file(worker, tmp_path):
    (tmp_path / "courses" / "course-1").mkdir(parents=True)
    target = tmp_path / "courses" / "course-1" / "notes-a1b2.md"
    target.write_text("Hello world\n", encoding="utf-8")
    meta = SimpleNamespace(
        path="courses/course-1/notes-a1b2.md",
        filename="notes.md",
        mimetype="text/plain",
    )
    path = worker._resolve_path(meta, "uploads/courses/course-1")
    assert path == target.resolve()


def test_resolve_path_falls_back_to_file_ref_filename(worker, tmp_path):
    (tmp_path / "courses" / "course-2").mkdir(parents=True)
    target = tmp_path / "courses" / "course-2" / "fallback.txt"
    target.write_text("x", encoding="utf-8")
    meta = SimpleNamespace(path=None, filename="fallback.txt", mimetype="text/plain")
    assert worker._resolve_path(meta, "uploads/courses/course-2") == target.resolve()


def test_resolve_path_rejects_path_traversal(worker, tmp_path):
    meta = SimpleNamespace(
        path="../../etc/passwd", filename="evil", mimetype="text/plain"
    )
    with pytest.raises(TerminalError):
        worker._resolve_path(meta, "uploads/courses/course-1")


def test_resolve_path_rejects_missing_file(worker, tmp_path):
    meta = SimpleNamespace(
        path="courses/course-1/nope.pdf",
        filename="nope.pdf",
        mimetype="application/pdf",
    )
    with pytest.raises(TerminalError):
        worker._resolve_path(meta, "uploads/courses/course-1")


def test_resolve_path_rejects_unmounted_root(worker):
    worker._uploads_root = worker._uploads_root / "does-not-exist"
    meta = SimpleNamespace(
        path="courses/course-1/a.pdf", filename="a.pdf", mimetype="application/pdf"
    )
    with pytest.raises(TerminalError):
        worker._resolve_path(meta, "uploads/courses/course-1")


# ---------------------------------------------------------------- extraction


def test_extract_text_reads_text_files_directly(worker, tmp_path):
    target = tmp_path / "courses" / "course-1" / "notes-a1b2.md"
    target.parent.mkdir(parents=True)
    target.write_text("markdown content\n", encoding="utf-8")
    meta = SimpleNamespace(
        path="courses/course-1/notes-a1b2.md",
        filename="notes.md",
        mimetype="text/markdown",
    )
    assert worker._extract_text(meta, target) == "markdown content\n"


def test_extract_text_rejects_non_utf8(worker, tmp_path):
    target = tmp_path / "bad.bin"
    target.write_bytes(b"\xff\xfe\x00\x80")
    meta = SimpleNamespace(path="bad.bin", filename="bad.bin", mimetype="text/plain")
    with pytest.raises(TerminalError):
        worker._extract_text(meta, target)


def test_extract_text_pdf_rejection_is_terminal(worker, tmp_path, monkeypatch):
    from agents.course_ingestion.extraction import pdf_loader
    from agents.course_ingestion.extraction.pdf_loader import PdfValidationError

    target = tmp_path / "malformed.pdf"
    target.write_bytes(b"%PDF-1.7\n")
    meta = SimpleNamespace(
        path="malformed.pdf", filename="malformed.pdf", mimetype="application/pdf"
    )

    def boom(path):
        raise PdfValidationError("PDF parsing failed: truncated")

    monkeypatch.setattr(pdf_loader, "extract_text_from_pdf_sandboxed", boom)
    with pytest.raises(TerminalError):
        worker._extract_text(meta, target)


def test_extract_text_pdf_timeout_is_retryable(worker, tmp_path, monkeypatch):
    from agents.course_ingestion.extraction import pdf_loader
    from agents.course_ingestion.extraction.pdf_loader import PdfParseTimeoutError

    target = tmp_path / "hung.pdf"
    target.write_bytes(b"%PDF-1.7\n")
    meta = SimpleNamespace(
        path="hung.pdf", filename="hung.pdf", mimetype="application/pdf"
    )

    def boom(path):
        raise PdfParseTimeoutError("parse timed out after 45s")

    monkeypatch.setattr(pdf_loader, "extract_text_from_pdf_sandboxed", boom)
    with pytest.raises(PdfParseTimeoutError):  # NOT rewrapped → retryable
        worker._extract_text(meta, target)


def test_extract_text_uses_ocr_fallback_for_image_pdf(worker, tmp_path, monkeypatch):
    from agents.course_ingestion.extraction import ocr, pdf_loader

    target = tmp_path / "scanned.pdf"
    target.write_bytes(b"%PDF-1.7\n")
    meta = SimpleNamespace(
        path="scanned.pdf", filename="scanned.pdf", mimetype="application/pdf"
    )

    monkeypatch.setattr(
        pdf_loader, "extract_text_from_pdf_sandboxed", lambda p: "\n"
    )  # < 50 chars
    monkeypatch.setattr(ocr, "ocr_pdf", lambda p: "OCR EXTRACTED TEXT")
    assert worker._extract_text(meta, target) == "OCR EXTRACTED TEXT"


# ------------------------------------------------------------------ helpers


def test_flatten_chunk_records_builds_metadatas():
    course_json = normalize_course_wrapped()
    chunks, embeddings, metas = _flatten_chunk_records("course-1", course_json)
    assert chunks == ["chunk a", "chunk b"]
    assert embeddings.shape == (2, 384)
    assert metas[0]["course_id"] == "course-1"
    assert metas[0]["topic_id"] == "topic_1"
    assert metas[0]["subtopic_title"] == "Intro"


def test_strip_vectors_removes_heavy_fields():
    course = {
        "topics": [
            {
                "subtopics": [
                    {"tokenized_chunks": ["a"], "chunk_embeddings": [[1.0]], "id": "s"}
                ]
            }
        ]
    }
    stripped = _strip_vectors(course)
    sub = stripped["topics"][0]["subtopics"][0]
    assert "tokenized_chunks" not in sub
    assert "chunk_embeddings" not in sub
    assert sub["id"] == "s"


def normalize_course_wrapped():
    from agents.course_ingestion.normalization.schema import (
        CourseKnowledgeJSON,
        Subtopic,
        Topic,
    )

    sub = Subtopic(
        id="sub-1",
        title="Intro",
        summary="s",
        tokenized_chunks=["chunk a", "chunk b"],
        chunk_embeddings=[[0.1] * 384, [0.2] * 384],
    )
    topic = Topic(id="topic_1", title="T", summary="s", subtopics=[sub])
    return CourseKnowledgeJSON(
        course_title="course-1", source_files=["a.pdf"], topics=[topic]
    )


# ------------------------------------------------- real progress wire path


async def test_real_progress_publish_uses_progress_routing_key(tmp_path):

    worker = IngestionWorker(
        uploads_root=str(tmp_path),
        vector_store=FakeVectorStore(),
        idempotency_store=InMemoryIdempotencyStore(),
    )

    class FakeExchange:
        def __init__(self):
            self.published = []

        async def publish(self, message, routing_key):
            self.published.append((routing_key, json.loads(message.body)))

    class FakeChannel:
        def __init__(self):
            self.exchange = FakeExchange()

        async def get_exchange(self, name):
            return self.exchange

    worker._channel = FakeChannel()
    job = validate_job_envelope({**VALID_BASE, "payload": INGEST_PAYLOAD})

    await worker._publish_progress(
        job, stage="parsing", progress=0.4, detail="parsing 1 file(s)"
    )

    rk, body = worker._channel.exchange.published[0]
    assert rk == "progress"
    assert body["status"] == "progress"
    assert body["stage"] == "parsing"
    assert body["progress"] == 0.4
    assert body["type"] == "study.ingest.course"


def test_server_operation_fencing_asks_the_api_and_fails_closed(worker, monkeypatch):
    """The API owns operation state; a "not current" answer or an outage rejects."""
    request = SimpleNamespace(courseId=str(uuid.uuid4()), revisionId="rev_current")
    envelope = SimpleNamespace(
        messageId=str(uuid.uuid4()), correlationId=UUID_B, userId="owner"
    )
    calls = []
    answer = {"value": True}

    def current(message_id, **kwargs):
        calls.append((message_id, kwargs))
        return answer["value"]

    monkeypatch.setattr(api_service, "ingestion_operation_is_current", current)
    worker._ensure_current_operation(request, envelope)
    assert calls == [
        (
            envelope.messageId,
            {
                "course_id": request.courseId,
                "revision_id": "rev_current",
                "user_id": "owner",
                "job_id": envelope.messageId,
                "correlation_id": UUID_B,
            },
        )
    ]
    answer["value"] = False  # cancelled, superseded, resolved, or API unreachable
    with pytest.raises(TerminalError, match="no longer current"):
        worker._ensure_current_operation(request, envelope)

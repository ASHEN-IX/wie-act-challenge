"""Source preparation reuses the worker's immutable revision artifact."""

import pytest
from fastapi import HTTPException

from services.api.routers import sources


COURSE_ID = "a" * 24
REVISION_ID = "rev_source_test"
MANIFEST_DIGEST = "sha256:" + "b" * 64


def request():
    return sources.IndexRequest(
        schemaVersion="1.0.0",
        courseId=COURSE_ID,
        revisionId=REVISION_ID,
        contentHash="sha256:" + "c" * 64,
        documents=[{"documentId": "doc_source"}],
        manifestDigest=MANIFEST_DIGEST,
    )


class ExistingArtifactStore:
    def __init__(self):
        self.writes = 0

    def verify_revision(self, course_id, revision_id, manifest_digest):
        assert (course_id, revision_id, manifest_digest) == (
            COURSE_ID,
            REVISION_ID,
            MANIFEST_DIGEST,
        )
        return {
            "manifestDigest": MANIFEST_DIGEST,
            "indexHash": "sha256:" + "d" * 64,
        }

    def add_course(self, *args, **kwargs):
        self.writes += 1
        raise AssertionError("Existing immutable artifacts must not be rewritten")


def test_existing_revision_is_reused_without_extracting_or_embedding(monkeypatch):
    store = ExistingArtifactStore()
    monkeypatch.setattr(sources, "get_vector_store", lambda: store)
    monkeypatch.setattr(
        sources,
        "extract_documents",
        lambda _manifest: (_ for _ in ()).throw(AssertionError("must not extract")),
    )
    monkeypatch.setattr(
        sources,
        "get_embedder",
        lambda: (_ for _ in ()).throw(AssertionError("must not embed")),
    )

    response = sources.index_sources(request())

    assert response == {
        "ready": True,
        "manifestDigest": MANIFEST_DIGEST,
        "indexHash": "sha256:" + "d" * 64,
    }
    assert store.writes == 0


class ConflictingArtifactStore:
    def __init__(self):
        self.writes = 0

    def verify_revision(self, *_args):
        raise ValueError("Index checksum mismatch")

    def add_course(self, *_args, **_kwargs):
        self.writes += 1


def test_conflicting_artifact_is_not_silently_replaced(monkeypatch):
    store = ConflictingArtifactStore()
    monkeypatch.setattr(sources, "get_vector_store", lambda: store)

    with pytest.raises(HTTPException) as error:
        sources.index_sources(request())

    assert error.value.status_code == 503
    assert store.writes == 0


class EmptyStore:
    def __init__(self):
        self.written = None
        self.verified = 0

    def verify_revision(self, *_args):
        self.verified += 1
        if self.verified == 1:
            raise FileNotFoundError()
        return {
            "manifestDigest": MANIFEST_DIGEST,
            "indexHash": "sha256:" + "d" * 64,
        }

    def add_course(self, *args, **kwargs):
        self.written = (args, kwargs)
        return None


def test_canonical_units_are_indexed_when_artifact_is_absent(monkeypatch):
    store = EmptyStore()
    calls = []
    monkeypatch.setattr(sources, "get_vector_store", lambda: store)
    monkeypatch.setattr(
        sources,
        "canonical_units_for_index",
        lambda manifest, units: (
            calls.append((manifest, units)) or ["Canonical retrieval text"],
            [{"block_ids": ["blk_source"], "source_chunk_ids": ["chk_source"]}],
        ),
    )
    monkeypatch.setattr(
        sources,
        "get_embedder",
        lambda: type("Embedder", (), {"encode": lambda self, chunks: __import__("numpy").zeros((len(chunks), 384), dtype="float32")})(),
    )
    monkeypatch.setattr(
        sources,
        "extract_documents",
        lambda _manifest: (_ for _ in ()).throw(AssertionError("units must take precedence")),
    )
    req = request()
    req.units = [sources.CanonicalIndexUnit(
        text="Canonical retrieval text",
        documentIds=["doc_source"],
        blockIds=["blk_source"],
        chunkIds=["chk_source"],
        lessonId="sub_1",
    )]

    sources.index_sources(req)

    assert len(calls) == 1
    assert "units" not in calls[0][0]
    assert calls[0][1][0]["blockIds"] == ["blk_source"]
    assert store.written is not None

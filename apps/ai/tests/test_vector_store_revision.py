import json
import numpy as np
import pytest

from services.vector_store.adapter import (
    VectorStoreAdapter,
    validate_revision_id,
    get_relative_index_path,
)


class FakeStore:
    """In-memory stand-in for `ChunkEmbeddingStore`, keyed like the table."""

    def __init__(self):
        self.rows = {}

    def save(self, course_id, revision_id, chunks, metas, embeddings):
        self.rows[(course_id, revision_id or "")] = {
            "chunks": chunks,
            "metas": metas,
            "embeddings": np.asarray(embeddings, dtype="float32"),
        }

    def load(self, course_id, revision_id):
        return self.rows.get((course_id, revision_id or ""))


def test_validate_revision_id_security():
    assert validate_revision_id("rev_1") == "rev_1"
    with pytest.raises(ValueError):
        validate_revision_id("rev-20261023-v1.0")

    with pytest.raises(ValueError):
        validate_revision_id("../traversal")
    with pytest.raises(ValueError):
        validate_revision_id("rev/nested")
    with pytest.raises(ValueError):
        validate_revision_id("")


def test_get_relative_index_path():
    assert get_relative_index_path("course-1") == "faiss/course-1.faiss"
    assert get_relative_index_path("course-1", "rev_1") == "faiss/course-1/rev_1.faiss"


def test_vector_store_revision_indexing_and_search(tmp_path, monkeypatch):
    monkeypatch.setattr("services.vector_store.adapter.FAISS_INDEX_DIR", tmp_path)

    store = FakeStore()
    vs = VectorStoreAdapter(store=store)

    course_id = "course-123"
    rev1 = "rev_20261023_v1"
    rev2 = "rev_20261023_v2"

    chunks1 = ["Calculus limits and continuity", "Derivatives of polynomials"]
    emb1 = np.ones((len(chunks1), 384), dtype="float32")
    emb1 = emb1 / np.linalg.norm(emb1, axis=1, keepdims=True)
    meta1 = [
        {
            "chunk_id": "chk_1",
            "course_id": course_id,
            "revision_id": rev1,
            "provenance": "extracted",
            "page_number": 1,
            "ambiguity_flag": False,
        },
        {
            "chunk_id": "chk_2",
            "course_id": course_id,
            "revision_id": rev1,
            "provenance": "extracted",
            "page_number": 2,
            "ambiguity_flag": False,
        },
    ]

    vs.add_course(course_id, chunks1, emb1, meta1, revision_id=rev1)

    # Check files on disk
    index_file1 = tmp_path / course_id / f"{rev1}.faiss"
    meta_file1 = tmp_path / course_id / f"{rev1}.meta.json"
    assert index_file1.exists(), "Revision 1 FAISS index written to disk"
    assert meta_file1.exists(), "Revision 1 metadata written to disk"

    meta_content = json.loads(meta_file1.read_text())
    assert meta_content["chunks"] == chunks1
    assert meta_content["metas"][0]["provenance"] == "extracted"
    assert meta_content["metas"][0]["page_number"] == 1

    # Check durable storage
    doc1 = store.load(course_id, rev1)
    assert doc1 is not None
    assert len(doc1["chunks"]) == 2

    # Now index revision 2 with distinct content
    chunks2 = ["Integral calculus and Riemann sums", "Fundamental theorem of calculus"]
    emb2 = np.full((len(chunks2), 384), 0.5, dtype="float32")
    emb2 = emb2 / np.linalg.norm(emb2, axis=1, keepdims=True)
    meta2 = [
        {
            "chunk_id": "chk_3",
            "course_id": course_id,
            "revision_id": rev2,
            "provenance": "ai_generated",
            "page_number": None,
            "ambiguity_flag": False,
        },
        {
            "chunk_id": "chk_4",
            "course_id": course_id,
            "revision_id": rev2,
            "provenance": "manual",
            "page_number": 4,
            "ambiguity_flag": False,
        },
    ]

    vs.add_course(course_id, chunks2, emb2, meta2, revision_id=rev2)

    index_file2 = tmp_path / course_id / f"{rev2}.faiss"
    meta_file2 = tmp_path / course_id / f"{rev2}.meta.json"
    assert index_file2.exists(), "Revision 2 FAISS index written to disk"
    assert meta_file2.exists(), "Revision 2 metadata written to disk"

    # Both revisions coexist independently on disk
    assert index_file1.exists()
    assert index_file2.exists()

    # Search revision 1
    query_vec = emb1[0]
    res1 = vs.search(course_id, query_vec, k=1, revision_id=rev1)
    assert len(res1) == 1
    assert res1[0]["chunk"] == chunks1[0]
    assert res1[0]["meta"]["revision_id"] == rev1

    # Search revision 2
    res2 = vs.search(course_id, query_vec, k=1, revision_id=rev2)
    assert len(res2) == 1
    assert res2[0]["meta"]["revision_id"] == rev2
    assert res2[0]["chunk"] in chunks2

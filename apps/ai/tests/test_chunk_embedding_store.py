"""`ChunkEmbeddingStore` against real PostgreSQL (the `ai_db` fixture)."""

import numpy as np

from services.vector_store.adapter import ChunkEmbeddingStore


def _vectors(count=3, fill=0.1):
    return np.full((count, 384), fill, dtype="float32")


def test_round_trips_chunks_metas_and_vectors(ai_db):
    store = ChunkEmbeddingStore()
    vectors = np.random.default_rng(0).random((3, 384), dtype="float32")
    store.save("course-1", "rev_1", ["a", "b", "c"], [{"n": 1}, {"n": 2}, {"n": 3}], vectors)

    loaded = store.load("course-1", "rev_1")

    assert loaded["chunks"] == ["a", "b", "c"]
    assert loaded["metas"][2] == {"n": 3}
    assert loaded["embeddings"].dtype == np.float32
    assert np.array_equal(loaded["embeddings"], vectors)


def test_saving_again_replaces_the_row(ai_db):
    store = ChunkEmbeddingStore()
    store.save("course-1", None, ["old"], [{}], _vectors(1, 0.1))
    store.save("course-1", None, ["new-1", "new-2"], [{}, {}], _vectors(2, 0.9))

    loaded = store.load("course-1", None)

    assert loaded["chunks"] == ["new-1", "new-2"]
    assert loaded["embeddings"].shape == (2, 384)
    with ai_db.connection() as conn:
        assert conn.execute("SELECT count(*) AS n FROM ai.chunk_embeddings").fetchone()["n"] == 1


def test_revisions_are_independent_rows(ai_db):
    store = ChunkEmbeddingStore()
    store.save("course-1", "rev_1", ["one"], [{}], _vectors(1))
    store.save("course-1", "rev_2", ["two"], [{}], _vectors(1))
    store.save("course-1", None, ["legacy"], [{}], _vectors(1))

    assert store.load("course-1", "rev_1")["chunks"] == ["one"]
    assert store.load("course-1", "rev_2")["chunks"] == ["two"]
    assert store.load("course-1", None)["chunks"] == ["legacy"]
    assert store.load("course-1", "rev_3") is None
    assert store.load("course-2", "rev_1") is None

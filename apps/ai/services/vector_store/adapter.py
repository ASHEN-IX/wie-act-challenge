"""
Vector store adapter — FAISS IndexFlatIP backed by MongoDB embedding storage.

Responsibilities:
  - Store raw chunk vectors in MongoDB (collection: chunk_embeddings)
  - Build an in-memory FAISS IndexFlatIP per course
  - Persist FAISS indices to disk (FAISS_INDEX_DIR)
  - Search: encode a query → retrieve top-k chunks with metadata

Usage:
    from services.vector_store.adapter import get_vector_store
    vs = get_vector_store()
    vs.add_course(course_id, chunks, embeddings, metadatas)
    results = vs.search(course_id, query_text, k=5)
"""

from __future__ import annotations

import os
import tempfile
import hashlib
import json
import re
import numpy as np
import faiss
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from functools import lru_cache

from services.vector_store.embedder import get_embedder
from services.vector_store.revision_artifacts import validate_artifact, byte_hash
from utils.logger import get_logger

logger = get_logger(__name__)

FAISS_INDEX_DIR = Path(os.getenv("FAISS_INDEX_DIR", "/tmp/ednova_faiss"))
CHUNK_EMBED_COLLECTION = "chunk_embeddings"

# course_id is used to build filesystem paths (<id>.faiss) — restrict to a
# safe charset to prevent path traversal.
_COURSE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{1,128}$")
_REVISION_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-]{0,127}$")


def validate_course_id(course_id: str) -> str:
    if not isinstance(course_id, str) or not _COURSE_ID_RE.match(course_id):
        raise ValueError(f"Invalid course_id: {course_id!r}")
    return course_id


def validate_revision_id(revision_id: str) -> str:
    if not isinstance(revision_id, str) or not _REVISION_ID_RE.match(revision_id):
        raise ValueError(f"Invalid revision_id: {revision_id!r}")
    return revision_id


def get_relative_index_path(course_id: str, revision_id: Optional[str] = None) -> str:
    validate_course_id(course_id)
    if revision_id:
        validate_revision_id(revision_id)
        return f"faiss/{course_id}/{revision_id}.faiss"
    return f"faiss/{course_id}.faiss"


def _make_key(course_id: str, revision_id: Optional[str] = None) -> str:
    return f"{course_id}:{revision_id}" if revision_id else course_id


def _get_paths(course_id: str, revision_id: Optional[str] = None) -> Tuple[Path, Path]:
    validate_course_id(course_id)
    if revision_id:
        validate_revision_id(revision_id)
        course_dir = FAISS_INDEX_DIR / course_id
        course_dir.mkdir(parents=True, exist_ok=True)
        return (
            course_dir / f"{revision_id}.faiss",
            course_dir / f"{revision_id}.meta.json",
        )
    return (
        FAISS_INDEX_DIR / f"{course_id}.faiss",
        FAISS_INDEX_DIR / f"{course_id}.meta.json",
    )


class VectorStoreAdapter:
    """
    Per-course FAISS index with MongoDB persistence for the raw embeddings.

    Index layout:
        _indices[course_id] = {
            "index": faiss.Index,
            "chunks": list[str],
            "metas":  list[dict],
        }
    """

    DIM = 384

    def __init__(self, db) -> None:
        """
        Args:
            db: pymongo Database object (pass None for test / offline mode).
        """
        self._db = db
        self._indices: Dict[str, Dict[str, Any]] = {}
        FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------ #
    # Public API                                                           #
    # ------------------------------------------------------------------ #

    def add_course(
        self,
        course_id: str,
        chunks: List[str],
        embeddings: np.ndarray,
        metadatas: Optional[List[Dict[str, Any]]] = None,
        revision_id: Optional[str] = None,
        artifact: Optional[dict] = None,
    ) -> None:
        """
        Build (or rebuild) the FAISS index for *course_id* from pre-computed embeddings.

        Side-effects:
          - Persists embeddings to MongoDB (upsert by course_id and optional revision_id).
          - Saves the FAISS index to FAISS_INDEX_DIR/<course_id>.faiss or
            FAISS_INDEX_DIR/<course_id>/<revision_id>.faiss + .meta.json.

        Args:
            course_id:    Unique course identifier.
            chunks:       Parallel list of text chunks.
            embeddings:   np.ndarray shape (N, 384), float32, L2-normalised.
            metadatas:    Optional per-chunk metadata dicts.
            revision_id:  Optional revision tag/identifier (e.g. rev_20261023_v1).
        """
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings must have the same length")

        validate_course_id(course_id)
        if revision_id:
            validate_revision_id(revision_id)
        metadatas = metadatas or [{} for _ in chunks]
        if len(metadatas) != len(chunks):
            raise ValueError("Metadata count mismatch")
        n = len(chunks)

        # Build FAISS index
        index = faiss.IndexFlatIP(self.DIM)
        index.add(embeddings.astype("float32"))

        key = _make_key(course_id, revision_id)
        self._indices[key] = {
            "index": index,
            "chunks": chunks,
            "metas": metadatas,
            "artifact": artifact,
        }

        # Persist to disk
        self._save_index(course_id, revision_id)

        # Persist raw embeddings to MongoDB
        if self._db is not None:
            self._save_embeddings_to_mongo(
                course_id, chunks, embeddings, metadatas, revision_id
            )

        logger.info(
            "vector_store_course_indexed",
            extra={"course_id": course_id, "revision_id": revision_id, "num_chunks": n},
        )

    def add_texts(
        self,
        course_id: str,
        chunks: List[str],
        metadatas: Optional[List[Dict[str, Any]]] = None,
        revision_id: Optional[str] = None,
    ) -> np.ndarray:
        """
        Encode *chunks* on-the-fly, store in the index and return the embeddings.

        Useful for agents that do not have pre-computed embeddings.
        """
        embedder = get_embedder()
        embeddings = embedder.encode(chunks)
        self.add_course(
            course_id, chunks, embeddings, metadatas, revision_id=revision_id
        )
        return embeddings

    def search(
        self,
        course_id: str,
        query: str | np.ndarray,
        k: int = 5,
        revision_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top-*k* most similar chunks for a *query*.

        Args:
            course_id:    Course to search within.
            query:        Either a plain text string (will be encoded) or a
                          float32 vector of shape (384,).
            k:            Number of results to return.
            revision_id:  Optional revision tag/identifier.

        Returns:
            List of dicts with keys: chunk, score, meta, rank.
        """
        validate_course_id(course_id)
        if revision_id:
            validate_revision_id(revision_id)
        entry = self._ensure_loaded(course_id, revision_id)
        if entry is None:
            return []

        index: faiss.Index = entry["index"]
        chunks: List[str] = entry["chunks"]
        metas: List[dict] = entry["metas"]

        if isinstance(query, str):
            q_vec = get_embedder().encode_one(query)
        else:
            q_vec = query.astype("float32")

        q_vec = q_vec.reshape(1, -1)

        k = min(k, index.ntotal)
        if k == 0:
            return []

        scores, idxs = index.search(q_vec, k)
        results = []
        for rank, (score, idx) in enumerate(zip(scores[0], idxs[0])):
            if idx == -1:
                continue
            results.append(
                {
                    "chunk": chunks[idx],
                    "score": float(score),
                    "meta": metas[idx],
                    "rank": rank,
                }
            )
        return results

    def load_course(self, course_id: str, revision_id: Optional[str] = None) -> bool:
        """
        Explicitly load a course index from disk / MongoDB.

        Returns True if loaded successfully, False if not found.
        """
        return self._ensure_loaded(course_id, revision_id) is not None

    def delete_course(self, course_id: str, revision_id: Optional[str] = None) -> None:
        """Remove the FAISS index from memory and disk."""
        validate_course_id(course_id)
        if revision_id:
            validate_revision_id(revision_id)
        key = _make_key(course_id, revision_id)
        self._indices.pop(key, None)
        index_path, meta_path = _get_paths(course_id, revision_id)
        for p in (index_path, meta_path):
            try:
                p.unlink()
            except FileNotFoundError:
                pass
        logger.info(
            "vector_store_course_deleted",
            extra={"course_id": course_id, "revision_id": revision_id},
        )

    # ------------------------------------------------------------------ #
    # Internal helpers                                                     #
    # ------------------------------------------------------------------ #

    def _ensure_loaded(
        self, course_id: str, revision_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        validate_course_id(course_id)
        if revision_id:
            validate_revision_id(revision_id)
        key = _make_key(course_id, revision_id)
        if key in self._indices:
            return self._indices[key]

        # Try disk
        if self._load_index_from_disk(course_id, revision_id):
            return self._indices[key]

        # Try MongoDB
        if self._db is not None and self._load_index_from_mongo(course_id, revision_id):
            return self._indices[key]

        logger.warning(
            "vector_store_course_not_found",
            extra={"course_id": course_id, "revision_id": revision_id},
        )
        return None

    # -- Disk I/O -------------------------------------------------------- #

    def _save_index(self, course_id: str, revision_id: Optional[str] = None) -> None:
        index_path, meta_path = _get_paths(course_id, revision_id)
        key = _make_key(course_id, revision_id)
        entry = self._indices[key]
        artifact = entry.get("artifact")
        index_bytes = faiss.serialize_index(entry["index"]).tobytes()
        meta = {**(artifact or {}), "chunks": entry["chunks"], "metas": entry["metas"]}
        if artifact:
            if not revision_id:
                raise ValueError("Published artifact requires revision")
            meta["indexHash"] = byte_hash(index_bytes)
            validate_artifact(meta, course_id, revision_id, index_bytes)
            if meta_path.exists():
                existing = json.loads(meta_path.read_text())
                if (
                    existing != meta
                    or not index_path.exists()
                    or index_path.read_bytes() != index_bytes
                ):
                    raise ValueError(
                        "Immutable index already exists; prepare a new revision"
                    )
                return
        # Index first, sidecar last is the commit marker. A partial pair never
        # passes checksum validation. Never reinterpret a legacy pair as ready.
        for target, payload in [
            (index_path, index_bytes),
            (meta_path, json.dumps(meta, ensure_ascii=False, sort_keys=True).encode()),
        ]:
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(
                dir=target.parent, delete=False
            ) as staging:
                staging.write(payload)
                staging.flush()
                os.fsync(staging.fileno())
                os.fchmod(staging.fileno(), 0o444 if artifact else 0o644)
                temporary = staging.name
            try:
                if artifact:
                    try:
                        os.link(temporary, target)
                    except FileExistsError:
                        if target.read_bytes() != payload:
                            raise ValueError("Concurrent immutable artifact conflict")
                else:
                    os.replace(temporary, target)
            finally:
                if os.path.exists(temporary):
                    os.unlink(temporary)

    def verify_revision(
        self, course_id, revision_id, manifest_digest=None, artifact_hash=None
    ):
        validate_course_id(course_id)
        validate_revision_id(revision_id)
        index_path, meta_path = _get_paths(course_id, revision_id)
        metadata_bytes = meta_path.read_bytes()
        if artifact_hash and byte_hash(metadata_bytes) != artifact_hash:
            raise ValueError("Sidecar identity mismatch")
        meta = json.loads(metadata_bytes)
        validate_artifact(meta, course_id, revision_id, index_path.read_bytes())
        if manifest_digest and meta["manifestDigest"] != manifest_digest:
            raise ValueError("Wrong source manifest")
        index = faiss.read_index(str(index_path))
        if index.d != self.DIM or index.ntotal != len(meta["chunks"]):
            raise ValueError("FAISS shape mismatch")
        return meta

    def search_revision(self, course_id, revision_id, query, manifest_digest, k=5):
        meta = self.verify_revision(course_id, revision_id, manifest_digest)
        # Do not trust a stale cached pair after a disk replacement or restart.
        self._indices.pop(_make_key(course_id, revision_id), None)
        return self.search(course_id, query, k, revision_id)

    def _load_index_from_disk(
        self, course_id: str, revision_id: Optional[str] = None
    ) -> bool:
        index_path, meta_path = _get_paths(course_id, revision_id)
        if not (index_path.exists() and meta_path.exists()):
            return False
        key = _make_key(course_id, revision_id)
        try:
            index = faiss.read_index(str(index_path))
            meta = json.loads(meta_path.read_text())
            if meta.get("schemaVersion"):
                validate_artifact(meta, course_id, revision_id, index_path.read_bytes())
            self._indices[key] = {
                "index": index,
                "chunks": meta["chunks"],
                "metas": meta["metas"],
            }
            logger.info(
                "vector_store_loaded_from_disk",
                extra={
                    "course_id": course_id,
                    "revision_id": revision_id,
                    "num_chunks": index.ntotal,
                },
            )
            return True
        except Exception as exc:
            logger.warning(
                "vector_store_disk_load_failed",
                extra={
                    "course_id": course_id,
                    "revision_id": revision_id,
                    "error": str(exc),
                },
            )
            return False

    # -- MongoDB I/O ----------------------------------------------------- #

    def _save_embeddings_to_mongo(
        self,
        course_id: str,
        chunks: List[str],
        embeddings: np.ndarray,
        metadatas: List[Dict[str, Any]],
        revision_id: Optional[str] = None,
    ) -> None:
        col = self._db[CHUNK_EMBED_COLLECTION]
        doc = {
            "course_id": course_id,
            "chunks": chunks,
            "metas": metadatas,
            "embeddings": embeddings.tolist(),
        }
        filter_query = {"course_id": course_id, "revision_id": revision_id}
        if revision_id:
            doc["revision_id"] = revision_id
            filter_query["revision_id"] = revision_id
        col.update_one(filter_query, {"$set": doc}, upsert=True)

    def _load_index_from_mongo(
        self, course_id: str, revision_id: Optional[str] = None
    ) -> bool:
        try:
            col = self._db[CHUNK_EMBED_COLLECTION]
            filter_query = {"course_id": course_id, "revision_id": revision_id}
            if revision_id:
                filter_query["revision_id"] = revision_id
            doc = col.find_one(filter_query)
            if doc is None:
                return False
            chunks = doc["chunks"]
            metas = doc["metas"]
            embeddings = np.array(doc["embeddings"], dtype="float32")

            index = faiss.IndexFlatIP(self.DIM)
            index.add(embeddings)
            key = _make_key(course_id, revision_id)
            self._indices[key] = {
                "index": index,
                "chunks": chunks,
                "metas": metas,
            }
            # Cache to disk for next restart
            self._save_index(course_id, revision_id)
            logger.info(
                "vector_store_loaded_from_mongo",
                extra={
                    "course_id": course_id,
                    "revision_id": revision_id,
                    "num_chunks": len(chunks),
                },
            )
            return True
        except Exception as exc:
            logger.warning(
                "vector_store_mongo_load_failed",
                extra={
                    "course_id": course_id,
                    "revision_id": revision_id,
                    "error": str(exc),
                },
            )
            return False


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStoreAdapter:
    """
    Process-level singleton.  Imports MongoDB connection lazily to avoid
    circular imports at module load time.
    """
    from services.database import get_db  # noqa: PLC0415

    db = None
    try:
        db = get_db()
    except Exception:
        logger.warning("vector_store_no_db", extra={"reason": "could not connect"})
    return VectorStoreAdapter(db)

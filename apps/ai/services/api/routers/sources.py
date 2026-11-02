"""Internal service-authenticated explicit revision indexing; no provider calls."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing import Annotated
from services.vector_store.revision_artifacts import (
    canonical_units_for_index,
    extract_documents,
)
from services.vector_store.adapter import get_vector_store
from services.vector_store.embedder import get_embedder

router = APIRouter(prefix="/api/ai/sources", tags=["sources"])

IndexId = Annotated[str, StringConstraints(min_length=1, max_length=128)]


class CanonicalIndexUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(min_length=1, max_length=2_000)
    documentIds: list[IndexId] = Field(min_length=1, max_length=32)
    blockIds: list[IndexId] = Field(min_length=1, max_length=40)
    chunkIds: list[IndexId] = Field(min_length=1, max_length=400)
    lessonId: IndexId


class IndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: str = Field(pattern=r"^1\.0\.0$")
    courseId: str = Field(pattern=r"^[a-f0-9]{24}$")
    revisionId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
    contentHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    documents: list[dict] = Field(min_length=1, max_length=32)
    manifestDigest: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    units: list[CanonicalIndexUnit] | None = Field(default=None, max_length=2_000)


@router.post("/index")
def index_sources(req: IndexRequest):
    try:
        manifest = req.model_dump(exclude={"units"})
        store = get_vector_store()
        try:
            # The ingestion worker publishes this immutable artifact before it
            # calls the source-preparation endpoint. Reusing that exact
            # revision is success; embedding it a second time would attempt an
            # unauthorized replacement of the immutable index.
            meta = store.verify_revision(
                req.courseId, req.revisionId, req.manifestDigest
            )
            return {
                "ready": True,
                "manifestDigest": meta["manifestDigest"],
                "indexHash": meta["indexHash"],
            }
        except FileNotFoundError:
            pass
        # A malformed or conflicting artifact is not treated as absent. Let
        # the 503 boundary report it without replacing source data.
        if req.units:
            chunks, metas = canonical_units_for_index(
                manifest, [unit.model_dump() for unit in req.units]
            )
        else:
            chunks, metas = extract_documents(manifest)
        vectors = get_embedder().encode(chunks)
        store.add_course(
            req.courseId,
            chunks,
            vectors,
            metas,
            revision_id=req.revisionId,
            artifact=manifest,
        )
        meta = store.verify_revision(req.courseId, req.revisionId, req.manifestDigest)
        return {
            "ready": True,
            "manifestDigest": meta["manifestDigest"],
            "indexHash": meta["indexHash"],
        }
    except Exception as exc:
        raise HTTPException(503, "Exact source indexing unavailable") from exc

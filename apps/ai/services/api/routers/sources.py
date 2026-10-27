"""Internal service-authenticated explicit revision indexing; no provider calls."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from services.vector_store.revision_artifacts import extract_documents
from services.vector_store.adapter import get_vector_store
from services.vector_store.embedder import get_embedder

router = APIRouter(prefix="/api/ai/sources", tags=["sources"])


class IndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: str = Field(pattern=r"^1\.0\.0$")
    courseId: str = Field(pattern=r"^[a-f0-9]{24}$")
    revisionId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
    contentHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    documents: list[dict] = Field(min_length=1, max_length=32)
    manifestDigest: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")


@router.post("/index")
def index_sources(req: IndexRequest):
    try:
        manifest = req.model_dump()
        chunks, metas = extract_documents(manifest)
        vectors = get_embedder().encode(chunks)
        store = get_vector_store()
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

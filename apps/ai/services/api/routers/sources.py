"""Internal service-authenticated explicit revision indexing; no provider calls."""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing import Annotated, Literal
import hashlib
from threading import BoundedSemaphore

_CROP_SLOTS = BoundedSemaphore(2)
from services.vector_store.revision_artifacts import (
    canonical_units_for_index,
    extract_documents,
    original_path,
    source_regions,
)
from services.vector_store.adapter import get_vector_store
from services.vector_store.embedder import get_embedder

router = APIRouter(prefix="/api/ai/sources", tags=["sources"])

IndexId = Annotated[str, StringConstraints(min_length=1, max_length=128)]


class FormulaIndexReview(BaseModel):
    model_config = ConfigDict(extra="forbid")
    state: Literal["accepted", "corrected"]
    proposalIdentity: str = Field(min_length=1, max_length=256)
    documentHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    cropHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    reviewer: str = Field(min_length=1, max_length=128)


class CanonicalIndexUnit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    formulaReview: FormulaIndexReview | None = None
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


class RegionCropRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: str = Field(pattern=r"^1\.0\.0$")
    courseId: str = Field(pattern=r"^[a-f0-9]{24}$")
    revisionId: str = Field(pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
    contentHash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    documents: list[dict] = Field(min_length=1, max_length=32)
    manifestDigest: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    documentId: IndexId
    regionId: IndexId
    view: Literal["exact", "math_context"] = "exact"


@router.post("/validate-formula-proposal")
def validate_formula_proposal(req: RegionCropRequest):
    """Test-only fixed mock, validated by the shared recognition contract."""
    import os
    if os.getenv("NODE_ENV") != "test" or os.getenv("FORMULA_MOCK_PROVIDER") != "1":
        raise HTTPException(404, "Unavailable")
    import json
    from agents.course_ingestion.enrichment.recognition_proposal import SourceReference, create_proposal
    region = region_inspect(req)
    source = SourceReference(document_id=region["documentId"], revision_id=req.revisionId,
        source_sha256=region["documentHash"], region_id=region["regionId"],
        page=region["page"], bbox=tuple(float(v) for v in region["bbox"]))
    proposal = create_proposal(json.dumps({"status": "proposed", "representation": "latex",
        "content": "x^2", "uncertainty": []}), source=source, provider="mock", model="mock-v1")
    return {"region": region, "proposal": proposal}


@router.post("/region-inspect")
def region_inspect(req: RegionCropRequest):
    """Resolve a mathematical region and crop against a verified source manifest."""
    try:
        manifest = req.model_dump(exclude={"documentId", "regionId", "view"})
        region = source_regions(manifest).get(req.regionId)
        if not region or region.get("documentId") != req.documentId:
            raise HTTPException(404, "Source region unavailable")
        if region.get("type") != "math":
            raise HTTPException(422, "Region is not mathematical")
        # Recognition and review identities always bind the legacy exact crop.
        # A display-only context view must never change stored crop hashes.
        crop = region_crop(req.model_copy(update={"view": "exact"}))
        document = next((item for item in manifest["documents"]
                         if item.get("documentId") == req.documentId), None)
        if not document:
            raise HTTPException(404, "Source document unavailable")
        return {
            "documentId": req.documentId, "documentHash": document["contentHash"],
            "regionId": req.regionId, "page": region["page"], "bbox": region["bbox"],
            "text": str(region.get("text") or "")[:8000],
            "cropHash": "sha256:" + hashlib.sha256(crop.body).hexdigest(),
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "Source region unavailable") from exc


@router.post("/region-crop")
def region_crop(req: RegionCropRequest):
    """Bound concurrent PDF work before parsing source bytes."""
    if not _CROP_SLOTS.acquire(timeout=5):
        raise HTTPException(503, "Source crop capacity unavailable")
    try:
        return _render_source_region(req)
    finally:
        _CROP_SLOTS.release()


def _render_source_region(req: RegionCropRequest):
    """Render one verified source region; paths never cross this boundary."""
    try:
        manifest = req.model_dump(exclude={"documentId", "regionId", "view"})
        region = source_regions(manifest).get(req.regionId)
        if not region or region.get("documentId") != req.documentId:
            raise HTTPException(404, "Source region unavailable")
        if region.get("type") not in ("figure", "figure_caption", "math"):
            raise HTTPException(422, "Region is not supported")
        document = next(
            (item for item in manifest["documents"] if item["documentId"] == req.documentId),
            None,
        )
        if not document:
            raise HTTPException(404, "Source document unavailable")
        from agents.course_ingestion.extraction.pdf_loader import render_region_sandboxed
        try:
            if req.view == "math_context" and region.get("type") == "math":
                image = render_region_sandboxed(str(original_path(document)), region.get("page"), region.get("bbox"), math_context=True)
            else:
                image = render_region_sandboxed(str(original_path(document)), region.get("page"), region.get("bbox"))
        except ValueError:
            raise HTTPException(422, "Invalid source geometry") from None
        return Response(
            content=image,
            media_type="image/png",
            headers={"Cache-Control": "private, no-store", "Content-Security-Policy": "sandbox; default-src 'none'"},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, "Source region unavailable") from exc


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

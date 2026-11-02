"""Internal artifact v1. Original bytes and the sidecar are required for readiness.
Legacy indexes are not upgraded by reading them. No external inference is used.
"""

import hashlib
import json
import math
import os
from pathlib import Path


def digest(value):
    return (
        "sha256:"
        + hashlib.sha256(
            json.dumps(
                value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
            ).encode()
        ).hexdigest()
    )


def byte_hash(value):
    return "sha256:" + hashlib.sha256(value).hexdigest()


def manifest_digest(manifest):
    return digest(
        {k: manifest[k] for k in ("courseId", "revisionId", "contentHash", "documents")}
    )


def original_path(document):
    root = Path(os.getenv("INGEST_UPLOADS_DIR", "/app/uploads")).resolve()
    ref = document["storageRef"]
    if ref != "originals/" + document["contentHash"][7:]:
        raise ValueError("Original reference mismatch")
    target = (root / ref).resolve()
    if (
        root not in target.parents
        or byte_hash(target.read_bytes()) != document["contentHash"]
    ):
        raise ValueError("Original unavailable or changed")
    return target


def validate_artifact(meta, course_id, revision_id, index_bytes=None):
    if (
        meta.get("schemaVersion") != "1.0.0"
        or meta.get("courseId") != course_id
        or meta.get("revisionId") != revision_id
    ):
        raise ValueError("Foreign or legacy index")
    if manifest_digest(meta) != meta.get("manifestDigest"):
        raise ValueError("Manifest mismatch")
    if index_bytes is not None and byte_hash(index_bytes) != meta.get("indexHash"):
        raise ValueError("Index checksum mismatch")
    documents = {d["documentId"]: d for d in meta["documents"]}
    for document in documents.values():
        original_path(document)
    if not meta["chunks"] or len(meta["chunks"]) != len(meta["metas"]):
        raise ValueError("Incomplete index")
    for text, row in zip(meta["chunks"], meta["metas"]):
        doc = documents.get(row.get("document_id"))
        if (
            not doc
            or row.get("course_id") != course_id
            or row.get("revision_id") != revision_id
            or row.get("content_hash") != doc["contentHash"]
            or row.get("text_hash") != byte_hash(text.encode())
            or row.get("chunk_id") != "chk_" + byte_hash(text.encode())[7:]
            or not isinstance(row.get("section_id"), str)
            or (
                row.get("page_number") is not None
                and (type(row["page_number"]) is not int or row["page_number"] < 1)
            )
            or row.get("extraction_method") not in (None, "text", "ocr")
            or (
                row.get("extraction_method") == "ocr"
                and (
                    type(row.get("ocr_confidence")) not in (int, float)
                    or not math.isfinite(row["ocr_confidence"])
                    or not 0 <= row["ocr_confidence"] <= 100
                    or row.get("review_required") is not True
                )
            )
            or row.get("extraction_warning")
            not in (None, "ocr_low_confidence", "ocr_no_text")
            or (
                row.get("block_ids") is not None
                and (
                    not isinstance(row.get("block_ids"), list)
                    or len(row["block_ids"]) > 40
                    or any(
                        not isinstance(block_id, str) or len(block_id) > 128
                        for block_id in row["block_ids"]
                    )
                )
            )
            or (
                row.get("source_chunk_ids") is not None
                and (
                    not isinstance(row.get("source_chunk_ids"), list)
                    or len(row["source_chunk_ids"]) > 400
                    or any(
                        not isinstance(chunk_id, str) or len(chunk_id) > 128
                        for chunk_id in row["source_chunk_ids"]
                    )
                )
            )
        ):
            raise ValueError("Invalid source chunk")


def extract_documents(manifest):
    if manifest_digest(manifest) != manifest["manifestDigest"]:
        raise ValueError("Manifest mismatch")
    chunks, metas = [], []
    for document in manifest["documents"]:
        target = original_path(document)
        if document["mediaType"] == "application/pdf":
            from agents.course_ingestion.extraction.pdf_loader import (
                extract_pages_from_pdf_sandboxed,
            )

            # Page extraction, including page-level OCR fallback, stays inside
            # the bounded parser process. Do not rescan the whole PDF here.
            version = document.get("extractionVersion", "1.0")
            if version not in ("1.0", "2.0"):
                raise ValueError("Unsupported extraction version")
            extracted = (extract_pages_from_pdf_sandboxed(str(target), extraction_version="2.0")
                         if version == "2.0" else extract_pages_from_pdf_sandboxed(str(target)))
            pages = extracted
        elif document["mediaType"] == "text/plain":
            pages = [
                {
                    "page_number": None,
                    "text": target.read_text(encoding="utf8"),
                    "extraction_method": "text",
                }
            ]
        else:
            raise ValueError("Unsupported original type")
        for extracted in pages:
            page, text = extracted["page_number"], extracted["text"]
            if extracted.get("warning") == "ocr_no_text":
                from agents.course_ingestion.extraction.ocr import OcrExtractionError

                raise OcrExtractionError(
                    f"OCR found no readable text on page {page}; instructor correction required"
                )
            regions = _document_regions(extracted, document["documentId"])
            # Keep every source region available for an empty-image figure,
            # even though only text regions become searchable chunks.
            all_regions = regions
            for i, region in enumerate(regions, 1):
                chunk = str(region.get("text") or "").strip()
                if not chunk:
                    continue
                hashed = byte_hash(chunk.encode())
                chunks.append(chunk)
                metas.append(
                    {
                        "course_id": manifest["courseId"],
                        "revision_id": manifest["revisionId"],
                        "document_id": document["documentId"],
                        "content_hash": document["contentHash"],
                        "chunk_id": "chk_" + hashed[7:],
                        "text_hash": hashed,
                        "page_number": page,
                        "section_id": f"region_{i}",
                        "provenance": "extracted",
                        "extraction_method": region.get(
                            "extractionMethod", extracted["extraction_method"]
                        ),
                        "ocr_confidence": extracted.get("ocr_confidence"),
                        "review_required": region.get("reviewRequired", False),
                        "extraction_warning": region.get("extraction_warning"),
                        "region_id": region.get("id"),
                        "region_type": region.get("type"),
                        "bbox": region.get("bbox"),
                        "reading_order": region.get("readingOrder"),
                        "region_confidence": region.get("confidence"),
                        "region_issues": region.get("issues") or [],
                        "source_media_regions": [
                            media for media in regions if media.get("type") == "figure"
                        ],
                    }
                )
            if not all_regions:
                for i in range(0, len(text), 2000):
                    chunk = text[i : i + 2000].strip()
                    if not chunk:
                        continue
                    hashed = byte_hash(chunk.encode())
                    chunks.append(chunk)
                    metas.append(
                        {
                            "course_id": manifest["courseId"],
                            "revision_id": manifest["revisionId"],
                            "document_id": document["documentId"],
                            "content_hash": document["contentHash"],
                            "chunk_id": "chk_" + hashed[7:],
                            "text_hash": hashed,
                            "page_number": page,
                            "section_id": f"section_{i//2000+1}",
                            "provenance": "extracted",
                            "extraction_method": extracted["extraction_method"],
                            "ocr_confidence": extracted.get("ocr_confidence"),
                            "review_required": extracted.get("review_required", False),
                            "extraction_warning": extracted.get("warning"),
                        }
                    )
            elif not regions:
                # A media-only page is still a valid extracted page. Its
                # original stays addressable without inventing searchable text.
                continue
    if not chunks:
        raise ValueError("No extracted passages")
    return chunks, metas


def extraction_pages(manifest):
    """Return bounded page regions without duplicating the index contract."""
    if manifest_digest(manifest) != manifest["manifestDigest"]:
        raise ValueError("Manifest mismatch")
    pages = []
    for document in manifest["documents"]:
        target = original_path(document)
        if document["mediaType"] == "application/pdf":
            from agents.course_ingestion.extraction.pdf_loader import (
                extract_pages_from_pdf_sandboxed,
            )
            from agents.course_ingestion.extraction.layout import regions_from_pages

            version = document.get("extractionVersion", "1.0")
            if version not in ("1.0", "2.0"):
                raise ValueError("Unsupported extraction version")
            extracted = (extract_pages_from_pdf_sandboxed(str(target), extraction_version="2.0")
                         if version == "2.0" else extract_pages_from_pdf_sandboxed(str(target)))
            for page in extracted:
                regions = _document_regions(page, document["documentId"])
                pages.append(
                    {
                        "documentId": document["documentId"],
                        "pageNumber": page["page_number"],
                        "width": page["width"],
                        "height": page["height"],
                        "extractionMethod": page["extraction_method"],
                        "reviewRequired": bool(page.get("review_required")),
                        "regions": regions,
                    }
                )
        elif document["mediaType"] == "text/plain":
            from agents.course_ingestion.extraction.layout import regions_from_pages

            text = target.read_text(encoding="utf8")
            pages.append(
                {
                    "documentId": document["documentId"],
                    "pageNumber": None,
                    "width": None,
                    "height": None,
                    "extractionMethod": "text",
                    "reviewRequired": False,
                    "regions": regions_from_pages(
                        [
                            {
                                "page_number": None,
                                "regions": [
                                    {
                                        "text": text,
                                        "bbox": [0, 0, 1, 1],
                                        "extraction_method": "text",
                                    }
                                ],
                            }
                        ]
                    ),
                }
            )
    return pages


def _document_regions(page, document_id):
    """Keep IDs stable across page batches and distinct across source files."""
    from agents.course_ingestion.extraction.layout import regions_from_pages

    regions = regions_from_pages([page])
    for region in regions:
        region["id"] = "region_" + hashlib.sha256(
            (str(document_id) + "\x1f" + region["id"]).encode()
        ).hexdigest()[:20]
    return regions


def canonical_units_for_index(manifest, units):
    """Turn canonical retrieval units into verified, block-linked chunks.

    The original document bytes remain immutable. Only the derived searchable
    representation changes, and every chunk names the canonical blocks it came
    from plus the raw passages used to build those blocks.
    """
    if manifest_digest(manifest) != manifest["manifestDigest"]:
        raise ValueError("Manifest mismatch")
    documents = {d["documentId"]: d for d in manifest["documents"]}
    source_chunks, source_metas = extract_documents(manifest)
    passage_by_id = {
        meta["chunk_id"]: (text, meta)
        for text, meta in zip(source_chunks, source_metas)
    }
    chunks, metas = [], []
    for unit in units:
        text = str(unit.get("text") or "").strip()
        document_ids = unit.get("documentIds") or []
        if not text or not document_ids:
            continue
        source_ids = [str(value) for value in unit.get("chunkIds") or []]
        passages = [passage_by_id[value] for value in source_ids if value in passage_by_id]
        document = documents.get(document_ids[0])
        if not document or not passages:
            if unit.get("formulaReview"):
                raise ValueError("Reviewed formula source mapping unavailable")
            continue
        review = unit.get("formulaReview")
        if review and (review.get("state") not in ("accepted", "corrected") or review.get("documentHash") != document["contentHash"]):
            raise ValueError("Reviewed formula document mismatch")
        target = original_path(document)
        if target.stat().st_size < 0:  # pragma: no cover - explicit read guard
            continue
        hashed = byte_hash(text.encode())
        review_required = any(meta.get("review_required") is True for _, meta in passages)
        extraction_methods = {meta.get("extraction_method") for _, meta in passages}
        extraction_warning = (
            "ocr_low_confidence"
            if review_required
            else next(
                (
                    meta.get("extraction_warning")
                    for _, meta in passages
                    if meta.get("extraction_warning")
                ),
                None,
            )
        )
        confidences = [
            meta["ocr_confidence"]
            for _, meta in passages
            if isinstance(meta.get("ocr_confidence"), (int, float))
        ]
        chunks.append(text)
        metas.append(
            {
                "course_id": manifest["courseId"],
                "revision_id": manifest["revisionId"],
                "document_id": document["documentId"],
                "content_hash": document["contentHash"],
                "chunk_id": "chk_" + hashed[7:],
                "text_hash": hashed,
                "page_number": None,
                "section_id": unit.get("lessonId") or "canonical",
                # These identifiers are links for retrieval, not a claim that
                # OCR or symbol fidelity was verified.
                "representation": "instructor_reviewed" if unit.get("formulaReview") else "source_extraction",
                **({"formula_review": unit["formulaReview"]} if unit.get("formulaReview") else {}),
                "block_ids": list(unit.get("blockIds") or [])[:40],
                "source_chunk_ids": list(unit.get("chunkIds") or [])[:400],
                "provenance": "extracted",
                "extraction_method": "ocr" if "ocr" in extraction_methods else "text",
                "ocr_confidence": min(confidences) if confidences else None,
                "review_required": review_required,
                # Indexing does not validate glyph fidelity; warnings remain
                # tied to the original artifact rather than being cleared.
                "extraction_warning": extraction_warning,
            }
        )
    if not chunks:
        raise ValueError("Canonical document has no retrieval text")
    return chunks, metas


def source_regions(manifest):
    """Resolve canonical region IDs to exact page geometry.

    Canonical block IDs are stable across re-extraction. This lookup verifies
    that a region belongs to the immutable manifest before a reader or media
    endpoint can use its page and bounding box.
    """
    regions = {}
    for page in extraction_pages(manifest):
        for region in page.get("regions") or []:
            regions[region["id"]] = {
                **region,
                "documentId": page["documentId"],
                "pageWidth": page.get("width"),
                "pageHeight": page.get("height"),
            }
    return regions

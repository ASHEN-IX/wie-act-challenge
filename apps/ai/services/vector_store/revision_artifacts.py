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

            # Page extraction stays inside the bounded parser process.
            extracted = extract_pages_from_pdf_sandboxed(str(target))
            if any(not text.strip() for _, text in extracted):
                from agents.course_ingestion.extraction.ocr import extract_pdf_with_ocr

                pages = extract_pdf_with_ocr(str(target))
            else:
                pages = [
                    {"page_number": page, "text": text, "extraction_method": "text"}
                    for page, text in extracted
                ]
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
    if not chunks:
        raise ValueError("No extracted passages")
    return chunks, metas

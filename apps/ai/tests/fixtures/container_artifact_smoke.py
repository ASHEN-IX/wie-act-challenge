"""Real PDF/FAISS smoke for isolated containers; deterministic vectors only."""

import os
from pathlib import Path

import numpy as np

from services.vector_store.adapter import VectorStoreAdapter
from services.vector_store.revision_artifacts import (
    byte_hash,
    extract_documents,
    manifest_digest,
)

assert os.geteuid() == 10001, "Image must run as the declared non-root user"
course, revision = "a" * 24, "rev_container"
store = VectorStoreAdapter(None)
if os.environ["CHECK_MODE"] == "write":
    import fitz

    pdf = fitz.open()
    pdf.new_page().insert_text((72, 72), "A synthetic PDF about the water cycle.")
    scan = fitz.open()
    page = scan.new_page(width=600, height=180)
    page.insert_text((30, 70), "Evaporation is part of the water cycle.", fontsize=20)
    page = pdf.new_page(width=600, height=180)
    page.insert_image(
        page.rect, stream=scan[0].get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
    )
    assert not page.get_text().strip()
    scan.close()
    raw = pdf.tobytes()
    pdf.close()
    hashed = byte_hash(raw)
    original = Path(os.environ["INGEST_UPLOADS_DIR"]) / "originals" / hashed[7:]
    original.parent.mkdir(parents=True, exist_ok=True)
    original.write_bytes(raw)
    source = {
        "documentId": "doc_" + hashed[7:23],
        "filename": "source.pdf",
        "contentHash": hashed,
        "provenance": "extracted",
        "storageRef": "originals/" + hashed[7:],
        "mediaType": "application/pdf",
    }
    manifest = {
        "schemaVersion": "1.0.0",
        "courseId": course,
        "revisionId": revision,
        "contentHash": byte_hash(revision.encode()),
        "documents": [source],
    }
    manifest["manifestDigest"] = manifest_digest(manifest)
    chunks, metas = extract_documents(manifest)
    assert metas[1]["extraction_method"] == "ocr"
    assert metas[1]["review_required"] is True
    assert metas[1]["ocr_confidence"] >= 70
    vectors = np.zeros((len(chunks), 384), dtype="float32")
    vectors[:, 0] = 1
    store.add_course(
        course, chunks, vectors, metas, revision_id=revision, artifact=manifest
    )
    print(
        "PASS: non-root PDF/real English OCR extraction and revision FAISS publication"
    )
else:
    metadata = store.verify_revision(course, revision)
    assert metadata["metas"][0]["page_number"] == 1
    assert "water cycle" in metadata["chunks"][0]
    assert metadata["metas"][1]["page_number"] == 2
    assert metadata["metas"][1]["extraction_method"] == "ocr"
    assert "Evaporation" in metadata["chunks"][1]
    for directory in ("INGEST_UPLOADS_DIR", "FAISS_INDEX_DIR"):
        try:
            (Path(os.environ[directory]) / "read-only-probe").write_text("denied")
        except OSError:
            continue
        raise AssertionError("Read-only consumer unexpectedly wrote a mount")
    print("PASS: separate read-only consumer verified PDF, FAISS and page provenance")

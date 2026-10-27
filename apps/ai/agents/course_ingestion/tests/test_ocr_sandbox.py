"""Real image-only extraction plus process-tree and failure-boundary checks."""

from pathlib import Path
import time

import fitz
import pytest

from agents.course_ingestion.extraction import ocr


@pytest.fixture
def scanned_pdf(tmp_path):
    source = fitz.open()
    page = source.new_page(width=600, height=180)
    page.insert_text((30, 70), "Energy is conserved in a closed system.", fontsize=20)
    raster = page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
    target = fitz.open()
    page = target.new_page(width=600, height=180)
    page.insert_image(page.rect, stream=raster)
    assert not page.get_text().strip()
    path = tmp_path / "scanned.pdf"
    target.save(path)
    source.close()
    target.close()
    return path


def test_real_scanned_pdf_reports_text_page_and_confidence(scanned_pdf):
    pages = ocr.extract_pdf_with_ocr(str(scanned_pdf))
    assert len(pages) == 1
    page = pages[0]
    assert "Energy is conserved" in page["text"]
    assert page["page_number"] == 1
    assert page["extraction_method"] == "ocr"
    assert 70 <= page["ocr_confidence"] <= 100
    assert page["review_required"] is True
    assert "closed system" in ocr.ocr_pdf(str(scanned_pdf))


def test_text_page_does_not_invoke_missing_engine(tmp_path, monkeypatch):
    path = tmp_path / "text.pdf"
    with fitz.open() as document:
        document.new_page().insert_text((72, 72), "Native text remains exact.")
        document.save(path)
    monkeypatch.setenv("PATH", str(tmp_path))
    page = ocr.extract_pdf_with_ocr(str(path))[0]
    assert page["extraction_method"] == "text"
    assert page["ocr_confidence"] is None
    assert page["review_required"] is False


def test_missing_engine_failure_is_sanitized(scanned_pdf, monkeypatch, tmp_path):
    monkeypatch.setenv("PATH", str(tmp_path))
    with pytest.raises(ocr.OcrExtractionError, match="OCR failed") as error:
        ocr.extract_pdf_with_ocr(str(scanned_pdf))
    assert str(scanned_pdf) not in str(error.value)


def test_empty_scan_reports_no_text_and_cannot_succeed_as_legacy_ocr(tmp_path):
    path = tmp_path / "blank.pdf"
    with fitz.open() as document:
        document.new_page(width=200, height=200)
        document.save(path)
    page = ocr.extract_pdf_with_ocr(str(path))[0]
    assert page["warning"] == "ocr_no_text"
    assert page["ocr_confidence"] == 0
    with pytest.raises(ocr.OcrExtractionError, match="no readable text"):
        ocr.ocr_pdf(str(path))


def test_page_limit_precedes_rasterization(tmp_path):
    path = tmp_path / "too-many.pdf"
    with fitz.open() as document:
        for _ in range(ocr.MAX_PAGES + 1):
            document.new_page()
        document.save(path)
    with pytest.raises(ocr.OcrExtractionError, match="at most 20"):
        ocr.extract_pdf_with_ocr(str(path))


def test_timeout_kills_engine_and_removes_temporary_raster(
    scanned_pdf, tmp_path, monkeypatch
):
    pid_file = tmp_path / "engine.pid"
    raster_file = tmp_path / "raster.path"
    engine = tmp_path / "tesseract"
    engine.write_text(
        "#!/usr/bin/python3\nimport os, sys, time\n"
        f"open({str(pid_file)!r}, 'w').write(str(os.getpid()))\n"
        f"open({str(raster_file)!r}, 'w').write(sys.argv[1])\n"
        "time.sleep(60)\n"
    )
    engine.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path))
    start = time.monotonic()
    with pytest.raises(ocr.OcrExtractionError, match="sandbox timeout"):
        ocr.extract_pdf_with_ocr(str(scanned_pdf), timeout_s=2)
    assert time.monotonic() - start < 6
    assert pid_file.exists(), "test must reach the nested OCR engine"
    pid = int(pid_file.read_text())
    # A killed descendant can briefly remain a zombie until PID 1 reaps it.
    stat = Path(f"/proc/{pid}/stat")
    assert not stat.exists() or stat.read_text().split()[2] == "Z"
    assert not Path(raster_file.read_text()).parent.exists()


def test_low_confidence_is_flagged(tmp_path, monkeypatch):
    class Page:
        def get_text(self):
            return ""

    class Document:
        needs_pass = False

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def __len__(self):
            return 1

        def __iter__(self):
            return iter([Page()])

    monkeypatch.setattr(fitz, "open", lambda _: Document())
    monkeypatch.setattr(ocr, "_ocr_page", lambda *args: ("uncertain words", 42.0))
    page = ocr._extract("unused", str(tmp_path), True)[0]
    assert page["warning"] == "ocr_low_confidence"
    assert page["review_required"] is True


def test_revision_preparation_retains_scanned_provenance(
    scanned_pdf, tmp_path, monkeypatch
):
    from services.vector_store.revision_artifacts import (
        byte_hash,
        manifest_digest,
        extract_documents,
    )

    original = scanned_pdf.read_bytes()
    hashed = byte_hash(original)
    root = tmp_path / "uploads"
    (root / "originals").mkdir(parents=True)
    (root / "originals" / hashed[7:]).write_bytes(original)
    monkeypatch.setenv("INGEST_UPLOADS_DIR", str(root))
    manifest = {
        "courseId": "a" * 24,
        "revisionId": "rev_scan",
        "contentHash": hashed,
        "documents": [
            {
                "documentId": "doc_scan",
                "storageRef": "originals/" + hashed[7:],
                "contentHash": hashed,
                "mediaType": "application/pdf",
            }
        ],
    }
    manifest["manifestDigest"] = manifest_digest(manifest)
    chunks, metas = extract_documents(manifest)
    assert "Energy is conserved" in chunks[0]
    assert metas[0]["page_number"] == 1
    assert metas[0]["extraction_method"] == "ocr"
    assert metas[0]["review_required"] is True
    assert metas[0]["ocr_confidence"] >= 70
    assert metas[0]["content_hash"] == hashed
    assert metas[0]["text_hash"] == byte_hash(chunks[0].encode())
    from services.vector_store.revision_artifacts import validate_artifact

    artifact = {**manifest, "schemaVersion": "1.0.0", "chunks": chunks, "metas": metas}
    validate_artifact(artifact, manifest["courseId"], manifest["revisionId"])
    for confidence, review in ((float("nan"), True), (101, True), (90, False)):
        invalid = {
            **artifact,
            "metas": [
                {**metas[0], "ocr_confidence": confidence, "review_required": review}
            ],
        }
        with pytest.raises(ValueError, match="Invalid source chunk"):
            validate_artifact(invalid, manifest["courseId"], manifest["revisionId"])


def test_corrupt_and_encrypted_inputs_do_not_leak_path(tmp_path):
    corrupt = tmp_path / "private-name.pdf"
    corrupt.write_bytes(b"private corrupt bytes")
    encrypted = tmp_path / "private-encrypted.pdf"
    with fitz.open() as document:
        document.new_page()
        document.save(
            encrypted,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner",
            user_pw="private-password",
        )
    for path in (corrupt, encrypted):
        with pytest.raises(ocr.OcrExtractionError) as error:
            ocr.extract_pdf_with_ocr(str(path))
        assert "private" not in str(error.value)


def test_huge_page_is_rasterized_within_pixel_budget(tmp_path, monkeypatch):
    path = tmp_path / "huge.pdf"
    with fitz.open() as document:
        document.new_page(width=10000, height=10000)
        document.save(path)
    dimensions = tmp_path / "dimensions"
    engine = tmp_path / "tesseract"
    # Read PNG's fixed header without requiring image libraries in this fake engine.
    engine.write_text(
        "#!/usr/bin/python3\nimport struct, sys\n"
        "w, h = struct.unpack('>II', open(sys.argv[1], 'rb').read(24)[16:24])\n"
        f"open({str(dimensions)!r}, 'w').write(str(w * h))\n"
        "print('conf\\ttext\\n42\\tUncertain')\n"
    )
    engine.chmod(0o755)
    monkeypatch.setenv("PATH", str(tmp_path))
    page = ocr.extract_pdf_with_ocr(str(path))[0]
    assert 0 < int(dimensions.read_text()) <= ocr.MAX_PIXELS
    assert page["warning"] == "ocr_low_confidence"
    assert page["ocr_confidence"] == 42

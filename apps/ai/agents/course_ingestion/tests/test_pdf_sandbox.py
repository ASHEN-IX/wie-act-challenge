"""Real PDF sandbox behavior and supervisor failure handling."""

import mmap
import subprocess
import fitz
import pytest
from agents.course_ingestion.extraction import pdf_loader


@pytest.fixture
def real_pdf(tmp_path):
    path = tmp_path / "source.pdf"
    document = fitz.open()
    document.new_page().insert_text((72, 72), "First page evidence.")
    document.new_page().insert_text((72, 72), "Second page evidence.")
    document.save(path)
    document.close()
    return str(path)


def test_real_pages_and_text(real_pdf):
    pages = pdf_loader.extract_pages_from_pdf_sandboxed(real_pdf)
    assert [number for number, _ in pages] == [1, 2]
    assert "First page evidence" in pages[0][1]
    assert "Second page evidence" in pages[1][1]
    assert "Second page evidence" in pdf_loader.extract_text_from_pdf_sandboxed(
        real_pdf
    )


def test_parent_large_virtual_address_space_does_not_break_child(real_pdf):
    with mmap.mmap(-1, 1024 * 1024 * 1024) as allocation:
        assert len(allocation) == 1024 * 1024 * 1024
        assert len(pdf_loader.extract_pages_from_pdf_sandboxed(real_pdf)) == 2


def test_rejects_encrypted_pdf(tmp_path):
    path = tmp_path / "encrypted.pdf"
    document = fitz.open()
    document.new_page().insert_text((72, 72), "Private")
    document.save(
        path,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="owner-secret",
        user_pw="user-secret",
    )
    document.close()
    with pytest.raises(pdf_loader.EncryptedPdfError, match="encrypted"):
        pdf_loader.extract_pages_from_pdf_sandboxed(str(path))


def test_rejects_invalid_or_missing_pdf(tmp_path):
    for path in (tmp_path / "missing.pdf", tmp_path / "invalid.pdf"):
        if path.name == "invalid.pdf":
            path.write_bytes(b"not a pdf")
        with pytest.raises(pdf_loader.PdfValidationError):
            pdf_loader.extract_pages_from_pdf_sandboxed(str(path))


def test_enforces_wall_clock_timeout(real_pdf):
    with pytest.raises(pdf_loader.PdfParseTimeoutError, match="sandbox timeout"):
        pdf_loader.extract_pages_from_pdf_sandboxed(real_pdf, timeout_s=0)


def test_limit_abort_when_child_never_reports(monkeypatch, real_pdf):
    monkeypatch.setattr(
        pdf_loader.subprocess,
        "run",
        lambda *a, **kw: subprocess.CompletedProcess(a, -9, b""),
    )
    with pytest.raises(pdf_loader.PdfParseLimitError, match="limits"):
        pdf_loader.extract_pages_from_pdf_sandboxed(real_pdf)

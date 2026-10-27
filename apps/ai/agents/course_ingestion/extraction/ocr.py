"""Bounded local English OCR. Every OCR passage requires instructor review."""

import csv
import io
import json
import math
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile

MAX_PAGES = 20
MAX_PIXELS = 4_000_000
MAX_TEXT_BYTES = 8 * 1024 * 1024
REVIEW_CONFIDENCE = 70


class OcrExtractionError(Exception):
    """Sanitized failure suitable for ingestion status reporting."""


def _ocr_page(page, directory):
    import fitz

    width, height = page.rect.width, page.rect.height
    if width <= 0 or height <= 0 or not math.isfinite(width * height):
        raise OcrExtractionError("Invalid page dimensions")
    # Leave room for rounding to integer pixel edges.
    scale = min(150 / 72, math.sqrt(MAX_PIXELS / (width * height))) * 0.99
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    if pixmap.width * pixmap.height > MAX_PIXELS:
        raise OcrExtractionError("OCR raster exceeds pixel limit")
    raster = str(Path(directory) / "page.png")
    pixmap.save(raster)
    result = subprocess.run(
        ["tesseract", raster, "stdout", "-l", "eng", "tsv"],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        env={**os.environ, "OMP_THREAD_LIMIT": "1"},
        check=False,
    )
    if result.returncode:
        raise OcrExtractionError("Local English OCR failed")
    words, weighted, weight = [], 0.0, 0
    for row in csv.DictReader(
        io.StringIO(result.stdout.decode("utf8")), delimiter="\t"
    ):
        word = (row.get("text") or "").strip()
        confidence = float(row.get("conf", "-1"))
        if word and confidence >= 0:
            words.append(word)
            weighted += min(100, confidence) * len(word)
            weight += len(word)
    return " ".join(words), round(weighted / weight, 2) if weight else 0.0


def _extract(pdf_path, directory, only_missing):
    import fitz

    pages, total = [], 0
    with fitz.open(pdf_path) as document:
        if document.needs_pass:
            raise OcrExtractionError("Encrypted PDFs are unsupported")
        if len(document) > MAX_PAGES:
            raise OcrExtractionError("OCR supports at most 20 PDF pages")
        for number, page in enumerate(document, 1):
            text = page.get_text() if only_missing else ""
            method, confidence = "text", None
            if not text.strip():
                text, confidence = _ocr_page(page, directory)
                method = "ocr"
            total += len(text.encode("utf8"))
            if total > MAX_TEXT_BYTES:
                raise OcrExtractionError("OCR exceeds extracted text limit")
            pages.append(
                {
                    "page_number": number,
                    "text": text,
                    "extraction_method": method,
                    "ocr_confidence": confidence,
                    "review_required": method == "ocr",
                    "warning": (
                        "ocr_no_text"
                        if not text.strip()
                        else (
                            "ocr_low_confidence"
                            if confidence is not None and confidence < REVIEW_CONFIDENCE
                            else None
                        )
                    ),
                }
            )
    return pages


def extract_pdf_with_ocr(
    pdf_path: str,
    timeout_s: float = 45,
    max_memory_mb: int = 512,
    only_missing: bool = True,
):
    """Return page text/provenance with a deadline for the entire process tree.

    Linux limits bound parsing/rasterization and are inherited by Tesseract.
    The parent owns temporary storage so a forced kill still removes files.
    """
    with tempfile.TemporaryDirectory(prefix="ednova-ocr-") as directory:
        try:
            child = subprocess.Popen(
                [
                    sys.executable,
                    "-I",
                    os.path.abspath(__file__),
                    "--sandbox",
                    str(pdf_path),
                    directory,
                    str(max_memory_mb),
                    str(max(1, math.ceil(timeout_s))),
                    "missing" if only_missing else "all",
                ],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                start_new_session=True,
            )
        except OSError:
            raise OcrExtractionError("OCR sandbox could not start") from None
        try:
            output, _ = child.communicate(timeout=timeout_s)
        except subprocess.TimeoutExpired:
            raise OcrExtractionError("OCR exceeded sandbox timeout") from None
        finally:
            # Reap engine descendants even if the parser hit a resource limit.
            try:
                os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            child.wait()
            child.stdout.close()
        if child.returncode:
            raise OcrExtractionError("OCR aborted inside sandbox limits")
        try:
            result = json.loads(output)
            if result["status"] == "ok":
                return result["pages"]
            # Child messages are fixed labels, never raw engine/file output.
            message = result["message"]
        except (ValueError, KeyError, TypeError):
            message = "Invalid OCR sandbox response"
        raise OcrExtractionError(message)


def ocr_pdf(pdf_path: str) -> str:
    pages = extract_pdf_with_ocr(pdf_path, only_missing=False)
    text = "\n".join(page["text"] for page in pages)
    if not text.strip():
        raise OcrExtractionError(
            "OCR found no readable text; instructor correction required"
        )
    return text


def _main():
    import resource

    memory, cpu = int(sys.argv[4]) * 1024 * 1024, int(sys.argv[5])
    resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    resource.setrlimit(resource.RLIMIT_FSIZE, (32 * 1024 * 1024, 32 * 1024 * 1024))
    try:
        result = {
            "status": "ok",
            "pages": _extract(sys.argv[2], sys.argv[3], sys.argv[6] == "missing"),
        }
    except OcrExtractionError as exc:
        result = {"status": "error", "message": str(exc)}
    except BaseException:
        result = {
            "status": "error",
            "message": "OCR failed; check PDF and local English OCR availability",
        }
    sys.stdout.write(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__" and len(sys.argv) == 7 and sys.argv[1] == "--sandbox":
    _main()

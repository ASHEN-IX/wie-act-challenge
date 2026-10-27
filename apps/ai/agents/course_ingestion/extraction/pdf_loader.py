"""Bounded PDF extraction in a fresh, resource-limited Python process.

Untrusted PDF parsing and page extraction run only in the child. Starting a
fresh interpreter avoids inheriting the large address space of an AI worker.
"""

import json
import math
import os
import subprocess
import sys


class PdfValidationError(Exception):
    """Base error for PDF extraction failures in the ingestion pipeline."""


class EncryptedPdfError(PdfValidationError):
    """A password-protected PDF is not supported."""


class PdfParseTimeoutError(PdfValidationError):
    """Parsing exceeded the wall-clock sandbox timeout."""


class PdfParseLimitError(PdfValidationError):
    """Parsing exceeded a sandbox CPU, memory or output limit."""


MAX_PAGES = 2000
MAX_TEXT_BYTES = 8 * 1024 * 1024


def _apply_resource_limits(max_memory_mb: int, max_cpu_s: int) -> None:
    """Constrain the fresh child before importing or invoking the PDF parser."""
    try:
        import resource
    except ImportError:
        return
    mem_bytes = max_memory_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    resource.setrlimit(resource.RLIMIT_CPU, (max_cpu_s, max_cpu_s))


def _extract_pages(pdf_path: str):
    import fitz

    document = fitz.open(pdf_path)
    try:
        if document.needs_pass:
            raise EncryptedPdfError("PDF is encrypted/password-protected")
        if len(document) > MAX_PAGES:
            raise PdfParseLimitError("PDF exceeds page limit")
        pages = []
        total = 0
        for number, page in enumerate(document, 1):
            text = page.get_text()
            total += len(text.encode("utf8"))
            if total > MAX_TEXT_BYTES:
                raise PdfParseLimitError("PDF exceeds extracted text limit")
            pages.append([number, text])
        return pages
    finally:
        document.close()


def extract_pages_from_pdf_sandboxed(
    pdf_path: str, timeout_s: int = 45, max_memory_mb: int = 512
):
    """Return (page number, text) pairs from a bounded, fresh interpreter."""
    try:
        result = subprocess.run(
            [
                sys.executable,
                "-I",
                os.path.abspath(__file__),
                "--sandbox",
                pdf_path,
                str(max_memory_mb),
                str(max(1, math.ceil(timeout_s))),
            ],
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise PdfParseTimeoutError("PDF parsing exceeded sandbox timeout") from None
    except OSError:
        raise PdfValidationError("PDF sandbox could not start") from None
    if result.returncode != 0:
        raise PdfParseLimitError(
            "PDF parsing aborted inside sandbox (CPU/memory limits)"
        )
    try:
        response = json.loads(result.stdout)
        if response.get("status") == "ok":
            pages = response["pages"]
            if (
                not isinstance(pages, list)
                or len(pages) > MAX_PAGES
                or any(
                    not isinstance(p, list)
                    or len(p) != 2
                    or type(p[0]) is not int
                    or p[0] != i
                    or not isinstance(p[1], str)
                    for i, p in enumerate(pages, 1)
                )
            ):
                raise ValueError("Malformed sandbox result")
            return [(number, text) for number, text in pages]
        if response.get("kind") == "EncryptedPdfError":
            raise EncryptedPdfError("PDF is encrypted/password-protected")
        if response.get("kind") == "PdfParseLimitError":
            raise PdfParseLimitError("PDF exceeds sandbox limits")
    except (ValueError, TypeError, KeyError, AttributeError):
        raise PdfValidationError("Invalid PDF sandbox response") from None
    raise PdfValidationError("PDF parsing failed")


def extract_text_from_pdf_sandboxed(
    pdf_path: str, timeout_s: int = 45, max_memory_mb: int = 512
) -> str:
    return "".join(
        text
        for _, text in extract_pages_from_pdf_sandboxed(
            pdf_path, timeout_s, max_memory_mb
        )
    )


def _sandbox_main():
    try:
        _apply_resource_limits(int(sys.argv[3]), int(sys.argv[4]))
        result = {"status": "ok", "pages": _extract_pages(sys.argv[2])}
    except BaseException as exc:
        result = {"status": "error", "kind": type(exc).__name__}
    sys.stdout.write(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__" and len(sys.argv) == 5 and sys.argv[1] == "--sandbox":
    _sandbox_main()

# Extraction benchmark fixtures

`reference-course.pdf` is an exact byte-for-byte copy of the user's
`cours-chap3et4.pdf` reference failure document (480,022 bytes). Its SHA-256 is
recorded in the Batch 2 report.

These fixtures support deterministic regression checks. They are not an
independently reviewed golden corpus. The synthetic prose, table and source
code cases are declared in `test_multimodal_extraction.py`; their expected
values are explicit test assertions, not claims of general extraction accuracy.

Run from the repository root with the AI environment (PyMuPDF <2.0), optional
`pdfplumber`, and local Tesseract installed:

```sh
python apps/ai/agents/course_ingestion/extraction/benchmarks/run_benchmark.py
```

Each candidate runs in a fresh process. The OCR candidate covers page 1 only;
other engines cover all 20 pages. Timings include imports and are single-run
measurements. RSS reports parent and maximum child separately, not total peak.
`representative-fixtures.json` defines three additional generated PDF inputs
(prose with French accents, pipe tables, and fenced Python), with explicit
expected fragments/cells. These fixtures have no independent reviewer signoff.

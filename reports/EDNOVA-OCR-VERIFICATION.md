# EdNova bounded OCR verification — 27 October 2026

The scanned-PDF fallback now uses a fresh Linux process, bounded PyMuPDF
rasterization and local Tesseract English OCR. Revision preparation invokes it
when native page extraction contains an empty page. Native-text PDFs retain the
existing bounded parser. Legacy ingestion also uses the bounded OCR wrapper.
No provider request or model download is involved. Automatic fallback covers
pages with no native extracted text. A page with a native header and scanned body
can still yield incomplete native extraction; mixed-content detection and layout
reconstruction remain open and require original-versus-draft review.

| Limit | Current implementation |
|---|---|
| OCR document | At most 20 pages, including native-text pages in a mixed document |
| Page raster | At most 4,000,000 pixels; up to 150 DPI, reduced for large pages |
| Address space | 512 MiB for the fresh parser; inherited by engine subprocesses |
| Wall time | 45 seconds for the whole document and process tree |
| CPU | 45-second per-process inherited limit; whole-tree wall deadline also applies |
| Text / temporary raster | 8 MiB extracted text; 32 MiB per generated file |
| Cleanup | Kill the process group on timeout/failure; remove parent-owned temporary storage |

OCR passages retain original-byte identity and page/chunk/text hashes. The
internal sidecar additionally records extraction method, word confidence,
review requirement and low-confidence warning. Course Studio receives these
fields only after original/manifest/index verification and shows a warning on
the selected scanned passage. Confidence below 70 is flagged; this diagnostic
threshold is provisional, not an approved educational quality policy. Confidence
is Tesseract word confidence, not a calibrated probability of correctness.
Every OCR passage requires instructor review regardless of confidence.

Revision preparation fails visibly when a scanned page produces no readable
text instead of silently publishing an incomplete source. Corrupt/encrypted
inputs, missing English OCR and resource failures produce sanitized messages.
A failed draft does not replace an already approved revision. Authors can upload
a corrected accessible text/PDF source and review the resulting draft through
the existing replacement workflow. Exact transcription editing with a correction
history remains open; immutable original bytes are never rewritten.

The focused parser/grounding/ingestion/retry suite passes **57 tests**, including
10 new OCR tests. Real image-only PDF fixtures exercise English text recognition,
page identity and confidence. Additional tests cover native text without an OCR
engine, missing engine, blank scans, corrupt/encrypted PDFs, page and actual
raster pixel limits, low-confidence flags, revision metadata and a deliberately
blocked engine killed on deadline with its raster directory removed.

[Focused command output](evidence/ednova-execution-20261027/ocr-integration.log),
[exit code](evidence/ednova-execution-20261027/ocr-integration.exit).
The blocked-engine and forced low-confidence cases use explicit engine fixtures;
they are separate from the actual Tesseract image-only extraction case.

The real Nest/Mongo/RabbitMQ/Python source suite passes **14 test nodes**,
including a two-page image-only PDF upload through the worker, source preparation,
Studio confidence/review metadata, reviewed publication, page-specific tutor
citations and byte-exact original download. Embeddings and tutor responses remain
deterministic fixtures; OCR and PDF/FAISS processing are real.
[Source integration log](evidence/ednova-execution-20261027/source-ocr-current.log).

The rebuilt UID/GID 10001 image also passes native-text plus image-only page
extraction, actual English OCR, revision FAISS publication, a separate read-only
consumer, incompatible-mount preservation and HTTP health with no network and a
read-only application filesystem.
[Container runtime log](evidence/ednova-execution-20261027/nonroot-ocr-current.log).
The full offline Python suite passes **1082 tests, five existing skips** after
metadata validation tests; [full log](evidence/ednova-execution-20261027/python-ocr-final.log).
The real scanned-PDF browser run now passes **nine A–E checkpoints** with two
independent learner contexts. It asserts the image-only fixture has no native
text, sees the instructor confidence/review warning, reviews/registers both
activity types, publishes, uses tutor citations, persists private learning
results, synchronizes the room, debriefs and denies revoked access.
[Browser log](evidence/ednova-execution-20261027/scanned-browser-current.log),
[exit 0](evidence/ednova-execution-20261027/scanned-browser-current.exit),
[checkpoints](evidence/ednova-execution-20261027/scanned-browser-current/browser-checks.json)
and [Studio screenshot](evidence/ednova-execution-20261027/scanned-browser-current/browser-studio.png).
The screenshot also received visual inspection. This uses real OCR with fixture
embeddings/inference, not approved pedagogical model execution. Representative
human OCR acceptance remains open.

Reproduce with `P0R3_SOURCE_SCANNED=1`, a dedicated `P0R3_EVIDENCE_DIR`, the locked
`P0R2_PYTHON` and `node scripts/run-integrated-browser.mjs`. CI includes this
variant and installs English Tesseract; remote CI has not been observed. Owner-approved scanned-input scope, representative degraded
scans, handwriting, mathematics/tables/layout fidelity, non-English language
accuracy, human transcript acceptance and all ED-06/31 criteria remain open.
Parent tasks remain PARTIAL.

# EdNova source pipeline verification — 27 October 2026

The current source suite passes **14 test nodes, zero skips** against real Nest,
MongoDB, RabbitMQ, Python HTTP and the ingestion worker. Embeddings and model
responses are deterministic test fixtures. This does not establish real-model
quality, OCR completeness or production readiness. Bounded English scanned-PDF
extraction and its limits are recorded in [OCR verification](EDNOVA-OCR-VERIFICATION.md).

```bash
P0R2_PYTHON=/home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python \
P0R2_BROKER_URL=amqp://guest:guest@127.0.0.1:5678/ \
pnpm --filter api exec tsx --tsconfig tsconfig.json --test \
  tests/integration/p0r2-source-ai.node.test.ts
```

[Actual command output](evidence/ednova-execution-20261027/source-ocr-current.log)
and [exit code](evidence/ednova-execution-20261027/source-ocr-current.exit).
The interpreter path is local to this workstation; CI selects the locked Poetry
interpreter instead. All databases and originals are generated synthetic fixtures.

The source suite covers actual text and two-page PDF uploads, broker/worker
processing, revision-specific FAISS artifacts, review/publication, exact page
citations, private original downloads, missing/altered artifacts, false citations,
stale revisions, denied access and delayed revocation. It also adds the following
regression:

| Criterion | Failure reproduced / correction | Assertion | Status |
|---|---|---|---|
| SRC-REPLACE-01 / ED-05/06 | `POST /courses/:id/files` deleted the whole staged course directory when enqueue failed | Preserve previous file bytes and authenticated old-file HTTP download after injected enqueue failure | IMPLEMENTED_AND_VERIFIED |
| SRC-REPLACE-02 / ED-05/30 | A failed replacement must not alter the approved source identity | Published context remains byte-equivalent as JSON and tutor still uses the original approved revision | IMPLEMENTED_AND_VERIFIED |
| SRC-REPLACE-03 / ED-06/31 | Failure must remain visible and recoverable | Return 503, retain failed status and new source attached to its draft; no automatic publication | IMPLEMENTED_AND_VERIFIED for retention/error behavior; automatic retry workflow remains open |

The fix removes the destructive course-directory cleanup from replacement
failure handling. New-course failure cleanup is unchanged. Failed replacements
retain their staged source and immutable original for recovery; they consume
storage until a reviewed retry/deletion workflow handles them. Concurrent upload
status arbitration and uncertainty after a broker acknowledgement loss require
additional acceptance and are not certified here.

The first attempt to extend the source suite incorrectly scheduled a sibling
Node subtest from within the currently running subtest, causing a wait. It was
interrupted and corrected to schedule a child through the active test context.
The failed/incomplete log is retained separately as `source-replacement.log`;
only `source-ocr-current.log` is counted as passing.

Non-root shared artifacts and actual broker/Redis crash recovery are documented
in [operational verification](EDNOVA-OPERATIONAL-RECOVERY.md). Owner-approved OCR scope and human quality review, actual ingestion crash
boundaries, live-application restore and all atomic source acceptance criteria
remain open. Parent tasks remain PARTIAL.

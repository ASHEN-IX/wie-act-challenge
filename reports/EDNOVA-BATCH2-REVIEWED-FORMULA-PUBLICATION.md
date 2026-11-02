# Batch 2 — Reviewed Formula Publication and Reader Integration

Date: 2026-11-02. Scope: reviewed-formula publication, immutable retrieval projection and the existing reader. No new recognition provider, real Gemini call, planner or Batch 3 work.

## Decision

**GO for this vertical slice under the documented mocked-AI integration test scope.** An authenticated instructor reviewed three proposals, published a new immutable revision, saw two reviewed formulas rendered through KaTeX in the actual reader, and inspected the original PDF crop. Rejected content retained its original extraction. Subsequent proposal mutations did not alter the published reader.

**NO-GO for declaring all of Batch 2 complete or certifying mathematical fidelity / production provider rollout.** These tests establish workflow, authorization, provenance and snapshot behavior. Instructor approval is not independent mathematical verification. Wider independently annotated document evaluation remains open.

## Publication projection and source matching

`services/formulaPublication.ts` is called from the existing publication service, after normal instructor approval, canonical checksum and extraction-acknowledgement checks. It selects accepted/corrected proposals only for the exact course, source draft MongoDB ID, revision tag and version. Pending, rejected and old-snapshot proposals do not replace source content.

Each selected proposal must match its final audit entry: final state, review version, draft ID, tag and version. Its canonical math block must match region ID, source-document evidence, page, bounding box and original source expression. The immutable manifest document hash must match the proposal. The blob is verified, and trusted internal region inspection must reproduce document hash, region ID, page, bounding box and crop hash. Duplicate finalized proposals for one region fail closed. Expressions are revalidated through the existing correction/KaTeX restrictions. Accepted expressions must equal the original proposal; corrected expressions must equal the audited correction.

A compare-and-set freezes the source draft using ID, tag, version, canonical checksum and editable state. The original source canonical remains intact. A receipt stores the immutable selected projection and a deterministic, separate `rev_formula_…` publication identity. The new target revision receives that projection and the same source manifest, then prepares its own index and follows the existing receipt-first active-pointer publication protocol. Source-parent tag/version/hash and receipt identity are checked before the target proceeds. Repeating the original publication command reuses its receipt.

This uses atomic document operations and the existing course-pointer CAS, **not cross-document transactions**. A source edit winning before the freeze causes a conflict rather than a mixed snapshot. Concurrent publication tests permit only one committed snapshot for the frozen source. Proposal selection defines the captured review set: a decision finalized after selection is not automatically appended. No mutable proposal lookup occurs when a published reader opens.

## Canonical and reader contracts

Canonical schema remains `1.0.0`. The published math block retains its original `expression`, evidence, page and geometry; an additive nested `reviewedFormula` records:

- Reviewed expression and original model LaTeX.
- Proposal identity, accepted/corrected state, reviewer and review timestamp.
- Document hash and crop hash.
- Source draft ID, tag and version.

The separate internal revision marker binds the projection checksum to its source receipt. The reader validates that marker/checksum; unmarked documents cannot supply trusted reviewed overlays. Learning Document V2 adds optional math `review` metadata containing state, original extraction, original model expression and reviewer. This metadata uses the strict object parser, without incorrectly requiring a second block ID.

The existing renderer uses KaTeX with `trust: false`, bounded expansion and existing restricted-command validation. Original plain extraction remains readable for rejected, pending or missing reviews. Reviewed formulas display an explicit instructor-approved accepted/corrected caption and “not independently verified.” Details retain original extraction, model proposal and reviewer. A failed rendering retains the renderer's safe fallback.

New editable drafts cloned from published content strip reviewed overlays and recompute their canonical checksum. Old decisions remain auditable but do not transfer to the new snapshot. Formula blocks preserve existing order/hierarchy; the existing region-block projection avoids duplicating the flattened source lesson.

## Retrieval and immutable artifacts

The target publication prepares new revision-specific artifacts; existing published FAISS files are not rewritten. Reviewed canonical units include both labelled instructor-reviewed notation and original extraction. Metadata records accepted/corrected state, proposal identity, document hash, crop hash and reviewer. Source chunk IDs remain linked to the original manifest.

The Python artifact builder rejects a reviewed unit without a matching source chunk, mismatched document hash or non-final disposition. The API verifies that every reviewed text is present in the completed metadata chunks. Reviewed units are split within existing size limits; oversized reviewed-unit counts fail instead of silently dropping formulas. Draft indexing strips overlays outside the internal frozen publication path. No pending/rejected reconstruction enters retrieval as reviewed content.

Integration tests compare canonical/reader expressions and revision-bound index metadata. Browser tests use native FAISS files with synthetic vectors and mocked indexing transport; they establish snapshot/plumbing consistency, **not live embedding quality or semantic retrieval accuracy**.

## API and Studio changes

All course routes use the existing `/api/v1/study` prefix:

- `POST /courses/:courseId/drafts/:revisionId/approve` — authorize and approve the exact current draft version without making a content-edit save. It preserves the existing extraction acknowledgement requirement.
- `POST /courses/:courseId/draft/sources/prepare` — existing source preparation.
- `POST /courses/:courseId/publish` — existing publication command; returns the actual newly committed `publishedRevisionTag`.
- `GET /courses/:courseId/drafts/:revisionId/formula-workspace` — existing workspace now includes stale-review count.
- Existing proposal/review/history routes are reused; mock creation remains test-only.
- Existing published document/crop endpoints serve original source inspection; there is no new public provider endpoint.

Studio shows accepted, corrected, rejected, pending and stale counts and explains snapshot invalidation. Optional recognition is not mandatory. The publication action saves only dirty content, refreshes the current snapshot, records instructor approval, prepares and publishes. Its reader link uses the returned committed tag, rather than the source-draft tag. Snapshot/crop changes produce an actionable 409; invalid reviewed notation produces 422. Management permission is rechecked during freezing and the existing activation protocol.

## Before and after

Before this milestone, finalized FormulaProposal records could be reviewed in Studio but did not become a frozen published reader representation. The reader retained plain extracted notation.

In the application browser test, the summation was corrected to `S_n = \sum_{p=0}^{n} u_p`, a limit/fraction proposal was accepted, and an integral proposal was rejected. The new revision rendered exactly two reviewed KaTeX blocks; the rejected integral retained source extraction. Both reviewed captions and a nonempty source-crop image were asserted. Downloaded PDF bytes matched the frozen source-manifest SHA-256.

An initial browser run exposed a reader contract bug: review metadata was parsed as a block requiring its own ID, producing zero KaTeX elements. The metadata parser was corrected; the assertion requiring two rendered formulas was retained and passed. No assertion was relaxed to accept an HTTP-only result.

## Browser evidence

![Reader with reviewed formulas](evidence/reviewed-formula-publication/reader-reviewed.png)

![Original PDF region inspection](evidence/reviewed-formula-publication/source-inspector.png)

Screenshots were captured from the application browser test and visually inspected. They show the reader and original-crop dialog, respectively.

## Validation commands and actual results

Run from repository root unless a working directory is specified:

| Check | Result |
| --- | --- |
| `pnpm --filter api typecheck` | Passed |
| `pnpm --filter api build` | Passed; generated Nest controller includes approval route |
| `pnpm --filter web typecheck` | Passed |
| `EDNOVA_NEXT_DIST_DIR=.next-formula-build pnpm --filter web build` | Passed production build |
| Targeted Jest command below | 33 passed, five suites; clean exit with open-handle detection |
| Existing M08 publication command below | 8 passed |
| `pnpm --filter web test` | 89 passed, 17 files |
| Python targeted command below | 10 passed |
| `python -m compileall -q apps/ai/agents apps/ai/services` | Passed |
| `FORMULA_PUBLICATION_E2E=1 pnpm --filter web exec playwright test -c playwright.formula.config.ts` | 1 passed; final run approximately 35 seconds |
| `pnpm --filter web exec playwright test -c playwright.formula.config.ts` | 4 existing Studio browser tests passed; approximately 55 seconds |
| `git diff --check` | Passed |

```bash
pnpm --filter api exec jest \
  modules/study/src/tests/formula-publication.integration.test.ts \
  modules/study/src/tests/formula-jobs.integration.test.ts \
  modules/study/src/tests/formula-proposal.integration.test.ts \
  modules/study/src/tests/course-reader.test.ts \
  modules/study/src/tests/canonical-document.test.ts \
  --runInBand --testTimeout=20000 --detectOpenHandles

# Working directory: apps/api
MONGO_URI=mongodb://127.0.0.1:27017/test_formula_publication_regression_20261102 \
  pnpm exec tsx --tsconfig tsconfig.json --test \
  tests/integration/m08-course-publication.node.test.ts

# Working directory: repository root
PYTHONPATH=apps/ai /tmp/ednova-b2-venv/bin/python -m pytest \
  apps/ai/agents/course_ingestion/tests/test_reviewed_formula_index.py \
  apps/ai/agents/course_ingestion/tests/test_canonical_document.py \
  apps/ai/agents/course_ingestion/tests/test_region_crop.py -q --tb=short
```

The new six-test MongoDB publication suite covers accepted/corrected projection, rejected/pending fallback, new-revision retrieval metadata, proposal mutation independence, receipt replay, unauthorized publication, crop mismatch, stale snapshots, unsafe notation, concurrent source edits, clone behavior, older artifact preservation and concurrent publication. Existing suites cover source-bound review and asynchronous job regressions. Python tests exercise actual PDF artifact building and reject invalid reviewed provenance.

Browser tests use real Next.js, Nest, BetterAuth sessions, isolated MongoDB, RabbitMQ and a separate worker, with mocked internal AI transport. Original reference-PDF bytes/crops are retained. They exercise instructor recognition/review, publication, actual reader rendering, source inspection and post-publication immutability. This browser uses the course owner in the student-reader page; separate enrolled-student context/authorization is covered by existing M08 tests, not a separate student browser login. The service-level publication suite does not claim production session authentication; the browser does use actual sessions.

## Artifact preservation and compatibility

Tests compare prior canonical content and exact `.faiss` / `.meta.json` bytes before and after replacement publication. They remain unchanged. The existing lifecycle may mark the previous revision deprecated; this is a lifecycle-metadata change, not a rewrite of its content/index. Original source blocks and source PDF bytes remain preserved. Mutating proposal records after publication does not change frozen canonical content or reader output.

Changes are additive; existing revisions without a reviewed snapshot continue through the source-backed reader. No database migration or backfill of published indexes occurs. Deploy matching API, web and Python changes together. Rollback stops new reviewed publications and restores the prior application deployment; retain all original/source/target artifacts and receipts. Rewriting existing published snapshots is not a rollback strategy.

## Files and modules

- API: `services/formulaPublication.ts`, `coursePublication.ts`, `courseDraft.ts`, `revisionSources.ts`, `courseReader.ts`; CourseRevision model; course routes and generated Nest controller; Learning Document V2 contract.
- AI: sources router's reviewed-index metadata contract; revision artifact builder; reviewed-formula index tests.
- Web: Studio publication/formula actions and readiness types; reader registry/source inspector; returned publication tag in action state.
- Tests: MongoDB publication integration suite; reader contract regression; browser publication spec/config and existing browser fixture server; small native synthetic FAISS fixture; captured screenshots.

## Remaining limitations and operational recovery

- No independently established mathematical accuracy, broad document fidelity, production Gemini performance, additional provider usage or charges were measured here. No new real Gemini request was made.
- Source inspection/indexing are mocked transports in the browser harness; Python artifact behavior is covered separately. An end-to-end deployment with the actual embedding/index service remains an operational gate.
- Without cross-document transactions, the freeze receipt is the capture boundary, not a claim of global serializability across proposals, source draft and course pointer. Frozen source receipt and exact target snapshot checks prevent automatic use against another draft.
- If target indexing fails after source freeze, the source intentionally remains prepared. After fixing the dependency, an operator can retry the exact original publication command, which reuses the receipt. Studio recovery for this partially prepared state is not fully polished.
- Exact source-expression equality fails closed for legacy canonical math blocks truncated relative to the proposal's full source text. Broader long-region normalization is not implemented.
- Crop rendering re-inspects preserved source bytes. Future parser/region-ID changes may require compatibility handling to keep old region crops addressable. The full original PDF remains available.
- Existing aggregate extraction acknowledgement remains applicable. Optional formula recognition does not imply every equation was reviewed. Stale reviews retain fallback content and readiness warnings; users must review the new draft snapshot explicitly to publish replacements.

This completes the requested reviewed-publication milestone within the measured test scope. Batch 2 remains open for its wider fidelity and deployment acceptance; no Batch 3 work was started.

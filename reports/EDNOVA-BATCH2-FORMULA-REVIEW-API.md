# Batch 2: Persistent formula review API

## Implemented endpoints

Under `/api/v1/study/courses/:courseId/drafts/:revisionId/formula-proposals`:

- `POST /:proposalId/review` accepts `{action: "accept" | "correct" | "reject", reviewVersion, draftVersion, latex?}`. `latex` is required for correction and forbidden for other actions.
- `GET /:proposalId/history` returns complete history, current state and review version.
- Existing authenticated `GET /:proposalId` returns the persisted proposal including its reviewed expression and history.
- Existing `POST /test` remains disabled unless both test mode and `FORMULA_MOCK_PROVIDER=1` are configured. No model output can be supplied by the client.

The generated Nest Study controller now registers these routes and the previous proposal/crop endpoints behind its SessionGuard. HTTP integration tests use the existing Express contract adapter with injected test identities; production session authentication is a separate gate.

## Transition and persistence rules

Only `pending` may become `accepted`, `corrected` or `rejected`. No reopening operation exists. Each transition requires the expected review version and draft version. One MongoDB `findOneAndUpdate` filters on proposal ID, course, revision ID/tag/version, pending state and review version. The same operation sets the state and optional reviewed expression, increments reviewVersion, and appends the reviewer, action, previous/new state, correction where applicable, timestamp, revision ID/tag/version and resulting review version. A lost race or finalized proposal returns 409.

`reviewedLatex` holds accepted/reviewer-corrected content separately from the original model `latex`. Original source text, original proposal, crop identity and source geometry are retained. The model remains a separate collection from canonical source blocks. History is append-only through this API; clients cannot provide reviewer identity or audit entries.

The helper resolves course-management permission, the current editable draft, proposal ownership, exact revision identity/version and source-document manifest membership/hash, and verifies the immutable source blob. It rechecks authorization and draft snapshot before and after the atomic decision. Wrong ownership returns 403 or 404 without disclosing a foreign proposal; stale snapshots return 409.

Corrections are limited to 8,000 characters, reject empty strings, HTML-like input, unsafe control characters and selected unsupported/dynamic LaTeX commands. KaTeX parsing uses the trusted reader's settings: strict errors, trust disabled, bounded macro expansion and HTML/MathML output. These checks supersede the limited brace checks for reviewer corrections; they are syntax and renderer compatibility checks, not mathematical verification. No expression is executed or promoted into canonical evidence.

## Concurrent creation

Creation still uses the unique identity index and atomic upsert. On duplicate-key conflict it fetches the existing identity and compares immutable course/revision/source/model/expression fields and geometry. Only a compatible record is returned; mismatches return 409. Existing review status is preserved during retries.

## Tests and actual results

The real isolated MongoDB HTTP integration suite uses `test_formula_proposal_<pid>`, actual Mongoose models and indexes, and drops its database after testing. Only the internal AI HTTP response and the authenticated test identity are simulated; no repositories are mocked. Source blobs are temporary fixtures and verified by the API. This does not claim complete Python-to-Node network or production login coverage.

Commands from repository root:

- `pnpm --filter api typecheck`: passed.
- `pnpm --filter api build`: passed.
- From `apps/api`: `pnpm exec jest modules/study/src/tests/formula-proposal.integration.test.ts modules/study/src/tests/course-reader.test.ts modules/study/src/tests/canonical-document.test.ts --runInBand --testTimeout=12000 --detectOpenHandles`: **19 passed across 3 suites**. Five integration cases cover persistence and concurrent creation; accept/correct/reject with fresh connection audit reads; anonymous/unauthorized users; wrong course/draft and stale version; invalid corrections; simultaneous decisions with exactly one success; finalized-state rejection; unchanged original proposal/source/crop; byte-for-byte published-revision fixture preservation; and a real draft-version change injected after the atomic decision.

The last run exited normally with no `--forceExit` and no reported open handles. Each separate Mongoose connection is explicitly closed; the default connection and test database are cleaned up. The earlier native `mongodb` client timeout was avoided by using a fresh Mongoose connection. A dynamic-import test failure was corrected to use static imports. No production resource or provider call was made.

## Consistency limitations and publication boundary

The proposal transition is atomic within one document. Draft checks and proposal writes are not a cross-document transaction. If the draft changes after the decision, the API returns 409 when detected; the old-snapshot decision can remain recorded for audit. Subsequent retrieval and review reject that snapshot. There remains a window after the final check during which the draft or authorization may change. No rollback pretends to erase that audit event.

Current publication, retrieval and reader paths do not consume formula proposals, so a reviewed record is not eligible to alter any published equation in this milestone. Any eventual proposal projection must check the exact course ID, revision ID, revision tag, draft version, source document hash, region and crop identity; review state alone is never a publication grant. This requirement is not a claim of a newly implemented publication feature.

## Files and readiness

Modified `FormulaProposal.ts`, course route contracts and the generated Nest Study controller; added `services/formulaReview.ts`; extended the real-MongoDB proposal integration suite; added API KaTeX runtime/type dependencies and updated the lockfile. Earlier source-inspection and crop code remains in place.

**GO for this bounded backend review milestone under the documented test scope.** Production session/network validation, publication projection, Studio, reader and Gemini orchestration remain separate work. Batch 2 remains open; no Batch 3 functionality was added.

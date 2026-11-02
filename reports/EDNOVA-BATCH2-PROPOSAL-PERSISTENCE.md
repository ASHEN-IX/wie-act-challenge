# Batch 2: Formula proposal persistence

## Endpoints and behavior

- `POST /:courseId/drafts/:revisionId/formula-proposals/test` creates or returns a pending mock proposal. It exists only when both `NODE_ENV=test` and `FORMULA_MOCK_PROVIDER=1`; production returns 404. The body is restricted to `documentId`, `regionId` and integer `draftVersion`; it cannot specify LaTeX, provider, source hash, bounding box or review state.
- `GET /:courseId/drafts/:revisionId/formula-proposals/:proposalId` requires an authenticated course manager and returns a proposal scoped to the current draft. A changed draft version produces 409.

The API checks management permission and the current editable draft, validates the manifest document and hashes the immutable source blob, then calls the internal AI service. The test-only AI endpoint `/api/ai/sources/validate-formula-proposal` independently resolves the math region and crop through the manifest and validates its fixed mock response using the existing Python recognition proposal contract. Both AI and API endpoints require explicit test-mode configuration. The API checks the returned source identity, crop hash, page and geometry, fixed model/response and pending status before saving. The mock never invokes Gemini. The internal service is an authentication boundary and must remain protected by the existing service authentication configuration.

## Persisted document

`FormulaProposal` stores course and draft IDs, revision tag and draft version, immutable document ID/hash, region ID/page/bbox, extracted source text, crop hash, provider/model, fixed mock LaTeX, warnings, pending state, review version, empty history, identity hash and timestamps. The unique `identity` index protects idempotent sequential inserts; a second index supports course/revision/version lookup. The identity hashes course, draft ID/tag/version, document ID/hash, region, crop hash and the fixed mock model/response. Original canonical blocks and published revisions are not overwritten.

The create handler checks authorization and draft version immediately before and after an atomic single-document upsert. GET filters by course, draft ID/tag and verifies the current draft version. Without a multi-document transaction, a draft may change between the final check and response, and a stale row may remain stored if a change occurs during creation; later GET rejects it when the tag or version changes. Concurrent upserts of the same new identity may cause a duplicate-key failure rather than returning the existing record; they cannot create duplicates. Stronger cross-document serialization and duplicate-key retry remain future work. No review API, reader integration or production recognition was added.

## Validation

- `cd apps/api && pnpm exec jest modules/study/src/tests/formula-proposal.integration.test.ts --runInBand --testTimeout=12000 --forceExit`: **1 integration test passed**, performing actual HTTP requests against real MongoDB database `test_formula_proposal_<pid>`, including create, duplicate, GET, an independent fresh Mongoose connection, anonymous and wrong-user access, cross-course/document mismatch, missing region, stale version and published-revision version preservation. It injects test user identities in middleware and mocks the internal AI HTTP response; it does not test production authentication middleware or the complete Python-to-Node network boundary. MongoDB database is dropped after testing. Jest was forced to exit due to open handles.
- `pnpm --filter api typecheck` and `pnpm --filter api build`: passed.
- `pnpm exec jest modules/study/src/tests/canonical-document.test.ts modules/study/src/tests/course-reader.test.ts --runInBand` from `apps/api`: **14 passed**.
- Python crop/inspection tests: **5 passed**, including mock-provider production gating and shared proposal validator. These mock the extractor's region lookup; no full PDF-to-HTTP integration is claimed.
- `git diff --check`: passed.

The initial HTTP test timed out because the separate `mongodb` package client did not connect in the Jest environment; switching to a fresh Mongoose connection resolved it. A subsequent typecheck caught a Mongoose lean type union; the route now guards array values and the final checks passed.

## Remaining limitations

This is a test-only persistence slice, not an operational Gemini feature. Production session authentication, internal network authentication, actual source extraction through the HTTP stack, distributed races, concurrent duplicate submissions, authorization revocation during response, provider billing/approval, review, publication and reader rendering are not verified here. The current test proves no published-revision version change in its fixture, not byte-for-byte comparison of every published artifact. Batch 2 remains open.

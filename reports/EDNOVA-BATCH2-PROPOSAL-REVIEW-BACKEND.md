# Batch 2: Formula proposal review backend

**Incomplete; NO-GO.** The requested proposal API lifecycle, review concurrency controls and real-MongoDB integration tests have not been implemented. This continuation adds internal source inspection and a preliminary, unused persistence schema. It does not implement the acceptance criteria.

## Actual endpoints

The internal AI endpoint `POST /api/ai/sources/region-inspect` accepts the same manifest-bound identifiers as the crop endpoint. It resolves the region server-side, requires a math type and matching document, obtains the validated crop through the existing crop logic, and returns document hash, page, geometry, source text and crop SHA-256. It is an internal endpoint, not a user-facing proposal API. The previously added draft crop API remains unchanged in this continuation. No proposal creation, listing, review, or history API exists yet.

## Persistence model and indexes

`apps/api/modules/study/src/models/FormulaProposal.ts` defines a preliminary separate collection, a unique proposal identity index, a course/revision/draft-version lookup index and embedded decision history. It is not connected to endpoints, and its index has not been verified against a real MongoDB instance. A schema alone does not enforce authorized review or prevent stale revision races.

## Authorization and concurrency

The internal inspection uses existing source-manifest extraction and crop checks; user-facing course authorization and stale-safe review operations are not implemented here. The local MongoDB reports `replicaSet: null`. Multi-document transactions require an appropriately configured replica set; a separate isolated replica-set fixture or a proven alternative atomic design is needed to test revision and proposal updates together. The standalone server does not prevent building or testing other parts of the milestone, and it is not evidence that the requested feature is complete.

## Testing

`PYTHONPATH=apps/ai /tmp/ednova-b2-venv/bin/python -m pytest apps/ai/agents/course_ingestion/tests/test_region_crop.py -q --tb=short`: 4 passed. The new inspection test mocks extraction region lookup, and verifies hash binding and rejection of non-math regions; it is not a real MongoDB/API integration test. `pnpm --filter api typecheck`: passed. `git diff --check`: passed. API build, lifecycle integration tests, draft-crop security integration tests, concurrent review and process-restart persistence tests have not been run.

## Remaining blockers

Implement authorized course/draft/manifest lookup, mock-provider-only creation, idempotent proposal persistence, authenticated read/list/accept/correct/reject/history endpoints, atomic stale-revision and concurrent-review handling, and real isolated MongoDB integration tests including the draft crop route. Verify old published revisions remain unchanged. No real Gemini calls or Studio/reader changes were made. Batch 2 remains open; do not start Batch 3.

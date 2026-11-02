# Batch 2 Gemini recognition vertical slice

**NO-GO: incomplete.** This continuation implements a portion of draft source-crop access. It does not implement the requested recognition-to-reader workflow, and it has not been demonstrated in the application. No new Gemini calls were made.

## API endpoints and job lifecycle

Added `GET /:courseId/drafts/:revisionId/sources/:documentId/regions/:regionId` to the course routes. It checks `canManageCourse`, requires a draft revision and source document from its manifest, verifies the immutable blob, calculates a manifest digest, and calls the internal crop endpoint. It rechecks management access and draft status/version before sending PNG bytes. It returns private, no-store responses. This endpoint has not yet been exercised through live authentication or browser integration tests; in particular draft selection and concurrent edit behavior need further validation.

The internal `/api/ai/sources/region-crop` accepts extractor-classified math regions as well as figures and captions; geometry now rejects non-finite coordinates. Region identity and document matching come from the source extractor and manifest, not request-provided boxes. Crop rendering remains in the internal API process, not a separate resource-limited worker.

No recognition job lifecycle or new job API was implemented. The existing research runner is limited to benchmark fixtures and cannot serve arbitrary courses or durable jobs.

## MongoDB persistence model

No new persistence model or migration was implemented. Proposals and review decisions are not stored on drafts or published revisions. The pre-existing research proposal JSONL files are not course records.

## Studio screenshots and reader results

No Studio controls, screenshots, browser tests, or reviewed-equation reader projection were added. Existing reader behavior remains deterministic source-backed output. No claim is made that an instructor can review or publish Gemini output.

## Automated and live evidence

Three Python source-crop tests passed, including a synthetic math region and rejection of non-finite geometry. API `pnpm --filter api typecheck` passed. The new draft route has not been exercised by an integration test and no new live end-to-end test was conducted. Earlier benchmark evidence and tests are documented in `EDNOVA-BATCH2-GEMINI-HYBRID.md` and do not prove this workflow.

## Provider usage and budget

No new provider requests or tokens were consumed in this continuation. The earlier separately authorized research run made three calls using 1,681 provider-reported tokens; these remain unverified proposals. The current research runner's local lock, attestation and token reservation are insufficient by themselves for distributed production use. A fresh scoped approval and verified eligibility would be required for further real-provider research.

## Security and revision integrity

The draft route requires management authorization and verifies source bytes before rendering; the AI endpoint resolves region geometry server-side and limits image size. It does not permit arbitrary request-supplied paths or coordinates. Existing published revisions were not migrated or rewritten. Authorization, stale changes, denial cases, crop processing isolation and cross-course identity must be covered by integration tests before deployment. The finite-geometry test mocks region lookup; it is not an end-to-end source-provenance test.

## Remaining blockers and decision

Still required: owner-consent and free-tier verification bound to each document, durable idempotent cancellable recognition jobs, provider dispatch with existing budget checks, revision-bound proposal storage and review history, authenticated stale-safe review API, Studio preview and controls, reviewed-only reader projection, and complete integration/browser tests including no modification of old revisions. The requested workflow is **not complete**, and production integration is **NO-GO**. Batch 2 remains open; Batch 3 was not started.

# Batch 2: Asynchronous Gemini recognition jobs

## Implemented workflow and endpoints

Under `/api/v1/study/courses/:courseId/drafts/:revisionId`:

- `POST /formula-consent` with `{consent:true, documentId, draftVersion}` records authenticated course-owner consent for the exact immutable document hash and Gemini provider. Assigned managers require an existing owner grant; they cannot grant consent on the owner's behalf.
- `POST /recognition-jobs` with `{documentId, regionId, draftVersion}` validates the current draft and source, operational controls and operator approval, persists an idempotent job and dispatches its ID to RabbitMQ. Returns 202 and the durable record. Extra body fields are rejected.
- `GET /recognition-jobs/:jobId` returns authorized course/draft-scoped status, usage, audit result and proposal ID when available.
- `POST /recognition-jobs/:jobId/cancel` cancels queued or running work. It cannot revoke bytes already sent to a provider; a cancelled in-flight result does not complete its job.

Existing proposal GET and review APIs retrieve and review the resulting pending FormulaProposal. The generated Nest Study controller includes all new endpoints under the existing SessionGuard. Mock proposal creation retains its previous test-only restrictions.

## Queue, worker, state machine and recovery

`pnpm --filter api worker:formula` runs `scripts/formula-recognition-worker.ts` as a separate process. It connects to the existing RabbitMQ broker and `ai.jobs` direct exchange. Routing key `study.formula.recognize` binds the durable `ai.work.study.formula.recognize` queue. Messages contain only a job ID; all authority and source data are reloaded from MongoDB. Publisher confirms are required. Queue capacity is 100 pending messages with reject-publish overflow, prefetch is one, and RabbitMQ single-active-consumer serializes the operational worker group. Test queue/routing names are isolated.

Jobs move `queued -> running -> completed`; other terminal outcomes are `failed`, `cancelled`, `stale` and `uncertain`. MongoDB atomically claims only queued jobs with a unique claim token, so duplicate delivery cannot claim completed or already-running work. Completed jobs are never redispatched to Gemini. Every 30 seconds, recovery republishes up to 100 retained queued outbox records; uncertain publisher acknowledgements can be recovered by replaying the same identity. Duplicate notifications are harmless. Running records older than two minutes become uncertain; they are not re-executed. A Python per-job dispatch marker independently prevents a second external call, including after a process crash. There are no provider retries. Explicit operator reconciliation is required for uncertain calls; do not reset those records blindly.

A worker shuts down by cancelling its broker consumer, awaiting active work and closing broker and database resources. There is no new automatic publication or source-block mutation.

## Source binding, authorization and operational controls

Submission and worker execution check current course-management permission, current draft ID/tag/version, manifest membership, immutable source blob hash, math region and crop identity through the internal source-inspection endpoint. The worker repeats checks before accepting a response; stale results are ineligible for the current draft. Validated raw proposals and usage are retained on the job for audit before attempting final proposal insertion. The proposal preserves original source text, geometry and crop hash, provider/model/version and usage; the immutable identity derives from the job and validated proposal. It starts pending and uses the existing review API.

Owner grants are stored in `formula_source_consents`, with a unique identity index over the derived course/document/provider grant identity, authenticated owner, source hash, provider and time. Ownership is checked again when a worker uses a grant. Operators can revoke grants in the protected control collection; no administrative control-writing API is exposed.

Privileged operator configuration must provide a current record in `formula_provider_eligibility` containing `provider: gemini`, exact model, `freeTier: true`, `billingAttached: false`, a future Date `expiresAt`, `keySha256`, `projectId`, and `verifiedBy`; revoked records fail closed. This is a privileged record of a provider-side verification, **not an automatic billing API or a guarantee against later account changes**. Do not populate it merely because a model advertises a free tier. The API does not accept these fields from a request. Python verifies the key fingerprint before dispatch. The task's earlier screenshot is not silently converted into a fresh operational grant.

API and AI services must use the same application MongoDB database for jobs and consent/eligibility records. The AI service additionally requires `GEMINI_API_KEY`, `LLM_APPROVALS_JSON`, `LLM_BUDGET_MONGODB_URI`, and `LLM_BUDGET_DB_NAME`. Compose now passes the durable-budget variables explicitly. Approval task remains `course_multimodal_prototype`, bound to the exact LiteLLM model; default job model is `gemini/gemini-2.5-flash`, configurable with `FORMULA_RECOGNITION_MODEL`, and must match the configured/approved model. Missing credentials, consent, eligibility, approval or budget stop processing. Deploy the updated Python service and run the worker separately after configuring these controls; tests did not activate production controls.

## Provider dispatch and accounting

Internal service-authenticated `/api/ai/sources/recognition-preflight` checks credential binding, approval/budget configuration and budget-database reachability. It does not reserve or promise that quota will remain available. `/api/ai/sources/recognize-formula` rechecks persisted job state, consent, eligibility and source crop, reserves a request through existing durable LLM machinery and atomically reserves 65,536 tokens in its budget record before using the official Gemini SDK. Request attempts and conservative token allowances remain consumed after failures. A durable `formula_dispatches` record stores the per-job dispatch identity, approval ID, reservations and actual provider usage/model version when returned. Usage is also copied to completed proposals and job audit records. Reconciliation means comparing those durable records; this version does not automatically refund reservations.

Timeout is 30 seconds in the SDK, one attempt, 512 output tokens, fixed prompt and bounded source crop (up to 1 MB and existing rendering limits). Node allows 40 seconds for the internal HTTP call. These are resource limits, not proof of a hard aggregate provider-token or dollar bound. Token reservation alone cannot establish zero charges, account tier, future quota or invoice cost. No new real Gemini calls were authorized or made in this milestone.

The existing Python recognition contract and provider-independent projection validate structured responses and bind source identity; Node checks matching source/page/geometry/model/version and bounded token usage, then uses the existing strict KaTeX compatibility checks. Unresolved/invalid outputs are not promoted. Provider-generated identifiers never determine the trusted geometry. Original PDFs and canonical blocks remain authoritative.

## Persistence and consistency limits

`FormulaRecognitionJob` has a unique identity index over course, draft snapshot, source region/crop and model. Concurrent submission upserts recover the same job. MongoDB claims and token/request reservations are atomic within their individual documents. Single-active-consumer limits broker processing, while the dispatch marker prevents duplicate external calls independently of broker delivery.

There is no cross-document transaction joining draft, grant, budget, job and proposal. Authorization, consent, cancellation or draft changes can race the final checks. A cancellation cannot stop an already accepted provider request. A crash after proposal insertion but before job completion can leave an auditable pending proposal with an uncertain job; it is never automatically retried or published. Existing proposal GET/review enforces draft snapshot identity. Further publication projection must retain those exact checks. No proposal is currently projected into published reader/retrieval content.

## Actual integration evidence

Node tests use a real isolated MongoDB database, real local RabbitMQ broker with a dedicated test queue, actual HTTP route handlers, and a separately spawned worker process. Only authenticated test identity and the internal AI transport server are simulated. The local mock AI server emits structured mocked Gemini responses; this is **not** a live Google test or a full Python HTTP integration test. Separate Python transport tests invoke the real implementation with real MongoDB reservations and a mocked Gemini SDK plus mocked source rendering.

- `pnpm --filter api generate:contracts`: passed.
- `pnpm --filter api typecheck` and `pnpm --filter api build`: passed.
- From `apps/api`: `pnpm exec jest modules/study/src/tests/formula-jobs.integration.test.ts modules/study/src/tests/formula-proposal.integration.test.ts modules/study/src/tests/canonical-document.test.ts modules/study/src/tests/course-reader.test.ts --runInBand --testTimeout=20000 --detectOpenHandles`: **26 passed**, four suites; no forced exit.
- Job suite alone: **7 passed** after the final transport checks. Covers HTTP/queue/separate-worker completion and authenticated proposal GET; missing owner consent, unauthorized/anonymous submission, missing approval/budget preflight, stale version and source mismatch; missing eligibility; duplicate submission/delivery; queued restart recovery; simultaneous atomic claims; mocked provider timeout response and malformed output; queued and in-flight cancellation; stale in-flight response; interrupted work becoming uncertain; unchanged published revision fixture.
- Python: `PYTHONPATH=apps/ai /tmp/ednova-b2-venv/bin/python -m pytest apps/ai/agents/course_ingestion/tests/test_formula_job_transport.py apps/ai/agents/course_ingestion/tests/test_gemini_research.py apps/ai/agents/course_ingestion/tests/test_recognition_provider.py apps/ai/agents/course_ingestion/tests/test_region_crop.py -q --tb=short`: **16 passed**. Real MongoDB transport tests prove request/token consumption, one dispatch per job, missing approval denial and exhausted token-budget denial without invoking the SDK.
- CI-style `python -m compileall` over the AI packages passed. Targeted mypy (`--ignore-missing-imports --follow-imports=skip --check-untyped-defs`) on `formula_recognition.py` passed; this is not a whole-repository strict type audit.

The initial queue test used guest credentials and failed authentication; the test now loads the existing broker credentials without logging them. The published-fixture comparison initially differed only by JSON key order; both snapshots now use fresh database reads and match. Timing evidence here measures local mocked orchestration (job suite approximately 8 seconds), not Gemini latency or throughput. Mocked provider output uses fabricated test token counts; no new real provider token/cost measurement is claimed. Production session authentication remains a separate gate.

## Files and decision

Added the job model, `services/formulaJobs.ts`, standalone worker entrypoint, Node queue integration suite, Python `formula_recognition.py` router and MongoDB transport tests. Updated the sources router registration, course API and generated Nest controller, proposal model fields, package worker command and Compose budget variables.

**GO for the implemented mocked asynchronous backend milestone; no new real-provider rollout certification.** Operational eligibility and approval must be established independently before real traffic. Full production session/network testing, provider-side timeout/429 behavior, deployment supervision, independent formula ground truth and a future reviewed-only publication projection remain outstanding. Batch 2 remains open. No Studio redesign, reader projection or Batch 3 was implemented.

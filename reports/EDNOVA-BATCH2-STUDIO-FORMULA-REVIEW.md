# Batch 2: Studio formula review experience

## Implemented instructor workflow

Course Studio now includes a focused Formula review section with mathematical region selection, original crop/page/document/region reference, bounded extracted text and warnings, recognition status, original generated LaTeX, trusted KaTeX previews, reviewer corrections, final decisions and audit history. Owners can grant document consent; assigned instructors see an explanation that new consent requires the owner. Server authorization remains authoritative for every operation.

The demonstrated workflow is: actual login → open draft → choose source formula → retrieve its crop → record document consent → submit recognition → real RabbitMQ job → separate worker → persisted pending proposal → compare source and preview → correct/accept/reject → reload Studio → retrieve the saved decision and history. All three review actions were exercised. The browser fixture uses the existing three reference-PDF regions, original PDF bytes and benchmark PNGs. No new real Gemini calls were made.

## Components and routes

- `apps/web/src/features/courses/course-studio.tsx`: embeds the formula workspace within the existing layout; dirty course edits, an in-progress course mutation or a just-published revision disable formula mutations.
- `formula-review.tsx`: source/recognition/review panels, selection, polling, consent, cancellation, versioned decisions and history. Final decisions have no mutation controls. Original generated LaTeX is retained alongside the reviewed representation.
- `formula-actions.ts` and `formula-types.ts`: typed authenticated server-action calls and serializable status/error results. HTTP 409 and operational error codes survive the Next server-action boundary.
- `/api/formula-crop`: same-origin authenticated PNG proxy to the existing draft crop API. It forwards the session cookie only to the configured backend, validates path segments, refuses redirects, enforces timeout/output limits and returns private no-store images. It exposes no server file path or credential.
- `GET /api/v1/study/courses/:courseId/drafts/:revisionId/formula-workspace`: new read-only discovery endpoint for reload. It checks management permission and exact current draft, then returns source-backed math regions, current snapshot version, server-derived owner permission, and persisted proposals/jobs. Canonical source documents and the existing proposal/job collections supply this data; no new persistence system was added. Output is bounded to 200 entries per collection.
- `apps/api/src/framework/domains/study.module.ts`: regenerated to register the workspace endpoint behind the existing Nest SessionGuard.
- `services/formulaJobs.ts`: preserves safe operational denial codes (`FREE_TIER_UNVERIFIED`, `OPERATOR_APPROVAL_OR_BUDGET_UNAVAILABLE`) for the UI rather than masking them as successful or available recognition.

The UI reuses existing consent, submission, job GET/cancel, proposal GET/review and history endpoints. It does not infer approval or billing state from a configured model. Request controls prevent duplicate submissions; the backend additionally enforces durable idempotency. A terminal job is displayed as its actual state and is not automatically resubmitted.

## Authorization, concurrency and lifecycle

Workspace discovery never accepts client source hashes, ownership flags or geometry. The crop and write endpoints retain their existing source verification and authorization. Assigned instructors cannot grant new owner consent; a real assigned-membership browser fixture confirms that control is absent. A user without course access cannot open formula controls.

Review actions send the server-provided `reviewVersion` and `draftVersion`. A conflicting decision produces 409, refreshes the persisted workspace, and makes an already finalized proposal read-only. The browser test finalizes a proposal through another authenticated HTTP request, then attempts a stale UI decision and verifies the saved result is refreshed instead of overwritten. Source and original model text remain separate from corrections; a UI review is not independent mathematical ground truth.

Polling is sequential every two seconds, limited to 40 checks per observed job before pausing for manual refresh. Cleanup cancels scheduled polling on navigation/selection changes and unmount; stale responses are ignored. Server jobs continue durably across browser reload. Queued/running are active states; completed, failed, cancelled, stale and uncertain are terminal. In-flight cancellation is explicit and cannot imply that already-sent provider work was undone. No cancelled or uncertain state is presented as a successful proposal.

## Browser evidence

Command from repository root: `pnpm --filter web exec playwright test -c playwright.formula.config.ts`.

**4 tests passed**, approximately 56 seconds in the final complete run:

1. The actual Next Studio page, real Better Auth session, Nest API, isolated MongoDB, real RabbitMQ and separate recognition worker execute the full recognition/review/reload flow on three existing regions. Correct, accept and reject are persisted; history is fetched after reload; source PNGs load and KaTeX is visible; browser runtime errors are checked.
2. Missing eligibility produces the backend's actual denial; source inspection remains usable. Running status and UI cancellation are exercised. Unsafe/invalid corrected LaTeX is rejected and no injected JavaScript executes. An externally finalized review causes a stale UI conflict and refresh. Failed, cancelled, uncertain and stale persisted job states are rendered without a successful proposal.
3. A user without course access cannot open formula controls.
4. An assigned institutional instructor can inspect the workspace but cannot grant new owner consent.

`apps/api/tests/formula-browser-server.ts` seeds only a generated isolated database, starts the real Nest application and worker, and serves a **mock internal AI transport**. It returns benchmark crops and structured mocked proposals; this is not a real Google call or a full Python rendering/network test. Some terminal-state fixtures are inserted directly into the test database to exercise UI presentation. Browser accounts and review decisions are synthetic test data, not independent expert approvals. Source PDF bytes are copied into a temporary immutable-source root. Test services, broker queue, database and upload folder are cleaned up after the run.

Screenshots, captured from the real Studio UI and visually inspected:

- [Desktop Studio after correction and reload](evidence/studio-formula-review/studio-reviewed-desktop.png)
- [Mobile Studio after correction and reload](evidence/studio-formula-review/studio-reviewed-mobile.png)

The mobile browser assertion checks that the page does not overflow horizontally. Screenshots show the full existing Studio and the focused review section; they are not design mockups.

## Automated validation

- `pnpm --filter web test`: **89 tests passed**, 17 files, including new formula server-action/component tests and existing Studio/reader regressions.
- `pnpm --filter web typecheck`: passed.
- `EDNOVA_NEXT_DIST_DIR=.next-formula-build pnpm --filter web build`: passed, including the new binary proxy route and Studio.
- `pnpm --filter api typecheck` and `pnpm --filter api build`: passed; the browser fixture also builds the API before starting it.
- From `apps/api`: `pnpm exec jest modules/study/src/tests/formula-jobs.integration.test.ts modules/study/src/tests/formula-proposal.integration.test.ts modules/study/src/tests/course-reader.test.ts modules/study/src/tests/canonical-document.test.ts --runInBand --testTimeout=20000 --detectOpenHandles`: **26 passed**, four suites. Workspace discovery/current-version and access denials were added to the existing real-MongoDB test.
- `git diff --check`: passed.

The first web test run needed a server-action mock in the retained SSR Studio test. Additional browser tests initially mutated a different generated database because Playwright loaded configuration in both runner and worker; the fixture now propagates one stable database name and asserts its course exists before mutations. An interrupted fixture left a test Next process on its dedicated port; that test process was stopped before rerunning. The final browser run completed without those failures.

## Limits and readiness

This milestone does not project reviewed expressions into published reader or retrieval content, change publication policy, or certify mathematical accuracy. Saving course changes creates a new draft snapshot; old-snapshot formula reviews remain historical and do not automatically transfer. The existing aggregate extraction acknowledgement remains distinct from individual formula review.

The workspace lists at most 200 regions, proposals and recent jobs; larger courses need pagination. Selection resets on reload, while saved decisions remain discoverable for each region. Queued status and polling share the same active-state path; the browser run explicitly observes running and terminal states, while durable queued dispatch is covered by backend tests. The full 80-second polling cap, arbitrary hard network disconnection, and every assistive-technology scenario were not exercised in the browser. Server actions already dispatched during navigation are not rolled back; stale client responses are ignored and the backend still enforces exact snapshots.

**GO for the Studio formula-review milestone demonstrated with mocked recognition.** Real Gemini use still requires fresh operational eligibility, consent, approval and budget controls. The broader Batch 2 fidelity and reviewed-reader integration work remains open. No Studio redesign, published reader projection, Batch 3 or AI Experience Planner was implemented.

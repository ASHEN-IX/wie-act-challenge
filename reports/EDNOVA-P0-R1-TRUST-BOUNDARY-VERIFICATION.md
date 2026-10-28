# EdNova P0-R1 — trust boundary verification

24 October 2026, Africa/Tunis. Evidence timestamps are UTC and begin on 23 October.

## A. Executive result

**P0-R1 engineering: PASS for the protected deterministic activity foundation.** The reproduced incorrect-mastery, cross-course insertion, forged-pin, concurrent duplicate, institutional revocation, actor-result lookup and metadata-admin publication defects are corrected. Canonical Nest activity routes were restored **after** the direct-service security gate passed. Real Better Auth cookies, Nest bootstrap and isolated standalone MongoDB verify the resulting HTTP boundary.

This does not certify complete source publication, model assessment, the complete learner UI, governance or production readiness. Activities without a frozen matching source inventory and an approved activity snapshot fail closed. Model evaluators and ambiguous legacy GuidedProblem rubrics return unavailable without evidence. No provider call was made.

Evidence lives in [ednova-p0-r1](evidence/ednova-p0-r1/). The original independent audit reports remain historical and unchanged. [adversarial-results.json](evidence/ednova-p0-r1/adversarial-results.json) is **before-fix reproduction**, not the final result. Final verification is the checked-in [P0-R1 test](../apps/api/tests/integration/p0r1-trust-boundaries.node.test.ts) and the passing root regression log.

## B. Finding closure matrix

Paths below are relative to `apps/api/modules/study/src/`, except the generated adapter and tests.

| Finding | Reproduced defect / root cause | Implemented correction and changed files | Negative verification / actual boundary | Result |
|---|---|---|---|---|
| F00 | Authenticated Nest activity routes returned 404; Express routing did not provide canonical operations | `routes/activities.ts` now uses `createContracts`; regenerated `apps/api/src/framework/domains/study.module.ts` supplies all four operations | REAL NEST HTTP registration/read/submission/private lookup, anonymous 401, foreign 403; disposable generation repeated twice without drift | FIXED; legacy/unverifiable source pins remain fail-closed |
| F01 | Nonempty incorrect GuidedProblem text produced score 1 and persisted mastery | `services/activityEvaluation.ts` evaluates actual server-owned answer keys; `services/activityAttempt.ts` accepts evidence only for correct, reviewed-objective outcomes | PURE DOMAIN and DIRECT SERVICE: `2+2=999`/nonsense score 0 and no evidence; correct deterministic answers produce score 1; empty/invalid steps reject; model/ambiguous rubrics unavailable | FIXED for reproduced mastery defect; model evaluation remains unavailable |
| F02 | Outer course authorization permitted persistence of another course's definition | `services/activityAttempt.ts`, `services/activityResolution.ts` bind actor, URL activity, outer course, definition and evaluation pin before insertion | DIRECT SERVICE: instructor A cannot insert a course-B definition; metadata admin cannot register; invalid registration does not create an activity | FIXED |
| F05 | Duplicate requests included 500s; evidence preceded receipt | `services/activityAttempt.ts`, `models/StudentAttempt.ts`: receipt-first state machine, required unique-index readiness, conditional preparation and deterministic evidence reconciliation | DIRECT SERVICE and REAL NEST HTTP: eight identical submissions agree; one logical receipt/evidence; conflicting payload 409; actual child SIGKILL at claim/preparation/evidence boundaries recovers | FIXED for tested standalone protocol |
| F06 | Forged content hash/activity revision could earn evidence | `services/activityResolution.ts`, `services/activityIdentity.ts`, `models/CourseRevision.ts`, `services/courseDraft.ts`, `services/coursePublication.ts`, `routes/courses.ts`: exact revision, frozen source identity, approved definition/evaluation digests and full submission validation | DIRECT SERVICE: forged hash/revision/document/page, missing revision, invalid option, missing/duplicate/foreign/empty steps reject without attempt/evidence writes; published regrading rejects | FIXED; F03/F04 limitations below |
| F07 | Membership revoked while enrollment remained active still returned published context HTTP 200 | `services/resourceAccess.ts`, `models/Institution.ts`, `routes/courses.ts`, `services/enrollments.ts`: current active institution + membership + scoped enrollment/assignment; `services/tutorGrounding.ts` rechecks before delivery | REAL NEST HTTP: membership, enrollment, institution suspension, assignment revocation and foreign institution denied; personal owner preserved. REAL WEBSOCKET: revoked recipient receives no subsequent room update. Delayed local AI response withheld | FIXED for verified current-grant paths |
| F08 | Lookup by UUID alone selected another actor's receipt and lacked source recheck | `services/activityAttempt.ts`: query actor + attempt + expected URL activity, then current source/definition authorization | DIRECT SERVICE: two actors independently reuse a UUID and retrieve their own results; peer/wrong activity 404; revocation 403 with evidence retained. REAL NEST HTTP peer lookup 404 | FIXED |
| F09 | Broad management predicate gave metadata administrators publication authority | `services/resourceAccess.ts`, `services/enrollments.ts`, `services/coursePublication.ts`: separate administration, enrollment, authoring/review/publication predicates | REAL NEST HTTP: unassigned admin draft/publication 403, roster administration 200; revoked instructor denied. Institution/invitation regressions pass | FIXED under restrictive provisional policy |

`routes/rooms.ts` additionally preserves the named `broadcastRoomState` export alongside its CommonJS router export. Real integration found that the overwritten export otherwise caused a 500 after a room attempt had already committed. The fix preserves the existing router architecture and public projection.

## C. Authorization verification

The new suite creates six authenticated identities, two synthetic institutions, institutional courses, personal ownership and explicit reviewed revision fixtures. Authentication uses actual migrated Better Auth sessions; it does not use an actor header. Older Express/service suites still use `x-test-actor`; those are classified as domain/service regression evidence, not public Nest exploit evidence.

| Actor / change | Observed behavior |
|---|---|
| Active institutional learner with matching enrollment | Published context and protected activity HTTP 200 |
| Membership suspended, enrollment retained | Published context/activity/result denied HTTP 403 |
| Enrollment revoked, membership retained | Published context denied HTTP 403 |
| Institution suspended | Institutional published context denied HTTP 403 |
| Instructor assignment removed | Draft/content-management HTTP 403 |
| Unassigned metadata administrator | Draft/publication denied; enrollment administration permitted |
| Foreign institution actor | Protected context/activity denied |
| Personal owner | Personal content remains accessible; unrelated platform admin gets 404 |
| AI request already dispatched, membership then suspended | Locally delayed result returns 403 without protected response text |
| Existing authenticated room socket, membership then suspended | Subsequent broadcast withheld; room HTTP read denied |
| Peer asks for another actor's attempt UUID | 404, without disclosing a foreign receipt |

The central predicate is reused by source downloads, plans, job/callback/cache delivery and room/notification authorization. The existing M02 real HTTP/internal callback suite passes, including cached result revocation and private file ACLs. The new institutional test directly verifies the previously reachable F07 published-context path. This is not a claim that every possible asynchronous interleaving or distributed deployment was exercised.

Legacy institution records without an explicit `status: active` do not gain an implicit grant. No database backfill or production migration was performed. Institution/enrollment administration remains available to the appropriate active metadata administrator, while assignment targets must be active instructors in that same institution. An institutional creator's ID alone does not grant instructional authority.

Historical-result policy is provisional: retain durable receipts and evidence; deny protected feedback on lost current access. No historical evidence is deleted or silently regraded. The existing result contract has no separate minimally disclosed historical-receipt endpoint, so this mission returns 403 rather than inventing one.

## D. Evaluation verification

| Case | Result / persistence |
|---|---|
| Correct exact-answer GuidedProblem / exact-option quiz | Score 1, private reviewed-definition feedback, one accepted evidence record |
| `2+2=999`, other wrong or nonsense nonempty answer | Score 0, no accepted evidence |
| Empty answer, missing required step, duplicate/foreign step | Validation rejection before receipt/evidence writes |
| Forged option or full pin | Validation rejection before receipt/evidence writes |
| Unsupported model evaluator | Durable unavailable result, no score/mastery/evidence |
| Ambiguous legacy GuidedProblem rubric | Unavailable, no presence/length-based grading |
| Live approved evaluator and live evaluator timeout | **BLOCKED / NOT EXECUTED**: no approved service configuration, authorization or cost bound; model dispatch is disabled in this activity evaluator |

The pure evaluator has no network or model dispatch. Consequently a provider outage or hanging provider cannot be converted into activity mastery. This does not constitute an executed model timeout test or an approved model evaluation.

`exact-answer-v1` is a **provisional local rubric convention**, not an approved wire-schema change: `answerKey[i]` corresponds to public `steps[i]`, with exact NFC-normalized, trimmed comparison. Quiz `v1`/`exact-options-v1` requires exact reviewed option identity. Unknown rubric versions fail closed. Teacher-reviewed definitions remain server-only for answer keys and rubrics.

Objective Bloom classification comes from the reviewed revision, not an invented constant. Evidence records the deterministic evaluator and rubric version. Test execution uses `MOCK_TEST`; outside tests, the existing enum's `DETERMINISTIC_FALLBACK` represents deterministic execution. Neither means a model was called, and this code never invents `REAL_APPROVED`. The terminology needs owner review before contract freeze. An internal deterministic reward-candidate reference may be retained with `finalAwardId: null`; this mission grants no XP or final reward.

## E. Durable attempt verification

Standalone Mongo is used; no multi-document transaction or distributed atomicity is claimed.

1. Validate current actor/source, authoritative definition, full pin, answer identities and optional active room context.
2. Ensure additive unique indexes exist, then claim `(userId, attemptId)` with an insert-only upsert. Fingerprint the complete normalized submission, including room, answers and timing. A changed payload conflicts.
3. Evaluate using the immutable approved definition. Conditionally persist one prepared outcome and proposed evidence **inside the receipt**. Timestamp and evidence identity derive from that winning receipt.
4. Revalidate current access; insert evidence using the stable actor/attempt identity and deterministic evidence ID. Reconcile an existing record, then mark the receipt completed.
5. Recheck protected delivery authorization. Identical retries return the same durable outcome. Interrupted preparation or evidence application resumes from the receipt when the original payload is retried.

A cold-database HTTP test initially exposed duplicate receipts before Mongoose's asynchronous indexes were ready. The service now explicitly awaits required unique-index creation and returns unavailable if uniqueness cannot be established. It never drops indexes. The corrected cold-start gate and full regression both pass.

The test helper runs the actual service in a child process against real Mongo. After an acknowledged claim, prepared write or evidence write, the parent sends **SIGKILL**. Each retry resumes to one completed outcome and one evidence record; repeated delivery/retry does not duplicate evidence. Completion followed by retry covers lost response acknowledgment. No production crash hooks were added.

Recovery is retry-driven, not an unattended sweeper. These tests cover process death, not host power loss, Mongo storage corruption, replica failover, broker delivery or a distributed provider call. Existing pre-protocol receipts remain retained and unavailable (`LEGACY_RECEIPT_UNVERIFIED`) rather than being silently recertified.

## F. Contract generation

The canonical operations are:

- `POST /api/v1/study/activities/:activityId/register`
- `GET /api/v1/study/activities/:activityId`
- `POST /api/v1/study/activities/:activityId/attempts`
- `GET /api/v1/study/activities/:activityId/attempts/:attemptId`

`pnpm generate:contracts` exits 0. [contracts-disposable.json](evidence/ednova-p0-r1/contracts-disposable.json) records two further successful generator executions in a disposable source copy, zero environment files copied, zero adapter drift and the generated study adapter SHA-256. Installed dependencies were reused through symlinks; this verifies generator authority, not a fresh dependency installation.

The pre-routing [service-gate.log](evidence/ednova-p0-r1/service-gate.log) passes 14/14 nodes. Only then was `routes/activities.ts` converted and the adapter regenerated. The corrected authenticated HTTP gate passes 15/15 nodes. No hand-maintained generated method or parallel authoritative Express implementation remains.

## G. Regression evidence

Root commands ran from the repository root. For `pnpm test`, both `MONGO_URI` and `MONGODB_URI` were explicitly set to `mongodb://127.0.0.1:27018/ednova_p0r1_regression`. Integration scripts set the unreachable local AI URL internally. Individual authenticated suites use their own disposable databases.

| Command / boundary | Exit | Executed result | Evidence under mission directory |
|---|---:|---|---|
| `pnpm generate:contracts` | 0 | All four canonical activity operations retained | `generate-contracts-acceptance.log`, `contracts-disposable.json` |
| `pnpm lint` | 0 | Zero errors; 133 existing/test console warnings | `lint-acceptance.log` |
| `pnpm typecheck` | 0 | API and web strict checks | `typecheck-acceptance.log` |
| `pnpm test` | 0 | 6 route nodes; 732 Jest tests/56 suites; 10 Node unit nodes; 242 integration nodes; 17 Better Auth nodes; 47 web tests/7 files. No skipped tests | `test-acceptance-bounded.log` |
| `pnpm build` | 0 | API TypeScript and Next production build | `build-acceptance.log` |
| P0-R1 suite, direct service + Nest HTTP + actual WebSocket + process kill | 0 | 15/15 nodes, included again in full root integration | `real-http-index-gate.log`, root regression log |
| `pnpm test:e2e` through isolated launcher / AUTHENTICATED BROWSER | 0 | 8 Chromium auth/workspace/smoke tests | `browser-auth-dev.log` |
| Enrollment runner / AUTHENTICATED BROWSER | 0 | 9 checks, 4 identities, 2 institutions, invitation acceptance and isolation | `test-course-enrollments.log`, `enrollment-browser/browser-summary.json` |
| Peer text runner / AUTHENTICATED BROWSER + REAL WEBSOCKET | 0 | Two independent contexts, durable retry/history, revocation, recipient isolation | `test-study-together-peer-text-verified.log` |
| Room stabilization runner / AUTHENTICATED BROWSER + REAL WEBSOCKET | 0 | Presenter denial, phase synchronization, reconnect and leave | `test-study-together-e2e-verified.log` |

Node totals include parent test containers. The dedicated P0-R1 count is included in the root integration count and must not be added again. Older M10/M17/M18/M20/M21/M22 suites mount canonical contracts directly; their passing results are not mislabeled real Nest HTTP. Browser checks use real Next development servers, Nest and Mongo, not API mocks. Their copies correct paths, evidence destinations, localhost readiness and runtime setup; original historical runners/evidence remain untouched. No activity-renderer browser journey is claimed by the generic room runner.

The integration script now bounds file concurrency to two. Initial default 12-way startup produced Mongo network timeouts and cascading peer-text failures. Within-suite eight-request races remain concurrent. The bounded complete root run passes with no skipped infrastructure tests. Initial failure logs are retained. A first root run with an externally forced AI URL also caused two coach tests that expect their default URL to fail; the successful root run leaves that variable unset until the integration script sets it.

Quality corrections include the StudentAttempt newline, realistic owned-course query doubles in the three failing Jest suites, and unknown-activity expectations changing from 503 to 404. Legacy institutional fixtures now create active institutions/memberships/enrollments. Activity fixtures explicitly construct reviewed source identity and register before publication, rather than weakening the runtime checks. The unsafe legacy Studio candidate is now expected to fail closed. Its generation quality remains F12.

Default browser startup first encountered another project's API on port 3001; that process was left untouched. A standalone browser attempt then demonstrated that the production build retained its build-time rewrite address, so runtime environment replacement did not establish an isolated API proxy. The successful browser launcher uses isolated ports and Next development configuration. Initial standalone/auth/readiness failures are retained and are not current-image runtime certification. The room browser copy also had a stale unavailable-assessment text assertion; it now verifies the current waiting-for-presenter message, absence of an activity renderer/submit button and zero false submissions. No product UI was changed to satisfy that assertion.

No Python source changed in this mission, and the full Python suite was not rerun. The previous audit's Python results are historical, not new P0-R1 execution evidence. No production Docker build/runtime, paid inference or real broker/worker pipeline is certified here.

## H. Preservation

Initial branch `main`, HEAD `5fb70a095da8f8cf429aed2e4f4bf72ce096e927`, no staged changes. The baseline contains 27 tracked modifications and additional pre-existing untracked features/reports. [baseline.txt](evidence/ednova-p0-r1/baseline.txt), [baseline-hashes.json](evidence/ednova-p0-r1/baseline-hashes.json) and `before/` preserve 876 initial non-secret source/document files.

[mission-files.json](evidence/ednova-p0-r1/mission-files.json) records the exact mission delta against those initial bytes, with before/after hashes. [preservation.json](evidence/ednova-p0-r1/preservation.json) checks retained initial files, unrelated-source preservation, owner approvals/contracts and historical audit reports. `mission.patch` provides a reviewable mission-only diff even for files already untracked at entry. No file was staged, committed, pushed, reset or cleaned.

Next development runs automatically appended generated include paths to `apps/web/tsconfig.json`. That mission-generated difference is captured separately and the exact initial file restored after the browser processes exit. Environment secrets and installed dependencies were not edited. Approval records and shared contract validators remain byte-identical to the mission baseline.

Only synthetic test databases were used. Existing stopped Mongo/Mailpit test containers were started for the mission and returned to their initial stopped state after verification, without deleting volumes. No other project's services were stopped. No deployment, production database access or destructive deployment migration occurred.

## I. Remaining dependencies and decisions

| Finding / gate | Remaining work |
|---|---|
| F03 | Missing explicit revision fallback is corrected, but full publication/draft compare-and-swap and concurrent review/activation atomicity remain outside this mission |
| F04 | Frozen upload metadata and approved activity digests protect the tested identities. Legacy/replaced inventories and unverified page claims fail closed. Immutable original-byte storage/download revisions and actual matching FAISS index readiness/durability are not certified |
| F10 | Post-tutor-result revocation is corrected. Tier routing, citation/page verification, response schema/projection and protected service-only output still require the source/tutor mission |
| F11 | Key presence is not approved inference; provider-status correction and authorized compact/capable inference remain open |
| F12 | Legacy Studio templates invent grounding and reveal answer cues. Registration now rejects untracked source claims; actual source-backed proposal generation remains open |
| F13 | Durable room activity producer/collection convergence and complete room activity protocol remain open; preserving the broadcast export does not close this finding |
| F14 | Complete grounded tutor/solo/activity/private-debrief/diagnostic learner UI and journeys remain incomplete |
| F15 / ED-26 | 0/19 genuine owner decisions and five confirmations remain pending; contract 1.0.0 is NOT FROZEN |
| F16 | Local mission regression is green. Complete CI Python/domain/browser/transport/parity gates and remote reviewed-source green execution remain unverified |
| F17 | Deployment-target inventory/index migration, backup/restore, fresh images, worker/broker recovery, TLS/proxy, monitoring and disaster recovery remain unverified |

Policy decisions still require genuine owners: metadata-admin versus instructional authority, historical private result disclosure after revocation, provisional exact-answer rubric interpretation, deterministic execution-mode naming and complete source/index publication semantics. No Habib/Tasnim/Aziz decision was fabricated. Real model assessment requires approved service details and explicit cost authorization. Until then it remains unavailable.

## J. Separate readiness verdicts

| Gate | Verdict |
|---|---|
| P0-R1 engineering | **PASS — verified protected deterministic foundation; unverifiable/model paths fail closed** |
| ED-26 governance | **BLOCKED — NOT FROZEN; approvals pending** |
| P0 functional acceptance | **NOT READY — source, AI and learner-journey dependencies remain** |
| Production deployment | **NOT READY — operational and governance gates remain** |

Work stops at P0-R1. These results do not change the historical full-system audit into a production approval.

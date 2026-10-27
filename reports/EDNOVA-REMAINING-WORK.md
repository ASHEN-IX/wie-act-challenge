# EdNova remaining work — 23 October 2026

No product feature was implemented during this audit. Relative complexity S/M/L is not a fabricated deadline. Every task below blocks full-roadmap acceptance. P0 BLOCKER tasks block P0; the operational P1 task also prevents production acceptance.

## Exact next engineering mission

**EDNOVA-P0-TRUST-BOUNDARIES:** fix activity contract routing together with course/actor/full-pin authorization and durable authoritative evaluation before exposing currently unreachable endpoints. Reproduce F00–F09 and F13 through real Nest sessions and Mongo. In parallel, collect actual M03 owner decisions; engineering tests cannot provide those approvals. Then repair source/tutor grounding and finish missing learner/private-debrief journeys.

## Dependency order

1. Governance: F15 and approval-bound policy decisions; regression baseline F16.
2. Safe canonical activity path: F00 plus F01/F02/F05/F06/F08/F09 and current grants F07.
3. Immutable sources/grounding: F03/F04/F10/F11/F12.
4. Shared activity and complete user journeys: F13/F14.
5. Full regression/CI, submission and operational verification: F16/F17.
6. Advanced work, ordered below. Do not restore routing while leaving the latent service vulnerabilities exposed.

## Precise gaps and acceptance tests

### F00 — M10/M13/M15/M17; ED-27/29/31

- Priority / severity: **P0 BLOCKER**, High functional.
- Unmet acceptance/current behavior: Authenticated Nest activity register/read/submit/result return 404; anonymous read returns 401.
- Root cause / defective component: activities.ts exports Express Router; loadDefinitions consumes contract.operations; handwritten Nest methods have no operations.
- Existing implementation: [apps/api/modules/study/src/routes/activities.ts](../apps/api/modules/study/src/routes/activities.ts); [apps/api/src/domain-definitions.ts](../apps/api/src/domain-definitions.ts); [apps/api/src/framework/domain.service.ts](../apps/api/src/framework/domain.service.ts).
- Expected behavior / technical fix: Use canonical createContracts, register routes and regenerate adapters; fix latent service defects before exposure.
- Required tests: Real Nest cookie-session activity registration/loading/submission/result succeeds, negative cases deny, generator has no drift.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F01 — M12/M18; ED-08/29

- Priority / severity: **P0 BLOCKER**, High data integrity, latent service defect.
- Unmet acceptance/current behavior: One incorrect step saying 2+2=999 earns score 1 and persisted masteryAchieved=true, executionMode=REAL_APPROVED.
- Root cause / defective component: GuidedProblem counts nonempty answers divided by submitted steps; ignores required steps and correctness; evidence mode hardcoded.
- Existing implementation: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).
- Expected behavior / technical fix: Use trusted step definitions and rubric/evaluator; only verified correct evidence may carry mastery; report actual execution provenance.
- Required tests: Wrong/nonempty/missing/duplicate/foreign steps earn no mastery; unavailable evaluation stays pending; synthetic evaluation never claims approved inference.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F02 — M02/M10/M21; ED-02/29

- Priority / severity: **P0 BLOCKER**, High authorization, latent service defect.
- Unmet acceptance/current behavior: Manager of course A supplies outer courseId A and definition/evaluation for B; service inserts activity in B.
- Root cause / defective component: Authorization uses outer ID but upsert uses definition courseId; full pin and immutable lifecycle not bound.
- Existing implementation: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).
- Expected behavior / technical fix: Bind path/outer/definition/evaluation/full pin to same authorized course; disallow silent published definition regrading.
- Required tests: Instructor A cannot write/overwrite B; wrong contentHash/activityRevision rejected; published activities immutable.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F03 — M08/M09; ED-05/10

- Priority / severity: **P0 BLOCKER**, High source integrity.
- Unmet acceptance/current behavior: Request for explicit rev_does_not_exist returns rev_a.
- Root cause / defective component: Failed exact lookup falls through to latest published revision in both context and source resolver.
- Existing implementation: [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts).
- Expected behavior / technical fix: Fail closed for explicit missing or revoked revision; preserve original valid deprecated pins.
- Required tests: Unknown revision returns explicit failure; new publication does not redirect an ongoing pinned attempt.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F04 — M05/M08; ED-05/06/30

- Priority / severity: **P0 BLOCKER**, High source integrity.
- Unmet acceptance/current behavior: Replacing Course.files changes authorizedDocumentIds while rev_a stays unchanged.
- Root cause / defective component: Published manifests derive from mutable Course.files; revision lacks frozen source inventory; index readiness unchecked.
- Existing implementation: [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts); [apps/api/modules/study/src/models/CourseRevision.ts](../apps/api/modules/study/src/models/CourseRevision.ts).
- Expected behavior / technical fix: Freeze document IDs/checksums/locations/index metadata per revision and activate only after exact index readiness.
- Required tests: Replacement/failure cannot alter old manifest; FAISS metadata/documents/hash match exact revision before publication.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F05 — M10/M12; ED-29

- Priority / severity: **P0 BLOCKER**, High reliability, latent service defect.
- Unmet acceptance/current behavior: Eight identical concurrent direct-service requests return a mix of 200 and 500; one attempt/evidence persists.
- Root cause / defective component: Read-before-create, evidence inserted before attempt, duplicate-key races unreconciled; partial-write recovery missing.
- Existing implementation: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).
- Expected behavior / technical fix: Claim durable actor/attempt receipt before evaluation; reconcile duplicate claims and recover evidence/result application.
- Required tests: All identical concurrent/restarted retries return same receipt; conflict 409; crash after evidence insertion recovers without stuck/lost result.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F06 — M10/M12; ED-29

- Priority / severity: **P0 BLOCKER**, High evidence integrity, latent service defect.
- Unmet acceptance/current behavior: Forged sha256:ffff... hash and rev_forged activity revision receive grade 1 and evidence.
- Root cause / defective component: Only course revision tag checked; canonical relational validateSubmission is not used.
- Existing implementation: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).
- Expected behavior / technical fix: Validate full source/activity pin, allowed options/steps and URL identity against stored authoritative definition.
- Required tests: Tampered hash/type/activityRevision/step/option rejected before receipt/evidence write.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F07 — M02/M04/M21; ED-02/04/13

- Priority / severity: **P0 BLOCKER**, High authorization, reachable HTTP.
- Unmet acceptance/current behavior: Actual cookie-session published-context returns HTTP 200 after institution membership revoked while enrollment active.
- Root cause / defective component: canReadCourse accepts owner/assignment/enrollment without current active institution membership/status.
- Existing implementation: [apps/api/modules/study/src/services/resourceAccess.ts](../apps/api/modules/study/src/services/resourceAccess.ts).
- Expected behavior / technical fix: Conjoin current institution/membership/role/enrollment; recheck at download/room/AI/cache/WS delivery.
- Required tests: Suspend/revoke student/instructor/institution; all future protected requests/results/streams deny; personal owner data remains separately scoped.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F08 — M10/M21; ED-02/29

- Priority / severity: **P1 MAJOR**, Medium policy and receipt recovery, latent service defect.
- Unmet acceptance/current behavior: Second actor sharing a legal attemptId gets 403 for own receipt; enrollment-revoked actor still gets own protected assessment.
- Root cause / defective component: getAttemptResult queries attemptId without userId then compares actor; current source grant not rechecked.
- Existing implementation: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).
- Expected behavior / technical fix: Query actor+attempt+expected activity; resolve owner policy for retaining own historic evidence while protecting source excerpts.
- Required tests: Both actors retrieve own same-ID record; revoked access follows explicit contract; no peer disclosure.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: F08 core receipt policy; F17 production gate. Blocks full roadmap: YES. Complexity: S.

### F09 — M04/M08; ED-04/05

- Priority / severity: **P0 BLOCKER**, High authority policy.
- Unmet acceptance/current behavior: canManageCourse returns true for institution metadata admin without instructor assignment; publication consumes it.
- Root cause / defective component: One broad predicate conflates institution administration with content author/reviewer authority.
- Existing implementation: [apps/api/modules/study/src/services/resourceAccess.ts](../apps/api/modules/study/src/services/resourceAccess.ts); [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts).
- Expected behavior / technical fix: Separate membership/enrollment administration from instructor review/publication grants; resolve contradictory workflow wording.
- Required tests: Unassigned metadata admin cannot publish or read private learner content; explicit operational setup stays scoped.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F10 — M09; ED-10

- Priority / severity: **P0 BLOCKER**, High functional and grounding.
- Unmet acceptance/current behavior: Tutor raises unexpected keyword tier and always falls back; fabricated page 99999 validates against retrieved page 1.
- Root cause / defective component: Call disagrees with ask signature; citation checks only document ID; Node warns on malformed context and returns untrusted result without post-inference reauthorization.
- Existing implementation: [apps/ai/agents/tutor/grounding.py](../apps/ai/agents/tutor/grounding.py); [apps/api/modules/study/src/services/tutorGrounding.ts](../apps/api/modules/study/src/services/tutorGrounding.ts).
- Expected behavior / technical fix: Correct client signature; validate full pin/document/page/excerpt; fail closed; strip service-only fields; reauthorize before delivery.
- Required tests: Real local Python HTTP boundary verifies schema/citations/pins; delayed revoked recipient denied; separately authorized inference proves real provider.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F11 — M06; ED-03

- Priority / severity: **P0 BLOCKER**, High truthfulness and governance.
- Unmet acceptance/current behavior: Synthetic invalid provider keys report REAL_APPROVED without any network call.
- Root cause / defective component: Provider status treats key presence as approved real execution; no organizer approval provenance gate.
- Existing implementation: [apps/ai/utils/llm_client.py](../apps/ai/utils/llm_client.py); [apps/api/tests/integration/m06-ai-provider-mode.node.test.ts](../apps/api/tests/integration/m06-ai-provider-mode.node.test.ts).
- Expected behavior / technical fix: Separate configured/reachable/tested/approved states and tie result provenance to actual bounded approved call.
- Required tests: Absent/invalid keys/mock/template never claim approved real inference; actual authorized compact/capable calls have redacted provenance.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F12 — M14/M15; ED-32

- Priority / severity: **P0 BLOCKER**, High source and educational integrity.
- Unmet acceptance/current behavior: Node template invents doc_<draftHash>, extracted page 1/locationKnown=true; opt_1 visibly says Correct principle.
- Root cause / defective component: Generator never reads original source/page or invokes Python/model; objective wording becomes fixed answer template.
- Existing implementation: [apps/api/modules/study/src/services/courseStudio.ts](../apps/api/modules/study/src/services/courseStudio.ts).
- Expected behavior / technical fix: Generate proposals from verified extracted passages and truthful doc/page/hash; flag template fallback; retain human review.
- Required tests: Source-free objective cannot claim extracted page; actual source-backed proposal and answer correctness independently reviewed.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F13 — M17; ED-07/29

- Priority / severity: **P0 BLOCKER**, High integration.
- Unmet acceptance/current behavior: Command-aware activity selection reads learning_activities while ActivityRecord writes activity_records.
- Root cause / defective component: Durable command bypasses canonical model and full pin; legacy no-command code uses a different repository.
- Existing implementation: [apps/api/modules/study/src/services/roomCommands.ts](../apps/api/modules/study/src/services/roomCommands.ts); [apps/api/modules/study/src/models/ActivityRecord.ts](../apps/api/modules/study/src/models/ActivityRecord.ts); [apps/web/src/features/collaboration/room-view.tsx](../apps/web/src/features/collaboration/room-view.tsx).
- Expected behavior / technical fix: Use one canonical full-pin activity resolver and real presenter selection UI.
- Required tests: Real presenter selects registered quiz/problem; peers converge; replay/reconnect preserves pins/private submissions.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F14 — M11/M12/M13/M20/M22/M23; ED-08/11/14/15/27/28

- Priority / severity: **P0 BLOCKER**, High acceptance and missing functionality.
- Unmet acceptance/current behavior: M22 has nine subtests plus parent, x-test-actor/direct DB/services, sequential duplicates, no Python/browser; solo tutor/renderer and room debrief not integrated.
- Root cause / defective component: Unit/DTO/internal route tests treated as complete user-facing acceptance; separate selector/diagnostic gates omitted.
- Existing implementation: [apps/api/tests/integration/m22-master-evaluation-scenario.node.test.ts](../apps/api/tests/integration/m22-master-evaluation-scenario.node.test.ts); [apps/web/src/features/collaboration/room-view.tsx](../apps/web/src/features/collaboration/room-view.tsx); [apps/web/src/features/courses/course-studio.test.tsx](../apps/web/src/features/courses/course-studio.test.tsx).
- Expected behavior / technical fix: Complete learner intent/diagnostic/solo/private-debrief integration in later engineering missions; replace master certification with actual A-E journeys.
- Required tests: Real identity/API/worker/Python/browser journeys assert persistence, failure cases, privacy and authorized inference.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: L.

### F15 — M03; ED-26

- Priority / severity: **P0 BLOCKER**, External governance.
- Unmet acceptance/current behavior: All H1-5/T1-5/A1-5/X1-4 pending; zero dated owner decisions; five confirmations absent.
- Root cause / defective component: Engineering parity conflated with human sign-off; provisional hashes do not freeze candidate.
- Existing implementation: [docs/contracts/ednova-v1-approvals.md](../docs/contracts/ednova-v1-approvals.md); [docs/contracts/ednova-v1.md](../docs/contracts/ednova-v1.md).
- Expected behavior / technical fix: Collect genuine owner decisions, resolve conditions/contradictions, rerun parity/hash checks and freeze reviewed set.
- Required tests: 19 authorized decisions, five linked confirmations, final owner-reviewed hash record; never invented signatures.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F16 — M01/M21/M22; ED-01/13/14

- Priority / severity: **P0 BLOCKER**, High release validation.
- Unmet acceptance/current behavior: Lint exits 1; Unmodified-environment Jest 13/732 fail (initial forced-AI-URL run 15/732); integration 4/227 failed nodes (two leaf failures); CI misses new-domain full gates.
- Root cause / defective component: Stale mocks/status expectations and real integration drift; root test short-circuits; generated adapter drift unchecked.
- Existing implementation: [apps/api/modules/study/src/models/StudentAttempt.ts](../apps/api/modules/study/src/models/StudentAttempt.ts); [.github/workflows/ci.yml](../.github/workflows/ci.yml); [apps/api/package.json](../apps/api/package.json).
- Expected behavior / technical fix: Fix root causes/fixtures without weakening ACL; add generator drift/full domain browser/Python/transport/migration jobs.
- Required tests: Root lint/test plus security/browser/Python/contract/migration gates green; skips explicit.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: YES. Blocks full roadmap: YES. Complexity: M.

### F17 — M23; ED-15

- Priority / severity: **P1 MAJOR**, Operational, unverified.
- Unmet acceptance/current behavior: Target invitation-index migration state unknown; standalone Mongo; no current image/restore/failover certification.
- Root cause / defective component: Synthetic migration success and historical runtime logs do not verify deployed state; runbook conflicts with current tools/config.
- Existing implementation: [docs/deployment.md](../docs/deployment.md); [docker-compose.ai.yml](../docker-compose.ai.yml); [apps/api/scripts/migrate-institution-indexes.ts](../apps/api/scripts/migrate-institution-indexes.ts).
- Expected behavior / technical fix: Correct runbooks; review approved target index/migration inventory; build current images; cold boot broker/workers/files/vector; isolated backup/restore and rollback drill.
- Required tests: Approved migration dry-run/apply/repeat; restored synthetic records/indexes/files; exact-source readiness and rollback evidence.
- Dependency: see ordered groups above; F11 requires actual approved provider details plus explicit cost authorization and bound; F15 requires actual owners.
- Blocks P0: F08 core receipt policy; F17 production gate. Blocks full roadmap: YES. Complexity: L.

## Advanced roadmap tasks and release scope

All are deferred from canonical P0 (ED-25 index/detail priority remains contradictory). They still block full M00–M38 completeness. Each requires production implementation plus the stated acceptance; documentation or schemas alone are insufficient.

| Mission/story | Missing backend/frontend/AI/persistence | Dependency and rough complexity | Acceptance tests |
|---|---|---|---|
| M24 / ED-16 | Language/RTL primary controls and EN/FR/AR/Darija quality evidence | Accepted tutor/renderer; M | Human source/formula fidelity, code-switch, keyboard/mobile/reduced motion |
| M25 / ED-17 | LiveKit SDKs, scoped expiring consent token, audio UI | Approved media/consent, stable rooms; L | Three real devices, mic denial/mute/rejoin/AI outage, no persistent voice |
| M26 / ED-18 | Private tutor request/history/recipient delivery and side panel | Privacy/current grants; M | Peer/instructor denied across HTTP/events/cache/reconnect |
| M27 / ED-19 | Course aggregate API/UI and approved suppression threshold | Owner policy; M | Foreign instructor denied; identifying cohorts suppressed; no private files/answers |
| M28 / ED-33 | Accepted-evidence bridge to ledger/profile/capped XP/achievements | Correct evidence and policy; L | Logical completion duplicate/new transport IDs, crash after ledger claim, one recoverable award |
| M29 / ED-34 | Award reason/level/badge and persistent seen state | M28; M | Solo/group award once; refresh no duplicate; XP distinct from mastery |
| M30 / ED-31/32 P1 | Rich language/difficulty/hint/source settings and effective generation | Grounded Studio; M | Settings affect valid proposal without provenance loss or reviewed overwrite |
| M31 / ED-35 | Reviewed deterministic educational visualizer/schema and room reuse | Contract/renderer; M | Bounded inputs/back/next/reset/accessibility; no automatic mastery |
| M32 / ED-07 P1 | Authorized PDF viewer/page-follow protocol | Frozen source/presenter commands; M | Independent peers/reconnect converge on exact authorized page |
| M33 / ED-20 | Actual anonymous volunteer observations | Willing volunteers/consent; S | Actual counts and limitations; no causal mastery/traction claim |
| M34 / ED-21 | Labeled no-upload baseline/check/next-step flow | Accepted tutor/evidence; M | Fresh topic journey; no invented official provenance; ACL intact |
| M35 / ED-25 | LiveKit agent, speaker attribution, approved STT/TTS, moderator modes | M25, priority/privacy/providers; L | Dispatch, peer-first speech, measured <1500ms onset, peer audio survives mute/AI loss, zero persisted audio |
| M36 / ED-22 | Current runtime/dependency map and approved action plan | Source/runtime investigation; M | Reference and regression evidence before deletion; dependency graph preserved |
| M37 / ED-23 | Approved commercial/social scope and migration plan | Actual product approval; M decision/L changes | No silently removed contracted functionality or data |
| M38 / ED-24 | Pilot-backed governance/SSO/LMS/licensing/scale priorities | Real pilot and privacy approval; L | Approved requirements supported by actual pilot evidence |

The requirement matrix retains all UNKNOWN clauses: investigation is required before deciding implementation is absent.


Additional F10 provenance evidence: ingestion_worker.py _flatten_chunk_records emits no document ID and page_number=None. The actual tutor probe attributes a retrieved chunk with no document identity to doc_first_authorized and labels it verified. Preserve original document/page identity end to end; missing identity must fail or remain explicitly unknown. See ai-probes.json.

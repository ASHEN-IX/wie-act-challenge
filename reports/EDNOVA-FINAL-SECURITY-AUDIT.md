# EdNova final security audit — 23 October 2026

**Security acceptance FAIL.** Focused audit, not exhaustive vulnerability certification. No paid inference, real-user records, secrets in report text or target migrations. The audit uses real session identities and synthetic isolated Mongo data. Activity-service defects are latent behind the current HTTP 404 dispatcher defect; their severity must be addressed before exposing the path.

## Authorization matrix and negative tests

| Actor/action | Observation | Boundary and implication |
|---|---|---|
| Anonymous activity read | HTTP 401 | Real Nest SessionGuard works |
| Authorized instructor activity register/read/submit/result | HTTP 404 | Real Nest integration F00; tests that mount Express conceal it |
| Instructor A writes course B definition using outer A | Persisted B record | Direct-service latent authorization defect F02 |
| Learner submits wrong nonempty guided answer | Grade 1/mastery/REAL_APPROVED evidence | Direct-service data integrity F01 |
| Learner forges content hash/activityRevision | Graded evidence accepted | Direct-service full pin defect F06 |
| Other learner reads distinct owner's private result | 403 | Direct-service recipient check holds in this case |
| Second learner uses same legal attemptId | Own result 403 | Actor lookup defect, no cross-user disclosure demonstrated |
| Revoked enrollment gets own protected result | Service returns result | Policy/current-source issue F08; own historical evidence retention requires owner decision |
| Revoked institution membership requests published context | HTTP 200 | Reachable current-grant failure F07 |
| Metadata admin without assignment canManageCourse | True | Content-authority policy conflict F09 |
| Foreign institution/personal source access | Enrollment browser denials pass | Bounded positive isolation, not all grants |
| Concurrent identical submission | Mix 200/500; one stored evidence | F05 recovery/race failure, direct service |
| Explicit missing revision | Active revision silently returned | F03 source pin integrity |
| Source replaced for unchanged published revision | Old authorizedDocumentIds change | F04 immutable manifest violation |
| Synthetic invalid provider keys | REAL_APPROVED status | F11; no actual network request |
| Fabricated page 99999 with only page 1 retrieved | Citation verifies | F10; actual verifier, no provider |
| Removed source-owner grant in peer-text browser | B denied send/history/delivery; A continues | Actual multi-context baseline revocation PASS; institutional F07 is separate |

## Findings, root causes and fixes

### F00 — High functional

**P0 BLOCKER**, M10/M13/M15/M17; ED-27/29/31. Authenticated Nest activity register/read/submit/result return 404; anonymous read returns 401. Root cause: activities.ts exports Express Router; loadDefinitions consumes contract.operations; handwritten Nest methods have no operations. Fix: Use canonical createContracts, register routes and regenerate adapters; fix latent service defects before exposure. Required regression: Real Nest cookie-session activity registration/loading/submission/result succeeds, negative cases deny, generator has no drift.

Source: [apps/api/modules/study/src/routes/activities.ts](../apps/api/modules/study/src/routes/activities.ts), [apps/api/src/domain-definitions.ts](../apps/api/src/domain-definitions.ts), [apps/api/src/framework/domain.service.ts](../apps/api/src/framework/domain.service.ts).

### F01 — High data integrity, latent service defect

**P0 BLOCKER**, M12/M18; ED-08/29. One incorrect step saying 2+2=999 earns score 1 and persisted masteryAchieved=true, executionMode=REAL_APPROVED. Root cause: GuidedProblem counts nonempty answers divided by submitted steps; ignores required steps and correctness; evidence mode hardcoded. Fix: Use trusted step definitions and rubric/evaluator; only verified correct evidence may carry mastery; report actual execution provenance. Required regression: Wrong/nonempty/missing/duplicate/foreign steps earn no mastery; unavailable evaluation stays pending; synthetic evaluation never claims approved inference.

Source: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).

### F02 — High authorization, latent service defect

**P0 BLOCKER**, M02/M10/M21; ED-02/29. Manager of course A supplies outer courseId A and definition/evaluation for B; service inserts activity in B. Root cause: Authorization uses outer ID but upsert uses definition courseId; full pin and immutable lifecycle not bound. Fix: Bind path/outer/definition/evaluation/full pin to same authorized course; disallow silent published definition regrading. Required regression: Instructor A cannot write/overwrite B; wrong contentHash/activityRevision rejected; published activities immutable.

Source: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).

### F03 — High source integrity

**P0 BLOCKER**, M08/M09; ED-05/10. Request for explicit rev_does_not_exist returns rev_a. Root cause: Failed exact lookup falls through to latest published revision in both context and source resolver. Fix: Fail closed for explicit missing or revoked revision; preserve original valid deprecated pins. Required regression: Unknown revision returns explicit failure; new publication does not redirect an ongoing pinned attempt.

Source: [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts).

### F04 — High source integrity

**P0 BLOCKER**, M05/M08; ED-05/06/30. Replacing Course.files changes authorizedDocumentIds while rev_a stays unchanged. Root cause: Published manifests derive from mutable Course.files; revision lacks frozen source inventory; index readiness unchecked. Fix: Freeze document IDs/checksums/locations/index metadata per revision and activate only after exact index readiness. Required regression: Replacement/failure cannot alter old manifest; FAISS metadata/documents/hash match exact revision before publication.

Source: [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts), [apps/api/modules/study/src/models/CourseRevision.ts](../apps/api/modules/study/src/models/CourseRevision.ts).

### F05 — High reliability, latent service defect

**P0 BLOCKER**, M10/M12; ED-29. Eight identical concurrent direct-service requests return a mix of 200 and 500; one attempt/evidence persists. Root cause: Read-before-create, evidence inserted before attempt, duplicate-key races unreconciled; partial-write recovery missing. Fix: Claim durable actor/attempt receipt before evaluation; reconcile duplicate claims and recover evidence/result application. Required regression: All identical concurrent/restarted retries return same receipt; conflict 409; crash after evidence insertion recovers without stuck/lost result.

Source: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).

### F06 — High evidence integrity, latent service defect

**P0 BLOCKER**, M10/M12; ED-29. Forged sha256:ffff... hash and rev_forged activity revision receive grade 1 and evidence. Root cause: Only course revision tag checked; canonical relational validateSubmission is not used. Fix: Validate full source/activity pin, allowed options/steps and URL identity against stored authoritative definition. Required regression: Tampered hash/type/activityRevision/step/option rejected before receipt/evidence write.

Source: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).

### F07 — High authorization, reachable HTTP

**P0 BLOCKER**, M02/M04/M21; ED-02/04/13. Actual cookie-session published-context returns HTTP 200 after institution membership revoked while enrollment active. Root cause: canReadCourse accepts owner/assignment/enrollment without current active institution membership/status. Fix: Conjoin current institution/membership/role/enrollment; recheck at download/room/AI/cache/WS delivery. Required regression: Suspend/revoke student/instructor/institution; all future protected requests/results/streams deny; personal owner data remains separately scoped.

Source: [apps/api/modules/study/src/services/resourceAccess.ts](../apps/api/modules/study/src/services/resourceAccess.ts).

### F08 — Medium policy and receipt recovery, latent service defect

**P1 MAJOR**, M10/M21; ED-02/29. Second actor sharing a legal attemptId gets 403 for own receipt; enrollment-revoked actor still gets own protected assessment. Root cause: getAttemptResult queries attemptId without userId then compares actor; current source grant not rechecked. Fix: Query actor+attempt+expected activity; resolve owner policy for retaining own historic evidence while protecting source excerpts. Required regression: Both actors retrieve own same-ID record; revoked access follows explicit contract; no peer disclosure.

Source: [apps/api/modules/study/src/services/activityAttempt.ts](../apps/api/modules/study/src/services/activityAttempt.ts).

### F09 — High authority policy

**P0 BLOCKER**, M04/M08; ED-04/05. canManageCourse returns true for institution metadata admin without instructor assignment; publication consumes it. Root cause: One broad predicate conflates institution administration with content author/reviewer authority. Fix: Separate membership/enrollment administration from instructor review/publication grants; resolve contradictory workflow wording. Required regression: Unassigned metadata admin cannot publish or read private learner content; explicit operational setup stays scoped.

Source: [apps/api/modules/study/src/services/resourceAccess.ts](../apps/api/modules/study/src/services/resourceAccess.ts), [apps/api/modules/study/src/services/coursePublication.ts](../apps/api/modules/study/src/services/coursePublication.ts).

### F10 — High functional and grounding

**P0 BLOCKER**, M09; ED-10. Tutor raises unexpected keyword tier and always falls back; fabricated page 99999 validates against retrieved page 1. Root cause: Call disagrees with ask signature; citation checks only document ID; Node warns on malformed context and returns untrusted result without post-inference reauthorization. Fix: Correct client signature; validate full pin/document/page/excerpt; fail closed; strip service-only fields; reauthorize before delivery. Required regression: Real local Python HTTP boundary verifies schema/citations/pins; delayed revoked recipient denied; separately authorized inference proves real provider.

Source: [apps/ai/agents/tutor/grounding.py](../apps/ai/agents/tutor/grounding.py), [apps/api/modules/study/src/services/tutorGrounding.ts](../apps/api/modules/study/src/services/tutorGrounding.ts).

### F11 — High truthfulness and governance

**P0 BLOCKER**, M06; ED-03. Synthetic invalid provider keys report REAL_APPROVED without any network call. Root cause: Provider status treats key presence as approved real execution; no organizer approval provenance gate. Fix: Separate configured/reachable/tested/approved states and tie result provenance to actual bounded approved call. Required regression: Absent/invalid keys/mock/template never claim approved real inference; actual authorized compact/capable calls have redacted provenance.

Source: [apps/ai/utils/llm_client.py](../apps/ai/utils/llm_client.py), [apps/api/tests/integration/m06-ai-provider-mode.node.test.ts](../apps/api/tests/integration/m06-ai-provider-mode.node.test.ts).

### F12 — High source and educational integrity

**P0 BLOCKER**, M14/M15; ED-32. Node template invents doc_<draftHash>, extracted page 1/locationKnown=true; opt_1 visibly says Correct principle. Root cause: Generator never reads original source/page or invokes Python/model; objective wording becomes fixed answer template. Fix: Generate proposals from verified extracted passages and truthful doc/page/hash; flag template fallback; retain human review. Required regression: Source-free objective cannot claim extracted page; actual source-backed proposal and answer correctness independently reviewed.

Source: [apps/api/modules/study/src/services/courseStudio.ts](../apps/api/modules/study/src/services/courseStudio.ts).

### F13 — High integration

**P0 BLOCKER**, M17; ED-07/29. Command-aware activity selection reads learning_activities while ActivityRecord writes activity_records. Root cause: Durable command bypasses canonical model and full pin; legacy no-command code uses a different repository. Fix: Use one canonical full-pin activity resolver and real presenter selection UI. Required regression: Real presenter selects registered quiz/problem; peers converge; replay/reconnect preserves pins/private submissions.

Source: [apps/api/modules/study/src/services/roomCommands.ts](../apps/api/modules/study/src/services/roomCommands.ts), [apps/api/modules/study/src/models/ActivityRecord.ts](../apps/api/modules/study/src/models/ActivityRecord.ts), [apps/web/src/features/collaboration/room-view.tsx](../apps/web/src/features/collaboration/room-view.tsx).

## Remaining verification limits

The real integration run exercises existing static-file/internal module dispatch/private-job/callback/cache/room/presenter/peer-text/session checks, but two room leaves fail. Python SSRF, injection, parser/schema and worker suites pass in the guarded run. Upload Jest tests partly fail because new model mocks were not added; that does not prove an upload vulnerability or establish all parser security. Renderer source and units use escaped React text with no eval/generated executable JSX.

Native Server Actions and Better Auth origin/session protections exist; a comprehensive hostile-origin CSRF matrix for every new API was not executed. Session identity is not object authorization. Production secure cookies/TLS, rate-limit deployment, SSRF DNS rebinding, parser exhaustion, oversized Unicode on every new path, all WebSocket replay/presenter paths and defined retention/deletion policy remain incompletely verified. UNKNOWN is neither a vulnerability finding nor a PASS.

Node tutor validation only warns and returns a service-only GroundingContext; no delivery-time source reauthorization follows inference. This is code-confirmed but no real private learner records were collected. No global-platform-admin private-result bypass was demonstrated. Institutional metadata-admin publication contradicts roles-and-permissions, while workflow wording allows admin; resolve the policy explicitly, do not infer approval.

Reproduce the synthetic harness with the exact command in the test report; retain boundary=DIRECT_SERVICE labels. Real HTTP routing results and latest service probe results are saved separately. Full prioritized fixes, owner dependencies and complexity are in EDNOVA-REMAINING-WORK.md.


Additional F10 provenance evidence: ingestion_worker.py _flatten_chunk_records emits no document ID and page_number=None. The actual tutor probe attributes a retrieved chunk with no document identity to doc_first_authorized and labels it verified. Preserve original document/page identity end to end; missing identity must fail or remain explicitly unknown. See ai-probes.json.

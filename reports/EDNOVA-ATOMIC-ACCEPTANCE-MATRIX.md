# EdNova atomic acceptance matrix — working draft, 27 October 2026

**INCOMPLETE overall audit.** The 36 canonical acceptance fields now have 235 maintained normative assertions, with original quotes preserved and all F/T/M/contract view IDs resolved. These supersede the initial C-numbered sentence segments. Independent product/testing/mission/security/operational strengthening still needs semantic reconciliation and deduplication; source-view coverage alone is not the full atomic-audit exit gate. Do not infer child verification from a parent task status.

Current task assessments and evidence below are inherited from the [existing task registry](FULL-TASK-IMPLEMENTATION-MATRIX.md); they are pointers for revalidation, not new independent findings. Source is a dirty working tree at HEAD `5fb70a095da8f8cf429aed2e4f4bf72ce096e927`. Criterion statuses are provisional unless supported by an explicitly scoped certification record. Dated run evidence never automatically certifies later changed source. External approval-dependent requirements remain blocked.

Current final-mission criterion classifications and scoped evidence are recorded in [EDNOVA-FINAL-CRITERION-RESULTS.json](EDNOVA-FINAL-CRITERION-RESULTS.json). Parent-inherited statuses below remain conservative historical defaults; they are not automatic certification. The final mission remains in progress.

## ED-01 — Repair and revalidate baseline

- Source: [canonical acceptance](../docs/sprint-backlog.md:75); related feature text: All retained foundations. Repair and revalidate baseline.
- Dependencies: None.
- Existing implementation pointers: `apps/api/shared/betterAuth.ts; deploy/compose.development.yml; deploy/compose.test.yml`
- Prior evidence pointer: Root lint/typecheck/test/build and isolated auth/A–E browser pass; dev/test stacks start; dev broker roundtrip passes
- Missing work: Complete image, fresh lock install, remote CI and operational checks
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Run documented full checks, compare route/auth behavior; record versions, exits and skips.
- Related source views (aliases, not independent feature counts): [F19](../docs/product-specification.md:194), [T01](../docs/testing-plan.md:19), [T23](../docs/testing-plan.md:41), [M01](../EdNova_Complete_Codex_Mission_Roadmap.md:217)

<!-- atomic-data:start -->
Original acceptance ([source line 75](../docs/sprint-backlog.md:75)): API/web production builds, lint/typecheck and required unit/integration/auth/browser suites pass; skips and Python install policy explicit.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-01-A001 | API production build passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/build-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A002 | Web production build passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/build-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A003 | API lint passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/lint-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A004 | Web lint passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/lint-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A005 | API strict typecheck passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/typecheck-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A006 | Web typecheck passes. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/typecheck-final-source.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A007 | Required API unit suites pass. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/node-current.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A008 | Required API integration suites pass. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/node-current.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A009 | Required authentication suites pass. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/node-current.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A010 | Required web unit suites pass. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated check, full criterion certification pending | [Executed local check](evidence/ednova-execution-20261027/node-current.log); real-service/fixture limits in EDNOVA-TEST-COVERAGE.md. This does not certify full product acceptance. |
| ED-01-A011 | Required browser suites pass. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-01-A012 | Existing skips are documented explicitly. | IMPLEMENTED_UNVERIFIED | MEDIUM; dated skip inventory | [Five named Python fixture skips](EDNOVA-TEST-COVERAGE.md); current Node integration has zero skips. |
| ED-01-A013 | The Python installation policy is explicit. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-02 — Close resource and transport isolation gaps

- Source: [canonical acceptance](../docs/sprint-backlog.md:97); related feature text: F01, F04, F09, F19. Close resource and transport isolation gaps.
- Dependencies: ED-01.
- Existing implementation pointers: `apps/api/modules/study/src/services/resourceAccess.ts; apps/api/modules/notification/src/realtime.ts`
- Prior evidence pointer: R1 security and real browser revocation/outsider checks pass; complete all-channel matrix not established
- Missing work: Complete all-channel and multi-instance revocation checks, including voice
- Priority: P0; prior task confidence: MEDIUM; prior task status: IMPLEMENTED_UNVERIFIED
- Final validation specified by backlog: API negative access matrix plus two-browser revocation, guessed IDs and alternate download paths.
- Related source views (aliases, not independent feature counts): [F01](../docs/product-specification.md:32), [F04](../docs/product-specification.md:59), [F09](../docs/product-specification.md:104), [F19](../docs/product-specification.md:194), [T04](../docs/testing-plan.md:22), [T19](../docs/testing-plan.md:37), [M02](../EdNova_Complete_Codex_Mission_Roadmap.md:233)

<!-- atomic-data:start -->
Original acceptance ([source line 97](../docs/sprint-backlog.md:97)): Cross-user course summaries/files/chat/voice denied before lookup/inference; revoked users receive no further scoped data; existing legitimate team flow works.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-02-A001 | A foreign user cannot retrieve a course summary before authorization. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A002 | A foreign user cannot retrieve a course file before authorization. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A003 | A foreign user cannot retrieve scoped chat before authorization. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A004 | A foreign user cannot access scoped voice before authorization. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A005 | Unauthorized source access cannot trigger inference. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A006 | Revoked users receive no further scoped data. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-02-A007 | The legitimate team flow remains functional. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-03 — Confirm and connect organizer inference service

- Source: [canonical acceptance](../docs/sprint-backlog.md:117); related feature text: F17. Confirm and connect organizer inference service.
- Dependencies: Organizer access details; ED-01.
- Existing implementation pointers: `apps/ai/utils/llm_client.py:78`
- Prior evidence pointer: Approval gate in code; no approved live calls performed
- Missing work: Organizer provider, model, budget and compact/capable real-call traces
- Priority: P0; prior task confidence: HIGH; prior task status: BLOCKED
- Final validation specified by backlog: Controlled synthetic requests, category/provider trace and organizer rule review; no real learner records.
- Related source views (aliases, not independent feature counts): [F17](../docs/product-specification.md:176), [T14](../docs/testing-plan.md:32), [M06](../EdNova_Complete_Codex_Mission_Roadmap.md:297)

<!-- atomic-data:start -->
Original acceptance ([source line 117](../docs/sprint-backlog.md:117)): One compact and one capable real call through approved service have redacted provenance; no silent mock success; known limits documented.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-03-A001 | One compact-model call executes through the approved service. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-03-A002 | One capable-model call executes through the approved service. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-03-A003 | The compact call has redacted execution provenance. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-03-A004 | The capable call has redacted execution provenance. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-03-A005 | Mock output cannot silently substitute for a real call. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-03-A006 | Known provider limits are documented. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-04 — Minimal institutional membership and access contexts

- Source: [canonical acceptance](../docs/sprint-backlog.md:135); related feature text: F01–F02. Minimal institutional membership and access contexts.
- Dependencies: ED-01, ED-02, and ED-26/Contract 03 for enrollment/source grants.
- Existing implementation pointers: `apps/api/modules/study/src/services/institutions.ts; apps/api/modules/study/src/services/enrollments.ts`
- Prior evidence pointer: Current root institutional integration and browser membership/enrollment/revocation checks pass
- Missing work: Complete all-institution acceptance and resolve ED-26 semantics
- Priority: P0; prior task confidence: MEDIUM; prior task status: IMPLEMENTED_UNVERIFIED
- Final validation specified by backlog: Real NestJS/MongoDB membership matrix, multiple pending invitations, same-actor retry recovery, expiry/revocation, concurrent acceptance/suspension and browser acceptance with two users/two synthetic institutions pass in M04-A.1. Course enrollment remains absent.
- Related source views (aliases, not independent feature counts): [F01](../docs/product-specification.md:32), [F02](../docs/product-specification.md:41), [F21](../docs/product-specification.md:217), [T01](../docs/testing-plan.md:19), [T02](../docs/testing-plan.md:20), [M04](../EdNova_Complete_Codex_Mission_Roadmap.md:265), [Contract 03](../docs/contracts/technical-contracts.md:133)

<!-- atomic-data:start -->
Original acceptance ([source line 135](../docs/sprint-backlog.md:135)): Membership and invitation isolation, role-escalation denial and revocation pass. Two institution scopes plus personal mode are isolated for membership context. Course enrollment and course-invite acceptance remain absent, so full ED-04 acceptance is unmet. **27 October clarification:** the preceding absence statement is historical. Provisional enrollment/invitation services and authenticated UI now exist and are locally tested; full acceptance still requires complete scope/revocation evidence and genuine ED-26 source-grant decisions. No owner approval is inferred.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-04-A001 | Institution membership is isolated by institution. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A002 | Institution invitations are isolated by institution. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A003 | Client role escalation is denied. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A004 | Membership revocation is enforced. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A005 | Two institution scopes remain isolated for membership context. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A006 | Personal context remains independent from institution membership. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A007 | Course enrollment is server-authoritative and scope-isolated. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-04-A008 | Course invitation acceptance follows the approved source-grant semantics. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-05 — Instructor versioned draft/review/publication flow

- Source: [canonical acceptance](../docs/sprint-backlog.md:154); related feature text: F02–F03. Instructor versioned draft/review/publication flow.
- Dependencies: ED-04, ED-06, ED-26, ED-30.
- Existing implementation pointers: `apps/api/modules/study/src/services/coursePublication.ts; apps/web/src/features/courses/course-studio.tsx`
- Prior evidence pointer: Synthetic text and PDF browser upload, review and publication pass
- Missing work: Certify containerized end-to-end workflow and operational recovery
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Browser upload/preview/publish/join test and cross-instructor denial.
- Related source views (aliases, not independent feature counts): [F02](../docs/product-specification.md:41), [F03](../docs/product-specification.md:50), [F21](../docs/product-specification.md:217), [T02](../docs/testing-plan.md:20), [T03](../docs/testing-plan.md:21), [T29](../docs/testing-plan.md:72), [M08](../EdNova_Complete_Codex_Mission_Roadmap.md:329), [Contract 03](../docs/contracts/technical-contracts.md:133)

<!-- atomic-data:start -->
Original acceptance ([source line 154](../docs/sprint-backlog.md:154)): Assigned instructor publishes own course; enrolled learner sees approved source; failed replacement leaves published version intact.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-05-A001 | An assigned instructor can publish their own course. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-05-A002 | An enrolled learner reads approved source material. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-05-A003 | A failed replacement leaves the published revision intact. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-06 — Unify scoped material ingestion and provenance

- Source: [canonical acceptance](../docs/sprint-backlog.md:172); related feature text: F03–F04, F06, F11. Unify scoped material ingestion and provenance.
- Dependencies: ED-02, ED-04 for institutional scope.
- Existing implementation pointers: `docker-compose.yml; scripts/setup.mjs; apps/ai/workers/ingestion_worker.py; revisionSources.ts`
- Prior evidence pointer: Real PDF browser/broker flow and isolated image shared-artifact verification pass
- Missing work: Verify containerized broker-worker flow, OCR, recovery and restore
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Upload type/size/parser failure, retrieval/download ACL tests, index/source parity and retry progress.
- Related source views (aliases, not independent feature counts): [F03](../docs/product-specification.md:50), [F04](../docs/product-specification.md:59), [F06](../docs/product-specification.md:77), [F11](../docs/product-specification.md:122), [F21](../docs/product-specification.md:217), [T03](../docs/testing-plan.md:21), [T04](../docs/testing-plan.md:22), [T05](../docs/testing-plan.md:23), [T28](../docs/testing-plan.md:71), [M05](../EdNova_Complete_Codex_Mission_Roadmap.md:281), [Contract 01](../docs/contracts/technical-contracts.md:40), [Contract 02](../docs/contracts/technical-contracts.md:77), [Contract 03](../docs/contracts/technical-contracts.md:133)

<!-- atomic-data:start -->
Original acceptance ([source line 172](../docs/sprint-backlog.md:172)): Personal private by default; authorized official and explicitly shared material resolves consistently; no stale/private cached source escapes.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-06-A001 | Personal material is private by default. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-06-A002 | Authorized official material resolves consistently. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-06-A003 | Explicitly shared material resolves consistently within its authorized scope. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-06-A004 | Stale cached source content cannot escape its approved revision scope. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-06-A005 | Private cached source content cannot escape its access scope. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-07 — Reuse team sessions for synchronized learning rooms

- Source: [canonical acceptance](../docs/sprint-backlog.md:198); related feature text: F09, F11. Reuse team sessions for synchronized learning rooms.
- Dependencies: ED-02, ED-06, ED-26, ED-27, ED-29.
- Existing implementation pointers: `apps/api/modules/study/src/services/roomCommands.ts; apps/api/modules/notification/src/realtime.ts:56`
- Prior evidence pointer: Two-browser activity, private results and reconnect pass; realtime is process-local
- Missing work: Rerun multi-browser and revocation/replay; test 2–4 users and distributed delivery for scale
- Priority: P0; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Multi-browser integration, sequencing/idempotency, lost-network reconnect and unauthorized join tests.
- Related source views (aliases, not independent feature counts): [F09](../docs/product-specification.md:104), [F11](../docs/product-specification.md:122), [F20](../docs/product-specification.md:209), [T10](../docs/testing-plan.md:28), [T32](../docs/testing-plan.md:75), [M16](../EdNova_Complete_Codex_Mission_Roadmap.md:457), [M17](../EdNova_Complete_Codex_Mission_Roadmap.md:473), [M32](../EdNova_Complete_Codex_Mission_Roadmap.md:713), [Contract 10](../docs/contracts/technical-contracts.md:353), [Contract 13](../docs/contracts/technical-contracts.md:470), [Contract 16](../docs/contracts/technical-contracts.md:632)

<!-- atomic-data:start -->
Original acceptance ([source line 198](../docs/sprint-backlog.md:198)): 2–4 browsers agree on public messages/presence/activity/problem; presenter alone changes shared view; duplicate/reconnect loses no accepted work; no private attempt/answer key leaks. Full page-following checked only in P1.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-07-A001 | Two to four authenticated browsers agree on public messages. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A002 | Two to four authenticated browsers agree on presence. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A003 | Two to four authenticated browsers agree on the active activity. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A004 | Two to four authenticated browsers agree on shared problem state. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A005 | Only the presenter changes the shared view. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A006 | Duplicate commands lose no accepted work. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A007 | Reconnect loses no accepted work. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A008 | Private attempts never leak through room projections. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A009 | Answer keys never leak through room projections. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-07-A010 | Full PDF page-following is validated separately in P1. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-08 — Diagnostic and individual guided practice

- Source: [canonical acceptance](../docs/sprint-backlog.md:216); related feature text: F06–F07, F18. Diagnostic and individual guided practice.
- Dependencies: ED-03, ED-06, ED-10, ED-28.
- Existing implementation pointers: `apps/api/modules/study/src/services/learningJourney.ts; apps/web/src/features/learning/learning-workspace.tsx`
- Prior evidence pointer: Web renderer tests pass; diagnostic states explicitly nonadaptive
- Missing work: Evidence-grounded level policy, graduated hints, beginner/advanced scenarios and provider gate
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Fixed source-backed question/answer cases and browser diagnostic-to-feedback flow.
- Related source views (aliases, not independent feature counts): [F06](../docs/product-specification.md:77), [F07](../docs/product-specification.md:86), [F18](../docs/product-specification.md:185), [T08](../docs/testing-plan.md:26), [T09](../docs/testing-plan.md:27), [M12](../EdNova_Complete_Codex_Mission_Roadmap.md:393), [Contract 06](../docs/contracts/technical-contracts.md:238), [Contract 08](../docs/contracts/technical-contracts.md:302)

<!-- atomic-data:start -->
Original acceptance ([source line 216](../docs/sprint-backlog.md:216)): Beginner/advanced synthetic responses adapt tasks; hint precedes answer, full explanation on request; no unsupported mastery labels.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-08-A001 | Beginner synthetic responses lead to suitable provisional tasks. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-08-A002 | Advanced synthetic responses lead to suitable provisional tasks. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-08-A003 | A hint precedes the full answer. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-08-A004 | A full explanation is available on explicit request. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-08-A005 | No unsupported mastery label is assigned. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-09 — Explicit peer-first facilitator policy

- Source: [canonical acceptance](../docs/sprint-backlog.md:236); related feature text: F12, F14. Explicit peer-first facilitator policy.
- Dependencies: ED-07, ED-08, ED-10, ED-12.
- Existing implementation pointers: `apps/api/modules/study/src/services/roomLearning.ts; apps/ai/agents/facilitator/`
- Prior evidence pointer: Deterministic peer invitation exists; no current three-learner real-model test
- Missing work: Validated misconception intervention, decline/disagreement and bounded real inference
- Priority: P0; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Scripted three-learner scenario, invalid transition/output rejection, participation decline and disagreement cases.
- Related source views (aliases, not independent feature counts): [F12](../docs/product-specification.md:131), [F14](../docs/product-specification.md:149), [T09](../docs/testing-plan.md:27), [T11](../docs/testing-plan.md:29), [T12](../docs/testing-plan.md:30), [M19](../EdNova_Complete_Codex_Mission_Roadmap.md:505), [Contract 14](../docs/contracts/technical-contracts.md:565), [Contract 15](../docs/contracts/technical-contracts.md:592), [Contract 16](../docs/contracts/technical-contracts.md:632)

<!-- atomic-data:start -->
Original acceptance ([source line 236](../docs/sprint-backlog.md:236)): Peers reason before full answer; known misconception receives supported intervention; quiet learner may decline; group context bounded.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-09-A001 | Peers are invited to reason before a full answer is revealed. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-09-A002 | A known misconception receives a supported intervention. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-09-A003 | A quiet learner may decline an invitation. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-09-A004 | Group context supplied to facilitation is bounded. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-10 — Course-grounded tutor and verification

- Source: [canonical acceptance](../docs/sprint-backlog.md:254); related feature text: F06, F14. Course-grounded tutor and verification.
- Dependencies: ED-03, ED-06.
- Existing implementation pointers: `apps/ai/agents/tutor/grounding.py; apps/api/modules/study/src/services/tutorGrounding.ts`
- Prior evidence pointer: Current offline real Nest/Python grounded tutor and source citation browser checks pass; container path unverified
- Missing work: Repair source path, rerun grounding negatives and approved-model quality/citation tests
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Answer-key and citation/source-ID checks; adversarial document and insufficient-evidence cases.
- Related source views (aliases, not independent feature counts): [F06](../docs/product-specification.md:77), [F12](../docs/product-specification.md:131), [F14](../docs/product-specification.md:149), [F20](../docs/product-specification.md:209), [T06](../docs/testing-plan.md:24), [T07](../docs/testing-plan.md:25), [T11](../docs/testing-plan.md:29), [M09](../EdNova_Complete_Codex_Mission_Roadmap.md:345)

<!-- atomic-data:start -->
Original acceptance ([source line 254](../docs/sprint-backlog.md:254)): Known question cites correct allowed passage; unsupported correction is tentative/pending; no source-access decision is delegated to model.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-10-A001 | A known question cites the correct allowed passage. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-10-A002 | Unsupported correction remains tentative or pending. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-10-A003 | Source access decisions are never delegated to the model. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-11 — Private checks, group debrief and next steps

- Source: [canonical acceptance](../docs/sprint-backlog.md:272); related feature text: F08, F15. Private checks, group debrief and next steps.
- Dependencies: ED-08, ED-09, ED-29.
- Existing implementation pointers: `apps/api/modules/study/src/services/roomLearning.ts; apps/web/src/features/collaboration/room-learning-panel.tsx`
- Prior evidence pointer: Current two-browser checks/debrief/privacy pass; three-browser gate not run
- Missing work: Verify individual next steps, private recovery and 3-user debrief without leakage
- Priority: P0; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Three-browser completion and per-recipient history tests; duplicate result/retry and evidence quality review.
- Related source views (aliases, not independent feature counts): [F08](../docs/product-specification.md:95), [F15](../docs/product-specification.md:158), [T13](../docs/testing-plan.md:31), [M20](../EdNova_Complete_Codex_Mission_Roadmap.md:521), [Contract 17](../docs/contracts/technical-contracts.md:652)

<!-- atomic-data:start -->
Original acceptance ([source line 272](../docs/sprint-backlog.md:272)): Group outcome and each learner next step reproducible; no private leakage or double rewards; untested differs from incorrect.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-11-A001 | The group outcome is reproducible. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-11-A002 | Each learner's private next step is reproducible. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-11-A003 | The debrief leaks no private information. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-11-A004 | Completion/replay cannot double-award rewards. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-11-A005 | Untested work is distinguished from incorrect work. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-12 — Capacity-aware routing and degraded operation

- Source: [canonical acceptance](../docs/sprint-backlog.md:290); related feature text: F17, F19. Capacity-aware routing and degraded operation.
- Dependencies: ED-03, ED-07, ED-10.
- Existing implementation pointers: `apps/ai/utils/llm_client.py:78; apps/ai/utils/llm_client.py:420`
- Prior evidence pointer: Mongo-backed durable shared request cap passes concurrency/restart tests; no approved real traffic
- Missing work: Monetary/token budget, revocation administration and controlled 429/timeout/capable outage with approved models
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Inject controlled failure, observe real compact/rule fallback, measure category calls/latency/retries; duplicate/restart cases.
- Related source views (aliases, not independent feature counts): [F12](../docs/product-specification.md:131), [F14](../docs/product-specification.md:149), [F17](../docs/product-specification.md:176), [F20](../docs/product-specification.md:209), [T14](../docs/testing-plan.md:32), [T15](../docs/testing-plan.md:33), [T16](../docs/testing-plan.md:34), [T17](../docs/testing-plan.md:35), [T23](../docs/testing-plan.md:41), [M18](../EdNova_Complete_Codex_Mission_Roadmap.md:489)

<!-- atomic-data:start -->
Original acceptance ([source line 290](../docs/sprint-backlog.md:290)): Real requests use intended categories; 429/timeout/capable loss preserves chat/materials and safe completion; unresolved reasoning never certified.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-12-A001 | Real requests use the intended model categories. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-12-A002 | Provider 429 preserves chat and materials. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-12-A003 | Provider timeout preserves chat and materials. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-12-A004 | Capable-model loss preserves chat and materials. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-12-A005 | Provider failures preserve safe completion semantics. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-12-A006 | Unresolved reasoning is never certified as verified. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-13 — Challenge-safe synthetic data and privacy policy

- Source: [canonical acceptance](../docs/sprint-backlog.md:308); related feature text: F01, F10, F19. Challenge-safe synthetic data and privacy policy.
- Dependencies: ED-02, ED-03, ED-04.
- Existing implementation pointers: `apps/api/modules/study/src/services/resourceAccess.ts; docs/security.md`
- Prior evidence pointer: Synthetic harness present; production privacy, retention and payload audit not rerun
- Missing work: Review logs/provider payload and retention, real deployments and no-audio recording guarantee
- Priority: P0; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Inspect redacted payloads/logs/cache/artifacts, access matrix and data provenance; no live production data manipulation.
- Related source views (aliases, not independent feature counts): [F01](../docs/product-specification.md:32), [F19](../docs/product-specification.md:194), [T19](../docs/testing-plan.md:37), [T24](../docs/testing-plan.md:42), [M21](../EdNova_Complete_Codex_Mission_Roadmap.md:537)

<!-- atomic-data:start -->
Original acceptance ([source line 308](../docs/sprint-backlog.md:308)): No credentials or real personal/private learner data reaches model/evidence; no stored voice; synthetic demo succeeds without requiring payment.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-13-A001 | Credentials never reach model or evidence payloads. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-13-A002 | Real personal learner data never reaches model or evidence payloads. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-13-A003 | Real private learner data never reaches model or evidence payloads. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-13-A004 | Voice is not persistently recorded. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-13-A005 | The synthetic demo does not require payment. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-14 — Execute end-to-end challenge evaluation

- Source: [canonical acceptance](../docs/sprint-backlog.md:326); related feature text: All P0 features. Execute end-to-end challenge evaluation.
- Dependencies: ED-01 through ED-13; ED-26 through ED-32 for P0.
- Existing implementation pointers: `apps/web/e2e/p0r3-integrated-learning.test.ts; docs/testing-plan.md`
- Prior evidence pointer: Offline real-service browser A–E passes; approved model service and deployment evidence missing
- Missing work: Re-run actual challenge end-to-end including approved compact/capable failure cases
- Priority: P0; prior task confidence: HIGH; prior task status: BLOCKED
- Final validation specified by backlog: Follow testing-plan.md; preserve reproducible commands, synthetic fixtures and redacted evidence.
- Related source views (aliases, not independent feature counts): [F19](../docs/product-specification.md:194), [T38](../docs/testing-plan.md:81), [M22](../EdNova_Complete_Codex_Mission_Roadmap.md:553)

<!-- atomic-data:start -->
Original acceptance ([source line 326](../docs/sprint-backlog.md:326)): P0 scenario gates pass with actual outcomes, sample size and failures recorded; mocks clearly distinguished from real inference.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-14-A001 | Every applicable P0 scenario gate passes. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-14-A002 | Actual scenario outcomes are recorded. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-14-A003 | Actual sample counts are recorded. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-14-A004 | Failures are recorded without omission. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-14-A005 | Mock inference is explicitly distinguished from real inference. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-15 — Prepare submission and business artifacts

- Source: [canonical acceptance](../docs/sprint-backlog.md:344); related feature text: Delivery. Prepare submission and business artifacts.
- Dependencies: ED-14; deadline/service/voice clarifications.
- Existing implementation pointers: `docs/hackathon-delivery.md; EdNova_Complete_Codex_Mission_Roadmap.md`
- Prior evidence pointer: No independent evidence of approved final video/pitch/report and current release gate
- Missing work: Obtain decisions; produce and review bounded submission artifacts after ED-14
- Priority: P0; prior task confidence: MEDIUM; prior task status: BLOCKED
- Final validation specified by backlog: Page count, media duration, pitch rehearsal, credential scan and external-reader setup run.
- Related source views (aliases, not independent feature counts): [T26](../docs/testing-plan.md:44), [T38](../docs/testing-plan.md:81), [M23](../EdNova_Complete_Codex_Mission_Roadmap.md:569)

<!-- atomic-data:start -->
Original acceptance ([source line 344](../docs/sprint-backlog.md:344)): Artifacts meet exact organizer limits, contain honest test/inference evidence and declarations, and clean-start setup is reproducible.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-15-A001 | Submission artifacts meet the exact organizer limits. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-15-A002 | Submission artifacts report honest test evidence. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-15-A003 | Submission artifacts report honest inference provenance. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-15-A004 | Required external-service declarations are present. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-15-A005 | Clean-start setup is reproducible. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-16 — Improve multilingual and accessible learning UX

- Source: [canonical acceptance](../docs/sprint-backlog.md:362); related feature text: F18. Improve multilingual and accessible learning UX.
- Dependencies: ED-08, ED-09, ED-14.
- Existing implementation pointers: `apps/web/src/features/learning/learning-workspace.tsx; docs/testing-plan.md`
- Prior evidence pointer: Renderer unit checks only; multilingual/RTL/a11y rubric not executed
- Missing work: English/French/Arabic/Darija, screen-reader, keyboard/mobile and human meaning review
- Priority: P1; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Fixed multilingual rubric plus human source review and keyboard/mobile browser checks.
- Related source views (aliases, not independent feature counts): [F18](../docs/product-specification.md:185), [T18](../docs/testing-plan.md:36), [M24](../EdNova_Complete_Codex_Mission_Roadmap.md:585)

<!-- atomic-data:start -->
Original acceptance ([source line 362](../docs/sprint-backlog.md:362)): Recorded cases preserve formulas/source meaning; keyboard flow works; unsupported languages/weak outputs disclosed.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-16-A001 | Recorded multilingual cases preserve formulas. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-16-A002 | Recorded multilingual cases preserve source meaning. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-16-A003 | The keyboard flow works. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-16-A004 | Unsupported languages are disclosed. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-16-A005 | Weak language outputs are disclosed. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-17 — LiveKit Cloud Media Plane & WebRTC Audio Integration

- Source: [canonical acceptance](../docs/sprint-backlog.md:381); related feature text: F10. LiveKit Cloud Media Plane & WebRTC Audio Integration.
- Dependencies: ED-02, ED-07, stable P0.
- Existing implementation pointers: `apps/api/modules/notification/src/routes/voice.ts; apps/web/src/features/collaboration/`
- Prior evidence pointer: Voice-related code exists; real LiveKit media/consent not demonstrated
- Missing work: Implement and test authorized consent-bound LiveKit token/media, reconnect
- Priority: P1; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Multi-browser real audio verification, token expiration tests, network switch/reconnect tests.
- Related source views (aliases, not independent feature counts): [F10](../docs/product-specification.md:113), [T22](../docs/testing-plan.md:40), [M25](../EdNova_Complete_Codex_Mission_Roadmap.md:601), [Contract 11](../docs/contracts/technical-contracts.md:416)

<!-- atomic-data:start -->
Original acceptance ([source line 381](../docs/sprint-backlog.md:381)): Multi-user audio streams connect reliably via LiveKit Cloud; NestJS enforces room authorization and voice consent before token issuance; media disconnection/reconnection works without dropping the room session; student-to-student audio functions independently of AI agent availability.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-17-A001 | Multiple users connect real audio reliably through LiveKit Cloud. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-17-A002 | Nest enforces room authorization before token issuance. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-17-A003 | Nest enforces voice consent before token issuance. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-17-A004 | Media disconnection does not drop the application room session. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-17-A005 | Media reconnection preserves the application room session. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-17-A006 | Peer audio operates independently of AI availability. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-18 — Recipient-only private room help

- Source: [canonical acceptance](../docs/sprint-backlog.md:399); related feature text: F13. Recipient-only private room help.
- Dependencies: ED-09, ED-11, ED-13.
- Existing implementation pointers: `apps/api/modules/notification/src/routes/voice.ts; apps/api/modules/study/src/routes/rooms.ts`
- Prior evidence pointer: Private result primitives exist; recipient-only room tutor end-to-end not verified
- Missing work: Build requester-only help, safe sharing, private history/reconnect and negative tests
- Priority: P1; prior task confidence: LOW; prior task status: PARTIAL
- Final validation specified by backlog: Multi-browser negative tests, cache/log/summary inspection and authorization replay.
- Related source views (aliases, not independent feature counts): [F13](../docs/product-specification.md:140), [T20](../docs/testing-plan.md:38), [M26](../EdNova_Complete_Codex_Mission_Roadmap.md:617), [Contract 18](../docs/contracts/technical-contracts.md:679)

<!-- atomic-data:start -->
Original acceptance ([source line 399](../docs/sprint-backlog.md:399)): Only requester sees simplified explanation across events/history/reconnect; no educator/peer access.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-18-A001 | Only the requester receives the simplified explanation over events. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-18-A002 | Only the requester can retrieve private-help history. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-18-A003 | Requester-only help remains private after reconnect. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-18-A004 | An educator cannot access another learner's private help. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-18-A005 | A peer cannot access another learner's private help. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-19 — Minimal instructor aggregate insight

- Source: [canonical acceptance](../docs/sprint-backlog.md:417); related feature text: F16. Minimal instructor aggregate insight.
- Dependencies: ED-04, ED-11, ED-13.
- Existing implementation pointers: `apps/api/modules/study/src/services/roomLearning.ts; docs/sprint-backlog.md:409`
- Prior evidence pointer: Room debrief suppresses grade aggregates; owned-course instructor insight not found
- Missing work: Implement reviewed thresholded course aggregates, cohort privacy and instructor ACL
- Priority: P1; prior task confidence: MEDIUM; prior task status: MISSING
- Final validation specified by backlog: Synthetic cohorts above/below threshold and inference/leakage review.
- Related source views (aliases, not independent feature counts): [F16](../docs/product-specification.md:167), [T21](../docs/testing-plan.md:39), [M27](../EdNova_Complete_Codex_Mission_Roadmap.md:633)

<!-- atomic-data:start -->
Original acceptance ([source line 417](../docs/sprint-backlog.md:417)): Unauthorized instructor denied and small cohorts suppressed; aggregate does not expose private answers/files.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-19-A001 | An unauthorized instructor is denied access to course aggregates. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-19-A002 | Small cohorts are suppressed according to the reviewed threshold. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-19-A003 | Aggregates cannot disclose private answers. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-19-A004 | Aggregates cannot disclose private files. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-20 — Collect safe real-user feedback

- Source: [canonical acceptance](../docs/sprint-backlog.md:435); related feature text: Bonus validation. Collect safe real-user feedback.
- Dependencies: Stable P0, ED-13, ED-14.
- Existing implementation pointers: `docs/sprint-backlog.md:427`
- Prior evidence pointer: No current independently verified volunteer sessions
- Missing work: Obtain consent and run/record anonymous 5–10-user evaluation after stable P0
- Priority: P1; prior task confidence: MEDIUM; prior task status: BLOCKED
- Final validation specified by backlog: Facilitated usability sessions, anonymous qualitative rubric and evidence review.
- Related source views (aliases, not independent feature counts): [M33](../EdNova_Complete_Codex_Mission_Roadmap.md:729)

<!-- atomic-data:start -->
Original acceptance ([source line 435](../docs/sprint-backlog.md:435)): Actual anonymous observation counts and limits recorded; no causal mastery/traction claim.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-20-A001 | Actual anonymous observation counts are recorded. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-20-A002 | Observation limitations are recorded. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-20-A003 | No causal mastery improvement claim is fabricated. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-20-A004 | No traction claim is fabricated. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-21 — Open-topic and lightweight learning extensions

- Source: [canonical acceptance](../docs/sprint-backlog.md:453); related feature text: F05, F11–F12. Open-topic and lightweight learning extensions.
- Dependencies: Stable P0; ED-10, ED-13.
- Existing implementation pointers: `apps/web/src/app/(workspace)/practice/page.tsx; apps/ai/agents/search/`
- Prior evidence pointer: Existing practice/search components; no verified no-upload labeled journey
- Missing work: Implement/test explicit unofficial provenance and safe extensions
- Priority: P2; prior task confidence: LOW; prior task status: PARTIAL
- Final validation specified by backlog: No-upload browser case and provenance/injection tests; test added preset transitions.
- Related source views (aliases, not independent feature counts): [F05](../docs/product-specification.md:68), [T25](../docs/testing-plan.md:43), [M34](../EdNova_Complete_Codex_Mission_Roadmap.md:745)

<!-- atomic-data:start -->
Original acceptance ([source line 453](../docs/sprint-backlog.md:453)): AI-generated baseline never labeled official; each selected extension has tested end-to-end flow and does not bypass source ACL.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-21-A001 | An AI-generated baseline is never labeled official institutional content. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-21-A002 | Each selected extension has an executed end-to-end flow. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-21-A003 | Extensions cannot bypass source access control. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-22 — Investigate legacy variants and heavy dependencies

- Source: [canonical acceptance](../docs/sprint-backlog.md:471); related feature text: Maintenance. Investigate legacy variants and heavy dependencies.
- Dependencies: ED-01; runtime/deployment evidence.
- Existing implementation pointers: `apps/ai/pyproject.toml; apps/api/modules/; docs/sprint-backlog.md:463`
- Prior evidence pointer: Dependency/source inventory exists but runtime use and deletion review incomplete
- Missing work: Map imports, image dependency parity and runtime references before proposed removal
- Priority: Post-hackathon; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Import/reference and launch-path audit, isolated tests/build, peer diff review.
- Related source views (aliases, not independent feature counts): [M36](../EdNova_Complete_Codex_Mission_Roadmap.md:777)

<!-- atomic-data:start -->
Original acceptance ([source line 471](../docs/sprint-backlog.md:471)): Any proposed deletion has reference/runtime proof and regression coverage; retained dependency graph preserved.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-22-A001 | A proposed deletion has import/reference evidence. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-22-A002 | A proposed deletion has runtime-use evidence. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-22-A003 | A proposed deletion has regression coverage. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-22-A004 | The retained dependency graph is preserved. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-23 — Decide legacy commercial/social scope

- Source: [canonical acceptance](../docs/sprint-backlog.md:489); related feature text: Maintenance / future product. Decide legacy commercial/social scope.
- Dependencies: Stable P0; team product decision.
- Existing implementation pointers: `apps/api/modules/auth/src/routes/stripe.ts; apps/api/modules/user-profile/src/routes/`
- Prior evidence pointer: Legacy commercial/social code present; no approved scope decision verified
- Missing work: Owner decision and dependency/migration map
- Priority: Post-hackathon; prior task confidence: MEDIUM; prior task status: BLOCKED
- Final validation specified by backlog: Impact review across auth/entitlements/session rewards/UI/tests; no speculative removal.
- Related source views (aliases, not independent feature counts): [M37](../EdNova_Complete_Codex_Mission_Roadmap.md:793)

<!-- atomic-data:start -->
Original acceptance ([source line 489](../docs/sprint-backlog.md:489)): Approved scope and dependency map; any future removal preserves contracted functionality or has explicit migration plan.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-23-A001 | Commercial/social scope has actual product approval. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-23-A002 | The commercial/social dependency map exists. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-23-A003 | Future removals preserve contracted functionality or carry an explicit approved migration plan. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-24 — Institutional product expansion

- Source: [canonical acceptance](../docs/sprint-backlog.md:507); related feature text: Future vision. Institutional product expansion.
- Dependencies: Validated pilot, ED-04, ED-19.
- Existing implementation pointers: `docs/sprint-backlog.md:499`
- Prior evidence pointer: Pilot and enterprise requirements not independently evidenced
- Missing work: Pilot-backed SSO/LMS/scale roadmap and privacy review
- Priority: Post-hackathon; prior task confidence: MEDIUM; prior task status: BLOCKED
- Final validation specified by backlog: Product/security design review and later feature-specific acceptance plans.
- Related source views (aliases, not independent feature counts): [M38](../EdNova_Complete_Codex_Mission_Roadmap.md:809)

<!-- atomic-data:start -->
Original acceptance ([source line 507](../docs/sprint-backlog.md:507)): Prioritized approved requirements backed by pilot evidence/privacy policy; no unsupported scale/traction claim.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-24-A001 | Institutional expansion requirements are prioritized. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-24-A002 | Institutional expansion requirements have actual approval. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-24-A003 | Requirements are backed by actual pilot evidence. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-24-A004 | Requirements are consistent with the privacy policy. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-24-A005 | No unsupported scale claim is made. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-24-A006 | No unsupported traction claim is made. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-25 — Multi-Speaker Voice AI Moderator (LiveKit Agents & Streaming Speech)

- Source: [canonical acceptance](../docs/sprint-backlog.md:526); related feature text: F10. Multi-Speaker Voice AI Moderator.
- Dependencies: ED-17, ED-09, ED-13; stable P0.
- Existing implementation pointers: `docs/sprint-backlog.md:517; apps/ai/agents/`
- Prior evidence pointer: No voice_moderator agent directory or LiveKit speech pipeline found
- Missing work: Resolve priority, build consented streaming voice and measure attribution/latency/no retention
- Priority: P1; prior task confidence: HIGH; prior task status: MISSING
- Final validation specified by backlog: Multi-speaker simulated audio dialogues, turn-taking tests, interruption tests, and audio packet inspection.
- Related source views (aliases, not independent feature counts): [M35](../EdNova_Complete_Codex_Mission_Roadmap.md:761), [Contract 12](../docs/contracts/technical-contracts.md:441), [Contract 14](../docs/contracts/technical-contracts.md:565)

<!-- atomic-data:start -->
Original acceptance ([source line 526](../docs/sprint-backlog.md:526)): Agent joins LiveKit room on dispatch; accurately attributes utterances to individual speakers; intervenes peer-first without spoiling answers; latency from speech pause to AI response onset is <1,500ms; muting or disconnection leaves peer audio intact; zero audio recorded to persistent disk.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-25-A001 | The AI agent joins a LiveKit room after authorized dispatch. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A002 | Utterances are correctly attributed to individual speakers. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A003 | Intervention is peer-first. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A004 | Intervention does not immediately spoil answers. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A005 | Actual speech-pause to response-onset latency is below 1500 ms. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A006 | Muting the AI leaves peer audio intact. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A007 | AI disconnection leaves peer audio intact. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-25-A008 | No raw audio is written to persistent disk. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-DOC — Audit and realign documentation

- Source: [canonical acceptance](../docs/sprint-backlog.md:544); related feature text: Documentation only. Audit and realign documentation.
- Dependencies: Static source audit and documentation/link checks.
- Existing implementation pointers: `docs/development.md; docs/deployment.md; docs/runbooks/ednova-revision-sources.md`
- Prior evidence pointer: Current setup and AI/storage instructions corrected; wider consistency review remains
- Missing work: Reconcile remaining historical/current scope conflicts and fully audit contracts and reports
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Review documentation diff, local links, IDs/statuses and source-only scope; see audit results.
- Related source views (aliases, not independent feature counts): [M00](../EdNova_Complete_Codex_Mission_Roadmap.md:201)

<!-- atomic-data:start -->
Original acceptance ([source line 544](../docs/sprint-backlog.md:544)): Maintained navigation/specs/roles/models/workflows/AI/roadmap/testing/delivery and v1.2 ownership/contract plan exist; no runtime feature changes; history labeled. DONE refers only to documentation, not implementation.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-DOC-A001 | Maintained documentation navigation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A002 | Maintained product specification exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A003 | Maintained roles/permissions documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A004 | Maintained data-model documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A005 | Maintained workflow documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A006 | Maintained AI architecture/operation documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A007 | Maintained roadmap documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A008 | Maintained testing documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A009 | Maintained delivery documentation exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A010 | The v1.2 ownership plan exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A011 | The v1.2 contract plan exists. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A012 | Historical claims are labeled as history. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-DOC-A013 | Documentation-only completion never implies runtime implementation completion. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-26 — Freeze versioned cross-member activity/content/evidence contracts

- Source: [canonical acceptance](../docs/sprint-backlog.md:562); related feature text: Not recorded
- Dependencies: ED-01/02; Habib+Tasnim+Aziz contract review.
- Existing implementation pointers: `docs/contracts/ednova-v1-approvals.md:140; apps/api/shared/ednova/contracts.ts; apps/ai/contracts/ednova.py`
- Prior evidence pointer: Owner ledger shows 0/19 decisions and 0/5 confirmations; schema check passes
- Missing work: Real dated decisions, confirmations, artifact hash review and formal freeze
- Priority: P0; prior task confidence: HIGH; prior task status: BLOCKED
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F20](../docs/product-specification.md:209), [F21](../docs/product-specification.md:217), [T27](../docs/testing-plan.md:70), [M03](../EdNova_Complete_Codex_Mission_Roadmap.md:249)

<!-- atomic-data:start -->
Original acceptance ([source line 562](../docs/sprint-backlog.md:562)): Canonical quiz/guided-problem/source/attempt/room/evidence examples agree across all three members; invalid/version-mismatch and visibility rules explicit; no keys/rubrics in public payload.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-26-A001 | Canonical quiz examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A002 | Canonical guided-problem examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A003 | Canonical source examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A004 | Canonical attempt examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A005 | Canonical room examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A006 | Canonical evidence examples agree across the three owners. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A007 | Invalid-payload rules are explicit. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A008 | Version-mismatch rules are explicit. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A009 | Visibility rules are explicit. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A010 | Public payloads contain no grading keys. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-26-A011 | Public payloads contain no grading rubrics. | BLOCKED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-27 — Trusted quiz/guided-problem renderer and learner flow

- Source: [canonical acceptance](../docs/sprint-backlog.md:582); related feature text: Not recorded
- Dependencies: ED-26, ED-28, ED-29 (solo integration first; room integration is a downstream gate).
- Existing implementation pointers: `apps/web/src/features/learning/activity-renderer.tsx; apps/api/modules/study/src/services/activityAttempt.ts`
- Prior evidence pointer: Current unit and authenticated browser quiz/guided/attempt flows pass; accessibility and full acceptance remain
- Missing work: Verify keyboard/mobile, retry/no extra evidence and private room behavior on live services
- Priority: P0; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F20](../docs/product-specification.md:209), [T30](../docs/testing-plan.md:73), [T32](../docs/testing-plan.md:75), [M13](../EdNova_Complete_Codex_Mission_Roadmap.md:409), [Contract 04](../docs/contracts/technical-contracts.md:173)

<!-- atomic-data:start -->
Original acceptance ([source line 582](../docs/sprint-backlog.md:582)): Both types work keyboard/mobile with feedback/fallback; reset yields no new accepted evidence; private attempts never broadcast; no eval/inner executable model markup.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-27-A001 | The quiz renderer works with keyboard input. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A002 | The guided-problem renderer works with keyboard input. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A003 | The quiz renderer works on mobile. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A004 | The guided-problem renderer works on mobile. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A005 | Quiz feedback is rendered. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A006 | Guided-problem feedback is rendered. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A007 | Unavailable/invalid activity fallback is safe. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A008 | Reset creates no new accepted evidence. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A009 | Private attempts are never broadcast. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-27-A010 | Model-generated markup is never evaluated as executable code. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-28 — AI intent-to-activity selection and safe output validation

- Source: [canonical acceptance](../docs/sprint-backlog.md:600); related feature text: Not recorded
- Dependencies: ED-03, ED-10, ED-26.
- Existing implementation pointers: `apps/api/modules/study/src/services/learningJourney.ts`
- Prior evidence pointer: Deterministic reviewed activity selector explicitly adaptive:false
- Missing work: Approved source-grounded model selection and output validation, or formally accept deterministic scope
- Priority: P0; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F20](../docs/product-specification.md:209), [T30](../docs/testing-plan.md:73), [M11](../EdNova_Complete_Codex_Mission_Roadmap.md:377), [Contract 04](../docs/contracts/technical-contracts.md:173)

<!-- atomic-data:start -->
Original acceptance ([source line 600](../docs/sprint-backlog.md:600)): Source-backed request selects suitable allowed type; arbitrary code, unknown type/version or forged source fails safely; output is not auto-approved official content.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-28-A001 | A source-backed request selects a suitable allowed activity type. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-28-A002 | Arbitrary executable code fails safely. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-28-A003 | An unknown activity type fails safely. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-28-A004 | An unsupported activity version fails safely. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-28-A005 | A forged source fails safely. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-28-A006 | Generated output is not automatically approved as official content. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-29 — Private activity attempts, assessment and accepted evidence

- Source: [canonical acceptance](../docs/sprint-backlog.md:618); related feature text: Not recorded
- Dependencies: ED-02, ED-26; ED-08 evaluator integration.
- Existing implementation pointers: `apps/api/modules/study/src/services/activityAttempt.ts; apps/api/modules/study/src/services/activityEvaluation.ts`
- Prior evidence pointer: Current real Mongo integration passes duplicate/race and actual SIGKILL recovery; broader official acceptance remains
- Missing work: Verify all official contract, deployment durability and operational acceptance criteria
- Priority: P0; prior task confidence: MEDIUM; prior task status: IMPLEMENTED_UNVERIFIED
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F20](../docs/product-specification.md:209), [F22](../docs/product-specification.md:225), [T31](../docs/testing-plan.md:74), [T32](../docs/testing-plan.md:75), [M10](../EdNova_Complete_Codex_Mission_Roadmap.md:361), [M12](../EdNova_Complete_Codex_Mission_Roadmap.md:393), [Contract 05](../docs/contracts/technical-contracts.md:212), [Contract 06](../docs/contracts/technical-contracts.md:238), [Contract 07](../docs/contracts/technical-contracts.md:269)

<!-- atomic-data:start -->
Original acceptance ([source line 618](../docs/sprint-backlog.md:618)): Forged grade/actor/stale revision denied; retries and concurrent duplicate callbacks create one accepted evidence; pending/unavailable grade gets no mastery/XP; no rubric/private-answer leak.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-29-A001 | A forged grade is denied. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A002 | A forged actor is denied. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A003 | A stale source/activity revision is denied. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A004 | Retries create accepted evidence only once. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A005 | Concurrent duplicate callbacks create accepted evidence only once. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A006 | Pending evaluation receives no mastery. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A007 | Pending evaluation receives no XP. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A008 | Unavailable evaluation receives no mastery. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A009 | Unavailable evaluation receives no XP. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A010 | Grading rubrics never leak through private-result/public boundaries. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-29-A011 | Private answers never leak through unauthorized boundaries. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-30 — Course Studio draft hierarchy and provenance API

- Source: [canonical acceptance](../docs/sprint-backlog.md:636); related feature text: Not recorded
- Dependencies: ED-04, ED-06, ED-26.
- Existing implementation pointers: `apps/api/modules/study/src/services/courseDraft.ts; apps/api/modules/study/src/services/revisionSources.ts`
- Prior evidence pointer: Current Mongo and browser draft/revision checks pass; full contract/operational acceptance remains
- Missing work: Complete provenance/operational certification and owner review
- Priority: P0; prior task confidence: MEDIUM; prior task status: IMPLEMENTED_UNVERIFIED
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F21](../docs/product-specification.md:217), [T28](../docs/testing-plan.md:71), [T29](../docs/testing-plan.md:72), [M07](../EdNova_Complete_Codex_Mission_Roadmap.md:313), [Contract 02](../docs/contracts/technical-contracts.md:77), [Contract 03](../docs/contracts/technical-contracts.md:133)

<!-- atomic-data:start -->
Original acceptance ([source line 636](../docs/sprint-backlog.md:636)): Wrong hierarchy can be corrected and re-read; source refs remain traceable or explicitly unknown; simultaneous stale edits rejected; draft not accessible to learners; approved active revision immutable.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-30-A001 | An incorrect draft hierarchy can be corrected. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A002 | The corrected hierarchy can be read back. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A003 | Source references remain traceable when known. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A004 | Unknown source locations are explicitly marked unknown. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A005 | Simultaneous stale edits are rejected. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A006 | Learners cannot access an unpublished draft. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-30-A007 | The approved active revision remains immutable. | IMPLEMENTED_UNVERIFIED | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-31 — Course Studio editor, preview and approval UI

- Source: [canonical acceptance](../docs/sprint-backlog.md:654); related feature text: Not recorded
- Dependencies: ED-26, ED-30, ED-05; ED-27 for preview.
- Existing implementation pointers: `apps/web/src/features/courses/course-studio.tsx; apps/web/src/features/courses/studio-actions.ts`
- Prior evidence pointer: Current real worker/browser text and synthetic PDF upload-to-publication flows pass
- Missing work: Complete OCR and rich editing/error/accessibility acceptance
- Priority: P0 minimum; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F21](../docs/product-specification.md:217), [T28](../docs/testing-plan.md:71), [T29](../docs/testing-plan.md:72), [M15](../EdNova_Complete_Codex_Mission_Roadmap.md:441), [M30](../EdNova_Complete_Codex_Mission_Roadmap.md:681)

<!-- atomic-data:start -->
Original acceptance ([source line 654](../docs/sprint-backlog.md:654)): Instructor corrects extracted heading, previews a quiz/problem and publishes; learner opens approved revision; independent owner cannot publish institution-official material; stale edit/error visible.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-31-A001 | An instructor can correct an extracted heading through the UI. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A002 | An instructor can preview a quiz. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A003 | An instructor can preview a guided problem. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A004 | An instructor can publish the reviewed revision. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A005 | A learner opens the approved revision. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A006 | A personal-course owner cannot publish institution-official material. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A007 | A stale-edit conflict is visible. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-31-A008 | A processing/publication error is visible. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-32 — Source-backed Studio activity proposals and customization

- Source: [canonical acceptance](../docs/sprint-backlog.md:672); related feature text: Not recorded
- Dependencies: ED-06, ED-26, ED-28; ED-30 draft contract.
- Existing implementation pointers: `apps/api/modules/study/src/services/courseStudio.ts`
- Prior evidence pointer: Source quotation candidates require review; general conceptual and rich settings absent
- Missing work: Approved conceptual source-grounded generation; language/difficulty/hint controls and tests
- Priority: P0 grounding; prior task confidence: HIGH; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F21](../docs/product-specification.md:217), [T33](../docs/testing-plan.md:76), [M14](../EdNova_Complete_Codex_Mission_Roadmap.md:425), [M30](../EdNova_Complete_Codex_Mission_Roadmap.md:681), [Contract 04](../docs/contracts/technical-contracts.md:173)

<!-- atomic-data:start -->
Original acceptance ([source line 672](../docs/sprint-backlog.md:672)): P0 student activity grounded in corrected approved section; P1 settings affect output while unsupported claims/locations stay flagged; AI cannot self-publish or overwrite reviewed draft.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-32-A001 | The P0 learner activity is grounded in the corrected approved section. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-32-A002 | P1 generation settings affect the candidate output. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-32-A003 | Unsupported candidate claims are flagged. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-32-A004 | Unsupported candidate source locations are flagged. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-32-A005 | AI cannot self-publish official content. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-32-A006 | AI cannot overwrite a reviewed draft. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-33 — Evidence-based XP, levels and achievement awards

- Source: [canonical acceptance](../docs/sprint-backlog.md:690); related feature text: Not recorded
- Dependencies: ED-29, ED-11, ED-13; stable P0.
- Existing implementation pointers: `apps/api/modules/user-profile/src/routes/gamification.ts; apps/api/modules/study/src/services/activityAttempt.ts`
- Prior evidence pointer: Legacy rewards exist; evidence-gated exactly-once recovery not established
- Missing work: Implement reviewed evidence-only award ledger and crash-safe idempotency
- Priority: P1; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F22](../docs/product-specification.md:225), [T34](../docs/testing-plan.md:77), [T35](../docs/testing-plan.md:78), [T36](../docs/testing-plan.md:79), [M28](../EdNova_Complete_Codex_Mission_Roadmap.md:649), [Contract 07](../docs/contracts/technical-contracts.md:269), [Contract 09](../docs/contracts/technical-contracts.md:327)

<!-- atomic-data:start -->
Original acceptance ([source line 690](../docs/sprint-backlog.md:690)): Concurrent retry/restart awards once and recoverably updates ledger+profile; same achievement once; no reward for chat/views/idle/failed or unverified attempts; XP distinct from mastery.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-33-A001 | Concurrent retries award XP only once. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A002 | Restart recovery awards XP only once. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A003 | Ledger/profile application is recoverable after a partial write. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A004 | The same achievement is awarded only once. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A005 | Chat alone earns no learning reward. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A006 | Page views alone earn no learning reward. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A007 | Idle time alone earns no learning reward. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A008 | Failed attempts earn no learning reward. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A009 | Unverified attempts earn no learning reward. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-33-A010 | XP is distinct from academic mastery. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-34 — Explainable XP/level/achievement learner feedback

- Source: [canonical acceptance](../docs/sprint-backlog.md:708); related feature text: Not recorded
- Dependencies: ED-33 public projection; ED-27 learner flow.
- Existing implementation pointers: `apps/web/src/app/(workspace)/progress/page.tsx; apps/api/modules/user-profile/src/routes/gamification.ts`
- Prior evidence pointer: Legacy progress exists; evidence award UI depends on ED-33
- Missing work: Private award reasons and replay/no duplicate feedback, separate XP from mastery
- Priority: P1; prior task confidence: MEDIUM; prior task status: PARTIAL
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F22](../docs/product-specification.md:225), [T36](../docs/testing-plan.md:79), [M29](../EdNova_Complete_Codex_Mission_Roadmap.md:665), [Contract 08](../docs/contracts/technical-contracts.md:302), [Contract 09](../docs/contracts/technical-contracts.md:327)

<!-- atomic-data:start -->
Original acceptance ([source line 708](../docs/sprint-backlog.md:708)): Accepted solo/group check shows one award reason, correct level and badge; repeated refresh shows no duplicate toast/award; XP never appears as academic mastery.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-34-A001 | An accepted solo check shows a verified award reason. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A002 | An accepted group check shows a verified award reason. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A003 | The displayed level is correct. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A004 | The displayed badge is correct. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A005 | Refresh creates no duplicate reward notification. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A006 | Refresh creates no duplicate award. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-34-A007 | XP is never displayed as academic mastery. | PARTIAL | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->

## ED-35 — One deterministic educational visualization extension

- Source: [canonical acceptance](../docs/sprint-backlog.md:726); related feature text: Not recorded
- Dependencies: ED-26, ED-27; Tasnim-reviewed worked example; stable P0.
- Existing implementation pointers: `apps/web/src/features/learning/activity-renderer.tsx; docs/sprint-backlog.md:718`
- Prior evidence pointer: Renderer supports quiz/guided; no approved deterministic visualizer found
- Missing work: Choose one example, implement bounded correct accessible controls and shared-room reuse
- Priority: P1; prior task confidence: MEDIUM; prior task status: MISSING
- Final validation specified by backlog: Not recorded
- Related source views (aliases, not independent feature counts): [F20](../docs/product-specification.md:209), [T37](../docs/testing-plan.md:80), [M31](../EdNova_Complete_Codex_Mission_Roadmap.md:697)

<!-- atomic-data:start -->
Original acceptance ([source line 726](../docs/sprint-backlog.md:726)): Chosen algorithm/math example has correct reproducible back/next/reset, accessible controls and room reuse; interaction alone yields no mastery/evidence.

Normative assertions below are a maintained decomposition, not verbatim quotations or new independent features. Source, priority, dependencies, implementation pointers, related views and final validation method above apply to each row. Historical absence observations (notably ED-04) are normalized to the required behavior; they are not instructions to preserve missing functionality.

| Criterion | Atomic requirement | Status | Confidence | Current evidence / missing validation |
|---|---|---|---|---|
| ED-35-A001 | The chosen deterministic example has a correct next transition. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A002 | The chosen deterministic example has a correct back transition. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A003 | Reset reproduces the initial state. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A004 | Transitions are reproducible. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A005 | Controls are accessible. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A006 | The same visualizer can be reused in a shared room. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A007 | Interaction alone creates no mastery claim. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
| ED-35-A008 | Interaction alone creates no accepted evidence. | MISSING | LOW at criterion level | Parent implementation and prior evidence pointers above; complete this assertion through the stated validation method before certification. |
<!-- atomic-data:end -->


## Current scoped acceptance increments — 27 October 2026

These narrow requirements have current execution evidence. They supplement the draft decomposition; a verified local case does not close its full parent task. The supplied mission is retained with exact original line numbers in [mission-source.txt](evidence/ednova-execution-20261027/mission-source.txt). All rows below are P0. Evidence scopes and remaining limitations are deliberate parts of the status.

| Criterion | Canonical task | F / T / M / contract references | Requirement | Source and line | Implementation | Current evidence | Missing work | Dependencies | Status | Confidence | Final validation method |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ED-01-V01 | ED-01 | F19; M01 | AI image uses a non-root runtime user | [Mission:229](evidence/ednova-execution-20261027/mission-source.txt:229) | apps/ai/Dockerfile; services/runtime_storage.py | nonroot-ocr-current.log: UID/GID 10001, real PDF/FAISS write and HTTP health pass | Existing deployment mount migration is separate | Locked image build | IMPLEMENTED_AND_VERIFIED | HIGH, synthetic runtime | Rebuild image; run scripts/verify-ai-container.mjs |
| ED-01-V02 | ED-01 | F19; T23; M01 | Incompatible existing storage is refused without modifying its owner or contents | [Mission:230](evidence/ednova-execution-20261027/mission-source.txt:230) | runtime_storage.py; container-entrypoint.sh | nonroot-ocr-current.log: exit 1 plus owner/mode/sentinel preservation | Real user-volume permission review | ED-01-V01 | IMPLEMENTED_AND_VERIFIED | HIGH, synthetic incompatible mount | Isolated fresh and legacy-volume runtime check |
| ED-01-V03 | ED-01 | F01; T01; M01 | Browser baseline runs without using the active development site's port/output/database | [Backlog:75](../docs/sprint-backlog.md:75) | playwright.config.ts; next.config.mjs; tests/browser-server.ts; m02-resource-isolation.node.test.ts | browser-auth-isolated.log: 8 pass; m02-isolation.log: 21 pass | Browser synthetic DB cleanup remains manual | Local Mongo/Mailpit/Chromium | IMPLEMENTED_AND_VERIFIED | HIGH, local test setup | Alternate-port real auth/workspace browser run |
| ED-01-V04 | ED-01 | F01/F19; M01 | Current API/web static, unit, integration, auth and build commands pass | [Backlog:75](../docs/sprint-backlog.md:75) | Existing packages; coach.test.ts formatting | ocr-lint/ocr-typecheck/node-ocr-current/build-ocr-current logs: exit 0; 264 integration nodes, no Node skips | Remote CI, cold empty-host install, full product acceptance | Isolated local services; locked interpreter | IMPLEMENTED_AND_VERIFIED | HIGH for listed commands | Exact commands and dependency scopes in EDNOVA-TEST-COVERAGE.md |
| ED-05-V01 | ED-05, ED-06 | F03; T03/T05; M05/M08; Contracts 01–03 | Failed replacement enqueue preserves existing original download bytes | [Backlog:154](../docs/sprint-backlog.md:154); [Mission:321](evidence/ednova-execution-20261027/mission-source.txt:321) | routes/courses.ts replacement failure; p0r2-source-ai.node.test.ts | source-replacement-final.log: nested real HTTP/file regression passes | Other failure boundaries remain separate | Published source fixture; injected enqueue failure | IMPLEMENTED_AND_VERIFIED | HIGH, real local services with injected failure | Existing-file byte comparison and authenticated HTTP download after 503 |
| ED-05-V02 | ED-05, ED-30 | F03/F21; T03/T29; M08; Contract 03 | Failed replacement enqueue cannot redirect the published context or tutor pin | [Mission:321](evidence/ednova-execution-20261027/mission-source.txt:321) | Same source route; immutable source resolver | source-replacement-final.log: identical published context, original tutor revision | Complete concurrent upload/uncertain broker-ack recovery | ED-05-V01 | IMPLEMENTED_AND_VERIFIED | HIGH for injected enqueue failure | Real published-context and grounded-tutor requests after failure |
| ED-06-V01 | ED-06 | F19; T23; M05/M18; Contract 01 | A claimed unacknowledged worker delivery survives process kill and broker restart | [Mission:350–351](evidence/ednova-execution-20261027/mission-source.txt:350) | BaseAIWorker; RedisIdempotencyStore; verify-worker-recovery.mjs | worker-recovery-ocr-current.log: actual worker SIGKILL and broker/Redis KILL/restart pass | Actual ingestion persistence-boundary crash drills and fencing | Disposable internal broker/Redis and image | PARTIAL | HIGH for base transport; domain gate open | Real transport probe; repeat with ingestion-domain crash points |
| ED-06-V02 | ED-06, ED-12 | F17/F19; T15/T23; M05/M18; Contract 01 | Retry budget exhaustion and terminal errors enter the real dead-letter queue | [Mission:354](evidence/ednova-execution-20261027/mission-source.txt:354) | BaseAIWorker; delay queue topology | worker-recovery-ocr-current.log: terminal once; transient three attempts; final retry header 2 | Domain handler failure paths and sustained outage | ED-06-V01 | PARTIAL | HIGH for fixture handler; domain gate open | Actual RabbitMQ delay/DLQ consumption and Redis execution counts |
| ED-06-V03 | ED-06 | F03/F19; T23; M05; Contracts 01–03 | Synthetic Mongo revision/source snapshot restores into separate fresh storage | [Mission:361](evidence/ednova-execution-20261027/mission-source.txt:361) | scripts/verify-source-restore.mjs | source-restore-ocr-current.log: real mongodump/mongorestore; unique index/pin and PDF/FAISS verified | Complete active-application snapshot and authenticated restored journeys | Stopped synthetic writer; disposable Mongo/volumes | PARTIAL | HIGH for coordinated synthetic restore | Restore archive and files independently; compare metadata, original/index checksum and page provenance |
| ED-06-V04 | ED-06 | F19; T23; M05 | A corrupted source archive is rejected before restore writes | [Mission:361](evidence/ednova-execution-20261027/mission-source.txt:361) | verify-source-restore.mjs checksum precondition | source-restore-ocr-current.log: corruption exit 1; empty targets asserted | Backup authenticity/encryption and live data procedures | Protected expected checksum for the synthetic fixture | IMPLEMENTED_AND_VERIFIED | HIGH for corruption detection | Flip archive byte; require denial and empty targets before valid restore |
| ED-13-V01 | ED-13 | F19; T24; M21 | Profile validation failure does not log private incoming profile fields | [Mission:486](evidence/ednova-execution-20261027/mission-source.txt:486) | routes/profile.ts; tests/profile.test.ts | profile-privacy.log: 4 route tests; private/rejected-value sentinel absent in captured error log | Complete logs/provider payload/retention audit; reward handler change has static evidence only | Existing authenticated profile handler | IMPLEMENTED_AND_VERIFIED | HIGH for profile error path | Actual HTTP invalid profile plus captured log assertions |
| ED-DOC-V01 | ED-DOC | F01–F22; T01–T38; M00–M38; Contracts 01–18 | Every canonical source-view ID resolves to a canonical task and exact source line | [Mission:89](evidence/ednova-execution-20261027/mission-source.txt:89) | scripts/ednova-acceptance-crosswalk.py | Script asserts 36 tasks / 22 features / 38 scenarios / 39 missions / 18 contracts | Complete all compound and independent security/operational atomic criteria | Canonical documents present | PARTIAL | HIGH for ID crosswalk, incomplete atomic audit | Regenerate with missing-ID assertions; manually reconcile all criterion semantics |


| ED-06-V05 | ED-06 | F03; T03/T05; M05/M08; Contract 02 | Image-only English PDF extraction stays within page/pixel/memory/CPU/time limits | [Mission:328–336](evidence/ednova-execution-20261027/mission-source.txt:328) | extraction/ocr.py; revision_artifacts.py | python-ocr-final.log: actual Tesseract scan, page/pixel limits, missing engine, corrupt/encrypted inputs and process-tree timeout cleanup pass; nonroot-ocr-current.log passes actual image OCR | Owner-approved input scope, degraded/multilingual scan quality | Local English Tesseract; Linux limits | IMPLEMENTED_AND_VERIFIED | HIGH for bounded synthetic English scope | Real image-only fixture plus explicit blocked engine/raster boundary checks |
| ED-06-V06 | ED-06, ED-31 | F03/F21; T03/T29; M05/M08; Contract 02 | OCR page identity, confidence and review warning survive revision preparation | [Mission:337–338](evidence/ednova-execution-20261027/mission-source.txt:337) | revision_artifacts.py; revisionSources.ts; learningJourney.ts; CourseStudio | source-ocr-current.log plus scanned-browser-current.log: real image-only pipeline, visible confidence/review warning, publication, page citations and byte-exact download pass | Representative human transcript review and exact correction history | ED-06-V05; original/manifest/index verification | IMPLEMENTED_AND_VERIFIED | HIGH for synthetic English API/browser delivery | 14 source nodes, Python metadata validation and nine scanned-PDF browser checkpoints |
| ED-07-V01 | ED-07, ED-09, ED-11 | F09/F11; T10; M09/M11; Contracts 10/15/17 | Four authenticated learners share canonical activity while keeping grades/debrief private | [Backlog:198](../docs/sprint-backlog.md:198); [Mission:688](evidence/ednova-execution-20261027/mission-source.txt:688) | Integrated browser harness; existing room command/private evidence services | four-learner-resumed.log and browser-checks.json: all eight A–E checkpoints pass, exit 0 | Distributed fanout, process-restart browser recovery, representative facilitation quality | Real local services; deterministic inference/embeddings; disposable frontend source copy | IMPLEMENTED_AND_VERIFIED | HIGH for single-API-instance synthetic journey | Four independent learner cookie/browser contexts, cross-recipient denial, reload/reconnect and revocation |


| ED-08-V01 | ED-08, ED-28 | F07/F08; M06/M07 | Exact committed evidence drives reproducible introductory/progression/remediation routing; untested remains unassessed | [Final mission:274](evidence/ednova-final-20261027/mission-source.txt:274) | adaptiveLearning.ts; learningJourney.ts; LearningWorkspace | p0-isolated-current.log and regression-accepted.log pass structural routing, wrong/correct/stale/forged inputs and bounded private hints | Calibrated pedagogy/model-assisted policy and adaptive browser acceptance | Immutable approved activities and exact completed receipts | IMPLEMENTED_AND_VERIFIED | HIGH for deterministic structural baseline | Real Mongo state transitions and repeat selection; approved model quality separate |
| ED-06-V07 | ED-05, ED-06, ED-30 | F03/F21; M05/M08 | Dispatch correlation precedes publish; uncertain acknowledgements reuse identity; cancellation blocks stale outcomes | [Final mission:242](evidence/ednova-final-20261027/mission-source.txt:242) | CourseIngestionOperation; ingestionControl; ingestStatus; worker stage checks | ingestion-pins-current.log 6 pass; source-resumed.log 14 real broker/worker/source nodes pass; Python1083 pass | Physical kill at every ingestion persistence boundary; live-application restore | Retained immutable originals and authorized author commands | PARTIAL | HIGH for tested fault boundaries | Explicit publisher fault, durable first outcome replay, real broker regression |
| ED-31-V01 | ED-30, ED-31, ED-32 | F21; T29; M08 | Correctable headings and source-targeted language/difficulty/hint settings require instructor review | [Final mission:242](evidence/ednova-final-20261027/mission-source.txt:242) | courseStudio; CourseStudio editor; draft conflict controls | studio/drafts-settings.log 18 pass; expanded browser heading/publication checkpoint passes | Human scaffold language/semantic quality; complete settings browser matrix | Verified source section/chunk; current draft | PARTIAL | HIGH for local settings and corrected heading flow | Real Mongo settings/stale/no-mutation cases plus browser heading readback |
| ED-07-V02 | ED-07 | F09/F19; M09 | Process-local realtime cannot silently run as multiple production API owners | [Final mission:342](evidence/ednova-final-20261027/mission-source.txt:342) | single-instance.ts; HTTP/WS fencing; production startup | final-security-lease.log actual Mongo ownership/renewal/stall/SIGKILL/takeover passes | Full production two-application HTTP/WS rollout drill | Common Mongo application DB and one replica | PARTIAL | HIGH for owner lease, production drill open | Second owner refusal and monotonic delivery fence; no distributed support claim |
| ED-33-V01 | ED-33, ED-34 | F22; M10/M11 | Accepted-evidence rewards survive concurrency/restart/partial application and cannot be minted by arbitrary actions or quests | [Final mission:375](evidence/ednova-final-20261027/mission-source.txt:375) | learningRewards; existing Gamification CAS/markers; reward audit ledger; attempt hook; ProgressRewards | rewards-quest-verified.log 11 actual Mongo nodes pass; full repository regression passes | Authenticated earned solo/group reward dashboard/notification browser acceptance and policy review | Valid reviewed grading/evidence; MOCK_TEST ineligible | PARTIAL | HIGH for backend protocol | Concurrent logical duplicates, fresh-process replay, actual normal grading hook and legacy quest denial |
| ED-19-V01 | ED-19 | F16; M20 | Instructor aggregates remain private-free and unavailable without an approved/configured conservative cohort policy | [Final mission:420](evidence/ednova-final-20261027/mission-source.txt:420) | instructorAnalytics; insights router and page | Real Nest/auth/Mongo7 pass; SSR3 pass; current browser suppresses metrics by default | Actual reviewed threshold/privacy policy; representative inference review | Assigned instructor/current cohort/publication | PARTIAL | HIGH for fail-closed synthetic checks | Wrong actor/cross scope/current revocation, sparse/complement cells and suppressed UI |
| ED-35-V01 | ED-35 | F22; M38 | Trusted deterministic binary-search state reuses durable presenter commands and creates no evidence/XP | [Final mission:462](evidence/ednova-final-20261027/mission-source.txt:462) | shared/visualization; BinarySearchVisualizer; RoomVisualizer; existing room CAS | Pure/SSR5 and authenticated three-member7 nodes pass; expanded browser Next/Previous and peer-disabled checks pass | Complete keyboard/mobile acceptance and representative worked-example review | Strict bounded inputs and current room authority | PARTIAL | HIGH for deterministic/shared behavior | Direct-search agreement and actual room replay/late-join/access tests |
| ED-18-V01 | ED-18 | F13; M26 | Room help is durable, requester-only, source-authorized and withheld after delayed revocation | [Final mission:488](evidence/ednova-final-20261027/mission-source.txt:488) | privateRoomHelp; dedicated router/history; private notifications; PrivateHelpPanel | private-help-delivery-verified.log 6 pass; expanded browser response/history/reload and empty peer history pass | Physical private-help process-crash and complete socket/retention/privacy acceptance | Current room/source grant and grounded tutor validation | PARTIAL | HIGH for tested requester boundary | Real Mongo faults and browser Nest/Python mock-inference path; no paid inference |
| ED-02-V01 | ED-02, ED-17 | F15; M19 | Membership never substitutes for current microphone consent on HTTP/signaling send or recipient delivery | [Final mission:514](evidence/ednova-final-20261027/mission-source.txt:514) | voiceConsent helper; voice router; realtime; self-only room/team settings | voice-consent-verified.log 15 pass; m02-consent-verified.log 21 pass; regression-accepted.log passes | LiveKit token/client/media cleanup and actual consenting multi-party audio | Current membership/source and explicit consent | PARTIAL | HIGH for legacy transport boundary | Default denial, explicit grant/withdraw, targeted signaling and unrelated room preservation |

Evidence filenames above are relative to [this execution run](evidence/ednova-execution-20261027/). Parent task statuses remain unchanged in the implementation tracker.

## Source-view traceability index

This index resolves all 22 feature, 38 scenario, 39 mission and 18 technical-contract references to canonical tasks and exact source lines. It does **not** mark any scenario executed or certify all strengthened criteria in each source view. Scenario outcomes below are preserved verbatim; mission/contract titles identify their complete source sections. Security and operational requirements still need criterion-level reconciliation. Run `python3 scripts/ednova-acceptance-crosswalk.py` after changing canonical sources; the script rejects missing view IDs and preserves existing criterion assessments.

| View | Canonical tasks | Exact source | Required outcome or scope | Verification status |
|---|---|---|---|---|
| F01 | ED-02, ED-04, ED-13 | [docs/product-specification.md:32](../docs/product-specification.md:32) | Verified login/logout/reset preserve identity; no client role override; independent path needs no institution; cross-context access denied. | PARTIAL — full view acceptance not established |
| F02 | ED-04, ED-05 | [docs/product-specification.md:41](../docs/product-specification.md:41) | Instructor edits own draft; another institution cannot read it; enrolled learner sees only published version. | PARTIAL — full view acceptance not established |
| F03 | ED-05, ED-06 | [docs/product-specification.md:50](../docs/product-specification.md:50) | Invalid/encrypted uploads fail visibly; failed extraction does not replace published material; source citation opens authorized version. | PARTIAL — full view acceptance not established |
| F04 | ED-02, ED-06 | [docs/product-specification.md:59](../docs/product-specification.md:59) | Owner can use extracted content; another user cannot retrieve it through file URL, course ID, AI request or cache. | PARTIAL — full view acceptance not established |
| F05 | ED-21 | [docs/product-specification.md:68](../docs/product-specification.md:68) | Fresh topic produces a labeled activity and check; unsupported assertions are tentative; no invented sources. | PARTIAL — full view acceptance not established |
| F06 | ED-06, ED-08, ED-10 | [docs/product-specification.md:77](../docs/product-specification.md:77) | A known course question yields a relevant citation and hint; no evidence yields uncertainty; full explanation available on request. | PARTIAL — full view acceptance not established |
| F07 | ED-08 | [docs/product-specification.md:86](../docs/product-specification.md:86) | Beginner and advanced synthetic answers choose suitable tasks; no psychometric label or unsupported mastery percentage. | PARTIAL — full view acceptance not established |
| F08 | ED-11 | [docs/product-specification.md:95](../docs/product-specification.md:95) | Correct/incorrect/untested learners receive distinct justified next steps; result is private and reproducible. | PARTIAL — full view acceptance not established |
| F09 | ED-02, ED-07 | [docs/product-specification.md:104](../docs/product-specification.md:104) | Two browsers see matching presence/messages/phase; unauthorized join denied; rejoin does not duplicate progress. | PARTIAL — full view acceptance not established |
| F10 | ED-17 | [docs/product-specification.md:113](../docs/product-specification.md:113) | Three real browsers exchange audio while AI is unavailable; denial/mute/reconnect/leave work; no recorded audio is stored. | PARTIAL — full view acceptance not established |
| F11 | ED-06, ED-07 | [docs/product-specification.md:122](../docs/product-specification.md:122) | Browsers converge on source/context/exercise (PDF page-following tested in P1); outsider and unenrolled member cannot fetch official resource. | PARTIAL — full view acceptance not established |
| F12 | ED-09, ED-10, ED-12 | [docs/product-specification.md:131](../docs/product-specification.md:131) | Incorrect peer reasoning triggers peer-first prompt then supported hint; optional participation invite can be declined without penalty. | PARTIAL — full view acceptance not established |
| F13 | ED-18 | [docs/product-specification.md:140](../docs/product-specification.md:140) | Other room browsers and instructor cannot fetch/observe private request or response, including after reconnect. | PARTIAL — full view acceptance not established |
| F14 | ED-09, ED-10, ED-12 | [docs/product-specification.md:149](../docs/product-specification.md:149) | Known 3NF misconception receives correct grounded intervention; ambiguous evidence is not certified as wrong/right. | PARTIAL — full view acceptance not established |
| F15 | ED-11 | [docs/product-specification.md:158](../docs/product-specification.md:158) | Group recap states shared outcome without private scores/questions; each learner receives own evidence-linked action. | PARTIAL — full view acceptance not established |
| F16 | ED-19 | [docs/product-specification.md:167](../docs/product-specification.md:167) | Unrelated instructor denied; small cohorts suppressed; aggregates cannot reveal a private learner attempt. | PARTIAL — full view acceptance not established |
| F17 | ED-03, ED-12 | [docs/product-specification.md:176](../docs/product-specification.md:176) | Compact and capable requests proven with real inference; 429/timeout/non-streaming cases leave chat and materials usable. | PARTIAL — full view acceptance not established |
| F18 | ED-08, ED-16 | [docs/product-specification.md:185](../docs/product-specification.md:185) | Recorded examples show source fidelity and usable guidance across tested languages; report failures honestly. | PARTIAL — full view acceptance not established |
| F19 | ED-01, ED-02, ED-13, ED-14 | [docs/product-specification.md:194](../docs/product-specification.md:194) | Guessed IDs/invites/injected documents cannot cross scopes; retries do not duplicate exercise/result; no secrets/PII in evidence. | PARTIAL — full view acceptance not established |
| F20 | ED-07, ED-10, ED-12, ED-26, ED-27, ED-28, ED-29, ED-35 | [docs/product-specification.md:209](../docs/product-specification.md:209) | Approved-topic activity accepts learner input, returns correct hint/feedback, persists private verified evidence and can reset without farming credit. Invalid type/version/source/payload becomes safe text with no state mutation or execution. Shared presenter view never broadcasts private answers, answer keys or rubrics. | PARTIAL — full view acceptance not established |
| F21 | ED-04, ED-05, ED-06, ED-26, ED-30, ED-31, ED-32 | [docs/product-specification.md:217](../docs/product-specification.md:217) | Instructor corrects a wrong extracted heading before publishing; authorized students see approved revision/source references; a later draft cannot mutate active sessions. Failed extraction or concurrent edit does not replace approved content. Personal ownership never permits official university publication. | PARTIAL — full view acceptance not established |
| F22 | ED-29, ED-33, ED-34 | [docs/product-specification.md:225](../docs/product-specification.md:225) | Same verified completion and concurrent retries award XP once; forged/stale/other-user evidence denied; replay/restart cannot produce ledger/profile divergence; useful group completion requires personal check. Learner can explain every award/achievement; XP never labels subject mastery. Shops/cosmetics/leaderboards/extensive quests remain post-hackathon. | PARTIAL — full view acceptance not established |
| T01 | ED-01, ED-04 | [docs/testing-plan.md:19](../docs/testing-plan.md:19) | Cookie identity correct; revoked session denied over HTTP/WS; client teacher field grants no power | PARTIAL — full view acceptance not established |
| T02 | ED-04, ED-05 | [docs/testing-plan.md:20](../docs/testing-plan.md:20) | Own scope works; foreign-institution/expired/code-as-role escalation denied; no content enumeration | PARTIAL — full view acceptance not established |
| T03 | ED-05, ED-06 | [docs/testing-plan.md:21](../docs/testing-plan.md:21) | Published version preserved on failure; only assigned instructor publishes and enrolled learner reads | PARTIAL — full view acceptance not established |
| T04 | ED-02, ED-06 | [docs/testing-plan.md:22](../docs/testing-plan.md:22) | Denied before retrieval/inference; explicit sharing exposes only chosen resource to authorized room | PARTIAL — full view acceptance not established |
| T05 | ED-06 | [docs/testing-plan.md:23](../docs/testing-plan.md:23) | Correct recoverable errors, no execution/path escape/partial publication; progress terminal state accurate | PARTIAL — full view acceptance not established |
| T06 | ED-10 | [docs/testing-plan.md:24](../docs/testing-plan.md:24) | Correct authorized material/version/section; no fabricated citation; generated interpretation labeled | PARTIAL — full view acceptance not established |
| T07 | ED-10 | [docs/testing-plan.md:25](../docs/testing-plan.md:25) | No policy/source ACL override; unsupported evidence declared; safe relevant guidance | PARTIAL — full view acceptance not established |
| T08 | ED-08 | [docs/testing-plan.md:26](../docs/testing-plan.md:26) | Appropriate provisional difficulty and evidence-limited status; no fixed learner-type/intelligence diagnosis | PARTIAL — full view acceptance not established |
| T09 | ED-08, ED-09 | [docs/testing-plan.md:27](../docs/testing-plan.md:27) | Guiding question/graduated hint before reveal; full explanation available on explicit request | PARTIAL — full view acceptance not established |
| T10 | ED-07 | [docs/testing-plan.md:28](../docs/testing-plan.md:28) | Matching public activity state; ordering/reconnect/replay deterministic; private attempts separate; no duplicate accepted contribution | PARTIAL — full view acceptance not established |
| T11 | ED-09, ED-10 | [docs/testing-plan.md:29](../docs/testing-plan.md:29) | AI asks peer for justification then verifies/hints with evidence; ambiguous candidate not falsely certified | PARTIAL — full view acceptance not established |
| T12 | ED-09 | [docs/testing-plan.md:30](../docs/testing-plan.md:30) | Optional respectful invitation; no public ranking, forced turn or penalty; participant can finish | PARTIAL — full view acceptance not established |
| T13 | ED-11 | [docs/testing-plan.md:31](../docs/testing-plan.md:31) | Private own results/next step; safe public recap; no duplicate completion/reward or mastery overclaim | PARTIAL — full view acceptance not established |
| T14 | ED-03, ED-12 | [docs/testing-plan.md:32](../docs/testing-plan.md:32) | Compact and capable category choices traceable, correct and deliberate; approved provider IDs and real requests recorded | PARTIAL — full view acceptance not established |
| T15 | ED-12 | [docs/testing-plan.md:33](../docs/testing-plan.md:33) | Explicit limited mode, bounded approved retry; unresolved verification pending; room/chat/exercise keep working | PARTIAL — full view acceptance not established |
| T16 | ED-12 | [docs/testing-plan.md:34](../docs/testing-plan.md:34) | Scoped reuse/dedup, bounded calls/context/output; no quota bypass or cross-user cached content | PARTIAL — full view acceptance not established |
| T17 | ED-12 | [docs/testing-plan.md:35](../docs/testing-plan.md:35) | Visible queued/running progress; controls remain responsive; no fake token streaming or duplicate action | PARTIAL — full view acceptance not established |
| T18 | ED-16 | [docs/testing-plan.md:36](../docs/testing-plan.md:36) | Source meaning, formulas/code and accessible tone retained; actual failures recorded with human rubric | PARTIAL — full view acceptance not established |
| T19 | ED-02, ED-13 | [docs/testing-plan.md:37](../docs/testing-plan.md:37) | Resource membership enforced on fetch and delivery, not just login/connect; no later broadcast leak | PARTIAL — full view acceptance not established |
| T20 | ED-18 | [docs/testing-plan.md:38](../docs/testing-plan.md:38) | Recipient only; private question/answer/check never appears in group recap/events/logs | PARTIAL — full view acceptance not established |
| T21 | ED-19 | [docs/testing-plan.md:39](../docs/testing-plan.md:39) | Only approved aggregates; identifying small groups suppressed; private files/transcripts never accessible | PARTIAL — full view acceptance not established |
| T22 | ED-17 | [docs/testing-plan.md:40](../docs/testing-plan.md:40) | Text usable; audio teardown/reconnect correct; media unaffected by AI failure; no recording/transcription persistence | PARTIAL — full view acceptance not established |
| T23 | ED-01, ED-12 | [docs/testing-plan.md:41](../docs/testing-plan.md:41) | Bounded lease/retry recovery, one accepted result, consistent progress; durable evaluator resume only when configured | PARTIAL — full view acceptance not established |
| T24 | ED-13 | [docs/testing-plan.md:42](../docs/testing-plan.md:42) | No credentials, real identity/voice/private institution or learner profiles; all external services declared | PARTIAL — full view acceptance not established |
| T25 | ED-21 | [docs/testing-plan.md:43](../docs/testing-plan.md:43) | Generated baseline explicitly labeled; no invented university provenance; safe check and next step | PARTIAL — full view acceptance not established |
| T26 | ED-15 | [docs/testing-plan.md:44](../docs/testing-plan.md:44) | Reproducible real-inference flow, correct artifact limits and honest evidence/skips | PARTIAL — full view acceptance not established |
| T27 | ED-26 | [docs/testing-plan.md:70](../docs/testing-plan.md:70) | Supported versions/enums/visibility agree; revision-tag pins, exact revision FAISS refs, actor-scoped receipts, private guidance, source-free room states and closed proposal mappings agree; invalid bounded payload/type/version rejected consistently; grading key/rubric absent publicly | PARTIAL — full view acceptance not established |
| T28 | ED-06, ED-30, ED-31 | [docs/testing-plan.md:71](../docs/testing-plan.md:71) | Editable hierarchy retains original/provenance; unknown source location marked honestly; recoverable failure, no automatic publication | PARTIAL — full view acceptance not established |
| T29 | ED-05, ED-30, ED-31 | [docs/testing-plan.md:72](../docs/testing-plan.md:72) | Stale write rejected; unauthorized owner denied; active attempt still pins approved original revision/answer policy | PARTIAL — full view acceptance not established |
| T30 | ED-27, ED-28 | [docs/testing-plan.md:73](../docs/testing-plan.md:73) | Shipped components only; deterministic trusted code; safe text fallback; no code execution, partial state mutation or repeated credit | PARTIAL — full view acceptance not established |
| T31 | ED-29 | [docs/testing-plan.md:74](../docs/testing-plan.md:74) | Tasnim resolves identity/version and uses Habib source-access contract; accepted evidence once; uncertainty/pending receives no mastery/XP; private answers protected | PARTIAL — full view acceptance not established |
| T32 | ED-07, ED-27, ED-29 | [docs/testing-plan.md:75](../docs/testing-plan.md:75) | Authoritative public sequence/snapshot converges; presenter cannot submit for others or broadcast their private answers | PARTIAL — full view acceptance not established |
| T33 | ED-32 | [docs/testing-plan.md:76](../docs/testing-plan.md:76) | P1 candidate reflects settings, provenance retained, generated enrichment never auto-approved; failed generation keeps reviewed source | PARTIAL — full view acceptance not established |
| T34 | ED-33 | [docs/testing-plan.md:77](../docs/testing-plan.md:77) | Stable logical completion key; one capped XP/achievement application; no old/new reward double count | PARTIAL — full view acceptance not established |
| T35 | ED-33 | [docs/testing-plan.md:78](../docs/testing-plan.md:78) | Recover to exactly one effect and accurate reason/history; ledger existence alone cannot suppress a missing update | PARTIAL — full view acceptance not established |
| T36 | ED-33, ED-34 | [docs/testing-plan.md:79](../docs/testing-plan.md:79) | No learning XP for these alone; no mistake penalties; learner sees verified/pending and motivation level separately from subject evidence | PARTIAL — full view acceptance not established |
| T37 | ED-35 | [docs/testing-plan.md:80](../docs/testing-plan.md:80) | Reproducible correct output, keyboard/mobile/reduced-motion support, no generated code or automatic mastery claim | PARTIAL — full view acceptance not established |
| T38 | ED-14, ED-15 | [docs/testing-plan.md:81](../docs/testing-plan.md:81) | Full P0 uses real approved inference and survives capable outage; P1 reward shown only if implemented and T34–T36 pass; no prewritten screen presented as real feature | PARTIAL — full view acceptance not established |
| M00 | ED-DOC | [EdNova_Complete_Codex_Mission_Roadmap.md:201](../EdNova_Complete_Codex_Mission_Roadmap.md:201) | SOURCE-AND-EVIDENCE AUDIT (READ ONLY) | PARTIAL — full view acceptance not established |
| M01 | ED-01 | [EdNova_Complete_Codex_Mission_Roadmap.md:217](../EdNova_Complete_Codex_Mission_Roadmap.md:217) | BASELINE REPAIR AND REPRODUCIBLE QUALITY GATE | PARTIAL — full view acceptance not established |
| M02 | ED-02 | [EdNova_Complete_Codex_Mission_Roadmap.md:233](../EdNova_Complete_Codex_Mission_Roadmap.md:233) | CROSS-RESOURCE AUTHORIZATION AND TRANSPORT ISOLATION | PARTIAL — full view acceptance not established |
| M03 | ED-26 | [EdNova_Complete_Codex_Mission_Roadmap.md:249](../EdNova_Complete_Codex_Mission_Roadmap.md:249) | CANONICAL CROSS-DOMAIN CONTRACTS AND COMPATIBILITY FIXTURES | PARTIAL — full view acceptance not established |
| M04 | ED-04 | [EdNova_Complete_Codex_Mission_Roadmap.md:265](../EdNova_Complete_Codex_Mission_Roadmap.md:265) | INSTITUTION, COURSE MEMBERSHIP AND ENROLLMENT | PARTIAL — full view acceptance not established |
| M05 | ED-06 | [EdNova_Complete_Codex_Mission_Roadmap.md:281](../EdNova_Complete_Codex_Mission_Roadmap.md:281) | SCOPED FILE INGESTION, HIERARCHY AND SOURCE PROVENANCE | PARTIAL — full view acceptance not established |
| M06 | ED-03 | [EdNova_Complete_Codex_Mission_Roadmap.md:297](../EdNova_Complete_Codex_Mission_Roadmap.md:297) | APPROVED MODEL ADAPTER AND REAL-INFERENCE GATE | PARTIAL — full view acceptance not established |
| M07 | ED-30 | [EdNova_Complete_Codex_Mission_Roadmap.md:313](../EdNova_Complete_Codex_Mission_Roadmap.md:313) | COURSE STUDIO DRAFT HIERARCHY AND STALE-EDIT CONTROL | PARTIAL — full view acceptance not established |
| M08 | ED-05 | [EdNova_Complete_Codex_Mission_Roadmap.md:329](../EdNova_Complete_Codex_Mission_Roadmap.md:329) | REVIEW, IMMUTABLE COURSE PUBLICATION AND ACCESS | PARTIAL — full view acceptance not established |
| M09 | ED-10 | [EdNova_Complete_Codex_Mission_Roadmap.md:345](../EdNova_Complete_Codex_Mission_Roadmap.md:345) | SOURCE-GROUNDED RETRIEVAL, TUTOR AND VERIFICATION | PARTIAL — full view acceptance not established |
| M10 | ED-29 | [EdNova_Complete_Codex_Mission_Roadmap.md:361](../EdNova_Complete_Codex_Mission_Roadmap.md:361) | PRIVATE ATTEMPT PERSISTENCE AND EVIDENCE KERNEL | PARTIAL — full view acceptance not established |
| M11 | ED-28 | [EdNova_Complete_Codex_Mission_Roadmap.md:377](../EdNova_Complete_Codex_Mission_Roadmap.md:377) | GROUNDED INTENT-TO-ACTIVITY SELECTOR | PARTIAL — full view acceptance not established |
| M12 | ED-08, ED-29 | [EdNova_Complete_Codex_Mission_Roadmap.md:393](../EdNova_Complete_Codex_Mission_Roadmap.md:393) | GUIDED DIAGNOSTIC PLUS ACCEPTED PRIVATE EVIDENCE | PARTIAL — full view acceptance not established |
| M13 | ED-27 | [EdNova_Complete_Codex_Mission_Roadmap.md:409](../EdNova_Complete_Codex_Mission_Roadmap.md:409) | TRUSTED SHIPPED ACTIVITY RENDERER | PARTIAL — full view acceptance not established |
| M14 | ED-32 | [EdNova_Complete_Codex_Mission_Roadmap.md:425](../EdNova_Complete_Codex_Mission_Roadmap.md:425) | SOURCE-BACKED COURSE STUDIO ACTIVITY PROPOSALS | PARTIAL — full view acceptance not established |
| M15 | ED-31 | [EdNova_Complete_Codex_Mission_Roadmap.md:441](../EdNova_Complete_Codex_Mission_Roadmap.md:441) | COURSE STUDIO EDITOR, PREVIEW AND APPROVAL JOURNEY | PARTIAL — full view acceptance not established |
| M16 | ED-07 | [EdNova_Complete_Codex_Mission_Roadmap.md:457](../EdNova_Complete_Codex_Mission_Roadmap.md:457) | ED-07 PRE-INTEGRATION REGRESSION AND CONTRACT READINESS | PARTIAL — full view acceptance not established |
| M17 | ED-07 | [EdNova_Complete_Codex_Mission_Roadmap.md:473](../EdNova_Complete_Codex_Mission_Roadmap.md:473) | FINAL SHARED LEARNING ROOM INTEGRATION | PARTIAL — full view acceptance not established |
| M18 | ED-12 | [EdNova_Complete_Codex_Mission_Roadmap.md:489](../EdNova_Complete_Codex_Mission_Roadmap.md:489) | CAPACITY-AWARE INFERENCE ROUTING AND DEGRADED OPERATION | PARTIAL — full view acceptance not established |
| M19 | ED-09 | [EdNova_Complete_Codex_Mission_Roadmap.md:505](../EdNova_Complete_Codex_Mission_Roadmap.md:505) | PEER-FIRST TEXT FACILITATOR | PARTIAL — full view acceptance not established |
| M20 | ED-11 | [EdNova_Complete_Codex_Mission_Roadmap.md:521](../EdNova_Complete_Codex_Mission_Roadmap.md:521) | PRIVATE FINAL CHECKS, SAFE DEBRIEF AND NEXT STEPS | PARTIAL — full view acceptance not established |
| M21 | ED-13 | [EdNova_Complete_Codex_Mission_Roadmap.md:537](../EdNova_Complete_Codex_Mission_Roadmap.md:537) | FINAL PRIVACY, SYNTHETIC DATA AND RETENTION GATE | PARTIAL — full view acceptance not established |
| M22 | ED-14 | [EdNova_Complete_Codex_Mission_Roadmap.md:553](../EdNova_Complete_Codex_Mission_Roadmap.md:553) | INTEGRATED P0 CHALLENGE ACCEPTANCE | PARTIAL — full view acceptance not established |
| M23 | ED-15 | [EdNova_Complete_Codex_Mission_Roadmap.md:569](../EdNova_Complete_Codex_Mission_Roadmap.md:569) | HACKATHON SUBMISSION AND BUSINESS ARTIFACTS | PARTIAL — full view acceptance not established |
| M24 | ED-16 | [EdNova_Complete_Codex_Mission_Roadmap.md:585](../EdNova_Complete_Codex_Mission_Roadmap.md:585) | LANGUAGE, RTL AND ACCESSIBILITY ACROSS DOMAINS | PARTIAL — full view acceptance not established |
| M25 | ED-17 | [EdNova_Complete_Codex_Mission_Roadmap.md:601](../EdNova_Complete_Codex_Mission_Roadmap.md:601) | LIVEKIT WEBRTC PEER AUDIO CONTROL/MEDIA | PARTIAL — full view acceptance not established |
| M26 | ED-18 | [EdNova_Complete_Codex_Mission_Roadmap.md:617](../EdNova_Complete_Codex_Mission_Roadmap.md:617) | RECIPIENT-ONLY ROOM HELP | PARTIAL — full view acceptance not established |
| M27 | ED-19 | [EdNova_Complete_Codex_Mission_Roadmap.md:633](../EdNova_Complete_Codex_Mission_Roadmap.md:633) | INSTRUCTOR COURSE-AGGREGATE INSIGHTS | PARTIAL — full view acceptance not established |
| M28 | ED-33 | [EdNova_Complete_Codex_Mission_Roadmap.md:649](../EdNova_Complete_Codex_Mission_Roadmap.md:649) | REWARD LEDGER AND EVIDENCE-GATED AWARDS | PARTIAL — full view acceptance not established |
| M29 | ED-34 | [EdNova_Complete_Codex_Mission_Roadmap.md:665](../EdNova_Complete_Codex_Mission_Roadmap.md:665) | EXPLAINABLE REWARD AND PROGRESS FEEDBACK | PARTIAL — full view acceptance not established |
| M30 | ED-31, ED-32 | [EdNova_Complete_Codex_Mission_Roadmap.md:681](../EdNova_Complete_Codex_Mission_Roadmap.md:681) | RICH STUDIO CUSTOMIZATION (P1) | PARTIAL — full view acceptance not established |
| M31 | ED-35 | [EdNova_Complete_Codex_Mission_Roadmap.md:697](../EdNova_Complete_Codex_Mission_Roadmap.md:697) | DETERMINISTIC EDUCATIONAL VISUALIZATION | PARTIAL — full view acceptance not established |
| M32 | ED-07 | [EdNova_Complete_Codex_Mission_Roadmap.md:713](../EdNova_Complete_Codex_Mission_Roadmap.md:713) | SYNCHRONIZED PDF/PAGE FOLLOWING (P1) | PARTIAL — full view acceptance not established |
| M33 | ED-20 | [EdNova_Complete_Codex_Mission_Roadmap.md:729](../EdNova_Complete_Codex_Mission_Roadmap.md:729) | SAFE VOLUNTEER PRODUCT FEEDBACK | PARTIAL — full view acceptance not established |
| M34 | ED-21 | [EdNova_Complete_Codex_Mission_Roadmap.md:745](../EdNova_Complete_Codex_Mission_Roadmap.md:745) | NO-UPLOAD OPEN-TOPIC LEARNING | PARTIAL — full view acceptance not established |
| M35 | ED-25 | [EdNova_Complete_Codex_Mission_Roadmap.md:761](../EdNova_Complete_Codex_Mission_Roadmap.md:761) | CONSENTED SPEECH-AWARE VOICE MODERATOR | PARTIAL — full view acceptance not established |
| M36 | ED-22 | [EdNova_Complete_Codex_Mission_Roadmap.md:777](../EdNova_Complete_Codex_Mission_Roadmap.md:777) | LEGACY RUNTIME/DEPENDENCY INVESTIGATION | PARTIAL — full view acceptance not established |
| M37 | ED-23 | [EdNova_Complete_Codex_Mission_Roadmap.md:793](../EdNova_Complete_Codex_Mission_Roadmap.md:793) | COMMERCIAL/SOCIAL SCOPE DECISION | PARTIAL — full view acceptance not established |
| M38 | ED-24 | [EdNova_Complete_Codex_Mission_Roadmap.md:809](../EdNova_Complete_Codex_Mission_Roadmap.md:809) | PILOT-BACKED INSTITUTIONAL EXPANSION | PARTIAL — full view acceptance not established |
| Contract 01 | ED-06 | [docs/contracts/technical-contracts.md:40](../docs/contracts/technical-contracts.md:40) | Course Ingestion Job | PARTIAL — full view acceptance not established |
| Contract 02 | ED-06, ED-30 | [docs/contracts/technical-contracts.md:77](../docs/contracts/technical-contracts.md:77) | Course Extraction Result | PARTIAL — full view acceptance not established |
| Contract 03 | ED-04, ED-05, ED-06, ED-30 | [docs/contracts/technical-contracts.md:133](../docs/contracts/technical-contracts.md:133) | Published Course Context | PARTIAL — full view acceptance not established |
| Contract 04 | ED-27, ED-28, ED-32 | [docs/contracts/technical-contracts.md:173](../docs/contracts/technical-contracts.md:173) | Public Learning Activity Definition | PARTIAL — full view acceptance not established |
| Contract 05 | ED-29 | [docs/contracts/technical-contracts.md:212](../docs/contracts/technical-contracts.md:212) | Activity Interaction & Private Submission | PARTIAL — full view acceptance not established |
| Contract 06 | ED-08, ED-29 | [docs/contracts/technical-contracts.md:238](../docs/contracts/technical-contracts.md:238) | Assessment Result | PARTIAL — full view acceptance not established |
| Contract 07 | ED-29, ED-33 | [docs/contracts/technical-contracts.md:269](../docs/contracts/technical-contracts.md:269) | Learning Evidence Record | PARTIAL — full view acceptance not established |
| Contract 08 | ED-08, ED-34 | [docs/contracts/technical-contracts.md:302](../docs/contracts/technical-contracts.md:302) | Competency State Update | PARTIAL — full view acceptance not established |
| Contract 09 | ED-33, ED-34 | [docs/contracts/technical-contracts.md:327](../docs/contracts/technical-contracts.md:327) | XP & Gamification Event | PARTIAL — full view acceptance not established |
| Contract 10 | ED-07 | [docs/contracts/technical-contracts.md:353](../docs/contracts/technical-contracts.md:353) | Study Room Lifecycle (Create/Join/Leave) | PARTIAL — full view acceptance not established |
| Contract 11 | ED-17 | [docs/contracts/technical-contracts.md:416](../docs/contracts/technical-contracts.md:416) | LiveKit Access Token Issuance | PARTIAL — full view acceptance not established |
| Contract 12 | ED-25 | [docs/contracts/technical-contracts.md:441](../docs/contracts/technical-contracts.md:441) | AI Moderator Dispatch | PARTIAL — full view acceptance not established |
| Contract 13 | ED-07 | [docs/contracts/technical-contracts.md:470](../docs/contracts/technical-contracts.md:470) | Study Room State Synchronization | PARTIAL — full view acceptance not established |
| Contract 14 | ED-09, ED-25 | [docs/contracts/technical-contracts.md:565](../docs/contracts/technical-contracts.md:565) | Facilitator Observation Input | PARTIAL — full view acceptance not established |
| Contract 15 | ED-09 | [docs/contracts/technical-contracts.md:592](../docs/contracts/technical-contracts.md:592) | Facilitator Intervention Proposal | PARTIAL — full view acceptance not established |
| Contract 16 | ED-07, ED-09 | [docs/contracts/technical-contracts.md:632](../docs/contracts/technical-contracts.md:632) | AI-to-UI Room Command | PARTIAL — full view acceptance not established |
| Contract 17 | ED-11 | [docs/contracts/technical-contracts.md:652](../docs/contracts/technical-contracts.md:652) | Collaborative Group Debrief | PARTIAL — full view acceptance not established |
| Contract 18 | ED-18 | [docs/contracts/technical-contracts.md:679](../docs/contracts/technical-contracts.md:679) | Room-Private Tutor Request | PARTIAL — full view acceptance not established |

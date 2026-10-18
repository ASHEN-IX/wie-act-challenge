# EdNova v1.2 implementation backlog — canonical

As of 18 October 2026; aligned to [brief v1.2 §§39–43](reference/ednova-brief-v1.2.md). EdNova feature acceptance remains incomplete; subsequent repository preparation rebuilt the frontend foundation and repaired startup/auth fixtures. See [preparation results](audit/cleanup.md). No parent task is DONE without its full acceptance gate. **DONE** requires source/test/document evidence matching its acceptance; **PARTIAL** has reusable implementation but target acceptance is unmet; **TODO** has no completed target implementation; **BLOCKED** awaits an external prerequisite. P0 is the team's hackathon boundary, not a claim every feature is mandated by organizers. Complexity S/M/L is relative effort, not a delivery-time promise.

The [audit](audit/ednova-audit.md) classifies retained subsystems, [product](product-specification.md) owns feature contracts, [testing](testing-plan.md) owns validation scenarios, and [delivery](hackathon-delivery.md) owns organizer rules. Historical MindFlow tasks/checkmarks moved to [legacy backlog](sprint-backlog.md); they are not completion evidence for EdNova.

## Order and critical dependencies

1. ED-01 baseline and ED-02 isolation first; ED-03 organizer service confirmation can proceed alongside them.
2. ED-04 membership -> ED-06 scoped materials -> ED-05 publish/join -> ED-10 grounded retrieval -> ED-08 individual loop.
3. ED-26 shared contracts first; ED-30/31/32 add editable Course Studio to ED-05/06. ED-27 renderer + ED-28 selector + ED-29 attempts/evidence provide the two P0 interactive types.
4. ED-07 shared activity synchronization -> ED-12 capacity behavior and ED-09 peer facilitation -> ED-11 private checks/debrief. ED-13 privacy review spans each step.
5. ED-14 integrated challenge tests -> ED-15 artifacts. Start writing report/demo script early; final evidence follows successful validation.
6. Only then ED-16–ED-20, ED-33/34 evidence-based gamification, ED-35 visualizations and rich ED-31/32 customization P1. Full synchronized PDF page viewer is P1; shared exercise/context/source pointer stays P0. ED-21/ED-25 are optional P2; ED-22–ED-24 are post-hackathon.

Ownership: **Habib = Course Studio + Content + Access**, **Tasnim = Individual Learning + Progress**, **Aziz = Study Together + Collaboration**. Every member owns their module frontend, backend, data, AI workflows/prompts, security and tests. No separate AI role. Tasnim stewards shared model transport only; Habib/Aziz own their domain AI. See [team delivery plan](team-delivery-plan.md) for contracts, shared-symbol edit windows and coordinator work packages. Named ownership is confirmed; dates/capacity are unspecified.

No room, model or publication feature is DONE merely because reusable code is present. ED-03 being BLOCKED does not prevent source audit or other local preparation.

## Technical reading conventions

All execution notes below are **TARGET recommendations, not changes performed**. Existing code references use repository-root aliases: `API/` = `study-partner-api/`, `WEB/` = `study-partner-web/`, `AI/` = `study-partner-ai/`. References were refreshed after the native frontend rebuild. They identify current extension anchors, not proof the old voice/interactive/reward UX was preserved; a new logical operation does not imply an endpoint/model already exists. Keep existing domain/validation patterns; exact proposed interfaces and architecture decisions are in [target architecture](target-architecture.md).

## Task index

| ID | Module owner | Priority | Status | Complexity | Title |
|---|---|---|---|---|---|
| ED-01 | Habib | P0 | PARTIAL | L | Repair and revalidate baseline |
| ED-02 | Habib | P0 | PARTIAL | L | Close resource and transport isolation gaps |
| ED-03 | Tasnim | P0 | BLOCKED | M | Confirm and connect organizer inference service |
| ED-04 | Habib | P0 | TODO | L | Minimal institutional membership and access contexts |
| ED-05 | Habib | P0 | PARTIAL | L | Instructor versioned draft/review/publication flow |
| ED-06 | Habib | P0 | PARTIAL | L | Unify scoped material ingestion and provenance |
| ED-07 | Aziz | P0 | PARTIAL | L | Reuse team sessions for synchronized learning rooms |
| ED-08 | Tasnim | P0 | PARTIAL | M | Diagnostic and individual guided practice |
| ED-09 | Aziz | P0 | TODO | L | Explicit peer-first facilitator policy |
| ED-10 | Tasnim | P0 | PARTIAL | M | Course-grounded tutor and verification |
| ED-11 | Aziz | P0 | PARTIAL | M | Private checks, group debrief and next steps |
| ED-12 | Tasnim | P0 | PARTIAL | L | Capacity-aware routing and degraded operation |
| ED-13 | Habib | P0 | PARTIAL | M | Challenge-safe synthetic data and privacy policy |
| ED-14 | Aziz | P0 | TODO | L | Execute end-to-end challenge evaluation |
| ED-15 | Aziz | P0 | TODO | M | Prepare submission and business artifacts |
| ED-16 | Tasnim | P1 | PARTIAL | M | Improve multilingual and accessible learning UX |
| ED-17 | Aziz | P1 | PARTIAL | M | Validate optional live peer voice |
| ED-18 | Aziz | P1 | TODO | M | Recipient-only private room help |
| ED-19 | Habib | P1 | TODO | M | Minimal instructor aggregate insight |
| ED-20 | Aziz | P1 | TODO | S | Collect safe real-user feedback |
| ED-21 | Tasnim | P2 | PARTIAL | M | Open-topic and lightweight learning extensions |
| ED-22 | Habib | Post-hackathon | TODO | M | Investigate legacy variants and heavy dependencies |
| ED-23 | Habib | Post-hackathon | TODO | L | Decide legacy commercial/social scope |
| ED-24 | Habib | Post-hackathon | TODO | L | Institutional product expansion |
| ED-25 | Aziz | P2 | TODO | L | Explore consented speech-aware assistance |
| ED-DOC | Aziz | P0 | DONE | M | Audit and realign documentation |
| ED-26 | Habib | P0 | TODO | M | Freeze versioned cross-member activity/content/evidence contracts |
| ED-27 | Tasnim | P0 | PARTIAL | L | Trusted quiz/guided-problem renderer and learner flow |
| ED-28 | Tasnim | P0 | PARTIAL | M | AI intent-to-activity selection and safe output validation |
| ED-29 | Tasnim | P0 | PARTIAL | L | Private activity attempts, assessment and accepted evidence |
| ED-30 | Habib | P0 | PARTIAL | L | Course Studio draft hierarchy and provenance API |
| ED-31 | Habib | P0 minimum / P1 rich controls | TODO | L | Course Studio editor, preview and approval UI |
| ED-32 | Habib | P0 grounding / P1 rich generation | PARTIAL | M | Source-backed Studio activity proposals and customization |
| ED-33 | Tasnim | P1 | PARTIAL | L | Evidence-based XP, levels and achievement awards |
| ED-34 | Tasnim | P1 | PARTIAL | S | Explainable XP/level/achievement learner feedback |
| ED-35 | Tasnim | P1 | TODO | M | One deterministic educational visualization extension |

## ED-01 — Repair and revalidate baseline

- **Accountable member / relevant roles:** Habib / All / platform operator. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** All retained foundations. Repair and revalidate baseline.
- **Existing implementation:** Preparation repaired Nest route normalization and shared exports; production builds, full root tests and native browser flows pass. API strict typing/lint and full Python/Docker/model readiness remain open; see [latest results](audit/cleanup.md).
- **Required changes:** Keep the repaired build/route/auth/lease fixtures and corrected Poetry CI covered; resolve remaining API strict test typing/lint findings and Python Docker/dependency parity without weakening checks. Habib coordinates; each owner repairs their module UI/API/Python. Tasnim stewards shared inference configuration; Aziz coordinates integrated browser checks.
- **Dependencies:** None.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** API/web production builds, lint/typecheck and required unit/integration/auth/browser suites pass; skips and Python install policy explicit.
- **Validation approach:** Run documented full checks, compare route/auth behavior; record versions, exits and skips.

### ED-01 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/scripts/generate-http-contracts.ts; API/src/framework/parameter.pipe.ts; API/shared/betterAuth.ts; API/tsconfig.check.json; API/modules/study/src/services/competencyUpdater.ts; WEB/next.config.mjs.
- **Implementation sequence:** Preparation already completed the route/export repair and competency/coach fixtures; native browser launch is verified. Preserve those regressions. Remaining work is strict API typing/lint, pinned full Python/Docker validation and CI execution. The original repair rationale follows for maintainers: 1. Habib traces the generated Nest route with inline planId regex: generate a supported public Nest path while preserving the original operation key and parameter validation; do not patch only generated output. 2. Trace the failing Next import graph to mixed CommonJS/ESM shared exports and make the narrow compatible correction; avoid a repository-wide module migration. 3. Tasnim reconciles lease-aware competency mocks, replay states and coach entitlement fixtures with intended authorization; do not loosen guards to satisfy stale assertions. 4. Aziz repairs room/browser startup fixtures in his module. Re-run strict checks separately from the shell-only build.
- **Interface/data/architecture choices:** Baseline contract: route/path/identity/error compatibility. API build currently checks src while strict checking includes modules/shared/tests; both gates are required. No feature task may hide a failure with skipped/relaxed checks.
- **Failure checks, handoff and review:** Test valid/invalid plan IDs, authorized/unauthorized coach calls, processed vs in-flight vs expired lease and Next server-page collection. Hand off a clean-start command and exact results to Tasnim/Aziz; unchanged pre-existing failures stay explicit. Review: all three for their import/route consumers.

## ED-02 — Close resource and transport isolation gaps

- **Accountable member / relevant roles:** Habib / All. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F01, F04, F09, F19. Close resource and transport isolation gaps.
- **Existing implementation:** Owner course download and AI policy; WS membership checks; HTTP chat/voice and team course lookup gaps.
- **Required changes:** Habib owns course/account/source checks; Tasnim owns private learning/evidence checks; Aziz owns HTTP chat/history/voice/team resource checks and their UI handling; verify static upload bypass, current-member broadcasts/revocation and course/invite/cache isolation.
- **Dependencies:** ED-01.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Cross-user course summaries/files/chat/voice denied before lookup/inference; revoked users receive no further scoped data; existing legitimate team flow works.
- **Validation approach:** API negative access matrix plus two-browser revocation, guessed IDs and alternate download paths.

### ED-02 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/shared/operationPolicy.ts; API/src/framework/bootstrap.ts; API/modules/study/src/routes/courses.ts; API/modules/study/src/routes/teamSessions.ts; API/modules/notification/src/routes/chat.ts; API/modules/notification/src/routes/voice.ts; API/modules/notification/src/realtime.ts.
- **Implementation sequence:** 1. Habib centralizes course/source authorization from authenticated identity plus personal ownership or active enrollment; inspect static upload paths as well as scoped file endpoint. 2. Tasnim applies the same source decision before tutor retrieval/attempt lookup/cache delivery. 3. Aziz checks room membership for HTTP history/voice and incoming AND outgoing WS delivery, including after revocation. 4. Verify team source lookup cannot copy foreign course summaries before authorization.
- **Interface/data/architecture choices:** Authorize resource before loading content or inference. A room invite grants room entry only; it cannot grant official course enrollment. An administrative identity is not default permission to read private learning content. Preserve unrelated public avatar/static behavior when closing private-file bypasses.
- **Failure checks, handoff and review:** Run cross-owner, enrolled/unenrolled, left-member, guessed-ID, direct-file/static URL and cached-result tests. Hand off shared source-access function/result semantics to Tasnim/Aziz. Review: each consumer owner; Habib coordinates closure.

## ED-03 — Confirm and connect organizer inference service

- **Accountable member / relevant roles:** Tasnim / All learners / operator. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F17. Confirm and connect organizer inference service.
- **Existing implementation:** LiteLLM provider aliases and private AI HTTP key boundary; no verified organizer credentials/category mapping.
- **Required changes:** Obtain approved endpoint/model IDs/format, quotas/retry guidance; map compact/capable operations; declare external services; ensure demo uses real requests without quota bypass.
- **Dependencies:** Organizer access details; ED-01.
- **Priority / complexity / status:** P0 / M / **BLOCKED**.
- **Acceptance criteria:** One compact and one capable real call through approved service have redacted provenance; no silent mock success; known limits documented.
- **Validation approach:** Controlled synthetic requests, category/provider trace and organizer rule review; no real learner records.

### ED-03 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/utils/llm_client.py; AI/litellm/config.yaml; API/shared/aiClient.ts; API/shared/ai-messaging/envelope.ts.
- **Implementation sequence:** 1. Tasnim records organizer endpoint, auth format, compact/capable model IDs, non-streaming shape, quotas, Retry-After guidance and approved external-service declarations. 2. Adapt existing provider boundary in one place; preserve server-only credentials. 3. Prove one real compact and capable operation with sanitized traces. 4. Habib and Aziz add their own operation mappings and source-safe real-call examples.
- **Interface/data/architecture choices:** Keep business operations separate from provider deployment names. LLM_MOCK=0 does not force real inference in the current client; missing recognized keys may still mock. The approved-service adapter must make real/mock/unavailable status unambiguous, without extra-account/provider quota bypass.
- **Failure checks, handoff and review:** Validate absent/invalid key, timeout, 429, malformed response and category mapping. No model call is considered compliant until approved access is confirmed. Hand off one documented adapter and sample response to Habib/Aziz; they own their prompts/fallback.

## ED-04 — Minimal institutional membership and access contexts

- **Accountable member / relevant roles:** Habib / University admin, instructor, learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F01–F02. Minimal institutional membership and access contexts.
- **Existing implementation:** Better Auth student/admin and personal ownership; teacher UI helper is not enforcement.
- **Required changes:** Implement one institution demo, scoped memberships, instructor assignment and learner enrollment/invitations while reusing one identity and personal workspace.
- **Dependencies:** ED-01, ED-02.
- **Priority / complexity / status:** P0 / L / **TODO**.
- **Acceptance criteria:** Two institutional scopes and personal mode isolated; course invite cannot grant instructor/global admin; revoke tested.
- **Validation approach:** Role/membership matrix API tests and synthetic instructor/student browser flow.

### ED-04 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/shared/betterAuth.ts; API/shared/auth.ts; API/modules/auth/src/models/User.ts; API/modules/study/src/routes/courses.ts; WEB/src/server/identity.ts; WEB/src/server/identity.ts.
- **Implementation sequence:** 1. Habib keeps one account/session identity and adds minimal scoped institution memberships and course enrollments in the existing persistence style. 2. Implement one fictional institution, assigned instructor and learner invitation acceptance. 3. Build matching course-context/onboarding/admin controls and server enforcement. 4. Treat frontend teacher helpers as presentation only; validate privileges on the server.
- **Interface/data/architecture choices:** Proposed membership: actor/institution/scoped role/status; enrollment: course/actor/status/invitation reference. Global student/admin identity remains compatible. Invitation expiry/revocation and role assignment are server-owned; course code cannot grant instructor/global admin.
- **Failure checks, handoff and review:** Test mixed personal/institution contexts, two institutions, invitation expiry/replay and removal of enrollment while a session is active. Hand off authorized course-context lookup to Tasnim/Aziz. Reviewer: both consumers.

## ED-05 — Instructor versioned draft/review/publication flow

- **Accountable member / relevant roles:** Habib / Instructor, university student. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F02–F03. Instructor versioned draft/review/publication flow.
- **Existing implementation:** Personal Course/files/objectives and ingest status.
- **Required changes:** Deliver publication UI and API in the same Habib-owned Course Studio module: adapt course ownership and approve/publish a reviewed immutable revision from ED-30/31; pin sources/activities and enroll demo students; distinguish processing, review and publication. Reuse ED-06 extraction; do not build a second ingest engine.
- **Dependencies:** ED-04, ED-06, ED-26, ED-30.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Assigned instructor publishes own course; enrolled learner sees approved source; failed replacement leaves published version intact.
- **Validation approach:** Browser upload/preview/publish/join test and cross-instructor denial.

### ED-05 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/study/src/models/index.ts; API/modules/study/src/routes/courses.ts; WEB/src/features/courses/upload-form.tsx; WEB/src/features/courses/course-list.tsx.
- **Implementation sequence:** 1. Habib separates ingestion status from editorial draft/review/publication. 2. Prepare immutable source/activity revision references and validate required review flags. 3. Publish through a conditional update of the active revision pointer using expected draft version. 4. Keep old published content readable if generation or revision preparation fails. 5. Build preview/approve/publish UI as the same module task.
- **Interface/data/architecture choices:** Create/validate candidate artifacts before switching the published pointer; never expose partially prepared content. Published revision and rubric/activity references stay pinned for active attempts. Use existing Mongo update patterns; do not silently require a new transactional deployment.
- **Failure checks, handoff and review:** Test duplicate publish, stale editor, unauthorized instructor, failed re-ingest, active old attempt and unpublished learner access. Hand off pinned approved context to Tasnim and Aziz; consume Tasnim renderer for interactive preview after basic source preview works.

## ED-06 — Unify scoped material ingestion and provenance

- **Accountable member / relevant roles:** Habib / Instructor, independent learner. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F03–F04, F06, F11. Unify scoped material ingestion and provenance.
- **Existing implementation:** PDF/text upload guards, ingest worker, progress, chunks/embeddings, Node aiCourseId link.
- **Required changes:** Retain original files and extraction provenance/page references (or explicitly unknown); emit editable chapter/section/topic draft with ambiguity flags and consistent Node/Python/index source IDs. Habib owns course/source authorization and ingestion AI together. Recover failures without publishing private files. Habib owns extraction prompts, OCR/indexing and ingestion worker as part of Course Studio, not as a separate AI handoff.
- **Dependencies:** ED-02, ED-04 for institutional scope.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Personal private by default; authorized official and explicitly shared material resolves consistently; no stale/private cached source escapes.
- **Validation approach:** Upload type/size/parser failure, retrieval/download ACL tests, index/source parity and retry progress.

### ED-06 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/study/src/services/ingestionJob.ts; API/modules/study/src/services/ingestStatus.ts; AI/agents/course_ingestion/agent.py; AI/workers/ingestion_worker.py; AI/services/vector_store/adapter.py.
- **Implementation sequence:** 1. Habib traces Node courseId -> aiCourseId -> source file -> chunks/index through existing jobs. 2. Preserve original file hash, stable section/chunk/source IDs and page locations where extraction supports them; mark unknown honestly. 3. Parse deterministically first; use OCR only on supported scanned inputs with bounded processing. 4. AI hierarchy/objective enrichment produces reviewable draft labels, not approved material. 5. Index each source revision once and report recoverable progress/errors.
- **Interface/data/architecture choices:** Keep one versioned source manifest across Node/Python/retrieval, including provenance extracted/AI-generated/manual and ambiguity flags. Cache/index keys include source revision and authorization scope; do not re-embed on every tutoring prompt. Existing 25 MB upload cap is not a claim arbitrary PDFs are feasible.
- **Failure checks, handoff and review:** Test small text PDF, image-only/encrypted/oversize file, parser timeout, missing shared upload path, worker retry and duplicate result. Hand off a small synthetic source manifest, hierarchy and retrieval-reference fixture to Tasnim/Aziz. Reviewer: Tasnim source/query compatibility.

## ED-07 — Reuse team sessions for synchronized learning rooms

- **Accountable member / relevant roles:** Aziz / Both learner contexts. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F09, F11. Reuse team sessions for synchronized learning rooms.
- **Existing implementation:** Team invite codes, max 4, participants/taskProgress and WS signaling/search chat.
- **Required changes:** Aziz delivers room UI/hooks, API/WS handlers, persistence and tests together. Add peer text, selected versioned activity/context/source pointer, presenter authority, sequence numbers and replay/reconnect semantics; retain transport independent of AI. Per-user answers stay private; synchronized PDF viewer/page-following is P1, not required for P0.
- **Dependencies:** ED-02, ED-06, ED-26, ED-27, ED-29.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** 2–4 browsers agree on public messages/presence/activity/problem; presenter alone changes shared view; duplicate/reconnect loses no accepted work; no private attempt/answer key leaks. Full page-following checked only in P1.
- **Validation approach:** Multi-browser integration, sequencing/idempotency, lost-network reconnect and unauthorized join tests.

### ED-07 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/study/src/routes/teamSessions.ts; API/modules/notification/src/realtime.ts; API/modules/notification/src/models/SessionChat.ts; WEB/src/features/collaboration/actions.ts; WEB/src/features/collaboration/realtime-status.tsx; WEB/src/features/learning/session-actions.ts.
- **Implementation sequence:** 1. Aziz reuses team invite/participant lifecycle with explicit source and activity revision refs. 2. Add public peer contributions and persisted authoritative room snapshot/version. 3. Presenter commands use expected sequence; server authorizes and ACKs accepted events before broadcast. 4. Reconnect reloads latest snapshot and acknowledged position. 5. Embed Tasnim renderer; send each private answer directly to Tasnim attempt API, never group broadcast.
- **Interface/data/architecture choices:** Proposed public state: room/members/presenter/activity revision/phase/view sequence/public messages. Separate idempotent command ID from monotonic room version. P0 is one shared exercise/context and source pointer; full PDF-following P1. No CRDT, collaborative arbitrary editing or new broker required.
- **Failure checks, handoff and review:** Test 2–4 browsers, duplicated/out-of-order command, presenter handoff, revocation, tab closure and reconnect. Hand off authoritative source/activity/view subset to Aziz facilitator task ED-09; consume Habib ACL and Tasnim renderer contracts. Review: both boundary owners.

## ED-08 — Diagnostic and individual guided practice

- **Accountable member / relevant roles:** Tasnim / Both learner contexts. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F06–F07, F18. Diagnostic and individual guided practice.
- **Existing implementation:** Individual Socratic evaluator, scoring, schemas and results.
- **Required changes:** Add 2–4 initial checks, adjustable language/detail, provisional level and graduated hints integrated with selected course/objective/revision and shared ActivityAttempt evidence. Reuse evaluator; Tasnim owns individual UI/API/AI/evidence; Habib supplies authorized source context; Aziz invokes the shared learning contract from rooms.
- **Dependencies:** ED-03, ED-06, ED-10, ED-28.
- **Priority / complexity / status:** P0 / M / **PARTIAL**.
- **Acceptance criteria:** Beginner/advanced synthetic responses adapt tasks; hint precedes answer, full explanation on request; no unsupported mastery labels.
- **Validation approach:** Fixed source-backed question/answer cases and browser diagnostic-to-feedback flow.

### ED-08 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/evaluator/agent.py; AI/agents/evaluator/state_machine.py; AI/agents/evaluator/scoring.py; AI/workers/evaluator_worker.py; WEB/src/features/learning/job-form.tsx.
- **Implementation sequence:** 1. Tasnim selects 2–4 source-backed diagnostic items for one objective and records unanswered separately from wrong. 2. Ask adjustable language/detail preference; infer only provisional difficulty from actual attempts. 3. Reuse Socratic question/hint transitions with explicit reveal policy and server rubric. 4. Tie results to canonical activity/attempt/revision, then return private feedback and next-check candidate.
- **Interface/data/architecture choices:** Diagnostic result carries evidence references/count, tentative starting level, weak/untested concepts and uncertainty, not a fixed psychological learner type. Model score is a candidate; accepted evidence/competency writes occur in Node after version/actor/output validation.
- **Failure checks, handoff and review:** Test beginner/advanced/untested and corrected second attempt, valid full-answer request, invalid rubric/output and unavailable model. Hand off a private-check operation to Aziz with recipient-only results and safe completion signal. Reviewer: Aziz on group integration, Habib on source provenance.

## ED-09 — Explicit peer-first facilitator policy

- **Accountable member / relevant roles:** Aziz / Group learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F12, F14. Explicit peer-first facilitator policy.
- **Existing implementation:** Coach rules, evaluator patterns; no group facilitator.
- **Required changes:** Implement bounded room state and Socratic/Group Challenge presets; explicit ask/hint/check/finish controls; candidate misconceptions and voluntary inclusive prompts. Aziz owns facilitator UI/API/Python prompts, state and validation; reuse Tasnim activity/evaluation service and shared transport.
- **Dependencies:** ED-07, ED-08, ED-10, ED-12.
- **Priority / complexity / status:** P0 / L / **TODO**.
- **Acceptance criteria:** Peers reason before full answer; known misconception receives supported intervention; quiet learner may decline; group context bounded.
- **Validation approach:** Scripted three-learner scenario, invalid transition/output rejection, participation decline and disagreement cases.

### ED-09 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/notification/src/realtime.ts; AI/agents/coach/rules/rule_engine.py; AI/agents/evaluator/validation.py; AI/workers/base.py; WEB/src/features/learning/session-actions.ts.
- **Implementation sequence:** 1. Aziz adds facilitator operation handlers/prompts in the existing AI service, reusing validation/worker primitives rather than cloning individual evaluator. 2. Model room phases explicitly: check-in/challenge/peer explanation/critique/hint-or-verify/private check/debrief. 3. Trigger on explicit ask/hint/check/finish and checkpoints; do not answer every public message. 4. Track candidate misconception/uncertainty and invite peers before revealing. 5. Validate state version/source/recipient before persisting intervention or phase transition.
- **Interface/data/architecture choices:** AI action enum, bounded public context, source refs and expected room version are server controlled. Compact may classify/summarize; complex correction uses capable model or vetted key. Silent participant can decline; message counts are not ability scores. Room AI sees typed/public actions, not unimplemented speech monitoring.
- **Failure checks, handoff and review:** Test known misconception, supported/unsupported correction, participant decline, duplicate AI result and phase changed while inference runs. Hand off private-check request to Tasnim; keep public recap separate. Reviewer: Tasnim pedagogical rubric and Habib source boundaries.

## ED-10 — Course-grounded tutor and verification

- **Accountable member / relevant roles:** Tasnim / Both learner contexts. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F06, F14. Course-grounded tutor and verification.
- **Existing implementation:** Planner FAISS/course chunks, web-source synthesis, evaluator feedback.
- **Required changes:** Reuse retrieval for authorized selected source; preserve section/version references; reject invented citations and source instructions; distinguish no-evidence cases.
- **Dependencies:** ED-03, ED-06.
- **Priority / complexity / status:** P0 / M / **PARTIAL**.
- **Acceptance criteria:** Known question cites correct allowed passage; unsupported correction is tentative/pending; no source-access decision is delegated to model.
- **Validation approach:** Answer-key and citation/source-ID checks; adversarial document and insufficient-evidence cases.

### ED-10 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/planner/rag/retriever.py; AI/agents/planner/rag/index_store.py; AI/services/vector_store/adapter.py; AI/agents/search/agent.py; API/modules/ai-orchestrator/src/services/objectiveContext.ts.
- **Implementation sequence:** 1. Tasnim resolves Habib authorized source/revision context before retrieval. 2. Reuse indexed chunks with metadata/source refs rather than unscoped web results as course truth. 3. Assemble bounded passages plus objective/learner need in untrusted blocks. 4. Validate every returned citation against the retrieved manifest; mark unsupported claims tentative. 5. Use same grounded helper in tutor/evaluator and expose safe operation for Aziz complex checks.
- **Interface/data/architecture choices:** One index/source mapping, no second vector database. Content authorization is code-side, never inferred from prompts. A real source excerpt does not imply a correct AI interpretation; distinguish citation correctness from answer-key correctness.
- **Failure checks, handoff and review:** Test foreign/private source, stale revision/cache, malicious embedded instructions, no relevant passage and fabricated citation. Hand off retrieved source refs/uncertainty semantics to Habib preview and Aziz facilitator; do not expose raw private attempt context.

## ED-11 — Private checks, group debrief and next steps

- **Accountable member / relevant roles:** Aziz / Both learner contexts. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F08, F15. Private checks, group debrief and next steps.
- **Existing implementation:** EvalResult, competency evidence, session summary/completion, planner/reviews.
- **Required changes:** Deliver room completion/debrief UI/API/AI and persistence; request Tasnim-owned private final checks and consume permitted ED-29 completion signals; Tasnim retains individual evidence/status/next-step delivery; public recap excludes private questions/results; idempotent completion emits optional ED-33 award candidate once, never model-selected XP. Aziz owns room completion/debrief AI/UI/API; Tasnim owns private check/evidence/next-step subpackage under ED-08/29. No duplicate individual evaluator.
- **Dependencies:** ED-08, ED-09, ED-29.
- **Priority / complexity / status:** P0 / M / **PARTIAL**.
- **Acceptance criteria:** Group outcome and each learner next step reproducible; no private leakage or double rewards; untested differs from incorrect.
- **Validation approach:** Three-browser completion and per-recipient history tests; duplicate result/retry and evidence quality review.

### ED-11 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/study/src/routes/coreSessions.ts; API/modules/study/src/services/competencyUpdater.ts; API/modules/ai-orchestrator/src/models/EvalResult.ts; WEB/src/features/learning/session-actions.ts.
- **Implementation sequence:** 1. Aziz requests recipient-only final checks through Tasnim attempt service. 2. Tasnim accepts individual evidence and produces own private next step. 3. Aziz uses public contributions plus permitted completion flags for a group recap, unresolved items and room completion state. 4. Mark group debrief pending/recoverable if summary inference fails; never block private evidence on public summarization. 5. Integrate optional reward candidate only through Tasnim accepted-evidence consumer.
- **Interface/data/architecture choices:** Keep two projections: group public observations and per-learner private outcome. Room creator/instructor cannot read private answers by requesting summary. Stable completion identity prevents duplicate room completion/rewards; observed improvement is not scientific mastery validation.
- **Failure checks, handoff and review:** Test one learner absent/pending, two completions, failed summary, duplicate callback/reconnect and requests by another participant. Hand off only accepted evidence references internally to Tasnim; review: Tasnim recipient/reward boundaries and Habib educator aggregate scope.

## ED-12 — Capacity-aware routing and degraded operation

- **Accountable member / relevant roles:** Tasnim / All learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F17, F19. Capacity-aware routing and degraded operation.
- **Existing implementation:** Non-streaming LLM calls, jobs/progress, bounded broker retries/DLQ, coach/planner fallbacks.
- **Required changes:** Add approved compact/capable decision trace, dedup/call/context budgets, bounded wait and explicit limited mode/deferral; preserve room independent of AI. Tasnim stewards shared transport/budget primitives and solo fallback; Habib owns extraction/Studio operation mapping/fallback, Aziz owns room/facilitator mapping/fallback. No dedicated AI implementer.
- **Dependencies:** ED-03, ED-07, ED-10.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Real requests use intended categories; 429/timeout/capable loss preserves chat/materials and safe completion; unresolved reasoning never certified.
- **Validation approach:** Inject controlled failure, observe real compact/rule fallback, measure category calls/latency/retries; duplicate/restart cases.

### ED-12 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/utils/llm_client.py; AI/litellm/config.yaml; AI/workers/base.py; API/shared/aiClient.ts; API/shared/ai-messaging/topology.ts; WEB/src/features/learning/job-form.tsx.
- **Implementation sequence:** 1. Tasnim documents operation-to-category mapping and one total inference budget across HTTP/client/router/worker layers. 2. Reuse async job status/polling for whole non-streamed responses; do not fake token streaming. 3. Classify timeout/429/unavailable vs terminal schema/auth errors; bound retries and obey service guidance. 4. Habib owns safe ingestion/Studio fallback; Tasnim owns tutor/evaluator fallback; Aziz owns room/facilitator fallback. 5. Scope dedup by actor/visibility/source revision/operation, not prompt text globally.
- **Interface/data/architecture choices:** Current transport retries safe GET once, while router and broker have their own policies; avoid multiplying attempts blindly. Complex unverified grading stays pending/no XP; simple vetted content/rules can continue. Record category/duration/retry/fallback without raw learner payloads.
- **Failure checks, handoff and review:** Test capable outage while chat/voice/resource access continue, duplicate request, exhausted budget, recovery and non-streamed slow result. Hand off one transport error/status contract, not ownership of every module AI operation. Review: Habib and Aziz fallback scenarios.

## ED-13 — Challenge-safe synthetic data and privacy policy

- **Accountable member / relevant roles:** Habib / All. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F01, F10, F19. Challenge-safe synthetic data and privacy policy.
- **Existing implementation:** Accounts contain names/emails, coach context/signals, prompt guards and log redaction.
- **Required changes:** Prepare synthetic aliases/materials/roster and demo entitlements; minimize provider payload/retention; exclude camera/training/recording paths from demo; document declarations and source sharing.
- **Dependencies:** ED-02, ED-03, ED-04.
- **Priority / complexity / status:** P0 / M / **PARTIAL**.
- **Acceptance criteria:** No credentials or real personal/private learner data reaches model/evidence; no stored voice; synthetic demo succeeds without requiring payment.
- **Validation approach:** Inspect redacted payloads/logs/cache/artifacts, access matrix and data provenance; no live production data manipulation.

### ED-13 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/shared/betterAuth.ts; API/shared/aiClient.ts; AI/security/prompt_guard.py; AI/utils/logger.py; API/modules/notification/src/realtime.ts.
- **Implementation sequence:** 1. Habib defines synthetic identities/course material and explicit source visibility/revocation for demo. 2. Tasnim minimizes tutor/assessment/model payloads and private cached evidence. 3. Aziz minimizes room/public/private-help contexts, excludes recordings and verifies outbound recipients. 4. Agree retention/redaction and deletion behavior before collecting new data; no cleanup of production data in this task. 5. Inspect report/video/config for keys or real identities.
- **Interface/data/architecture choices:** Service credentials stay server-side; browser cookies must not pass to providers. Published source approval does not approve private chat reuse. Demo uses public/fictional/synthetic/anonymized inputs only. Voice interpretation and opt-in speech remain organizer/policy decisions.
- **Failure checks, handoff and review:** Inspect negative source/recipient/cache/log cases plus synthetic demo artifacts; do not claim prompt delimiters alone enforce privacy. Hand off a reviewed privacy checklist and allowed-field examples to all module owners. Review: all three.

## ED-14 — Execute end-to-end challenge evaluation

- **Accountable member / relevant roles:** Aziz / All. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** All P0 features. Execute end-to-end challenge evaluation.
- **Existing implementation:** Legacy unit/contract/browser tests exist; none proves new facilitator flow.
- **Required changes:** Add/run source-backed scenarios for Studio correction/publication -> quiz/guided problem -> shared room -> private check -> next step; reject executable/invalid schemas; cover revision pins, failure recovery, isolation, categories and optional P1 XP replay. Habib owns Content/Access API+UI+browser tests; Tasnim owns Individual Learning/Progress UI+API+AI tests; Aziz owns Collaboration UI+API+AI tests and integrated run; Each owner owns module Python tests as well.
- **Dependencies:** ED-01 through ED-13; ED-26 through ED-32 for P0.
- **Priority / complexity / status:** P0 / L / **TODO**.
- **Acceptance criteria:** P0 scenario gates pass with actual outcomes, sample size and failures recorded; mocks clearly distinguished from real inference.
- **Validation approach:** Follow testing-plan.md; preserve reproducible commands, synthetic fixtures and redacted evidence.

### ED-14 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/tests/integration; API/tests/architecture; AI/tests; WEB/e2e; WEB/playwright.config.ts; docs/testing-plan.md.
- **Implementation sequence:** 1. Each owner runs unit/contract/API/Python/browser cases for their complete module. 2. Aziz runs one integrated Studio correction -> real activity -> room intervention -> private check -> debrief. 3. Inject stale version, forbidden actor, bad schema and capable timeout; assert real persisted effect and absence of leakage, not only a toast. 4. Separate live real-inference evidence from patched/stub contract tests. 5. Record failures/skips with exact prerequisites.
- **Interface/data/architecture choices:** Shared synthetic fixture versions and contract parity are the gate. Tests that purge/drop data target only isolated test DB/broker. Existing auth launcher failure and broker opt-in skips remain until fixed; no reclassification of skipped tests as successful coverage.
- **Failure checks, handoff and review:** Produce command/exit/version/scenario/expected/actual evidence and owner-routed defect list. Habib verifies content, Tasnim private evidence/model behavior, Aziz room/order/recovery. All review the final pass/fail gate before ED-15.

## ED-15 — Prepare submission and business artifacts

- **Accountable member / relevant roles:** Aziz / Team/operator. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** Delivery. Prepare submission and business artifacts.
- **Existing implementation:** README/config templates and audit docs; no completed report/video/pitch.
- **Required changes:** Write <=6-page technical report with business note, publish authorized repo/setup/GenAI explanation, Phase 1 demo, <=90s video and <=4min pitch by two presenters.
- **Dependencies:** ED-14; deadline/service/voice clarifications.
- **Priority / complexity / status:** P0 / M / **TODO**.
- **Acceptance criteria:** Artifacts meet exact organizer limits, contain honest test/inference evidence and declarations, and clean-start setup is reproducible.
- **Validation approach:** Page count, media duration, pitch rehearsal, credential scan and external-reader setup run.

### ED-15 technical execution notes — TARGET

- **Existing code to inspect/reuse:** README.md; docs/development.md; docs/hackathon-delivery.md; docs/audit/validation.md.
- **Implementation sequence:** 1. Aziz assembles report/video/pitch from each owner actual results; Habib contributes Studio/source controls and business adoption context, Tasnim learning/model/evidence results. 2. Reproduce setup from a clean local environment and redact keys/logs/screenshots. 3. Capture real workflow; edit latency honestly, with optional P1 features only if implemented. 4. Verify report <=6 pages, video <=90 seconds, pitch <=4 minutes, two presenters and 2-minute Q&A preparation. 5. Confirm printed 10 November year/time and final schedule with organizers.
- **Interface/data/architecture choices:** Submission is not deployment authorization. RAG, voice, XP and user feedback are described only if actually implemented/measured; mock artifacts cannot substitute real inference. Keep commercial hypotheses unvalidated until evidence exists.
- **Failure checks, handoff and review:** External-reader setup replay, document page/media duration checks, secrets review and rehearsal. Hand off one frozen demo build/evidence set; no optional feature merges during recording without rerunning its gates. Review: all three.

## ED-16 — Improve multilingual and accessible learning UX

- **Accountable member / relevant roles:** Tasnim / Both learner contexts. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F18. Improve multilingual and accessible learning UX.
- **Existing implementation:** Language preference and prompt paths; no verified multilingual efficacy.
- **Required changes:** Test English/French/Arabic/Darija including code-switching and levels; adapt controls/readability/keyboard use on main journey only. Tasnim coordinates language preferences/cases; Habib/Aziz implement localization and AI tests within their modules.
- **Dependencies:** ED-08, ED-09, ED-14.
- **Priority / complexity / status:** P1 / M / **PARTIAL**.
- **Acceptance criteria:** Recorded cases preserve formulas/source meaning; keyboard flow works; unsupported languages/weak outputs disclosed.
- **Validation approach:** Fixed multilingual rubric plus human source review and keyboard/mobile browser checks.

### ED-16 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/evaluator/prompts.py; AI/agents/evaluator/validation.py; WEB/src/features/learning/job-form.tsx; WEB/src/server/identity.ts.
- **Implementation sequence:** 1. Tasnim defines user-adjustable language/detail fields and fixed English/French/Arabic/Darija/code-switch fixtures at two levels. 2. Habib applies them to authoring/ingestion labels and prompts; Aziz to group/private-help prompts/UI. 3. Preserve code/formulas/technical terms and avoid stereotypes based on language. 4. Test keyboard/RTL/readability and disclose unsupported or low-quality outputs rather than invent efficacy.
- **Interface/data/architecture choices:** Language preference is not a separate identity or fixed ability score. Schema enums/source refs remain language-independent; instructions/feedback localized. Each owner implements UI/API/AI inside their module using the same field contract.
- **Failure checks, handoff and review:** Record human source correctness and learning-level rubric plus accessibility evidence; no invented accuracy percentages. Tasnim coordinates fixture set, Habib/Aziz verify module outputs. Review: both consumers.

## ED-17 — Validate optional live peer voice

- **Accountable member / relevant roles:** Aziz / Group learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F10. Validate optional live peer voice.
- **Existing implementation:** WebRTC/STUN, signaling/mute/speaking state, no proven TURN/SFU path.
- **Required changes:** Resolve organizer voice rule, consent and provider declaration; harden existing audio/NAT/reconnect rather than add AI listening.
- **Dependencies:** Organizer clarification; ED-02, ED-07, stable P0.
- **Priority / complexity / status:** P1 / M / **PARTIAL**.
- **Acceptance criteria:** Three browsers communicate while AI offline; denial/mute/device/reconnect/leave work; no recording/transcript.
- **Validation approach:** Real device/network/browser test matrix, media-track teardown and persistence inspection.

### ED-17 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/collaboration/realtime-status.tsx; WEB/src/features/collaboration/realtime-status.tsx; WEB/src/features/collaboration/realtime-status.tsx; API/modules/notification/src/routes/voice.ts; API/modules/notification/src/realtime.ts.
- **Implementation sequence:** 1. Aziz first verifies current peer media with real browsers and synthetic aliases. 2. Add explicit microphone permission/notice, join/mute/leave and track teardown, network/device error states. 3. Inspect ICE failures before choosing a permitted TURN/managed transport; do not assume a new SFU is required for 2–4 users. 4. Keep audio independent of queued facilitator requests; text always works. 5. Confirm organizer voice/privacy interpretation and external-service declaration.
- **Interface/data/architecture choices:** Voice signaling is room-member authorized; no recording/transcription by default. A nullable recordingUrl schema field does not establish recording functionality. Do not send audio to AI or claim spoken moderation without separately accepted ED-25.
- **Failure checks, handoff and review:** Three real devices/browser contexts, permission denial, mute/reconnect/tab close/device switch and AI offline. Inspect tracks/persistence for no stored audio. Reviewer: Habib access/privacy and Tasnim learning flow; owner remains Aziz for UI/API/media.

## ED-18 — Recipient-only private room help

- **Accountable member / relevant roles:** Aziz / Room participant. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F13. Recipient-only private room help.
- **Existing implementation:** Actor-scoped jobs/evaluator; no private room channel.
- **Required changes:** Deliver private-help controls/history UI and API/realtime checks together; add explicit private request/result scope, source checks and safe optional share action; keep group summaries/cache isolated.
- **Dependencies:** ED-09, ED-11, ED-13.
- **Priority / complexity / status:** P1 / M / **TODO**.
- **Acceptance criteria:** Only requester sees simplified explanation across events/history/reconnect; no educator/peer access.
- **Validation approach:** Multi-browser negative tests, cache/log/summary inspection and authorization replay.

### ED-18 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/notification/src/realtime.ts; API/modules/ai-orchestrator/src/routes/jobs.ts; WEB/src/features/collaboration/realtime-status.tsx; AI/services/api/main.py.
- **Implementation sequence:** 1. Aziz implements a distinct private-room-help UI/API/AI operation with recipient scope. 2. Fetch only requester-authorized source and allowed public room context; keep private help history separate. 3. Return scoped text/activity reference, reusing Tasnim renderer/individual attempt service. 4. Requester may deliberately share a safe excerpt; no automatic group-summary inclusion. 5. Reconnect/history/result delivery rechecks actor and current access.
- **Interface/data/architecture choices:** Private is an enforced audience, not a UI tab. Cache keys and AI result envelope include recipient/context/source version; group broadcaster never receives raw private output. Instructor/room creator has no default access.
- **Failure checks, handoff and review:** Two peers plus instructor try guessed history/job IDs and watch broadcasts/reconnect/summary. Public and private prompts injected adversarially must not cross. Review: Tasnim reusable activity/evidence interface, Habib source grant.

## ED-19 — Minimal instructor aggregate insight

- **Accountable member / relevant roles:** Habib / Instructor. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F16. Minimal instructor aggregate insight.
- **Existing implementation:** General analytics/evaluation collections; no instructor scope.
- **Required changes:** Habib builds instructor insight screen/API, consuming Tasnim private-learning and Aziz group safe aggregates; show owned-course practiced objectives/common gaps only; choose aggregation threshold and suppress identifying cohorts; no transcripts.
- **Dependencies:** ED-04, ED-11, ED-13.
- **Priority / complexity / status:** P1 / M / **TODO**.
- **Acceptance criteria:** Unauthorized instructor denied and small cohorts suppressed; aggregate does not expose private answers/files.
- **Validation approach:** Synthetic cohorts above/below threshold and inference/leakage review.

### ED-19 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/analytics/src/models/AnalyticsEvent.ts; API/modules/ai-orchestrator/src/models/EvalResult.ts; WEB/src/features/tasks/task-list.tsx.
- **Implementation sequence:** 1. Habib defines owned-course objective participation/gap aggregates and a minimum-cohort suppression policy. 2. Consume Tasnim accepted evidence and Aziz safe group outcomes through explicit projections, not raw private transcripts. 3. Implement aggregate endpoint and instructor screen together. 4. AI summary, if used, receives only permitted aggregates and states uncertainty; deterministic counts remain source of truth.
- **Interface/data/architecture choices:** Proposed projection: approved course/revision/objective, cohort count, practiced/needs-follow-up counts and suppression flag; no individual answer, private question or small-group identity inference. Aggregation threshold is a team policy decision, not an invented organizer rule.
- **Failure checks, handoff and review:** Test foreign instructor, sparse cohort, revoked assignment and attempted drill-down into a private attempt. Review: Tasnim and Aziz allowed projection. Habib owns both API and view; no default access to private evidence.

## ED-20 — Collect safe real-user feedback

- **Accountable member / relevant roles:** Aziz / Test learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** Bonus validation. Collect safe real-user feedback.
- **Existing implementation:** No claimed empirical results.
- **Required changes:** Run optional 5–10 volunteer sessions with fictional identities/synthetic content; collect useful/irrelevant intervention and task completion observations without private data.
- **Dependencies:** Stable P0, ED-13, ED-14.
- **Priority / complexity / status:** P1 / S / **TODO**.
- **Acceptance criteria:** Actual anonymous observation counts and limits recorded; no causal mastery/traction claim.
- **Validation approach:** Facilitated usability sessions, anonymous qualitative rubric and evidence review.

### ED-20 technical execution notes — TARGET

- **Existing code to inspect/reuse:** docs/testing-plan.md; docs/hackathon-delivery.md; WEB/e2e.
- **Implementation sequence:** 1. Aziz recruits optional volunteers only when stable P0 exists and uses fictional accounts/synthetic material. 2. Habib observes authoring/source clarity, Tasnim hints/checks, Aziz group participation/recovery. 3. Capture anonymous task completion and useful/disruptive intervention notes, not identities/recordings. 4. Feed defects into existing task IDs rather than a competing feature backlog.
- **Interface/data/architecture choices:** 5–10 volunteers is a proposal, not an achieved sample or required number. No causal learning-improvement, customer-traction or mastery claim follows from a small qualitative trial.
- **Failure checks, handoff and review:** Report actual anonymous counts, observed failures and limitations. Reviewer: all three; privacy review before data capture, individual module owners implement fixes.

## ED-21 — Open-topic and lightweight learning extensions

- **Accountable member / relevant roles:** Tasnim / Independent learner. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F05, F11–F12. Open-topic and lightweight learning extensions.
- **Existing implementation:** Manual courses, planner goals, search and task models.
- **Required changes:** Add labeled no-upload topic practice, then optional annotations/Peer Teaching/Revision presets; reuse same context/policy with bounded scope. Tasnim owns the complete open-topic UI/API/AI learning loop.
- **Dependencies:** Stable P0; ED-10, ED-13.
- **Priority / complexity / status:** P2 / M / **PARTIAL**.
- **Acceptance criteria:** AI-generated baseline never labeled official; each selected extension has tested end-to-end flow and does not bypass source ACL.
- **Validation approach:** No-upload browser case and provenance/injection tests; test added preset transitions.

### ED-21 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/planner/agent.py; AI/agents/search/agent.py; API/modules/study/src/routes/courses.ts; WEB/src/features/planning/actions.ts.
- **Implementation sequence:** 1. Tasnim adds no-upload topic input after core P0; use same activity/evaluator/progress pipeline. 2. Resolve a bounded generated learning baseline and label it not instructor-approved; keep personal ownership. 3. Reuse search/retrieval only when permitted and sources valid. 4. Coordinate any new Course creation field with Habib instead of writing competing course model logic.
- **Interface/data/architecture choices:** No upload or institution required, but existing auth/entitlement behavior stays explicit. Unverified generated context cannot silently become an official source or trusted answer key. Namespace topic/activity versions for reproducible attempts.
- **Failure checks, handoff and review:** Test unsupported topic, no reliable sources, generated-content injection and failed inference. End-to-end input -> activity -> check -> next step, with scope/provenance. Reviewer: Habib content ownership and Aziz room reuse.

## ED-22 — Investigate legacy variants and heavy dependencies

- **Accountable member / relevant roles:** Habib / Operator/developers. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** Maintenance. Investigate legacy variants and heavy dependencies.
- **Existing implementation:** Reflection variants, ML/training artifacts, multiple retrieval paths and old standalone entrypoints.
- **Required changes:** Trace dynamic imports, runtime commands, tests and operational consumers; document usage before proposing deletions; assess manifest/image parity. Habib coordinates investigation; each owner traces their own TS/React/Python dependencies, not one Python owner.
- **Dependencies:** ED-01; runtime/deployment evidence.
- **Priority / complexity / status:** Post-hackathon / M / **TODO**.
- **Acceptance criteria:** Any proposed deletion has reference/runtime proof and regression coverage; retained dependency graph preserved.
- **Validation approach:** Import/reference and launch-path audit, isolated tests/build, peer diff review.

### ED-22 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/reflection; AI/ML; AI/pyproject.toml; AI/Dockerfile; API/src/app.ts; API/src/domain-definitions.ts.
- **Implementation sequence:** 1. Habib coordinates a per-module import/entrypoint/runtime inventory; Tasnim handles learning/ML/RAG dependencies, Aziz realtime/facilitator/voice. 2. Distinguish static references, dynamic imports, tests, standalone launchers and actual deployment consumers. 3. Compare Poetry/image/CI dependencies and locate optional heavy model paths. 4. Propose deletions only with no retained consumer and a reviewed replacement/compatibility plan.
- **Interface/data/architecture choices:** Duplicate-looking Python paths or non-MVP features are not proof of dead code. Keep security/tests/observability/recovery, trained model artifacts and persistence until necessity is established; organizer no-training rule does not authorize deleting unrelated legacy assets.
- **Failure checks, handoff and review:** Any later cleanup needs dependency/launch evidence, affected builds/tests and complete diff review. No package upgrade/model migration is bundled here. Review: affected module owner plus consumer.

## ED-23 — Decide legacy commercial/social scope

- **Accountable member / relevant roles:** Habib / Operator/learners. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** Maintenance / future product. Decide legacy commercial/social scope.
- **Existing implementation:** Active billing/tiers, rewards/quests/ranking/friends/customization and global shell integrations.
- **Required changes:** Decide later what to expose/deprecate; plan dependency-safe changes without changing access/rewards during this audit; validate business assumptions before commerce work.
- **Dependencies:** Stable P0; team product decision.
- **Priority / complexity / status:** Post-hackathon / L / **TODO**.
- **Acceptance criteria:** Approved scope and dependency map; any future removal preserves contracted functionality or has explicit migration plan.
- **Validation approach:** Impact review across auth/entitlements/session rewards/UI/tests; no speculative removal.

### ED-23 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/shared/entitlements.ts; API/modules/auth/src/routes; API/modules/user-profile/src/routes/gamification.ts; WEB/src/components/layout/workspace-shell.tsx.
- **Implementation sequence:** 1. Habib inventories paid-access gates, billing/coupons and global-shell social/customization calls. 2. Tasnim maps learning reward/XP coupling; Aziz maps team rewards/presence dependencies. 3. Decide exposed/deprecated features after educational value evidence. 4. Plan explicit compatibility/entitlement/data treatment before removing any active feature; do not remove working functionality as a P0 shortcut.
- **Interface/data/architecture choices:** Commercial adoption is a hypothesis; existing paid/trial gates are current behavior. Demo-safe synthetic entitlements are not a live payment system or a silent production entitlement change.
- **Failure checks, handoff and review:** Produce approved scope plus dependency/impact matrix. Any future modification needs auth/billing/reward regression evidence. Review: Tasnim/Aziz for affected learning/group behavior.

## ED-24 — Institutional product expansion

- **Accountable member / relevant roles:** Habib / University administrator. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** Future vision. Institutional product expansion.
- **Existing implementation:** Minimal institution work planned, not enterprise capability.
- **Required changes:** After pilot evidence consider governance, SSO/LMS, longitudinal analytics, cohort licensing and operational scale; no premature framework migration.
- **Dependencies:** Validated pilot, ED-04, ED-19.
- **Priority / complexity / status:** Post-hackathon / L / **TODO**.
- **Acceptance criteria:** Prioritized approved requirements backed by pilot evidence/privacy policy; no unsupported scale/traction claim.
- **Validation approach:** Product/security design review and later feature-specific acceptance plans.

### ED-24 technical execution notes — TARGET

- **Existing code to inspect/reuse:** docs/roles-and-permissions.md; docs/hackathon-delivery.md; API/modules/auth/src/models/User.ts.
- **Implementation sequence:** 1. Habib validates pilot needs before enterprise governance, SSO/LMS, procurement or scale work. 2. Document owner/membership/support-access/retention policies and institution-approved source lifecycle. 3. Evaluate operational load/cost from actual usage evidence, then propose integrations separately. 4. Keep future change plans compatible with personal learners and existing account IDs.
- **Interface/data/architecture choices:** No enterprise infrastructure, auth migration or commercial feature is a hackathon prerequisite. Each future integration needs its own permission/data/recovery contract and measurable acceptance; no unvalidated capacity/traction claim.
- **Failure checks, handoff and review:** Team/product/security review and pilot-backed requirements before implementation. Review: Tasnim individual access and Aziz collaboration boundaries; retain current stack until a measured limitation justifies change.

## ED-25 — Explore consented speech-aware assistance

- **Accountable member / relevant roles:** Aziz / Consenting room participants. Module/symbol boundaries and cross-member work packages: [team plan](team-delivery-plan.md).
- **Objective / related feature:** F10 / optional AI speech. Explore consented speech-aware assistance.
- **Existing implementation:** Peer audio only; any search speech utility is not room observation.
- **Required changes:** If explicitly approved, evaluate STT/attribution/TTS latency, multilingual fairness and opt-in retention; no hidden listening or default recording. Aziz owns group speech UI/API/AI consent/orchestration together; shared transport stays reused.
- **Dependencies:** Organizer clarification, ED-17, ED-13; stable P0.
- **Priority / complexity / status:** P2 / L / **TODO**.
- **Acceptance criteria:** Every participant consents; nonconsent keeps text usable; observed typed vs spoken inputs honest; latency/privacy evidence recorded.
- **Validation approach:** Controlled synthetic-audio evaluation, consent revocation and storage audit; no production data.

### ED-25 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/collaboration/realtime-status.tsx; WEB/src/features/collaboration/realtime-status.tsx; AI/services/api/main.py; docs/hackathon-delivery.md.
- **Implementation sequence:** 1. Aziz confirms allowed speech processing and explicit all-participant consent before prototyping. 2. Keep audio transport separate; opt-in speech events are bounded and attributed tentatively. 3. Implement speech-to-text/facilitator/private or public output with clear observation labels; silence/uncertainty is not ability evidence. 4. Default recording off and define revocation/retention/failure behavior. 5. Reuse model access rather than a new inference fleet.
- **Interface/data/architecture choices:** Student-to-student live audio is not consent for AI listening. No actual STT/provider/library choice is committed here; choose only after rules, quality/latency/cost and language evaluation. Keep typed activity path fully usable.
- **Failure checks, handoff and review:** Synthetic consented audio, attribution failures, language mismatch, consent withdrawal and AI outage; verify no residual unauthorized recording/transcript. Review: Habib privacy and Tasnim pedagogical evidence. P2 only.

## ED-DOC — Audit and realign documentation

- **Accountable member / relevant roles:** Aziz / team and all product roles; Habib/Tasnim review their technical sections.
- **Objective / related feature:** Documentation only. Audit and realign documentation.
- **Existing implementation:** This audit/specification set, immutable sources and inventory.
- **Required changes:** Keep CURRENT/REUSABLE/TARGET/TODO distinctions, source-linked gaps, one active backlog and actual validation record; align v1.2 Studio/activity/reward contracts and three-member ownership without feature changes.
- **Dependencies:** Static source audit and documentation/link checks.
- **Priority / complexity / status:** P0 / M / **DONE**.
- **Acceptance criteria:** Maintained navigation/specs/roles/models/workflows/AI/roadmap/testing/delivery and v1.2 ownership/contract plan exist; no runtime feature changes; history labeled. DONE refers only to documentation, not implementation.
- **Validation approach:** Review documentation diff, local links, IDs/statuses and source-only scope; see audit results.

### ED-DOC technical execution notes — TARGET

- **Existing code to inspect/reuse:** docs/README.md; docs/sprint-backlog.md; docs/team-delivery-plan.md; docs/target-architecture.md; docs/audit/ednova-v1-2-update.md.
- **Implementation sequence:** 1. Aziz coordinates the canonical documentation/status register, with Habib/Tasnim reviewing their source/contract details. 2. Preserve immutable brief/PDF/history and separate CURRENT/REUSABLE/TARGET/TODO. 3. Keep named task owner, review/handoff, technical steps, dependencies and actual results. 4. Run task/index/link/scope checks when updating; do not infer DONE from a design document. 5. Record outstanding decisions and runtime failures honestly.
- **Interface/data/architecture choices:** One active backlog; the team plan is an assignment/handoff view, not a competing progress tracker. DONE for ED-DOC means documentation artifacts exist and were checked, not that any planned feature is implemented.
- **Failure checks, handoff and review:** All 36 named owners/index rows/technical packets resolve; links valid, dependency graph acyclic, immutable source copies unchanged and no runtime/migration diff in documentation work. Review: Habib content/architecture and Tasnim learning/evidence.

## ED-26 — Freeze versioned cross-member activity/content/evidence contracts

- **Accountable member / relevant roles:** Habib / All; F20–F22.
- **Objective / feature:** Freeze versioned cross-member activity/content/evidence contracts; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Domain/message payload schemas and shared contracts exist; new activity/revision/evidence contracts are absent.
- **Required implementation work:** Agree public vs server-only projections, type enums/versions, source+revision pins, private attempt IDs/statuses, room events and accepted-evidence/award keys; Habib owns source/revision/access contracts; Tasnim owns activity/attempt/evidence/reward contracts; Aziz owns room/facilitator contracts; use existing shared-contract patterns and cross-review; each owner maintains their module Python mirrors. Habib coordinates agreement, not all AI or backend implementation. Do not generate browser code.
- **Dependencies:** ED-01/02; Habib+Tasnim+Aziz contract review.
- **Priority / complexity / status:** P0 / M / **TODO**.
- **Acceptance criteria:** Canonical quiz/guided-problem/source/attempt/room/evidence examples agree across all three members; invalid/version-mismatch and visibility rules explicit; no keys/rubrics in public payload.
- **Validation requirements:** Schema parity fixtures, serialization/negative validation and source/recipient ACL review by all three.

### ED-26 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/shared/ai-messaging/envelope.ts; API/shared/ai-messaging/payloadSchemas.ts; AI/workers/schemas.py; AI/messaging/envelope.py; WEB/src/lib/api.ts.
- **Implementation sequence:** 1. Habib authors source/revision/enrollment/provenance examples; Tasnim authors activity/attempt/evidence/reward and shared inference projection; Aziz authors room/facilitator/presenter/private-help schemas. 2. Review producer/consumer examples including forbidden, stale, unsupported, pending and duplicate paths. 3. Agree public/private/server-only fields, enums, finite sizes and version strategy. 4. Add schema parity/consumer fixtures in existing validation patterns; do not introduce a competing schema service.
- **Interface/data/architecture choices:** Proposed public activity fields: schemaVersion, activityId/revision, type/componentVersion, instructions, bounded data, sourceRefs, objective/difficulty/language/visibility. Server evaluationRef/answer key/rubric never enters learner projection. One provider/job envelope is reused; unique command, attempt and completion IDs have distinct purposes.
- **Failure checks, handoff and review:** Validate roundtrip serialization and negative examples across TS/Python/React consumers. A contract is frozen only after all affected owners review it. Habib coordinates agreement, not everyone else API/AI implementation.

## ED-27 — Trusted quiz/guided-problem renderer and learner flow

- **Accountable member / relevant roles:** Tasnim / University student, independent learner; F20.
- **Objective / feature:** Trusted quiz/guided-problem renderer and learner flow; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Native practice form, shadcn primitives, authenticated evaluation Server Actions and job feedback UI; the old Socratic screen/Zustand store were removed during rebuild.
- **Required implementation work:** Tasnim owns this renderer and paired ED-29 learning APIs/evidence end-to-end. Implement allowlisted InteractiveQuiz and GuidedProblem, safe text rendering, local answer/input state, server-submit/hint/results and accessible reset/retry. Reuse same renderer for solo/room view; attach existing entry screens minimally; unsupported outputs use safe text without execution.
- **Dependencies:** ED-26, ED-28, ED-29 (solo integration first; room integration is a downstream gate).
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Both types work keyboard/mobile with feedback/fallback; reset yields no new accepted evidence; private attempts never broadcast; no eval/inner executable model markup.
- **Validation requirements:** Component tests for type/version/payload bounds, keyboard/fallback, then browser submission/retry and two-context privacy.

### ED-27 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/learning/job-form.tsx; WEB/src/features/learning/job-form.tsx; WEB/src/lib/api.ts; WEB/src/features/learning/session-actions.ts.
- **Implementation sequence:** 1. Tasnim composes shipped InteractiveQuiz and GuidedProblem components using current UI primitives. 2. Build an allowlist dispatch by type+supported version, bounded typed data and safe text formatting. 3. Separate local draft input/presenter-view state from submitted private attempt state. 4. Wire submit/hint/retry/result through Tasnim server; accessibility/loading/error/reset included. 5. Export the same renderer contract for Habib preview and Aziz room embedding.
- **Interface/data/architecture choices:** No eval/new Function/LLM HTML/JS/JSX/CSS execution or executable formula parsing. Private learner answers are never room-view props. Instructor-only preview may reveal rubric through a separate authorized projection, never via hidden public JSON fields.
- **Failure checks, handoff and review:** Both component types pass keyboard/mobile/fallback/input tests plus real submit/evidence browser flow. Unknown schema falls back safely without a write. Review: Habib preview and Aziz room consuming props/events; owner stays Tasnim for UI/API/AI.

## ED-28 — AI intent-to-activity selection and safe output validation

- **Accountable member / relevant roles:** Tasnim / Both learner contexts; F06/F20.
- **Objective / feature:** AI intent-to-activity selection and safe output validation; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Shared LLM client, evaluator schemas/prompts, source retrieval and validation.
- **Required implementation work:** Classify intent/objective/level; choose quiz/guided problem or ordinary text; emit bounded ED-26 candidate referencing allowed sources/published activity; use compact where safe and capable for warranted reasoning; reject/repair at most within budget then safe fallback. Tasnim learning API revalidates before persistence/delivery; Habib supplies source-authorization contract.
- **Dependencies:** ED-03, ED-10, ED-26.
- **Priority / complexity / status:** P0 / M / **PARTIAL**.
- **Acceptance criteria:** Source-backed request selects suitable allowed type; arbitrary code, unknown type/version or forged source fails safely; output is not auto-approved official content.
- **Validation requirements:** Fixed intent/source/rubric cases, prompt injection, unsupported schema and quota/non-streaming tests with real-service evidence separately.

### ED-28 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/utils/llm_client.py; AI/agents/evaluator/prompts.py; AI/agents/evaluator/validation.py; AI/workers/schemas.py.
- **Implementation sequence:** 1. Tasnim maps objective/question/level to text, quiz or guided problem using rules/compact inference. 2. Constrain model output to agreed type/version and authorized source refs. 3. Validate bounded payload/citation/evaluation policy before persistence/public projection; allow at most bounded repair then text fallback. 4. Use capable reasoning when warranted, not for every routing decision. 5. A runtime generated variant is explicitly generated/versioned, never an edit of an official course.
- **Interface/data/architecture choices:** Classifier selection is not code generation or grading. Public schema omits correct answer/rubric; server-owned evaluation context stays private. Habib may reuse candidate activity generation for Studio under ED-32 with explicit review.
- **Failure checks, handoff and review:** Fixed intent/level/source cases, malformed schema, unknown type/version, fabricated refs, prompt injection, quota and slow whole response. Review: Habib authored-source/preview and Aziz supported room activity behavior.

## ED-29 — Private activity attempts, assessment and accepted evidence

- **Accountable member / relevant roles:** Tasnim / Both learner contexts; F07/F15/F20/F22.
- **Objective / feature:** Private activity attempts, assessment and accepted evidence; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** EvalResult, competency processor/leases and owner-scoped AI jobs; no canonical ActivityAttempt.
- **Required implementation work:** Validate authenticated learner, activity/revision enrollment and server-owned evaluation policy; persist attempt/idempotency and pin version; Tasnim implements the activity API, persistence and its ED-27 learner UI in one module; invoke the Tasnim-owned individual evaluator through existing job boundary; accept evidence once; expose recipient-only result and recoverable status; emit award candidate only after accepted evidence.
- **Dependencies:** ED-02, ED-26; ED-08 evaluator integration.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Forged grade/actor/stale revision denied; retries and concurrent duplicate callbacks create one accepted evidence; pending/unavailable grade gets no mastery/XP; no rubric/private-answer leak.
- **Validation requirements:** API ownership/replay/race/crash tests, evaluator output validation and private result browser assertions; P1 reward contract test.

### ED-29 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/ai-orchestrator/src/routes/jobs.ts; API/modules/ai-orchestrator/src/services/jobResultConsumer.ts; API/modules/study/src/services/competency.ts; API/modules/study/src/services/competencyUpdater.ts; AI/workers/evaluator_worker.py.
- **Implementation sequence:** 1. Tasnim server creates private attempt pinned to actor/activity/course/rubric revision. 2. Submit carries stable request token plus step/input; ignore client grade/actor/XP. 3. Reuse existing async evaluation job and validate callback against attempt/version/status. 4. Accept one logical evidence result, then apply competency via replay-safe consumer; leases distinguish running/processed/expired. 5. Return own feedback and a safe completion projection to Aziz group orchestration.
- **Interface/data/architecture choices:** ID purposes: request token dedups transport, attemptId identifies private conversation, completion/evidence identity dedups accepted learning effect, correlation traces jobs. Retrying/resetting with a fresh request ID must not manufacture another reward-eligible completion. Recheck source/recipient access on result delivery.
- **Failure checks, handoff and review:** Test forged actor/grade/version, race/duplicate callback, crash between acceptance/progress write, source revoke, worker resume and pending grading. Inspect bounded competency-evidence replay dedup under old replays, not only new inserts. Review: Habib ACL and Aziz completion-signal privacy.

## ED-30 — Course Studio draft hierarchy and provenance API

- **Accountable member / relevant roles:** Habib / Instructor, independent learner; F03/F21.
- **Objective / feature:** Course Studio draft hierarchy and provenance API; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Course topics/subtopics/files and ingest state; no revisioned editing/publication boundary.
- **Required implementation work:** Adapt Course rather than build LMS: original source refs, editable section draft, extracted/AI/manual provenance, ambiguity flags, optimistic revision checks; rename/reorder/add/remove/correct sections in P0. Official draft limited to assigned instructor; personal simplified editing owner-only. Same owner Habib delivers ED-31 editor and ED-05 publication UI/API; Tasnim supplies reusable activity preview via contract.
- **Dependencies:** ED-04, ED-06, ED-26.
- **Priority / complexity / status:** P0 / L / **PARTIAL**.
- **Acceptance criteria:** Wrong hierarchy can be corrected and re-read; source refs remain traceable or explicitly unknown; simultaneous stale edits rejected; draft not accessible to learners; approved active revision immutable.
- **Validation requirements:** Role/revision/source integrity API tests, malformed hierarchy/cyclic-order rejection and failed extraction/edit recovery.

### ED-30 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/study/src/models/index.ts; API/modules/study/src/routes/courses.ts; API/modules/study/src/routes/learningObjectives.ts; WEB/src/features/courses/course-list.tsx.
- **Implementation sequence:** 1. Habib adapts existing Course topics/files into stable source-linked draft sections. 2. Define allowed rename/reorder/add/remove/correct operations with expectedRevision and assigned-author checks. 3. Validate tree integrity, finite size and source/objective refs before saving. 4. Keep draft/edit state separate from published pointer and ingest state. 5. Provide same private owner-only variant for independent courses.
- **Interface/data/architecture choices:** Proposed draft edit command contains courseId, expectedRevision, ordered validated sections/objectives and provenance edits. Server derives reviewer/owner/time; instruction text cannot set institution or approved flag. No automatic overwrite of a reviewed draft by late AI job.
- **Failure checks, handoff and review:** Test concurrent editors, cyclic/invalid hierarchy, late ingest result, foreign source reference and failed write recovery. Reviewer: Tasnim approved-context projection and Aziz source-sharing. Habib delivers paired UI in ED-31.

## ED-31 — Course Studio editor, preview and approval UI

- **Accountable member / relevant roles:** Habib / Instructor, independent learner; F21.
- **Objective / feature:** Course Studio editor, preview and approval UI; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** CourseUpload/SubjectDetail, upload progress UI; no hierarchy editor/review screen.
- **Required implementation work:** Habib delivers editor UI together with Habib-owned ED-30/05 draft/publication APIs. Compose existing patterns into P0 upload/status/hierarchy correction/objective review/preview/publish controls using ED-30/05; retain original source/provenance labels. P1 merge/split conveniences and richer per-section settings; same private variant for learner-owned content. No broad redesign.
- **Dependencies:** ED-26, ED-30, ED-05; ED-27 for preview.
- **Priority / complexity / status:** P0 minimum / P1 rich controls / L / **TODO**.
- **Acceptance criteria:** Instructor corrects extracted heading, previews a quiz/problem and publishes; learner opens approved revision; independent owner cannot publish institution-official material; stale edit/error visible.
- **Validation requirements:** End-to-end PDF -> correction -> preview -> publish -> learner flow; permission and retry/stale revision component tests.

### ED-31 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/courses/upload-form.tsx; WEB/src/features/courses/course-list.tsx; WEB/src/lib/api.ts; API/modules/study/src/routes/courses.ts.
- **Implementation sequence:** 1. Habib adds upload/status -> hierarchy editor -> source preview -> objective correction -> review/publish controls using current route/UI patterns. 2. Preserve section identity/provenance when labels/order change; show ambiguous/AI-generated content. 3. Submit expectedRevision and handle stale edits visibly without discarding unsaved input. 4. Embed Tasnim trusted renderer for interactive preview after source/text publication slice works. 5. P1 adds merge/split and richer settings rather than a new LMS.
- **Interface/data/architecture choices:** Frontend is not approval authority; publish is separate authenticated command after validated draft. Preview uses approved/public schema or explicit instructor-only projection; it never leaks private grading keys to learners.
- **Failure checks, handoff and review:** Instructor corrects one wrong extracted section and learner opens the pinned published version; private learner variant cannot publish official course. Test failed extraction, stale tab, retry and keyboard editing. Review: Tasnim renderer/API consumer; Habib owns complete Studio UI/API/AI.

## ED-32 — Source-backed Studio activity proposals and customization

- **Accountable member / relevant roles:** Habib / Instructor, independent learner; F20/F21.
- **Objective / feature:** Source-backed Studio activity proposals and customization; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Extraction enrichment/objective generation, chunking/OCR and evaluator prompts.
- **Required implementation work:** Produce traceable candidate section/objective/activity definitions with extracted vs generated labels; include minimal manually chosen objective in P0. P1 condition generation on section language/difficulty/pedagogy/hint/retry/rubric settings and preview/review; honor allowed source/version and no automatic approval. Habib owns Studio AI prompts/generation/provenance and its review UI/API; consume Tasnim shared activity schema/renderer instead of cloning it.
- **Dependencies:** ED-06, ED-26, ED-28; ED-30 draft contract.
- **Priority / complexity / status:** P0 grounding / P1 rich generation / M / **PARTIAL**.
- **Acceptance criteria:** P0 student activity grounded in corrected approved section; P1 settings affect output while unsupported claims/locations stay flagged; AI cannot self-publish or overwrite reviewed draft.
- **Validation requirements:** Synthetic misdetected hierarchy/source fixture, citation/provenance and settings adherence tests; invalid output and service outage fallback.

### ED-32 technical execution notes — TARGET

- **Existing code to inspect/reuse:** AI/agents/course_ingestion/enrichment/llm_enricher.py; AI/agents/course_ingestion/enrichment/objective_extractor.py; AI/agents/course_ingestion/agent.py; WEB/src/features/courses/upload-form.tsx.
- **Implementation sequence:** 1. Habib generates source-linked section/objective/activity candidates from selected allowed material. 2. Tag extracted vs inferred/generated fields and ambiguous locations; do not hallucinate source pages. 3. Reuse Tasnim ActivityDefinition schema/renderer/evaluation semantics rather than invent authoring-only quiz format. 4. P1 condition on reviewed section language/difficulty/hint/retry/pedagogy settings; validate output and offer preview/approve/reject. 5. Candidate generation failure keeps prior reviewed content intact.
- **Interface/data/architecture choices:** Generation writes a draft candidate referencing source/draft revision and selected settings. A late result for a changed draft cannot silently overwrite it; show stale/review-needed state. No model approval/publication or numerical XP output.
- **Failure checks, handoff and review:** Test one deliberately misdetected heading, changed setting, missing source, late generation, invalid schema and preview/publish access. Review: Tasnim schema/answer-policy compatibility and Aziz shared activity reuse.

## ED-33 — Evidence-based XP, levels and achievement awards

- **Accountable member / relevant roles:** Tasnim / Both learner contexts; F22.
- **Objective / feature:** Evidence-based XP, levels and achievement awards; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Gamification model/catalog/history, internal reward route, separate ranking ledger/KP caps.
- **Required implementation work:** Tasnim owns rewards processing, persistence, anti-abuse/recovery and paired ED-34 UI together. Consume ED-29 accepted evidence; choose versioned server reward policy with per-user completion key/caps; repair XP replay/concurrency/recovery before reuse. Reconcile old/new completion rewards to avoid duplicate XP; maintain existing totals/level formula unless separately approved; define 2–3 evidenced milestone rules and transparent reasons. No arbitrary model/client XP.
- **Dependencies:** ED-29, ED-11, ED-13; stable P0.
- **Priority / complexity / status:** P1 / L / **PARTIAL**.
- **Acceptance criteria:** Concurrent retry/restart awards once and recoverably updates ledger+profile; same achievement once; no reward for chat/views/idle/failed or unverified attempts; XP distinct from mastery.
- **Validation requirements:** Race/replay/failure-injection API tests, cap/repeat/forged evidence tests, legacy compatibility and reason/evidence linkage checks.

### ED-33 technical execution notes — TARGET

- **Existing code to inspect/reuse:** API/modules/user-profile/src/models/Gamification.ts; API/modules/user-profile/src/routes/gamification.ts; API/modules/user-profile/src/services/awardService.ts; API/modules/user-profile/src/models/RankEventLedger.ts.
- **Implementation sequence:** 1. Tasnim derives a conservative versioned reward policy from accepted evidence and distinguishes old legacy awards. 2. Create stable per-user logical completion/reward identity, caps and measurable 2–3 achievement rules. 3. Implement recoverable claim/apply/confirm behavior so crash after claim cannot permanently omit XP; duplicate replay cannot apply twice. 4. Keep one Gamification balance and existing formula unless explicitly changed. 5. Check eligibility after relevant verified stats are updated; avoid late/double unlocks.
- **Interface/data/architecture choices:** Existing ranking KP eventKey dedup and caps are separate from totalXp additions. Do not treat inserting a reward ledger as proof profile increment happened. Use current Mongo-compatible single-document atomic effects or a documented recoverable protocol; do not assume standalone deployment supports multi-document transactions. No penalties/message-volume/idle-time learning credit.
- **Failure checks, handoff and review:** Race/replay/new request IDs, failure after claim/before increment, repeated old completion after evidence-window pruning, rule-version change, forged evidence and legacy/new double awards. Review: Aziz group-completion eligibility and Habib privacy/compatibility.

## ED-34 — Explainable XP/level/achievement learner feedback

- **Accountable member / relevant roles:** Tasnim / University student, independent learner; F22.
- **Objective / feature:** Explainable XP/level/achievement learner feedback; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Gamification store/profile and level-up/achievement notifications already exist.
- **Required implementation work:** Same Tasnim owner delivers ED-33 backend and this UI end-to-end. Reuse progress UI for server-issued XP/level and 2–3 milestone badges; show reason and pending/verified distinction; display subject evidence separately; quiet accessible celebration and refresh/reconnect. No shop/leaderboard expansion.
- **Dependencies:** ED-33 public projection; ED-27 learner flow.
- **Priority / complexity / status:** P1 / S / **PARTIAL**.
- **Acceptance criteria:** Accepted solo/group check shows one award reason, correct level and badge; repeated refresh shows no duplicate toast/award; XP never appears as academic mastery.
- **Validation requirements:** Store/component tests with pending/accepted/replayed events and accessible feedback; browser evidence-to-award path.

### ED-34 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/learning/job-form.tsx; WEB/src/features/account/actions.ts; WEB/src/components/shared/action-form.tsx; API/modules/user-profile/src/routes/gamification.ts.
- **Implementation sequence:** 1. Tasnim consumes server-owned applied/pending reward projection and reuses current profile/notification UI. 2. Show amount, rule/reason, level progress and earned achievement separately from subject evidence. 3. Dedup notification by stable award/achievement identity across refresh/reconnect. 4. Use quiet accessible celebration; no arbitrary XP/client eligibility checks. 5. Pending reward processing must not hide valid learning evidence.
- **Interface/data/architecture choices:** Global level floor(totalXp/100)+1 is current implementation, not a subject grade. Reward reason links to own permitted evidence without exposing peers private attempts. Do not build shop/leaderboard/cosmetics for this task.
- **Failure checks, handoff and review:** Test pending->applied, duplicate event/history reload, disabled/reduced motion, failed refresh and privacy. Review: Aziz room completion UX. Tasnim owns ED-33 server behavior and ED-34 UI as one module.

## ED-35 — One deterministic educational visualization extension

- **Accountable member / relevant roles:** Tasnim / Both learner contexts; F20.
- **Objective / feature:** One deterministic educational visualization extension; integrate with the same individual/group learning engine.
- **CURRENT / reusable code:** Existing React primitives/charts; no verified educational registry visualizer.
- **Required implementation work:** After P0 choose one subject-specific StepByStepVisualizer; use bundled deterministic domain logic and bounded inputs, not generated code. ParameterExplorer/InteractiveComparison contracts may be explored later within same task after scope approval; do not commit a large catalog.
- **Dependencies:** ED-26, ED-27; Tasnim-reviewed worked example; stable P0.
- **Priority / complexity / status:** P1 / M / **TODO**.
- **Acceptance criteria:** Chosen algorithm/math example has correct reproducible back/next/reset, accessible controls and room reuse; interaction alone yields no mastery/evidence.
- **Validation requirements:** Known input/output cases, domain correctness review by Tasnim, keyboard/reduced-motion/mobile and invalid-input tests.

### ED-35 technical execution notes — TARGET

- **Existing code to inspect/reuse:** WEB/src/features/learning/job-form.tsx; WEB/src/lib/utils.ts; docs/product-specification.md.
- **Implementation sequence:** 1. Tasnim chooses one topic-specific deterministic visualizer after P0, with a human-reviewed worked example. 2. Ship audited algorithm/math logic and validate bounded input; model supplies parameters/explanation, never functions/code. 3. Provide back/next/reset, readable textual equivalent, keyboard/reduced-motion and mobile controls. 4. Expose renderer view state for Aziz authorized presenter sync; private learner answers remain separate. 5. No large visualization library commitment.
- **Interface/data/architecture choices:** Illustrative visualization displays deterministic state, not proof of comprehension. Manipulating controls does not create accepted evidence/rewards; use a separate validated check. Unknown type/invalid parameter falls back to text.
- **Failure checks, handoff and review:** Known input/output invariants, edge cases, reset/replay determinism and room embedding. Review: Aziz presenter-state consumer and Habib source/topic example. No new dependency required unless later justified.

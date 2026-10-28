# Full task implementation matrix — 26 October 2026

**27 October master-mission continuation:** The current [tracker](EDNOVA-IMPLEMENTATION-TRACKER.md) and [executed test coverage](EDNOVA-TEST-COVERAGE.md) supersede earlier narrow findings below. The image now runs as UID/GID 10001 with non-destructive permission checks; actual isolated worker/broker/Redis kill/recovery and a stopped-writer synthetic Mongo/source restore pass. Failed replacement enqueue no longer removes prior staged downloads. Private profile/reward body logging and the shared Python database error/cache defects are repaired. Root checks pass, and full Python now passes 1082 with five documented fixture skips. Contract freeze and approved real inference remain blocked. The [four-learner PDF browser](EDNOVA-COLLABORATION-VERIFICATION.md) passes all eight A–E checkpoints. Bounded local English OCR, real image-only source/confidence delivery and the nine-checkpoint scanned-PDF browser pass within the [documented scope](EDNOVA-OCR-VERIFICATION.md); no parent task is declared complete. Historical text remains for traceability.

**27 October worker concurrency follow-up:** Ingestion manifests and retry counts are isolated per delivery, and graceful shutdown tracks concurrent jobs until delivery processing completes. Focused interleaving and worker regression evidence is recorded in [worker tests](evidence/ednova-worker-concurrency-20261027/worker-tests.log). Broker crash/recovery remains open.

**27 October revocation follow-up:** Shared ledger revocation is checked at reservation, before dispatch and before delivering simulated results. An operator interface and hard cancellation of in-flight calls are still absent.

**27 October PDF/source follow-up:** A real two-page synthetic PDF passes authenticated Nest/broker/worker/index/publication/tutor/download integration. The full A–E browser journey also passes with a synthetic PDF. A fresh AI image passed isolated liveness, sandbox extraction and shared read-only artifact checks. PDF extraction is confined to a fresh bounded subprocess. OCR, containerized worker recovery and deployment acceptance remain open. See [evidence](evidence/ednova-pdf-browser-20261027/).

**27 October provider follow-up:** Shared Mongo-backed request reservations replace the process-local cap. The approved-provider gate, cost accounting and deployment-wide revocation remain incomplete.

**27 October implementation update:** ED-01, ED-06 and ED-DOC have moved from BROKEN to PARTIAL for the specific local defects repaired. The original acceptance statements and remaining gaps below still apply. Source-backed browser journeys A–E now pass in an isolated offline environment. The AI image has a limited isolated runtime check; full operational acceptance remains open.

Scope: canonical active task index in `docs/sprint-backlog.md`; historical mission M00–M38 map to these tasks in `EdNova_Complete_Codex_Mission_Roadmap.md:53`. Product F01–F22 and T01–T38 are scenario/feature views, not additional independent task counts. No historical status is taken as test evidence.

**Coverage limit:** this is an initial complete 36-ID registry, not a complete independent verification of every sentence in all specifications. The 36 verbatim acceptance fields below contain compound criteria; atomic acceptance-criterion totals are **not yet established**. Findings are conservative and may change with live tests. Each row has one task status; subcriteria are not asserted verified by a parent status.

| ID | Task | Source | Status | Implementation evidence | Verification | Missing work | Priority | Confidence |
|---|---|---|---|---|---|---|---|---|
| ED-01 | Repair and revalidate baseline | docs/sprint-backlog.md:65 | PARTIAL | apps/api/shared/betterAuth.ts; deploy/compose.development.yml; deploy/compose.test.yml | Root lint/typecheck/test/build and isolated auth/A–E browser pass; dev/test stacks start; dev broker roundtrip passes | Complete image, fresh lock install, remote CI and operational checks | P0 | HIGH |
| ED-02 | Close resource and transport isolation gaps | docs/sprint-backlog.md:89 | IMPLEMENTED_UNVERIFIED | apps/api/modules/study/src/services/resourceAccess.ts; apps/api/modules/notification/src/realtime.ts | R1 security and real browser revocation/outsider checks pass; complete all-channel matrix not established | Complete all-channel and multi-instance revocation checks, including voice | P0 | MEDIUM |
| ED-03 | Confirm and connect organizer inference service | docs/sprint-backlog.md:109 | BLOCKED | apps/ai/utils/llm_client.py:78 | Approval gate in code; no approved live calls performed | Organizer provider, model, budget and compact/capable real-call traces | P0 | HIGH |
| ED-04 | Minimal institutional membership and access contexts | docs/sprint-backlog.md:127 | IMPLEMENTED_UNVERIFIED | apps/api/modules/study/src/services/institutions.ts; apps/api/modules/study/src/services/enrollments.ts | Current root institutional integration and browser membership/enrollment/revocation checks pass | Complete all-institution acceptance and resolve ED-26 semantics | P0 | MEDIUM |
| ED-05 | Instructor versioned draft/review/publication flow | docs/sprint-backlog.md:146 | PARTIAL | apps/api/modules/study/src/services/coursePublication.ts; apps/web/src/features/courses/course-studio.tsx | Synthetic text and PDF browser upload, review and publication pass | Certify containerized end-to-end workflow and operational recovery | P0 | HIGH |
| ED-06 | Unify scoped material ingestion and provenance | docs/sprint-backlog.md:164 | PARTIAL | docker-compose.yml; scripts/setup.mjs; apps/ai/workers/ingestion_worker.py; revisionSources.ts | Real PDF browser/broker flow and isolated image shared-artifact verification pass | Verify containerized broker-worker flow, OCR, recovery and restore | P0 | HIGH |
| ED-07 | Reuse team sessions for synchronized learning rooms | docs/sprint-backlog.md:182 | PARTIAL | apps/api/modules/study/src/services/roomCommands.ts; apps/api/modules/notification/src/realtime.ts:56 | Two-browser activity, private results and reconnect pass; realtime is process-local | Rerun multi-browser and revocation/replay; test 2–4 users and distributed delivery for scale | P0 | MEDIUM |
| ED-08 | Diagnostic and individual guided practice | docs/sprint-backlog.md:208 | PARTIAL | apps/api/modules/study/src/services/learningJourney.ts; apps/web/src/features/learning/learning-workspace.tsx | Web renderer tests pass; diagnostic states explicitly nonadaptive | Evidence-grounded level policy, graduated hints, beginner/advanced scenarios and provider gate | P0 | HIGH |
| ED-09 | Explicit peer-first facilitator policy | docs/sprint-backlog.md:226 | PARTIAL | apps/api/modules/study/src/services/roomLearning.ts; apps/ai/agents/facilitator/ | Deterministic peer invitation exists; no current three-learner real-model test | Validated misconception intervention, decline/disagreement and bounded real inference | P0 | MEDIUM |
| ED-10 | Course-grounded tutor and verification | docs/sprint-backlog.md:246 | PARTIAL | apps/ai/agents/tutor/grounding.py; apps/api/modules/study/src/services/tutorGrounding.ts | Current offline real Nest/Python grounded tutor and source citation browser checks pass; container path unverified | Repair source path, rerun grounding negatives and approved-model quality/citation tests | P0 | HIGH |
| ED-11 | Private checks, group debrief and next steps | docs/sprint-backlog.md:264 | PARTIAL | apps/api/modules/study/src/services/roomLearning.ts; apps/web/src/features/collaboration/room-learning-panel.tsx | Current two-browser checks/debrief/privacy pass; three-browser gate not run | Verify individual next steps, private recovery and 3-user debrief without leakage | P0 | MEDIUM |
| ED-12 | Capacity-aware routing and degraded operation | docs/sprint-backlog.md:282 | PARTIAL | apps/ai/utils/llm_client.py:78; apps/ai/utils/llm_client.py:420 | Mongo-backed durable shared request cap passes concurrency/restart tests; no approved real traffic | Monetary/token budget, revocation administration and controlled 429/timeout/capable outage with approved models | P0 | HIGH |
| ED-13 | Challenge-safe synthetic data and privacy policy | docs/sprint-backlog.md:300 | PARTIAL | apps/api/modules/study/src/services/resourceAccess.ts; docs/security.md | Synthetic harness present; production privacy, retention and payload audit not rerun | Review logs/provider payload and retention, real deployments and no-audio recording guarantee | P0 | MEDIUM |
| ED-14 | Execute end-to-end challenge evaluation | docs/sprint-backlog.md:318 | BLOCKED | apps/web/e2e/p0r3-integrated-learning.test.ts; docs/testing-plan.md | Offline real-service browser A–E passes; approved model service and deployment evidence missing | Re-run actual challenge end-to-end including approved compact/capable failure cases | P0 | HIGH |
| ED-15 | Prepare submission and business artifacts | docs/sprint-backlog.md:336 | BLOCKED | docs/hackathon-delivery.md; EdNova_Complete_Codex_Mission_Roadmap.md | No independent evidence of approved final video/pitch/report and current release gate | Obtain decisions; produce and review bounded submission artifacts after ED-14 | P0 | MEDIUM |
| ED-16 | Improve multilingual and accessible learning UX | docs/sprint-backlog.md:354 | PARTIAL | apps/web/src/features/learning/learning-workspace.tsx; docs/testing-plan.md | Renderer unit checks only; multilingual/RTL/a11y rubric not executed | English/French/Arabic/Darija, screen-reader, keyboard/mobile and human meaning review | P1 | MEDIUM |
| ED-17 | LiveKit Cloud Media Plane & WebRTC Audio Integration | docs/sprint-backlog.md:372 | PARTIAL | apps/api/modules/notification/src/routes/voice.ts; apps/web/src/features/collaboration/ | Voice-related code exists; real LiveKit media/consent not demonstrated | Implement and test authorized consent-bound LiveKit token/media, reconnect | P1 | MEDIUM |
| ED-18 | Recipient-only private room help | docs/sprint-backlog.md:391 | PARTIAL | apps/api/modules/notification/src/routes/voice.ts; apps/api/modules/study/src/routes/rooms.ts | Private result primitives exist; recipient-only room tutor end-to-end not verified | Build requester-only help, safe sharing, private history/reconnect and negative tests | P1 | LOW |
| ED-19 | Minimal instructor aggregate insight | docs/sprint-backlog.md:409 | MISSING | apps/api/modules/study/src/services/roomLearning.ts; docs/sprint-backlog.md:409 | Room debrief suppresses grade aggregates; owned-course instructor insight not found | Implement reviewed thresholded course aggregates, cohort privacy and instructor ACL | P1 | MEDIUM |
| ED-20 | Collect safe real-user feedback | docs/sprint-backlog.md:427 | BLOCKED | docs/sprint-backlog.md:427 | No current independently verified volunteer sessions | Obtain consent and run/record anonymous 5–10-user evaluation after stable P0 | P1 | MEDIUM |
| ED-21 | Open-topic and lightweight learning extensions | docs/sprint-backlog.md:445 | PARTIAL | apps/web/src/app/(workspace)/practice/page.tsx; apps/ai/agents/search/ | Existing practice/search components; no verified no-upload labeled journey | Implement/test explicit unofficial provenance and safe extensions | P2 | LOW |
| ED-22 | Investigate legacy variants and heavy dependencies | docs/sprint-backlog.md:463 | PARTIAL | apps/ai/pyproject.toml; apps/api/modules/; docs/sprint-backlog.md:463 | Dependency/source inventory exists but runtime use and deletion review incomplete | Map imports, image dependency parity and runtime references before proposed removal | Post-hackathon | MEDIUM |
| ED-23 | Decide legacy commercial/social scope | docs/sprint-backlog.md:481 | BLOCKED | apps/api/modules/auth/src/routes/stripe.ts; apps/api/modules/user-profile/src/routes/ | Legacy commercial/social code present; no approved scope decision verified | Owner decision and dependency/migration map | Post-hackathon | MEDIUM |
| ED-24 | Institutional product expansion | docs/sprint-backlog.md:499 | BLOCKED | docs/sprint-backlog.md:499 | Pilot and enterprise requirements not independently evidenced | Pilot-backed SSO/LMS/scale roadmap and privacy review | Post-hackathon | MEDIUM |
| ED-25 | Multi-Speaker Voice AI Moderator (LiveKit Agents & Streaming Speech) | docs/sprint-backlog.md:517 | MISSING | docs/sprint-backlog.md:517; apps/ai/agents/ | No voice_moderator agent directory or LiveKit speech pipeline found | Resolve priority, build consented streaming voice and measure attribution/latency/no retention | P1 | HIGH |
| ED-DOC | Audit and realign documentation | docs/sprint-backlog.md:536 | PARTIAL | docs/development.md; docs/deployment.md; docs/runbooks/ednova-revision-sources.md | Current setup and AI/storage instructions corrected; wider consistency review remains | Reconcile remaining historical/current scope conflicts and fully audit contracts and reports | P0 | HIGH |
| ED-26 | Freeze versioned cross-member activity/content/evidence contracts | docs/sprint-backlog.md:554 | BLOCKED | docs/contracts/ednova-v1-approvals.md:140; apps/api/shared/ednova/contracts.ts; apps/ai/contracts/ednova.py | Owner ledger shows 0/19 decisions and 0/5 confirmations; schema check passes | Real dated decisions, confirmations, artifact hash review and formal freeze | P0 | HIGH |
| ED-27 | Trusted quiz/guided-problem renderer and learner flow | docs/sprint-backlog.md:574 | PARTIAL | apps/web/src/features/learning/activity-renderer.tsx; apps/api/modules/study/src/services/activityAttempt.ts | Current unit and authenticated browser quiz/guided/attempt flows pass; accessibility and full acceptance remain | Verify keyboard/mobile, retry/no extra evidence and private room behavior on live services | P0 | MEDIUM |
| ED-28 | AI intent-to-activity selection and safe output validation | docs/sprint-backlog.md:592 | PARTIAL | apps/api/modules/study/src/services/learningJourney.ts | Deterministic reviewed activity selector explicitly adaptive:false | Approved source-grounded model selection and output validation, or formally accept deterministic scope | P0 | HIGH |
| ED-29 | Private activity attempts, assessment and accepted evidence | docs/sprint-backlog.md:610 | IMPLEMENTED_UNVERIFIED | apps/api/modules/study/src/services/activityAttempt.ts; apps/api/modules/study/src/services/activityEvaluation.ts | Current real Mongo integration passes duplicate/race and actual SIGKILL recovery; broader official acceptance remains | Verify all official contract, deployment durability and operational acceptance criteria | P0 | MEDIUM |
| ED-30 | Course Studio draft hierarchy and provenance API | docs/sprint-backlog.md:628 | IMPLEMENTED_UNVERIFIED | apps/api/modules/study/src/services/courseDraft.ts; apps/api/modules/study/src/services/revisionSources.ts | Current Mongo and browser draft/revision checks pass; full contract/operational acceptance remains | Complete provenance/operational certification and owner review | P0 | MEDIUM |
| ED-31 | Course Studio editor, preview and approval UI | docs/sprint-backlog.md:646 | PARTIAL | apps/web/src/features/courses/course-studio.tsx; apps/web/src/features/courses/studio-actions.ts | Current real worker/browser text and synthetic PDF upload-to-publication flows pass | Complete OCR and rich editing/error/accessibility acceptance | P0 minimum | HIGH |
| ED-32 | Source-backed Studio activity proposals and customization | docs/sprint-backlog.md:664 | PARTIAL | apps/api/modules/study/src/services/courseStudio.ts | Source quotation candidates require review; general conceptual and rich settings absent | Approved conceptual source-grounded generation; language/difficulty/hint controls and tests | P0 grounding | HIGH |
| ED-33 | Evidence-based XP, levels and achievement awards | docs/sprint-backlog.md:682 | PARTIAL | apps/api/modules/user-profile/src/routes/gamification.ts; apps/api/modules/study/src/services/activityAttempt.ts | Legacy rewards exist; evidence-gated exactly-once recovery not established | Implement reviewed evidence-only award ledger and crash-safe idempotency | P1 | MEDIUM |
| ED-34 | Explainable XP/level/achievement learner feedback | docs/sprint-backlog.md:700 | PARTIAL | apps/web/src/app/(workspace)/progress/page.tsx; apps/api/modules/user-profile/src/routes/gamification.ts | Legacy progress exists; evidence award UI depends on ED-33 | Private award reasons and replay/no duplicate feedback, separate XP from mastery | P1 | MEDIUM |
| ED-35 | One deterministic educational visualization extension | docs/sprint-backlog.md:718 | MISSING | apps/web/src/features/learning/activity-renderer.tsx; docs/sprint-backlog.md:718 | Renderer supports quiz/guided; no approved deterministic visualizer found | Choose one example, implement bounded correct accessible controls and shared-room reuse | P1 | MEDIUM |

## Acceptance-field registry and dependencies

Each entry preserves the canonical acceptance field and dependency text, with exact source location. These are compound fields; individual assertions and acceptance counts require further decomposition and independent tests.

**ED-01** (backlog line 65) — Acceptance: API/web production builds, lint/typecheck and required unit/integration/auth/browser suites pass; skips and Python install policy explicit. Dependencies: None.

**ED-02** (backlog line 89) — Acceptance: Cross-user course summaries/files/chat/voice denied before lookup/inference; revoked users receive no further scoped data; existing legitimate team flow works. Dependencies: ED-01.

**ED-03** (backlog line 109) — Acceptance: One compact and one capable real call through approved service have redacted provenance; no silent mock success; known limits documented. Dependencies: Organizer access details; ED-01.

**ED-04** (backlog line 127) — Acceptance: Membership and invitation isolation, role-escalation denial and revocation pass. Two institution scopes plus personal mode are isolated for membership context. Course enrollment and course-invite acceptance remain absent, so full ED-04 acceptance is unmet. Dependencies: ED-01, ED-02, and ED-26/Contract 03 for enrollment/source grants.

**ED-05** (backlog line 146) — Acceptance: Assigned instructor publishes own course; enrolled learner sees approved source; failed replacement leaves published version intact. Dependencies: ED-04, ED-06, ED-26, ED-30.

**ED-06** (backlog line 164) — Acceptance: Personal private by default; authorized official and explicitly shared material resolves consistently; no stale/private cached source escapes. Dependencies: ED-02, ED-04 for institutional scope.

**ED-07** (backlog line 182) — Acceptance: 2–4 browsers agree on public messages/presence/activity/problem; presenter alone changes shared view; duplicate/reconnect loses no accepted work; no private attempt/answer key leaks. Full page-following checked only in P1. Dependencies: ED-02, ED-06, ED-26, ED-27, ED-29.

**ED-08** (backlog line 208) — Acceptance: Beginner/advanced synthetic responses adapt tasks; hint precedes answer, full explanation on request; no unsupported mastery labels. Dependencies: ED-03, ED-06, ED-10, ED-28.

**ED-09** (backlog line 226) — Acceptance: Peers reason before full answer; known misconception receives supported intervention; quiet learner may decline; group context bounded. Dependencies: ED-07, ED-08, ED-10, ED-12.

**ED-10** (backlog line 246) — Acceptance: Known question cites correct allowed passage; unsupported correction is tentative/pending; no source-access decision is delegated to model. Dependencies: ED-03, ED-06.

**ED-11** (backlog line 264) — Acceptance: Group outcome and each learner next step reproducible; no private leakage or double rewards; untested differs from incorrect. Dependencies: ED-08, ED-09, ED-29.

**ED-12** (backlog line 282) — Acceptance: Real requests use intended categories; 429/timeout/capable loss preserves chat/materials and safe completion; unresolved reasoning never certified. Dependencies: ED-03, ED-07, ED-10.

**ED-13** (backlog line 300) — Acceptance: No credentials or real personal/private learner data reaches model/evidence; no stored voice; synthetic demo succeeds without requiring payment. Dependencies: ED-02, ED-03, ED-04.

**ED-14** (backlog line 318) — Acceptance: P0 scenario gates pass with actual outcomes, sample size and failures recorded; mocks clearly distinguished from real inference. Dependencies: ED-01 through ED-13; ED-26 through ED-32 for P0.

**ED-15** (backlog line 336) — Acceptance: Artifacts meet exact organizer limits, contain honest test/inference evidence and declarations, and clean-start setup is reproducible. Dependencies: ED-14; deadline/service/voice clarifications.

**ED-16** (backlog line 354) — Acceptance: Recorded cases preserve formulas/source meaning; keyboard flow works; unsupported languages/weak outputs disclosed. Dependencies: ED-08, ED-09, ED-14.

**ED-17** (backlog line 372) — Acceptance: Multi-user audio streams connect reliably via LiveKit Cloud; NestJS enforces room authorization and voice consent before token issuance; media disconnection/reconnection works without dropping the room session; student-to-student audio functions independently of AI agent availability. Dependencies: ED-02, ED-07, stable P0.

**ED-18** (backlog line 391) — Acceptance: Only requester sees simplified explanation across events/history/reconnect; no educator/peer access. Dependencies: ED-09, ED-11, ED-13.

**ED-19** (backlog line 409) — Acceptance: Unauthorized instructor denied and small cohorts suppressed; aggregate does not expose private answers/files. Dependencies: ED-04, ED-11, ED-13.

**ED-20** (backlog line 427) — Acceptance: Actual anonymous observation counts and limits recorded; no causal mastery/traction claim. Dependencies: Stable P0, ED-13, ED-14.

**ED-21** (backlog line 445) — Acceptance: AI-generated baseline never labeled official; each selected extension has tested end-to-end flow and does not bypass source ACL. Dependencies: Stable P0; ED-10, ED-13.

**ED-22** (backlog line 463) — Acceptance: Any proposed deletion has reference/runtime proof and regression coverage; retained dependency graph preserved. Dependencies: ED-01; runtime/deployment evidence.

**ED-23** (backlog line 481) — Acceptance: Approved scope and dependency map; any future removal preserves contracted functionality or has explicit migration plan. Dependencies: Stable P0; team product decision.

**ED-24** (backlog line 499) — Acceptance: Prioritized approved requirements backed by pilot evidence/privacy policy; no unsupported scale/traction claim. Dependencies: Validated pilot, ED-04, ED-19.

**ED-25** (backlog line 517) — Acceptance: Agent joins LiveKit room on dispatch; accurately attributes utterances to individual speakers; intervenes peer-first without spoiling answers; latency from speech pause to AI response onset is <1,500ms; muting or disconnection leaves peer audio intact; zero audio recorded to persistent disk. Dependencies: ED-17, ED-09, ED-13; stable P0.

**ED-DOC** (backlog line 536) — Acceptance: Maintained navigation/specs/roles/models/workflows/AI/roadmap/testing/delivery and v1.2 ownership/contract plan exist; no runtime feature changes; history labeled. DONE refers only to documentation, not implementation. Dependencies: Static source audit and documentation/link checks.

**ED-26** (backlog line 554) — Acceptance: Canonical quiz/guided-problem/source/attempt/room/evidence examples agree across all three members; invalid/version-mismatch and visibility rules explicit; no keys/rubrics in public payload. Dependencies: ED-01/02; Habib+Tasnim+Aziz contract review.

**ED-27** (backlog line 574) — Acceptance: Both types work keyboard/mobile with feedback/fallback; reset yields no new accepted evidence; private attempts never broadcast; no eval/inner executable model markup. Dependencies: ED-26, ED-28, ED-29 (solo integration first; room integration is a downstream gate).

**ED-28** (backlog line 592) — Acceptance: Source-backed request selects suitable allowed type; arbitrary code, unknown type/version or forged source fails safely; output is not auto-approved official content. Dependencies: ED-03, ED-10, ED-26.

**ED-29** (backlog line 610) — Acceptance: Forged grade/actor/stale revision denied; retries and concurrent duplicate callbacks create one accepted evidence; pending/unavailable grade gets no mastery/XP; no rubric/private-answer leak. Dependencies: ED-02, ED-26; ED-08 evaluator integration.

**ED-30** (backlog line 628) — Acceptance: Wrong hierarchy can be corrected and re-read; source refs remain traceable or explicitly unknown; simultaneous stale edits rejected; draft not accessible to learners; approved active revision immutable. Dependencies: ED-04, ED-06, ED-26.

**ED-31** (backlog line 646) — Acceptance: Instructor corrects extracted heading, previews a quiz/problem and publishes; learner opens approved revision; independent owner cannot publish institution-official material; stale edit/error visible. Dependencies: ED-26, ED-30, ED-05; ED-27 for preview.

**ED-32** (backlog line 664) — Acceptance: P0 student activity grounded in corrected approved section; P1 settings affect output while unsupported claims/locations stay flagged; AI cannot self-publish or overwrite reviewed draft. Dependencies: ED-06, ED-26, ED-28; ED-30 draft contract.

**ED-33** (backlog line 682) — Acceptance: Concurrent retry/restart awards once and recoverably updates ledger+profile; same achievement once; no reward for chat/views/idle/failed or unverified attempts; XP distinct from mastery. Dependencies: ED-29, ED-11, ED-13; stable P0.

**ED-34** (backlog line 700) — Acceptance: Accepted solo/group check shows one award reason, correct level and badge; repeated refresh shows no duplicate toast/award; XP never appears as academic mastery. Dependencies: ED-33 public projection; ED-27 learner flow.

**ED-35** (backlog line 718) — Acceptance: Chosen algorithm/math example has correct reproducible back/next/reset, accessible controls and room reuse; interaction alone yields no mastery/evidence. Dependencies: ED-26, ED-27; Tasnim-reviewed worked example; stable P0.

## Product-feature crosswalk

F01→ED-02/04; F02→ED-04/05; F03→ED-05/06/30/31; F04→ED-02/06; F05→ED-21; F06→ED-08/10; F07→ED-08/29; F08→ED-11/29; F09→ED-07; F10→ED-17/25; F11→ED-06/07; F12→ED-09/21; F13→ED-18; F14→ED-09/10; F15→ED-11; F16→ED-19; F17→ED-03/12; F18→ED-08/16; F19→ED-02/12/13; F20→ED-26–29/35; F21→ED-05/06/30–32; F22→ED-29/33/34. Feature IDs here follow `docs/product-specification.md`, not the differently numbered brief modules.

## Historical/supplementary scope

M00–M38 are execution missions, many mapped to the same ED tasks, rather than 39 extra accepted product features; M00 and M16 are audit/pre-integration gates. P0-R1/R2/R3 report narrower repair missions. Their prior local runs inform hypotheses only and were not independently replayed here. Contracts 01–18 and test scenarios T01–T38 require item-by-item independent tracing in a continuation; not all have been assessed.

## Product acceptance statements (cross-references, not additional task counts)

These 22 compound acceptance fields are separate product views of the canonical tasks. Statuses are conservative product-level assessments, not proof that every clause was individually traced. Exact original acceptance remains below.

**F01 — Authentication and onboarding**, `docs/product-specification.md:25`; IMPLEMENTED_UNVERIFIED, ED-02/04/13. Acceptance: Verified login/logout/reset preserve identity; no client role override; independent path needs no institution; cross-context access denied.

**F02 — Institutional course management**, `docs/product-specification.md:34`; PARTIAL, ED-04/05. Acceptance: Instructor edits own draft; another institution cannot read it; enrolled learner sees only published version.

**F03 — Instructor-managed materials**, `docs/product-specification.md:43`; PARTIAL, ED-05/06/30/31. Acceptance: Invalid/encrypted uploads fail visibly; failed extraction does not replace published material; source citation opens authorized version.

**F04 — Personal courses and uploads**, `docs/product-specification.md:52`; PARTIAL, ED-02/06. Acceptance: Owner can use extracted content; another user cannot retrieve it through file URL, course ID, AI request or cache.

**F05 — Open-topic learning**, `docs/product-specification.md:61`; PARTIAL, ED-21. Acceptance: Fresh topic produces a labeled activity and check; unsupported assertions are tentative; no invented sources.

**F06 — Individual course-aware AI tutor**, `docs/product-specification.md:70`; PARTIAL, ED-08/10. Acceptance: A known course question yields a relevant citation and hint; no evidence yields uncertainty; full explanation available on request.

**F07 — Knowledge diagnostic and evaluation**, `docs/product-specification.md:79`; PARTIAL, ED-08/29. Acceptance: Beginner and advanced synthetic answers choose suitable tasks; no psychometric label or unsupported mastery percentage.

**F08 — Personalized recommendations**, `docs/product-specification.md:88`; PARTIAL, ED-11/29. Acceptance: Correct/incorrect/untested learners receive distinct justified next steps; result is private and reproducible.

**F09 — Collaborative study rooms**, `docs/product-specification.md:97`; PARTIAL, ED-07. Acceptance: Two browsers see matching presence/messages/phase; unauthorized join denied; rejoin does not duplicate progress.

**F10 — Live voice communication**, `docs/product-specification.md:106`; PARTIAL, ED-17. Acceptance: Three real browsers exchange audio while AI is unavailable; denial/mute/reconnect/leave work; no recorded audio is stored.

**F11 — Shared documents and exercises**, `docs/product-specification.md:115`; PARTIAL, ED-06/07. Acceptance: Browsers converge on source/context/exercise (PDF page-following tested in P1); outsider and unenrolled member cannot fetch official resource.

**F12 — AI facilitation and moderation**, `docs/product-specification.md:124`; PARTIAL, ED-09/12. Acceptance: Incorrect peer reasoning triggers peer-first prompt then supported hint; optional participation invite can be declined without penalty.

**F13 — Private AI assistance**, `docs/product-specification.md:133`; PARTIAL, ED-18. Acceptance: Other room browsers and instructor cannot fetch/observe private request or response, including after reconnect.

**F14 — Misconception detection**, `docs/product-specification.md:142`; PARTIAL, ED-09/10. Acceptance: Known 3NF misconception receives correct grounded intervention; ambiguous evidence is not certified as wrong/right.

**F15 — Session summaries and learning progress**, `docs/product-specification.md:151`; PARTIAL, ED-11. Acceptance: Group recap states shared outcome without private scores/questions; each learner receives own evidence-linked action.

**F16 — Instructor analytics**, `docs/product-specification.md:160`; MISSING, ED-19. Acceptance: Unrelated instructor denied; small cohorts suppressed; aggregates cannot reveal a private learner attempt.

**F17 — Capacity-aware AI operation**, `docs/product-specification.md:169`; PARTIAL, ED-03/12. Acceptance: Compact and capable requests proven with real inference; 429/timeout/non-streaming cases leave chat and materials usable.

**F18 — Multilingual and accessible guidance**, `docs/product-specification.md:178`; PARTIAL, ED-08/16. Acceptance: Recorded examples show source fidelity and usable guidance across tested languages; report failures honestly.

**F19 — Privacy, sharing and error recovery**, `docs/product-specification.md:187`; PARTIAL, ED-02/12/13. Acceptance: Guessed IDs/invites/injected documents cannot cross scopes; retries do not duplicate exercise/result; no secrets/PII in evidence.

**F20 — Intelligent Interactive Learning UI**, `docs/product-specification.md:203`; PARTIAL, ED-26–29/35. Acceptance: Approved-topic activity accepts learner input, returns correct hint/feedback, persists private verified evidence and can reset without farming credit. Invalid type/version/source/payload becomes safe text with no state mutation or execution. Shared presenter view never broadcasts private answers, answer keys or rubrics.

**F21 — AI Course Studio / PDF digitization**, `docs/product-specification.md:211`; PARTIAL, ED-05/06/30–32. Acceptance: Instructor corrects a wrong extracted heading before publishing; authorized students see approved revision/source references; a later draft cannot mutate active sessions. Failed extraction or concurrent edit does not replace approved content. Personal ownership never permits official university publication.

**F22 — Learning-evidence gamification**, `docs/product-specification.md:219`; PARTIAL, ED-29/33/34. Acceptance: Same verified completion and concurrent retries award XP once; forged/stale/other-user evidence denied; replay/restart cannot produce ledger/profile divergence; useful group completion requires personal check. Learner can explain every award/achievement; XP never labels subject mastery. Shops/cosmetics/leaderboards/extensive quests remain post-hackathon.

## Scenario registry (additional acceptance evidence; not separate tasks)

`docs/testing-plan.md` defines the following scenarios. No full scenario was re-executed in this audit; PARTIAL means relevant isolated unit/focused assertions passed, while BLOCKED means its complete required real-service/environment/approval scenario was not run. The scenario statements are retained without asserting each embedded criterion was independently traced.

**T01** (`docs/testing-plan.md:19`): BLOCKED; F01; ED-01/04. Scenario: Register/verify/login, reload, logout/reset/deactivate; attempt role spoof. Acceptance: Cookie identity correct; revoked session denied over HTTP/WS; client teacher field grants no power.

**T02** (`docs/testing-plan.md:20`): BLOCKED; F02; ED-04/05. Scenario: Institution A admin assigns instructor, creates draft, enrollment code used in Institution B. Acceptance: Own scope works; foreign-institution/expired/code-as-role escalation denied; no content enumeration.

**T03** (`docs/testing-plan.md:21`): BLOCKED; F03; ED-05/06. Scenario: Upload, preview, publish; failed replacement and unpublished access. Acceptance: Published version preserved on failure; only assigned instructor publishes and enrolled learner reads.

**T04** (`docs/testing-plan.md:22`): BLOCKED; F04/F19; ED-02/06. Scenario: Private upload; guessed course/file/static URL/index/cache/AI resource refs. Acceptance: Denied before retrieval/inference; explicit sharing exposes only chosen resource to authorized room.

**T05** (`docs/testing-plan.md:23`): BLOCKED; F03/F04; ED-06. Scenario: Wrong MIME/magic/oversize/traversal/encrypted PDF, extraction timeout/retry. Acceptance: Correct recoverable errors, no execution/path escape/partial publication; progress terminal state accurate.

**T06** (`docs/testing-plan.md:24`): BLOCKED; F06; ED-10. Scenario: Ask known grounded question and follow returned citation. Acceptance: Correct authorized material/version/section; no fabricated citation; generated interpretation labeled.

**T07** (`docs/testing-plan.md:25`): BLOCKED; F06/F19; ED-10. Scenario: Unrelated source, injected instructions in document/chat and off-topic request. Acceptance: No policy/source ACL override; unsupported evidence declared; safe relevant guidance.

**T08** (`docs/testing-plan.md:26`): BLOCKED; F07; ED-08. Scenario: Beginner/advanced/untested synthetic answers; change detail preference. Acceptance: Appropriate provisional difficulty and evidence-limited status; no fixed learner-type/intelligence diagnosis.

**T09** (`docs/testing-plan.md:27`): BLOCKED; F06/F12; ED-08/09. Scenario: Learner asks for answer after first attempt. Acceptance: Guiding question/graduated hint before reveal; full explanation available on explicit request.

**T10** (`docs/testing-plan.md:28`): BLOCKED; F09/F11; ED-07. Scenario: Two to four browsers join, type, select source/activity, submit exercise; P1 page-following separately. Acceptance: Matching public activity state; ordering/reconnect/replay deterministic; private attempts separate; no duplicate accepted contribution.

**T11** (`docs/testing-plan.md:29`): BLOCKED; F12/F14; ED-09/10. Scenario: Synthetic wrong 3NF explanation and peer disagreement. Acceptance: AI asks peer for justification then verifies/hints with evidence; ambiguous candidate not falsely certified.

**T12** (`docs/testing-plan.md:30`): BLOCKED; F12; ED-09. Scenario: One learner quiet; invitation declined. Acceptance: Optional respectful invitation; no public ranking, forced turn or penalty; participant can finish.

**T13** (`docs/testing-plan.md:31`): BLOCKED; F15; ED-11. Scenario: Separate final checks then session finish/retry. Acceptance: Private own results/next step; safe public recap; no duplicate completion/reward or mastery overclaim.

**T14** (`docs/testing-plan.md:32`): BLOCKED; F17; ED-03/12. Scenario: Intent/format task then complex reasoning with actual service. Acceptance: Compact and capable category choices traceable, correct and deliberate; approved provider IDs and real requests recorded.

**T15** (`docs/testing-plan.md:33`): BLOCKED; F17; ED-12. Scenario: Disable capable availability / inject 429/timeout/retry exhaustion. Acceptance: Explicit limited mode, bounded approved retry; unresolved verification pending; room/chat/exercise keep working.

**T16** (`docs/testing-plan.md:34`): BLOCKED; F17; ED-12. Scenario: Limited total capacity and duplicate equivalent request. Acceptance: Scoped reuse/dedup, bounded calls/context/output; no quota bypass or cross-user cached content.

**T17** (`docs/testing-plan.md:35`): BLOCKED; F17; ED-12. Scenario: Delayed whole non-streaming response. Acceptance: Visible queued/running progress; controls remain responsive; no fake token streaming or duplicate action.

**T18** (`docs/testing-plan.md:36`): BLOCKED; F18; ED-16. Scenario: English/French/Arabic/Darija and code-switched prompts at two levels. Acceptance: Source meaning, formulas/code and accessible tone retained; actual failures recorded with human rubric.

**T19** (`docs/testing-plan.md:37`): BLOCKED; F19; ED-02/13. Scenario: Outsider/left participant fetches history/voice/source and stays connected during revocation. Acceptance: Resource membership enforced on fetch and delivery, not just login/connect; no later broadcast leak.

**T20** (`docs/testing-plan.md:38`): BLOCKED; F13; ED-18. Scenario: Private help while peer/instructor watches and queries history/cache. Acceptance: Recipient only; private question/answer/check never appears in group recap/events/logs.

**T21** (`docs/testing-plan.md:39`): BLOCKED; F16; ED-19. Scenario: Instructor across courses and cohorts below threshold. Acceptance: Only approved aggregates; identifying small groups suppressed; private files/transcripts never accessible.

**T22** (`docs/testing-plan.md:40`): BLOCKED; F10; ED-17. Scenario: Real devices: microphone denied, mute, 3 peers, network loss, tab close/device switch. Acceptance: Text usable; audio teardown/reconnect correct; media unaffected by AI failure; no recording/transcription persistence.

**T23** (`docs/testing-plan.md:41`): BLOCKED; F19; ED-01/12. Scenario: Worker crash after claim, duplicate result, broker interruption and restart. Acceptance: Bounded lease/retry recovery, one accepted result, consistent progress; durable evaluator resume only when configured.

**T24** (`docs/testing-plan.md:42`): BLOCKED; F19; ED-13. Scenario: Inspect synthetic request/log/report/video/config payloads. Acceptance: No credentials, real identity/voice/private institution or learner profiles; all external services declared.

**T25** (`docs/testing-plan.md:43`): BLOCKED; F05; ED-21. Scenario: Start from topic without source. Acceptance: Generated baseline explicitly labeled; no invented university provenance; safe check and next step.

**T26** (`docs/testing-plan.md:44`): BLOCKED; Delivery; ED-15. Scenario: Fresh evaluator follows setup and replays P0 demo. Acceptance: Reproducible real-inference flow, correct artifact limits and honest evidence/skips.

**T27** (`docs/testing-plan.md:70`): PARTIAL; ED-26; Habib+Tasnim+Aziz review. Scenario: Serialize same source/revision/quiz/guided/attempt/evidence/result/room/proposal fixtures through Node, Python and frontend consumer. Acceptance: Supported versions/enums/visibility agree; revision-tag pins, exact revision FAISS refs, actor-scoped receipts, private guidance, source-free room states and closed proposal mappings agree; invalid bounded payload/type/version rejected consistently; grading key/rubric absent publicly.

**T28** (`docs/testing-plan.md:71`): BLOCKED; ED-06/30/31; Habib Studio + extraction AI. Scenario: PDF with misdetected heading, missing page ref and OCR failure -> instructor correction. Acceptance: Editable hierarchy retains original/provenance; unknown source location marked honestly; recoverable failure, no automatic publication.

**T29** (`docs/testing-plan.md:72`): BLOCKED; ED-05/30/31; Habib Studio + Tasnim activity preview. Scenario: Two instructors edit same draft; publish new revision during active student attempt. Acceptance: Stale write rejected; unauthorized owner denied; active attempt still pins approved original revision/answer policy.

**T30** (`docs/testing-plan.md:73`): PARTIAL; ED-27/28; Tasnim learning UI/API/AI. Scenario: Quiz and guided problem selection, learner input/hint/feedback/retry; unknown UI type and executable HTML/JS/JSX/CSS/formula payload. Acceptance: Shipped components only; deterministic trusted code; safe text fallback; no code execution, partial state mutation or repeated credit.

**T31** (`docs/testing-plan.md:74`): PARTIAL; ED-29; Tasnim learning UI/API/evaluator. Scenario: Forged actor/grade/evidence ID, duplicate concurrent submission, delayed callback and unavailable evaluation. Acceptance: Tasnim resolves identity/version and uses Habib source-access contract; accepted evidence once; uncertainty/pending receives no mastery/XP; private answers protected.

**T32** (`docs/testing-plan.md:75`): BLOCKED; ED-07/27/29; Aziz rooms + Tasnim activity/evaluation + Habib source. Scenario: Presenter changes step while learners answer privately; stale event/reconnect/participant revocation. Acceptance: Authoritative public sequence/snapshot converges; presenter cannot submit for others or broadcast their private answers.

**T33** (`docs/testing-plan.md:76`): BLOCKED; ED-32; Habib Studio AI/preview using Tasnim renderer. Scenario: Instructor setting changes language/difficulty/hint policy/allowed sources. Acceptance: P1 candidate reflects settings, provenance retained, generated enrichment never auto-approved; failed generation keeps reviewed source.

**T34** (`docs/testing-plan.md:77`): BLOCKED; ED-33; Tasnim. Scenario: Same accepted completion delivered with new transport IDs, repeated attempt IDs and concurrent retries. Acceptance: Stable logical completion key; one capped XP/achievement application; no old/new reward double count.

**T35** (`docs/testing-plan.md:78`): BLOCKED; ED-33; Tasnim. Scenario: Crash after event claim before profile increment; replay after partial write. Acceptance: Recover to exactly one effect and accurate reason/history; ledger existence alone cannot suppress a missing update.

**T36** (`docs/testing-plan.md:79`): BLOCKED; ED-33/34; Tasnim. Scenario: Idle duration, AI calls/chat volume, wrong answers, group presence, unsupported peer-help claim. Acceptance: No learning XP for these alone; no mistake penalties; learner sees verified/pending and motivation level separately from subject evidence.

**T37** (`docs/testing-plan.md:80`): BLOCKED; ED-35; Tasnim full-stack visualization. Scenario: One deterministic algorithm/math visualizer: next/back/reset/bounded input. Acceptance: Reproducible correct output, keyboard/mobile/reduced-motion support, no generated code or automatic mastery claim.

**T38** (`docs/testing-plan.md:81`): BLOCKED; ED-14/15; Aziz + Habib/Tasnim. Scenario: Instructor corrects/publishes -> solo interactive check -> same room activity/AI peer hint -> private checks/progress -> optional XP. Acceptance: Full P0 uses real approved inference and survives capable outage; P1 reward shown only if implemented and T34–T36 pass; no prewritten screen presented as real feature.

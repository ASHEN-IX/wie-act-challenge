# EdNova product and functional specification

Version: **v1.2 alignment**, 18 October 2026. Latest direction: [brief v1.2](reference/ednova-brief-v1.2.md), especially §§39–43. **CURRENT** = source exists (operational limits in [validation](../../audit/2026-10-18/VALIDATION.md)); **TARGET** = intended design; **PLANNED** = work not delivered. Feature status describes the target feature as a whole, not whether some reusable code exists.

## Vision and educational value — TARGET / team proposal

EdNova helps learners understand difficult concepts alone and with peers. Unequal participation, fear of asking questions, unverified explanations and differing levels/languages can leave a group without clear outcomes. The AI diagnoses provisionally, asks guiding questions, offers hints, helps peers examine misconceptions, checks understanding and suggests next steps. It supports teachers and classmates.

Universities supply instructor-reviewed official courses (B2B2C); independent learners create private courses and upload their own resources (B2C). One learner identity supports both contexts. An institutional approval label applies to source material, not every AI response. Buyers/adoption/sustainability are hypotheses in [delivery](hackathon-delivery.md), without validated pricing or traction.

## Organizer requirements versus team scope

The [official PDF](reference/EdNova_Challenge_Specification_book.pdf), pp. 1–3, requests individual/group learning support, diagnostic/adaptive guidance, real end-to-end inference, deliberate compact/capable model combination, visible non-streaming progress, efficient shared-capacity use and correct handling of temporary unavailability. No training/fine-tuning is available; retrieval is allowed. Privacy, platform use, phases, limits and judging rules are maintained in [delivery](hackathon-delivery.md). Multilingual interaction and real-user testing are bonus opportunities; voice, gamification and instructor dashboards are possible extensions.

The university adoption model, five responsibility roles, 2–4 person rooms, explicit sharing, Socratic/Group Challenge modes and the P0/P1 choices below are team proposals. They are not organizer-mandated architecture/features. No requested feature is being implemented during this audit.

**Hackathon boundary:** one fictional institution, one official course and one personal course, one technical topic, short diagnostic, grounded individual practice, invite-only text/resource/exercise room, peer-first AI intervention, private individual check, group recap and safe model fallback. P0 also includes PDF-to-editable-course review/publication and two trusted interactive types (quiz and guided problem). **P1:** evidence-based XP/levels/2–3 achievements, robust optional voice, one deterministic visualizer, richer course customization, private explanations, multilingual UX and minimal aggregate insights. **P2:** open-topic extension, annotations, additional facilitation modes and experimental speech-aware AI. Basic source/context sharing is P0; full synchronized PDF viewer/page-following is P1 under v1.2 §43. Enterprise governance/SSO, commerce, public matching, rich gamification, graph infrastructure and long-term analytics are post-hackathon. Existing reusable legacy features remain intact.

The default guaranteed communication path is text. Live voice requires organizer clarification against the instruction to avoid collecting voices; no default recording/transcription. No fixed psychological learning-type labels or validated-mastery claims based on a few questions.

## Feature contracts

All acceptance criteria below are future validation gates, not passing test claims. Roles follow [permissions](roles-and-permissions.md). Dependencies refer to [backlog IDs](sprint-backlog.md); that backlog owns task status and effort. Complete journeys are in [workflows](workflows.md).

### F01 — Authentication and onboarding

- **Purpose, actors and main flow:** All users establish identity and select institutional or personal learning context. Sign up → verify email → log in → choose course/context.
- **TARGET behavior:** Retain cookie sessions, logout/reset and inactive-account rejection; prefer synthetic aliases in the demo. Membership never changes identity.
- **CURRENT status/evidence:** PARTIAL: Better Auth, server identity and onboarding profile fields exist; no institutional context switch.
- **Missing:** Scoped membership onboarding and privacy-safe demo provisioning.
- **Priority/dependencies:** P0; ED-02, ED-04, ED-13
- **Acceptance:** Verified login/logout/reset preserve identity; no client role override; independent path needs no institution; cross-context access denied.

### F02 — Institutional course management

- **Purpose, actors and main flow:** University admin assigns instructor; instructor creates an official course under the institution.
- **TARGET behavior:** Course has owner, institution, objectives and draft/published state; administrator handles membership metadata.
- **CURRENT status/evidence:** PLANNED: personal Course exists, institutional ownership/enrollment does not.
- **Missing:** Institution, membership, enrollment, publication lifecycle and minimal setup UI.
- **Priority/dependencies:** P0; ED-04, ED-05
- **Acceptance:** Instructor edits own draft; another institution cannot read it; enrolled learner sees only published version.

### F03 — Instructor-managed materials

- **Purpose, actors and main flow:** Instructor uploads safe source → previews extraction → reviews objectives → publishes.
- **TARGET behavior:** Validate type/size; show recoverable failures; retain approved provenance/version; generated content is not silently approved.
- **CURRENT status/evidence:** PARTIAL reusable ingestion/status/objectives; instructor review/publication absent.
- **Missing:** Publication review, official provenance and version visibility.
- **Priority/dependencies:** P0; ED-05, ED-06
- **Acceptance:** Invalid/encrypted uploads fail visibly; failed extraction does not replace published material; source citation opens authorized version.

### F04 — Personal courses and uploads

- **Purpose, actors and main flow:** University or independent learner creates subject/course → uploads own PDF/text → waits for extraction.
- **TARGET behavior:** Personal by default; explicit room sharing; preserve owner-scoped CRUD and recoverable ingest.
- **CURRENT status/evidence:** PARTIAL: CourseUpload, courses routes, ingest worker/progress exist, with unresolved isolation paths.
- **Missing:** End-to-end ACL verification, sharing/provenance and challenge-safe data handling.
- **Priority/dependencies:** P0; ED-02, ED-06
- **Acceptance:** Owner can use extracted content; another user cannot retrieve it through file URL, course ID, AI request or cache.

### F05 — Open-topic learning

- **Purpose, actors and main flow:** Learner enters goal without file → accepts AI-generated baseline → practices.
- **TARGET behavior:** No institution required; label generated/ungrounded material and uncertainty; do not imply approval.
- **CURRENT status/evidence:** PARTIAL reuse: manual courses and free-form planner/search; no verified complete open-topic tutoring loop.
- **Missing:** Coherent no-upload learning flow, labels and safe exercise validation.
- **Priority/dependencies:** P2; ED-21
- **Acceptance:** Fresh topic produces a labeled activity and check; unsupported assertions are tentative; no invented sources.

### F06 — Individual course-aware AI tutor

- **Purpose, actors and main flow:** Learner selects objective → asks question → reasons with hint → requests explanation.
- **TARGET behavior:** Retrieve authorized passages; progressive hints before full answer; adapt detail/language and allow answer request.
- **CURRENT status/evidence:** PARTIAL: Socratic evaluator, planner RAG and web search are separate reusable paths, not an integrated course tutor.
- **Missing:** Unified scoped tutoring context, reliable citations and learning-session policy.
- **Priority/dependencies:** P0; ED-06, ED-08, ED-10
- **Acceptance:** A known course question yields a relevant citation and hint; no evidence yields uncertainty; full explanation available on request.

### F07 — Knowledge diagnostic and evaluation

- **Purpose, actors and main flow:** Learner answers 2–4 checks → provisional starting level → adaptive exercise.
- **TARGET behavior:** Use actual answers and adjustable preferences; not-tested differs from poor performance.
- **CURRENT status/evidence:** PARTIAL: evaluator state machine, scoring and result persistence exist.
- **Missing:** Pre-topic diagnostic contract, adaptive difficulty and cautious learner-facing interpretation.
- **Priority/dependencies:** P0; ED-08
- **Acceptance:** Beginner and advanced synthetic answers choose suitable tasks; no psychometric label or unsupported mastery percentage.

### F08 — Personalized recommendations

- **Purpose, actors and main flow:** Learner completes checks → sees one evidence-linked next step → can retry.
- **TARGET behavior:** Use objective/attempt evidence; retain uncertainty; no message-count-based intelligence inference.
- **CURRENT status/evidence:** PARTIAL: planner, coach, pacing/reviews and competency profiles.
- **Missing:** Session-level pedagogical next steps linked to private results.
- **Priority/dependencies:** P0; ED-11
- **Acceptance:** Correct/incorrect/untested learners receive distinct justified next steps; result is private and reproducible.

### F09 — Collaborative study rooms

- **Purpose, actors and main flow:** Learner creates room for authorized context → invites 2–4 peers → works on shared goal.
- **TARGET behavior:** Private invite, presence, learner text, phase and reconnect; enforce course AND room membership.
- **CURRENT status/evidence:** PARTIAL: team invites/participants/task progress, WebSockets, team lobby/live screen.
- **Missing:** General peer text and room pedagogical state, ACL/reconnect guarantees.
- **Priority/dependencies:** P0; ED-02, ED-07
- **Acceptance:** Two browsers see matching presence/messages/phase; unauthorized join denied; rejoin does not duplicate progress.

### F10 — Live voice communication

- **Purpose, actors and main flow:** Room participant grants microphone → joins → mutes/unmutes → reconnects/leaves.
- **TARGET behavior:** Audio independent of AI; explicit notice; no recording/transcription; text remains available.
- **CURRENT status/evidence:** PARTIAL: peer WebRTC/STUN, audio hooks, signaling, mute and voice persistence; no verified live call.
- **Missing:** Organizer permission clarification, network/TURN decision, reliability and consent/error tests.
- **Priority/dependencies:** P1; ED-17
- **Acceptance:** Three real browsers exchange audio while AI is unavailable; denial/mute/reconnect/leave work; no recorded audio is stored.

### F11 — Shared documents and exercises

- **Purpose, actors and main flow:** Owner explicitly shares selected context/exercise → group opens same problem (PDF page-following in P1) → peers submit reasoning.
- **TARGET behavior:** Authorize selected resource for all participants; sync exercise/context in P0, with PDF page-following in P1; no arbitrary document editing; keep private submissions separate.
- **CURRENT status/evidence:** PARTIAL: shared taskProgress and course summaries; no synchronized PDF/page/activity model.
- **Missing:** Explicit resource ACL grants, page events and structured peer exercise submissions.
- **Priority/dependencies:** P0; ED-06, ED-07
- **Acceptance:** Browsers converge on source/context/exercise (PDF page-following tested in P1); outsider and unenrolled member cannot fetch official resource.

### F12 — AI facilitation and moderation

- **Purpose, actors and main flow:** Learners invoke facilitator/checkpoint → peer question → critique → grounded hint/verification.
- **TARGET behavior:** Socratic and Group Challenge presets share policy; AI does not respond to every message or dominate discussion.
- **CURRENT status/evidence:** PLANNED: coach rules/evaluator are reusable but not group facilitators.
- **Missing:** Room state machine, intervention selection, opt-in controls and quiet-participant policy.
- **Priority/dependencies:** P0; ED-09, ED-10, ED-12
- **Acceptance:** Incorrect peer reasoning triggers peer-first prompt then supported hint; optional participation invite can be declined without penalty.

### F13 — Private AI assistance

- **Purpose, actors and main flow:** Participant asks privately for simpler explanation → receives recipient-only response.
- **TARGET behavior:** Private question/context/results never broadcast or exposed to educators; sharing requires explicit consent.
- **CURRENT status/evidence:** PLANNED: individual job ownership exists; room side channel does not.
- **Missing:** Scoped private channel and visibility enforcement at persistence/delivery/log boundaries.
- **Priority/dependencies:** P1; ED-18
- **Acceptance:** Other room browsers and instructor cannot fetch/observe private request or response, including after reconnect.

### F14 — Misconception detection

- **Purpose, actors and main flow:** Learner/peer offers suspect explanation → facilitator marks candidate → peers justify → AI verifies.
- **TARGET behavior:** Ground complex corrections or use validated answer key; unresolved claims stay tentative when capability absent.
- **CURRENT status/evidence:** PARTIAL reusable evaluator feedback/scoring; no group misconception workflow.
- **Missing:** Candidate tracking, peer critique, supported verification and deferred state.
- **Priority/dependencies:** P0; ED-09, ED-10, ED-12
- **Acceptance:** Known 3NF misconception receives correct grounded intervention; ambiguous evidence is not certified as wrong/right.

### F15 — Session summaries and learning progress

- **Purpose, actors and main flow:** Group finishes exercise → each completes private check → group sees safe recap and individual next step.
- **TARGET behavior:** Separate observed facts from model inference; persist minimum progress; no private profile in group summary.
- **CURRENT status/evidence:** PARTIAL: session summary/notes, eval results, competency evidence and analytics.
- **Missing:** Pedagogical debrief, private check integration and evidence/uncertainty labels.
- **Priority/dependencies:** P0; ED-11
- **Acceptance:** Group recap states shared outcome without private scores/questions; each learner receives own evidence-linked action.

### F16 — Instructor analytics

- **Purpose, actors and main flow:** Instructor opens owned course → sees aggregate practice/gaps.
- **TARGET behavior:** Suppress small/identifying cohorts; no default transcript or private-file access.
- **CURRENT status/evidence:** PLANNED: general admin/user analytics exists, course instructor insight does not.
- **Missing:** Institution/course aggregate scope, privacy thresholds and separate permissions.
- **Priority/dependencies:** P1; ED-19
- **Acceptance:** Unrelated instructor denied; small cohorts suppressed; aggregates cannot reveal a private learner attempt.

### F17 — Capacity-aware AI operation

- **Purpose, actors and main flow:** Any learner requests AI → sees progress → gets validated result or explicit limited mode.
- **TARGET behavior:** Deliberate compact/capable routing, bounded retries/calls, duplicate reuse where authorized, non-streamed results.
- **CURRENT status/evidence:** PARTIAL: jobs/progress, LiteLLM per-agent routes/retries/fallback; no organizer mapping or group degraded mode.
- **Missing:** Real approved service, category trace, quota handling and safe deferral preserving room operation.
- **Priority/dependencies:** P0; ED-03, ED-12
- **Acceptance:** Compact and capable requests proven with real inference; 429/timeout/non-streaming cases leave chat and materials usable.

### F18 — Multilingual and accessible guidance

- **Purpose, actors and main flow:** Learner chooses language/detail → asks in English/French/Arabic/Darija → adjusts preference.
- **TARGET behavior:** Keep code/formulas intact, explain at learner level and support keyboard-readable interaction without shaming.
- **CURRENT status/evidence:** PARTIAL: profile language and prompt infrastructure; multilingual pedagogical quality not validated.
- **Missing:** Fixed language/level evaluation and accessible primary controls; richer code-switch UX follows P0.
- **Priority/dependencies:** P1 with basic level adaptation in P0; ED-08, ED-16
- **Acceptance:** Recorded examples show source fidelity and usable guidance across tested languages; report failures honestly.

### F19 — Privacy, sharing and error recovery

- **Purpose, actors and main flow:** Any actor requests a protected resource or recovers a failed job/session.
- **TARGET behavior:** Deny before download/retrieval/inference; sanitize provider inputs; explicit sharing and retention; recover without duplicates.
- **CURRENT status/evidence:** PARTIAL: ownership middleware, upload checks, prompt/SSRF guards, leases, redaction and auth; gaps remain.
- **Missing:** Resource checks, challenge-safe payload policy, cache/WS revocation and failure regression evidence.
- **Priority/dependencies:** P0; ED-01, ED-02, ED-13, ED-14
- **Acceptance:** Guessed IDs/invites/injected documents cannot cross scopes; retries do not duplicate exercise/result; no secrets/PII in evidence.


## v1.2 integration and priority resolution

The current product contract below supplements F01–F19 and supersedes earlier proposal rankings where they conflict. It does not change organizer rules. One definition/attempt/evidence pipeline serves solo study and rooms: instructor PDF -> extracted draft -> correction/approval -> published revision -> AI-selected trusted activity -> solo/room interaction -> individual assessment -> private progress -> optional P1 rewards. Personal uploads use the same engine privately; open-topic material is explicitly generated, not institution-approved.

For F03/F11, retaining a source pointer and sharing the selected exercise/context is P0. A fully synchronized PDF viewer/page-following UI is P1. For F16, aggregates remain P1. F05 open-topic completion remains P2. No cosmetic/leaderboard work is required for basic P1 rewards. Rich authoring/advanced document formats and always-listening speech remain later work.

### F20 — Intelligent Interactive Learning UI

- **Purpose / roles / flow:** University or independent learner asks a grounded question -> AI selects a trusted activity -> learner interacts/submits -> server evaluates -> evidence/next step updates; the same activity can be launched in a room.
- **TARGET behavior:** P0 `InteractiveQuiz` and `GuidedProblem`; allowlisted React registry, versioned bounded public schema, stateful input, hints/reset/retry, accessible mobile/keyboard/reduced-motion behavior and safe text fallback. No LLM-authored HTML/JS/JSX/CSS or executable formulas. P1 `StepByStepVisualizer`, `ParameterExplorer` and `InteractiveComparison`, with only one deterministic subject-specific example committed before expansion; ConceptMap/large catalogs later.
- **CURRENT / REUSABLE:** `src/components/SocraticEvaluation.tsx` provides text question/answer/job feedback; existing UI primitives, stores and evaluator validation are reusable. There is no verified activity registry, schema-driven selector or shared ActivityDefinition/Attempt contract. Existing charts/backgrounds are not educational interactive simulations.
- **Missing / dependency / priority:** ED-26 contracts -> ED-27 renderer + ED-28 selector -> ED-29 private attempts/evidence, ED-07 room synchronization, ED-10 grounding, ED-12 fallback. P0; additional visualization ED-35 P1.
- **Acceptance:** Approved-topic activity accepts learner input, returns correct hint/feedback, persists private verified evidence and can reset without farming credit. Invalid type/version/source/payload becomes safe text with no state mutation or execution. Shared presenter view never broadcasts private answers, answer keys or rubrics.

### F21 — AI Course Studio / PDF digitization

- **Purpose / roles / flow:** Assigned instructor uploads PDF -> extraction proposes chapter/section/topic hierarchy -> corrects structure/objectives -> previews activities -> approves/publishes revision -> enrolled learner studies one approved section. Independent learner receives a simplified private variant.
- **TARGET behavior:** Keep original files/source locations; mark extracted vs AI-enriched vs manual text; flag uncertainty. P0 editable hierarchy (rename/reorder/add/remove and correct boundaries), manual objective correction and instructor approval. P1 richer merge/split editing, per-section language/difficulty/pedagogy, answer/retry/rubric settings and generation/preview convenience. Unsupported/scanned extraction fails recoverably or uses explicitly supported OCR. Do not invent missing page references.
- **CURRENT / REUSABLE:** Ingestion has PDF/OCR, sections/subtopics/concepts/objectives/chunks/embeddings and processing status; Course stores files/topics and `aiCourseId`. No instructor Studio editor, reviewed revision publication or stable page provenance across the full pipeline exists. Broker job publication is not academic-content publication.
- **Missing / dependency / priority:** Extend ED-05/ED-06 rather than duplicate ingestion/publishing; ED-30 draft-edit API, ED-31 editor, ED-32 source-backed proposals, ED-26 revision/source/activity contracts; ED-04 membership. P0 minimum; P1 rich customization.
- **Acceptance:** Instructor corrects a wrong extracted heading before publishing; authorized students see approved revision/source references; a later draft cannot mutate active sessions. Failed extraction or concurrent edit does not replace approved content. Personal ownership never permits official university publication.

### F22 — Learning-evidence gamification

- **Purpose / roles / flow:** Learner completes verified solo exercise or group challenge/private check -> server accepts evidence once -> derives reward -> updates XP/level/achievement -> learner sees reason. Instructors may see permitted aggregates, not private award evidence.
- **TARGET behavior:** Server-owned versioned reward policy, per-user completion uniqueness, caps/repeat controls, safe retry/recovery and explainable 2–3 achievements. Global XP level is motivation, distinct from subject/Bloom evidence and academic grades. No XP from views/messages/idle time/AI-call count; no penalty for mistakes. Peer-help credit requires supported contribution plus later understanding evidence; do not infer causality or award it automatically in P1.
- **CURRENT / REUSABLE:** `Gamification.ts` stores totalXp, level, history, stats and achievement catalog; level is `floor(totalXp/100)+1`. `/gamification/award-xp` is admin/internal-only; action/custom xp is accepted from privileged callers and awards before the separate rank path. RankEventLedger/awardService has event-key dedup/caps for ranking KP, not guaranteed XP dedup. UI store/profile/level notifications exist. Legacy rewards include uploads/friends/duration-related actions, so learning evidence policy remains missing.
- **Missing / dependency / priority:** ED-29 accepted evidence -> ED-33 replay-safe trusted awards -> ED-34 explainable feedback UI. P1 only after P0 stable. Preserve existing legacy behavior until an explicit migration/compatibility decision; do not silently apply new rewards and old completion rewards twice.
- **Acceptance:** Same verified completion and concurrent retries award XP once; forged/stale/other-user evidence denied; replay/restart cannot produce ledger/profile divergence; useful group completion requires personal check. Learner can explain every award/achievement; XP never labels subject mastery. Shops/cosmetics/leaderboards/extensive quests remain post-hackathon.

Illustrative brief rewards (+15 exercise, +40 concept evidence, +10 valid session, +25 group challenge, +30 supported peer help, +20 comparable improvement) are **unapproved examples**, not implemented/configured values. ED-33 must select a conservative policy and measurable eligibility before use. Prefer exercise/group completion plus a small milestone achievement; defer unverifiable mastery/peer-mentor labels.

## Implementation ownership

See the [three-member delivery plan](team-delivery-plan.md) for full-stack module ownership, shared-symbol boundaries, interface handoffs, critical-path gates and exact work packages. The [backlog](sprint-backlog.md) is the only task-status register; the [v1.2 report](../../audit/2026-10-18/EDNOVA_V1_2_UPDATE.md) summarizes verified implementation versus missing work.

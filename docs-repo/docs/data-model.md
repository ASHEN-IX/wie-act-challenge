# Data model — CURRENT schemas and TARGET concepts

No collections, fields, migrations or persistent data were changed in this audit. String references in existing schemas are generally application-managed links, not database foreign keys. The conceptual additions below are design guidance, not instructions to create one collection per row.

## CURRENT persistence

| Schema / collection | Verified source | Important fields and relationships | Ownership / limits |
|---|---|---|---|
| Domain User / `users` | `modules/auth/src/models/User.ts` | `_id`, email/name, student/admin, active/verified, tier/expiry, legacy credentials | One domain identity; no institution membership; privacy-sensitive fields exist |
| Better Auth collections | `shared/betterAuth.ts` | `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications`, `auth_rate_limits`; domain user shares ID | Sessions authorize identity; no new EdNova role model |
| UserProfile, AvailabilitySlot | `modules/user-profile/src/models/` | User linkage, preferences, availability | Personal profile/scheduling; not an institution roster |
| Subject, Topic | `modules/study/src/models/index.ts` | `userId`, name/description; Topic study time/mastery | Owned personal organization; not necessarily institutional course topics |
| Course | Same study schema | `userId`, `subjectId`, title, processing/completed/failed, files, topics/subtopics/chunks/objectives, job/correlation IDs, ingest stage/progress/error, `aiCourseId` | Owner-scoped CRUD; processing status is NOT publication; Python course ID may differ |
| LearningObjective / `learning_objectives` | Study model; AI orchestrator read view | `userId`, `documentId`, `objectiveId`, `topicId`, knowledgeType, bloomLevel, verb/text/hash, version/isActive/classification | Unique document/topic/textHash; documentId is existing source link, not institution-aware material identity |
| StudySession | Study model | `userId`, course/topic/task/plan refs, solo/team, participants, inviteCode/maxParticipants, taskProgress, timing/status/notes/signals | Owner + team participants; active/completed is not pedagogical phase; inviteCode currently stored directly |
| Task / StudyPlan | Study model and AI view | User/course/goal, task graph, prerequisites, objective/Bloom targets, status and time | Personal planning state; preserve existing views/collection mapping |
| AiJob / `ai_jobs` | `modules/ai-orchestrator/src/models/AiJob.ts` | Actor/type, correlation/message IDs, status/result/error/progress/expiry metadata | Existing async operation record; not a complete privacy-scoped AI conversation |
| EvalResult / `eval_results` | AI writer and study read view | User/session/step, masteryScore/scores, nextQuestion, objective, target/demonstrated Bloom, processing lease | Evaluation evidence, not scientifically established durable mastery |
| CompetencyProfile / `competency_profiles` | Study schema/updater | User/topic/knowledgeType/Bloom key; score, confidence, bounded evidence (20 entries) | Private learner estimate; unique compound key; updates need baseline fixture repair |
| CompetencyProcessing / `competency_processing` | Study schema | Unique correlationId, processedAt; read view also tracks lease fields | Idempotency/recovery bookkeeping; do not delete as non-MVP data |
| SessionChat | Notification models | `sessionId`, `userId`, query/result/coach_suggestion, content/search results | No free peer-message/facilitator event model; current history queries session only |
| VoiceSession | Notification models | Session ID, active/ended, participant peerId/mute/speaking/connection/heartbeat stats, nullable recordingUrl | Field is not evidence of implemented recording; privacy review for speech statistics |
| AnalyticsEvent, FocusSession | Analytics/signals models | Events, user/session references, focus/fatigue telemetry | Not authorized course-level instructor aggregates |
| Gamification, Quest, Rank*, Friendship | User-profile models | XP, rewards, seasons, badges, social linkage | Active personal/team subsystem, preserved |
| Payment / Coupon | Auth models | Checkout/payment and discount bookkeeping | Active entitlement dependencies; not required hackathon commerce |

Paths in this table are beneath `study-partner-api/` unless specified. Inspect actual schema options before relying on inferred Mongoose collection names; only explicit/verified names are written above.

Python also persists normalized courses, chunks/embeddings, plans/pacing/reviews, coach actions and reflection metrics through repositories. `agents/course_ingestion/services/database_service.py` and `services/vector_store/adapter.py` use configured Mongo storage; `agents/planner/rag/index_store.py` stores per-course FAISS/chunk metadata on disk. Worker idempotency and evaluator session state default to process memory, with Redis variants when configured. Do not infer restart safety from in-memory state or that Node/Python automatically share all collection IDs. Reconcile source ownership across the Node Course -> aiCourseId -> Python course -> vector index chain before reuse.

## TARGET concepts (PLANNED)

| Concept | Reuse candidate / proposed relationship | Ownership, visibility and missing boundary |
|---|---|---|
| User | Keep existing domain identity + auth IDs | Same learner can act personally and in several institutions; aliases for demo, no duplicate accounts |
| Institution | New minimal institution/workspace concept | Owns official courses and membership metadata; no default private-library access |
| InstitutionMembership | New user ↔ institution link with scoped role/status | Institution admin/instructor/student permissions; invitation/revocation, not global role replacement |
| Course | Extend/reuse Course with personal owner OR institutional owner, assigned instructor and publication/version | Private personal default; published official visible to enrolled members; must not reinterpret ingest status as published |
| CourseEnrollment | New course ↔ user access relationship | Course invite grants learner access only; no teacher promotion; validate active membership where required |
| CourseMaterial | Existing embedded files/topics + stable source/version/provenance/ACL concept | Instructor-reviewed official or private upload; room-sharing grant is explicit; retrieval/download use same source ACL |
| LearningObjective | Reuse objective/version model linked to course/material/topic | Instructor approval vs extracted draft classification explicit |
| LearningSession | Reuse StudySession for solo or course learning context | Individual learner owns private diagnostic/history/next step; no broad instructor read |
| StudyRoom | Prefer adaptation of team StudySession | Creator/context, allowed sources, hashed/expiring invitation, facilitation mode/phase; course membership independent of room invitation |
| StudyRoomParticipant | Reuse participant array or dedicated view as needed | Room/user/alias, active membership, consent and voluntary presence; private levels/checks separate |
| SharedActivity | Adapt taskProgress with exercise/source/version and submissions | Shared prompt/public reasoning separate from recipient-only answers; version/sequence prevents stale replay |
| Assessment | Reuse evaluator sessions + EvalResult | Objective, question/answer/outcome and evidence with uncertainty; individual access boundary |
| LearningProgress | Reuse competency evidence plus lean session outcome | Not tested/needs practice/improving/next step; no invented numeric mastery validity |
| AIInteraction | Reuse AiJob/correlation plus minimal operation metadata | Source IDs/version, model category, latency/retry/fallback/validation, room or private recipient scope; raw prompt retention not default |

## Relationship and lifecycle rules — TARGET

A User has many memberships and enrollments and owns personal Courses. An Institution has Courses; each institutional Course has assigned instructors, Materials, Objectives and Enrollments. A room references an authorized course/topic/material selection and contains participants/activities. A LearningSession and Assessment belong to a learner even when an activity is shared. AIInteraction ties an operation to scoped sources and audience; a room ID alone must never grant personal progress access.

Check identity, institution/course membership, source visibility and room membership before fetching or indexing for a request. Re-check on revocation and result delivery; scope caches by source version and authorized audience. Published versions should survive failed re-ingestion. Sharing/revocation must define how existing room snapshots are invalidated. Retention, invite expiry and aggregate thresholds remain open team decisions (ED-04/ED-06/ED-13); no production deletion/migration is authorized here.

## v1.2 conceptual additions — TARGET, no migration performed

Prefer adapting existing Course/files/topics, LearningObjective, EvalResult, StudySession, CompetencyProfile and Gamification rather than one new table/service per concept. No current schema implements the entire following model.

| Concept | REUSABLE implementation / proposed link | Ownership/version rule |
|---|---|---|
| CourseSourceFile | Existing Course.files + original upload, stable source ID/hash and page provenance | Preserve original; mark unavailable/unknown page locations explicitly; same ACL as course/private owner |
| ExtractedSection | Existing topics/subtopics/chunks -> editable stable section IDs/hierarchy | Source file/range plus extracted/AI-generated/manual label and needs-review flag; rename/reorder cannot lose provenance |
| CourseRevision | Existing processing status is not this; proposed revision snapshot | Draft/review/publish independent of ingest; instructor+expected revision checks; immutable published revision referenced by active sessions |
| ActivityDefinition | Reuse objective/task/evaluator context with schemaVersion/type/componentVersion and immutable activity revision | Approved definitions tied to course/section/objective/source revision; public projection excludes answer key/rubric; generated runtime variant is labeled separately |
| ActivityAttempt | Reuse evaluator job/session/result patterns | User/activity/revision/attemptId, step/input/status/submission idempotency; private by default even inside room |
| LearningEvidence | Extend/reuse EvalResult + competency processing | Server-accepted outcome references attempt, learner, objective, course/activity revision, evaluator/rubric version and uncertainty; never client/LLM asserted mastery |
| GamificationEvent | Reuse existing rank-ledger/idempotency patterns after review | Accepted evidence -> deterministic reward effect; per-user completion key independent of delivery retries; pending/applied/recovered state prevents ledger/profile divergence |
| XPAccount | Reuse Gamification totalXp/level/history | Do not create parallel XP balance or confuse ranking KP/global XP/subject evidence; preserve legacy totals unless explicit policy migration |
| AchievementDefinition | Reuse ACHIEVEMENT_CATALOG with explicit learning rules/version | 2–3 deterministic, measurable conditions using accepted evidence; illustrative mentor/mastery labels are not validated facts |
| EarnedAchievement | Reuse Gamification achievements with durable uniqueness | User+logical achievement ID uniqueness, rule version metadata and eligible evidence links; policy upgrades do not silently re-award; concurrent unlock/replay once; private reason visible to owner |

Proposed content states: UPLOADED -> EXTRACTING -> DRAFT -> REVIEWED -> PUBLISHED, with FAILED/NEEDS_REVIEW exceptions. These are governance states, not replacements for existing Course processing/completed/failed or AiJob enums. Publishing resolves draft revision + approved activities + source manifest together. A later draft/re-ingest cannot silently rebind an active attempt to a new answer key.

Public room state references selected activity/revision and presenter view sequence; participant private attempts/results live under recipient scope. Accepted-evidence uniqueness, award uniqueness and recovery must be designed together: a unique ledger insert with a separately failing XP update does not guarantee exactly-once user-visible effects. Existing ranking eventKey dedup is for ranking KP; it cannot be claimed for existing XP additions. See ED-26/29/33 and [shared contracts](team-delivery-plan.md).

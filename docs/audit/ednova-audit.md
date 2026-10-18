# EdNova legacy audit and realignment — 18 October 2026

> Historical baseline before repository preparation/frontend rebuild. Paths and results describe that audit; see [latest preparation results](cleanup.md) and [current frontend](../frontend-web.md) for subsequent changes.
## Executive assessment

The checkout is a single Git repository containing a pnpm workspace (11 packages), a separately operated Python AI tree, and an embedded documentation directory. The source contains substantial learning infrastructure, but **EdNova is a target direction, not a delivered product**. Next.js/NestJS boundaries are present; claims that the migration is fully verified or production-ready are contradicted by current checks and the earlier [remediation handoff](validation.md).

Reusable assets include personal course ingestion, learning objectives, planning, scheduling, Socratic individual evaluation, competency evidence, job retries/DLQs, session invitations, WebSockets and peer WebRTC audio. Major gaps are institutional authorization, publication/enrollment, deliberate challenge-service model categories, group pedagogy, synchronized learning resources and private follow-up. Existing search is primarily web search; planner RAG is not a completed course-grounded tutor.

The architecture is reusable without a framework/database migration. Maintenance costs arise from a large feature surface, generated controller dispatch into legacy contract handlers, mixed module systems, duplicated Python paths, large ML dependencies and stale operational documentation. Preserve these boundaries until regression coverage is repaired.

## Method and evidence limits

Baseline: `git rev-parse HEAD` is recorded in [validation](validation.md). Inventory covers all 866 initially tracked paths; see [source inventory](../README.md). Review used manifests, route/controller registration, schemas, imports, agent/worker implementations, UI route/screens/hooks/stores, infrastructure, tests, CI and every Markdown document's purpose/status. Large historical backlogs were examined for task structure and completion claims; they are historical assertions, not independent evidence. This is a subsystem-level static audit plus executed checks, not a claim of exhaustive line-by-line review or tested behavior for every route.

Only this checkout was available. Directory names ending in `-repo` and former service package names do not prove that other repositories or remote deployments were inspected. No running production app, real model service or private dataset was accessed. No code was classified as dead solely from an import search.

The complete supplied v1.1 brief was read. The original three-page challenge book was found locally, rendered, OCR-extracted and visually checked. Immutable reference copies live under [sources](../reference/README.md). Attached material supplies product context; the user's pasted task defines authorization and prohibits implementation.

## Classification and gap register

Status describes source evidence, not operational certification. KEEP means retain; REUSE means adapt later; MODIFY LATER records a known change outside this task; INVESTIGATE preserves uncertainty. REMOVE applies only to superseded documentation assertions/navigation in this pass.

| Subsystem / evidence | Classification | Current status and EdNova gap | Dependency / impact | Follow-up |
|---|---|---|---|---|
| Web `app/`, `src/screens`, `next-entry.tsx`, navigation adapter | KEEP | Next App Router wraps client screens; no institution/instructor screens | Existing routes and tests rely on adapter | ED-01, ED-03 |
| Auth `shared/betterAuth.ts`, server identity, session guard | KEEP | Cookie sessions, verification, reset, legacy bcrypt verification; no membership roles | Shared across UI/API/WS; do not replace | ED-02, ED-04 |
| UI `src/utils/permissions.ts` | MODIFY LATER | `teacher` helper exists; backend only accepts `student`/`admin` | UI check cannot grant instructor access | ED-04 |
| API `src/framework`, `domain-definitions.ts`, `moduleClient.ts` | KEEP | Nest listener dispatches validated in-process domain contracts | Generated controllers and legacy handlers both active | ED-01 |
| Personal subjects/courses/upload routes | REUSE | Owner-scoped CRUD, validated uploads, ingest jobs/status; no official publication/enrollment | Study models, AI workers, upload volume | ED-05, ED-06 |
| Course download and static `/uploads` serving | MODIFY LATER | Scoped course endpoint exists; static mounts require bypass testing | Do not claim private files are isolated across all paths | ED-02 |
| Team session routes/models and session store | REUSE | Invite codes, participants (max 4), shared task progress/rewards | Gamification, notifications, course summaries coupled | ED-07 |
| Team course lookup (`teamSessions.ts`) | MODIFY LATER | Creation reads course by `_id` without owner filter before copying summaries | Potential cross-user disclosure; no institution ACL | ED-02 |
| Notification HTTP chat/voice + realtime | MODIFY LATER | Session-authenticated HTTP paths lack local membership checks; WS checks membership on connect/message | Auth is not resource authorization; history queries by sessionId | ED-02 |
| `SessionChat`, chat service/handler | REUSE | Search queries/results and coach suggestions; no general peer-message type or facilitation states | Real-time broadcast is present, group pedagogy is absent | ED-07, ED-09 |
| WebRTC service/hooks and VoiceSession | REUSE | Peer connections with public STUN, signaling, mute/speaking state; live audio not tested here | No TURN/SFU deployment; recordingUrl field alone is not recording implementation | ED-17 |
| Learning objectives, evaluator, eval results, competencies | REUSE | Individual Socratic multi-turn assessment, evidence and score pipeline | Redis optional for worker state; not validated mastery or group checks | ED-08, ED-11 |
| Planner + FAISS/vector store + pacing/reviews | REUSE | Retrieval-backed planning, persistent indexes, scheduling, spaced repetition | Source ACLs and reliable citations needed for tutoring reuse | ED-06, ED-10 |
| Course ingestion agent/worker | REUSE | PDF/text parsing, OCR, enrichment, chunking, embedding, objectives | Heavy dependencies; publication review absent | ED-05, ED-06 |
| Coach + rules/history | REUSE | Focus/fatigue-based nudges, rule fallback; not a peer facilitator | Depends on signals and scheduling; preserve coupling | ED-09 |
| Search agent/pipeline + SSRF guard | KEEP | External source search/extraction/synthesis with attribution and failure messages | Not equivalent to institution-authorized course retrieval | ED-10 |
| LLM YAML + shared client | MODIFY LATER | Per-agent provider aliases, bounded router retries/fallback; auto mocks on missing keys | Cannot prove challenge-service compact/capable mapping or quota compliance | ED-03, ED-12 |
| Job contracts, BaseAIWorker, leases/idempotency/session store | KEEP | Durable broker paths, retry/DLQ, progress, result persistence; some memory fallbacks | Preserve security, recovery and topology parity tests | ED-01, ED-12 |
| Reflection `app/` and `src/reflection/` variants | INVESTIGATE | Similar service trees; dynamic imports/standalone usage uncertain | No safe deletion proof | ED-22 |
| Signals, ML models/training artifacts | INVESTIGATE | Active focus/fatigue paths feed coach/scheduler; privacy and training scope conflict with demo | Do not delete active dependency or use custom training in challenge | ED-13, ED-22 |
| Billing, tiers, coupons, Stripe/admin screens | MODIFY LATER | Active and intertwined with AI entitlements; commerce outside hackathon | Removing payment code changes auth/access and rewards | ED-13, ED-23 |
| Gamification, ranking, quests, friends, wallpapers | KEEP | Active routes, stores, global shell calls, team XP | Optional challenge extensions; outside MVP focus does not mean unused | ED-23 |
| Analytics, notifications/email, metrics, backup/restore | KEEP | Working source paths and operational safeguards; no validated instructor aggregates | Privacy review needed before reusing analytics for instructors | ED-19 |
| Root Compose/Docker/Caddy/nginx/env templates | MODIFY LATER | Separate API/web/AI lifecycles; AI workers not started by AI HTTP Compose command | Broker/upload/DB configuration must be aligned explicitly | ED-01, ED-03 |
| CI root AI job | MODIFY LATER | Installs absent `requirements.txt`; nested AI workflow is not a root Actions workflow | No CI success claim; do not remove safety checks | ED-01 |
| Tests and remediation handoff | KEEP | Useful coverage and warnings; baseline has failures/skips | Preserve tests; historical counts are not today's results | ED-01 |
| Old migration completion/status docs | REMOVE (authority only) | Superseded certification and current-plan claims | Preserve original history with prominent historical label | ED-DOC |
| Duplicate docs architecture and trackers | REMOVE (redundant content) | Conflicting current stack and stale backlogs | Replace active navigation/trackers with canonical links | ED-DOC |
| Proposed knowledge graph/Graph RAG | INVESTIGATE | Appears as future work in historical backlog; no saved graph in checkout | Not a prerequisite for EdNova; no new graph infrastructure | ED-22 |

## Changes, removals, fixes and preservation

Documentation-only cleanup: rewritten entrypoints/current and target architecture; consolidated current backlog and tracker; added product, roles, functions, data model, workflows, AI policy, testing and delivery specifications; corrected framework/auth/path/collection/setup assertions. Historical analyses retain useful details with an explicit archival banner and no present-day authority. Original brief and challenge PDF are preserved as references, not represented as implemented work.

No production source, API, auth behavior, schema, migration, dependency, lockfile, test, infrastructure configuration or persistent data was removed or changed. No feature implementation or UI redesign occurred. No feature/dependency was proven both dead and safe to remove. Avoiding speculative deletion is an intentional audit outcome.

Detailed files and reasons are in [change register](cleanup.md); actual checks and limitations are in [validation](validation.md). [Product](../product-specification.md), [architecture](../architecture.md), [target](../target-architecture.md), [workflows](../workflows.md) and [backlog](../sprint-backlog.md) are the next-phase entrypoints.

## Roadmap and MVP boundary

First repair the known baseline and close content/membership gaps; confirm organizer model access; then establish institutional/personal course context, scoped retrieval and individual checks. Reuse team sessions for text/resource/exercise synchronization, add explicit Socratic facilitation, individual checks/debrief, category routing and safe fallback. Finish with reproducible security/AI/browser evidence and submission artifacts. Voice, private help and richer language UX follow only after P0 is stable. Continuous speech, payments, enterprise governance and advanced graph/analytics remain outside P0.

## Outstanding decisions

1. Confirm the year, submission time/timezone and actual final schedule. The PDF says **10 November** and **3 days after the Phase 1 selection**; do not infer a calendar deadline.
2. Obtain authorized inference endpoint/model IDs, quotas, retry guidance and approved external services. Existing commercial-provider aliases are configuration, not proof of organizer compliance.
3. Resolve live voice against the organizer instruction to avoid collecting voices. No recording/transcription; retain text as guaranteed path and confirm permitted media use before the voice demo.
4. Agree one synthetic course/topic and minimal instructor/institution setup, without building enterprise administration.
5. Decide retention and scoped sharing semantics, invitation expiry and whether instructor insights meet aggregation/privacy thresholds.
6. Assign baseline repairs and revalidate earlier security remediation. No present claim of stability, deployment or complete EdNova readiness is justified by this audit.

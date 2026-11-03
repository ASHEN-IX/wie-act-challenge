# EdNova — Architecture Decision Records (ADRs)

**Status:** Authoritative / Approved  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0) — GenAI Peer Learning Companion Challenge.

This log records the 16 core architectural decisions approved by the team. Every implementation task must adhere to these records; no engineer or agent may unilaterally adopt alternative stacks or patterns.

---

## Index of Approved Decisions

1. [ADR-01: Execution Planes Separation (Control, Media, Intelligence)](#adr-01-execution-planes-separation)
2. [ADR-02: NestJS Modular Monolith with In-Process Dispatch](#adr-02-nestjs-modular-monolith-with-in-process-dispatch)
3. [ADR-03: Next.js 16 App Router for Web Application & Gateway Integration](#adr-03-nextjs-16-app-router-for-web-application--gateway-integration)
4. [ADR-04: Better-Auth for Cookie Identity and Session Management](#adr-04-better-auth-for-cookie-identity-and-session-management)
5. [ADR-05: MongoDB Primary Persistence with Compound Idempotency](#adr-05-mongodb-primary-persistence-with-compound-idempotency)
6. [ADR-06: Redis for Ephemeral State, Locks, and Rate Limiting](#adr-06-redis-for-ephemeral-state-locks-and-rate-limiting)
7. [ADR-07: RabbitMQ Asynchronous Event Broker & Typed AI Envelopes](#adr-07-rabbitmq-asynchronous-event-broker--typed-ai-envelopes)
8. [ADR-08: Dual-Path AI Inference (Interactive REST vs Asynchronous Workers)](#adr-08-dual-path-ai-inference)
9. [ADR-09: LiteLLM Multi-Provider Routing with Compact/Large Model Policy](#adr-09-litellm-multi-provider-routing-with-compactlarge-model-policy)
10. [ADR-10: Existing FAISS Infrastructure for Document Chunk Retrieval](#adr-10-existing-faiss-infrastructure-for-document-chunk-retrieval)
11. [ADR-11: LiveKit Cloud for Media Plane Transport](#adr-11-livekit-cloud-for-media-plane-transport)
12. [ADR-12: Python LiveKit Agents for Realtime Voice Moderation](#adr-12-python-livekit-agents-for-realtime-voice-moderation)
13. [ADR-13: Streaming STT (Deepgram Nova-3) and TTS (Cartesia Sonic 3.6)](#adr-13-streaming-stt-deepgram-nova-3-and-tts-cartesia-sonic-36)
14. [ADR-14: Intelligent Interactive UI via Validated Declarative Schemas](#adr-14-intelligent-interactive-ui-via-validated-declarative-schemas)
15. [ADR-15: Course Studio Ingestion, Provenance Tracking, and Immutable Publication](#adr-15-course-studio-ingestion-provenance-tracking-and-immutable-publication)
16. [ADR-16: Server-Authoritative Evidence Engine & Anti-Farming Gamification](#adr-16-server-authoritative-evidence-engine--anti-farming-gamification)

---

## ADR-01: Execution Planes Separation

### Context
EdNova combines complex web workflows, low-latency audio streaming, and high-compute AI reasoning. Conflating media transport, domain permissions, and AI agent logic causes cascading failures, security bypasses, and unmanageable latency.

### Decision
Separate EdNova into three distinct, non-overlapping logical execution planes:
1. **Control Plane (NestJS)**: The sole authoritative source for domain permissions, institution memberships, course publishing, activity lifecycles, study room metadata, private student attempts, assessments, evidence validation, competencies, and gamification.
2. **Media Plane (LiveKit Cloud)**: Responsible exclusively for WebRTC audio transport, participant connection state, media subscriptions, agent audio publication, and speaking telemetry. LiveKit **never** decides access permissions, persists student records, or owns course content.
3. **Intelligence Plane (Python AI Service + LiveKit Agents)**: Responsible for document extraction, embeddings, vector retrieval, educational reasoning, prompt policies, speech-to-text, and text-to-speech. Python agents may propose actions to the room, but **all domain mutations must be validated and executed by the Control Plane**.

### Consequences
- Clean separation of concerns; failures in voice or AI inference do not crash student room sessions.
- Domain rules and access controls are unified in NestJS rather than duplicated across Python and WebRTC layers.

---

## ADR-02: NestJS Modular Monolith with In-Process Dispatch

### Context
Microservice network overhead, distributed transactions, and multiple HTTP gateways introduce unnecessary operational burden for a fast-paced hackathon delivery.

### Decision
Preserve the existing **NestJS modular monolith** (`apps/api`).
- Keep 7 bounded in-process domain modules: `auth`, `user-profile`, `study`, `ai-orchestrator`, `signal-processing`, `analytics`, `notification`.
- Maintain the internal `module://` protocol dispatched via `shared/moduleClient.ts` to pass request contexts without HTTP overhead.
- Future refactoring to native NestJS application service injection is permitted post-hackathon, but the `module://` abstraction remains intact during current sprints.

### Consequences
- Zero network latency between domains while strictly preserving modular boundary encapsulation.
- Single unified process lifecycle managed via `src/main.ts`.

---

## ADR-03: Next.js 16 App Router for Web Application & Gateway Integration

### Context
Legacy React SPAs suffered from client-side secret exposure, heavy client bundles, unauthenticated API calls, and disparate state stores.

### Decision
Retain **Next.js 16 App Router** with **React 19 Server Components (RSC)**, **Tailwind CSS 4**, and **shadcn/ui**.
- Server Components query the backend directly through `src/lib/api.ts` with forwarded session cookies.
- Mutations use validated native **Server Actions** in `src/features/*`.
- Client components are restricted to lightweight interactive elements (forms, status pills, room media clients).
- Security headers and strict CSP nonces are enforced on every request via `apps/web/src/proxy.ts`.

### Consequences
- Zero sensitive business logic or API keys leak to the client browser.
- Instant initial page loads, optimal Core Web Vitals, and strict CSP protection.

---

## ADR-04: Better-Auth for Cookie Identity and Session Management

### Context
Stateless JWTs stored in browser LocalStorage are vulnerable to XSS and cannot be revoked server-side without complex token blacklists.

### Decision
Standardize on **Better-Auth** (`^1.7.7`) using HttpOnly, SameSite, Secure cookies backed by MongoDB.
- Better-Auth endpoint is mounted at `/api/auth/[...all]` in Next.js.
- NestJS uses a unified `SessionGuard` reading the shared MongoDB auth collections (`auth_sessions`, `auth_users`).
- Legacy bcrypt user credentials are automatically upgraded upon first sign-in.

### Consequences
- XSS-resistant session transport.
- Immediate server-side session revocation when a user logs out or is suspended by an administrator.

---

## ADR-05: MongoDB Primary Persistence with Compound Idempotency

### Context
The application domain requires multi-document entity models (courses, modules, objectives, attempts, rooms) with dynamic pedagogical metadata.

### Decision
Retain **MongoDB 7.0** as the primary database managed via Mongoose schemas.
- Use compound unique indexes for critical business idempotency (e.g., `userId + courseId + objectiveId` for competency records; `eventKey` for gamification).
- Enforce strict read/write ACL filters on every query at the repository layer.
- Prohibit alternative databases (PostgreSQL, Cassandra) for the core platform.

### Consequences
- Rich document modeling without migration churn.
- Guaranteed deduplication and exactly-once processing on critical learning events.

---

## ADR-06: Redis for Ephemeral State, Locks, and Rate Limiting

### Context
Realtime rooms, message queue consumers, and authentication endpoints need sub-millisecond atomic locks and counters.

### Decision
Use **Redis 7-alpine** exclusively for:
1. Message deduplication leases (`SET NX EX 3600`).
2. Authentication rate-limiting counters.
3. Ephemeral study room heartbeat and presence tracking.
4. Temporary token invalidation caches.
- **Do not** store persistent domain records or course data in Redis.

### Consequences
- High-throughput concurrency control without database lock contention.
- Redis failure causes transient degradation (rate limits fall back to open/safe mode) rather than permanent data loss.

---

## ADR-07: RabbitMQ Asynchronous Event Broker & Typed AI Envelopes

### Context
Heavy operations (PDF ingestion, course structuring, long-form grading) must not block HTTP request/response loops.

### Decision
Retain **RabbitMQ 3-management** as the background job transport.
- Enforce the existing typed envelope contract (`docs/contracts/ai-message-contract.md`): `messageId`, `correlationId`, `type`, `version`, `userId`, `requestId`, `timestamp`, `payload`.
- Use topic exchange `EXCHANGE_JOBS` (`mindflow.jobs`) and dedicated work queues (`study.ingest.course`, `study.eval.step`, `study.coach.nudge`, `study.plan.generate`, `study.search.query`).
- Enforce 3-tiered exponential backoff retries and route poison pills to Dead Letter Queues (`ai.dlq.*`).
- Prohibit introducing Celery, Kafka, or alternative brokers.

### Consequences
- Full decoupling of background AI workers from the HTTP API.
- Traceable, replayable asynchronous tasks with end-to-end correlation IDs.

---

## ADR-08: Dual-Path AI Inference

### Context
User experience requires immediate answers for tutoring and moderation, but batch processing for ingestion and deep evaluation.

### Decision
Architect two distinct AI execution paths:
1. **Low-Latency Interactive Path**:
   - `Client → NestJS → Private Python FastAPI (Port 8000) → LiteLLM → NestJS → Client`.
   - Used for: Socratic hints, intent-to-activity selection, lightweight feedback, facilitator reasoning.
   - Enforces internal API key authentication, request-level authorization in NestJS, and 5-10s timeout budgets.
2. **Asynchronous Background Processing Path**:
   - `NestJS → RabbitMQ → Python Worker → MongoDB/Redis → NestJS Poller/WebSocket`.
   - Used for: Document OCR, PDF chunking, FAISS index construction, complex multi-turn evaluations.

### Consequences
- Interactive conversations never block on batch ingestion workloads.
- Browser clients never directly invoke internal Python AI endpoints.

---

## ADR-09: LiteLLM Multi-Provider Routing with Compact/Large Model Policy

### Context
The WIE ACT challenge explicitly requires a deliberate model routing strategy leveraging both compact and larger capable models, with graceful degradation.

### Decision
Use **LiteLLM** in the Python AI service to abstract provider APIs (OpenAI, Anthropic Claude, Google Gemini, local Ollama).
- **Compact Models (e.g., Gemini 1.5 Flash, Claude 3.5 Haiku, GPT-4o-mini)**:
  - Default for: Intent classification, short hints, dialogue sentiment, activity selection, lightweight structured extraction.
- **Larger Capable Models (e.g., Claude 3.5 Sonnet, GPT-4o, Gemini 1.5 Pro)**:
  - Escalated for: Difficult mathematical reasoning, deep misconception diagnosis, multi-source synthesis, rubric evaluation.
- **Degraded Policy**: If the larger model reaches quota or times out, the system automatically falls back to compact-model hints accompanied by an explicit "tentative/pending review" pedagogical badge. **Never fabricate certainty**.

### Consequences
- Minimized token costs and fast response times for 80% of routine interactions.
- Resilient offline/fallback modes ensuring students are never left with broken UI states.

---

## ADR-10: Existing FAISS Infrastructure for Document Chunk Retrieval

### Context
Course materials must be retrieved with low latency and zero external SaaS dependencies.

### Decision
Retain the existing **FAISS disk-mounted vector indexing** pipeline in `apps/ai`.
- Documents are parsed into 512-token chunks with 64-token overlaps.
- Embeddings are generated using standard models (`text-embedding-3-small` or local `all-MiniLM-L6-v2`).
- Target indexes are serialized to disk mounted on shared Docker volumes as `faiss/<courseId>/<revisionTag>.faiss`, with metadata at `faiss/<courseId>/<revisionTag>.meta.json`. The current adapter still writes course-scoped artifacts; migration to revision-aware reads/writes, chunk keys and caches is a later designated mission.
- Prohibit introducing external vector databases (Qdrant, Pinecone, Milvus) unless FAISS demonstrates an architectural bottleneck.

### Consequences
- Zero cloud database costs and simple local Docker Compose reproduction.
- Clean version isolation: each published course revision has its own distinct index file.

---

## ADR-11: LiveKit Cloud for Media Plane Transport

### Context
Pure peer-to-peer (P2P) WebRTC mesh collapses beyond 3-4 participants due to quadratic upstream bandwidth consumption, lacks server-side audio tapping for AI agents, and suffers from NAT/firewall traversal failures.

### Decision
Adopt **LiveKit Cloud** as the authoritative WebRTC SFU (Selective Forwarding Unit) media plane.
- Students connect their microphone and speaker tracks to a LiveKit room.
- NestJS Control Plane authenticates users, verifies course authorization, checks voice consent, and issues short-lived, cryptographically signed LiveKit access tokens.
- LiveKit provides built-in noise suppression, network adaptation, and seamless client SDKs for Next.js/React.
- Prohibit custom WebRTC peer mesh implementations.

### Consequences
- Crystal-clear audio quality for up to 50 concurrent participants per room.
- Direct server-side audio hooks for AI voice agents without routing student audio through the NestJS server.

---

## ADR-12: Python LiveKit Agents for Realtime Voice Moderation

### Context
A voice AI moderator must participate as an active room participant, listen to human speakers, and respond with synthesized voice.

### Decision
Implement the AI moderator using the **Python LiveKit Agents SDK**.
- The agent joins the LiveKit room as an authenticated participant with audio subscribe and publish permissions.
- The agent listens to individual participant audio tracks, performs Voice Activity Detection (VAD), and receives speaker-attributed transcripts.
- Facilitation logic (guided, on-demand, or muted) evaluates student conversations and synthesizes spoken guidance.
- Any UI actions proposed by the agent (e.g., displaying an activity) must be submitted to the NestJS Control Plane via authenticated API.

### Consequences
- First-class multi-speaker audio integration with sub-second interruption handling.
- The agent cannot directly mutate database records without NestJS validation.

---

## ADR-13: Streaming STT (Deepgram Nova-3) and TTS (Cartesia Sonic 3.6)

### Context
Voice conversational agents require ultra-low latency (<800ms time-to-speech onset) to feel natural in live human discussions.

### Decision
Adopt streaming providers as provisional defaults within the LiveKit Agent worker:
- **Speech-to-Text (STT)**: **Deepgram Nova-3** (streaming WebSocket audio transcription with high accuracy and speaker diarization).
- **Text-to-Speech (TTS)**: **Cartesia Sonic 3.6** (low-latency streaming audio synthesis).
- **Provisional Status**: These providers are provisional defaults. If multilingual performance (specifically French and Tunisian Arabic dialect adaptation) proves insufficient during testing, the agent pipeline must allow swapping to Whisper / ElevenLabs via configuration without rewriting agent logic.

### Consequences
- Blazing-fast voice interaction loops.
- Flexible configuration-driven provider swaps.

---

## ADR-14: Intelligent Interactive UI via Validated Declarative Schemas

### Context
AI agents must provide dynamic exercises, diagrams, and quizzes without introducing Cross-Site Scripting (XSS) risks or broken layout rendering.

### Decision
Enforce **validated declarative JSON schemas rendered by trusted, pre-compiled React components**.
- The AI never returns raw HTML or JavaScript.
- Contract `1.0.0` wire activity types:
  1. `InteractiveQuiz` (multiple choice, multi-select, immediate feedback).
  2. `GuidedProblem` (step-by-step Socratic walkthrough with progressive hints).
- Future reviewed types: `StepByStepVisualizer` (algorithmic or process state progression) and `ParameterExplorer` (interactive sliders/inputs showing mathematical or physical relationships). They are not accepted by the P0 v1.0.0 contract.
- Client schemas **never contain answer keys or evaluation rubrics**.
- Evaluation is executed server-side via authenticated Server Actions.

### Consequences
- Absolute XSS security; zero arbitrary code execution.
- 100% responsive, accessible (WCAG AA), theme-compatible UI.

---

## ADR-15: Course Studio Ingestion, Provenance Tracking, and Immutable Publication

### Context
University educators must trust that AI-digitized courses accurately reflect their uploaded syllabus and lecture materials, without hallucinations.

### Decision
Implement a multi-stage **Course Studio content lifecycle**:
1. **Upload & Private Staging**: Original PDFs are validated (size, MIME type) and stored in private object storage.
2. **Extraction & Provenance Mapping**: Background ingestion extracts chapters, concepts, and Bloom learning objectives, tagging every objective with exact source references (`documentId`, `pageNumber`, `excerpt`).
3. **Editable Draft State**: Instructors review, edit, reorganize, add, or reject AI proposals in the Studio UI.
4. **Immutable Publication**: Publishing creates an immutable `CourseRevision` record with a cryptographic content hash. Active study sessions pin to their starting revision to prevent mid-session drift.
5. **Retrieval Sync**: FAISS index artifacts are built and validated *before* a revision is marked active.

### Consequences
- Complete provenance: every learning objective can be audited back to its source page.
- Zero mid-session corruption or unvetted AI content published to students.

---

## ADR-16: Server-Authoritative Evidence Engine & Anti-Farming Gamification

### Context
Gamification easily degenerates into click-farming, and LLM evaluations can be easily manipulated by prompt injection if client requests directly increment scores.

### Decision
Decouple gamification from client requests and LLM outputs using an authoritative **Learning Evidence Engine**:
1. When a student completes an activity attempt, the backend evaluates the response against server-side rubrics.
2. Verified outcomes generate an immutable `LearningEvidence` record (`attemptId`, `objectiveId`, `bloomLevel`, `score`, `masteryAchieved`).
3. The `CompetencyService` updates student knowledge states based strictly on accepted evidence.
4. The `GamificationService` awards XP and badges deterministically through an append-only `RankEventLedger` using compound unique keys (`userId + evidenceId`) to guarantee exactly-once processing and enforce daily topic caps.

### Consequences
- Immune to client-side score tampering or prompt injection exploits.
- XP strictly reflects genuine, verified learning milestones.

---

*These ADRs form the constitutional technical framework for EdNova.*

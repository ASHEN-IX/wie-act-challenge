# EdNova — Target System Architecture & Technical Design

**Status:** Authoritative / Approved Target Architecture  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0) — GenAI Peer Learning Companion Challenge.

---

## 1. System Overview & The Three Execution Planes

EdNova is designed around three strictly decoupled logical execution planes. This separation ensures that low-latency media streaming, domain access controls, and heavy generative AI computations never block or corrupt one another.

```mermaid
flowchart LR
    subgraph ControlPlane["Control Plane (NestJS)"]
        direction TB
        AuthGuard["Better-Auth & RBAC Guards"]
        CourseService["Course Studio & Revision Manager"]
        RoomCoordinator["Study Room Lifecycle"]
        ActivityRegistry["Intelligent UI Registry"]
        EvidenceEngine["Learning Evidence & Competency"]
        Gamification["Anti-Farming XP Ledger"]
    end

    subgraph MediaPlane["Media Plane (LiveKit Cloud)"]
        direction TB
        SFU["LiveKit WebRTC SFU"]
        AudioTracks["Multi-User Audio Tracks"]
        AgentTrack["AI Agent Audio Track"]
        Telemetry["Speaking Events & VAD"]
    end

    subgraph IntelligencePlane["Intelligence Plane (Python AI)"]
        direction TB
        LiveKitAgent["Python LiveKit Agent Worker"]
        STT_TTS["Deepgram Nova-3 STT / Cartesia TTS"]
        FastAPI_GW["FastAPI Interactive Gateway"]
        RabbitMQ_Workers["Ingestion & Evaluator Workers"]
        LiteLLM_Router["LiteLLM (Compact vs Large Routing)"]
        FAISS_Store["FAISS Vector Store"]
    end

    ControlPlane <-->|LiveKit Room Tokens & Metadata| MediaPlane
    ControlPlane <-->|Dual-Path REST & RabbitMQ Jobs| IntelligencePlane
    MediaPlane <-->|WebRTC Audio Stream| IntelligencePlane
```

### The Three Execution Planes Defined

1. **Control Plane (NestJS Modular Monolith)**:
   - **Sole Authority**: Owns domain permissions, course publication, room state, private attempt submissions, learning evidence validation, competencies, and XP ledger updates.
   - **In-Process Boundary**: Domains interact via the `module://` protocol dispatched by `shared/moduleClient.ts`, preventing internal HTTP network overhead while maintaining strict module isolation.
   - **Guards**: Resolves Better-Auth session cookies, validates institutional enrollment, and issues cryptographically signed LiveKit access tokens.

2. **Media Plane (LiveKit Cloud)**:
   - **Sole Authority**: Manages low-latency WebRTC media transport, audio track subscriptions, client network adaptation, and speaking event telemetry.
   - **Non-Ownership**: LiveKit **never** stores educational records, grades student attempts, or enforces course permissions.

3. **Intelligence Plane (Python AI Service + LiveKit Agents)**:
   - **Sole Authority**: Executes document extraction, OCR, embedding generation, vector similarity search (FAISS), multi-speaker voice moderation, Socratic reasoning, and model routing.
   - **Action Boundary**: Python agents can propose actions to rooms, but **all domain state mutations must pass through validated NestJS endpoints**.

---

## 2. Technology Stack & Component Architecture

| Layer | Approved Technology | Deployment / Runtime | Key Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Web Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui | Standalone Node.js (`:5173`) | React Server Components (RSC), native Server Actions, accessible UI primitives, CSP proxy. |
| **Backend API Gateway** | NestJS 12.1 + Express Platform | Node >= 24 (`:3000`) | Modular monolith, domain contracts, WebSocket servers (`/ws/realtime`), Better-Auth session guard. |
| **Authentication** | Better-Auth 1.7.7 | Next.js API mount (`/api/auth/*`) | Mongo-backed cookie identity, bcrypt migration, OTP verification, rate limits. |
| **Primary Persistence** | MongoDB 7.0 + Mongoose 8 | Docker Container (`:27017`) | Multi-document ACID transactions, compound idempotency keys, domain collections. |
| **Cache & Distributed State**| Redis 7-alpine | Docker Container (`:6379`) | Fast atomic deduplication leases, rate limiting, room heartbeat tracking. |
| **Background Message Broker**| RabbitMQ 3-management | Docker Container (`:5672`) | Topic exchange (`EXCHANGE_JOBS`), dead letter queues (`ai.dlq.*`), 3-step exponential retry backoff. |
| **Interactive AI Gateway** | Python FastAPI | Uvicorn (`:8000`) | Low-latency REST endpoints for Socratic hints, intent classification, activity generation. |
| **Voice AI Agent** | Python LiveKit Agents SDK | Independent Python Worker | LiveKit WebRTC participant, multi-speaker VAD, audio stream tap, facilitator policy. |
| **Speech-to-Text (STT)** | Deepgram Nova-3 (Provisional) | Streaming WebSocket Cloud API | Ultra-low latency speaker-attributed transcription. |
| **Text-to-Speech (TTS)** | Cartesia Sonic 3.6 (Provisional) | Streaming Audio Cloud API | Ultra-low latency voice synthesis (<200ms onset). |
| **LLM Orchestration** | LiteLLM | Python library | Multi-provider abstraction (Claude 3.5, GPT-4o, Gemini 1.5, Ollama) with compact/large routing. |
| **Vector Retrieval** | FAISS | Serialized disk on Docker volume | Course-namespaced dense vector indexes for syllabus and lecture chunks. |

---

## 3. Dual-Path AI Inference Architecture

EdNova enforces two dedicated execution paths for artificial intelligence to prevent heavy batch operations from interfering with conversational response times:

```
Path A: Low-Latency Interactive Inference (<1.5s target)
Client Browser ──(HTTPS)──> NestJS Control Plane ──(Internal HTTP)──> FastAPI AI Service ──> LiteLLM ──> Provider API
                                                                                │
                                                                         FAISS Retrieval

Path B: Asynchronous Batch & Long-Running Processing
NestJS Control Plane ──(AMQP)──> RabbitMQ (mindflow.jobs) ──> Python Background Workers ──> MongoDB / FAISS
                                                                           │
                                                                   Status Poller / WebSocket
```

### Path A: Low-Latency Interactive Path
- **Use Cases**: Individual Socratic tutoring, diagnostic activity generation, voice moderator turn-taking, real-time hint requests.
- **Security & Authorization**: Invocations must originate from the NestJS Control Plane over private network connections using `INTERNAL_API_SECRET`. Browser clients cannot directly contact the Python service.
- **Budgets & Guardrails**: Enforces a strict 8,000ms timeout budget, structured JSON schema outputs, and fallback to cached templates if providers fail.

### Path B: Asynchronous Processing Path
- **Use Cases**: Course syllabus PDF extraction, OCR processing, chapter and objective decomposition, FAISS index building, end-of-session group debrief synthesis.
- **Contract & Recovery**: Utilizes the typed `ai-message-contract.md` envelope. Workers acquire Redis leases (`SET NX EX 3600`) to guarantee idempotent execution. Messages failing 3 times are routed to Dead Letter Queues for inspection.

---

## 4. AI Model Routing & Limited-Capacity Behavior

To comply with the WIE ACT challenge specification, EdNova implements a deterministic model-routing policy balancing speed, cost, and pedagogical depth:

```mermaid
flowchart TD
    Request[Inbound Pedagogical Request] --> Classifier{Complexity Classifier\n(Compact Model)}
    Classifier -->|Intent, Simple Hint, Activity Choice| Compact[Compact Model\ne.g. Gemini 1.5 Flash / Claude 3.5 Haiku]
    Classifier -->|Deep Misconception, Proof, Ambiguity| Capable[Capable Model\ne.g. Claude 3.5 Sonnet / GPT-4o]

    Capable -->|Success| Output[Validated Structured Response]
    Capable -->|Timeout / Quota Exceeded| Fallback[Fallback to Compact Model]
    Fallback --> OutputTentative[Response Tagged with 'Preliminary Review' Badge]
    Compact -->|Success| Output
```

### 1. Compact Models (Fast, Lightweight)
- **Assigned Tasks**: Intent detection, dialogue classification, short multiple-choice generation, basic Socratic questions, routine conversational acknowledgments.
- **Latency Target**: <600ms.
- **Failure Policy**: If unavailable, return pre-compiled fallback hints from course metadata.

### 2. Capable Models (Deep Educational Reasoning)
- **Assigned Tasks**: Unpacking subtle student misconceptions, evaluating complex free-text answers, source reconciliation across conflicting chapters, facilitator group intervention decisions.
- **Latency Budget**: 2,000ms - 6,000ms.
- **Degraded Fallback**: If the capable model times out or encounters quota limits, the system invokes the compact model with a constrained prompt and tags the result with `isTentative: true`. The student UI displays a transparent "Preliminary AI Review" indicator. **Under no circumstances does the system fabricate certainty.**

---

## 5. AI Course Studio & Publication Immutability

The Course Studio enables instructors to convert unstructured academic documents into structured, navigable courses:

```
[Upload PDF] ──> [RabbitMQ Ingest] ──> [Text & Bloom Extraction] ──> [FAISS Index]
                                                                            │
[Active Learning Session] <── [Immutable Revision] <── [Instructor Approval] <┘
```

1. **Upload & Private Staging**: Original PDFs are validated against MIME type (`application/pdf`) and size limits (max 50MB) and stored in private storage.
2. **Provenance-Linked Extraction**: Every extracted learning objective retains exact source provenance:
   ```json
   {
     "objectiveId": "obj_123",
     "bloomLevel": "analyze",
     "provenance": { "pageNumber": 14, "charStart": 120, "charEnd": 450, "excerpt": "..." }
   }
   ```
3. **Draft Hierarchy Editor**: Instructors preview extracted chapters, reorder topics, modify statements, or assign alternative Bloom levels in the Next.js Course Studio UI.
4. **Publication & Immutability**:
   - Publishing creates an immutable `CourseRevision` document containing a cryptographic SHA-256 hash of all topics, objectives, and vector index references.
   - Ongoing student study sessions are permanently pinned to their starting `revisionId`. If an instructor publishes Version 2, active sessions continue uninterrupted on Version 1.

---

## 6. Intelligent Interactive UI — Declarative Registry

The AI companion presents rich, interactive learning experiences rather than static text blocks. To ensure absolute security and responsive styling, all experiences use **declarative JSON schemas rendered by trusted, pre-compiled React components**:

```
AI Intent Analysis ──> Generate Activity JSON ──> Schema Validation ──> Trusted React Component
                                                                                 │
Student Interaction <── [No Answer Keys in Client Payload] ──────────────────────┘
```

### Core Activity Registry Components

1. **`InteractiveQuiz`**:
   - Multiple choice, multi-select, and true/false questions.
   - Displays real-time validation upon submit; answer keys and explanations are stored server-side only.
2. **`GuidedProblem`**:
   - Multi-step reasoning problem. Students must complete Step 1 before Step 2 unlocks.
   - Socratic hints are requested step-by-step without revealing future solution phases.
3. **`StepByStepVisualizer`**:
   - Algorithmic and process flow visualizer (e.g., database normalization steps, binary search tree insertion).
   - Driven by declarative state transitions (`{ currentStep: 2, highlights: ["table_1"] }`).
4. **`ParameterExplorer`**:
   - Interactive sliders and bounded inputs allowing learners to experiment with variables and observe mathematical or systemic outcomes.

---

## 7. Multi-Speaker Voice AI Moderator & Room Architecture

In collaborative Study Together rooms, the AI acts as an attentive, non-intrusive moderator:

```
Student 1 Audio ──┐
                  ├──> [LiveKit Cloud SFU] ──> [LiveKit Agent] ──> [Deepgram STT]
Student 2 Audio ──┘                                                      │
                                                                 [Speaker Attribution]
                                                                         │
LiveKit Audio Publication <── [Cartesia TTS] <── [Peer-First Policy] <───┘
```

### Key Voice Moderator Capabilities

1. **Speaker Attribution & VAD**: The agent uses participant-specific audio tracks to identify exactly who is speaking, preventing confused cross-talk attribution.
2. **Peer-First Facilitation Policy**:
   - When a misconception is detected, the agent **never immediately provides the answer**.
   - Instead, it prompts a peer to reflect: *"Habib, Tasnim mentioned that unique IDs satisfy 1NF. Looking at the course definition on screen, what do you think?"*
3. **Moderator Modes**:
   - **Guided (Default)**: Listens continuously; intervenes only upon significant misconceptions, deadlocks, or explicit questions. Enforces a 30-second cooldown between spoken interventions.
   - **On Demand**: Remains silent unless explicitly addressed (e.g., *"EdNova, can you explain this?"*).
   - **Muted**: AI audio processing is completely stopped; room functions as a standard peer study room.
4. **Room-Private Tutor Side Channel**:
   - A student can open a private side-panel to consult the Socratic Tutor individually.
   - These questions and answers are completely isolated from the room audio track and public chat transcript.

---

## 8. Unified Evidence Engine & Gamification

To prevent click-farming and maintain educational integrity, academic mastery and gamification are strictly decoupled:

```
Student Submission ──> Server Evaluation ──> Learning Evidence ──> Competency Update
                                                    │
                                                    └──> Append-Only XP Ledger
```

1. **Private Submissions**: Student answers are submitted via authenticated Server Actions (`POST /api/v1/study/activities/:id/attempts`). Even in group rooms, submissions are evaluated privately.
2. **Learning Evidence Record (`learning_evidence`)**: Verified outcomes produce immutable evidence containing `userId`, `courseId`, `objectiveId`, `bloomLevel`, `score`, and `timestamp`.
3. **Competency Mapping (`competencies`)**: Student mastery rings and progress trees update exclusively based on accepted evidence.
4. **Anti-Farming XP Ledger (`rank_event_ledger`)**:
   - XP is awarded deterministically by the backend using compound unique keys (`xp:{userId}:{evidenceId}`).
   - Enforces a strict daily cap of 300 XP per subject to prevent repetitive question grinding.
   - LLM text outputs and browser client requests **cannot** directly grant XP.

---

*This document defines the complete Target Architecture for EdNova.*

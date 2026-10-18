# EdNova — End-to-End Workflow Specifications

**Status:** Authoritative / Implementation-Ready  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0)

This document specifies the 8 canonical end-to-end workflows of the EdNova platform, covering institutional content management, independent study, Socratic tutoring, realtime collaborative rooms, live AI voice facilitation, intelligent UI execution, and failure recovery.

---

## Workflow Index

* [Workflow A: University Course Creation, Ingestion & Publication](#workflow-a-university-course-creation-ingestion--publication)
* [Workflow B: Independent Learner Personal Course & Open Topic Study](#workflow-b-independent-learner-personal-course--open-topic-study)
* [Workflow C: Enrolled Student Socratic Learning & Competency Progression](#workflow-c-enrolled-student-socratic-learning--competency-progression)
* [Workflow D: Collaborative Study Room Lifecycle & LiveKit Audio Connection](#workflow-d-collaborative-study-room-lifecycle--livekit-audio-connection)
* [Workflow E: Multi-Speaker Realtime AI Voice Moderation](#workflow-e-multi-speaker-realtime-ai-voice-moderation)
* [Workflow F: AI-Triggered Intelligent UI Synchronization](#workflow-f-ai-triggered-intelligent-ui-synchronization)
* [Workflow G: Individual Evaluation & Evidence Generation After Group Study](#workflow-g-individual-evaluation--evidence-generation-after-group-study)
* [Workflow H: Resilient Failure Recovery & Degraded Operation](#workflow-h-resilient-failure-recovery--degraded-operation)

---

## Workflow A: University Course Creation, Ingestion & Publication

### Preconditions
- User is authenticated with verified email and holds an `instructor` or `university_admin` role scoped to the target institution.

### Actors
- **Instructor** (Human)
- **Control Plane** (NestJS `study` module)
- **Asynchronous Broker** (RabbitMQ)
- **Ingestion Worker** (Python `agents.course_ingestion`)
- **Document Storage** (Private object storage / Volume)

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Inst as Instructor
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane
    participant DB as MongoDB
    participant S3 as Private Storage
    participant RMQ as RabbitMQ
    participant Worker as Python Ingest Worker
    participant FAISS as FAISS Vector Store

    Inst->>Web: Create Course & Upload Syllabus/PDF
    Web->>Nest: POST /api/v1/study/courses (Multipart Form)
    Nest->>Nest: Validate Session & Institutional Scope
    Nest->>S3: Store Original File (private ACL)
    Nest->>DB: Create Course (status: "draft") & Ingestion Job
    Nest->>RMQ: Publish "study.ingest.course" (Contract 01)
    Nest-->>Web: Return 202 Accepted (courseId, jobId)
    Web-->>Inst: Display "Ingesting & Analyzing Document..."

    RMQ->>Worker: Consume Ingest Message
    Worker->>Worker: Acquire Redis Idempotency Lease
    Worker->>S3: Stream Document Bytes
    Worker->>Worker: Extract Text, Headings & Page Offsets
    Worker->>Worker: Map Bloom Taxonomy Levels (bloom-fixture.json)
    Worker->>FAISS: Build Chunks (512 tokens) & Vector Index
    Worker->>RMQ: Publish "study.ingest.course.result" (Contract 02)

    RMQ->>Nest: Ingestion Result Handler
    Nest->>DB: Save Draft Revision (Chapters, Topics, Objectives, Offsets)
    Nest->>DB: Update Course Status to "draft_ready"
    Nest-->>Web: Push WebSocket Event "COURSE_INGESTION_COMPLETED"
    Web-->>Inst: Render Course Studio Hierarchy Editor

    Inst->>Web: Review, Edit Objectives & Click "Publish"
    Web->>Nest: POST /api/v1/study/courses/:id/publish
    Nest->>Nest: Validate Content & Generate sha256 Content Hash
    Nest->>DB: Create Immutable CourseRevision (status: "published")
    Nest->>DB: Mark Course "isPublished: true", update activeRevisionId
    Nest-->>Web: 200 OK (Contract 03 Published Context)
    Web-->>Inst: Display "Course Published & Enrolled Students Notified"
```

### Happy Path
1. Instructor navigates to `/courses/new`, provides metadata, and selects a 25MB course syllabus PDF.
2. NestJS validates authorization, streams the PDF to private storage, creates a draft course in MongoDB, and enqueues `study.ingest.course`.
3. The Python worker extracts structure, tags learning objectives with Bloom verbs, builds FAISS embeddings, and returns Contract 02.
4. Instructor previews the draft in Course Studio, edits two learning objectives, and clicks **Publish**.
5. NestJS locks the revision into an immutable `CourseRevision` record and activates student access.

### Failure Paths
- **Invalid File Type/Corrupt PDF**: Ingestion worker identifies corrupt syntax; emits status `failed` with sanitized error. NestJS marks draft as `error_needs_reupload`. Previous published versions (if any) remain active.
- **Worker Crash During Processing**: RabbitMQ unacknowledged message timeout returns message to queue; consumer uses `messageId` to prevent duplicate writes.

### Data & Authorization Checks
- **Auth**: Must have valid `auth_session` and `role: "instructor"` in target `institutionId`.
- **Data Mutations**: Insert `courses` (status: `draft`), insert `documents`, insert `course_revisions`, insert `learning_objectives`.

---

## Workflow B: Independent Learner Personal Course & Open Topic Study

### Preconditions
- User has an active personal account (B2C learner).

### Actors
- **Independent Learner**
- **Next.js Web Client**
- **NestJS Control Plane**
- **Python Interactive AI Service** (LiteLLM)

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Learner
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane
    participant DB as MongoDB
    participant AI as Python AI Service (LiteLLM)

    Learner->>Web: Enter Topic: "Quantum Computing Basics"
    Web->>Nest: POST /api/v1/study/personal-topics
    Nest->>Nest: Validate User Session & Rate Limits
    Nest->>AI: POST /internal/ai/decompose-topic
    AI->>AI: LiteLLM (Compact Model): Decompose into 3 Bloom Milestones
    AI-->>Nest: Return JSON { topics, objectives }
    Nest->>DB: Save Personal Course (status: "personal", isPublished: true)
    Nest-->>Web: 201 Created (courseId)

    Learner->>Web: Click "Start Diagnostic Quiz"
    Web->>Nest: GET /api/v1/study/courses/:id/diagnostic
    Nest->>AI: POST /internal/ai/generate-activity (Contract 04)
    AI-->>Nest: Return Declarative ActivitySchema (InteractiveQuiz)
    Nest-->>Web: Public Activity Payload (no answer keys)
    Web-->>Learner: Render Trusted React Quiz Component
```

### Happy Path
1. Learner enters an open topic without uploading a document.
2. System decomposes the topic into structured learning objectives labeled as **AI-Generated**.
3. Learner immediately receives a validated diagnostic quiz to establish baseline competency.

### Failure Paths
- **AI Service Timeout**: NestJS returns fallback pre-structured topic template from cache.
- **Malformed LLM Output**: NestJS schema validator rejects output; requests retry with deterministic temperature 0.

---

## Workflow C: Enrolled Student Socratic Learning & Competency Progression

### Preconditions
- Student is enrolled in an approved institutional course.

### Actors
- **Student**
- **Next.js Web App**
- **NestJS Control Plane**
- **Python Socratic Tutor Agent** (LiteLLM + FAISS)

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane
    participant DB as MongoDB
    participant FAISS as FAISS Vector Store
    participant AI as Python Socratic Tutor

    Student->>Web: Select Objective: "1NF Decomposition"
    Web->>Nest: POST /api/v1/study/tutor/message { query: "Why can't I store a list of tags in a cell?" }
    Nest->>Nest: Authorize Enrollment in Course & Revision
    Nest->>AI: POST /internal/ai/socratic-tutor (requestContext)
    AI->>FAISS: Retrieve Top-3 Chunks for Course Revision
    AI->>AI: LiteLLM: Construct Socratic Question (Bloom: Understand)
    AI-->>Nest: Structured Tutor Response (Source-Grounded)
    Nest-->>Web: Deliver Tutor Response + Citation (Page 12, Excerpt)
    Web-->>Student: Display Explanation & Guiding Question

    Student->>Web: Answers Question in Chat
    Web->>Nest: POST /api/v1/study/tutor/check-understanding
    Nest->>AI: POST /internal/ai/evaluate-response
    AI-->>Nest: Return Evaluation: { isCorrect: true, bloomLevel: "understand" }
    Nest->>DB: Record Learning Evidence (Contract 07)
    Nest->>DB: Update Competency Record (Contract 08)
    Nest->>DB: Append XP Event in RankEventLedger (Contract 09)
    Nest-->>Web: 200 OK { masteryAwarded: true, xpGained: 50 }
    Web-->>Student: Display "+50 XP" and Competency Mastery Ring Update
```

### Happy Path
1. Student asks for conceptual clarification on a specific course objective.
2. The Socratic tutor retrieves verified excerpts from the published syllabus.
3. The tutor guides the student with questions rather than giving direct answers.
4. Upon demonstrating understanding, the backend creates an immutable `LearningEvidence` record, updates competency, and grants XP.

---

## Workflow D: Collaborative Study Room Lifecycle & LiveKit Audio Connection

### Preconditions
- Host and participants hold valid accounts and are enrolled in the course.

### Actors
- **Host Student**
- **Peer Students**
- **Next.js Web App**
- **NestJS Control Plane**
- **LiveKit Cloud (Media Plane)**

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Host
    actor Peer
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane
    participant LK as LiveKit Cloud (Media Plane)
    participant DB as MongoDB

    Host->>Web: Click "Start Study Room" for Database Systems
    Web->>Nest: POST /api/v1/study/rooms (Contract 10)
    Nest->>DB: Create StudyRoom (status: "active", inviteCode: "DB1NF2")
    Nest-->>Web: Room Created (roomId, inviteCode)

    Host->>Web: Consent to AI Audio Processing
    Web->>Nest: POST /api/v1/study/rooms/:id/livekit-token (Contract 11)
    Nest->>Nest: Validate Enrollment & Voice Consent
    Nest->>Nest: Generate Cryptographic LiveKit Token (canPublish: true)
    Nest-->>Web: Return LiveKit Token & WSS URL
    Web->>LK: Connect to LiveKit Room (WebSocket / WebRTC)
    LK-->>Web: Connected to Media Plane

    Peer->>Web: Enter Invite Code "DB1NF2"
    Web->>Nest: POST /api/v1/study/rooms/join
    Nest->>Nest: Verify Course Access & Consent
    Nest->>DB: Add Participant to StudyRoom
    Nest-->>Web: 200 OK + LiveKit Token
    Web->>LK: Connect Peer Audio Track
    LK-->>Host: Peer Joined Media Stream
    LK-->>Peer: Host Audio Stream Subscribed
```

---

## Workflow E: Multi-Speaker Realtime AI Voice Moderation

### Preconditions
- Study room active with 2+ participants connected to LiveKit Cloud with granted voice consent.

### Actors
- **Students (Habib & Tasnim)**
- **LiveKit Cloud**
- **Python LiveKit Agent** (Deepgram STT, Cartesia TTS, LiteLLM)
- **NestJS Control Plane**

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor S1 as Student 1 (Habib)
    actor S2 as Student 2 (Tasnim)
    participant LK as LiveKit Cloud
    participant Agent as Python LiveKit Agent
    participant STT as Deepgram Nova-3
    participant LLM as LiteLLM (Large Model)
    participant TTS as Cartesia Sonic 3.6
    participant Nest as NestJS Control Plane

    S1->>LK: Speaks into mic: "Is a phone number list allowed in 1NF?"
    LK->>Agent: Audio Buffer (Track S1)
    Agent->>STT: Stream Audio
    STT-->>Agent: Transcript: "Is a phone number list allowed in 1NF?" (Speaker: S1)

    S2->>LK: Speaks into mic: "Yeah, as long as it's just one string column."
    LK->>Agent: Audio Buffer (Track S2)
    Agent->>STT: Stream Audio
    STT-->>Agent: Transcript: "Yeah, as long as it's just one string column." (Speaker: S2)

    Agent->>Agent: Facilitator Policy: Detect Misconception (S2 incorrect)
    Agent->>Agent: Peer-First Rule: Do NOT state correct answer directly
    Agent->>LLM: Formulate Peer Nudge (Contract 15)
    LLM-->>Agent: "Habib, Tasnim mentioned storing multiple numbers in one string. Does that satisfy atomicity?"
    Agent->>TTS: Stream Text to Synthesizer
    TTS-->>Agent: Synthesized Audio Chunks
    Agent->>LK: Publish Audio to Room Audio Track
    LK-->>S1: Hear Spoken Moderator Nudge
    LK-->>S2: Hear Spoken Moderator Nudge
```

---

## Workflow F: AI-Triggered Intelligent UI Synchronization

### Preconditions
- Study room active; students discuss a problem where visual or interactive support is requested.

### Actors
- **Students in Study Room**
- **Python LiveKit Agent**
- **NestJS Control Plane**
- **Room WebSocket Server**
- **Next.js React Client**

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Agent as Python LiveKit Agent
    participant Nest as NestJS Control Plane
    participant WS as Room WebSocket (/ws/realtime)
    participant Web as Next.js React UI

    Student->>Agent: Spoken: "Can you give us a practice exercise on this?"
    Agent->>Agent: Intent: Request Practice Exercise
    Agent->>Nest: POST /internal/rooms/:id/propose-action (Contract 16)
    Note over Agent,Nest: AI proposes action; NestJS validates authority
    Nest->>Nest: Validate Activity Schema (Contract 04)
    Nest->>Nest: Update Room State: activeActivityId = "act_01HXYZ9999"
    Nest->>WS: Broadcast ROOM_STATE_SYNC (Contract 13)
    WS-->>Web: Deliver Synced State to all connected clients
    Web->>Web: Mount Trusted React Interactive Component (Quiz/Guided Problem)
    Web-->>Student: UI Displays Interactive Exercise Simultaneously
```

---

## Workflow G: Individual Evaluation & Evidence Generation After Group Study

### Preconditions
- Study room currently presenting a shared activity; students submit answers individually.

### Actors
- **Student 1** & **Student 2**
- **Next.js Web App**
- **NestJS Control Plane**
- **Evidence & Gamification Engine**

### Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor S1 as Student 1
    actor S2 as Student 2
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane
    participant DB as MongoDB
    participant WS as Room WebSocket

    Note over S1,S2: Both view the same exercise on screen
    S1->>Web: Selects Options & Clicks "Submit My Answer"
    Web->>Nest: POST /api/v1/study/activities/:id/attempts (Contract 05)
    Note over Web,Nest: S1 attempt sent privately via authenticated HTTP

    Nest->>Nest: Evaluate S1 Answer against Server-Side Rubric
    Nest->>DB: Store Private Attempt (score: 1.0, isCorrect: true)
    Nest->>DB: Record Learning Evidence (Contract 07)
    Nest->>DB: Update S1 Competency (Contract 08)
    Nest->>DB: Award XP in RankEventLedger (Contract 09)
    Nest-->>Web: Return Assessment Result (Contract 06 - S1 Only)
    Web-->>S1: Show Private Feedback & Score

    Nest->>WS: Broadcast Tally Update: { publicSubmissionsCount: 1 }
    WS-->>S2: Update UI: "1/2 Peers have submitted" (S1 answer NOT revealed)

    S2->>Web: Selects Options & Clicks "Submit My Answer"
    Web->>Nest: POST /api/v1/study/activities/:id/attempts
    Nest->>DB: Store S2 Private Attempt & Evidence
    Nest-->>Web: Return Assessment Result (S2 Only)
    Nest->>WS: Broadcast: { publicSubmissionsCount: 2, phase: "debrief_ready" }
```

---

## Workflow H: Resilient Failure Recovery & Degraded Operation

### Scenario 1: Voice Media / STT / TTS Outage
```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant LK as LiveKit Cloud
    participant Agent as Python LiveKit Agent
    participant Web as Next.js Web App
    participant Nest as NestJS Control Plane

    Note over Agent: Deepgram STT or Cartesia TTS times out
    Agent->>Nest: POST /internal/rooms/:id/moderator-status { status: "degraded_text_only" }
    Nest->>Web: WebSocket: "AI Voice offline; text chat assistant active"
    Web-->>Student: Display Non-blocking Status Banner
    Note over Student,LK: Student-to-student WebRTC audio CONTINUES UNINTERRUPTED
    Student->>Web: Types question in Room Chat
    Web->>Nest: Dispatches text query to Socratic Tutor
    Nest-->>Web: Delivers text response; room proceeds normally
```

### Scenario 2: Large LLM Provider Outage (Compact Model Fallback)
```mermaid
sequenceDiagram
    autonumber
    participant Nest as NestJS Control Plane
    participant AI as Python AI Service
    participant Large as Capable Model (Claude 3.5 Sonnet)
    participant Compact as Compact Model (Gemini 1.5 Flash)
    participant Web as Next.js Web App

    Nest->>AI: Complex Misconception Evaluation Request
    AI->>Large: Forward Prompt (timeout: 8000ms)
    Note over Large: 503 Provider Quota Exceeded / Timeout
    AI->>AI: Trigger Fallback Policy
    AI->>Compact: Forward Simplified Classification Prompt
    Compact-->>AI: Bounded Diagnostic Hint
    AI-->>Nest: Return Response with Flag: { isTentative: true, model: "compact" }
    Nest-->>Web: Render Hint with Badge: "Preliminary AI Review"
```

---

*These 8 workflows represent the complete functional behavior of EdNova.*

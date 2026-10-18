# EdNova — Technical Contracts Specification

**Status:** Authoritative / Implementation-Ready  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0)

This document specifies the 18 authoritative technical contracts governing communication across the Control Plane (NestJS), Media Plane (LiveKit Cloud), and Intelligence Plane (Python AI Service + LiveKit Agents).

All producers and consumers must validate payloads strictly against these schemas. Unknown properties are rejected (`additionalProperties: false`), and payload drift fails CI checks.

---

## Contract Index

1. [Contract 01: Course Ingestion Job](#contract-01-course-ingestion-job)
2. [Contract 02: Course Extraction Result](#contract-02-course-extraction-result)
3. [Contract 03: Published Course Context](#contract-03-published-course-context)
4. [Contract 04: Public Learning Activity Definition](#contract-04-public-learning-activity-definition)
5. [Contract 05: Activity Interaction & Private Submission](#contract-05-activity-interaction--private-submission)
6. [Contract 06: Assessment Result](#contract-06-assessment-result)
7. [Contract 07: Learning Evidence Record](#contract-07-learning-evidence-record)
8. [Contract 08: Competency State Update](#contract-08-competency-state-update)
9. [Contract 09: XP & Gamification Event](#contract-09-xp--gamification-event)
10. [Contract 10: Study Room Lifecycle (Create/Join/Leave)](#contract-10-study-room-lifecycle-createjoinleave)
11. [Contract 11: LiveKit Access Token Issuance](#contract-11-livekit-access-token-issuance)
12. [Contract 12: AI Moderator Dispatch](#contract-12-ai-moderator-dispatch)
13. [Contract 13: Study Room State Synchronization](#contract-13-study-room-state-synchronization)
14. [Contract 14: Facilitator Observation Input](#contract-14-facilitator-observation-input)
15. [Contract 15: Facilitator Intervention Proposal](#contract-15-facilitator-intervention-proposal)
16. [Contract 16: AI-to-UI Room Command](#contract-16-ai-to-ui-room-command)
17. [Contract 17: Collaborative Group Debrief](#contract-17-collaborative-group-debrief)
18. [Contract 18: Room-Private Tutor Request](#contract-18-room-private-tutor-request)

---

## Contract 01: Course Ingestion Job

* **Purpose**: Dispatches uploaded academic resources (PDF, syllabus, lecture notes) for asynchronous text extraction, structuring, and Bloom classification.
* **Owner**: Habib (Course Studio & Access)
* **Producer**: NestJS `study` module
* **Consumer**: Python `agents.course_ingestion` worker
* **Transport**: RabbitMQ topic exchange `mindflow.jobs`, routing key `study.ingest.course`
* **Idempotency**: Handled via `correlationId` and Redis lock `lease:ingest:{courseId}:{documentId}`.
* **Failure Behavior**: Retryable errors re-queue via exponential backoff; terminal errors write failure status to MongoDB and route to DLQ `ai.dlq.study.ingest.course`.

### Schema & Payload (Node → Python)
```json
{
  "messageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "0f8e2d1a-3b4c-5d6e-7f80-91a2b3c4d5e6",
  "type": "study.ingest.course",
  "version": "1",
  "userId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "requestId": "req-9f8e7d6c",
  "timestamp": "2026-10-18T18:00:00.000Z",
  "payload": {
    "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
    "documentId": "doc_01HXYZ12345678",
    "storageKey": "uploads/courses/66f1e2b3c4d5e6f7a8b9c0aa/syllabus.pdf",
    "mimeType": "application/pdf",
    "fileSizeBytes": 4512900,
    "options": {
      "extractBloomTaxonomy": true,
      "maxChunkTokens": 512,
      "language": "en"
    }
  }
}
```

---

## Contract 02: Course Extraction Result

* **Purpose**: Returns extracted hierarchical chapters, topics, learning objectives with Bloom levels, and source provenance offsets to the Control Plane.
* **Owner**: Habib (Course Studio & Access)
* **Producer**: Python `agents.course_ingestion` worker
* **Consumer**: NestJS `study` module (Job Result Listener)
* **Transport**: RabbitMQ topic exchange `mindflow.jobs`, routing key `study.ingest.course.result`
* **Idempotency**: Consumer checks if `courseId` draft already contains `documentId` extraction; updates draft revision atomically.

### Schema & Payload (Python → Node)
```json
{
  "messageId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "correlationId": "0f8e2d1a-3b4c-5d6e-7f80-91a2b3c4d5e6",
  "type": "study.ingest.course",
  "version": "1",
  "requestId": "req-9f8e7d6c",
  "timestamp": "2026-10-18T18:00:45.000Z",
  "status": "completed",
  "payload": {
    "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
    "documentId": "doc_01HXYZ12345678",
    "pageCount": 42,
    "extractedChapters": [
      {
        "chapterTitle": "Relational Database Normalization",
        "orderIndex": 1,
        "topics": [
          {
            "topicTitle": "First Normal Form (1NF)",
            "orderIndex": 1,
            "objectives": [
              {
                "objectiveId": "obj_01HXYZ1111",
                "statement": "Identify repeating groups and atomic attribute violations in relational schemas",
                "bloomLevel": "analyze",
                "knowledgeType": "conceptual",
                "provenance": {
                  "pageNumber": 12,
                  "charStart": 1420,
                  "charEnd": 1950,
                  "sourceExcerpt": "A relation is in 1NF if and only if all underlying domains contain atomic values only..."
                }
              }
            ]
          }
        ]
      }
    ],
    "vectorIndexKey": "faiss/66f1e2b3c4d5e6f7a8b9c0aa/doc_01HXYZ12345678.index"
  }
}
```

---

## Contract 03: Published Course Context

* **Purpose**: Authoritative, read-only projection of a published, immutable course revision provided to Individual Tutoring, Diagnostic Engines, and Study Together Rooms.
* **Owner**: Habib (Course Studio & Access)
* **Producer**: NestJS `study` module
* **Consumer**: Tasnim (Individual Learning), Aziz (Study Together)
* **Transport**: In-process domain query (`module://study/published-context/:courseId`) or REST `/api/v1/study/courses/:courseId/published-context`
* **Authorization**: User must be enrolled in the course or possess institutional student/instructor rights.

### Schema & Payload
```json
{
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "contentHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "title": "Database Systems & Design",
  "institutionId": "inst_tunis_polytech",
  "isPublished": true,
  "publishedAt": "2026-10-18T18:15:00.000Z",
  "authorizedDocumentIds": ["doc_01HXYZ12345678"],
  "vectorIndexRef": "faiss/66f1e2b3c4d5e6f7a8b9c0aa/rev_20261018_v1.index",
  "topics": [
    {
      "topicId": "top_norm_01",
      "title": "First Normal Form (1NF)",
      "objectives": [
        {
          "objectiveId": "obj_01HXYZ1111",
          "statement": "Identify repeating groups and atomic attribute violations in relational schemas",
          "bloomLevel": "analyze"
        }
      ]
    }
  ]
}
```

---

## Contract 04: Public Learning Activity Definition

* **Purpose**: Declarative definition of an interactive learning activity (Quiz, Guided Problem, Visualizer, Parameter Explorer) returned to client browsers.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `study` module (via Tasnim activity registry service)
* **Consumer**: Next.js React renderer (`study-partner-web/src/features/learning/activity-renderer.tsx`), Aziz study rooms
* **Transport**: Server Action / REST `GET /api/v1/study/activities/:activityId`
* **Security Rule**: **Never exposes answer keys, solutions, or grading rubrics to the client browser.**

### Schema & Payload
```json
{
  "activityId": "act_01HXYZ9999",
  "activityType": "InteractiveQuiz",
  "schemaVersion": "1.0.0",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "objectiveId": "obj_01HXYZ1111",
  "title": "1NF Decomposition Challenge",
  "instructions": "Select all attribute sets that violate First Normal Form in the table below.",
  "timeLimitSeconds": 180,
  "presentationData": {
    "question": "Which of the following table definitions violate 1NF?",
    "options": [
      { "id": "opt_a", "label": "Student(StudentID, FullName, CourseCodes[Array])" },
      { "id": "opt_b", "label": "Enrollment(StudentID, CourseCode, Semester)" },
      { "id": "opt_c", "label": "Order(OrderID, CustomerName, ItemsCommaSeparated)" }
    ],
    "isMultiSelect": true
  },
  "constraints": {
    "maxAttempts": 2,
    "allowCalculator": false
  }
}
```

---

## Contract 05: Activity Interaction & Private Submission

* **Purpose**: Submits a learner's private answer attempt for server-side evaluation.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: Next.js Server Action (`study-partner-web/src/features/learning/actions.ts`)
* **Consumer**: NestJS `study` evaluation endpoint
* **Transport**: Authenticated HTTPS POST `/api/v1/study/activities/:activityId/attempts`
* **Idempotency**: Submissions include `attemptId` (UUID v4) generated by the client. Multiple submissions with identical `attemptId` return the cached evaluation result.

### Schema & Payload
```json
{
  "attemptId": "att_01HXYZ7777AAAA",
  "activityId": "act_01HXYZ9999",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "roomId": null,
  "timeSpentSeconds": 42,
  "answers": {
    "selectedOptionIds": ["opt_a", "opt_c"]
  }
}
```

---

## Contract 06: Assessment Result

* **Purpose**: Returns evaluated correctness, pedagogical feedback, and next-step recommendations to the individual student.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `study` module (evaluator service)
* **Consumer**: Next.js UI
* **Transport**: Response to `POST /api/v1/study/activities/:activityId/attempts`
* **Privacy Boundary**: In a collaborative room, this payload is delivered **strictly to the submitting user**. Peers receive only a non-revealing completion signal.

### Schema & Payload
```json
{
  "attemptId": "att_01HXYZ7777AAAA",
  "status": "graded",
  "score": 1.0,
  "isCorrect": true,
  "feedback": "Excellent reasoning! Array columns and comma-separated values violate atomicity, which is the foundational rule of 1NF.",
  "bloomLevelDemonstrated": "analyze",
  "socraticHint": null,
  "recommendedNextStep": {
    "type": "advance",
    "nextObjectiveId": "obj_01HXYZ2222",
    "title": "Second Normal Form (2NF) & Full Functional Dependency"
  }
}
```

---

## Contract 07: Learning Evidence Record

* **Purpose**: Immutable domain proof of learning progress created upon verified assessment completion.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `study` evaluator service
* **Consumer**: NestJS `user-profile` (competency & gamification engines)
* **Transport**: In-process dispatch (`module://user-profile/record-evidence`)
* **Database Target**: MongoDB collection `learning_evidence`
* **Idempotency**: Unique compound index on `attemptId`.

### Schema & Payload
```json
{
  "evidenceId": "evi_01HXYZ8888BBBB",
  "userId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "objectiveId": "obj_01HXYZ1111",
  "activityId": "act_01HXYZ9999",
  "attemptId": "att_01HXYZ7777AAAA",
  "bloomLevel": "analyze",
  "score": 1.0,
  "masteryAchieved": true,
  "evaluator": {
    "type": "deterministic_rubric",
    "model": null
  },
  "timestamp": "2026-10-18T18:20:15.000Z"
}
```

---

## Contract 08: Competency State Update

* **Purpose**: Updates the learner's knowledge level for a specific educational objective based on accumulated learning evidence.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `user-profile` competency service
* **Consumer**: MongoDB collection `competencies`, Learner Dashboard UI
* **Transport**: Internal database transaction

### Schema & Payload
```json
{
  "userId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "objectiveId": "obj_01HXYZ1111",
  "currentLevel": "analyze",
  "masteryScore": 0.85,
  "attemptsCount": 2,
  "successCount": 2,
  "lastEvaluatedAt": "2026-10-18T18:20:15.000Z",
  "status": "mastered"
}
```

---

## Contract 09: XP & Gamification Event

* **Purpose**: Awards XP and unlocks achievements through an append-only ledger following verified learning evidence.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `user-profile` gamification engine
* **Consumer**: MongoDB collections `rank_event_ledger`, `users`
* **Anti-Farming Rule**: Enforces daily caps per topic (`maxDailyXP: 300`) and unique `eventKey` (`xp:{userId}:{evidenceId}`).

### Schema & Payload
```json
{
  "eventKey": "xp:66f1e2b3c4d5e6f7a8b9c0d1:evi_01HXYZ8888BBBB",
  "userId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "eventType": "LEARNING_EVIDENCE_ACCEPTED",
  "xpAmount": 50,
  "evidenceId": "evi_01HXYZ8888BBBB",
  "reason": "Mastered 1NF Analysis Objective",
  "timestamp": "2026-10-18T18:20:16.000Z",
  "resultingTotalXP": 1450,
  "currentLevel": 4,
  "unlockedBadges": ["NORMALIZATION_APPRENTICE"]
}
```

---

## Contract 10: Study Room Lifecycle (Create/Join/Leave)

* **Purpose**: Manages virtual collaboration rooms for group study.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Client browser / Next.js Server Actions
* **Consumer**: NestJS `study` module (study room coordinator)
* **Transport**: HTTPS POST `/api/v1/study/rooms`, POST `/api/v1/study/rooms/join`, POST `/api/v1/study/rooms/:roomId/leave`
* **Validation**: Validates enrollment in `courseId` before granting room entry.

### Create Room Request
```json
{
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "title": "Midterm Database Prep Group",
  "maxParticipants": 6,
  "moderatorMode": "guided",
  "enableVoice": true
}
```

### Create / Join Response
```json
{
  "roomId": "room_01HXYZ5555CCCC",
  "inviteCode": "DB1NF2",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "title": "Midterm Database Prep Group",
  "presenterUserId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "moderatorMode": "guided",
  "participantsCount": 1,
  "createdAt": "2026-10-18T18:25:00.000Z"
}
```

---

## Contract 11: LiveKit Access Token Issuance

* **Purpose**: Issues a short-lived, cryptographically signed JWT granting audio connection to a LiveKit room.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: NestJS `notification` / realtime service
* **Consumer**: Next.js client WebRTC component (`study-partner-web/src/features/collaboration/voice-room.tsx`)
* **Transport**: Authenticated HTTPS POST `/api/v1/study/rooms/:roomId/livekit-token`
* **Voice Consent Prerequisite**: Student must have consented to AI audio processing (`hasVoiceConsent: true`). If consent is missing, token denies audio publish or joins with AI disabled.

### Token Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "livekitUrl": "wss://ednova-livekit.cloud.livekit.io",
  "roomName": "room_01HXYZ5555CCCC",
  "participantIdentity": "usr_66f1e2b3c4d5e6f7a8b9c0d1",
  "participantName": "Habib S.",
  "expiresInSeconds": 3600,
  "canPublishAudio": true,
  "canSubscribeAudio": true
}
```

---

## Contract 12: AI Moderator Dispatch

* **Purpose**: Instructs the Python LiveKit Agent worker to join a newly active study room as the voice & pedagogical facilitator.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: NestJS `study` module (room lifecycle handler)
* **Consumer**: Python LiveKit Agent Dispatcher
* **Transport**: Authenticated HTTP POST to private AI gateway `http://study-partner-ai:8000/internal/livekit/dispatch`
* **Security**: Protected with `INTERNAL_API_SECRET`.

### Dispatch Payload
```json
{
  "roomName": "room_01HXYZ5555CCCC",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "moderatorMode": "guided",
  "learningContext": {
    "currentTopic": "First Normal Form (1NF)",
    "targetObjectiveId": "obj_01HXYZ1111"
  },
  "participantRoster": [
    { "userId": "usr_111", "name": "Habib", "hasVoiceConsent": true },
    { "userId": "usr_222", "name": "Tasnim", "hasVoiceConsent": true }
  ]
}
```

---

## Contract 13: Study Room State Synchronization

* **Purpose**: Broadcasts authoritative synchronized room state (current exercise, presenter, participant list, public submission tallies) to all room members.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: NestJS `notification` WebSocket server (`/ws/realtime`)
* **Consumer**: All connected client browsers in the room
* **Transport**: WebSocket JSON messages with sequence numbering (`seq`)

### State Broadcast Payload
```json
{
  "type": "ROOM_STATE_SYNC",
  "roomId": "room_01HXYZ5555CCCC",
  "seq": 14,
  "timestamp": "2026-10-18T18:30:00.000Z",
  "presenterUserId": "usr_111",
  "activeActivityId": "act_01HXYZ9999",
  "currentPhase": "peer_discussion",
  "participants": [
    { "userId": "usr_111", "name": "Habib", "isOnline": true, "isSpeaking": false, "hasSubmitted": true },
    { "userId": "usr_222", "name": "Tasnim", "isOnline": true, "isSpeaking": true, "hasSubmitted": false }
  ],
  "publicSubmissionsCount": 1
}
```

---

## Contract 14: Facilitator Observation Input

* **Purpose**: Feeds speaker-attributed human utterances and room event telemetry into the facilitator's educational reasoning policy.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Python LiveKit Agent (Deepgram STT stream processor)
* **Consumer**: Python Facilitation Policy Engine (`study-partner-ai/agents/facilitator`)
* **Transport**: In-process Python async queue

### Observation Data Structure
```json
{
  "roomId": "room_01HXYZ5555CCCC",
  "speakerUserId": "usr_222",
  "speakerName": "Tasnim",
  "transcriptText": "Wait, I think a table is in 1NF as long as every student has a unique primary key ID.",
  "confidence": 0.94,
  "isFinal": true,
  "durationSeconds": 3.8,
  "activeActivityId": "act_01HXYZ9999",
  "recentDialogueContext": [
    { "speaker": "Habib", "text": "Does 1NF allow comma separated subjects?" }
  ]
}
```

---

## Contract 15: Facilitator Intervention Proposal

* **Purpose**: Output of the facilitation policy engine proposing a spoken response or educational hint.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Python Facilitation Policy Engine
* **Consumer**: LiveKit Agent TTS pipeline (`Cartesia Sonic 3.6`) and NestJS Control Plane (for UI sync)
* **Peer-First Policy**: Must query peer reasoning before providing hints; direct answers are forbidden.

### Intervention Proposal
```json
{
  "interventionId": "int_01HXYZ4444DDDD",
  "roomId": "room_01HXYZ5555CCCC",
  "strategy": "PEER_CHALLENGE",
  "targetSpeakerId": "usr_111",
  "reasoning": "Tasnim confused 1NF (atomic values) with entity integrity (primary key uniqueness).",
  "spokenResponseText": "Habib, Tasnim mentioned that a unique ID is enough for 1NF. Looking at the course definition on screen, what do you think about her statement?",
  "proposedUICommand": null,
  "cooldownSeconds": 15
}
```

---

## Contract 16: AI-to-UI Room Command

* **Purpose**: Action proposed by the AI moderator to update the synchronized room UI (e.g., displaying an activity, advancing a step).
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Python LiveKit Agent
* **Consumer**: NestJS `study` module (validated before broadcasting to room WebSocket)
* **Security Rule**: The AI **cannot directly mutate state**; NestJS verifies room state and permission before executing.

### Command Payload (Python → NestJS)
```json
{
  "roomId": "room_01HXYZ5555CCCC",
  "action": "DISPLAY_ACTIVITY",
  "activityId": "act_01HXYZ9999",
  "reason": "Students deadlocked on 1NF definition; launching diagnostic problem."
}
```

---

## Contract 17: Collaborative Group Debrief

* **Purpose**: Synthesizes group achievements and areas needing review at the end of a study room session.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Python Facilitator worker (via RabbitMQ or interactive AI call)
* **Consumer**: NestJS `study` module -> Room summary screen
* **Privacy Boundary**: Synthesized from **public room transcripts and aggregated outcomes only**. Individual answers and private tutor chats are excluded.

### Debrief Payload
```json
{
  "roomId": "room_01HXYZ5555CCCC",
  "sessionDurationMinutes": 45,
  "conceptsDiscussed": ["First Normal Form", "Atomic Attributes", "Composite Keys"],
  "groupMasterySummary": "The team successfully analyzed non-atomic attribute violations after initial confusion around primary keys.",
  "strengths": ["Active peer questioning", "Collaborative derivation of 1NF rules"],
  "recommendedReview": [
    {
      "topic": "Difference between 1NF and Entity Integrity",
      "courseSectionRef": "Chapter 1, Page 14"
    }
  ]
}
```

---

## Contract 18: Room-Private Tutor Request

* **Purpose**: Enables a student to ask the AI Socratic Tutor private questions while remaining inside a collaborative study room.
* **Owner**: Aziz (Study Together) & Tasnim (Individual Learning)
* **Producer**: Next.js client private side-panel (`study-partner-web/src/features/collaboration/private-tutor.tsx`)
* **Consumer**: NestJS `study` tutor service -> Python interactive AI API
* **Isolation Rule**: Messages, hints, and context are **never broadcast to the room WebSocket, room chat, or LiveKit audio**.

### Request Payload
```json
{
  "roomId": "room_01HXYZ5555CCCC",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "objectiveId": "obj_01HXYZ1111",
  "userQuestion": "I'm embarrassed to ask the group: why is a phone number with multiple entries considered non-atomic?",
  "dialogueHistory": []
}
```

### Response Payload
```json
{
  "tutorResponse": "Don't worry, that is a very common point of confusion! In relational databases, atomic means a column holds exactly one value per row. If you store two numbers like '555-1234, 555-5678' in one cell, queries can't easily search or index individual numbers. How might you redesign that table so each number has its own row?",
  "suggestedFollowUp": "Should I create a separate PhoneNumbers table?"
}
```

---

*All 18 contracts are binding for the EdNova engineering team.*

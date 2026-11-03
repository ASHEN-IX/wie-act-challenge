# EdNova — Technical Contracts Specification

**Status:** Authoritative / Implementation-Ready  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0)

This document specifies the 18 authoritative technical contracts governing communication across the Control Plane (NestJS), Media Plane (LiveKit Cloud), and Intelligence Plane (Python AI Service + LiveKit Agents).

All producers and consumers must validate payloads strictly against these schemas. Unknown properties are rejected (`additionalProperties: false`), and payload drift fails CI checks.

---

## Executable v1 candidate — 23 October 2026

[ED-26 v1 candidate](ednova-v1.md), [shared fixtures](ednova-v1-fixtures.json) and [structural JSON Schema export](ednova-v1.schema.json) supply executable bounded contracts for future source/activity/attempt/evidence/room integration. **Domain-owner review and official freeze are pending; ED-26 remains PARTIAL.** Existing runtime replay/presence/peer-text supplements and M02 security policy remain unchanged. Historical examples below are illustrative where the candidate explicitly resolves discrepancies (attempt UUID versus `att_` sample; Python `messageText` versus spokenResponseText; public versus server-only source/index fields). No documented future endpoint is made operational by adding a schema.

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

`revisionId` is the immutable `revisionTag`, scoped by `courseId`; it is not the MongoDB `_id`. The public `PublishedContext` candidate excludes `vectorIndexRef`. The server-only `SourceResolution` carries the exact relative index artifact `faiss/<courseId>/<revisionId>.faiss`; the future metadata sidecar is `faiss/<courseId>/<revisionId>.meta.json`. The current Python adapter is still course-scoped and is not evidence that revision-aware retrieval is implemented.

---

## Contract 04: Public Learning Activity Definition

* **Purpose**: Declarative definition of an interactive learning activity returned to client browsers. Contract `1.0.0` accepts only `InteractiveQuiz` and `GuidedProblem`; `StepByStepVisualizer` and `ParameterExplorer` remain future reviewed versions.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `study` module (via Tasnim activity registry service)
* **Consumer**: Next.js React renderer (`apps/web/src/features/learning/activity-renderer.tsx`), Aziz study rooms
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
* **Producer**: Next.js Server Action (`apps/web/src/features/learning/actions.ts`)
* **Consumer**: NestJS `study` evaluation endpoint
* **Transport**: Authenticated HTTPS POST `/api/v1/study/activities/:activityId/attempts`
* **Idempotency**: Submissions include `attemptId` (lowercase UUID v4) generated by the client. Durable receipt identity is `(authenticated userId, attemptId)`, not a global `attemptId`; the unique index is `{ userId: 1, attemptId: 1 }`. Identical retries by the same actor return the cached result, while a conflicting payload returns 409. The illustrative `attemptId` below is normalized to UUID v4.

### Schema & Payload
```json
{
  "attemptId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
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

The candidate `Graded` variant makes both `socraticHint` and `recommendedNextStep` required-but-nullable. A non-null hint is plain text bounded at 8,000 Unicode scalar values. A non-null next step contains only the provisional `type: "advance"`, a valid `nextObjectiveId` and a title bounded at 200 scalars. The exact next-step enum remains subject to Tasnim's approval. These fields are private to the authenticated recipient and are not part of `PublicCompletion` or public room state.

---

## Contract 07: Learning Evidence Record

* **Purpose**: Immutable domain proof of learning progress created upon verified assessment completion.
* **Owner**: Tasnim (Individual Learning)
* **Producer**: NestJS `study` evaluator service
* **Consumer**: NestJS `user-profile` (competency & gamification engines)
* **Transport**: In-process dispatch (`module://user-profile/record-evidence`)
* **Database Target**: MongoDB collection `learning_evidence`
* **Idempotency**: Unique compound index on `{ userId: 1, attemptId: 1 }`; evidence must prove attempt ownership. An `attemptId`-only lookup is not a global uniqueness constraint.

### Schema & Payload
```json
{
  "evidenceId": "evi_01HXYZ8888BBBB",
  "userId": "66f1e2b3c4d5e6f7a8b9c0d1",
  "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
  "revisionId": "rev_20261018_v1",
  "objectiveId": "obj_01HXYZ1111",
  "activityId": "act_01HXYZ9999",
  "attemptId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
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

### Contract 10/13 additive durable command replay — 22 October 2026

The existing create, join, leave, phase and presenter endpoints accept `commandId` (client-generated UUID v4). Phase, presenter and leave also require `expectedSeq` (positive integer matching the current room sequence for a **new** command). Create and join do not require a sequence: creation has no prior room and invite holders do not have an authorized snapshot before joining. Unknown properties are rejected. Existing requests without `commandId` retain legacy validation/behavior and **do not have durable replay guarantees**. Supported Next.js room controls send command IDs; `/ws/realtime` forwards replay metadata on existing `change_phase` / `change_presenter` actions.

Example on the existing `PUT /api/v1/study/rooms/:roomId/phase`:

```json
{
  "commandId": "55a69ef9-374b-498b-a313-ef40798a9c04",
  "expectedSeq": 2,
  "currentPhase": "peer_discussion"
}
```

- Accepted receipt identity is `(roomId, authenticated actorId, commandId)`, with UUIDs normalized to lowercase. Creation uses `(authenticated hostUserId, commandId)` until its room ID exists, enforced by the partial unique `room_creation_command` index. Actor identity always comes from the session, never the body. Command kind and normalized validated payload, including `expectedSeq`, are hashed; key order is irrelevant. Reusing an accepted ID for a different payload or operation returns 409.
- The room mutation and receipt (original HTTP status and explicit public response projection) are one journaled, majority-acknowledged MongoDB document write. No separate claim, multi-document transaction, Redis lease or broker is involved. Distinct commands at one sequence compete through conditional writes. Same-target no-ops store a receipt without advancing the public sequence or broadcasting.
- Identical completed retries return the original status/body, not the latest state, with no mutation or new publication. Current room membership, presenter authority where required, and course access are rechecked before replay. Loss of authority returns 403 even if a command previously succeeded. A completed join cannot restore left/revoked membership.
- The sole membership exception is an actor replaying their own completed **leave**: it returns only the stored `{ "success": true, "roomId": "..." }` acknowledgement. It grants no room reads, new mutations, roster, or source access; current course access is still checked.
- Validation, authorization, stale-sequence, unsupported integration and capacity errors do not claim an ID and are not cached. After a known rejection, correct/reload and issue a new command. After 503 or a lost response, retry the **same ID and exact payload** because the write may already have committed. A stale unaccepted command stays rejected; an accepted receipt is found before checking the now-old expected sequence.
- Receipts are server-only, retained with the room, without TTL/pruning. Ordinary commands stop at 512 accepted receipts (including creation and no-ops) and return 409 when full; existing authorized replays remain available. A bounded reserve of `maxParticipants` additional leave receipts (at most 10) lets current members exit a full room. New joins cannot consume this reserve. This prevents unbounded document growth without silently invalidating deduplication or trapping participants. It is not an archive/rotation implementation.
- Only the winning request attempts the existing best-effort snapshot broadcast. WebSocket delivery is **not exactly once or durably queued**. A crash/acknowledgement loss after the database commit but before publication leaves room+receipt intact, but connected clients may miss the event. Reconnect through the existing full authoritative snapshot recovers state; replay does not rebroadcast. No outbox is claimed.
- The guarantee assumes mutation and receipts use this authoritative path, the room document/index is retained, and Mongo acknowledges the journaled write. External non-versioned database edits, replica rollback/hardware loss and browser refresh before retaining a command ID are not stronger guarantees. Published source revisions and private attempts remain unavailable as documented under ED-07.

Executed evidence: [durable replay verification](../../reports/ED-07-DURABLE-REPLAY.md). This addition implements room replay within Aziz's scope; it does not claim all ED-26 cross-member contracts or full ED-07 acceptance are complete.

---

## Contract 11: LiveKit Access Token Issuance

* **Purpose**: Issues a short-lived, cryptographically signed JWT granting audio connection to a LiveKit room.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: NestJS `notification` / realtime service
* **Consumer**: Next.js client WebRTC component (`apps/web/src/features/collaboration/voice-room.tsx`)
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
* **Transport**: Authenticated HTTP POST to private AI gateway `http://ai-service:8000/internal/livekit/dispatch`
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

### Contract 10/13 additive connection presence — 22 October 2026

Durable membership (`participants` without `leftAt`), presenter authority and room `seq` remain study-owned. A disconnected member remains a member. For dedicated `room_` rooms, online means at least one **open, currently authenticated and room/source-authorized** connection in the existing notification gateway registry. Tabs/devices aggregate by user; connecting grants no membership or authority. Transport changes never execute durable leave or write room participants, command receipts or sequence.

The single API instance overlays connection availability on outgoing `ROOM_STATE_SYNC` participant projections. It also sends complete ephemeral `ROOM_PRESENCE_SYNC` messages on connection cleanup/registration:

```json
{
  "type": "ROOM_PRESENCE_SYNC",
  "roomId": "room_example",
  "presenceEpoch": "server-process-uuid",
  "presenceVersion": 42,
  "onlineUserIds": ["authorized-member-id"]
}
```

Both messages carry the epoch/version and current online-user set. Versions increase within one server process and are independent of durable `seq`; they are not replay receipts. The existing frontend reducer ignores duplicate/older presence and foreign rooms/epochs, resets ephemeral ordering when a new socket opens, and reconciles equal-durable-sequence snapshots for presence only. Older snapshots cannot overwrite newer durable state. Offline members stay in the roster; explicit leave removes membership through the existing durable command. HTTP membership DTOs retain legacy persisted online flags for compatibility; these are **not live presence authority**. The room UI displays availability as unknown until its current connection receives gateway presence, and while disconnected/recovering.

Each delivery rechecks recipient session and current study-owned membership/source access, ejecting invalid sockets before aggregating or sending. Heartbeats revalidate idle sockets; the production interval remains 30 seconds. A missed pong is detected on the next check (nominally 30–60 seconds after an arbitrary network loss, plus event-loop delay); publication additionally takes authorization/queue time. Graceful close cleans immediately on the server close event. No per-heartbeat database presence writes, new polling, media subscription or credential/socket identifier broadcast is introduced.

**Topology:** current Compose fixes one API container and has no distributed socket/presence coordination. This registry gives single-instance presence only. Redis is provisioned and ADR-06 names shared ephemeral presence as the architectural target, but an implemented cross-instance presence/delivery mechanism is absent. This change does not claim that ADR-06 distributed target is complete; replicas require a separately reviewed integration using existing infrastructure. Restarts discard connection state; clients reconnect and recover the durable room snapshot plus new gateway presence. No process-kill, power-loss or multi-instance failover verification is claimed.

Evidence and limits: [presence verification](../../reports/ED-07-PRESENCE-VERIFICATION.md). Full ED-07 remains PARTIAL.

---

### Contract 10/13 additive AI-independent public peer text — 22 October 2026

The existing SessionChat router/model now support dedicated `room_` public peer messages independently of legacy AI `/query` search. No prior peer-send/deduplication/ordering contract existed; the following additive interface supplies that missing behavior. It does not change private-attempt, room-command or presence semantics.

**Send:** authenticated `POST /api/v1/session-chat/:sessionId/messages` with only:

```json
{
  "submissionId": "55a69ef9-374b-498b-a313-ef40798a9c04",
  "text": "Could a peer explain the next step?"
}
```

- `submissionId` is a client UUID v4, normalized to lowercase and scoped by `(roomId, authenticated senderUserId)`. The server derives sender ID/name; unknown fields, actor claims, objects/attachments, absent/empty/whitespace text, malformed Unicode and non-text controls are rejected. Trimmed text is limited to 2,000 UTF-16 units/8,000 UTF-8 bytes; the parsed JSON body's serialized UTF-8 representation is capped at 12,000 bytes. Existing shared request parsing/rate limiting remains in force. Text, including HTML/Markdown-looking text, is rendered literally with React escaping; no rich links or executable markup.
- Success is `201 { message }` only after journaled majority-acknowledged persistence. A message projects exactly `{ roomId, messageId, submissionId, senderUserId, senderName, text, seq, createdAt }`. `messageId` is server-generated, `createdAt` is a server timestamp and `seq` is a contiguous, per-room **message** acceptance sequence. Timestamp/arrival/presence order is not authoritative message order. Ordinary members may send; presenter status is irrelevant.
- The existing `sessionchats` collection stores one `messageType: peer_stream` journal per room, enforced by partial unique index `peer_room_journal`. Its bounded append assigns the next sequence and persists the public message in one atomic MongoDB update. This supports standalone Mongo without a two-document counter/message gap or a multi-document transaction. It creates no second chat collection, gateway, connection registry, broker or offline queue. Legacy AI history excludes the journal and legacy deletion cannot remove it.
- Same scoped ID and normalized text returns the original `201 { message }`; conflicting text returns 409. Concurrent duplicates append once. Current authentication, active membership/room status and source authorization are checked on every send/replay/history request through the existing study-owned boundary. Unauthorized/left/source-revoked participants cannot use replay for access. Authorization and acceptance across separate domain records are not a cross-document transaction.
- The journal retains **at most 1,000 accepted messages per room**. No TTL, eviction, pruning or archive is implemented. At capacity new submissions return 409; retained authorized replays/history continue working. Deduplication lasts while that journal is retained; deleting the room/journal/index is outside the guarantee. This is bounded retained history, not unlimited growth or an indefinite archival SLA.
- Validation/authorization/capacity errors do not accept an ID. A persistence error or lost acknowledgement may be an uncertain commit: retry the **same ID and exact text**. UI pending/failed/retryable states preserve the draft and ID while the room page remains mounted. Refresh recovers accepted history; unsent drafts/uncertain IDs are not separately persisted across page destruction.

**History:** existing authenticated `GET /api/v1/session-chat/:sessionId/history?kind=peer&afterSeq=0&limit=50`. `afterSeq` is a nonnegative safe integer; `limit` is 1–100, default 50. Unknown query fields are rejected in peer mode. Response:

```json
{
  "roomId": "room_example",
  "items": [],
  "lastSeq": 0,
  "nextAfterSeq": 0,
  "hasMore": false,
  "retention": { "maxMessages": 1000, "pruned": false }
}
```

Items are ascending by immutable message `seq`; `afterSeq` excludes earlier accepted positions. A cursor beyond the current stream returns 409, requiring recovery from zero. Empty history and unavailable history are distinct. With no pruning and atomic contiguous appends, accepted positions are never skipped by delayed writes; concurrent appends may appear on the next page/recovery. The UI recovers all retained pages after its authorized `ROOM_STATE_SYNC` on initial connect/reconnect and supports manual recovery. It merges history, acknowledgements and live events by immutable identities/order, discards obsolete recovery responses, and does not replace newer records with older history. A detected sequence gap is shown as incomplete history.

**Realtime:** existing `/ws/realtime` publishes `{ type: "ROOM_PEER_MESSAGE", roomId, message }` after a newly accepted write, using the existing recipient session/membership/source revalidation. No raw persistence document, private records, credentials or socket IDs are broadcast. Replays do not rebroadcast. Publication is best effort; failure after persistence does not revoke acceptance. History recovers missing publications; no exactly-once delivery or durable outbox is claimed. Live fanout remains single API instance; Mongo persistence/order is not evidence of distributed live delivery.

Room command `seq`/receipts and `presenceEpoch`/`presenceVersion` are unchanged. Neither message acceptance nor heartbeat activity awards learning credit or creates a private attempt. Evidence: [peer-text verification](../../reports/ED-07-PEER-TEXT-VERIFICATION.md). Full ED-07 remains PARTIAL.

---

## Contract 14: Facilitator Observation Input

* **Purpose**: Feeds speaker-attributed human utterances and room event telemetry into the facilitator's educational reasoning policy.
* **Owner**: Aziz (Study Together & Collaboration)
* **Producer**: Python LiveKit Agent (Deepgram STT stream processor)
* **Consumer**: Python Facilitation Policy Engine (`apps/ai/agents/facilitator`)
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
  "schemaVersion": "1.0.0",
  "status": "proposed",
  "interventionId": "int_01HXYZ4444DDDD",
  "roomId": "room_01HXYZ5555CCCC",
  "expectedSeq": 14,
  "pin": {
    "courseId": "66f1e2b3c4d5e6f7a8b9c0aa",
    "revisionId": "rev_20261018_v1",
    "contentHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "strategy": "PEER_CHALLENGE",
  "messageText": "Habib, Tasnim mentioned that a unique ID is enough for 1NF. Looking at the course definition on screen, what do you think about her statement?",
  "proposedUICommand": null,
  "cooldownSeconds": 15
}
```

The candidate replaces the illustrative `targetSpeakerId`, `reasoning` and `spokenResponseText` fields with the existing Python `messageText` boundary; legacy ED-09 behavior is unchanged. `pin` is nullable for a source-free room. A source-free proposal has `pin: null` and no `proposedUICommand`; a non-null UI command requires a matching source pin. Proposal decisions use a closed mapping:

| Status | Allowed failure codes |
|---|---|
| `rejected` | `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION` |
| `stale` | `STALE_REVISION` |
| `unavailable` | `UNAVAILABLE` |

The AI proposal is untrusted input. Only Nest may validate and apply a presenter-authorized durable mutation; `validated` does not mean accepted.

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
* **Producer**: Next.js client private side-panel (`apps/web/src/features/collaboration/private-tutor.tsx`)
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

## M02 enforcement supplement — current owner/resource scope

This supplement secures existing operations; it does not implement the future institutional, published-source or private-attempt contracts. Browser-supplied actor fields never override Better Auth identity. `module://` dispatch carries that identity through the same owning-domain handlers and resource policy. Study's current source decision is private personal ownership; invites and administrator status are not source grants. Conflicting resource aliases are invalid.

Node resolves planner source context through the owner-authorized Study operation and forwards only `_id`, title and topics over the existing service-authenticated transport. Python's planner accepts that authorized projection; a raw course ID without it is unavailable (503), and mismatching identities are invalid (422). Planner indexes are per request, and disk cache keys include actor and complete authorized context content. No shared title-only cache is used. Node rechecks the current source grant before returning a completed synchronous response.

Queued jobs persist server-derived `resourceScope` separately from private answer payloads. Result consumption binds correlation ID, message ID, request ID, job type, stored actor and applicable session/step/objective/course scope. Unknown or conflicting envelopes produce no private result writes. The first terminal completion/failure wins; accepted evaluation records use insert-only replay. Polling, cached jobs and materialized plans/tasks recheck the current source grant. Legacy jobs/plans with unknown provenance are denied and must be resubmitted. Explicit empty scope represents a new authorized source-free record.

Only allowlisted public avatar/subject/media assets are statically served. Course originals and extraction/staging paths require the existing authenticated owner download operation. Public WS projections remain unchanged; targeted legacy signaling additionally checks its intended recipient. Existing single-instance recipient validation, durable replay and presence remain authoritative. Enrollment/revision semantics and multi-instance coordination require their separate missions. [Executed matrix and limits](../../reports/EDNOVA-M02-RESOURCE-ISOLATION-VERIFICATION.md).

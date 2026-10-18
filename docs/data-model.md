# EdNova — Data Architecture & Schema Specification

**Status:** Authoritative / Implementation-Ready  
**Date:** 18 October 2026  
**Context:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0)

This document specifies the authoritative data architecture, storage ownership boundaries, and MongoDB collection schemas for EdNova. It reconciles current implementation schemas with the target models required for institutional access, Course Studio, intelligent activities, evidence tracking, and collaborative rooms.

---

## 1. Storage Ownership Matrix

EdNova enforces strict storage boundaries to prevent duplication and ensure that data is stored in the optimal persistence engine:

| Storage Engine | Owned Data / Artifacts | Access Control / Scope |
| :--- | :--- | :--- |
| **MongoDB 7.0** | Domain entities (Users, Courses, Revisions, Activities, Attempts, Evidence, Competencies, Rooms, Gamification Ledger). | Authenticated Control Plane (NestJS) and read-only Python workers. |
| **Private Object Storage / Volume** | Original uploaded PDFs, syllabus files, extracted images, sanitized document assets. | Private storage ACLs; streamed only via authenticated NestJS endpoints. |
| **FAISS Vector Store** | Dense text embeddings and vector indexes for course retrieval. | Disk-mounted Docker volume, namespaced by `courseId` and `revisionId`. |
| **Redis 7-alpine** | Deduplication leases (`SET NX EX 3600`), room heartbeats, rate-limit sliding windows. | Ephemeral state only; zero persistent business records. |
| **RabbitMQ 3** | In-flight event envelopes (`EXCHANGE_JOBS`), retry queues, and dead-letter queues (`ai.dlq.*`). | Message queues; messages consumed and acknowledged. |
| **Python Agent Memory** | Transient audio buffers, speaker diarization states, temporary dialogue buffers. | Bounded in-memory per live session; purged immediately upon room close. |

---

## 2. Core Domain Collections & Schema Specifications

### 2.1. Authentication & Identity
* **`auth_users` & `users`**: Domain identity created by Better-Auth and enriched with EdNova profile fields.
  - Fields: `_id` (ObjectId/string), `email` (string, unique), `name` (string), `hashedPassword` (string, bcrypt compatible), `emailVerified` (boolean), `createdAt` (Date).
* **`institutions`**: Represents university or organizational tenants.
  - Fields: `_id` (ObjectId), `name` (string), `domain` (string, e.g. `"polytechnique.tn"`), `slug` (string, unique), `isVerified` (boolean), `createdAt` (Date).
* **`institution_memberships`**: Links users to institutions with contextual roles.
  - Fields: `_id` (ObjectId), `institutionId` (ObjectId, ref: `institutions`), `userId` (string, ref: `users`), `role` (enum: `"university_admin"`, `"instructor"`, `"university_student"`), `status` (enum: `"active"`, `"invited"`, `"suspended"`), `createdAt` (Date).
  - **Index**: Unique compound index `{ institutionId: 1, userId: 1 }`.

### 2.2. Course Studio & Content Management
* **`courses`**: Top-level course entity supporting both institutional and personal courses.
  - Fields:
    - `_id` (ObjectId)
    - `title` (string)
    - `description` (string)
    - `scope` (enum: `"institutional"`, `"personal"`)
    - `institutionId` (ObjectId, optional, ref: `institutions`)
    - `ownerUserId` (string, ref: `users`)
    - `assignedInstructorIds` (array of string user IDs)
    - `activeRevisionId` (string, ref: `course_revisions`, nullable until published)
    - `status` (enum: `"draft"`, `"extracting"`, `"published"`, `"archived"`)
    - `createdAt` (Date), `updatedAt` (Date).
  - **Index**: `{ institutionId: 1, scope: 1 }`, `{ ownerUserId: 1 }`.

* **`course_revisions`**: Immutable snapshot of course structure, learning objectives, and retrieval references.
  - Fields:
    - `_id` (ObjectId)
    - `courseId` (ObjectId, ref: `courses`)
    - `revisionTag` (string, e.g. `"rev_20261018_v1"`)
    - `contentHash` (string, sha256 hash of all topics and objectives)
    - `status` (enum: `"draft"`, `"published"`, `"deprecated"`)
    - `publishedByUserId` (string, ref: `users`)
    - `publishedAt` (Date)
    - `sourceDocumentIds` (array of string document IDs)
    - `vectorIndexRef` (string, e.g. `"faiss/course_123/rev_1.index"`)
    - `structure` (array of Chapter objects: `chapterTitle`, `orderIndex`, `topics`: array of `{ topicId, title, objectiveIds }`)
  - **Index**: Unique compound index `{ courseId: 1, revisionTag: 1 }`.

* **`documents`**: Metadata for uploaded source materials.
  - Fields:
    - `_id` (ObjectId)
    - `courseId` (ObjectId, ref: `courses`)
    - `filename` (string)
    - `storageKey` (string, private S3 or volume path)
    - `mimeType` (string, e.g. `"application/pdf"`)
    - `fileSizeBytes` (number)
    - `pageCount` (number)
    - `checksum` (string, sha256)
    - `uploadedByUserId` (string)
    - `createdAt` (Date).

* **`learning_objectives`**: Granular pedagogical goals extracted from course documents.
  - Fields:
    - `_id` (ObjectId)
    - `courseId` (ObjectId, ref: `courses`)
    - `revisionId` (ObjectId, ref: `course_revisions`)
    - `topicId` (string)
    - `statement` (string)
    - `bloomLevel` (enum: `"remember"`, `"understand"`, `"apply"`, `"analyze"`, `"evaluate"`, `"create"`)
    - `knowledgeType` (enum: `"factual"`, `"conceptual"`, `"procedural"`, `"metacognitive"`)
    - `provenance` (object: `{ documentId, pageNumber, charStart, charEnd, sourceExcerpt }`)
    - `isInstructorReviewed` (boolean)
    - `createdAt` (Date).
  - **Index**: `{ courseId: 1, revisionId: 1, topicId: 1 }`.

* **`course_enrollments`**: Authorizes a student to access an institutional course.
  - Fields:
    - `_id` (ObjectId)
    - `courseId` (ObjectId, ref: `courses`)
    - `userId` (string, ref: `users`)
    - `status` (enum: `"active"`, `"dropped"`)
    - `enrolledAt` (Date).
  - **Index**: Unique compound index `{ courseId: 1, userId: 1 }`.

---

### 2.3. Intelligent Interactive UI & Learning Activities
* **`learning_activities`**: Reusable declarative interactive activities (quizzes, guided problems, visualizers).
  - Fields:
    - `_id` (ObjectId)
    - `activityId` (string, unique)
    - `activityType` (enum: `"InteractiveQuiz"`, `"GuidedProblem"`, `"StepByStepVisualizer"`, `"ParameterExplorer"`)
    - `schemaVersion` (string, e.g. `"1.0.0"`)
    - `courseId` (ObjectId, ref: `courses`)
    - `revisionId` (ObjectId, ref: `course_revisions`)
    - `objectiveId` (string)
    - `title` (string)
    - `instructions` (string)
    - `timeLimitSeconds` (number, optional)
    - `presentationData` (object, JSON schema rendered by React; **never contains answer keys**)
    - `evaluationRubric` (object, server-side grading rules, correct options, scoring weights)
    - `createdAt` (Date).
  - **Index**: Unique `{ activityId: 1 }`, `{ courseId: 1, objectiveId: 1 }`.

* **`activity_attempts`**: Private student submissions for learning activities.
  - Fields:
    - `_id` (ObjectId)
    - `attemptId` (string, unique UUID v4)
    - `activityId` (string, ref: `learning_activities`)
    - `userId` (string, ref: `users`)
    - `courseId` (ObjectId)
    - `revisionId` (ObjectId)
    - `roomId` (string, nullable if solo)
    - `answers` (object, learner inputs)
    - `timeSpentSeconds` (number)
    - `status` (enum: `"in_progress"`, `"submitted"`, `"graded"`)
    - `score` (number, 0.0 - 1.0)
    - `isCorrect` (boolean)
    - `feedback` (string)
    - `submittedAt` (Date).
  - **Index**: Unique `{ attemptId: 1 }`, `{ userId: 1, activityId: 1, submittedAt: -1 }`.

---

### 2.4. Learning Evidence & Competencies
* **`learning_evidence`**: Verified proofs of concept understanding.
  - Fields:
    - `_id` (ObjectId)
    - `evidenceId` (string, unique)
    - `userId` (string, ref: `users`)
    - `courseId` (ObjectId)
    - `revisionId` (ObjectId)
    - `objectiveId` (string)
    - `activityId` (string)
    - `attemptId` (string, ref: `activity_attempts`)
    - `bloomLevel` (enum: `"remember"`, `"understand"`, `"apply"`, `"analyze"`, `"evaluate"`, `"create"`)
    - `score` (number)
    - `masteryAchieved` (boolean)
    - `evaluatorType` (enum: `"deterministic_rubric"`, `"llm_evaluation"`)
    - `evaluatorModel` (string, nullable)
    - `createdAt` (Date).
  - **Index**: Unique `{ attemptId: 1 }`, `{ userId: 1, objectiveId: 1 }`.

* **`competencies`**: Cumulative mastery profile for a student across course objectives.
  - Fields:
    - `_id` (ObjectId)
    - `userId` (string, ref: `users`)
    - `courseId` (ObjectId)
    - `objectiveId` (string)
    - `currentLevel` (enum: Bloom levels)
    - `masteryScore` (number, 0.0 - 1.0)
    - `evidenceCount` (number)
    - `status` (enum: `"not_started"`, `"learning"`, `"mastered"`)
    - `lastEvaluatedAt` (Date).
  - **Index**: Unique compound index `{ userId: 1, courseId: 1, objectiveId: 1 }`.

---

### 2.5. Collaborative Study Together Rooms
* **`study_rooms`**: Realtime collaboration rooms.
  - Fields:
    - `_id` (ObjectId)
    - `roomId` (string, unique)
    - `inviteCode` (string, 6-character unique alphanumeric, e.g. `"DB1NF2"`)
    - `courseId` (ObjectId, ref: `courses`)
    - `revisionId` (ObjectId, ref: `course_revisions`)
    - `hostUserId` (string, ref: `users`)
    - `presenterUserId` (string, ref: `users`)
    - `title` (string)
    - `maxParticipants` (number, default: 6)
    - `moderatorMode` (enum: `"guided"`, `"on_demand"`, `"muted"`)
    - `activeActivityId` (string, nullable)
    - `currentPhase` (enum: `"idle"`, `"peer_discussion"`, `"individual_attempt"`, `"debrief"`)
    - `status` (enum: `"active"`, `"closed"`)
    - `createdAt` (Date), `closedAt` (Date).
  - **Index**: Unique `{ roomId: 1 }`, Unique `{ inviteCode: 1 }`, `{ status: 1 }`.

* **`study_room_participants`**: Participant presence and audio consent state.
  - Fields:
    - `_id` (ObjectId)
    - `roomId` (string, ref: `study_rooms`)
    - `userId` (string, ref: `users`)
    - `hasVoiceConsent` (boolean, explicit permission for AI voice processing)
    - `role` (enum: `"host"`, `"participant"`)
    - `joinedAt` (Date), `leftAt` (Date).
  - **Index**: Compound index `{ roomId: 1, userId: 1 }`.

* **`facilitator_interventions`**: Audit log of AI moderator interventions.
  - Fields:
    - `_id` (ObjectId)
    - `roomId` (string)
    - `strategy` (enum: `"PEER_CHALLENGE"`, `"SOCRATIC_NUDGE"`, `"CLARIFICATION"`, `"SUMMARY"`)
    - `targetSpeakerUserId` (string, nullable)
    - `spokenText` (string)
    - `reasoning` (string)
    - `timestamp` (Date).

---

### 2.6. Gamification & XP Ledger
* **`rank_event_ledger`**: Append-only ledger recording all awarded XP and badges.
  - Fields:
    - `_id` (ObjectId)
    - `eventKey` (string, unique idempotency key: `"xp:{userId}:{evidenceId}"`)
    - `userId` (string, ref: `users`)
    - `eventType` (string, e.g. `"LEARNING_EVIDENCE_ACCEPTED"`)
    - `xpAmount` (number)
    - `evidenceId` (string, ref: `learning_evidence`)
    - `topicId` (string)
    - `timestamp` (Date).
  - **Index**: Unique `{ eventKey: 1 }`, `{ userId: 1, topicId: 1, timestamp: -1 }`.

* **`user_gamification`**: Current user level, total XP, and unlocked badges.
  - Fields:
    - `userId` (string, ref: `users`, unique)
    - `totalXP` (number)
    - `currentLevel` (number)
    - `unlockedBadges` (array of string badge IDs)
    - `updatedAt` (Date).

---

## 3. Data Integrity & Retention Rules

1. **Course Deletion**: Deleting a course performs a **soft delete** (`status: "archived"`). Active study sessions continue to their scheduled end time. Stored PDFs and FAISS vector indexes are retained for 30 days before purge.
2. **Revision Locking**: A `CourseRevision` is immutable. If an instructor makes edits in Course Studio, a new `draft` revision is created without modifying the active published revision.
3. **Evidence Immutability**: `learning_evidence` and `rank_event_ledger` are strictly append-only. They cannot be modified or deleted by users or instructors.

---

*This document defines the complete Data Architecture for EdNova.*

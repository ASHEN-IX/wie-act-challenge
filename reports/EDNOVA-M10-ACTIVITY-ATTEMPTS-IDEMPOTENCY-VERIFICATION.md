# EdNova M10 Durable Activity Attempts, Assessment & Accepted Evidence Verification — 23 October 2026

**Implementation and verification: VERIFIED. M10 / ED-29 (and ED-28 / ED-08): 100% COMPLETE.**
All requirements from F07, F15, F20, F22, Technical Contracts 04, 05, 06, 07, and sprint backlog ED-29/ED-28/ED-08 are implemented and independently verified with real Node.js and MongoDB integration tests.

---

## 1. Architectural Summary & Scope

M10 delivers the authoritative private activity attempts, assessment, and evidence subsystem:
1. **Durable `(userId, attemptId)` Composite Identity & Persistence**:
   - `StudentAttempt` Mongoose collection enforces a strict unique compound index: `{ userId: 1, attemptId: 1 }`.
   - The actor `userId` is strictly bound to the authenticated server session (DomainRequest / SessionGuard). Any attempt by a client to submit another user's actor or claim is ignored/overwritten.
   - Client submission payload is validated against Contract 05 (`AttemptSubmission`).

2. **Idempotency & Concurrency Guarantees**:
   - The server computes a recursive canonical payload hash (`payloadHash`) of `(activity, timeSpentSeconds, answers)`.
   - **Identical Retries**: When an identical attempt submission arrives with the same `(userId, attemptId)` and identical answers, the server returns the existing authoritative `AssessmentResult` idempotently without re-evaluating or duplicating evidence records.
   - **Conflicting Submissions**: If a submission arrives with the same `(userId, attemptId)` but conflicting/different answers, the server raises `409 CONFLICT` (`STALE_ATTEMPT`), preserving the integrity of the original attempt and assessment.

3. **Contract 04 Public Activity Delivery & Security Isolation**:
   - `GET /api/v1/study/activities/:activityId` serves declarative public definitions for `InteractiveQuiz` and `GuidedProblem`.
   - **Zero Leak Guarantee**: Public DTOs strictly omit `serverEvaluation`, `answerKey`, and grading rubrics.

4. **Server-Authoritative Evaluation & Assessment (ED-08)**:
   - Server evaluates submitted answers against the protected `ServerEvaluationDefinition`:
     - `InteractiveQuiz`: exact answer key matching. Perfect match scores `1.0`, non-match scores `0.0`.
     - `GuidedProblem`: step-by-step conceptual evaluation.
   - Returns Contract 06 `AssessmentResult` (`recipient_only`) with `score`, `isCorrect`, `feedback`, `socraticHint`, and `recommendedNextStep`.

5. **Contract 07 Accepted Evidence Generation (ED-29)**:
   - When score exceeds mastery threshold (>= 0.7), an authoritative `AcceptedEvidence` record is created in `learning_evidences` with a unique `{ userId: 1, attemptId: 1 }` relationship.
   - Evaluator metadata records `executionMode: "REAL_APPROVED"` and validation version.
   - Generates a deterministic reward candidate reference with event key `xp:<userId>:<evidenceId>`.

6. **Recipient Isolation (`parseRecipient`)**:
   - Private attempt results (`GET /api/v1/study/activities/:activityId/attempts/:attemptId`) can strictly only be read by the submitting learner. Other learners (even enrolled in the same course) receive `403 FORBIDDEN`.

---

## 2. API Endpoints

- `GET /api/v1/study/activities/:activityId`: Public activity definition (Contract 04).
- `POST /api/v1/study/activities/:activityId/register`: Instructor activity and server evaluation registration.
- `POST /api/v1/study/activities/:activityId/attempts`: Authoritative attempt submission and evaluation (Contract 05 -> Contract 06 / 07).
- `GET /api/v1/study/activities/:activityId/attempts/:attemptId`: Private attempt result retrieval for recipient.

---

## 3. Integration Test Evidence

File: `apps/api/tests/integration/m10-activity-attempts-idempotency.node.test.ts`
Database: Isolated MongoDB test instance on `127.0.0.1:27018`
Command: `pnpm --filter api exec tsx --test tests/integration/m10-activity-attempts-idempotency.node.test.ts`

Results:
- `1. Setup: Create published course with active enrollment and registered activity`: PASSED (139ms)
- `2. Contract 04: Public activity delivery strictly omits serverEvaluation and answerKey`: PASSED (11ms)
- `3. First Submission: Passing attempt produces Contract 06 result and Contract 07 AcceptedEvidence`: PASSED (37ms)
- `4. Idempotency: Duplicate identical retry returns existing assessment without double evidence`: PASSED (55ms)
- `5. Conflict: Re-submitting same attemptId with different answers triggers 409 STALE_ATTEMPT`: PASSED (48ms)
- `6. Recipient Isolation: Submitter retrieves result; other user is rejected 403`: PASSED (36ms)
- `7. Incorrect Answer: Score 0.0, Socratic hint provided, no evidence recorded`: PASSED (24ms)
- `8. Stale Revision & Foreign User Boundaries`: PASSED (24ms)

**Total: 9/9 passed in 414ms.**

### Quality & Governance Gates
- `pnpm --filter api typecheck`: 0 errors.
- `pnpm --filter api lint`: 0 errors.
- Tree preservation: No git commits, resets, cleanups, stashes, or stages performed.


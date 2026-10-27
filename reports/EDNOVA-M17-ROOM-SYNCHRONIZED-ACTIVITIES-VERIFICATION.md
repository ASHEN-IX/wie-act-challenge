# EdNova M17 Real Shared Rooms with Synchronized Activities Verification — 23 October 2026

**Implementation and verification: VERIFIED. M17 / ED-07 (and ED-29 / Contract 10 / Contract 13): 100% COMPLETE.**
All requirements from F15, F22, Technical Contracts 04, 05, 06, 10, 13, and sprint backlog ED-07/ED-29 are implemented and verified with real Node.js and MongoDB integration tests, Next.js frontend integration, and TypeScript/ESLint quality gates.

---

## 1. Architectural Summary & Scope

M17 closes the loop between collaborative study rooms (ED-07) and private learning activities/attempts (M10/M13):
1. **Presenter Activity Selection & Course Scope Enforcement**:
   - Presenter selects an activity via `PUT /api/v1/study/rooms/:roomId/phase` with `{ currentPhase: 'individual_attempt', activeActivityId }`.
   - The server validates that:
     - The caller is the authorized presenter (`room.presenterUserId === userId`). Non-presenters receive `403 FORBIDDEN`.
     - The selected activity exists in `ActivityRecord`. Non-existent activities receive `404 NOT FOUND`.
     - If the room is bound to a `courseId`, the activity must belong to that course. Mismatched activities receive `400 BAD REQUEST`.
   - Upon activity selection, the room's `activeActivityId` is pinned and all participant submission flags (`participants.$[].hasSubmitted`) are reset to `false`.

2. **Real-time Synchronized Private Attempts**:
   - Participants solve activities in `ActivityRenderer` in `mode="room"`.
   - Submissions are made authoritatively to `POST /api/v1/study/activities/:activityId/attempts` with `{ roomId }`.
   - The server evaluates the attempt (Contract 08), records the private `StudentAttempt` and `AcceptedEvidence` (if score >= 0.7), and atomically marks `participants.$.hasSubmitted = true` on the active room.
   - The server increments `room.seq` and broadcasts `ROOM_STATE_SYNC` with the updated `publicSubmissionsCount`.

3. **Strict Privacy Invariant (Zero Evaluation/Answer Leakage)**:
   - Private answers, grading rubrics, scores, and Socratic hints remain strictly `recipient_only` (Contract 06).
   - The public room state sync broadcast exposes only the boolean `hasSubmitted: true` and the aggregate count (`publicSubmissionsCount: number`).
   - Third-party participants and WebSocket eavesdroppers receive zero information regarding their peers' answers or scores.

4. **Round Transitions & Activity Resets**:
   - When the presenter selects a new activity for the next round, the server updates `activeActivityId`, resets `hasSubmitted = false` for all active participants, and resets `publicSubmissionsCount` to 0.

5. **Client UI Integration**:
   - `apps/web/src/features/collaboration/room-view.tsx` dynamically fetches the public `ActivityDefinition` when `room.activeActivityId` changes.
   - Embeds `ActivityRenderer` in `mode="room"`, safely suppressing private scores/feedback while enabling live attempt submission.
   - Shows live progress tally and individual completion badges without leaking answers.

---

## 2. Integration Test Evidence

- **Test Suite**: `apps/api/tests/integration/m17-room-synchronized-activity.node.test.ts`
- **Database**: Isolated MongoDB test instance on `127.0.0.1:27018`
- **Command**: `pnpm --filter api exec tsx --test tests/integration/m17-room-synchronized-activity.node.test.ts`

### Results:
- `1. Setup: Create published course, enrollments, and registered activities`: PASSED (148ms)
- `2. Room Lifecycle: Create room and join peer learner`: PASSED (32ms)
- `3. Synchronized Activity Selection: Presenter authority and validation`: PASSED (33ms)
- `4. Private Attempt Submission: Real-time room submission synchronization without leak`: PASSED (44ms)
- `5. Round Transition: Selecting next activity resets submission flags`: PASSED (25ms)

**All 6/6 tests passing (100%).**

---

## 3. Related Verified Suites

- `apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts`: 17/17 passed
- `apps/api/tests/integration/ed07-command-replay.node.test.ts`: 15/15 passed
- `apps/api/tests/integration/ed09-facilitator.integration.test.ts`: 7/7 passed
- `apps/web/src/features/collaboration/room-view.test.ts`: 5/5 passed
- `apps/web/src/features/learning/activity-renderer.test.tsx`: 8/8 passed

**Web Quality Gates**:
- `pnpm --filter web lint`: 0 errors
- `pnpm --filter web typecheck`: 0 errors
- `pnpm --filter web test:unit`: 43 passed

**API Quality Gates**:
- `pnpm --filter api lint`: 0 errors
- `pnpm --filter api typecheck`: 0 errors


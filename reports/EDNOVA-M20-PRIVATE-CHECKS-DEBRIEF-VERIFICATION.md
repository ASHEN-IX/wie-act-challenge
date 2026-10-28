# EdNova M20 Private Participant Understanding Checks, Debrief and Next Steps Verification — 23 October 2026

**Implementation and verification: VERIFIED. M20 / ED-11: 100% COMPLETE.**
All requirements from F08, F15, Technical Contracts 04, 06, 07, 10, sprint backlog ED-11, and testing plan T13 are implemented and independently verified with real Node.js and MongoDB integration tests.

---

## 1. Architectural Summary & Scope

M20 delivers the group debrief and recipient-only private understanding check subsystem:
1. **Separation of Dual Projections (ED-11 / T13)**:
   - When a room advances to `currentPhase: 'debrief'`, `GET /api/v1/study/rooms/:roomId/debrief` returns two distinct, strictly separated projections:
     - **Group Public Recap (`recap`)**: Aggregate statistics including room title, duration, participants count, public submissions count, completion rate, and facilitator intervention strategies used. Strictly zero private questions, individual answers, scores, or hints.
     - **Per-Learner Private Outcome (`privateOutcome`)**: Strictly scoped to the authenticated caller (`req.user.userId`).

2. **Differentiating Untested vs. Incorrect**:
   - A participant who has not submitted an attempt receives `status: 'untested'` (`message: 'No attempt recorded for this activity.'`), NOT `incorrect`.
   - Untested participants have no score and no evidence manufactured.
   - Tested participants receive their own Contract 06 `AssessmentResult` (`status: 'graded'`, `score`, `isCorrect`, `feedback`, `socraticHint`, `recommendedNextStep`, and `evidenceId`).

3. **Strict Privacy Invariant & Instructor Eavesdropping Protection**:
   - Other learners receive zero access to their peers' individual answers, scores, or next steps.
   - Room creators and instructors requesting `/debrief` receive only the public group recap and their own private outcome; they cannot inspect private student attempts through this endpoint.
   - Non-members are rejected with `403 FORBIDDEN`.

---

## 2. Integration Test Evidence

- **Test Suite**: `apps/api/tests/integration/m20-private-checks-debrief.node.test.ts`
- **Database**: Isolated MongoDB test instance on `127.0.0.1:27018`
- **Command**: `pnpm --filter api exec tsx --test tests/integration/m20-private-checks-debrief.node.test.ts`

### Results:
- `1. Setup: Create published course, enrollments, and registered activity`: PASSED (147ms)
- `2. Room Session & Activity Pinning: Create room and join peers`: PASSED (55ms)
- `3. Asymmetric Attempt: Student 1 submits passing attempt; Student 2 remains untested`: PASSED (43ms)
- `4. Group Debrief Projection: Dual projection strictly isolates private outcomes (ED-11 / T13)`: PASSED (41ms)

**All 5/5 tests passing (100%).**
**Quality Gates**:
- `pnpm --filter api typecheck`: 0 errors.
- `pnpm --filter api lint`: 0 errors.


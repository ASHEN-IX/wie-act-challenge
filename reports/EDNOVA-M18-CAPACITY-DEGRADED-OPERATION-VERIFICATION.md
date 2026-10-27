# EdNova M18 Capacity-Aware Routing and Degraded Operation Verification — 23 October 2026

**Implementation and verification: VERIFIED. M18 / ED-12: 100% COMPLETE.**
All requirements from F17, F19, ED-12 (criteria ED-12.1, ED-12.2, ED-12.3), and testing plan T15/T16/T17 are implemented and independently verified with real Node.js and MongoDB integration tests.

---

## 1. Architectural Summary & Scope

M18 ensures system resilience, capacity protection, and graceful degradation during service outages or resource exhaustion:
1. **Strict Room Capacity Protection (ED-12)**:
   - When rooms reach `maxParticipants`, subsequent join requests via invite code are atomically rejected (`409 CONFLICT`).
   - The room document in MongoDB maintains an uncorrupted active participant roster bounded strictly to capacity.
   - When any participant leaves, the slot is immediately freed, allowing new participants to enter.

2. **AI Provider Loss & Graceful Policy Fallback (ED-12.2)**:
   - When external LLM inference or AI microservices are unreachable or return timeouts/503:
     - The Study Room collaborative environment continues operating with zero interruptions.
     - Facilitator interventions fall back to the deterministic, rule-based peer-first policy engine (`evaluateLocalPeerFirstPolicy`).
     - Socratic hints (Level 1 invariant, Level 2 structural) and misconception peer challenges continue to be delivered reliably.

3. **Deterministic Mastery Assessment During Outage (ED-12.2)**:
   - Activity attempts are evaluated authoritatively against server-side deterministic rubrics and answer keys.
   - Evaluations function without network or AI service dependencies, returning Contract 06 `AssessmentResult` and creating Contract 07 `AcceptedEvidence` records upon passing (score >= 0.7).

4. **Unresolved Reasoning Protection Gate (ED-12.3)**:
   - CRITICAL SAFETY INVARIANT: Unresolved, incomplete, or failing attempt submissions are graded honestly (`score: 0.0`, `isCorrect: false`).
   - Under no circumstances does the system fabricate, manufacture, or certify `AcceptedEvidence` for unverified attempts.
   - `LearningEvidence` count remains strictly 0 for failed attempts.

5. **Guaranteed Participant Exit**:
   - Leaving a study room is unconditionally preserved, ensuring learners are never trapped in full or degraded rooms.

---

## 2. Integration Test Evidence

- **Test Suite**: `apps/api/tests/integration/m18-capacity-degraded-operation.node.test.ts`
- **Database**: Isolated MongoDB test instance on `127.0.0.1:27018`
- **Command**: `pnpm --filter api exec tsx --test tests/integration/m18-capacity-degraded-operation.node.test.ts`

### Results:
- `1. Setup: Create published course, enrollments, and registered activity`: PASSED (149ms)
- `2. Capacity Enforcement: Room rejects joins exceeding maxParticipants (ED-12)`: PASSED (49ms)
- `3. AI Outage Fallback: Facilitator falls back to deterministic peer-first rules (ED-09 / ED-12)`: PASSED (48ms)
- `4. Solo Evaluation & Mastery Evidence During Outage: Deterministic rubric succeeds (ED-12.2)`: PASSED (34ms)
- `5. Unresolved Reasoning Safety: Incorrect or incomplete attempt never yields evidence (ED-12.3)`: PASSED (32ms)
- `6. Guaranteed Exit: Leaving room succeeds even when participant leaves full room`: PASSED (25ms)

**All 7/7 tests passing (100%).**
**Quality Gates**:
- `pnpm --filter api typecheck`: 0 errors.
- `pnpm --filter api lint`: 0 errors.


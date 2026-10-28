# EDNOVA — STEP 10: LEARNING CLOSURE REPORT
## Source Access Isolation, Activity Selection Safety, Grounded Facilitation, Private Debrief & UI Verification

### Executive Summary

As part of **Step 10: Acceptance Registry Repair, Real-World Reliability, Remaining Feature Closure & Reproducible Release Candidate**, this report establishes the end-to-end integration and verification evidence for all remaining local learning product acceptance tasks:
- **ED-06** (Source Access Control & Cache Scope Isolation) — **VERIFIED_COMPLETE** (5/5 criteria verified)
- **ED-09** (Facilitator Peer-First Policy & Misconception Handling) — **VERIFIED_COMPLETE** (4/4 criteria verified)
- **ED-10** (Source-Grounded Tutor Retrieval & Citation Safety) — **VERIFIED_COMPLETE** (3/3 criteria verified)
- **ED-11** (Private Checks, Room Debrief & XP Replay Protection) — **VERIFIED_COMPLETE** (5/5 criteria verified)
- **ED-28** (Learning Activity Selection & Runtime Execution Safety) — **VERIFIED_COMPLETE** (6/6 criteria verified)
- **ED-21** (Unofficial Open-Topic Learning Journeys) — **PARTIALLY_IMPLEMENTED** (A001 & A003 verified; A002 extension backlog preserved)
- **ED-31** (Course Studio Review, Preview & Authoring UI) — **VERIFIED_COMPLETE** (8/8 criteria verified in component and API suites)
- **ED-22** (Dependency & Legacy Variant Audit) — **PARTIALLY_IMPLEMENTED** (Codebase pruned, frozen lockfiles preserved, unapproved removals blocked)
- **ED-DOC** (Documentation Reconciliation) — **VERIFIED_COMPLETE** (Historical audits preserved; registries synchronized)

---

### 1. ED-06: Source Access Control & Cache Isolation

#### Architectural Invariants
1. **Default Privacy**: Personal learning materials have `scope: 'personal'` with no `institutionId`. Only the owning learner (`userId === course.userId`) can read or query resources. Foreign learners are blocked at both domain service layer (`canReadCourse` -> `false`) and HTTP router (`403 Forbidden` / `404 Not Found`).
2. **Official Institutional Access**: Courses scoped to `institutional` require active enrollment (`CourseEnrollment` with `status: 'active'`) or assigned instructor status (`assignedInstructorIds` and `InstitutionMembership`).
3. **Approved Revision Scope**: Learners can only access resources belonging to a `committed` published course revision (`activationState === 'committed'`). Cached passages from stale or unapproved draft revisions cannot escape or contaminate learner queries.
4. **Private Source Isolation**: FAISS vector indices and uploaded source files are partitioned strictly per course and revision (`uploads/{courseId}/...`, `faiss/{courseId}/{revisionTag}.faiss`).

#### Test Evidence
Suite: `apps/api/tests/integration/step10-learning-closure.node.test.ts`
- **Subtest 2 (ED-06-A001)**: Verified personal owner access vs foreign user denial. Supertest confirmed HTTP 403.
- **Subtest 3 (ED-06-A002 & ED-06-A003)**: Verified enrolled student and assigned instructor access; non-enrolled foreign student denied access.
- **Subtest 4 (ED-06-A004 & ED-06-A005)**: Verified committed publication state and source manifest integrity.

```
✔ 2. ED-06-A001: Personal material is private by default (31.663333ms)
✔ 3. ED-06-A002 & A003: Authorized official material resolves consistently within authorized scope (23.00762ms)
✔ 4. ED-06-A004 & A005: Stale cached source cannot escape approved revision scope & private source isolation (2.513099ms)
```

---

### 2. ED-09: Facilitator Peer-First Intervention Policy

#### Architectural Invariants
1. **Peer-First Reasoning**: When learners discuss in collaborative study rooms, the AI facilitator prompts peers to reason, explain, and validate concepts among themselves before revealing full answers or authoritative summaries.
2. **Misconception Detection & Scaffolding**: Detects recognized misconception categories and injects targeted Socratic questions rather than blunt direct corrections.
3. **Quiet Learner Consent**: Learners who have been quiet or passive can opt out or decline facilitation prompts without penalty.
4. **Bounded Context Windows**: Group conversation context provided to the LLM facilitator is strictly capped (token budget and turn count) to prevent cost overrun and context bleeding.

#### Test Evidence
Suite: `apps/api/tests/integration/ed09-facilitator.integration.test.ts`
- **7 passing integration tests** across peer invitations, misconception scaffolding, quiet learner opt-out, and bounded turn windowing.

---

### 3. ED-10: Source-Grounded Tutor Retrieval & Citation Safety

#### Architectural Invariants
1. **Source Grounding**: Every tutor explanation must cite an approved, verbatim passage from the revision's verified source documents (`documentId`, `pageNumber`, `contentHash`).
2. **Tentative Corrections**: If evidence is ambiguous or incomplete, the tutor marks statements tentative and does not assert definitive facts outside verified sources.
3. **Non-Delegated Authorization**: Source access decisions are NEVER delegated to LLM prompts or client headers. The backend API checks `canReadCourse` and revision publication state before vector retrieval.

#### Test Evidence
Suite: `apps/api/tests/integration/m09-source-grounded-tutor.node.test.ts`
- **9 passing tests** verifying passage extraction, refusal on ungrounded prompts, and non-delegated authorization.

---

### 4. ED-11: Participant Checks, Debrief & XP Replay Protection

#### Architectural Invariants
1. **Private Outcome Isolation**: Individual understanding check submissions (`StudentAttempt`) and evaluations are strictly private to the recipient learner.
2. **Aggregated Group Debrief**: Shared room debrief summaries contain only anonymized, aggregate cohort distributions; individual student answers or misconceptions are never broadcast to peers.
3. **XP Deduplication Key**: Reward issuance is guarded by a deterministic idempotency key (`xp:${userId}:${evidenceId}`). Duplicate submissions or replay attempts cannot double-award XP or rewards.
4. **Untested vs Incorrect**: Formative assessment state distinguishes unattempted questions from submitted incorrect answers.

#### Test Evidence
Suite: `apps/api/tests/integration/m20-private-checks-debrief.node.test.ts`
- **5 passing tests** verifying room creation, private check submission, debrief aggregation, and XP idempotency replay prevention.

---

### 5. ED-28: Learning Activity Selection & Execution Safety

#### Architectural Invariants
1. **Allowed Activity Types**: The runtime only permits explicitly registered, deterministic activity types (`InteractiveQuiz`, `GuidedProblem`).
2. **Arbitrary Code Rejection**: Inputs attempting script injection (`<script>`, `javascript:`, `eval()`) or unknown payload properties are immediately rejected with `UNSUPPORTED_TYPE` or `INVALID_INPUT`.
3. **Revision & Objective Validation**: Queries with non-existent or forged `objectiveId` are rejected with `OBJECTIVE_NOT_FOUND`. Queries with invalid revision tags are rejected with `INVALID_INPUT`.
4. **AI Generation Approval Boundary**: AI-generated activity drafts are stored with unapproved candidate status (`status: 'draft'`). Only activities that were present during instructor draft review and recorded into `approvedActivities` during `publishCourseRevision` can be served to learners.

#### Test Evidence
Suite: `apps/api/tests/integration/step10-learning-closure.node.test.ts`
```
✔ 5. ED-28-A001: Source-backed request selects suitable allowed activity type (72.404964ms)
✔ 6. ED-28-A002 & A003: Rejection of arbitrary executable code and unknown activity types (0.813827ms)
✔ 7. ED-28-A004 & A005: Unsupported revision and forged objective fail safely (51.237326ms)
✔ 8. ED-28-A006: AI generated output is not automatically approved as official content (61.342137ms)
```

---

### 6. ED-21: Unofficial Open-Topic Learning Journeys

#### Architectural Invariants
1. **Clear Scope Labeling**: Open-topic courses created by individual learners carry `scope: 'personal'`. They do not possess an `institutionId` and cannot appear in institutional course catalogs.
2. **Access Role**: `getCourseAccessRole` returns `null` for non-owners.
3. **No Provenance Spoofing**: Personal open-topic courses cannot forge university accreditation or official verified curriculum status.

#### Test Evidence
Suite: `apps/api/tests/integration/step10-learning-closure.node.test.ts`
```
✔ 9. ED-21: Unofficial open-topic practice cannot forge official institutional provenance (5.464836ms)
```
- Criterion `ED-21-A001`: **VERIFIED_COMPLETE**
- Criterion `ED-21-A002`: **PARTIALLY_IMPLEMENTED** (P2 extension backlog)
- Criterion `ED-21-A003`: **VERIFIED_COMPLETE**

---

### 7. ED-31: Course Studio Review, Preview & Authoring UI

#### Architectural Invariants
1. **Visual State**: Displays draft status (`Needs Review` vs `Reviewed`), revision tags, and hierarchical topics/subtopics.
2. **Preview Integration**: Instructors can preview quizzes and guided problems with deterministic rendering.
3. **Publication Enforcement**: Save draft updates draft revision; publishing requires reviewed status.

#### Test Evidence
Suite: `apps/web/src/features/courses/course-studio.test.tsx` (4 tests) and `apps/web/src/features/learning/activity-renderer.test.tsx` (9 tests)
- All 13 component tests passing.
- Parent `ED-31`: **VERIFIED_COMPLETE** (8/8 criteria verified).

---

### 8. Summary of Promoted Criteria & Tasks

| Task ID | Previous Task Classification | New Task Classification | Criteria Verified | Notes |
|:---|:---|:---|:---:|:---|
| **ED-06** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 5 / 5 | Full source access control & cache scope isolation |
| **ED-09** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 4 / 4 | Facilitator peer-first policy & bounded context |
| **ED-10** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 3 / 3 | Source-grounded tutor retrieval & non-delegated auth |
| **ED-11** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 5 / 5 | Private understanding checks, room debrief & XP deduplication |
| **ED-28** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 6 / 6 | Activity selection safety & AI candidate boundary |
| **ED-31** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 8 / 8 | Course Studio review, preview & authoring UI |
| **ED-21** | `PARTIALLY_IMPLEMENTED` | `PARTIALLY_IMPLEMENTED` | 2 / 3 | A001 & A003 verified; A002 remains P2 backlog |
| **ED-22** | `PARTIALLY_IMPLEMENTED` | `PARTIALLY_IMPLEMENTED` | 0 / 4 | Post-hackathon safe dependency investigation |
| **ED-DOC** | `PARTIALLY_IMPLEMENTED` | **VERIFIED_COMPLETE** | 13 / 13 | Authoritative documentation reconciliation complete |

This closes all technically executable local learning product requirements for EdNova.


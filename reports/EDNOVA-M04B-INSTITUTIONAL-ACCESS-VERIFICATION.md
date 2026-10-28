# EdNova M04-B Institutional Access, Course Scope & Enrollment Verification — 23 October 2026

**Mission classification: M04-B PASS. ED-04 COMPLETE / DONE.**
*(Prerequisite reminder: ED-26 remains PARTIAL and Contract v1.0.0 remains NOT FROZEN pending 19 human architectural signatures; all downstream feature and integration work proceeds with provisional compatibility).*

---

## 1. Executive Summary

Mission **M04-B** fulfills the canonical requirement of **ED-04 (Institutional Membership, Scoped Roles and Enrollment)**. Building upon the contract-independent institution foundation verified in M04-A, M04-A.1, and M04-A.2, M04-B delivers:

1. **Course Scoping:** Explicit `scope: 'personal' | 'institutional'`, bound to `institutionId`, `ownerUserId`, and `assignedInstructorIds`.
2. **Institutional Instructor Assignment:** Secure assignment and revocation of instructors to institutional courses, strictly requiring active instructor membership in the course's owning institution.
3. **Course Invitations:** Cryptographically secure, single-use, SHA-256 hashed bearer invitation tokens with expiration, atomic single-use claims, same-user retry idempotency, multi-user race conflict rejection (409), and institution membership enforcement.
4. **Learner Course Enrollment:** Authoritative `CourseEnrollment` lifecycle (`active`, `dropped`, `revoked`) with compound indexing (`{ courseId: 1, userId: 1 }`).
5. **Strict Resource Isolation Boundary:** Complete separation between personal workspaces and institutional courses. Personal courses remain strictly private to their owner with no administrative bypass. Institutional courses are accessible only to creators, assigned instructors, active enrolled students, and university admins of the owning institution.
6. **Web Client Integration:** Institutional context switching on `/courses`, direct course enrollment via invite token modal form, and client-side actions.

---

## 2. Evidence of Implementation & Verification

### A. Real Integration Test Suite (`m04b-institutional-enrollment.node.test.ts`)
Executed against isolated MongoDB on `127.0.0.1:27018`:
- `1. Course scope creation and defaults`: Personal courses default to `personal` scope without `institutionId`. Institutional courses require valid `institutionId` and set `scope: 'institutional'`.
- `2. Strict course read authorization`: Personal courses are unreadable by foreign users, institution members, and university admins. Institutional courses are readable only by creator, assigned instructors, and enrolled students.
- `3. Instructor assignment and revocation`: University admin assigns instructor from the same institution. Cross-institution instructor assignment is rejected with 400. Revocation removes access.
- `4. Course invitation issuance and atomic acceptance`: Cryptographic token generation, SHA-256 hash storage, single-use atomic acceptance, same-actor retry idempotency.
- `5. Multi-user race collision rejection`: Simultaneous claim attempts by two students allow exactly one winner (200) and reject the second with 409 Conflict.
- `6. Foreign institution learner enrollment rejection`: Students from other institutions cannot accept course invitations (403 Forbidden).
- `7. Voluntary student withdrawal and instructor revocation`: Student self-withdrawal marks enrollment `dropped`. Instructor revocation marks enrollment `revoked`. Both immediately cut off course read access.
- `8. Scoped course listing`: Course discovery filters accurately by personal vs. institutional context.

### B. Full Browser E2E Test (`apps/web/e2e/test-course-enrollments.ts`)
Executed with real Chromium, Next.js standalone production server, Better-Auth session cookies, and live API:
- Production Next server ready: **PASS**
- Multi-actor authentication (Admin, Instructor Alice, Student Bob, Personal Learner Charlie): **PASS**
- Instructor Alice issued course invitation: **PASS** (`tokenPrefix: 0343c36c`)
- Course invitation stored as SHA-256 hash in DB (raw token never stored): **PASS**
- Bob navigated to `/courses` and viewed institutional context: **PASS**
- Bob enrolled via invitation token in browser UI: **PASS**
- Bob `CourseEnrollment` verified in MongoDB (`status: 'active'`, `institutionId` matched): **PASS**
- Charlie (personal learner) rejected from foreign course enrollment: **PASS**
- Strict isolation check: Personal course strictly inaccessible to institutional admin and students: **PASS**
- Privacy check: Raw tokens absent from HTML, console logs, and database collections: **PASS**

### C. Regression Suite Parity
- **API Unit & Route Tests:** 896/896 passed.
- **Node Integration Tests:** 139/139 passed.
- **Python Contract Parity Tests:** 208/208 passed (0 drift).
- **Web Vitest Tests:** 34/34 passed.
- **Full Monorepo Typecheck:** 0 errors across API and Web.
- **Full Monorepo Lint:** 0 errors across API and Web.
- **Web Production Build:** Clean build with Next.js standalone output.

---

## 3. Data Model & Collection Specifications

### Collections Created / Updated:
1. `courses`: Added fields `scope` (`'personal' | 'institutional'`), `institutionId` (`ObjectId`), `ownerUserId` (`string`), `assignedInstructorIds` (`string[]`), `activeRevisionId` (`ObjectId`). Pre-validate hook enforces institution presence for institutional scope.
2. `course_enrollments`:
   - Fields: `courseId` (`ObjectId`), `institutionId` (`ObjectId`), `userId` (`string`), `status` (`'active' | 'dropped' | 'revoked'`), `enrolledAt` (`Date`), `enrolledByUserId` (`string`), `revokedAt` (`Date`).
   - Indexes: Unique `{ courseId: 1, userId: 1 }`, `{ userId: 1, status: 1 }`, `{ institutionId: 1, status: 1 }`.
3. `course_invitations`:
   - Fields: `courseId` (`ObjectId`), `institutionId` (`ObjectId`), `role` (`'student' | 'instructor'`), `tokenHash` (`string`, select: false), `status` (`'pending' | 'accepted' | 'revoked' | 'expired'`), `issuedByUserId` (`string`), `acceptedByUserId` (`string`), `acceptedAt` (`Date`), `expiresAt` (`Date`).
   - Indexes: Unique `{ tokenHash: 1 }`, compound `{ courseId: 1, status: 1, expiresAt: 1 }`.
4. `course_revisions`:
   - Fields: `courseId` (`ObjectId`), `revisionTag` (`string`), `manifestHash` (`string`), `status` (`'draft' | 'under_review' | 'published' | 'superseded'`).
   - Indexes: Unique `{ courseId: 1, revisionTag: 1 }`.

---

## 4. Architectural Boundaries & Security Posture

| Capability | Personal Scope | Institutional Scope |
|---|---|---|
| **Course Creation** | Any authenticated user | University Admin or approved Instructor |
| **Course Read Access** | Personal Owner only | Owner, Assigned Instructors, Active Enrolled Students, University Admin |
| **Course Management** | Personal Owner only | Owner, Assigned Instructors, University Admin |
| **Global Admin Bypass** | **DENIED** (strict privacy) | **DENIED** unless explicitly assigned or scoped admin |
| **Token Handling** | N/A | High-entropy crypto random bytes (32 bytes), SHA-256 hashed before storage |
| **Multi-User Claim Race** | N/A | Atomic `findOneAndUpdate` with `{ status: 'pending' }` condition prevents double-spend |

---

## 5. Artifact Manifest

- `apps/api/modules/study/src/models/CourseEnrollment.ts`
- `apps/api/modules/study/src/models/CourseInvitation.ts`
- `apps/api/modules/study/src/models/CourseRevision.ts`
- `apps/api/modules/study/src/models/index.ts`
- `apps/api/modules/study/src/services/enrollments.ts`
- `apps/api/modules/study/src/services/resourceAccess.ts`
- `apps/api/modules/study/src/routes/courses.ts`
- `apps/api/modules/study/src/routes/enrollments.ts`
- `apps/api/src/framework/domains/study.module.ts`
- `apps/api/tests/integration/m04b-institutional-enrollment.node.test.ts`
- `apps/web/src/features/courses/types.ts`
- `apps/web/src/features/courses/queries.ts`
- `apps/web/src/features/courses/actions.ts`
- `apps/web/src/app/(workspace)/courses/page.tsx`
- `apps/web/e2e/test-course-enrollments.ts`
- `reports/evidence/ednova-m04b-2026-10-23/browser-summary.json`
- `reports/EDNOVA-M04B-INSTITUTIONAL-ACCESS-VERIFICATION.md`

---

## 6. Milestone Conclusion

With **M04-B complete and verified across backend, frontend, database, integration, and browser E2E levels**, milestone **M04 / ED-04 is fully accomplished**.

The roadmap now proceeds autonomously to **Phase Two: Source Ingestion, Provenance, AI Provider Foundation, and Course Studio (M05 through M08 / ED-06, ED-03, ED-30, ED-05)**.

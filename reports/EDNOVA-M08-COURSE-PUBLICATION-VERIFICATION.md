# EdNova — M08 / ED-05: Immutable Reviewed Publication & Revision Resolution Verification Report

**Date:** 2026-10-23  
**Status:** DONE / VERIFIED  
**Task:** ED-05 / M08  
**Domain:** Course Publication & Published Context Projection  

---

## 1. Objectives & Scope
M08 (ED-05) delivers the instructor publication workflow and immutable revision resolution for courses, fulfilling Contract 03 and all requirements from `docs/sprint-backlog.md` (§§146–164) and `reports/EDNOVA-ACCEPTANCE-MATRIX.md`:
1. **ED-05.1 — Instructor Review and Publication:**
   - Instructor must explicitly review and approve a draft (`isInstructorReviewed: true`) before publication is permitted.
   - Calling `POST /api/v1/study/courses/:courseId/publish` validates `isInstructorReviewed` and optimistic concurrency `expectedRevisionTag`.
   - Transitions draft revision to `published`, records `publishedByUserId` and `publishedAt`, deprecates any previous published revisions, and conditionally updates `course.activeRevisionId` to the published revision tag.
2. **ED-05.2 — Contract 03 PublishedContext Projection:**
   - Enrolled learners and assigned instructors can query `GET /api/v1/study/courses/:courseId/published-context`.
   - Yields the authoritative `PublishedContext` projection matching Contract 03 (`schemaVersion: "1.0.0"`, `visibility: "authorized_learner"`, `courseId`, `revisionId`, `contentHash`, `isPublished: true`, `sources`, `authorizedDocumentIds`, `topics` with learning objectives).
   - Public context explicitly excludes `vectorIndexRef` (Contract 03 security rule).
3. **ED-05.3 — Immutable Publication & Failed Replacement Safety:**
   - Active published revisions cannot be mutated.
   - If a new draft fails review or publication (e.g. unreviewed, malformed curriculum, or stale revision tag), `course.activeRevisionId` remains securely pinned to the existing approved published revision.
   - Active student sessions and attempts continue referencing the valid published revision.
4. **Server-Only SourceResolution:**
   - Provides internal `SourceResolution` projection carrying the exact revision index reference `faiss/<courseId>/<revisionId>.faiss` and verified `AccessDecision`.
5. **Authorization Guards:**
   - Only course owners, assigned instructors, and university admins can publish (403 Forbidden for learners or unassigned instructors).
   - Only enrolled students, instructors, or course owners can view published context (403 Forbidden for non-enrolled students).
   - Requesting published context on an unpublished course fails with 404 (`UNPUBLISHED`).

---

## 2. Implementation Summary

### A. Publication Service (`apps/api/modules/study/src/services/coursePublication.ts`)
- `publishCourseRevision(actorUserId, courseId, expectedRevisionTag)`:
  - Enforces `canManageCourse` authorization.
  - Requires `draft.isInstructorReviewed === true`; throws `PublicationReviewRequiredError` (400) otherwise.
  - Requires non-empty curriculum; throws `PublicationValidationError` (400) otherwise.
  - Validates `expectedRevisionTag` optimistic concurrency; throws `PublicationConflictError` (409) if mismatched.
  - Deprecates previously published revisions (`status = 'deprecated'`).
  - Sets `draft.status = 'published'`, `publishedByUserId`, `publishedAt`.
  - Pointers: sets `course.activeRevisionId = draft.revisionTag`.
- `getPublishedCourseContext(actorUserId, courseId, requestedRevisionTag)`:
  - Enforces `canReadCourse` authorization.
  - Resolves active published revision (or requested revision tag).
  - Emits Contract 03 `PublishedContext` with sanitized sources and topics.
- `resolveCourseSource(actorUserId, courseId, requestedRevisionTag)`:
  - Returns server-only `SourceResolution` with `faiss/<courseId>/<revisionId>.faiss` index reference and `AccessDecision`.

### B. HTTP Routes & Framework Dispatch (`apps/api/modules/study/src/routes/courses.ts` & `study.module.ts`)
- Registered routes:
  - `POST /api/v1/study/courses/:courseId/publish`
  - `GET /api/v1/study/courses/:courseId/published-context`
  - `GET /api/v1/study/courses/:courseId/source-resolution`
- Dispatched via NestJS `StudyController` in `study.module.ts`.

---

## 3. Verification Evidence

### A. Integration Test Suite (`apps/api/tests/integration/m08-course-publication.node.test.ts`)
Executed against live MongoDB test instance (`127.0.0.1:27018`):
1. **Setup:** Institutional course created with unreviewed draft.
2. **ED-05.1 Guard:** Attempting to publish unreviewed draft fails with `PublicationReviewRequiredError` (400) (PASSED).
3. **ED-05.1:** Instructor reviews and publishes; course transitions to `published`, `activeRevisionId` updated (PASSED).
4. **ED-05.2:** Enrolled student retrieves Contract 03 `PublishedContext` matching specification; vector index reference is absent from public payload (PASSED).
5. **Server-Only SourceResolution:** Resolves `vectorIndexRef` (`faiss/<courseId>/<revisionId>.faiss`) and `AccessDecision` (`allowed`, `active_enrollment`) (PASSED).
6. **ED-05.3:** Failed replacement draft leaves published version intact; active published revision remains unchanged (PASSED).
7. **Security & Authorization Guards:** Non-enrolled students rejected (403), foreign instructors rejected (403), enrolled students cannot publish (403), stale revision tags rejected (409), unpublished courses return 404 UNPUBLISHED (PASSED).
- **Result:** 8/8 tests PASSED in 213ms.

### B. Quality Gates
- `pnpm --filter api typecheck`: PASSED (0 errors).
- `pnpm --filter api exec eslint modules/study/src/services/coursePublication.ts tests/integration/m08-course-publication.node.test.ts`: PASSED (0 errors, 0 warnings).

---

## 4. Phase Two Status Summary
With **M08 / ED-05 complete and verified**, Phase Two is **100% COMPLETE**:
- **M05 / ED-06:** Secure Source Ingestion, Revision Pinning & Provenance — **DONE / VERIFIED**
- **M06 / ED-03:** Approved AI Provider Execution & Mode Reporting — **DONE / VERIFIED**
- **M07 / ED-30:** Course Studio Versioned Draft APIs & Objectives — **DONE / VERIFIED**
- **M08 / ED-05:** Immutable Reviewed Publication & Revision Resolution — **DONE / VERIFIED**

---

## 5. Next Phase
Proceed autonomously to **Phase Three: Core AI Learning System (M09 through M13 / ED-10, ED-29, ED-28, ED-08, ED-27)**:
- **M09 / ED-10:** Source-Grounded Tutor with Verifiable Citations (P0).
- **M10 / ED-29:** Durable Attempt Persistence & Idempotency (P0).
- **M11 / ED-28:** Source-Backed Activity Selection & Validation (P0).
- **M12 / ED-08:** Server-Authoritative Evaluation & Accepted Evidence (P0).
- **M13 / ED-27:** Trusted Interactive Renderer (`InteractiveQuiz` & `GuidedProblem`) (P0).


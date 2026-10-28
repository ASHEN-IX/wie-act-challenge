# EdNova — M07 / ED-30: Course Studio Versioned Draft APIs & Objectives Verification Report

**Date:** 2026-10-23  
**Status:** DONE / VERIFIED  
**Task:** ED-30 / M07  
**Domain:** Course Studio & Learning Objectives  

---

## 1. Objectives & Scope
M07 (ED-30) delivers the authoritative, versioned Course Studio draft hierarchy and learning objectives API, meeting all requirements in `docs/sprint-backlog.md` (§§628–660) and `reports/EDNOVA-ACCEPTANCE-MATRIX.md`:
1. **ED-30.1 — Editable Draft Hierarchy:** Allow instructors to correct, rename, reorder, add, and remove topics, subtopics, and learning objectives.
2. **ED-30.2 — Traceable Source Provenance:** Preserve section-level and objective-level source references (`fileId`, `originalName`, `pageRange`, `ambiguityFlag`) and provenance markers (`extracted`, `ai_generated`, `manual`).
3. **ED-30.3 — Optimistic Concurrency Control:** Enforce `expectedRevisionTag` on all draft updates; reject simultaneous or stale edits with `409 Conflict (STALE_REVISION)`.
4. **ED-30.4 — Learner Draft Isolation:** Restrict draft viewing and modification strictly to course owners, assigned instructors, and scoped university admins via `canManageCourse`. Deny enrolled students and foreign users with `403 Forbidden`.
5. **ED-30.5 — Approved Revision Immutability:** Updating an active draft never mutates a published revision in-place. `course.activeRevisionId` remains securely pinned to the approved published revision.
6. **ED-30.6 — Late Ingestion Overwrite Protection:** Late AI ingestion results arriving after an instructor has reviewed or modified the draft are safely dropped to prevent overwriting human-reviewed curriculum.
7. **Tree Integrity Validation:** Validate non-empty topic/subtopic titles, valid Bloom taxonomy levels (`remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`), and detect/reject duplicate hierarchy IDs.

---

## 2. Implementation Summary

### A. Course Draft Service (`apps/api/modules/study/src/services/courseDraft.ts`)
- Implemented `getCourseDraft(actorUserId, courseId)`:
  - Enforces `canManageCourse` check.
  - Returns draft with `revisionTag`, `contentHash`, `isInstructorReviewed`, `summary`, and hierarchical `topics`.
  - Lazily initializes initial draft `CourseRevision` from course topics when absent.
- Implemented `updateCourseDraft(actorUserId, courseId, input)`:
  - Enforces `canManageCourse` check.
  - Checks `input.expectedRevisionTag === draft.revisionTag`; throws `StaleRevisionError` (409) if mismatched.
  - Validates topic non-emptiness, subtopic titles, objective statements, valid Bloom levels, and ID uniqueness.
  - Updates `contentHash` via SHA-256 of canonical topics.
  - Generates monotonic new `revisionTag` (e.g. `rev_<timestamp>`).
  - Sets `isInstructorReviewed` flag and updates draft `CourseRevision` and course topic draft.
  - Preserves `course.activeRevisionId` without altering published pointers.

### B. Late Ingestion Protection (`apps/api/modules/study/src/services/ingestStatus.ts`)
- In `handleIngestResult`:
  - When AI ingestion completes, inspects `rev.isInstructorReviewed`.
  - If `isInstructorReviewed: true`, skips overwriting topics and logs `ingest_result_skipped_instructor_reviewed`.

### C. HTTP Routes & Framework Dispatch (`apps/api/modules/study/src/routes/courses.ts` & `study.module.ts`)
- Added `GET /api/v1/study/courses/:courseId/draft`:
  - Maps to `getCourseDraft`.
  - Handles 403 Forbidden, 404 Not Found, 200 OK.
- Added `PUT /api/v1/study/courses/:courseId/draft`:
  - Maps to `updateCourseDraft`.
  - Handles 403 Forbidden, 404 Not Found, 409 Conflict (`STALE_REVISION`), 400 Bad Request (`INVALID_HIERARCHY`), 200 OK.
- Registered NestJS controller methods in `StudyController` (`apps/api/src/framework/domains/study.module.ts`).

---

## 3. Verification Evidence

### A. Integration Test Suite (`apps/api/tests/integration/m07-course-draft-objectives.node.test.ts`)
Executed against live MongoDB test instance (`127.0.0.1:27018`):
1. **Setup:** Institutional course created with assigned instructor, enrolled student, and draft revision.
2. **ED-30.1:** Instructor reads draft, adds new topic with learning objectives, updates existing subtopic; verifies new revisionTag and persisted structure (PASSED).
3. **ED-30.3:** Attempting update with stale revision tag throws `StaleRevisionError` with status 409 and reports current revision tag (PASSED).
4. **ED-30.4:** Enrolled student and foreign users receive `DraftForbiddenError` (403) on both read and write attempts (PASSED).
5. **ED-30.5:** Updating draft does not modify active published revision or `course.activeRevisionId` (PASSED).
6. **ED-30.6:** Late AI ingestion result is safely ignored when `isInstructorReviewed: true` (PASSED).
7. **Tree Integrity Validation:** Rejects empty topics array, whitespace-only titles, invalid Bloom level (`invalid_bloom_level`), and duplicate hierarchy IDs (PASSED).
- **Result:** 8/8 tests PASSED in 320ms.

### B. Quality Gates
- `pnpm --filter api typecheck`: PASSED (0 errors).
- `pnpm --filter api exec eslint modules/study/src/services/courseDraft.ts modules/study/src/routes/courses.ts modules/study/src/services/ingestStatus.ts tests/integration/m07-course-draft-objectives.node.test.ts`: PASSED (0 errors, 15 pre-existing console warnings).

---

## 4. Next Step
Proceed to **M08 / ED-05: Immutable Reviewed Publication & Revision Resolution**:
- Implement `POST /api/v1/study/courses/:courseId/publish` requiring `isInstructorReviewed: true`.
- Implement `GET /api/v1/study/courses/:courseId/published-context` (Contract 03).
- Update `StudyRoom` preflight in `rooms.ts` to require published revision references.

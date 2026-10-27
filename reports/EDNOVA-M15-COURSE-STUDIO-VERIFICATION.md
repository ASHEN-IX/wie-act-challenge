# EdNova — M15 / ED-31: Course Studio Editing, Preview & Publishing UI Verification

## Executive Summary

- **Mission:** M15 — Course Studio Editing, Preview and Approval UI
- **Canonical Task:** ED-31 (Course Studio editor, preview and approval UI)
- **Status:** **COMPLETE & VERIFIED**
- **Date:** 2026-10-23
- **Test Suites:**
  - `apps/web/src/features/courses/course-studio.test.tsx` (4/4 unit tests passing)
  - `apps/web` unit test suite (47/47 passing)
  - Strict typecheck & lint (0 errors)

---

## 1. Requirements & Acceptance Criteria Verification

| ID | Requirement | Implementation | Status | Evidence |
|---|---|---|---|---|
| **ED-31.1** | Course Studio UI Route | `/courses/[courseId]/studio` with server-side identity & draft loading | **VERIFIED** | Dedicated page with permission handling |
| **ED-31.2** | Hierarchy & Objective Editing | CourseStudio client component edits draft topics, subtopics, and learning objectives | **VERIFIED** | Interactive inputs with Bloom level indicators |
| **ED-31.3** | AI Proposal Generation Integration | Trigger generation of `InteractiveQuiz` or `GuidedProblem` candidate proposals for any objective | **VERIFIED** | Wires `generateCandidateActivity` to backend ED-32 endpoint |
| **ED-31.4** | Trusted Activity Preview | Interactive preview of proposed activities using `ActivityRenderer` in `mode="preview"` | **VERIFIED** | Embedded without leaking server-only rubrics or evaluation keys |
| **ED-31.5** | Explicit Instructor Approval | Explicit "Approve & Register" button commits candidate to persistent `ActivityRecord` | **VERIFIED** | Invokes `registerCandidateActivity` via Contract 04 |
| **ED-31.6** | Draft Review & Publication Flow | Optimistic draft saving and gated publication requiring instructor review | **VERIFIED** | Review status badge and disabled publication when unreviewed |

---

## 2. Architecture & Invariants Enforced

1. **Instructor Authorization:**
   - Loading the studio route verifies instructor/admin permissions. Student access is blocked with descriptive feedback.
2. **Review Guardrail:**
   - A draft cannot be published to learners unless explicitly marked as reviewed (`isInstructorReviewed: true`).
3. **Optimistic Concurrency:**
   - Both draft updates and publication actions include `expectedRevisionTag`, preventing concurrent overwrite anomalies.
4. **Isolated Interactive Preview:**
   - Candidate activities are previewed through the same trusted, sandboxed renderer (`ActivityRenderer`) used in solo learning and study rooms, with zero dynamic script injection or eval.

---

## 3. Automated Test Evidence

```
 ✓ src/features/courses/course-studio.test.tsx (4 tests) 20ms
   ✓ renders course title, active revision tag, and unreviewed status badge
   ✓ renders reviewed status badge when isInstructorReviewed is true
   ✓ renders draft hierarchy topics, subtopics, and learning objectives
   ✓ renders activity proposal studio controls with InteractiveQuiz and GuidedProblem options

 Test Files  7 passed (7)
      Tests  47 passed (47)
   Start at  22:42:01
   Duration  823ms
```


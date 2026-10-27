# EdNova — M14 / ED-32: Course Studio Source-Backed Activity Proposal Generation Verification

## Executive Summary

- **Mission:** M14 — Course Studio Source-Backed Activity Proposals & Customization
- **Canonical Tasks:** ED-32 (Source-backed Studio activity proposals and customization), ED-31 (Course Studio preview integration)
- **Status:** **COMPLETE & VERIFIED**
- **Date:** 2026-10-23
- **Test Suite:** `apps/api/tests/integration/m14-studio-activity-generation.node.test.ts` (8/8 passing against live MongoDB 7)

---

## 1. Requirements & Acceptance Criteria Verification

| ID | Requirement | Implementation | Status | Evidence |
|---|---|---|---|---|
| **ED-32.1** | Scoped Instructor Access | `apps/api/modules/study/src/services/courseStudio.ts` authorizes actor via `canManageCourse` | **VERIFIED** | 403 Forbidden on non-instructors/students |
| **ED-32.2** | Objective Grounding | Resolves specified `objectiveId` within active draft revision topics/subtopics | **VERIFIED** | 404 OBJECTIVE_NOT_FOUND if objective missing |
| **ED-32.3** | Contract 04 Activity Conformance | Synthesizes grounded `InteractiveQuiz` with extracted sourceRefs, constraints, and valid `presentationData` | **VERIFIED** | Validated via `parseContract('ActivityDefinition', ...)` |
| **ED-32.4** | Contract 04 GuidedProblem Conformance | Synthesizes grounded multi-step `GuidedProblem` with analytical prompts | **VERIFIED** | Validated via `parseContract('ActivityDefinition', ...)` |
| **ED-32.5** | Server-Only Evaluation Pairing | Synthesizes paired `ServerEvaluationDefinition` matching activity pin and evaluation rubrics | **VERIFIED** | Validated via `parseContract('ServerEvaluationDefinition', ...)` |
| **ED-32.6** | Zero Self-Publication Invariant | Draft status stays `draft`, `CourseRevision` is not published, and candidate is never auto-registered | **VERIFIED** | DB assertions prove no unreviewed records created |
| **ED-32.7** | Explicit Instructor Review & Registration | Instructor reviews candidate and explicitly registers via `POST /activities/:activityId/register` | **VERIFIED** | 201 Created persists authoritative `ActivityRecord` |

---

## 2. Architecture & Invariants Enforced

1. **Immutable Grounding:**
   - Every candidate activity proposal links to the exact draft `contentHash` (`sha256:...`) and active `revisionTag`.
   - Source references explicitly set `provenance: 'extracted'` and `locationKnown: true` without hallucinating phantom document paths.
2. **Model Agency Guardrail:**
   - AI generation services are strictly proposal generators. The system enforces zero self-approval or silent persistence.
   - Proposed definitions must pass schema validation before delivery to the instructor client for preview and explicit commit.
3. **Draft Concurrency Isolation:**
   - Candidates tag their target revision. If an instructor updates the course draft hierarchy, proposals generated for previous revisions cannot silently overwrite current state.

---

## 3. Automated Test Evidence

```
▶ M14 / ED-32: Course Studio Source-Backed Activity Proposal Generation Integration
  ✔ Setup: Create institutional course with draft hierarchy and objectives (81.727877ms)
  ✔ ED-32.1: Rejects unauthorized student or outsider from generating proposals (24.062226ms)
  ✔ ED-32.2: Rejects generation for non-existent learning objective (9.304868ms)
  ✔ ED-32.3: Generates Contract 04 InteractiveQuiz proposal grounded in draft objective (8.65157ms)
  ✔ ED-32.4: Generates Contract 04 GuidedProblem proposal grounded in draft objective (8.202318ms)
  ✔ ED-32.5: Invariant - Zero model self-publication or draft alteration (4.142602ms)
  ✔ ED-32.6: Instructor reviews and explicitly registers the approved candidate activity (10.112566ms)
✔ M14 / ED-32: Course Studio Source-Backed Activity Proposal Generation Integration (182.552821ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
```


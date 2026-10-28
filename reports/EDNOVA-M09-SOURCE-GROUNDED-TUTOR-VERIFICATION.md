# EdNova M09 Source-Grounded Tutor & Citation Verification — 23 October 2026

**Implementation and verification: VERIFIED. M09 / ED-10: 100% COMPLETE.**
All requirements from F06, F14, Contract 03 (`GroundingContext`), and sprint backlog ED-10 are implemented and independently verified with real Node.js and Python integration tests.

---

## 1. Architectural Summary & Scope

ED-10 delivers the authoritative Course-Grounded Academic Tutor with verifiable citations and strict code-side authorization guarantees:
1. **Authoritative Course Authorization & Pinned Resolution**:
   - Resolved code-side via `resolveCourseSource` and `getPublishedCourseContext`.
   - Access verified for personal owners, assigned instructors, and actively enrolled students. Foreign users and unauthorized learners receive `403 FORBIDDEN`.
   - Unpublished courses are strictly isolated; attempting tutor interaction on an unapproved/unpublished draft revision returns `404 UNPUBLISHED`.
   - The tutor session is anchored to the immutable source pin `(courseId, revisionId, contentHash)`.

2. **Code-Side Document Boundary Enforcement**:
   - Vector chunk retrieval strictly queries the pinned revision index `faiss/<courseId>/<revisionId>.faiss`.
   - Chunks retrieved from FAISS are verified against `publishedContext.authorizedDocumentIds`. Chunks belonging to unauthorized or foreign documents are strictly dropped code-side before prompt construction.

3. **Adversarial Prompt-Injection Defense**:
   - User-supplied questions and retrieved course passages are isolated in random-nonce untrusted delimiters via `wrap_untrusted` from `apps/ai/security/prompt_guard.py`.
   - System prompts instruct the LLM to treat inputs strictly as data and forbid instruction execution from untrusted blocks.

4. **Verifiable Citation & Evidence Validation**:
   - Model outputs are parsed for citations: `[doc:DOCUMENT_ID, p:PAGE_NUMBER]`.
   - Every citation is validated against the retrieved passage manifest:
     - If all citations match retrieved authorized documents, the response status is `verified` and `citationsValid: true`.
     - If any citation references an unauthorized or fabricated document (model hallucination or injection attempt), the response is flagged as `status: "tentative"` and `citationsValid: false`.
     - If the course material contains no relevant chunks or scores below the relevance threshold, the tutor explicitly returns `status: "insufficient_evidence"` with `hasSufficientEvidence: false`.

5. **Contract 03 `GroundingContext` Compliance**:
   - Assembled `GroundingContext` payload adheres to Contract 03 (`schemaVersion: "1.0.0"`, `visibility: "service_only"`, source pin, unique sources, bounded excerpts).

---

## 2. Interface Endpoints & Data Model

### Node.js API Gateway:
- **`POST /api/v1/study/courses/:courseId/tutor/ask`**:
  - Request: `{ question: string, topicId?: string, objectiveId?: string }`
  - Headers: User authentication session (SessionGuard / actor context)
  - Returns `TutorAnswerResponse`:
    ```json
    {
      "answer": "...",
      "hasSufficientEvidence": true,
      "citationsValid": true,
      "status": "verified",
      "pin": {
        "courseId": "...",
        "revisionId": "...",
        "contentHash": "..."
      },
      "citations": [
        {
          "documentId": "...",
          "pageNumber": 1,
          "verified": true
        }
      ],
      "groundingContext": {
        "schemaVersion": "1.0.0",
        "visibility": "service_only",
        "pin": { ... },
        "sources": [ ... ],
        "excerpts": [ ... ]
      },
      "executionMode": "REAL_APPROVED"
    }
    ```

### Python AI Service:
- **`POST /api/ai/tutor/ask`**:
  - Request: `TutorQuestionInput` (`courseId`, `revisionId`, `contentHash`, `question`, `authorizedDocumentIds`, `topicId`, `objectiveId`, `topK`, `minScore`)
  - Authenticated via `require_service` (Bearer token using `AI_SERVICE_API_KEY`).
  - Returns `TutorAnswerResult`.

---

## 3. Test Evidence

### Python Unit & Security Test Suite
File: `apps/ai/tests/test_tutor_grounding.py`
Runtime: Python 3.12 (Isolated test virtual environment)
Command: `PYTHONPATH=apps/ai pytest apps/ai/tests/test_tutor_grounding.py -v`

Results:
- `test_verify_citations_valid`: PASSED
- `test_verify_citations_fabricated_document`: PASSED
- `test_verify_citations_unauthorized_document`: PASSED
- `test_grounded_tutor_successful_retrieval`: PASSED
- `test_grounded_tutor_unauthorized_document_filtering`: PASSED
- `test_grounded_tutor_empty_retrieval_insufficient_evidence`: PASSED
- `test_grounded_tutor_prompt_injection_defense`: PASSED
- `test_tutor_api_endpoint`: PASSED
**Total: 8/8 passed in 5.57s.**

### Node.js Real Integration Test Suite
File: `apps/api/tests/integration/m09-source-grounded-tutor.node.test.ts`
Database: Isolated MongoDB instance on `127.0.0.1:27018`
Command: `pnpm --filter api exec tsx --test tests/integration/m09-source-grounded-tutor.node.test.ts`

Results:
- `1. Setup: Create published course with reviewed objectives and enroll student`: PASSED
- `2. Enrolled student asks tutor and receives verified citations`: PASSED
- `3. Course owner can also ask tutor on their course`: PASSED
- `4. Non-enrolled foreign user is rejected with 403 FORBIDDEN`: PASSED
- `5. Tutor ask on unpublished course fails with 404 UNPUBLISHED`: PASSED
- `6. Input validation: empty or invalid question returns 400 INVALID_QUESTION`: PASSED
- `7. Insufficient evidence marks response as insufficient_evidence`: PASSED
- `8. Fabricated citation from AI marks status as tentative`: PASSED
**Total: 9/9 passed in 763ms.**

### Quality & Governance Gates
- `pnpm --filter api typecheck`: 0 errors.
- `pnpm --filter api lint`: 0 errors.
- Tree preservation: No git commits, resets, cleanups, stashes, or stages performed.


# ED-26 v1.0.0 — Official approval and decision ledger

**Candidate version:** `1.0.0`  
**Register opened:** 23 October 2026 (Africa/Tunis)  
**Official status:** **ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**

This is the authoritative decision register for the EdNova v1.0.0 contract candidate. It records owner decisions; it does not create them. An engineering recommendation, a passing test, a Git author, a reviewer name in a design document, a prior report, or silence is not an approval.

**Current result:** 0 of 19 owner decisions and 0 of 5 linked contradiction confirmations are recorded. No delegation is recorded. No contract correction is owner-authorized. The M03-H engineering patch is recorded separately as **PROVISIONAL PATCH READY**; it is not an approval and does not change any `NOT STARTED` implementation status under this register's definition.

## 1. Decision rules

A valid owner decision must contain all of the following:

1. authorized owner identity;
2. exact contract version (`1.0.0`);
3. explicit `APPROVE`, `APPROVE WITH CONDITIONS`, or `REQUEST CHANGES`;
4. the affected decision IDs;
5. clear, actionable conditions, if any;
6. actual decision date;
7. verifiable evidence: a dated message, issue/PR approval, meeting record, or signed document.

`APPROVE WITH CONDITIONS` is not the same as a satisfied gate. Conditional work remains open until the condition is implemented and verified, or explicitly accepted as a documented limitation by the accountable owner.

Delegation is valid only when the record identifies the original authority, the named delegate, the exact scope, the date, the evidence, and the contract version covered. An undocumented delegation is invalid.

**Implementation status** below means implementation authorized by an owner decision, not whether the unreviewed candidate happens to match a proposal. Every row remains `NOT STARTED` because no decision authorizes a change. The distinct M03-H field **PROVISIONAL PATCH READY** records engineering work available for review, not authorized implementation.

## 2. Approval completeness summary

| Measure | Recorded | Required | Status |
|---|---:|---:|---|
| Owner decisions (H-1…H-5, T-1…T-5, A-1…A-5, X-1…X-4) | 0 | 19 | **INCOMPLETE** |
| Focus decisions H-2, H-3, T-1, T-2, T-3, A-1, A-2 | 0 | 7 | **INCOMPLETE** |
| Joint decisions X-1…X-4 | 0 | 4 | **INCOMPLETE** |
| Linked contradiction confirmations C-07, C-09, C-13, C-14, C-15 | 0 | 5 | **INCOMPLETE** |
| Valid delegations | 0 | As needed | **NONE** |
| Contract corrections authorized | 0 | As decided | **NONE** |

No row may be promoted from `PENDING` by engineering judgment.

## 3. Owner decision register

Recommendations are engineering proposals only. They are recorded as `PROPOSED`, never as `APPROVED`.

| ID | Version | Contract area | Owner | Engineering recommendation (PROPOSED — not approval) | Decision | Conditions (proposed unless the owner records otherwise) | Date | Evidence | Implementation status | Final disposition |
|---|---|---|---|---|---|---|---|---|---|---|
| **H-1** | `1.0.0` | Revision lifecycle: `draft \| published \| deprecated`; `reviewStatus` metadata | Habib | **APPROVE** as written | **PENDING** | Keep `draft \| published \| deprecated` as the persisted vocabulary; `reviewStatus: unreviewed \| reviewed` remains candidate metadata; a reviewed draft is not a new persisted state. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **H-2** | `1.0.0` | `PublishedContext`, `EditorContext`, `SourceResolution`, `GroundingContext`, `ActivityDefinition`, `ActivityRef`, `AttemptSubmission`, `RoomActivityState`, `FacilitatorProposal` (shared `Pin`) | Habib | **APPROVE** with an explicit wire/storage mapping | **PENDING** | Wire `revisionId` is the immutable `revisionTag`, scoped by `courseId`; the backend resolves it to the internal MongoDB `_id`. Never expose the internal ObjectId as the public revision identity. Maintain stable pins, no silent substitution, and immutable publication semantics. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **H-3** | `1.0.0` | `SourceResolution.vectorIndexRef`; revision-specific retrieval artifacts | Habib | **APPROVE WITH CONDITIONS** | **PENDING** | Canonical artifact: `faiss/<courseId>/<revisionId>.faiss`; sidecar: `faiss/<courseId>/<revisionId>.meta.json`. No silent fallback to course-only FAISS for revision-pinned retrieval. Future resolver uses the revision identity; Mongo `chunk_embeddings` and retrieval caches become revision-aware. Foreign-course, foreign-revision and traversal references fail closed. Publication cannot reference another revision's index. Runtime adapter migration is a later designated mission, not a claim that it is already implemented. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **H-4** | `1.0.0` | Future grant vocabulary and current access predicate | Habib | **APPROVE** as written | **PENDING** | Future grant strings are `personal_owner`, `active_enrollment`, `assigned_instructor`; M02 remains the sole implemented personal-owner predicate until M04. Representing a grant does not activate it. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **H-5** | `1.0.0` | Revision failure semantics | Habib | **APPROVE** as written | **PENDING** | `UNPUBLISHED`, `REVOKED`, `STALE_REVISION` and `UNAVAILABLE` are access/resolution failures, not revision records. A stale pin never silently advances. `deprecated` is immutable history, not implicit revocation. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **T-1** | `1.0.0` | `AttemptSubmission`, `PrivateAttempt`, `AssessmentResult`; target attempt/evidence indexes | Tasnim | **APPROVE** actor-scoped attempt identity | **PENDING** | Durable receipt identity is `(authenticated userId, attemptId)`. `attemptId` remains lowercase UUID v4. Unique index on `{ userId: 1, attemptId: 1 }`; an `attemptId`-only lookup is non-unique if needed. `learning_evidence` must use `{ userId: 1, attemptId: 1 }` or otherwise prove attempt ownership rather than a global `{ attemptId: 1 }`. Actor is derived server-side; replays preserve idempotency; conflicting payloads fail closed; cross-user attempts stay isolated. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **T-2** | `1.0.0` | `ActivityDefinition`, `ActivityRef` | Tasnim | **APPROVE** the two P0 activity types | **PENDING** | v1.0.0 accepts only `InteractiveQuiz` and `GuidedProblem`. Other types are deferred to later reviewed versions; unknown types fail closed; no arbitrary frontend code execution. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **T-3** | `1.0.0` | `AssessmentResult` (`Graded`) | Tasnim | **APPROVE WITH CONDITIONS** — include `socraticHint` and `recommendedNextStep` | **PENDING** | Include both fields where applicable, using required-but-nullable fields if that is the approved schema design. Hints are private to the intended recipient, plain text with explicit bounds. Next-step references are validated; no invented mastery or completion; no unreviewed public disclosure. The exact permitted `recommendedNextStep.type` enumeration must be approved. The only canonical example today is `advance`; do not invent `retry`, `review` or another value. If only `advance` is approved, enforce that closed set. If more states are required, record the exact values and semantics before implementation. If Tasnim explicitly defers the fields, record the ED-27/ED-29 limitation; do not silently claim Contract 06 is fulfilled. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **T-4** | `1.0.0` | Attempt lifecycle and evidence ownership | Tasnim | **APPROVE** the lifecycle separation | **PENDING** | Persisted states remain `in_progress \| submitted \| graded`; transport/recovery states `pending \| rejected \| failed \| unavailable` never create fabricated persisted attempts. Only the Learning owner may create accepted evidence. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **T-5** | `1.0.0` | Evidence semantics and reward boundary | Tasnim | **APPROVE** as written | **PENDING** | Mastery is explicit, never inferred from submission. Model-based evidence requires `REAL_APPROVED`; synthetic fixtures are `MOCK_TEST`; `DETERMINISTIC_FALLBACK` retains its reviewed meaning. No XP amount is client- or model-authoritative. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **A-1** | `1.0.0` | `RoomActivityState`, `FacilitatorContext`, `FacilitatorProposal` | Aziz | **APPROVE WITH CONDITIONS** — nullable source pin | **PENDING** | Invariants: `activity != null => pin != null`; `pin == null => activity == null`. Source-free room: `pin: null`, `activity: null`. Course-backed room without active activity: valid pin, null activity. No fake provenance and no partially populated pins. Apply consistently to `RoomActivityState`, `FacilitatorContext` and `FacilitatorProposal`. If one context is deliberately restricted to course-backed rooms, state that limitation explicitly and provide the authorized source-free alternative. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **A-2** | `1.0.0` | `ProposalDecision` (`RejectedProposal`) | Aziz | **APPROVE WITH CONDITIONS** — closed status/code mapping | **PENDING** | `rejected` → `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION`; `stale` → `STALE_REVISION`; `unavailable` → `UNAVAILABLE`. Invalid combinations rejected by both language validators. Fix the existing `rejected + UNAVAILABLE` positive fixture; add negative fixtures for illegal combinations. Unavailable inference cannot mutate authoritative room state. Accepted decisions require valid authorization and command identity where the approved schema requires them. Presenter validation remains server-side. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **A-3** | `1.0.0` | `FacilitatorContext`, `FacilitatorProposal`, `ProposalDecision` | Aziz | **APPROVE** the candidate boundary | **PENDING** | Approve `messageText` and the deliberate omission of legacy `targetSpeakerId`/`reasoning` from the new boundary. Legacy ED-09 `FacilitatorIntervention` remains unchanged; do not retrofit legacy messages. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **A-4** | `1.0.0` | Room roster bounds | Aziz | **APPROVE / CONFIRM** the existing bounds | **PENDING** | `maxParticipants` ceiling is 10; runtime default remains 6. The default is not the maximum. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **A-5** | `1.0.0` | `PrivateHelpRequest`, `PrivateHelp` | Aziz | **APPROVE** private-help isolation | **PENDING** | Private help is recipient-only, binds `userId`/`requestId`, has no client actor, carries no tutor text when unavailable, and cannot cross-parse as public room state or public completion. | — (not recorded) | **NONE** — no dated owner decision found. | NOT STARTED | **BLOCKED — owner decision pending** |
| **X-1** | `1.0.0` | Cross-domain versioning policy | Habib, Tasnim, Aziz (joint) | **APPROVE** exact fail-closed versioning | **PENDING** | Exact `1.0.0` validation. Unknown or missing versions, fields, types and component versions are rejected. Additive fields are not silently accepted by strict readers. No silent downgrade or field stripping. | — (not recorded) | **NONE** — no dated joint decision found. | NOT STARTED | **BLOCKED — joint decision pending** |
| **X-2** | `1.0.0` | Public/private/server-only boundary | Habib, Tasnim, Aziz (joint) | **APPROVE** the boundary | **PENDING** | Schema validity is not authorization. Actor identity is server-derived. Private results remain recipient-only. Evaluation keys and rubrics never enter public DTOs. Service-only source references never enter unauthorized browser projections. | — (not recorded) | **NONE** — no dated joint decision found. | NOT STARTED | **BLOCKED — joint decision pending** |
| **X-3** | `1.0.0` | Freeze procedure | Habib, Tasnim, Aziz (joint) | **APPROVE** the freeze procedure | **PENDING** | Record approvals; resolve blocking contradictions; update both validators and fixtures; run all required verification; record final artifact hashes; freeze only the reviewed artifact set. | — (not recorded) | **NONE** — no dated joint decision found. | NOT STARTED | **BLOCKED — joint decision pending** |
| **X-4** | `1.0.0` | M04 consumption gate | Habib, Tasnim, Aziz (joint) | **APPROVE** the gate | **PENDING** | M04 may consume the contract only after the official freeze. Represented grants are not implemented authority. In this mission, M04-B remains blocked until freeze. | — (not recorded) | **NONE** — no dated joint decision found. | NOT STARTED | **BLOCKED — joint decision pending** |

## 3A. Provisional M03-H patch register

This register is engineering evidence only. It does not approve a decision, satisfy a condition, authorize implementation, freeze the contract or unblock M04-B. The authoritative M03-H review is [`reports/EDNOVA-M03H-PROVISIONAL-CONTRACT-CORRECTIONS.md`](../../reports/EDNOVA-M03H-PROVISIONAL-CONTRACT-CORRECTIONS.md).

| Focus ID | Provisional status | Patch and verification | Remaining owner condition | Owner approval |
|---|---|---|---|---|
| H-2 | **PROVISIONAL PATCH READY** | Revision-tag mapping documented; pin equality, source/revision mismatch and internal-ID exposure cases exercised in TS/Python fixtures and tests. | Habib must decide the exact wire/storage mapping. | **PENDING — NONE** |
| H-3 | **PROVISIONAL PATCH READY** | Exact relative index artifact enforced in both validators; positive resolution plus directory, legacy, absolute, traversal, foreign-course, foreign-revision, suffix and separator negatives. Runtime adapter remains course-scoped. | Habib must approve the condition and later authorize runtime migration. | **PENDING — NONE** |
| T-1 | **PROVISIONAL PATCH READY** | Actor-scoped `(userId, attemptId)` identities and target indexes documented; recipient binding and cross-user fixture coverage added. No attempt/evidence persistence implemented. | Tasnim must approve durable receipt identity and ownership semantics. | **PENDING — NONE** |
| T-2 | **PROVISIONAL PATCH READY** | Contract and data-model wording limits v1.0.0 wire types to `InteractiveQuiz` and `GuidedProblem`; unsupported visualizer/explorer negatives added. | Tasnim must approve the two-type P0 boundary. | **PENDING — NONE** |
| T-3 | **PROVISIONAL PATCH READY** | Required-but-nullable private `socraticHint` and `recommendedNextStep` added; only `advance` is accepted; public-boundary, missing, null, type, length and recipient cases added. | Tasnim must approve the fields and exact next-step enum; no other value is implemented. | **PENDING — NONE** |
| A-1 | **PROVISIONAL PATCH READY** | Nullable pins and source-free invariants added to room state, facilitator context and facilitator proposal; source-free and invalid partial cases added. | Aziz must approve the source-free semantics. | **PENDING — NONE** |
| A-2 | **PROVISIONAL PATCH READY** | Closed status/code mapping enforced in both validators; contradictory positive corrected; every allowed pair and illegal combinations covered. | Aziz must approve the closed mapping. | **PENDING — NONE** |

### 3A.1 Provisional artifact hashes (SHA-256, 23 October 2026)

| Artifact | SHA-256 |
|---|---|
| `docs/contracts/ednova-v1.md` | `9527c001940d9b2d22d48c2aef6ab7b92d11fca855ae3e2ff885caabe942ee54` |
| `docs/contracts/ednova-v1-fixtures.json` | `cfbbf09e8d982ad1222f77fd8db4de18f2e9018ff593a20cfbffc7194c211521` |
| `docs/contracts/ednova-v1.schema.json` | `7965cbb6d76482fe5bfe1a361265607315d9df04c6805152fc29db667ccff22f` |
| `apps/api/shared/ednova/contracts.ts` | `229faa9104eaf32b11de511e787fb34f8ddded0e4b06b339f1a87616a4fcbff0` |
| `apps/ai/contracts/ednova.py` | `77744a4dea06175c035e3f2e655950760ec3d13c63fa1fc6bbbecf8beeacd794` |
| `apps/api/tests/shared/ednova-contracts.test.ts` | `4510b5d51249feaa2a15156acd7141fa4c2bc33fa3d82050b4f0fc32d91662d7` |
| `apps/ai/tests/test_ednova_contracts.py` | `2da82f32c9c5c7e0227e176e0411fb29bca0b65178d9a8bc9b29609cb6ae83e2` |
| `apps/web/src/lib/activity-contracts.ts` | `88662dbc4b0878a1f338e86ac57f327c5c5871fe350a4bc29fe79fff56ec6d8b` |
| `apps/web/src/lib/activity-contracts.test.ts` | `85b327350ac5529e37e7dc040a4ebaa3ed92d156b7dfb3e79161e423ddd9113c` |
| `docs/contracts/technical-contracts.md` | `2a278bf623739f8fcb5ac3661d7595a7bdb7e7e806b81481d74175429cc17fb0` |
| `docs/data-model.md` | `b3edbc33c14008b27e86dc5cee5cf6178055947bea65cd42d6a1906b2e043de4` |
| `docs/architecture-decisions.md` | `6c85cd6fb2f289a13baca987c4266d905dd337cb8a375f9c76c84974054e08b3` |
| `docs/testing-plan.md` | `9d02c730fd67c3ea46077ee7e708240419181ea2de8305d2bfec5eb008be498a` |

The provisional artifact hashes identify the review bytes; they are not a freeze record or a substitute for owner-signed hashes.

## 4. Linked contradiction confirmations

These are confirmations already represented by an owner decision above. They are not separate approval paths and cannot be used to bypass a missing decision.

| ID | Linked decision | Exact confirmation | Owner | Decision | Date | Evidence | Disposition |
|---|---|---|---|---|---|---|---|
| **C-07** | T-4 | Persisted attempt states are `in_progress/submitted/graded`; transport adds `pending/rejected/failed/unavailable`; consumers must not persist transport-only states. | Tasnim | **PENDING** with T-4 | — (not recorded) | **NONE** | **BLOCKED** |
| **C-09** | A-3 | Contract 15's illustrative `spokenResponseText` is not adopted; the candidate keeps Python facilitator `messageText`; legacy ED-09 is untouched. | Aziz | **PENDING** with A-3 | — (not recorded) | **NONE** | **BLOCKED** |
| **C-13** | H-5 | Published/deprecated revisions are not access-failure records; failures are never fabricated revision states. | Habib | **PENDING** with H-5 | — (not recorded) | **NONE** | **BLOCKED** |
| **C-14** | X-1 | Exact `1.0.0` and strict readers, not silent additive acceptance or downgrade. | Habib, Tasnim, Aziz (joint) | **PENDING** with X-1 | — (not recorded) | **NONE** | **BLOCKED** |
| **C-15** | X-2, X-4 | Schema validity is not authorization; a represented grant does not activate authority. | Habib, Tasnim, Aziz (joint) | **PENDING** with X-2/X-4 | — (not recorded) | **NONE** | **BLOCKED** |

## 5. Delegation register

| Original authority | Named delegate | Exact scope | Date | Evidence | Version | Validity |
|---|---|---|---|---|---|---|
| — | — | — | — | — | `1.0.0` | **NO DELEGATION RECORDED** |

The technical coordinator's review of A-1/A-2 is engineering analysis. It is not a delegation from Aziz and does not constitute Aziz's approval. A delegation must be recorded here before it can be used.

## 6. Approval completeness gate

| Criterion | Result |
|---|---|
| Authorized owner identified | The accountable roles are documented as Habib, Tasnim and Aziz. No signed owner identity or dated channel is recorded for any decision. |
| Exact version specified | The candidate is `1.0.0`. No owner has confirmed that version in a decision. |
| Explicit decision recorded | **0 of 19** — all `PENDING`. |
| Conditions clear and accepted | Proposed conditions exist for the seven focus decisions. **0** owner-accepted condition sets. |
| Actual date recorded | **0 of 19**. |
| Verifiable evidence exists | **0 of 19**. |
| Conditions actionable | The proposed conditions are actionable engineering statements, but they are not authorized until an owner records them. |
| Complete approval set | **NO** — missing 19 owner decisions, 5 linked confirmations and any required delegation. |

**Gate result: FAIL — MODE A approval gate remains failed. No contract correction is owner-authorized. M03-H provisional engineering corrections do not alter this gate result.**

## 7. Evidence audit

The following records were inspected and contain no owner decision:

- `docs/contracts/ednova-v1.md` — review ledger remains `PENDING`; freeze remains `NOT FROZEN`.
- `reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md` — recorded approval state is `NONE` for Habib, Tasnim, Aziz, joint agreement and official freeze.
- `reports/EDNOVA-M03-FINAL-FREEZE-VERIFICATION.md` — all seven focus decisions and remaining ledger items are `PENDING`.
- `reports/EDNOVA-MISSION-GATES.md` — M03 / ED-26 remains `PARTIAL`; no freeze.
- `reports/EDNOVA-ACCEPTANCE-MATRIX.md` — ED-26.1–ED-26.3 remain `PARTIAL`; human review/freeze pending.
- `docs/team-delivery-plan.md` — cross-owner model changes require explicit sign-off; none is present.
- Repository search for approval, sign-off, decision, freeze and delegation records — no owner reply, signature, issue/PR approval, meeting record or dated delegation found.

No approval is inferred from automated tests, fixture success, build success, Git authorship, prior report prose, reviewer names in design documents, coding authorization, draft recommendations, silence or the absence of a rejection.

## 8. Next action

Review the M03-H provisional patch and collect genuine, dated owner replies for all 19 decisions and the five linked confirmations. After that, re-run this gate. Only a complete, authorized decision set can unlock MODE B contract corrections and the v1.0.0 freeze; M03-H engineering evidence cannot substitute for an owner decision.

Until then:

**ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**

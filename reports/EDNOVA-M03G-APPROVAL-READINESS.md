# EdNova M03-G — Approval readiness and decision package

**Execution mode:** **MODE A — approval collection and decision preparation**  
**Date:** 23 October 2026  
**Repository:** `/home/ashenix/Projects/mindflow`  
**Branch / HEAD:** `main` / `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`  
**Candidate:** ED-26 `1.0.0`  
**Official decision register:** [ednova-v1-approvals.md](../docs/contracts/ednova-v1-approvals.md)

**Final status of this mission:**

> **M03-G PARTIAL — ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**

No owner decision, signature, delegation or dated approval reply exists for any required item. No contract correction was applied. M04-B was not started.

## 1. Executive summary

M03-G entered MODE A because the approval completeness gate failed. The candidate is engineering-verified from M03-F, but verification is not authorization. The current records contain:

- **0 of 19** owner decisions;
- **0 of 5** linked contradiction confirmations;
- **0** valid delegations;
- **0** authorized contract corrections.

The seven focus decisions — H-2, H-3, T-1, T-2, T-3, A-1 and A-2 — remain `PENDING`. The remaining twelve decisions and the C-07/C-09/C-13/C-14/C-15 confirmations also remain unrecorded.

The authoritative register is [docs/contracts/ednova-v1-approvals.md](../docs/contracts/ednova-v1-approvals.md). It records engineering recommendations as `PROPOSED`, not `APPROVED`, and records every missing date or evidence field as missing rather than inventing one.

## 2. Evidence audit

The following were inspected:

| Source | Finding |
|---|---|
| `docs/contracts/ednova-v1.md` | Review ledger says `PENDING` for Habib, Tasnim, Aziz and joint agreement; official freeze `NOT FROZEN`. |
| `reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md` | Recorded approval state is `NONE` for every reviewer and for the official freeze. |
| `reports/EDNOVA-M03-FINAL-FREEZE-VERIFICATION.md` | All seven focus decisions and all remaining ledger items are `PENDING`; no correction authorized. |
| `reports/EDNOVA-MISSION-GATES.md` | M03 / ED-26 remains `PARTIAL`; no freeze. |
| `reports/EDNOVA-ACCEPTANCE-MATRIX.md` | ED-26.1–ED-26.3 remain `PARTIAL`; human review/freeze pending. |
| `docs/team-delivery-plan.md` | Cross-owner model changes require explicit sign-off; no sign-off is present. |
| Repository approval/sign-off/decision search | No owner reply, approval file, issue/PR approval, meeting record or delegation found. |

The mission prompt is an instruction to collect decisions. It is not an owner approval. The assistant's prior A-1/A-2 technical review is engineering analysis, not Aziz's signature.

Raw audit output: `reports/evidence/ednova-m03g-2026-10-23/approval-evidence-audit.txt` (ignored by Git).

## 3. Seven-decision matrix

All rows are `PENDING`. The recommendation column is engineering advice only.

| ID | Owner | Conflict | Engineering recommendation (PROPOSED) | Decision | Evidence |
|---|---|---|---|---|---|
| **H-2** | Habib | Wire `revisionId` is opaque; persistence uses Mongo `_id` plus `revisionTag`; the candidate accepts both. | Wire `revisionId` = immutable `revisionTag`, scoped by `courseId`; resolve server-side to the internal `_id`; never expose the ObjectId; stable pins, no silent substitution. | **PENDING** | **NONE** |
| **H-3** | Habib | Candidate uses `faiss/<courseId>/<revisionId>/`; docs say `.index`; actual adapter writes course-only `<courseId>.faiss` plus `.meta.json`. | Use `faiss/<courseId>/<revisionId>.faiss` plus `faiss/<courseId>/<revisionId>.meta.json`; revision-aware resolver, Mongo embeddings and caches; no course-only fallback; foreign/traversal references fail closed. Adapter migration belongs to a later mission. | **PENDING** | **NONE** |
| **T-1** | Tasnim | Candidate receipt identity is `(userId, attemptId)`; data model requires globally unique `{attemptId:1}`. | Keep actor-scoped identity; unique `{userId:1, attemptId:1}`, non-unique `{attemptId:1}` lookup; UUID v4; server-derived actor; idempotent replay and conflict fail-closed. | **PENDING** | **NONE** |
| **T-2** | Tasnim | ADR-14 lists four activity types; v1.0.0 supports only two. | Freeze exactly `InteractiveQuiz` and `GuidedProblem`; defer the other two to a later reviewed version; unknown types fail closed. | **PENDING** | **NONE** |
| **T-3** | Tasnim | Contract 06 and ED-08/ED-11 require hints and next steps; the candidate's graded result omits both. | Include `socraticHint` and `recommendedNextStep` before freeze; exact closed `type` set must be supplied by Tasnim. This reverses the earlier review-package recommendation to omit them. Only `advance` is canonical today; if that is the whole approved set, enforce it; if more states are required, record their exact values. If deferred, record the ED-27/ED-29 limitation and do not claim Contract 06 is fulfilled. | **PENDING** | **NONE** |
| **A-1** | Aziz | `RoomActivityState.pin` is mandatory even when no source/activity exists; source-free rooms are supported. | Nullable `pin`; `activity != null => pin != null`; source-free room has `pin: null, activity: null`; apply consistently to `FacilitatorContext` and `FacilitatorProposal`, or state the restriction and provide the authorized alternative. | **PENDING** | **NONE** |
| **A-2** | Aziz | No status/code invariant; illegal pairs such as `rejected + UNAVAILABLE` validate; the current positive fixture uses that pair. | Enforce: `rejected → UNAUTHORIZED, UNPUBLISHED, REVOKED, UNSUPPORTED_VERSION`; `stale → STALE_REVISION`; `unavailable → UNAVAILABLE`. Fix the positive fixture, add negative pairs, keep presenter validation server-side. | **PENDING** | **NONE** |

## 4. Remaining ledger confirmations

These are required before a freeze. None is approved.

| Item | Owner | Required confirmation | Status |
|---|---|---|---|
| **H-1** | Habib | Persisted revision vocabulary `draft \| published \| deprecated`; `reviewStatus` is candidate metadata. | **PENDING** |
| **H-4** | Habib | Future grant strings `personal_owner`, `active_enrollment`, `assigned_instructor`; M02 remains the sole implemented personal-owner predicate until M04. | **PENDING** |
| **H-5** | Habib | Unpublished/revoked/stale/unavailable are failures, not revision states; stale pins never silently advance. | **PENDING** |
| **T-4** | Tasnim | Persisted attempt states versus transport states; no fabricated persisted `unavailable`; only Learning may create accepted evidence. | **PENDING** |
| **T-5** | Tasnim | Explicit mastery; model-based evidence requires `REAL_APPROVED`; synthetic fixtures are `MOCK_TEST`; no client/model-authoritative XP amount. | **PENDING** |
| **A-3** | Aziz | `messageText` boundary; deliberate omission of legacy `targetSpeakerId`/`reasoning`; legacy ED-09 unchanged. | **PENDING** |
| **A-4** | Aziz | Roster ceiling 10; runtime default 6. | **PENDING** |
| **A-5** | Aziz | Private help recipient-only, no client actor, no tutor text when unavailable, no cross-parse as public room state. | **PENDING** |
| **X-1** | Joint | Exact `1.0.0` fail-closed versioning. | **PENDING** |
| **X-2** | Joint | Public/private/server-only boundary; schema validity is not authorization. | **PENDING** |
| **X-3** | Joint | Freeze procedure. | **PENDING** |
| **X-4** | Joint | M04 consumes only after freeze; represented grants are not implemented authority. | **PENDING** |
| **C-07** | Tasnim | Confirms T-4 lifecycle split. | **PENDING with T-4** |
| **C-09** | Aziz | Confirms A-3 `messageText` boundary. | **PENDING with A-3** |
| **C-13** | Habib | Confirms H-5 failure/revision separation. | **PENDING with H-5** |
| **C-14** | Joint | Confirms X-1 exact versioning. | **PENDING with X-1** |
| **C-15** | Joint | Confirms X-2/X-4 authorization boundary. | **PENDING with X-2/X-4** |

## 5. Exact owner-specific requests

Each reply must include owner identity, contract version `1.0.0`, the decision IDs, the decision, conditions, date and verifiable evidence. A reply may use the template in section 7.

### 5.1 Habib — Content and Access

Please record decisions for **H-1, H-2, H-3, H-4, H-5** and confirm **C-13**.

For H-2, state the exact wire identity. Engineering proposes the immutable `revisionTag`, scoped by `courseId`, resolved server-side to the internal ObjectId.

For H-3, state the exact artifact shape. Engineering proposes `faiss/<courseId>/<revisionId>.faiss` plus `faiss/<courseId>/<revisionId>.meta.json`, with no course-only fallback for revision-pinned retrieval. Confirm that the runtime adapter migration is a later mission and is not being claimed as implemented now.

For H-1, H-4 and H-5, confirm the proposed persisted vocabulary, future grant strings, and failure-versus-revision separation.

### 5.2 Tasnim — Learning and Evidence

Please record decisions for **T-1, T-2, T-3, T-4, T-5** and confirm **C-07**.

For T-1, confirm `(authenticated userId, attemptId)` receipt identity and the target indexes.

For T-2, confirm that v1.0.0 freezes only `InteractiveQuiz` and `GuidedProblem`.

For T-3, state whether `socraticHint` and `recommendedNextStep` are included. If included, supply the exact closed `recommendedNextStep.type` set. The only canonical example today is `advance`; engineering will not invent other values. If deferred, explicitly accept the ED-27/ED-29 limitation.

For T-4 and T-5, confirm the persisted/transport split and the evidence/reward provenance rules.

### 5.3 Aziz — Collaboration and Privacy

Please record decisions for **A-1, A-2, A-3, A-4, A-5** and confirm **C-09**.

For A-1, decide whether source-free rooms use `pin: null, activity: null` and whether the same rule applies to `FacilitatorContext` and `FacilitatorProposal`. If source-free facilitator use is not supported, state that limitation and the authorized source-free alternative.

For A-2, approve or replace this exact mapping:

| Status | Allowed codes |
|---|---|
| `rejected` | `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION` |
| `stale` | `STALE_REVISION` |
| `unavailable` | `UNAVAILABLE` |

For A-3, A-4 and A-5, confirm the `messageText` boundary, the 10/6 roster bounds, and private-help isolation.

The assistant's completed A-1/A-2 technical review is not a delegation and cannot be recorded as Aziz's approval. If Aziz intends to delegate, the record must name the delegate, scope, date and authority.

### 5.4 Habib, Tasnim and Aziz — Joint decisions

Please record **X-1, X-2, X-3 and X-4**, and confirm **C-14** and **C-15**. A joint decision requires all three accountable owners, or a valid recorded delegation for a missing owner.

- **X-1:** exact `1.0.0` fail-closed versioning; unknown/missing version, field, type or component version is rejected.
- **X-2:** schema validity is not authorization; actor identity is server-derived; private results stay recipient-only; answer keys/rubrics never enter public DTOs; service-only source references never enter unauthorized browser projections.
- **X-3:** approvals recorded, blocking contradictions resolved, both validators/fixtures/schema updated, verification rerun, artifact hashes recorded, then freeze.
- **X-4:** M04 consumes only after freeze; represented grants are not implemented authority. M04-B remains blocked until freeze.

## 6. Proposed review and decision agenda

**Recommended duration:** 30–45 minutes.  
**Proposed window:** 23–25 October 2026, with a 48-hour response window opening when this package is sent and closing within that review period.  
**Participants:** Habib, Tasnim, Aziz; one technical coordinator.  

| Time | Agenda item | Output |
|---|---|---|
| 0–5 min | Scope, candidate identity, evidence and decision rules | Confirm version `1.0.0`, no approval by silence |
| 5–15 min | Habib: H-1…H-5; focus H-2/H-3; C-13 | Dated decisions or explicit conditions |
| 15–25 min | Tasnim: T-1…T-5; focus T-1/T-2/T-3; C-07 | Dated decisions; exact T-3 enum or deferral |
| 25–35 min | Aziz: A-1…A-5; focus A-1/A-2; C-09 | Dated decisions; source-free facilitator and mapping |
| 35–42 min | Joint X-1…X-4; C-14/C-15 | Joint recorded decisions |
| 42–45 min | Recorder confirms identity, version, date, evidence and conditions | Complete ledger or explicit remaining blockers |

The coordinator may record and organize decisions but cannot vote, sign, delegate for an owner or convert a recommendation into an approval.

## 7. Decision capture template

```text
Owner:
Contract version: 1.0.0
Decision IDs:
Decision: APPROVE | APPROVE WITH CONDITIONS | REQUEST CHANGES
Conditions (exact):
Date:
Evidence / channel:
Delegate (only if formally authorized):
Delegation scope:
```

A conditional approval must state the exact condition and the evidence that will prove it. The condition remains open until the work is implemented and verified.

## 8. Implementation and verification status

**Contract corrections applied in M03-G: none.** No TypeScript validator, Python mirror, fixture, schema, canonical semantic document, boundary helper or web decoder was changed.

No fresh contract test or differential harness was run because no contract artifact changed. The M03-F results remain historical baseline evidence, not a new M03-G pass:

| Historical check | M03-F result |
|---|---|
| Python contract suite | 165 passed |
| TypeScript contract suite | 167 passed |
| Differential parity | 6,899 cases; 311 accepted each side; 0 outcome/value mismatches |
| Schema drift | 0 |
| Generated adapters | No drift |
| API route tests | 6 passed |
| API node tests | 10 passed |
| Web tests | 33 passed |
| Lint | 0 errors, 122 existing warnings |
| Typecheck | Pass |
| Build | Pass |
| Full root `pnpm test` | **Not run** — Docker/MongoDB/Redis unavailable; no full-suite claim |

Because the approvals are incomplete, running the final correction/parity workflow now would be the same harness over an unchanged candidate and would not create authority. It was intentionally not repeated.

## 9. Freeze and M04-B status

| Gate | Status | Evidence |
|---|---|---|
| Genuine owner decisions | **FAIL** | 0/19 recorded; ledger rows `PENDING` |
| Conditional requirements satisfied | **FAIL** | No owner conditions accepted; no correction authorized |
| Blocking contradictions resolved | **FAIL** | C-02/C-03/C-04/C-05/C-06/C-10/C-11 open; C confirmations pending |
| TS/Python final semantics | **HISTORICAL PASS ONLY** | M03-F parity; no M03-G correction |
| Fixtures/schema consistency | **HISTORICAL PASS ONLY** | M03-F schema drift 0; unchanged |
| Application regression | **HISTORICAL PASS WITH LIMITATIONS** | M03-F focused results; full root suite not run |
| Public/private boundaries | **HISTORICAL PASS; NOT APPROVED** | X-2 remains pending |
| Authorized freeze | **FAIL** | No approval or freeze authority |
| Artifact version/hashes | **CANDIDATE ONLY** | `1.0.0`; no frozen baseline |
| ED-26 acceptance criteria | **PARTIAL** | ED-26.1–ED-26.3 remain PARTIAL |
| M04-B | **BLOCKED** | Must not start before freeze |

The candidate remains at version `1.0.0` with the M03-F artifact hashes. It is not a frozen release. No tag, commit, push or publication was created.

M04-A.1 remains **PASS for its implemented invitation-reliability scope**. M04-A.2 remains **PASS for its Python parity and synthetic migration-readiness scope**. M04-A / ED-04 remains **PARTIAL**. No enrollment, instructor assignment or institutional source grant was started.

## 10. Preservation

Mission-start state from `reports/evidence/ednova-m03g-2026-10-23/mission-start-summary.txt`:

```text
branch=main
head=b4e75a41e2b9b30283bed78673c3a690ff4e70d5
porcelain_entries=248
staged_entries=0
tracked_modified=186
untracked_files=92
```

No reset, clean, stash, restore, stage, commit, push, publish, deploy or production-database mutation was performed. No unrelated file was deleted. The pre-existing dirty tree is preserved.

Final preservation state from `reports/evidence/ednova-m03g-2026-10-23/final-summary.txt`:

```text
branch=main
head=b4e75a41e2b9b30283bed78673c3a690ff4e70d5
porcelain_entries=249
staged_entries=0
tracked_modified=186
untracked_files=95
```

The three additional untracked files are the approval ledger, this readiness report and the final freeze verification. The evidence directory is ignored. Git collapses the untracked `reports/` directory in `git status --short`, so the porcelain count does not increase one-for-one; the file-level count is in `untracked_files`. The tracked-modification count is unchanged at 186 and the staged count remains 0.

Mission-only additions:

- `docs/contracts/ednova-v1-approvals.md` — official decision register.
- `reports/EDNOVA-M03G-APPROVAL-READINESS.md` — this readiness package.
- `reports/EDNOVA-M03G-CONTRACT-FREEZE-VERIFICATION.md` — final M03-G verification.
- `reports/evidence/ednova-m03g-2026-10-23/` — ignored evidence logs.

No existing canonical contract artifact was modified; the M03-F artifact hashes remain the candidate identity. The new ledger is included in the final hash capture under `reports/evidence/ednova-m03g-2026-10-23/`.

## 11. Final gate

| Criterion | Result |
|---|---|
| Every required owner decision genuinely recorded | **FAIL** |
| Every conditional approval requirement satisfied | **FAIL** |
| Every blocking contradiction resolved | **FAIL** |
| TypeScript and Python implement the same final semantics | **Historical pass only; no final approved candidate** |
| All fixtures and exported schema consistent | **Historical pass only; unchanged** |
| Required regression checks pass | **Historical focused pass; full suite not run** |
| Public/private boundaries valid | **Historical pass only; not approved** |
| Actual authorized freeze recorded | **FAIL** |
| Correct artifact version and hashes captured | **Candidate hashes only; not frozen** |
| ED-26 acceptance criteria fully satisfied | **FAIL — PARTIAL** |

**Final decision:**

> **M03-G PARTIAL — ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**

## 12. Exact next action

Send the Habib, Tasnim and Aziz requests in section 5 with the decision template and the proposed 23–25 October 2026 review window. Record each genuine reply in [the official ledger](../docs/contracts/ednova-v1-approvals.md) with identity, version, date, decision, conditions and evidence. Then re-run the completeness gate.

If all decisions are recorded and every condition is satisfied, proceed to MODE B: apply only the approved corrections, synchronize TypeScript/Python/fixtures/schema/docs/tests, rerun the required verification, record hashes and freeze v1.0.0. M04-B becomes **READY**, not started.

Do not start M04-B now.

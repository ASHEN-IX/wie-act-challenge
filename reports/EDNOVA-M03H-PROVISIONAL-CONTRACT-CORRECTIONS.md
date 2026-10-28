# EDNOVA M03-H — Provisional contract corrections

**Date:** 23 October 2026 (Africa/Tunis)  
**Contract candidate:** ED-26 `1.0.0`  
**Engineering status:** **PASS WITH LIMITATIONS**  
**Official status:** **ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**  
**Approval status:** **0 of 19 owner decisions and 0 of 5 linked confirmations recorded**

> This report records provisional engineering corrections. It does not create an owner approval, satisfy a condition, freeze the contract, activate runtime behavior or unblock M04-B.

## A. Mission and scope

M03-H implemented the seven focused engineering recommendations for H-2, H-3, T-1, T-2, T-3, A-1 and A-2 as a coordinated candidate patch. The work changed validators, fixtures, generated schema, technical/data-model documentation, tests and test-only web decoders. It did not implement attempt persistence, evidence awarding, evaluator behavior, learning UI, room realtime events or facilitator mutations.

The original pre-M03-H candidate is recoverable at `reports/evidence/ednova-m03h-2026-10-23/pre-m03h-contract-candidate/`. No historical report was overwritten.

## B. Baseline and evidence

Mission-start repository state:

- branch `main`; HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`;
- 249 porcelain entries: 186 tracked modifications, 0 staged, 95 untracked;
- 21 contract roots and 161 fixtures (51 positive, 110 negative);
- Python contract suite 165 passed; TypeScript contract suite 167 passed;
- M03-F differential baseline 6,899 cases, 311 accepted, 0 mismatches;
- schema drift check passed.

Starting artifact hashes were captured in `reports/evidence/ednova-m03h-2026-10-23/affected-file-hashes-before.txt`. Key start hashes included:

| Artifact | SHA-256 before M03-H |
|---|---|
| `docs/contracts/ednova-v1-approvals.md` | `eeb377c1c608e3ad40beaff2994e31e0a34c0d7e2d2d4e9137368c4f1ea2c5b3` |
| `docs/contracts/ednova-v1.md` | `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877` |
| `docs/contracts/ednova-v1-fixtures.json` | `b28248c2dd7d25188902b9d6cd462cd061957fa9b6e9634bea91ed2931cbfbec` |
| `docs/contracts/ednova-v1.schema.json` | `e6fdcedd65fc5d073e80f81dee897a78fa329d02a400a90f8df206c6570fccb9` |
| `apps/api/shared/ednova/contracts.ts` | `cc34e662333121fe4ce1b1ea0814f392a619f3781283609a51193193e0c4856b` |
| `apps/ai/contracts/ednova.py` | `80817b3048908af6880050f3add2d2ad6c26843f98610d47d3d3086776d40903` |

Evidence directory: `reports/evidence/ednova-m03h-2026-10-23/`.

The M03-H process did not run `git add`, `git commit`, `git push` or any staging operation. During verification, at `2026-10-23 18:00:57 +0100`, the repository owner created commit `5fb70a095da8f8cf429aed2e4f4bf72ce096e927`; that commit contains the provisional artifacts produced before that time. This report was created afterward and remains untracked. The external commit is not an owner approval and does not change the decision ledger.

## C. Corrections implemented

### H-2 — Revision identity

- Documented the wire `revisionId` as the immutable `course_revisions.revisionTag`, scoped by `courseId`; MongoDB `_id` is internal and must not become public or service-facing identity.
- Clarified that owning services resolve `(courseId, revisionTag)` and must not silently substitute a newer revision.
- Added relational tests for stable pins and inconsistent source/revision references.
- Added a negative fixture proving an internal `_id` field is rejected inside a pin.
- No wire-shape change was made and no storage migration was performed.

### H-3 — Revision-specific FAISS references

- Both validators now require exactly `faiss/<courseId>/<revisionId>.faiss`.
- The same check binds the path's course/revision segments to the payload pin.
- The metadata sidecar `faiss/<courseId>/<revisionId>.meta.json` is documented as a future runtime artifact, not an accepted `vectorIndexRef`.
- Negative fixtures cover directory-only, legacy course-only, absolute, traversal, foreign-course, foreign-revision, invalid suffix, metadata sidecar, extra-segment and backslash references.
- The production Python FAISS adapter and Mongo chunk storage were not modified. The current adapter remains course-scoped; a valid contract payload is **not** proof that revision-aware retrieval works at runtime.

### T-1 — Actor-scoped attempt identity

- Documented durable receipt identity as `(authenticatedUserId, attemptId)`.
- Documented the target unique indexes as `{ userId: 1, attemptId: 1 }` for attempts and evidence; standalone `attemptId` lookup is non-unique.
- Kept `attemptId` as lowercase UUID v4 and server-derived actor identity.
- Added contract-level tests proving the same `attemptId` can validate independently under different users and that recipient binding rejects cross-user delivery.
- No attempt persistence, route, comparison service or evidence-awarding behavior was implemented. The tests do not prove MongoDB idempotency.

### T-2 — Supported wire activity types

- Contract `1.0.0` is documented as accepting only `InteractiveQuiz` and `GuidedProblem`.
- The target data model retains future visualizer/explorer storage vocabulary but explicitly distinguishes it from the v1.0.0 wire boundary.
- Added negative fixtures for `StepByStepVisualizer` and `ParameterExplorer`; existing unsupported-type and renderer cases remain.
- No renderer or executable-content support was introduced.

### T-3 — Private pedagogical guidance

- Added required-but-nullable `socraticHint` (plain text, maximum 8,000 Unicode scalar values).
- Added required-but-nullable `recommendedNextStep` with `type`, `nextObjectiveId` and a 200-scalar title.
- Only `type: "advance"` is accepted provisionally. The exact enum remains Tasnim's decision; no `retry`, `review` or other value was invented.
- Added positive cases for explicit nulls and populated guidance, plus negatives for missing fields, invalid type, missing objective, oversized hint/title, unresolved-result injection and forged public-completion fields.
- Added a recipient-only web decoder and tests. Guidance cannot parse as `PublicCompletion` or room activity state.
- No evaluator, mastery inference, public room projection or learning UI was implemented.

### A-1 — Nullable source pins and source-free semantics

- `RoomActivityState.pin`, `FacilitatorContext.pin` and `FacilitatorProposal.pin` are nullable.
- Enforced `activity != null => pin != null` with matching course/revision/content hash.
- Source-free room/context: `pin: null`, `activity: null`. A course-backed room without an active activity keeps a non-null pin and null activity.
- A source-free proposal has `pin: null` and no `proposedUICommand`; a command requires a matching non-null pin.
- Updated `validateProposal` to handle matching null pins without crashing.
- Added source-free positive cases, an operation-level source-free proposal/context case and negatives for activity-without-pin and partial pins.
- Existing `ROOM_STATE_SYNC` behavior was not redefined and no runtime room event was changed.

### A-2 — Closed proposal status/code mapping

- Enforced the exact mapping in both validators:
  - `rejected` → `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION`;
  - `stale` → `STALE_REVISION`;
  - `unavailable` → `UNAVAILABLE`.
- Corrected the contradictory `rejected + UNAVAILABLE` positive fixture to `rejected + UNAUTHORIZED`.
- Added positives for all allowed rejected codes and negatives for illegal combinations and an unknown code.
- Updated Contract 15 documentation and preserved legacy ED-09 behavior.

## D. Cross-language differential parity

The M03-F differential harness was regenerated from the expanded fixture corpus and executed against the canonical TypeScript and Python validators.

| Measure | Result |
|---|---:|
| Differential cases | 7,793 |
| TypeScript accepted | 390 |
| Python accepted | 390 |
| Missing results | 0 |
| Outcome mismatches | 0 |
| Accepted values compared | 390 |
| Value mismatches | 0 |

This is up from the M03-F baseline of 6,899 cases and 311 accepted, due to the new positive fixtures. A valid case accepted by one language is accepted by the other, and accepted normalized values match.

## E. Fixtures and generated schema

- Corpus: 21 roots, 201 fixtures (59 positive, 142 negative), up from 161.
- Exactly 40 fixtures were added; 4 existing fixtures were deliberately corrected (`server resolution`, `private graded result`, `recipient result allowed`, `proposal rejected`). The other 157 existing fixtures are unchanged in parsed content.
- New coverage targets H-2 internal-ID exposure, H-3 artifact shape and binding, T-2 unsupported types, T-3 guidance/boundary behavior, A-1 source-free states and A-2 closed mappings.
- `docs/contracts/ednova-v1.schema.json` was regenerated from the Pydantic models.
- `python -m contracts.export_ednova_schema --check` passed with no drift.
- Schema is still a structural export artifact; relational invariants remain enforced by both language validators.

## F. Verification

### F.1 Focused contract and consumer suites

| Check | Result |
|---|---|
| TypeScript shared contract suite | **PASS** — 210/210 tests |
| Python contract suite | **PASS** — 208/208 tests |
| Web activity/result decoder suite | **PASS** — 5/5 tests |
| Full web application suite | **PASS** — 34/34 tests |
| API route constraints | **PASS** — 6/6 tests |
| ED-07 room lifecycle/state node tests | **PASS** — 10/10 tests |
| Schema drift check | **PASS** — no drift |
| Differential parity | **PASS** — 7,793 cases, 0 mismatches |
| `pnpm generate:contracts` | **PASS** — completed with no additional tracked artifact change |
| `pnpm typecheck` | **PASS** — API and web |
| `pnpm lint` | **PASS** — 0 errors; 122 pre-existing no-console warnings |
| `pnpm build` | **PASS** — API and web production build |

### F.2 Root application suite

`pnpm test` was invoked as required. Its Jest stage produced **53/56 suites passed, 713/732 tests passed, 3 suites and 19 tests failed**. All observed failures were infrastructure-dependent: Mongo was unavailable at `127.0.0.1:27018`/`[::1]:27018`, and the gateway health route returned 503 because dependencies were unavailable. The Jest process then hung on open handles and was terminated after the result was captured; therefore the command did not proceed to `test:node`, `test:node:integration` or `test:auth`. This is **FAIL/NOT RUN due to unavailable test infrastructure**, not a pass.

Docker daemon availability was checked separately: `docker ps` returned `Cannot connect to the Docker daemon`. Consequently, Docker-dependent API integration/security suites (including ED-07, ED-09, M02, M04-A.1 and M04-A.2 integration tests) are **NOT RUN**, not passed. No production authentication, authorization, room, invitation, database or AI route was changed by this mission; the validators, fixtures, tests and test-only web decoders are the affected surface.

## G. Changed files and provisional hashes

| Artifact | SHA-256 after M03-H |
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

`docs/contracts/ednova-v1-approvals.md` was updated with a distinct provisional patch register and unchanged PENDING decisions. These hashes are review identifiers, not a freeze record.

## H. Owner review required

The following decisions remain `PENDING`; the provisional patch does not satisfy them:

- **Habib:** H-2 wire/storage revision mapping; H-3 exact artifact/condition and later runtime migration authority.
- **Tasnim:** T-1 actor-scoped receipt identity; T-2 two-type P0 boundary; T-3 field approval and exact `recommendedNextStep.type` enum. Only `advance` is implemented.
- **Aziz:** A-1 source-free room/facilitator semantics; A-2 closed status/code mapping.
- **Joint:** X-1 through X-4 and linked confirmations C-07, C-09, C-13, C-14 and C-15.

The exact review locations and provisional artifact hashes are in `docs/contracts/ednova-v1-approvals.md` section 3A. No reviewer identity, owner signature or approval was invented.

## I. Runtime and security boundaries

- No production FAISS adapter, index data, Mongo chunk storage, resolver, cache or legacy fallback was changed.
- No attempt/evidence collection, persistence, route, evaluator, mastery, reward or learning UI was added.
- No room realtime event, facilitator mutation or private-help behavior was added.
- No production database index, invitation record, institution grant or deployment database was changed.
- Existing Better Auth, source isolation, room access, invitations and AI/Nest separation remain the authoritative runtime controls.
- A structurally valid payload is not authorization and is not proof of runtime capability.

## J. ED-26, freeze and M04-B status

- **ED-26:** PARTIAL.
- **v1.0.0:** NOT FROZEN.
- **M04-B:** BLOCKED.
- **M03-H engineering:** PASS WITH LIMITATIONS.

The seven corrections are available for owner review, but no approval gate was passed. The approval ledger still records 0 of 19 owner decisions, 0 of 5 linked confirmations and no delegation.

## K. Next mission

Next is **M03-G Mode B** after genuine, dated owner review decisions are recorded. It must verify the accepted decision set, apply any owner-required adjustments, re-run parity/schema/application regressions and prepare freeze evidence. M04-B must not start before the official freeze.

Until then:

**ED-26 PARTIAL — v1.0.0 NOT FROZEN — M04-B BLOCKED**

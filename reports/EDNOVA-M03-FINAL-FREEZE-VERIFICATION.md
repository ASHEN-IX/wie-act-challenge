# EdNova M03-F final freeze verification — 23 October 2026

**Final state: ED-26 PARTIAL; candidate version `1.0.0` NOT FROZEN; M04-B BLOCKED. No contract correction was authorized or applied.**

Repository: `/home/ashenix/Projects/mindflow`  
Branch / HEAD: `main` / `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`  
Date: 23 October 2026 (Africa/Tunis)  
Scope: M03-F only. M04-B was not started.

This report is the final freeze decision record. It replaces the previous freeze report and the engineering recommendations in the M03 review package only as a current status statement; it does not rewrite that historical package. No approval, signature, delegate appointment, meeting record or governance change was invented or inferred.

## 1. Executive summary

The candidate implements 21 shared contract roots, 161 golden fixtures and matching TypeScript/Pydantic validators. Fresh validation confirms that the unchanged candidate is executable and cross-language parity is intact. The seven named semantic decisions remain unresolved because no genuine Habib, Tasnim or Aziz decision exists in the repository or in this session.

Engineering findings that affect the recommendations:

- **H-2:** the contract accepts both a revision tag such as `rev_synthetic_1` and a 24-hex Mongo ObjectId. The wire identity must be defined explicitly; the recommendation is the immutable `revisionTag`, not the database `_id`.
- **H-3:** the previous review package recommended a `.index` file. That recommendation is superseded by the actual Python adapter: it stores `FAISS_INDEX_DIR/<courseId>.faiss` plus `<courseId>.meta.json`, keyed only by course and not by revision. The contract's directory-shaped reference cannot represent either the documented `.index` example or the actual `.faiss` artifact.
- **T-1:** the data model requires globally unique `attemptId`, while the candidate uses `(authenticated userId, attemptId)` receipt identity. No independent cross-user use case requires global uniqueness; actor-scoped identity is safer and should be reflected in the future database indexes.
- **T-2:** ADR-14 lists four activity types, but P0 and the product acceptance path support only `InteractiveQuiz` and `GuidedProblem`. The v1.0.0 wire contract should remain limited to those two.
- **T-3:** Contract 06, ED-08/ED-11 and ED-27/ED-29 require a hint/next-step result path. The candidate's graded result omits `socraticHint` and `recommendedNextStep`; this is a real downstream gap, not a harmless omission.
- **A-1:** current rooms may be source-free (`courseId` and `revisionId` are optional and source-free teams retain active-membership flow), but `RoomActivityState.pin` is mandatory. A source-free room cannot emit the future event without a fake pin.
- **A-2:** `ProposalDecision` accepts illegal combinations such as `rejected + UNAVAILABLE` and `stale + UNAUTHORIZED`; the current positive fixture `proposal rejected` itself uses `rejected + UNAVAILABLE`.

Fresh verification of the unchanged candidate:

| Check | Result |
|---|---|
| Python contract suite | **165 passed, 0 failed** |
| TypeScript contract suite | **167 passed, 0 failed** |
| Differential TS/Python parity | **6,899 cases; 311 accepted each side; 0 outcome mismatches; 0 value mismatches** |
| Schema drift check | **Exit 0, no output** |
| REST/contract adapter generation | **No drift; generated files byte-identical** |
| API route contract tests | **6 passed** |
| API room node tests | **10 passed** |
| Web tests | **33 passed across 5 files** |
| `pnpm lint` | **Exit 0; 0 errors, 122 existing warnings** |
| `pnpm typecheck` | **Exit 0 (API and web)** |
| `pnpm build` | **Exit 0 (API and production web build)** |
| Full root `pnpm test` | **Not run**; Docker daemon unavailable and no local MongoDB/Redis test services. No full-suite claim is made. |

The candidate is engineering-verified but cannot be frozen. The current validators agree; the freeze gate fails because the required owner decisions are missing and several canonical semantic gaps remain open. Passing tests do not convert those gaps into approvals.

## 2. Seven-decision final matrix

### 2.0 Canonical decision-ledger fields

| ID | Version | Affected contract root(s) | Reviewer | Decision / date / evidence | Conditions | Resolution status |
|---|---|---|---|---|---|---|
| **H-2** | `1.0.0` | `PublishedContext`, `EditorContext`, `SourceResolution`, `GroundingContext`, `ActivityDefinition`, `ActivityRef`, `AttemptSubmission`, `RoomActivityState`, `FacilitatorProposal` (shared `Pin`) | Habib | **NONE / — / NONE** | Wire `revisionId` = immutable `revisionTag`; resolve to internal ObjectId; document mapping. | **PENDING** |
| **H-3** | `1.0.0` | `SourceResolution.vectorIndexRef` | Habib | **NONE / — / NONE** | Revision-specific `faiss/<courseId>/<revisionId>.faiss` plus sidecar; adapter resolver and revision-aware Mongo/cache required; no course-only fallback. | **PENDING** |
| **T-1** | `1.0.0` | `AttemptSubmission`, `PrivateAttempt`, `AssessmentResult`; target `activity_attempts`/`learning_evidence` indexes | Tasnim | **NONE / — / NONE** | Actor-scoped `(userId, attemptId)` identity; unique `{userId:1, attemptId:1}`; non-unique `attemptId` lookup. | **PENDING** |
| **T-2** | `1.0.0` | `ActivityDefinition`, `ActivityRef` | Tasnim | **NONE / — / NONE** | Freeze `InteractiveQuiz` and `GuidedProblem`; defer visualizer/parameter types to a later version. | **PENDING** |
| **T-3** | `1.0.0` | `AssessmentResult` (`Graded`) | Tasnim | **NONE / — / NONE** | Include `socraticHint` and `recommendedNextStep` before freeze; exact `type` set must be supplied by Tasnim; otherwise explicit deferral and UI block. | **PENDING** |
| **A-1** | `1.0.0` | `RoomActivityState`; same issue in `FacilitatorContext`/`FacilitatorProposal` | Aziz | **NONE / — / NONE** | Nullable `pin`; `activity != null => pin != null`; source-free = both null; decide facilitator consistency. | **PENDING** |
| **A-2** | `1.0.0` | `ProposalDecision` (`RejectedProposal`) | Aziz | **NONE / — / NONE** | Closed status/code mapping; correct `rejected + UNAVAILABLE` fixture; add negative pairs. | **PENDING** |

Every row is **PENDING**. "Recommendation" is engineering advice, not a decision, approval or governance change. No reviewer identity, decision, date, channel, condition or signature exists for any row.

| ID | Owner | Current conflict | Engineering recommendation | Approval evidence | Status |
|---|---|---|---|---|---|
| **H-2** | Habib | Wire `revisionId` is opaque; persistence uses Mongo `_id` plus `revisionTag`; the contract accepts both forms. | Wire `revisionId` is the immutable `revisionTag` scoped by `courseId`; resolve it server-side to the internal `_id`. Do not expose the ObjectId. | **NONE** | **PENDING** |
| **H-3** | Habib | Candidate requires `faiss/<courseId>/<revisionId>/`; docs say `.index`; actual adapter writes `<courseId>.faiss` plus `.meta.json` and is course-scoped. | Use a revision-specific `faiss/<courseId>/<revisionId>.faiss` artifact with adjacent metadata. Require an explicit adapter resolver change; never fall back to the course-only file. | **NONE** | **PENDING** |
| **T-1** | Tasnim | Candidate receipt identity is `(userId, attemptId)`; data model requires globally unique `{attemptId:1}` and evidence also uses `{attemptId:1}`. | Keep actor-scoped receipt identity. Use unique `{userId:1, attemptId:1}` and non-unique `{attemptId:1}` lookup; keep UUID v4. Update the target data model and ED-29, not the wire shape. | **NONE** | **PENDING** |
| **T-2** | Tasnim | ADR-14 lists four core types; v1.0.0 supports only `InteractiveQuiz` and `GuidedProblem`. | Freeze the two P0 types in v1.0.0. Defer `StepByStepVisualizer` and `ParameterExplorer` to a later reviewed version and renderer. Annotate the data-model enum as target storage, not v1.0.0 wire support. | **NONE** | **PENDING** |
| **T-3** | Tasnim | Contract 06 and ED-08/ED-11 require hints/next steps; candidate graded result omits `socraticHint` and `recommendedNextStep`. | Include both fields in v1.0.0 before freeze, using Contract 06 field names. Tasnim must supply the exact closed `recommendedNextStep.type` set; only `advance` is canonical today. If Tasnim explicitly defers, record a versioned follow-up and block ED-27/29 next-step UI rather than silently omitting. | **NONE** | **PENDING** |
| **A-1** | Aziz | `RoomActivityState.pin` is mandatory even when `activity` is null; source-free rooms exist without a course/revision. | Make `pin` nullable and require `activity != null => pin != null`. A source-free room state has `pin: null` and `activity: null`. Apply the same rule to source-free `FacilitatorContext`/`FacilitatorProposal`, or those rooms remain unrepresentable. | **NONE** | **PENDING** |
| **A-2** | Aziz | No status/code invariant: `rejected + UNAVAILABLE`, `stale + UNAUTHORIZED` and `unavailable + STALE_REVISION` all validate today. | Enforce: `rejected` → `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION`; `stale` → `STALE_REVISION`; `unavailable` → `UNAVAILABLE`. Change the current `proposal rejected` fixture and add negative pairs. | **NONE** | **PENDING** |

The full ED-26 ledger also still records H-1, H-4, H-5, T-4, T-5, A-3, A-4, A-5 and X-1…X-4 as pending. This mission does not infer approval for those items from the seven-row focus, from tests, from Git authorship, from prior reports, from reviewer names in documents, from coding authorization, from silence or from the recommended dispositions above.

### 2.1 H-2 — revision identity

**Canonical requirement.** Contract 03 uses `revisionId: "rev_20261018_v1"`. `docs/data-model.md:59-71` defines `course_revisions` with `_id` as ObjectId, a separate `revisionTag` such as `rev_20261018_v1`, and a unique `{courseId, revisionTag}` index. Other collections such as `learning_objectives`, `learning_activities`, `activity_attempts` and `study_rooms` describe their `revisionId` fields as ObjectId references to `course_revisions`.

**Current candidate.** `Pin.revisionId` is the generic `Id` string at `apps/api/shared/ednova/contracts.ts:101`; Python mirrors it at `apps/ai/contracts/ednova.py:66-69`. The value is not constrained to a tag or an ObjectId. A current probe accepted `rev_20261018_v1`, `66f1e2b3c4d5e6f7a8b9c0aa` and `rev_synthetic_1` as the same field. `PublishedContext` and `EditorContext` use the same field.

**Actual producers and consumers.** Repository inspection found no `CourseRevision` model, no published-context handler and no `/published-context` endpoint. `StudyRoom.revisionId` is an optional string at `apps/api/modules/study/src/models/StudyRoom.ts:25`; any nonempty value causes an explicit 503 in room access and creation (`apps/api/modules/study/src/routes/rooms.ts:364-368`, `:418-422`; `roomCommands.ts:145-146`). The only current consumers are fixtures, tests and the test-only web decoders for `ActivityDefinition`/`RoomActivityState`.

**Conflict.** The database has two candidate identities: the internal ObjectId and the external revision tag. The wire contract accepts either, so two independent producers could use different identities for the same revision and still pass shape validation. That would break exact pin equality across content, activity, attempt, evidence and room records.

**Recommended representation.** Define wire `revisionId` as the immutable `revisionTag`, scoped with `courseId`. The server resolves `(courseId, revisionId)` through the unique `{courseId, revisionTag}` index and maps it to `course_revisions._id` for internal foreign keys. Do not expose the ObjectId in a public or service projection. This preserves all current examples (`rev_...`) and avoids coupling the contract to Mongo representation; it narrows the earlier review-package recommendation from an unspecified opaque value to the concrete tag. If Habib instead chooses `_id`, the Contract 03 example, fixture values and H-3 path shape must change together; mixing the two is not acceptable.

**Compatibility and required changes.** No TypeScript/Python schema change is required for the recommended mapping; the current `Id` shape already allows the tag. Required work is an explicit mapping note in `docs/contracts/ednova-v1.md` and `docs/data-model.md`, plus the future published-revision producer and its tests. No current persisted record or application consumer changes. This is a governance/documentation decision, not a validator change.

**Approver and evidence.** Habib. No approval record was found. Status **PENDING**.

### 2.2 H-3 — source-index reference

**Canonical requirement.** Contract 03's example is `faiss/66f1e2b3c4d5e6f7a8b9c0aa/rev_20261018_v1.index` (`docs/contracts/technical-contracts.md:153`). `docs/data-model.md:69` uses `faiss/course_123/rev_1.index`. The candidate instead requires a directory prefix `faiss/<courseId>/<revisionId>/` and rejects `..` (`contracts.ts:159`, `:500-508`; `ednova.py:141-153`). The positive fixture `server resolution` uses `faiss/66f1e2b3c4d5e6f7a8b9c0aa/rev_synthetic_1/index`.

**Actual implementation.** `apps/ai/services/vector_store/adapter.py:33` defines `FAISS_INDEX_DIR`; `:36-44` restricts course IDs to a safe filename charset. `_save_index` at `:234-240` writes `FAISS_INDEX_DIR/<course_id>.faiss` and `<course_id>.meta.json`. `_load_index_from_disk` at `:242-265` reads exactly those two files. `_save_embeddings_to_mongo` and `_load_index_from_mongo` at `:269-314` key MongoDB `chunk_embeddings` by `course_id` only. `add_course` at `:74-121` rebuilds and overwrites the course index; there is no revision dimension anywhere in the adapter.

**Current behavior probe.** The current contract accepted `faiss/<courseId>/<revisionId>/index` and `faiss/<courseId>/<revisionId>/index.faiss`, but rejected both the documented `faiss/<courseId>/<revisionId>.index` and the actual-style `faiss/<courseId>.faiss`. It also rejected a revision-specific `faiss/<courseId>/<revisionId>.faiss`. Therefore the current candidate cannot represent either authoritative documentation or the actual storage layout.

**Conflict.** Three incompatible shapes exist:

1. candidate: directory reference;
2. technical/data-model documents: `.index` file;
3. actual adapter: course-scoped `.faiss` file plus `.meta.json`, with no revision.

A course-scoped path cannot satisfy immutable revision pinning: publishing a second revision would overwrite or reuse the first revision's retrieval artifact. A directory reference would require the adapter to create and resolve revision directories that do not exist. The prior `.index` recommendation was documentation-led and is superseded by this code inspection.

**Recommended representation.** Use a revision-specific artifact reference:

```text
faiss/<courseId>/<revisionId>.faiss
```

with sidecar metadata `faiss/<courseId>/<revisionId>.meta.json`. This preserves the actual FAISS file format, makes the revision part of the path, and gives the resolver a deterministic, non-overwriting artifact. The field remains service-only; the browser never receives it. The resolver must reject `..`, absolute paths, a foreign course prefix, a foreign revision prefix and a missing sidecar. The source resolver must not fall back to the legacy course-only `<courseId>.faiss` for a revision-pinned request.

**Compatibility and required changes.** This is a pre-freeze correction requiring coordinated changes to both validators, the invariant, the shared fixture, the schema export, both test suites and the two design documents. It also requires an ED-05/ED-29 adapter change to build and load revision-specific files; that adapter change is not implemented here. The adapter change must also make the Mongo `chunk_embeddings` record, `search` path and in-memory cache revision-aware (or key them by the revision identity); writing a revision-specific `.faiss` file while `_load_index_from_mongo` still queries only `course_id` would let the fallback reconstruct a course-wide index. The current application has no producer or consumer of `SourceResolution`, so legacy runtime behavior is unaffected. The previous review-package recommendation to use `.index` should not be applied.

**Approver and evidence.** Habib. No approval record was found. Status **PENDING**.

### 2.3 T-1 — attempt identity

**Canonical requirement.** Contract 05 says the client generates a UUID v4 `attemptId`; repeated submissions with the same ID return the cached result (`docs/contracts/technical-contracts.md:218`). `docs/data-model.md:129-145` defines `activity_attempts.attemptId` as unique UUID v4 and a unique `{attemptId:1}` index. `learning_evidence` also has a unique `{attemptId:1}` index (`:159-166`). Contract 07 says the same.

**Current candidate.** `AttemptSubmission.attemptId` is canonical lowercase UUID v4 (`contracts.ts:243-250`; `ednova.py:273-285`). The candidate text at `docs/contracts/ednova-v1.md:58-60` defines receipt identity as `(authenticated userId, attemptId)`. `compareAttempt` compares only `attemptId` and canonical payload (`contracts.ts:625-637`); the caller has the authenticated `userId` from `readAttemptSubmission` (`boundary.ts:4-14`). There is no attempt model, route or persistence implementation in the repository.

**Actual producers and consumers.** No canonical `ActivityAttempt` collection or route exists. The only current consumers are the boundary test route, `compareAttempt` fixtures and the candidate tests. Existing evaluation code uses a different legacy `EvalResult`/job mechanism and is not an implementation of this contract.

**Conflict.** The candidate's actor-scoped identity and the data model's global `{attemptId:1}` cannot both be authoritative. With a global unique index, a second user submitting the same UUID (by collision, copied value or attack) is rejected or conflicts with the first user's attempt. The contract's UUID format makes accidental collision negligible but does not eliminate attacker-chosen reuse. The candidate's own security rationale is to prevent cross-user denial and cross-user result access.

**Recommended representation.** Keep `attemptId` as a UUID v4 on the wire. Use `(userId, attemptId)` as the durable receipt and database identity. The future `activity_attempts` index should be unique on `{userId:1, attemptId:1}`, with a non-unique `{attemptId:1}` lookup if operational lookup is needed. `learning_evidence` should be unique on `{userId:1, attemptId:1}` (or otherwise prove attempt ownership) rather than global `{attemptId:1}`. No cross-user lookup or global attempt namespace is required by any inspected consumer. This is an explicit target-schema change, not a wire change.

**Compatibility and required changes.** No TypeScript/Python shape change. The target `docs/data-model.md` indexes, ED-29 persistence and its migration tests must change. There are no current `activity_attempts` or `learning_evidence` collections to migrate under this candidate, so no production migration is authorized or implied. If a future globally unique index is deployed first, it must be reconciled before ED-29 accepts attempts. `compareAttempt` must remain a pure payload classifier; ED-29 must scope its lookup by the authenticated actor before calling it.

**Approver and evidence.** Tasnim. No approval record was found. Status **PENDING**.

### 2.4 T-2 — activity types

**Canonical requirement.** ADR-14 lists `InteractiveQuiz`, `GuidedProblem`, `StepByStepVisualizer` and `ParameterExplorer` (`docs/architecture-decisions.md:274-278`). The product specification limits P0 to the first two and places the other two in P1 (`docs/product-specification.md:205-208`). The data model's `learning_activities.activityType` enum contains all four (`docs/data-model.md:112-127`).

**Current candidate.** The activity union is only `Quiz` and `Problem` (`contracts.ts:178-213`; `ednova.py:215-240`). `ActivityRef` also allows only those two (`contracts.ts:214-221`; `ednova.py:243-246`). The negative fixture `unsupported type` rejects `StepByStepVisualizer`. The browser decoder in `apps/web/src/lib/activity-contracts.ts` only dispatches the shared parser; no renderer or registry exists.

**Producers and consumers.** No activity registry, definition endpoint or trusted renderer exists. The candidate is consumed by the web decoder test and shared fixtures only. ED-27 is still absent. The existing text practice form is not a trusted quiz/guided renderer.

**Conflict.** ADR-14's four-type list is a target capability list, while v1.0.0 is a versioned P0 contract. Treating the four-type data-model enum as proof that all four must validate in v1.0.0 would force unsupported renderers into a strict contract. Treating the two-type candidate as the whole target would understate the roadmap.

**Recommended representation.** Freeze v1.0.0 on exactly `InteractiveQuiz` and `GuidedProblem`. Keep the data-model enum as target storage vocabulary, but annotate it as not implying v1.0.0 wire support. Defer `StepByStepVisualizer` and `ParameterExplorer` to a later reviewed contract version with their own trusted renderer, component version and negative fixtures. Unknown types must continue to fail closed.

**Compatibility and required changes.** No validator or fixture change is required; the candidate already implements the recommendation. Documentation should explicitly distinguish the target enum from the v1.0.0 allowlist. No current consumer expects the other types. The later version must not be smuggled into a 1.0.0 `ActivityDefinition` or `ActivityRef`.

**Approver and evidence.** Tasnim. No approval record was found. Status **PENDING**.

### 2.5 T-3 — assessment guidance fields

**Canonical requirement.** Contract 06 says the result returns correctness, pedagogical feedback and next-step recommendations, and its payload contains `socraticHint` and `recommendedNextStep: { type: "advance", nextObjectiveId, title }` (`docs/contracts/technical-contracts.md:239-261`). The product specification requires a hint before a full answer and one evidence-linked next step, with untested different from incorrect (`docs/product-specification.md:72-95`, `:205-209`). ED-27's acceptance includes hint/results; ED-29 owns private attempts/assessment.

**Current candidate.** `Graded` contains `score`, `isCorrect`, `feedback`, `bloomLevelDemonstrated`, `evidenceId` and `evaluatedAt` (`contracts.ts:260-273`; `ednova.py:298-310`) but no hint or next-step fields. The current probe rejected a graded result carrying either field. The only hint-like behavior in the repository is legacy facilitator/private-help behavior, not the canonical assessment result.

**Producers and consumers.** There is no canonical assessment-result producer or renderer. The candidate is consumed only by fixtures/tests. ED-27 and ED-29 are absent. Contract 06 is therefore a design requirement with no current runtime implementation to preserve.

**Conflict.** Omitting the fields avoids speculative schema, but it silently drops a canonical output and the only defined downstream path for the individual next step. If v1.0.0 freezes without them, adding them later is a strict-reader version change, not an additive-compatible edit. Deferral is therefore a product/contract decision, not an engineering cleanup.

**Recommended representation.** Include both fields in v1.0.0 before freeze. This reverses the earlier review-package recommendation to omit them: Contract 06, F08/F20 and ED-27/29 explicitly require hint/feedback and a private next-step path, so omission would be a silent downstream gap rather than a safe deferral. No approval is inferred from this engineering change of recommendation. Use Contract 06 names:

- `socraticHint`: nullable plain text, bounded at 8,000 scalars;
- `recommendedNextStep`: nullable object with `type`, `nextObjectiveId` and `title` (title bounded at 200 scalars).

The exact closed `type` set must be supplied by Tasnim. The only canonical example is `advance`; the mission must not invent `retry`/`review` values. If Tasnim requires distinct outcomes for correct/incorrect/untested, she must name the closed set before the correction is implemented. If she explicitly defers the fields, record a versioned follow-up, keep them out of the 1.0.0 schema and block the ED-27/29 next-step UI; do not treat omission as approval.

**Compatibility and required changes.** If included, both fields must be required-but-nullable on `Graded` (not silently optional), with matching TS/Python models, schema export, positive/negative fixtures, tests and docs. Existing 1.0.0 graded payloads without the fields would then fail, which is why this must happen before freeze. No current producer or UI exists to migrate. If deferred, no schema change; the downstream UI dependency remains explicit.

**Approver and evidence.** Tasnim. No approval record was found. Status **PENDING**.

### 2.6 A-1 — source-free room activity state

**Canonical requirement.** `StudyRoom.courseId` and `revisionId` are optional (`apps/api/modules/study/src/models/StudyRoom.ts:24-25`). The create schema accepts empty course/revision (`routes/rooms.ts:304-311`; `roomCommands.ts:49-58`). The room list deliberately includes rooms with no course and no revision (`routes/rooms.ts:669-674`). `docs/roles-and-permissions.md:64` says source-free teams retain the active-membership flow. The current room phase route rejects any `activeActivityId` with 503 until shared activity validation exists (`routes/rooms.ts:851-855`), but it does not require a course for the room itself.

**Current candidate.** `RoomActivityState.pin` is mandatory (`contracts.ts:352-363`; `ednova.py:417-434`); `activity` is nullable but the pin is not. A source-free payload with no `pin` is rejected; a payload with a fake pin would falsely assert a source. `FacilitatorContext` and `FacilitatorProposal` also require `pin` (`contracts.ts:372-403`; `ednova.py:451-493`), even though source-free rooms can invoke facilitator behavior today.

**Producers and consumers.** The future `ROOM_ACTIVITY_STATE` has no producer. Current room state is the legacy `ROOM_STATE_SYNC` payload (`routes/rooms.ts:58-98`), and the web decoder `decodeRoomActivityState` is unused by production. The legacy facilitator uses the separate `FacilitatorIntervention` model with statuses `proposed | delivered | accepted | declined | expired`, not the candidate proposal decision.

**Conflict.** A mandatory source pin conflates "this room has no source" with "this room is invalid." Source-free rooms are a supported current product state. Requiring a fake pin would create a false provenance record and could cause consumers to resolve an unauthorized or nonexistent course revision.

**Recommended representation.** Make `pin` nullable and enforce:

```text
activity != null  =>  pin != null
pin == null       =>  activity == null
```

A source-free room emits `pin: null, activity: null`; a course-backed room with no active activity emits a real pin and `activity: null`. A source-free room cannot carry a course-backed activity in v1.0.0; that would need a separate, explicitly authorized activity/source model. Apply the same nullable rule to `FacilitatorContext` and `FacilitatorProposal`, or document that source-free rooms cannot use the future facilitator contract. The latter would leave the current source-free facilitator flow unrepresentable.

**Compatibility and required changes.** This is a pre-freeze schema change to both validators, the relationship invariants, fixtures, schema, tests and docs. Existing pinned room fixtures remain valid. A new source-free positive fixture and a pinless-activity negative fixture are required. The web decoder would accept the new shape only after regeneration. No current production producer is affected. If Aziz instead restricts `ROOM_ACTIVITY_STATE` to course-backed rooms, the limitation must be explicit and source-free rooms need a separate state contract.

**Approver and evidence.** Aziz. No approval record was found. Status **PENDING**.

### 2.7 A-2 — proposal decision mapping

**Canonical requirement.** Contract 15/16 distinguish an AI proposal from the Nest decision and require Nest validation before a room mutation (`docs/contracts/technical-contracts.md:589-629`); the candidate adds `ProposalDecision` with `validated | accepted | rejected | stale | unavailable`. The candidate text separately calls out stale, malformed and unavailable proposals at `docs/contracts/ednova-v1.md:74`; the status/code gap is in `contracts.ts:404-429` and `ednova.py:513-521`.

**Current candidate.** `RejectedProposal` allows any `Failure` code for any of `rejected`, `stale` or `unavailable` (`contracts.ts:404-429`; `ednova.py:513-521`). There is no status/code validator. The current positive fixture `proposal rejected` uses `rejected + UNAVAILABLE`; `proposal stale` uses `stale + STALE_REVISION`; `proposal unavailable` uses `unavailable + UNAVAILABLE`. A probe confirmed `stale + UNAUTHORIZED` and `unavailable + STALE_REVISION` also validate.

**Producers and consumers.** No current `ProposalDecision` producer or consumer exists. The legacy facilitator broadcasts `FACILITATOR_INTERVENTION` and stores `status: delivered` or `declined` (`routes/rooms.ts:100-143`, `:1109-1125`, `:1165-1173`). It does not use `validated`, `stale`, `unavailable` or the candidate `Failure` vocabulary. The candidate is fixtures/tests only.

**Conflict.** Without an invariant, a presenter or UI cannot infer whether to retry, reload, request authorization or stop. `rejected + UNAVAILABLE` is especially misleading: a durable refusal is represented as a transient outage. The current fixture locks the ambiguous behavior into the positive corpus.

**Recommended representation.** Enforce a closed mapping in both validators and the schema-adjacent tests:

| Status | Allowed codes | Meaning |
|---|---|---|
| `rejected` | `UNAUTHORIZED`, `UNPUBLISHED`, `REVOKED`, `UNSUPPORTED_VERSION` | The proposal cannot be applied for a durable authorization/source/version reason. |
| `stale` | `STALE_REVISION` | The expected room/source sequence no longer matches; reload and re-propose. |
| `unavailable` | `UNAVAILABLE` | The decision service/context is temporarily unavailable; no mutation occurred. |

`REVOKED` belongs to `rejected` because it is a durable access decision, not a transient outage. If Aziz prefers `REVOKED` under `unavailable`, the owner must state that explicitly; the validator must still permit only the approved pair. The current `proposal rejected` fixture must change to a legal pair (for example `rejected + REVOKED`) or be reclassified as `unavailable`. Add negative fixtures for every illegal pair, including `rejected + UNAVAILABLE`, `stale + UNAUTHORIZED` and `unavailable + STALE_REVISION`. Consider requiring a non-null `interventionId` for `rejected`/`stale` while allowing `unavailable` before a proposal ID exists, if Aziz confirms that lifecycle.

**Compatibility and required changes.** This is a pre-freeze validator/fixture/schema/test/docs correction. It does not affect the legacy facilitator because the legacy path does not emit `ProposalDecision`. It will invalidate the current positive fixture, proving the need for the change rather than silently preserving ambiguity.

**Approver and evidence.** Aziz. No approval record was found. Status **PENDING**.

## 3. Cross-domain review

### 3.1 Actual implementation status

| Contract area | Actual producer/consumer found | Contract status |
|---|---|---|
| `PublishedContext`, `EditorContext` | No published-context/CourseRevision handler or endpoint. | Fixtures/tests only. |
| `AccessDecision`, `SourceResolution`, `GroundingContext` | No source resolver or service-only projection. M02 personal-owner check remains the only implemented source grant. | Fixtures/tests only. |
| `ActivityDefinition`, `ServerEvaluationDefinition` | No activity registry, definition endpoint or trusted renderer. Web decoder exists but is not wired to a production flow. | Fixtures/tests only. |
| `AttemptSubmission`, `PrivateAttempt`, `AssessmentResult` | No canonical attempt route/model/persistence. `readAttemptSubmission` is a test-only boundary adapter. Legacy `EvalResult`/job code is not this contract. | Fixtures/tests only. |
| `AcceptedEvidence`, `EvidenceDecision`, `RewardReference` | No canonical accepted-evidence service. Legacy gamification remains separate. | Fixtures/tests only. |
| `RoomActivityState`, `SelectActivityCommand` | Current room state is legacy `ROOM_STATE_SYNC`; activity selection returns 503. Web decoder exists but is unused in production. | Not integrated. |
| `FacilitatorContext`, `FacilitatorProposal`, `ProposalDecision` | Legacy ED-09 `FacilitatorIntervention`/broadcast path is active; it is not the candidate contract and does not produce `ProposalDecision`. | Not integrated. |
| `PrivateHelpRequest`, `PrivateHelp` | No private-help endpoint or UI. | Not integrated. |

This means the current application compatibility result is mostly a non-regression result: the candidate is isolated behind strict tests and decoders, and no production path was rewritten to consume it. Passing build/typecheck/web tests is necessary but not evidence that a future producer has implemented the semantics.

### 3.2 Cross-domain couplings that remain open

- **H-2 and H-3 are one decision chain.** A revision tag is not useful if the retrieval artifact is still keyed only by course. The tag must resolve to a revision-specific index, or a published revision can silently serve another revision's content.
- **T-1 and T-3 both feed ED-29.** Actor-scoped attempt identity and the assessment result's hint/next-step fields determine the future attempt/evidence API. Freezing one without the other creates mismatched persistence and UI semantics.
- **A-1 and A-2 both feed ED-07/ED-09.** Source-free rooms need a state representation that does not fabricate a pin, and facilitator decisions need a legal status/code mapping. The current legacy room/facilitator path does not validate either future shape.
- **Source-free facilitator is not solved by A-1 alone.** `FacilitatorContext` and `FacilitatorProposal` also require a pin. If source-free rooms are allowed to use facilitation, the same nullability rule or a separate source-free context is required. If they are not, that limitation must be explicit in the product/contract.
- **No schema validity is authorization.** The candidate types can represent future grants, recipient scopes and public projections, but the current M02 personal-owner check remains the only implemented source grant. No M04 enrollment or institutional source grant exists.

### 3.3 Open contradiction map

The final gate uses the review-package contradiction IDs. They map to the seven decisions as follows: **C-02** revision identity (H-2); **C-03** source-index reference (H-3); **C-04** attempt identity (T-1); **C-05** activity type set (T-2); **C-06** graded guidance fields (T-3); **C-10** source-free room pin (A-1); **C-11** proposal status/code mapping (A-2). All seven remain open because no owner decision exists. The cross-domain confirmations are **X-1** exact fail-closed versioning, **X-2** public/private/server-only boundary and authorization separation, **X-3** freeze procedure, and **X-4** M04 consumption gate. Review-package confirmations C-07, C-09, C-13, C-14 and C-15 also remain unapproved; they are not promoted by this report.

### 3.4 Approval evidence review

The following were inspected and all record **no decision**:

- `docs/contracts/ednova-v1.md:82-89` — H/T/A and X rows PENDING; official freeze NOT FROZEN.
- `reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md:157-169` — Habib, Tasnim, Aziz, joint gate and official freeze all **NONE**.
- `reports/EDNOVA-MISSION-GATES.md:104`, `:211`, `:217` — M03/ED-26 PARTIAL, no freeze.
- `reports/EDNOVA-ACCEPTANCE-MATRIX.md` ED-26 rows — PARTIAL; human review/freeze PENDING.
- `docs/team-delivery-plan.md:145-149` — cross-owner model changes require explicit sign-off; no such sign-off is present.

No approval was inferred from automated tests, fixture success, build success, Git authorship, prior report prose, reviewer names in design documents, coding authorization, draft recommendations, silence, or the absence of a rejection. The seven recommendations above are engineering advice only.

## 4. Contract modifications applied

**None.**

No contract semantics, field, status, version, fixture, schema or validator was changed in M03-F. No owner database model was modified. No data-model index was changed. No production code was changed. The previous M03 correction (ASCII timestamp parity) remains the last candidate change and is already reflected in the current hashes.

The candidate files are unchanged from the review package hashes except for any pre-existing working-tree state; M03-F added only this report and its evidence logs. Running `pnpm generate:contracts` produced byte-identical generated adapters.

If genuine approvals arrive, the coordinated change set would be:

| Decision | Required coordinated changes |
|---|---|
| H-2 | Candidate mapping note and data-model mapping; no wire schema change if `revisionTag` is selected. |
| H-3 | `contracts.ts`, `ednova.py`, invariant, positive/negative fixtures, schema export, tests, `ednova-v1.md`, Contract 03 example, data-model example; future adapter resolver. |
| T-1 | Target data-model indexes and ED-29 persistence; no wire schema change. |
| T-2 | Documentation distinction between target storage enum and v1.0.0 wire allowlist; no validator change. |
| T-3 | TS/Python graded-result fields, schema, fixtures, tests, docs, ED-27/29 consumer contract. |
| A-1 | TS/Python nullable pin and relationship invariants, fixtures, schema, tests, docs; decide the facilitator-context treatment. |
| A-2 | TS/Python status/code invariant, fixture correction, negative pairs, schema, tests, docs. |

Any such change must update both validators and the shared fixture corpus in one pass, regenerate the schema, rerun the focused suites and differential parity, and keep v1.0.0 semantics coherent. A post-freeze additive change is not compatible with strict readers under X-1.

## 5. Verification

### 5.1 Environment

| Tool | Version |
|---|---|
| Node | `v24.20.0` |
| pnpm | `11.3.0` |
| Python | `3.12.15` |
| Pydantic | `2.12.5` |
| pytest | `9.0.2` |

Python dependencies were installed at the project-compatible versions into an isolated `/tmp/opencode/ednova-m03f-py` target. Docker was unavailable (`Cannot connect to the Docker daemon at unix:///home/ashenix/.docker/desktop/docker.sock`), so no container image, MongoDB, Redis, browser or real AI-provider test was run in this pass.

### 5.2 Commands and results

| Command | Result |
|---|---|
| `PYTHONPATH=/tmp/opencode/ednova-m03f-py:apps/ai python3.12 -m pytest apps/ai/tests/test_ednova_contracts.py -q` | **165 passed**, 0 failed, 0.21 s |
| `PYTHONPATH=... python3.12 -m contracts.export_ednova_schema --check` | **Exit 0**, no drift output |
| `pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand` | **167 passed**, 0 failed |
| Differential mutation generator | **6,899 cases** |
| TypeScript parity harness | 311 accepted |
| Python parity harness | 311 accepted |
| Parity comparison | **0 missing, 0 outcome mismatches, 0 value mismatches** |
| `pnpm generate:contracts` | **No generated diff** |
| `pnpm --filter api test:routes` | **6 passed**, 0 failed |
| `pnpm --filter api test:node` | **10 passed**, 0 failed |
| `pnpm --filter web test` | **33 passed**, 5 files, 0 failed |
| `pnpm lint` | **Exit 0**, 0 errors, 122 existing warnings |
| `pnpm typecheck` | **Exit 0**, API and web |
| `pnpm build` | **Exit 0**, API and production web build |

Security-relevant negative coverage includes private index traversal, public/result leakage by another recipient, forbidden answer keys/rubrics in public payloads, forged actor/score/evidence fields, unknown or missing versions, unknown fields, non-JSON/non-finite/oversized values, and illegal proposal status/code combinations. These are contract-level checks; they do not replace real API authorization tests.

The differential corpus is generated mutation evidence, not proof over all possible JSON values. The 161 golden fixtures remain the acceptance mechanism. The full root `pnpm test` was not run because its MongoDB/Redis-dependent suites are not applicable in this environment; no full-suite pass is claimed.

Raw logs are in `reports/evidence/ednova-m03f-2026-10-23/`: `python-contract-tests.log`, `python-schema-check.log`, `typescript-contract-tests.log`, `parity-summary.json`, `parity-harness.log`, `boundary-probes.log`, `generate-contracts.log`, `lint.log`, `typecheck.log`, `build.log`, `web-tests.log`, `api-routes.log`, `api-node.log`, `environment.txt`, `final-hashes.txt`, `final-status.txt`, `final-summary.txt` and `mission-only-files.txt`. That directory is ignored by `.gitignore`; the report is the durable summary.

Boundary probes independently confirmed:

- a source-free `RoomActivityState` without `pin` is rejected;
- `rejected + UNAVAILABLE`, `stale + UNAUTHORIZED` and `unavailable + STALE_REVISION` are accepted by the current `ProposalDecision`;
- a graded result with `socraticHint` or `recommendedNextStep` is rejected;
- the current `SourceResolution` accepts the directory fixture but rejects `.index` and actual-style `.faiss` references;
- the current `PublishedContext` accepts a tag, an ObjectId and a synthetic tag under the same `revisionId` field.

These probes document current behavior; they do not authorize a correction.

## 6. Freeze identity

The candidate is **not frozen**. The following is the current working-tree identity of the candidate, not a release tag or committed release.

| Artifact | SHA-256 |
|---|---|
| `docs/contracts/ednova-v1.md` | `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877` |
| `docs/contracts/ednova-v1-fixtures.json` | `b28248c2dd7d25188902b9d6cd462cd061957fa9b6e9634bea91ed2931cbfbec` |
| `docs/contracts/ednova-v1.schema.json` | `e6fdcedd65fc5d073e80f81dee897a78fa329d02a400a90f8df206c6570fccb9` |
| `apps/api/shared/ednova/contracts.ts` | `cc34e662333121fe4ce1b1ea0814f392a619f3781283609a51193193e0c4856b` |
| `apps/ai/contracts/ednova.py` | `80817b3048908af6880050f3add2d2ad6c26843f98610d47d3d3086776d40903` |
| `apps/api/tests/shared/ednova-contracts.test.ts` | `1c3a2bc18576f9196d9a2a32b75323c921e3928ba4ef3ef721fe33c665d4983b` |
| `apps/ai/tests/test_ednova_contracts.py` | `40439fc53333e7ac5dea8f77406fb4de952815feb91fe1336cbf4a02ae81ec00` |

Candidate facts:

- version: `1.0.0`;
- contract roots: **21**;
- fixtures: **161** (51 positive, 110 negative);
- branch/HEAD: `main` / `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`;
- release tag/commit: **none**;
- freeze approval: **none**;
- ED-26: **PARTIAL**.

Because the working tree is dirty and no commit/tag was created, these hashes are the only reproducible identity available. A future freeze must either commit the approved candidate or record an equivalent immutable artifact digest with the approval evidence.

## 7. Outstanding dependencies

### 7.1 Freeze-blocking owner decisions

| Owner | Required action |
|---|---|
| **Habib** | Record H-2 and H-3 decisions with reviewer identity, date, channel, version and exact chosen representation. At minimum, choose the revision identity mapping and the revision-specific index artifact. |
| **Tasnim** | Record T-1, T-2 and T-3 decisions. At minimum, confirm actor-scoped attempt identity, the two P0 activity types and whether the Contract 06 hint/next-step fields are in v1.0.0 (with the exact `recommendedNextStep.type` set if included). |
| **Aziz** | Record A-1 and A-2 decisions. At minimum, choose the source-free pin representation and the exact proposal status/code mapping; state whether source-free facilitator contexts are supported. |
| **All three** | Record the remaining ledger confirmations H-1/H-4/H-5, T-4/T-5, A-3/A-4/A-5 and X-1…X-4. No freeze can be declared on partial approval. |

### 7.2 Implementation dependencies after approval

- **H-3:** ED-05/ED-29 must implement a revision-specific FAISS resolver and metadata sidecar; the current adapter remains course-only.
- **T-1:** ED-29 must implement atomic actor-scoped receipts, unique `{userId, attemptId}` persistence and evidence idempotency. `compareAttempt` alone is not durability.
- **T-3:** ED-27/ED-29 must render and persist the approved hint/next-step semantics. If deferred, the UI gate remains open.
- **A-1/A-2:** ED-07/ED-09 must implement the source-free room state and proposal decision mapping; legacy `ROOM_STATE_SYNC` and `FacilitatorIntervention` remain unchanged until then.
- **All:** future producers must re-resolve current access and revision existence; schema validity is not authorization.

### 7.3 Other blocked work

- **M04-A.1 remains PASS for its implemented invitation-reliability scope.** **M04-A.2 remains PASS for its Python parity and synthetic migration-readiness scope.** **M04-A / ED-04 remains PARTIAL.**
- **M04-B** is blocked. It must not start while ED-26 is unfrozen.
- **ED-04 full enrollment**, course-scoped instructor permissions and institutional source grants are not implemented and remain blocked on this gate.
- The M04-A.2 production invitation-index migration remains a separate operational action requiring an approved dry run and `--apply`; no deployment database was contacted in M03-F.
- No ED-05 publication service, ED-06 ingestion, ED-27 renderer, ED-28 selector, ED-29 persistence, ED-07 room integration, ED-09 facilitator behavior, ED-17 LiveKit or ED-33 reward engine was implemented.

## 8. Preservation and mission-only change record

Mission-start state was captured in `reports/evidence/ednova-m03f-2026-10-23/mission-start-summary.txt`:

```text
branch=main
head=b4e75a41e2b9b30283bed78673c3a690ff4e70d5
porcelain_entries=248
staged_entries=0
tracked_modified=186
untracked_files=91
```

Preservation rules observed:

- no `git reset`, `git clean`, `git stash`, `git checkout`, `git restore`, discard or repository-wide formatting;
- no staging, commit, push, publication or deployment;
- no production MongoDB mutation or invitation-index change;
- no pre-existing tracked file was modified by this mission;
- generated HTTP adapters were byte-identical after `pnpm generate:contracts`;
- build artifacts were produced only in ignored output directories;
- the only mission additions are this report and the evidence logs in `reports/evidence/ednova-m03f-2026-10-23/`.

The tracked-modified count remains **186** and staged entries remain **0**. The only tracked-tree-visible addition is this report; the evidence logs are under `/reports/evidence/`, which is already ignored by `.gitignore`. The final mission-only file list is recorded in `reports/evidence/ednova-m03f-2026-10-23/mission-only-files.txt`.

## 9. Final gate

| Canonical acceptance condition | Result | Evidence |
|---|---|---|
| Genuine Habib/Tasnim/Aziz decisions for every blocking item, with identity, date, channel and version | **FAIL** | No approval record exists; all seven rows PENDING. |
| Cross-domain X-1…X-4 recorded | **FAIL** | Review package §7 and candidate ledger record **NONE**. |
| All blocking contradictions resolved in code/docs/fixtures/schema/tests | **FAIL** | C-02, C-03, C-04, C-05, C-06, C-10 and C-11 remain open. |
| Approved corrections implemented in both languages with parity and tests | **N/A** | No correction was approved; none applied. |
| Fresh validation after corrections | **PASS for the unchanged candidate** | 165 Python, 167 TypeScript, 6,899 parity cases, schema drift 0, build/typecheck/lint pass. |
| Freeze ledger updated without fabricated approval | **PASS for status recording only** | This report records PARTIAL/NOT FROZEN; no approval is claimed. |
| Official v1.0.0 freeze declared | **NO** | Gate remains open. |
| ED-26 promoted to complete | **NO** | Remains **PARTIAL**. |
| M04-B allowed to start | **NO** | Blocked until a genuine freeze. |

**Final decision: ED-26 remains PARTIAL. Candidate `1.0.0` is NOT FROZEN. M04-B is BLOCKED. No contract correction is authorized until genuine owner decisions are recorded.**

The next action belongs to Habib, Tasnim and Aziz: each must record explicit decisions for the seven rows above and the remaining ledger confirmations, with reviewer identity, date, channel and version. If the recommended H-3 change is approved, engineering must apply it to both validators, fixtures, schema, tests and docs in one pass and rerun the full parity gate before any freeze is requested.

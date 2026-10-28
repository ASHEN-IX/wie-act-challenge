# EdNova M03 / ED-26 cross-domain contract review package

**Status: REVIEW READY — ED-26 PARTIAL — v1.0.0 NOT FROZEN.** This package is an engineering self-review and decision request. It records no independent human approval. Habib, Tasnim and Aziz have not reviewed or approved the candidate, and no approval, comment, date, signature or meeting record has been invented.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`, 23 October 2026. The working tree was already dirty (235 changed/untracked paths); all existing changes were preserved. No staging, commit, push, publication or deployment was performed. M04/ED-04 was not started.

## 1. What is being reviewed

The candidate is the executable ED-26 v1.0.0 supplement for the versioned content, activity, attempt, evidence, room-activity, facilitator-proposal and private-help boundaries. It contains **21 contract roots**, one shared TypeScript validator/type boundary, one strict Pydantic mirror, one common golden-fixture corpus and one generated structural JSON Schema artifact.

| Artifact | Purpose | SHA-256 |
|---|---|---|
| [`docs/contracts/ednova-v1.md`](../docs/contracts/ednova-v1.md) | Candidate semantics, bounds, visibility and freeze ledger | `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877` |
| [`apps/api/shared/ednova/contracts.ts`](../apps/api/shared/ednova/contracts.ts) | Canonical TypeScript definitions and validators | `cc34e662333121fe4ce1b1ea0814f392a619f3781283609a51193193e0c4856b` |
| [`apps/ai/contracts/ednova.py`](../apps/ai/contracts/ednova.py) | Strict Pydantic mirror | `80817b3048908af6880050f3add2d2ad6c26843f98610d47d3d3086776d40903` |
| [`docs/contracts/ednova-v1-fixtures.json`](../docs/contracts/ednova-v1-fixtures.json) | Shared positive/negative acceptance corpus | `b28248c2dd7d25188902b9d6cd462cd061957fa9b6e9634bea91ed2931cbfbec` |
| [`docs/contracts/ednova-v1.schema.json`](../docs/contracts/ednova-v1.schema.json) | Generated structural export (drift-checked) | `e6fdcedd65fc5d073e80f81dee897a78fa329d02a400a90f8df206c6570fccb9` |
| [`apps/api/tests/shared/ednova-contracts.test.ts`](../apps/api/tests/shared/ednova-contracts.test.ts) | Golden, consumer and boundary tests | `1c3a2bc18576f9196d9a2a32b75323c921e3928ba4ef3ef721fe33c665d4983b` |
| [`apps/ai/tests/test_ednova_contracts.py`](../apps/ai/tests/test_ednova_contracts.py) | Golden, worker-compatibility and drift tests | `40439fc53333e7ac5dea8f77406fb4de952815feb91fe1336cbf4a02ae81ec00` |

The corpus now contains **161 fixtures: 51 positive and 110 negative**, covering all 21 roots. The fresh verification results and exact commands are in [the freeze verification report](EDNOVA-M03-FREEZE-VERIFICATION.md).

## 2. Decision summary

Every row below is an **open human decision**. "Recommended" is engineering advice, not an approval. A reviewer may accept, amend or reject it.

| ID | Owner | Decision requested | Engineering recommendation | Freeze-blocking |
|---|---|---|---|---|
| H-1 | Habib | Approve revision states (`draft \| published \| deprecated`), orthogonal `reviewStatus`, immutable publication and deprecated-without-implicit-revocation semantics. | Approve as documented. | Yes |
| H-2 | Habib | Choose the wire/storage representation of course revision identity. The data model uses Mongo `ObjectId` and a separate `revisionTag`; the candidate uses an opaque string `revisionId`. | Keep the wire value opaque and stable; persist a mapping to the internal `ObjectId`/`revisionTag`. Do not expose database representation. | Yes |
| H-3 | Habib | Choose the source-index reference shape. Candidate: `faiss/<courseId>/<revisionId>/` (directory-like). Data model/Contract 03 examples: `faiss/<courseId>/<revisionId>.index` (file). | Use the explicit `.index` file reference, matching two existing design sources; update the candidate fixture/docs if approved. | Yes |
| H-4 | Habib | Approve the future access-grant vocabulary `personal_owner \| active_enrollment \| assigned_instructor` and confirm M04 must revalidate it. | Approve as representational only. It grants nothing until a future owner resolves current access. | Yes |
| H-5 | Habib | Approve `UNPUBLISHED`, `UNAUTHORIZED`, `UNAVAILABLE`, `REVOKED`, `STALE_REVISION`, `UNSUPPORTED_VERSION` as resolution failures, never fabricated revision records, and no silent substitution of a newer revision. | Approve. | Yes |
| T-1 | Tasnim | Resolve attempt identity. Candidate: receipt identity `(authenticated userId, attemptId)`. Data model: globally unique `attemptId`. | Use compound unique `(userId, attemptId)` for receipt/DB identity, keep a non-unique lookup index on `attemptId`, and document the M10 migration. | Yes |
| T-2 | Tasnim | Confirm v1.0.0 supports only `InteractiveQuiz` and `GuidedProblem`. ADR-14 lists four core types; the other two have no renderer or P0 acceptance path. | Freeze the two P0 types in 1.0.0. `StepByStepVisualizer` and `ParameterExplorer` require a later reviewed version. | Yes |
| T-3 | Tasnim | Decide whether `AssessmentResult` must carry Contract 06's `socraticHint` and `recommendedNextStep`. The candidate omits both; it carries bounded feedback and `bloomLevelDemonstrated`. | Omit them from v1.0.0 and route next-step/help behaviour through ED-28/private help. If required, they are additive fields requiring a coordinated version decision before freeze. | Yes |
| T-4 | Tasnim | Approve persisted attempt states `in_progress \| submitted \| graded` versus transport states `pending \| rejected \| failed \| unavailable`, with no fabricated persisted `unavailable` record. | Approve the separation. | Yes |
| T-5 | Tasnim | Approve evidence semantics: explicit `masteryAchieved`, evaluator provenance (`REAL_APPROVED`, `MOCK_TEST`, `DETERMINISTIC_FALLBACK`), no inferred mastery, no XP amount in the contract. | Approve. | Yes |
| A-1 | Aziz | Resolve mandatory `pin` on `RoomActivityState` when `activity` is `null`. Current rooms may be source-free (`courseId` optional; roles document says source-free teams keep the active-membership flow). | Require `pin` only when a source/activity context exists, or restrict `ROOM_ACTIVITY_STATE` to course-backed rooms. Do not force a fake pin for source-free rooms. | Yes |
| A-2 | Aziz | Add a status/code invariant for `ProposalDecision`. Today `status: rejected` can carry `UNAVAILABLE`, and `stale` can carry any `Failure`. | Define an explicit mapping, e.g. `stale -> STALE_REVISION`; `unavailable -> UNAVAILABLE/REVOKED`; `rejected -> UNAUTHORIZED/UNSUPPORTED_VERSION/REVOKED`, and validate it in both languages. | Yes |
| A-3 | Aziz | Approve replacement of illustrative Contract 15 fields (`spokenResponseText`, `targetSpeakerId`, `reasoning`) with the candidate `messageText`/bounded strategy/room pin shape; legacy ED-09 stays unchanged. | Approve the candidate-only boundary; do not retrofit legacy messages. | Yes |
| A-4 | Aziz | Confirm the roster bound: candidate allows at most 10 members; runtime permits `maxParticipants` 2–10 with default 6. | Confirm 10 as the contract ceiling and 6 as the unchanged runtime default. This is not a contradiction. | No (confirm) |
| A-5 | Aziz | Approve private-help isolation: request has no client actor; response is `recipient_only` and bound to `userId`/`requestId`; unavailable responses carry no tutor text; private help cannot parse as room activity/completion. | Approve. | Yes |
| X-1 | All three | Approve exact `1.0.0` fail-closed versioning: unknown/missing version, field, type or component version is rejected; additive fields are not silently accepted by strict readers. | Approve the stated change-control rule. | Yes |
| X-2 | All three | Approve the public/private/server-only boundary and the rule that schema validity is not authorization. | Approve. | Yes |
| X-3 | All three | Approve the freeze procedure: all affected-owner decisions recorded, blocking contradictions resolved in code/docs/fixtures/schema/tests, validation rerun, then ledger updated. | Approve. | Yes |
| X-4 | All three | Confirm M04 may consume the candidate only after freeze and must not treat represented grants as implemented authority. | Approve; M04 remains blocked until freeze. | Yes |

## 3. Reviewer packets

### 3.1 Habib — content, source, revision and access

**Review scope:** `PublishedContext`, `EditorContext`, `AccessDecision`, `SourceResolution`, `GroundingContext`; revision lifecycle; provenance; source/index references; future institutional grants.

**Evidence to read:** candidate sections on projections and revision semantics; `docs/data-model.md` Course/CourseRevision and FAISS fields; Contract 03 examples; `docs/roles-and-permissions.md`; fixtures such as `authorized published context`, `editor draft reviewed`, `allowed current personal grant` and `server resolution`, with their negatives.

**Specific questions:**

1. **H-1:** Is `draft | published | deprecated` still the authoritative persisted vocabulary, with `reviewStatus` only candidate metadata?
2. **H-2:** May the wire `revisionId` remain an opaque string while persistence maps it to `ObjectId`/`revisionTag`? If not, which exact field is authoritative on the wire?
3. **H-3:** Is a source index a directory (`.../<revisionId>/`) or a file (`.../<revisionId>.index`)? Pick one; both existing examples currently disagree.
4. **H-4:** Are `personal_owner`, `active_enrollment` and `assigned_instructor` the intended future grant strings, and does M02 remain the sole implemented personal-owner predicate until M04?
5. **H-5:** Confirm that unpublished/revoked/stale/unavailable are failures, not revision states, and that a stale pin never silently advances.

**Recommended disposition:** approve H-1, H-4, H-5 as written; approve H-2 with an explicit wire/storage mapping note; choose H-3 and let engineering align the candidate, fixtures, schema and technical example in one change.

### 3.2 Tasnim — activity, attempt, result and evidence

**Review scope:** `ActivityDefinition`, `ServerEvaluationDefinition`, `AttemptSubmission`, `PrivateAttempt`, `AssessmentResult`, `AcceptedEvidence`, `EvidenceDecision`, `PublicCompletion`, `RewardReference`.

**Evidence to read:** candidate sections on activity bounds, attempt identity, result/evidence separation and reward boundaries; Contract 05/06/07 examples; `docs/data-model.md` activity/attempt/evidence indexes; ADR-14 and ADR-16; fixtures for both activities, retries, private results and evidence.

**Specific questions:**

1. **T-1:** Which identity is authoritative for idempotency: global `attemptId` uniqueness, or `(userId, attemptId)`? The candidate and data model currently disagree.
2. **T-2:** Does 1.0.0 freeze only `InteractiveQuiz` and `GuidedProblem`, with the other ADR-14 types deferred to a later version?
3. **T-3:** Are `socraticHint` and `recommendedNextStep` intentionally out of v1.0.0, or required fields that must be added before freeze?
4. **T-4:** Confirm transport states never create persisted `unavailable` attempts and that only the learning owner may create accepted evidence.
5. **T-5:** Confirm mastery is explicit, model-based evidence requires `REAL_APPROVED`, synthetic fixtures are `MOCK_TEST`, and no XP amount is client/model-authoritative.

**Recommended disposition:** approve T-2, T-4 and T-5; resolve T-1 in favour of actor-scoped identity with an M10 index change; defer T-3 fields unless Tasnim requires them now.

### 3.3 Aziz — rooms, facilitator and private help

**Review scope:** `RoomActivityState`, `SelectActivityCommand`, `FacilitatorContext`, `FacilitatorProposal`, `ProposalDecision`, `PrivateHelpRequest`, `PrivateHelp`.

**Evidence to read:** candidate sections on room state, presenter binding, proposal decisions and private help; Contract 15/16/18 examples; current room command/roster behavior; `docs/roles-and-permissions.md` source-free team rule; fixtures for room state, proposals and private help.

**Specific questions:**

1. **A-1:** How should a source-free room represent `ROOM_ACTIVITY_STATE`? Make `pin` nullable when no source/activity exists, or emit the event only for course-backed rooms.
2. **A-2:** Which status/code pairs are legal for `ProposalDecision`? Supply the exact mapping so both validators can enforce it.
3. **A-3:** Approve the `messageText`-based candidate and the deliberate omission of legacy `targetSpeakerId`/`reasoning` from the new boundary.
4. **A-4:** Confirm 10 as the maximum roster and 6 as the unchanged default.
5. **A-5:** Confirm private help remains recipient-only, has no client actor, and cannot cross-parse as public room state.

**Recommended disposition:** approve A-3, A-4, A-5; choose A-1 explicitly; provide A-2 mapping and let engineering add matching TS/Python checks and fixtures.

## 4. Contradiction register

Status meanings: **RESOLVED** means engineering aligned an implementation detail without changing approved semantics; **DOCUMENTED** means the candidate already states the resolution but an owner should confirm it; **OPEN** means a semantic choice remains.

| ID | Contradiction / inconsistency | Evidence | Impact if unresolved | Disposition | Owner |
|---|---|---|---|---|---|
| C-01 | Python `Time` used `\d`, which accepts Unicode decimal digits (for example Arabic-Indic `٢٠٢٦`), while JavaScript `\d` and the exported schema are ASCII-only. | Reproduced: Python accepted, TypeScript rejected. | TS/Python accept/reject divergence at the wire boundary. | **RESOLVED** — both validators now use `[0-9]`; negative fixture and tests added; schema regenerated. | Engineering |
| C-02 | Wire `revisionId` is an opaque string; persistence uses Mongo `ObjectId` and `revisionTag`. | Candidate `Pin`/`ActivityRef`; `docs/data-model.md` CourseRevision, attempts/evidence. | Ambiguous source/activity pin identity; unsafe joins across revisions. | **OPEN** — H-2. | Habib |
| C-03 | Source index is referenced as a directory in the candidate and as a `.index` file in the data model/Contract 03. | Candidate line on `faiss/<courseId>/<revisionId>/`; data model `vectorIndexRef`; Contract 03 example. | `SourceResolution` consumers may construct the wrong path. | **OPEN** — H-3. | Habib |
| C-04 | Attempt idempotency is actor-scoped in the candidate but globally unique in the data model. | Candidate attempt-receipt paragraph; data-model unique `{ attemptId: 1 }`. | Receipt collisions or cross-user denial/conflict semantics diverge at M10. | **OPEN** — T-1. | Tasnim |
| C-05 | ADR-14 lists four core activity types; the candidate freezes two P0 types. | ADR-14; candidate activity union. | Consumers may expect unsupported types in 1.0.0. | **OPEN** — T-2. | Tasnim |
| C-06 | Contract 06 illustrates `socraticHint` and `recommendedNextStep`; the candidate result omits them. | Contract 06; candidate `AssessmentResult`. | UI/next-step expectations are undefined for v1.0.0. | **OPEN** — T-3. | Tasnim |
| C-07 | Persisted attempt states are `in_progress/submitted/graded`; transport adds `pending/rejected/failed/unavailable`. | Candidate lifecycle paragraph; Contract 06 example. | Consumers may try to persist transport-only states. | **DOCUMENTED** — candidate separates them; confirm T-4. | Tasnim |
| C-08 | Contract 05 sample uses `att_...`; prose/data model require UUID v4. | Contract 05 sample; candidate UUID fixture. | Identifier format ambiguity. | **RESOLVED/DOCUMENTED** — prose and data model take precedence; candidate uses lowercase UUID v4. | Tasnim |
| C-09 | Contract 15 uses `spokenResponseText`; the existing Python facilitator uses `messageText`. | Contract 15; existing facilitator schema; candidate. | New boundary could break current producers/consumers. | **RESOLVED/DOCUMENTED** — candidate keeps `messageText`; legacy untouched; confirm A-3. | Aziz |
| C-10 | `RoomActivityState.pin` is mandatory even when `activity` is null, but source-free rooms exist. | Candidate room state; roles document source-free team flow; optional room `courseId`. | Source-free rooms cannot emit the future state without a fake pin. | **OPEN** — A-1. | Aziz |
| C-11 | `ProposalDecision` has no status/code invariant; `rejected` may carry `UNAVAILABLE`, `stale` may carry any failure. | Candidate `RejectedProposal`; analogous result/evidence validators do enforce mappings. | Ambiguous presenter/UI handling and weaker fail-closed behavior. | **OPEN** — A-2. | Aziz |
| C-12 | Candidate roster maximum is 10; runtime default is 6. | Candidate room state; room creation/command schemas allow 2–10, default 6. | Apparent mismatch only if default is mistaken for maximum. | **RESOLVED** — 10 is the ceiling, 6 remains the default; confirm A-4. | Aziz |
| C-13 | Published/deprecated revisions versus revoked/unpublished failures. | Candidate revision paragraph; data model target states. | Consumers may fabricate revision records for access failures. | **DOCUMENTED** — failures are never revision states; approve H-5. | Habib |
| C-14 | Exact versions and strict readers versus additive evolution. | Candidate versioning paragraph. | Optional fields may be silently dropped or break readers. | **DOCUMENTED** — exact 1.0.0, fail closed; approve X-1. | All |
| C-15 | Schema validity versus authorization. | Candidate ACL paragraphs; current M02 personal-owner predicate. | A valid payload could be mistaken for a grant. | **DOCUMENTED** — schema validity is not authorization; approve X-2/X-4. | All |

Open items are **C-02, C-03, C-04, C-05, C-06, C-10, C-11** plus confirmation of C-07/C-09/C-13/C-14/C-15. None was silently changed.

## 5. Actual modifications in this review pass

Only the parity defect and its evidence changed. No approved semantic field, status, bound or visibility rule was altered.

| File | Change |
|---|---|
| `apps/ai/contracts/ednova.py` | `valid_time` and the `Time` field pattern now use explicit ASCII `[0-9]` instead of Unicode-aware `\d`. |
| `apps/api/shared/ednova/contracts.ts` | Time regex now uses explicit `[0-9]`; behaviour for existing ASCII payloads is unchanged. |
| `docs/contracts/ednova-v1-fixtures.json` | Added negative fixture `non-ascii timestamp digits` with `publishedAt: "٢٠٢٦-10-23T12:00:00.000Z"`. |
| `apps/api/tests/shared/ednova-contracts.test.ts` | Added `timestamps require ascii digits`. |
| `apps/ai/tests/test_ednova_contracts.py` | Added `test_timestamps_require_ascii_digits`. |
| `docs/contracts/ednova-v1.schema.json` | Regenerated from the Python mirror; seven timestamp patterns now spell out `[0-9]`. |
| `docs/contracts/ednova-v1.md` | Clarifies ASCII digits and records the 161-fixture/review-package state in the ledger. |

The Python and TypeScript validators still enforce the same date semantics: exact 24-character millisecond UTC form, a real calendar date and a non-zero year. Conforming ASCII payloads are unaffected.

## 6. Verification summary

Fresh, post-change results (details and limitations in the [freeze verification report](EDNOVA-M03-FREEZE-VERIFICATION.md)):

| Check | Result |
|---|---|
| Shared fixtures | 161 total: 51 positive, 110 negative, 21 roots |
| TypeScript focused suite | 167 passed, 0 failed |
| Python focused suite | 165 passed, 0 failed |
| Differential mutation parity | 6,899 cases; 311 accepted by each side; 0 accept/reject mismatches; 0 value mismatches |
| Schema drift check | Exit 0 |
| `pnpm lint` | Exit 0; 0 errors, 120 existing warnings |
| `pnpm typecheck` | Exit 0 (API and web) |
| `pnpm build` | Exit 0 (API and production web build) |
| Full root `pnpm test` | **Not run** — Docker daemon unavailable and no local MongoDB/Redis test services; no fresh full-suite claim |

The 6,899-case harness is generated mutation evidence, not proof over all possible inputs. The golden corpus plus explicit negative tests remain the acceptance mechanism.

## 7. Recorded approval state

No reviewer decision exists in the repository or in this session. The following is the actual state, not a placeholder for an assumed approval.

| Reviewer / gate | Decision received | Date | Recorded channel | Notes |
|---|---|---|---|---|
| Habib — content and access | **NONE** | — | — | H-1 to H-5 open |
| Tasnim — learning and evidence | **NONE** | — | — | T-1 to T-5 open |
| Aziz — collaboration | **NONE** | — | — | A-1 to A-5 open |
| Cross-domain architecture agreement | **NONE** | — | — | X-1 to X-4 open |
| Official freeze approval | **NONE** | — | — | Freeze not requested from a human authority |

Engineering self-review verifies implementation and parity. It does **not** satisfy independent owner review.

## 8. Ready-to-send review requests

Send these in the team's existing project channel or direct message. Do not treat silence as approval. Replace the bracketed repository link with the shared checkout or review URL your team uses.

### 8.1 Habib — content and access

```text
Subject: ED-26 v1.0.0 review — content, revision and access decisions (H-1..H-5)

Hi Habib,

Please review the ED-26 v1.0.0 content/access candidate before we can request an official freeze. Engineering parity is green; your independent decision is still missing. Nothing has been frozen and M04 has not started.

Review package: reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md
Freeze evidence: reports/EDNOVA-M03-FREEZE-VERIFICATION.md
Candidate: docs/contracts/ednova-v1.md
Validator/fixtures: apps/api/shared/ednova/contracts.ts, apps/ai/contracts/ednova.py, docs/contracts/ednova-v1-fixtures.json

Decisions requested:
H-1 approve revision states draft/published/deprecated, reviewStatus as orthogonal metadata, immutable publication and deprecated-without-implicit-revocation.
H-2 choose revision identity representation: opaque wire revisionId mapped to internal ObjectId/revisionTag, or another explicit mapping.
H-3 choose source-index reference: directory faiss/<courseId>/<revisionId>/ or file faiss/<courseId>/<revisionId>.index.
H-4 approve the future grant vocabulary personal_owner/active_enrollment/assigned_instructor, with M02 remaining the only implemented source grant until M04.
H-5 approve UNPUBLISHED/UNAUTHORIZED/UNAVAILABLE/REVOKED/STALE_REVISION/UNSUPPORTED_VERSION as failures, not revision records, with no silent revision substitution.

For each item reply APPROVE, APPROVE WITH CONDITIONS (state them) or REJECT (state the replacement). If you delegate, name the delegate and scope in writing. Please also flag any content/access risk not listed.

Thanks.
```

### 8.2 Tasnim — learning and evidence

```text
Subject: ED-26 v1.0.0 review — activity, attempt and evidence decisions (T-1..T-5)

Hi Tasnim,

Please review the ED-26 v1.0.0 learning/evidence candidate before we can request an official freeze. Engineering parity is green; your independent decision is still missing. Nothing has been frozen and M04 has not started.

Review package: reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md
Freeze evidence: reports/EDNOVA-M03-FREEZE-VERIFICATION.md
Candidate: docs/contracts/ednova-v1.md
Fixtures: docs/contracts/ednova-v1-fixtures.json

Decisions requested:
T-1 resolve attempt identity: candidate uses (authenticated userId, attemptId); the data model says globally unique attemptId.
T-2 confirm 1.0.0 supports only InteractiveQuiz and GuidedProblem; StepByStepVisualizer/ParameterExplorer need a later reviewed version.
T-3 decide whether socraticHint and recommendedNextStep are required in AssessmentResult or intentionally deferred to ED-28/private help.
T-4 approve persisted in_progress/submitted/graded versus transport pending/rejected/failed/unavailable, with no fabricated persisted unavailable attempt.
T-5 approve explicit masteryAchieved, evaluator provenance REAL_APPROVED/MOCK_TEST/DETERMINISTIC_FALLBACK, and no XP amount in the contract.

For each item reply APPROVE, APPROVE WITH CONDITIONS (state them) or REJECT (state the replacement). If you delegate, name the delegate and scope in writing. Please also flag any learning/evidence risk not listed.

Thanks.
```

### 8.3 Aziz — collaboration

```text
Subject: ED-26 v1.0.0 review — room, facilitator and private-help decisions (A-1..A-5)

Hi Aziz,

Please review the ED-26 v1.0.0 collaboration candidate before we can request an official freeze. Engineering parity is green; your independent decision is still missing. Nothing has been frozen and M04 has not started.

Review package: reports/EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md
Freeze evidence: reports/EDNOVA-M03-FREEZE-VERIFICATION.md
Candidate: docs/contracts/ednova-v1.md
Fixtures: docs/contracts/ednova-v1-fixtures.json

Decisions requested:
A-1 resolve mandatory pin on RoomActivityState when activity is null and the room is source-free: nullable pin only when no source/activity exists, or emit the event only for course-backed rooms.
A-2 supply the exact ProposalDecision status/code mapping (rejected/stale/unavailable) so both validators can enforce it.
A-3 approve messageText and the deliberate omission of legacy targetSpeakerId/reasoning from the new boundary; legacy ED-09 stays unchanged.
A-4 confirm 10 as the roster ceiling and 6 as the unchanged runtime default.
A-5 approve private help as recipient-only with no client actor, no tutor text when unavailable, and no cross-parse as public room state.

For each item reply APPROVE, APPROVE WITH CONDITIONS (state them) or REJECT (state the replacement). If you delegate, name the delegate and scope in writing. Please also flag any collaboration/privacy risk not listed.

Thanks.
```

### 8.4 Joint cross-domain thread

```text
Subject: ED-26 v1.0.0 joint decisions X-1..X-4 and freeze gate

Hi Habib, Tasnim and Aziz,

After your individual reviews, please confirm the four cross-domain decisions:

X-1 exact 1.0.0 fail-closed versioning; unknown/missing version, field, type or component version is rejected; additive fields are not silently accepted by strict readers.
X-2 the public/private/server-only boundary is approved, and schema validity is explicitly not authorization.
X-3 the freeze procedure is approved: all affected-owner decisions recorded, blocking contradictions resolved in code/docs/fixtures/schema/tests, validation rerun, ledger updated.
X-4 M04 may consume the candidate only after freeze and must not treat represented grants as implemented authority.

Please reply with APPROVE / APPROVE WITH CONDITIONS / REJECT for each, plus any cross-domain condition. A freeze will not be declared on silence or on engineering self-review.

Thanks.
```

## 9. Freeze exit checklist

The ledger may change to FROZEN only when all of the following are true and recorded:

- [ ] Habib, Tasnim and Aziz have each recorded a decision for every blocking item, with reviewer identity, date and channel.
- [ ] Cross-domain decisions X-1 to X-4 are recorded.
- [ ] Every blocking contradiction in section 4 has an approved disposition.
- [ ] Any approved change is applied together to TS definitions, Python mirrors, golden fixtures, exported schema and documentation.
- [ ] Focused TS/Python tests, schema drift, lint, typecheck and build pass after the final change.
- [ ] The broad test gate required by the project is run in an environment with its MongoDB/Redis dependencies, or its absence is explicitly accepted as a freeze condition.
- [ ] `docs/contracts/ednova-v1.md` records the actual approvals and the official freeze decision.
- [ ] No approval is inferred from automated tests, silence or engineering self-review.

Until then: **ED-26 PARTIAL, v1.0.0 NOT FROZEN.**

## 10. M04 readiness preflight

M04/ED-04 has **not started**. A current-source search of `apps/api` and `apps/web/src` found no `Institution`, `InstitutionMembership` or `CourseEnrollment` implementation. ED-04.1–ED-04.3 remain ABSENT in the acceptance matrix. The existing user model has global student/admin identity; course access is still the M02 personal-owner predicate.

M04 is **not ready to start** until the M03 freeze gate closes. Its first design work must resolve, with Habib and the security/architecture owners:

1. institution tenancy and membership model, including multi-institution users;
2. course enrollment versus institution membership versus room invitation;
3. assigned-instructor and university-administrator grants without global-admin leakage;
4. revocation semantics for active sessions, streams, cached content and private results;
5. source-free team rooms remaining on the current active-membership flow;
6. the exact mapping from candidate grant strings to persisted authorization records.

No M04 code, schema, route or migration was created.

## 11. Bottom line

- Engineering implementation and TS/Python parity: **VERIFIED** for the recorded corpus.
- Parity defect found and fixed: **Unicode digits in timestamps**.
- Human decisions: **PENDING** for Habib, Tasnim, Aziz and the joint cross-domain gate.
- ED-26: **PARTIAL**.
- v1.0.0: **NOT FROZEN**.
- M04/ED-04: **NOT STARTED, BLOCKED BY THE M03 FREEZE GATE**.

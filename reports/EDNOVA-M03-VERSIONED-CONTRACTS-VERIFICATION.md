# EdNova M03 versioned contracts verification — 23 October 2026

**Implementation and automated parity: VERIFIED. M03/ED-26: PARTIAL, ready for affected-owner review; NOT OFFICIALLY FROZEN.** Habib, Tasnim and Aziz have not approved this candidate. M04 has not started. No external inference, new service/API, institutional grant, staging, commit, push, publication or deployment occurred.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. M01 and M02 are completed prerequisites. Mission attribution uses the existing dirty tree, not HEAD. Backlog, team plan, ADRs, technical contracts, target architecture, product/roles/data/testing/development/cleanup documents, M00 matrix/gates, M01/M02 and relevant ED-07 evidence were inspected, along with actual shared/module/worker/web schemas. Applicable web AGENTS and installed Next Vitest/fetch guides were read before web edits. Dates use Africa/Tunis.

## A. Initial interface inventory

The existing generated HTTP modules describe routes, not executable DTO schemas. Current private/source/room boundaries already have owning runtime validation; most new activity/publication/evidence contracts exist only as illustrative documentation. There is no CourseRevision service, new activity registry, activity-attempt store or accepted-evidence API to integrate or claim complete.

| Existing interface / canonical definition and runtime validation | Owner / actual producer → consumer | Transport / serialization / version | Authorization and visibility | Existing tests / compatibility finding |
|---|---|---|---|---|
| `shared/domainContracts.ts`, `src/domain-definitions.ts`, `framework/contracts.ts`, generated `framework/domains/*.module.ts` | Owning Nest domains → generated controllers/DomainService | HTTP JSON and in-process module dispatch; route definitions unversioned | SessionGuard/actor context and owning handlers; DTO privacy remains handler-owned | Route/architecture/internal dispatch tests; generator does not validate illustrative ED-26 bodies |
| `shared/moduleClient.ts`, `shared/operationPolicy.ts` | Authenticated domain caller → owning handler | `module://` in process; HTTP-compatible request/result projections | M02 current personal source ownership and actor/resource checks; internal is not blanket authority | Existing M02 real Nest/Mongo tests retained; no new future endpoint is registered |
| `shared/ai-messaging/{envelope,payloadSchemas}.ts`, Python `messaging/envelope.py`, `workers/schemas.py` | Node publisher → Python workers → Node result consumer | RabbitMQ JSON `version: "1"`; per-type payloads | Service transport, stored job actor/correlation and current source scope; private results | Existing envelope/payload/publisher/worker tests; mirrored validators exist and are reused unchanged |
| Study Course models/routes and `services/resourceAccess.ts` | Study owner handler → current web, modules and AI projection | Existing JSON and authenticated downloads; no immutable publication schema | Current personal owner only; invitations/admin do not grant another learner's source | M02 source/static/AI/revocation tests; target Contract 03 endpoint is absent |
| AI `AiJob`, `objectiveContext`, `jobAccess`, `jobResultConsumer`, `evalResultStore` | Node orchestration / Python result → owning private poll/evidence adapter | Current HTTP JSON, broker v1 and Mongo models | Actor/resource scope, immutable callback binding, first terminal result and recipient isolation | Existing private jobs/callback/replay regressions; these are not ED-29 activity attempts |
| Study `StudyRoom`, `routes/rooms.ts`, `services/roomCommands.ts`; notification realtime | Study → current web reducer and WS clients | Existing `ROOM_STATE_SYNC`, command IDs and durable seq; no new version field retrofitted | Current membership, source, presenter and delivery checks; explicit public projection | Existing replay/security/presence/peer regressions; active activity integration still unavailable |
| Notification peerText/SessionChat and presence messages | Accepted peer sender/gateway → current authorized room viewers | Peer stream seq; independent ephemeral presenceEpoch/version | Public text only; private records and credentials excluded | Existing real room regression suites; counters/receipts stay separate |
| Python `agents/facilitator/schemas.py` and existing ED-09 fixtures | Existing Python facilitator proposal → Node ED-09 baseline | Existing Pydantic/HTTP JSON, unversioned proposal | Proposals remain untrusted; current legacy schemas are more permissive than the new candidate | Existing seven real deterministic ED-09 tests preserved; no retrofit of new fields into live behavior |
| Web `src/lib/api.ts`, collaboration actions/types/reducer | Current Nest JSON → Next server API consumers and room components | HTTP JSON, generic TS cast, existing room reducer checks | Session cookie server-side, no-store; private result flow distinct from room events | Existing web tests; generic `api<T>` was compile-time typing, not runtime DTO validation |
| Technical Contracts 03–07 / 15–18 examples | Proposed content/learning/collaboration interfaces | Intended HTTP/internal/private AI JSON; mostly no executable version checks | Target visibility/enrollment/revision assumptions, not current grants | Missing bounded executable activity/source/attempt/evidence set; schema-only mission required |

This inventory records definition, runtime schema, producer, consumer, transport/serialization, version, actor assumptions, visibility, tests and missing behavior for each group. The complete candidate field/ownership inventory is in [the candidate specification](../docs/contracts/ednova-v1.md).

Initial conflicts resolved explicitly in the candidate: Contract 05 prose and target model require UUID v4 but its sample uses `att_...`; existing Python facilitator uses `messageText` while the illustrative Contract 15 uses spokenResponseText; Contract 03 mixes learner context with server vector-index metadata; target revision states are draft/published/deprecated, while reviewed-candidate and revocation semantics are orthogonal. Existing live formats were not silently rewritten to match examples.

## B. Canonical design and cross-domain matrix

[Shared TypeScript contracts](../apps/api/shared/ednova/contracts.ts) are the shared definition/type boundary; inferred types avoid separate handwritten web DTOs. [Pydantic mirrors](../apps/ai/contracts/ednova.py) follow the existing envelope/Bloom architecture. [Golden fixtures](../docs/contracts/ednova-v1-fixtures.json) are one common acceptance corpus. [Structural JSON Schema export](../docs/contracts/ednova-v1.schema.json) is generated with Pydantic's built-in schema export and checked for drift. It is not another handwritten implementation, schema service or code-generation framework. Relationship checks and ACL remain mandatory beyond structural JSON Schema.

| Contract roots (21 total) | Owner / future producer | Consumers | Verified boundary and parity |
|---|---|---|---|
| PublishedContext, EditorContext, AccessDecision, SourceResolution, GroundingContext | Content / future Study revision/access resolver | Learning, rooms, Studio, private AI transport | Current scalar bounds, full course/revision/hash pin, allowed documents/hash/objective and server index isolation; same fixtures pass TS/Python |
| ActivityDefinition, ServerEvaluationDefinition | Learning / future canonical activity owner | Studio preview, solo, rooms; server evaluator separately | Exact InteractiveQuiz/GuidedProblem and component/schema 1.0.0; bounded data; public and grading fields cannot cross-parse |
| AttemptSubmission, PrivateAttempt, AssessmentResult | Learning / client claim then future authoritative Nest owner | Recipient-only client and future evaluator | Server-derived actor, lowercase UUID v4, full activity/source pin, bounded answers, lifecycle/recovery distinctions and recipient helper |
| AcceptedEvidence, EvidenceDecision, PublicCompletion, RewardReference | Learning evidence approval, Collaboration disclosure, existing reward owner | Progress, room aggregate and eventual reward service | Submission/result/accepted evidence/disclosure/award remain distinct; no private learner data in aggregate completion |
| RoomActivityState, SelectActivityCommand | Collaboration / future owning room activity integration | Room clients and presenter command path | Room/source/activity binding, presenter in unique bounded roster, safe sequence/count checks; no change to current room model or transport |
| FacilitatorContext, FacilitatorProposal, ProposalDecision | Nest public context → Python untrusted proposal → future Nest decision | Private AI transport and presenter validation | Bounded public input, exact strategies/actions, room seq/pin relationship and explicit proposed/validated/accepted/rejected/stale/unavailable |
| PrivateHelpRequest, PrivateHelp | Future Learning/Collaboration private help owner | Authenticated recipient only | No client actor; recipient response bound to user; public event rejects the private body |

All future producers/consumers above remain future services. New executable consumers are the existing domain-handler-compatible input helper, optional Next API decoder, browser-safe public decoders, Pydantic parser and test harnesses. No production endpoint, activity selection, renderer, evaluator or grant service was added.

The [candidate design](../docs/contracts/ednova-v1.md) specifies required fields, nullable fields, bounds, error/status vocabulary, idempotency, revision states and visibility for every group. All root versions are exact 1.0.0. Unknown properties/versions/types fail closed rather than stripping data. A strict reader cannot automatically accept an additive field; changes require coordinated reviewed version support. Existing broker version 1, unversioned room events and receipts are retained unchanged. No speculative migration is implemented.

Source pin comparison includes courseId, revisionId and contentHash. Activity pin adds activityId/activityRevision/type. Document membership and document hash plus objective membership are checked against a supplied validated published context; that context must first be resolved and authorized by the future owner. The parser does not prove a course exists or a learner is enrolled. Candidate future enrollment grant strings do not change M02's actual personal-owner predicate.

`draft | published | deprecated` preserves target model vocabulary. Review status marks a reviewed draft candidate without inventing another persisted revision status. Deprecated immutable revisions may remain pinned subject to access; revoked/unpublished/stale/unavailable are access/resolution failures, not replacement revision states. No published-context endpoint or CourseRevision persistence is claimed.

Attempt retry classification is pure: identical scoped payloads match, changed content conflicts, new IDs are new submissions. ED-29 must persist actor-scoped receipts and enforce concurrency/lost ACK/restart behavior. Neither identical fixture parsing nor compareAttempt proves durable acceptance. Existing room-command receipts are not reused. Accepted evidence retains evaluator/validation provenance; model-based acceptance requires REAL_APPROVED metadata but parsing cannot prove such a call happened. Synthetic deterministic fixture evidence is MOCK_TEST and never written or awarded. RewardReference links identities and the existing xp:user:evidence key without creating a reward engine.

## C. Implemented consumers and compatibility

- `apps/api/shared/ednova/boundary.ts`: future handler input helper reads authenticated actor from DomainRequest, rejects client authoritative fields and parses only AttemptSubmission. It does not bypass owning source ACL. Test-only in-memory routes exercise the existing createContracts adapter; no production route is registered.
- `apps/web/src/lib/api.ts`: optional decoder validates response JSON before returning it. Existing callers without a decoder retain their behavior, cookie propagation and no-store fetch. Decoder failures become sanitized 502 ApiError, never rejected private data. Public decoder helpers import the shared definitions; they do not copy DTO schemas or create missing API calls.
- `apps/web/src/lib/activity-contracts.ts`: public activity/room-state decoding for later consumers. No component, UI or current room reducer is changed.
- `apps/ai/contracts/ednova.py`: strict Pydantic mirrored JSON/recipient/relationship validation. Existing worker models and actual broker envelopes are exercised separately, not replaced or relaxed. The export script writes schema data only, not executable application code.

Current HTTP/internal Nest source checks, generated adapters, Python planner cache isolation, provider states, room commands/presenter, presence ordering and peer-text runtime are byte-for-byte preserved. A future versioned ROOM_ACTIVITY_STATE is a reserved candidate DTO, not a newly emitted live event. It does not alter current ROOM_STATE_SYNC, message sequence or presence version behavior. Current room integration regressions still run against real runtime paths.

## D. Fixtures, security and negative tests

**160 common fixtures (51 positive, 109 negative) cover all 21 contract roots.** Both validators pass the same positive/negative corpus and valid JSON round trips. Tests cover authorized/unavailable/unpublished/unauthorized/revoked/stale/version-denied context, reviewed draft and immutable published/deprecated context, both P0 activities and private response shapes, attempts/retries/conflicts, private feedback, accepted/rejected/unavailable evidence, aggregate completion, room activity/commands, proposals and private help.

Negative fixtures reject unknown/missing versions on every root, unknown fields on every root, unsupported component/type, answerKey/rubric/script fields, client actor/grade/evidence flags, invalid timestamps, bad score, bool/string number coercion, duplicate options, oversized text/options/whole JSON, invalid Unicode, source/document/hash/objective mismatches, wrong answer type/option, private evidence in room state, private answers in completion, guessed recipient, stale room/proposal sequence, invalid presenter/tally, arbitrary model commands and index traversal. JSON integral decimals and Unicode scalar length have shared positive cases. Relational helpers are tested as such; structural validity alone is not called authorization.

Security review found no new secret values, key forwarding, executable markup/code evaluation, model code generation, enrollment shortcut, accepted-result write or public private-data projection. Separate schemas enforce field boundaries; plain text can still semantically contain sensitive information if an upstream owner deliberately misprojects it, so owning-domain minimization/review remains necessary. Source ACL and private recipient lookup must be current at delivery; shape validation is not a substitute.

Existing messaging compatibility tests parse real current job/result envelope shapes and SearchRequest on both languages, and reject an invented evidence-award job type. There is no new broker route. Web tests execute the actual API response decoder with mocked fetch/identity, assert no-store/cookie behavior and sanitized failures, and parse both activity types/pinned room state. In-memory domain adapter tests derive actor and reject forged fields. Existing actual Nest/internal/Mongo/WS source and room suites execute through root tests. These scopes are distinct: no fake test endpoint is reported as a deployed API.

## E. Exact verification and regression evidence

Exact argv, cwd, durations, exits and retained failures are in the ignored [command ledger](evidence/ednova-m03-2026-10-23/command-ledger.json), with corresponding `.command.json` and `.log`. Commands below run from repository root unless the argv explicitly uses headless bwrap to chdir `apps/ai`. Node 24.20.0/pnpm 11.3.0 and the existing fully locked Python 3.12.15 environment are reused; manifests/locks are unchanged.

| Command / gate | Actual final result | Evidence stem |
|---|---|---|
| Baseline `pnpm lint`, `pnpm typecheck`, `pnpm test` before source changes | All exit 0; original M02 baseline reproduced | baseline-lint/types/tests |
| `pnpm lint` | Exit 0; zero errors, 120 existing warnings | final-lint-date |
| `pnpm typecheck` | Exit 0; API and web strict checks | final-strict |
| `pnpm test` | Exit 0: routes 6; Jest 56 suites / 687 tests; Node unit 10; real integration 109; auth 17; web 33 | final-tests |
| `pnpm build` | Exit 0; actual API and production Next builds | final-build |
| `pnpm generate:contracts` | Exit 0; generated HTTP domain modules unchanged against mission-start hashes | final-generation |
| `pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand` | Exit 0; 165 passes including common fixtures and consumer/serialization cases | final-ts-date |
| `pnpm --filter web test` | Exit 0; existing 29 plus four API/public decoding tests | web-contracts; final-tests |
| Locked Python `-m pytest apps/ai/tests/test_ednova_contracts.py -q` | Exit 0; 163 passes (160 fixtures plus coverage, worker compatibility and artifact drift checks) | final-python-date |
| `env PYTHONPATH=apps/ai <locked-python> -m contracts.export_ednova_schema --check` | Exit 0; deterministic structural export has no drift | schema-export-check |
| Full locked Python `pytest -q -ra` with existing M01 headless/offline provider socket guard | Exit 0; 989 passed, five existing skips, 59 warnings | python-full |
| `git diff --check` | Exit 0 | final-diff-check |

The 109 real Node integration tests retain 81 ED-07, seven deterministic ED-09 and 21 M02 tests; they cover actual identity, HTTP/internal, Mongo, WS, source revocation, durable replay, presence and peer text. Focused counts overlap the root/full totals, not additional independent coverage. Full Python includes existing worker/schema/model tests without new skips or collection exclusions. The same five manual tests require the seeded scheduler course or absent test PDFs; no change reclassifies them as passes. Headless verification hides camera/GPU devices and blocks external provider sockets, permitting loopback fixtures and existing offline model assets. No external inference occurred.

A final review aligned the TS/Python rejection of year-zero timestamps, with explicit assertions on both sides. The final Python-only timestamp/export annotation adjustment was followed by the complete 163 contract checks; it changes no existing service behavior. The final TypeScript-only test fixture typing repair was followed by strict checks and all 165 focused tests. Existing broad root/full results are reported with their actual command order in the ledger.

**Not rerun by M03:** broad browser suites, container builds/health, GPU/media, real broker round trip and approved inference. No current room/UI wire shape or default API request behavior changed, so unit/runtime decoder and existing real API/room regressions are the applicable checks. No dependencies, Dockerfiles, provider/worker transport, cache/service entrypoints or existing AI runtime were modified. M02's container/browser/transport evidence remains historical evidence, not a fresh M03 execution. Remote GitHub Actions was not run. No full future publication/activity/evidence service integration is claimed from fixtures or compilation.

### Failed attempts

The first Python consumer fixture imported a nonexistent generic worker validator; it was corrected to the actual SearchRequest used by the worker, then the whole fixture suite passed. Initial lint rejected one unused new helper; it was removed without disabling a rule. API strict checking rejected sending an unknown-typed fixture through supertest; the test now parses it into the actual typed submission before transport. Strict checks and focused tests pass after that repair. Early fixture counts were 152 and later expanded to 160; final counts above are from actual final runs. All failed command records remain failures in the ledger.

## F. Files and preservation

Canonical additions: shared TS definitions and actor input helper; Python Pydantic mirror/package and JSON Schema export script; candidate specification, common fixture JSON and exported schema JSON. Test additions: API golden/consumer tests, Python golden/export/worker tests and web public/API decoder tests. Web public decoders are the only new application-facing helper; the existing API gateway gains an optional decoder. Existing documentation edits are the technical-contract supplement, backlog and current matrix/gates.

Final mission manifest and cleanup are recorded below. Existing user changes are attributed only through mission-start hashes; earlier M01/M02/ED-07 implementations and reports are not attributed to M03.

## G. Review and freeze status

| Gate | Status |
|---|---|
| Canonical bounded implementation | VERIFIED |
| Automated TS/Python golden parity and schema artifact drift | VERIFIED |
| Serialization, negative visibility and consumer checks | VERIFIED |
| Required local lint/strict/test/build and current isolation regressions | VERIFIED |
| Engineering self-review | Performed in this mission; not independent owner approval |
| Habib content/access review | PENDING |
| Tasnim activity/attempt/evidence/reward review | PENDING |
| Aziz room/facilitator/privacy review | PENDING |
| Cross-domain architecture agreement | PENDING |
| Official freeze | NOT FROZEN |

The actual backlog and team plan require all affected owners to review. No tool was used to contact others and no approval was fabricated. This is an explicit acceptance dependency, not an implementation failure or a request to authorize reversible work. The concrete candidate, fixture corpus and review ledger are ready for that review. ED-26 is PARTIAL rather than DONE.

## H. Remaining implementation dependencies and decision

ED-04 must implement real membership/enrollment; ED-05/ED-30 immutable publication and draft APIs; ED-27 the trusted renderer; ED-28 selection; ED-29 private attempt persistence/evaluation/evidence; ED-07 shared activity integration; ED-09 presenter-controlled facilitator proposals; ED-18 private help; ED-33 actual evidence-based awards. These operations remain absent or separately partial; no schema makes them complete. Unchanged M02 current personal grant decisions continue to enforce access.

**Decision: technical implementation/parity VERIFIED; M03/ED-26 PARTIAL pending actual owner review and freeze.** Exactly one next roadmap mission is **M04 — institutional membership and enrollment (ED-04)**, subject to that contract-review gate. M04 has not started.


The [mission manifest](evidence/ednova-m03-2026-10-23/working-tree.json) fingerprints **2,191 mission-start files: 2,186 preserved byte-for-byte, five deliberately changed, zero missing**. There are **13 new Git-eligible files**, including this report; exact paths and hashes are in the manifest. Existing changed files are only the optional web API decoder, technical-contract supplement, backlog, current acceptance matrix and mission gates. The [mission-only patch](evidence/ednova-m03-2026-10-23/mission-change.patch) compares mission-start copies, not HEAD; the original dirty patch is retained separately. Earlier M01/M02/ED-07 reports/evidence, all generated HTTP adapters, existing API/auth/source/room/AI runtime, Python worker/provider/cache code, manifests, locks and CI/deployment are preserved.

Only `ednova_m03_python_full` required final synthetic database removal; the [cleanup inventory](evidence/ednova-m03-2026-10-23/database-cleanup.json) confirms no M03 database remains. Dedicated test Mongo/Mailpit are stopped, restoring their initial state. No unrelated container/database/cache was removed. Authored contracts/fixtures/schema/report remain Git-eligible; raw logs, scripts, manifests and patch stay under ignored `reports/evidence/ednova-m03-2026-10-23/`. Staging is empty and HEAD is unchanged.

**Final state: ready for concrete domain-owner review, not officially frozen.** The only remaining M03 acceptance gate is actual affected-owner/cross-domain review and resolution of any resulting changes, followed by official freeze. No M04 work has begun.

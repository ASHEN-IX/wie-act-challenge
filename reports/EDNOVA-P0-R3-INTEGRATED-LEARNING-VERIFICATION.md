# EdNova P0-R3 — integrated learning verification

24 October 2026, Africa/Tunis. Evidence timestamps use UTC.

## A. Executive summary

**P0-R3 engineering: PASS for the locally verified deterministic/offline scope.** Implementation connects institutional setup, instructor source preparation and reviewed publication, solo learning, canonical shared activities, private checks and debrief. All five required integrated browser journeys and eight auth/workspace smoke tests complete successfully.

The supported mode is explicitly provisional and deterministic/offline. Actual local Next, Nest, Better Auth cookie sessions, Mongo, RabbitMQ ingestion worker, FastAPI and persisted FAISS artifacts are exercised. The browser source is a real synthetic **plain-text document**, with a deterministic test embedding fixture and `MOCK_TEST` tutor execution. No approved external model call, paid inference or model download was performed. Quotation-completion candidates do not certify conceptual diagnostic quality.

Evidence: [mission directory](evidence/ednova-p0-r3/), [real browser harness](../apps/web/e2e/p0r3-integrated-learning.test.ts), [domain integration](../apps/api/tests/integration/p0r3-learning-rooms.node.test.ts), [operator procedure](../docs/runbooks/ednova-integrated-learning.md). No deployment, production database operation or M24–M38 work was undertaken.

## B. Finding closure

| Finding | Before → implemented behavior | Principal implementation and verification |
|---|---|---|
| F13 | Registration used `activity_records` while room commands read `learning_activities`. Both room paths now resolve the existing canonical ActivityRecord, reviewed publication snapshot, exact revision/source artifact and full activity pin. | `services/roomActivity.ts`, `roomCommands.ts`, `activityResolution.ts`, `routes/rooms.ts`, `StudyRoom.ts`, notification `realtime.ts`; real Mongo/domain checks and two-browser selection/reconnect. |
| F14 | Tutor, objective selection, solo renderer, evidence progress and private room feedback were disconnected. New authenticated learner workspace and room panel connect actual APIs, source links, stable submissions, owned history, nonadaptive selection, private checks and debrief. | `services/learningJourney.ts`, `roomLearning.ts`, `routes/learning.ts`; web `features/learning/learning-workspace.tsx`, `journey-actions.ts`, `activity-renderer.tsx`, collaboration `room-learning-panel.tsx`; domain and browser assertions. |

**F13: FIXED for the tested canonical shared-activity boundary. F14: FIXED for the integrated supported deterministic/offline journeys; full adaptive/model-quality acceptance remains PARTIAL.** Full canonical adaptive/provider acceptance is separate: reviewed difficulty metadata, an approved ability policy and authorized real inference are absent. No new adaptive wire enum or owner approval was invented.

Runtime selection no longer reads `learning_activities`. Legacy records are retained. The runbook specifies authorized inventory/backup, provenance review, canonical instructor registration, a new reviewed revision, explicit reference mapping and repeatable verification. No legacy production inventory or migration was run.

## C. Instructor flow

The Institutions interface connects actual institution creation, invitations, Profile acceptance, instructor assignment and learner enrollment. Membership alone does not confer publication authority. Course upload can select an authorized institutional context.

Studio uploads a real original, refreshes actual worker ingestion status/draft, supports objective review/editing and explicitly saves the changed revision. Unsaved edits disable source generation/publication. Preparation calls the exact revision readiness operation; the interface exposes verified passage selection and both supported candidate types. Candidate title/instructions can be edited; the instructor separately reviews the private evaluation and confirms review before explicit registration. Preview uses the public definition. Publish displays success and an immutable learner link only after the committed server acknowledgement.

Missing sources/index, unavailable processing, stale draft/version and server conflicts remain visible errors. Upload acknowledgement is not indexing success. With the actual worker stopped, a second UI upload stays processing and publication remains disabled. Candidate generation remains a bounded deterministic quotation task requiring review, not an approved general conceptual generator.

`courseStudio.ts` validates the requested chunk against the actual artifact. The new Studio context checks current author access before returning private authoring data. Learner activity projections exclude the evaluation key. The browser checks metadata-administrator publication denial and unauthorized course access.

## D. Solo learner flow

Authorized discovery now includes enrolled institutional courses, followed by the existing current access boundary. **Open published learning** supports an exact immutable revision URL. Published catalogue entries resolve canonical reviewed definitions; unknown or revoked revisions do not silently advance.

The selector filters the exact objective and supported type, prefers a record without accepted evidence, then uses stable activity ID order. It returns an honest empty state when no reviewed record qualifies. It labels selection nonadaptive and records missing reviewed difficulty/adaptive policy. The provisional diagnostic presents 2–4 existing reviewed checks, without assigning an ability level or inferring weakness from completion.

The trusted quiz and GuidedProblem renderers submit to the existing receipt-first API. A submission retains its UUID, answers and elapsed time across an uncertain response. Conflicting reuse returns 409. Unavailable evaluation retains truthful status and does not grant mastery. Owned receipt history and progress are reloaded through authenticated server operations. Progress matches accepted mastery evidence to the exact current activity pin; submission count and public completion flags are insufficient.

Tutor requests traverse Nest → actual local Python. The UI shows execution mode, answer and authenticated immutable source links. The browser downloads a returned citation and compares the original bytes. Unavailable Python yields an explicit unavailable result. GroundingContext, FAISS paths, retrieved service evidence and evaluation keys are excluded from learner projection.

## E. Study Together

The existing ED-07 lifecycle, presenter, monotonic sequence, command receipts, presence and peer text remain authoritative. Selecting a reviewed activity stores its complete source/activity pin and a new round in the same sequence-checked room command. Reconnect snapshots carry course, exact revision, pin and round. Both participants render the same public definition.

Private checks are recipient/room/round scoped. The server persists a stable check identity and its own attempt UUID with a unique index and journaled writes. Callers supply only answers/time, not recipient, attempt identity or a replacement activity. Results use canonical submission/retrieval and current room/source checks. Eight concurrent assignment requests resolve to one check/UUID. Refresh recovers the owner's result.

The deterministic peer-first proposal reads public participation only, invites peer explanation and explicitly disclaims misconception diagnosis. It persists presenter, expected sequence, pin, expiry and a server command UUID. The presenter accepts/declines; arbitrary model/client command fields are rejected. Acceptance passes through the existing durable command processor. A changed presenter, stale sequence or revoked grant prevents mutation. Accepted replay uses the stored receipt.

Debrief exposes public completion counts and an owned private check/result. Grade aggregates are suppressed for every group size pending an approved disclosure threshold. Public room messages do not contain answer payloads, keys, private grades or tutor outputs. Source-free rooms retain peer-first functionality and cannot activate a source-backed activity without a permitted published context.

## F. Authorization and privacy

Actor identity comes from Better Auth; new operations reuse Study resource access. Current course, institution, enrollment, room membership and presenter authority are enforced. The legacy facilitator path now validates a bounded response, rechecks active access after delayed AI work and conditions changes on current room sequence/membership. Held-response domain tests revoke membership before delivery and verify denial; malformed extra output returns unavailable.

Actual-session negative tests cover unknown/foreign activity scope, invalid pins, unsupported type, peer check/result HTTP access, hostile WebSocket requests, peer browser navigation, presenter changes, enrollment removal and institutional suspension. Source-free rooms carrying a forged revision are rejected without creating a room. Delayed/private retrieval does not use a raw legacy result bypass: canonical owned result access is revalidated.

The room browser captures actual WebSocket frames and asserts absence of private answer/evaluation/grounding fields. Protected learner content disappears after revocation. Historical receipts remain persisted under the P0-R1 policy; denied source access does not delete or regrade them.

## G. Reliability

Room command receipts and full pins survive replay; the browser closes a real WebSocket and verifies reconnection before synchronized selection. Private assignment uses a deterministic identity and unique index; concurrent requests retain one server-owned UUID. The browser forwards a real successful submission to the server, drops only its response, retries from the UI and verifies exactly one persisted attempt.

Duplicate identical attempts return their durable receipt; altered payloads conflict. Missing exact FAISS index returns unavailable; the test restores that same file. Stopped Python produces unavailable tutoring. Stopped ingestion worker leaves the acknowledged upload pending and cannot produce publication readiness. Its synthetic queued job is purged from the mission-owned broker.

P0-R1 actual SIGKILL receipt recovery and P0-R2 interrupted publication/source restart tests remain in the passing root integration run. R3 adds concurrent assignment and response-loss recovery; it does not claim a new process-kill/power-loss private-check drill. Multi-instance WebSocket fanout, broker crash/redelivery/DLQ, restored backup consistency and current-image cold boot are not certified.

## H. Browser acceptance

**A–E: PASS, exit 0.** The final run records all five journeys, including the response-loss retry and stopped-worker subchecks. Actual Mongo evidence contains two registered activity types, six course attempts, two distinct recipient checks and four accepted evidence records belonging to the successful learner. The incorrect peer has no accepted evidence. Progress deduplicates the shared objective; accepted evidence records are not counted as separate mastered objectives. The final room reaches sequence 9; the adverse sequence test deliberately moves it from debrief to idle.

The harness uses five migrated synthetic cookie actors: platform/institution administrator, assigned instructor, enrolled learner, enrolled peer and outsider. It records actual API requests/statuses, browser assertions, WebSocket frames and Mongo documents/indexes. Only submission-response loss is injected; the backend itself remains real. Journeys are paced to preserve the existing IP rate limit for five users on loopback.

| Journey | Required observations |
|---|---|
| A — institution | Administrator creates institution/invitations; recipients accept in Profile; actual instructor assignment/enrollment; outsider and metadata-admin publication denial. |
| B — Studio | UI text upload → RabbitMQ worker → extracted sources/draft → saved objective → exact preparation → real passage → reviewed quiz/GuidedProblem registration → committed immutable publication. |
| C — solo | Incorrect quiz has no mastery; correct quiz and guided result persist; actual tutor citation downloads original bytes; diagnostic/history/progress reload; dropped successful response retries without a duplicate attempt. |
| D — shared | Two cookie browsers create/join, reconnect, select the same canonical activity, submit independently, isolate right/wrong private results, exchange peer text, accept a validated proposal and open private debrief. |
| E — adverse | Duplicate/conflict, forged pin/type, unknown revision, outsider, changed/stale presenter, malformed proposal, source-free fallback, missing index, unavailable Python/worker, enrollment/membership revocation and WebSocket field privacy. |

Evidence files: `browser-final.log/.exit`, `browser-checks.json`, `browser-events.json`, `browser-database.json`, `browser-services.log`; screenshots `browser-studio.png`, `browser-solo.png`, `browser-room-peer.png`. The database evidence contains synthetic actor identities, immutable course/revision, canonical room pin/receipts, checks, proposals and evidence counts. Source/session secrets are not copied from environment files.

Earlier failed/incomplete browser logs are retained. They exposed real integration problems including Next module interop, stale Studio state, navigation acknowledgements and room phase method; these were corrected. Test expectation corrections preserve strict behavior: malformed content hash is rejected as 400, conflicting durable attempt payload as 409. Session interruption stopped one final candidate after A; that incomplete log is retained as `browser-session-interrupted.log`. No incomplete log is acceptance evidence.

## I. Regressions

Observed Node 24.20.0/pnpm 11.3.0 and existing locked Python 3.12.15 environment. No installed dependencies were replaced. This is current-source local verification, not fresh installation or container-image certification.

| Check | Exit | Actual result | Evidence |
|---|---:|---|---|
| P0-R1/R2 baseline focused run | 0 | 26/26 nodes with real broker | `foundation-before.log` |
| Contract generation | 0 | Canonical routes retained; new learning routes generated | `generate-final.log` |
| Repeated generation | 0, 0 | Zero adapter drift | `generate-stability.json` |
| `pnpm lint` | 0 | Zero errors, 132 warnings | `lint-final.log` |
| `pnpm typecheck` | 0 | Strict API/web checks | `typecheck-final.log` |
| `pnpm test` | 0 | 6 route nodes; 732 Jest tests/56 suites; 10 Node unit nodes; 261 integration nodes; 17 Better Auth nodes; 47 web tests/7 files | `test-final.log` |
| `pnpm build` | 0 | API TypeScript and Next production webpack build | `build-final.log` |
| New R3 domain | 0 | 8/8 nodes, actual Mongo/source artifacts | `domain-final.log` |
| Retained room security | 0 | 14/14 nodes | `room-security-final.log` |
| Legacy facilitator/session integration | 0 | 7/7 nodes | `legacy-facilitator.log` |
| Full offline Python | 0 | 1065 passed, 5 skipped, 60 warnings | `python-full.log` |
| JSON Schema export check | 0 | No drift | `schema.log` |
| TS/Python differential | 0 | 201 fixtures, zero differences/incorrect outcomes | `contract-parity.json` |
| Python dependency check | 0 | No broken requirements | `pip-check.log` |
| Real A–E browser | 0 | All five journeys and eight recorded checkpoints | `browser-final.log` |
| Isolated auth/workspace/smoke browser | 0 | 8/8 Chromium tests | `browser-auth.log` |

Node totals include parent nodes; focused counts are subsets, not additional tests to sum. No Node test was skipped. Python skips are one legacy seeded-course scheduler test and four legacy workflow tests missing PDF fixtures. R2's new real PDF provenance, broker, grounding and provider boundaries execute in the regressions. Browser acceptance uses Next development mode; production build success is a separate check.

Root integration uses synthetic `MONGO_URI`/`MONGODB_URI`, `P0R2_PYTHON` pointing to the locked environment and loopback `P0R2_BROKER_URL`. Python uses `LLM_MOCK=1`, offline Hugging Face/transformer settings, `LITELLM_LOCAL_MODEL_COST_MAP=True`, `CUDA_VISIBLE_DEVICES=-1`, synthetic `DB_NAME=ednova_p0r3_python` and `PYTHONPATH=../api/tests/helpers/python_guard:.:agents/evaluator/src`. The test socket guard denies non-loopback outbound connections. Browser execution uses the harness/runbook command; the isolated auth launcher uses Next 5185/Nest 3015 to avoid unrelated project ports.

A root run was interrupted by stopped test infrastructure and another exposed an obsolete source-free revision expectation. Those logs remain (`test-infra-interrupted`, `test-legacy-pin-expectation`). The final full root run completed after the fixes. Security behavior was tightened rather than bypassed. The first auth smoke run passed 7/8 and expected automatic room navigation; its retained log is `browser-auth-navigation-expectation.log`. The room test now follows the acknowledged **Open room** link for creation/join and keeps its two-user, leave and revoked-view assertions. Next's runtime CommonJS/ES export collision was corrected in the Bloom taxonomy while retaining the compatibility alias; taxonomy/contract tests pass and canonical validators remain unchanged.

CI's source-foundation job now runs the R3 domain test, installs Chromium, executes real A–E and uploads browser evidence, alongside existing Python/source gates and adapter drift. Existing jobs remain. **No remote Actions execution was observed.**

## J. Remaining work

Full adaptive diagnostic ability and reviewed difficulty ranking remain unapproved/unimplemented; the delivered selector and checks are explicitly nonadaptive. General conceptual activity generation/evaluation and actual compact/capable provider quality remain unavailable. Live inference needs genuine task/model authorization and a bounded budget, durable aggregate accounting and actual redacted execution evidence. No key presence or deterministic success implies approval.

ED-26 needs genuine owner decisions, confirmations and review of changed provisional operation/artifact hashes. The existing ledger remains 0/19 decisions and 0/5 linked confirmations. Production index/migration inventory, legacy provenance reconstruction, real embeddings and full PDF/OCR quality, exact-source current Docker builds, backup/restore, broker failure recovery, monitoring/readiness, TLS/proxy/cookie deployment checks, distributed realtime fanout and remote CI evidence remain separate gates. No full-roadmap or deployment acceptance is inferred from this mission.

## K. Preservation

Baseline branch `main`, HEAD `5fb70a095da8f8cf429aed2e4f4bf72ce096e927`, no staged changes. `baseline.txt` records the required Git inventories. `baseline-hashes.json` and `before/` preserve 893 initial files, including dirty/untracked R1/R2 work. `mission-files.json` and `mission.patch` compare R3 against those actual entry bytes, including files already untracked at entry.

Final `preservation.json` verifies all 893 entry files remain, protected historical reports/contracts/validators are byte-identical and staging is empty. The mission manifest contains 47 changed/new source or documentation files, including this report and the updated legacy browser navigation test. Unrelated entry work remains unchanged. No reset, clean, stash, restore, stage, commit or push was performed. Environment secrets and dependencies were not edited. Official approval records are untouched. Existing test Mongo/Mailpit were returned to their initial stopped state; only the mission-owned RabbitMQ was removed, without volume deletion or changes to other projects' services (`cleanup.log`). After session interruption Docker Desktop had stopped; it was restarted to resume these isolated tests. The interrupted run was retained rather than claimed as passed.

## L. Readiness verdicts

| Gate | Classification |
|---|---|
| P0-R3 engineering | **PASS — local supported deterministic/offline integrated journeys** |
| P0 functional acceptance | **NOT READY — separately required adaptive, governance and operational gates remain** |
| ED-26 governance | **NOT FROZEN — no genuine owner decisions or confirmations added** |
| Production deployment | **NOT READY — no current-image/restore/failover certification or authorized real inference** |

Work stops after P0-R3; advanced roadmap and deployment are outside this mission.

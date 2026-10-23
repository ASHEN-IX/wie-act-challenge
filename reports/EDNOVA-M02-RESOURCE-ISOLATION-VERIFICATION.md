# EdNova M02 resource and transport isolation — 23 October 2026

**PASS. M02 is complete; ED-02 is DONE for the current personal owner/resource and transport boundaries.** M03 has not started. No external inference, staging, commits, pushes, publication or deployment occurred.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. Prerequisite: [M01 final runtime verification](EDNOVA-M01-FINAL-RUNTIME-VERIFICATION.md). Mandatory architecture/backlog/contract sources and applicable web instructions were inspected before changes; the mission-start manifest records the original dirty tree.

## Initial access-boundary audit (before implementation)

The current grants are personal course ownership and explicit active room/team membership. Institutional enrollment and immutable published-source revisions are absent; room invitations do not grant course ownership. Better Auth provides actor identity; existing Study handlers own course and membership decisions. HTTP and internal `module://` operations both run their owning handlers; the operation policy also guards AI dispatch. Existing dedicated room HTTP/WS source checks, durable replay, exact-socket presence and peer-text history are retained.

| Resource | Owner / canonical boundary | Read / write / delivery findings |
|---|---|---|
| Course/source | Study Course.userId; courses routes | Course CRUD/download predicates are owner-scoped. Shared AI operationPolicy drops owner filtering for admins and ignores conflicting/query resource aliases. |
| Private uploaded file | Study course files; authenticated download | Bootstrap and retained Express apps expose broad unauthenticated uploads directories; private course paths can bypass the download handler if stored under the static root. Public avatar/media behavior must remain. |
| Team/session | Study session owner and active participants | Team creation loads a guessed Course without ownership. Joining/participants do not check current source access. Task skip has no membership check; copied task summaries can outlive source authorization. |
| Dedicated room/chat | Study room membership + owner course read; notification session-access helper | Hardened room paths already revalidate on HTTP, incoming WS, delivery, heartbeat and replay. Legacy team access inherits missing source checks. |
| Legacy voice | Notification VoiceSession plus Study membership | All six voice HTTP operations call persistence without current Study membership/source authorization. Signaling is room-scoped but targeted payloads are broadcast to all members. |
| Private AI job/result | AiJob.userId; AI/eval routes | Admin can retrieve others' private results. Requests do not persist usable resource scope. Completed callbacks correlate only by correlationId; unmatched/forged evaluation envelopes can still create private result records. |
| Objective / evaluation context | Study-owned learning_objectives | AI objective resolver loads active objectives by objectiveId without actor/course predicate. |
| AI transport / cache | Existing service-key transport, broker and actor caches | Python service is service-authenticated, not browser-authoritative. Scope must be validated in Node before transport and again on result/cache delivery. No approved provider calls are needed for these checks. |

Source findings above precede runtime implementation changes. Focused negative real Nest/Mongo tests will record reproduction and final results; source-only findings are not execution proof. Mission-start hashes and original dirty diff are captured outside the repository before new files.


### Additional Python finding before its repair

Five focused tests fail against the original reused PlannerAgent: sequential and overlapping requests mix prior actors' chunks, failed indexing reuses earlier private chunks, disk keys lack actor/content scope, and a course title can select a shared cache. The API planner also prints private course title/chunk/summary/goal debug text. These are demonstrated M02 retrieval/privacy defects, not new tutor or inference features. Repair and final verification are recorded below after execution.

## Threat matrix and executed outcome

| Attack / resource | Current owner and boundaries | Positive / negative verification |
|---|---|---|
| Guessed course metadata, summary, ingestion status and file | Study `Course.userId`; existing owner-filtered course routes | Owner 200; peer/outsider/admin 404; anonymous 401. Guessed filename 404; private sentinel absent. |
| Alternate private static URL | Shared `publicUploads` allowlist and realpath check in actual Nest bootstrap and retained apps | Anonymous original/encoded private paths and symlink to private source denied; legitimate public image 200. |
| Team course copying, invite and task mutation | Study current source grant plus active session roster | Foreign/admin team creation denied; invite/roster cannot grant private source; outsider task skip denied with unchanged stored state. Source-free authorized team/voice operations remain usable. |
| HTTP chat/history and voice | Existing Study membership/source helper, checked before persistence and delivery | All six outsider voice operations denied before VoiceSession writes. Authorized participant succeeds; revoked/completed stale roster denied. Existing room HTTP security tests remain green. |
| Internal `module://` source lookup | Same Study handler with authenticated session context | Owner succeeds; foreign actor denied. No internal/admin exception. |
| Private job, feedback and cached result | Stored actor, explicit resource scope, current Study source grant | Owner succeeds; peer/admin denied across generic/eval/search routes; legacy/malformed provenance denied. Source ownership transfer blocks old owner's completed job, plan and task. |
| Objective, generic job and callback impersonation | Objective actor/current course; immutable job envelope identities | Foreign objective rejected before evaluator dispatch. Generic ingestion cannot submit arbitrary file paths. Unknown/forged actor/message/resource callbacks make no result writes; concurrent terminal completions retain first accepted result. |
| AI context and in-flight source revocation | Node resolves Study projection before authenticated AI transport; checks current grant again before response | Only `_id`, title and topics forwarded; actor comes from auth; no browser cookie forwarded. Foreign/conflicting IDs cause no AI call. Held response after source transfer returns denial without private sentinel. Stub is explicitly `MOCK_TEST`. |
| Python retrieval/cache contamination | Per-request planner context; actor/content-scoped existing FAISS disk cache | Sequential and overlapping actors, index failure, changed context and title-only cache attacks isolated. Actual FAISS operations with deterministic embeddings; no external inference. |
| Socket cross-room, targeted signal and revoked recipient | Existing single registry and delivery-time Study authorization | Three sockets/two users plus outsider room verify subscription denial, cross-room isolation, intended-recipient signaling, ejection and denied reconnect. Source revocation prevents subsequent sentinel delivery. Existing replay/presence/peer-text tests pass. |
| Browser stale access / credentials | Existing protected Next pages and socket effect; no UI redesign | A1/A2 share one actor, B is independently authenticated. Real backend response denial, source transfer, old-recipient ejection, cleared protected UI, denied refresh and unaffected authorized room pass. HttpOnly credentials absent from serialized props and WS URLs. |

The suite uses real Better Auth sessions, Nest HTTP/internal dispatch, MongoDB and WS clients. Fixture actors represent owner, another learner, outsider and existing admin; presenter/member/revoked states are exercised through real room operations. It does not invent institutional enrollment. Synthetic per-actor documentation IPs avoid conflating four actors under the existing per-IP expensive-operation limiter; no rate-limit configuration is relaxed.

## Implementation and compatibility

Resource/source slice: `apps/api/modules/study/src/services/resourceAccess.ts` centralizes the existing personal ownership decision and source inheritance for materialized plans/tasks. Course CRUD/download already had owner predicates and is preserved. Session middleware in `study/src/routes/sessions.ts` accompanies nested HTTP and internal contracts. Team creation, invite projections, active roster handling and session lists use the same current source boundary. Existing participants with `leftAt` no longer regain permission through host identity alone. Explicit leave remains possible after source revocation.

File slice: `apps/api/shared/publicUploads.ts` replaces broad static serving in the Nest bootstrap and retained Study/UserProfile apps. Existing root/avatars/subjects/media image and media filename shapes remain public; course originals, extraction and staging paths do not. Resolved symlink targets must also be public allowlisted paths. Authenticated owner downloads remain available. Caddy, frontend public assets and deployment topology are unchanged.

HTTP/internal slice: `apps/api/shared/operationPolicy.ts` validates every supplied resource alias, rejects conflicts, binds actor context and verifies parent course scope without an admin content bypass. `shared/auth.ts`, `framework/domain.service.ts` and the competency response use `Cache-Control: private, no-store`. The default production HTTP and internal handlers retain their existing architecture.

Learning/AI slice: `ai-orchestrator/src/models/AiJob.ts`, `routes/{jobs,eval,search}.ts` and `services/{jobAccess,objectiveContext,jobResultConsumer,evalResultStore}.ts` persist minimal server-derived resource provenance, enforce private actor queries, check current grants and bind callback identities. Parent source resolved by policy is retained for later polling, including queued search/evaluation. Objective/course disagreement is rejected. Terminal updates are conditional and replay writes insert-only. `study/src/routes/{plans,tasks,coach}.ts` and `services/competencyUpdater.ts` apply corresponding current actor/source checks. No private answer payload is copied into resourceScope.

Transport/cache slice: `ai-orchestrator/src/routes/ai.ts` resolves the authorized Study planner projection; `utils/proxyBuilder.ts` supports that asynchronous resolution, rechecks source access on response and sanitizes upstream failures. Python `services/api/routers/planning.py` accepts this service-authenticated projection instead of looking up a raw ID without actor scope. `agents/planner/agent.py` shares existing model weights but gives each request fresh retrieval state. Existing disk caches now include actor and context content in their key and restore matching index text; old unscoped title caches are not reused. Private planner debug prints are removed. No new vector store, queue, provider router or inference engine is introduced.

Realtime slice: `notification/src/routes/voice.ts` authorizes all legacy HTTP voice operations before reads/mutations. Chat search rechecks access after asynchronous work. `notification/src/realtime.ts` preserves its existing registry and room delivery authorization; targeted legacy signaling filters the intended recipient and session-start notification delivery revalidates membership/source. No LiveKit, audio feature or additional presence registry is introduced.

Compatibility is intentionally fail-closed: old jobs/plans with no recorded source provenance are not guessed to be source-free; owners must resubmit them. Newly accepted source-free records explicitly persist `{}` (`minimize: false`). An admin has no default private-learning read privilege. A source-backed legacy team participant must independently hold the current personal source grant; invitations cannot manufacture sharing/enrollment. These restrictions are documented in roles and contracts. No dependency manifest, lock, CI, strictness or ESLint policy changes were needed.

## Commands, real infrastructure and regression comparison

All commands run from repository root unless an embedded `bwrap --chdir apps/ai` says otherwise. Exact argv, cwd, exits, durations and failed attempts are in the local [command ledger](evidence/ednova-m02-2026-10-23/command-ledger.json), with matching log and command JSON per row. Test Mongo 7 is isolated on loopback 27018; Mailpit is the existing dedicated test service. Docker commands explicitly use context `default`.

| Gate / final command | Actual result | Evidence stem |
|---|---|---|
| Baseline `pnpm lint`, `pnpm typecheck`, `pnpm test` | Exit 0 before runtime changes | Baseline command records |
| `pnpm lint` | Exit 0; zero errors, 120 existing warnings | `root-lint-complete` |
| `pnpm typecheck` | Exit 0; API and web strict checks | `root-types-verified` |
| `pnpm test` | Exit 0: routes 6; Jest 55 suites / 522 tests; Node unit 10; Node integration 109; auth 17; web 29 | `root-tests-final-scope` |
| `pnpm build` | Exit 0; API and production Next | `root-build-verified` |
| `pnpm generate:contracts` | Exit 0; generated adapters unchanged from mission start | `contracts-acceptance` |
| Real M02 Node integration file | Exit 0; 21 passes (20 subtests plus parent), no skips/failures; also included in root's 109 | `security-matrix-verified` |
| `pnpm test:e2e` | Exit 0; eight real Chromium auth/smoke/workspace tests | `browser-auth-complete` |
| Existing `test-study-together-{peer-text,presence,e2e}.ts` | Each exit 0; production Next + real Nest/Mongo | `browser-peer-complete`, `browser-presence-complete`, `browser-room-complete` |
| New `test-resource-isolation.ts` | Exit 0; three browser contexts, actual HTTP/WS checks and screenshot | `browser-m02-final-assets` |
| Full locked Python `pytest -q -ra` under headless/offline guard | Exit 0; 826 passed, five existing skips, 59 warnings | `python-full` |
| New focused Python planner isolation tests | Exit 0; eight passed, included in full total | `python-context-fixed` |
| Actual AI Docker build | Exit 0; unchanged locked dependency layer reused, changed runtime copied | `docker-ai` |
| AI image startup, service auth, native imports and scope denial | Exit 0; two healthy fresh containers, image pip check and eleven import/native probes | `ai-image-runtime-verified` |
| Real RabbitMQ/Redis Node publisher + full Python worker fixture | Exit 0; completion, dedup/restart, retries/DLQ and drain | `broker-real` |
| Fresh API/web Docker builds and cold container smoke | Exit 0; Mongo health, landing HTML, proxied health and anonymous room 401 | `docker-api-corrected`, `docker-web-corrected`, `docker-smoke-verified` |

The Node integration total is 81 existing ED-07 + seven existing deterministic ED-09 + 21 M02 tests. New route unit tests verify inherited source provenance and objective/source disagreement. Counts for focused files overlap the root/full suites. Browser stage logs are scenarios, not independent test counts. The auth suite uses Next development mode; four standalone room/security runners use a production build. Browser invocation uses the locally installed Chromium executable override recorded in argv.

The full Python environment and both locks remain identical to M01. Full Python execution hides camera/GPU devices and blocks external provider sockets while permitting loopback fixtures; it uses cached public embeddings offline. Five pre-existing manual scenarios still skip for their seeded Mongo course or absent test PDFs. No new skip, collection exclusion or test-engine narrowing is introduced. Deterministic embeddings/stub responses and broker handlers are `MOCK_TEST`; actual Mongo/HTTP/WS/RabbitMQ/Redis/FAISS/processes are real. Missing provider credentials remain `UNAVAILABLE`. No `REAL_APPROVED` inference, GPU/camera/voice behavior or learning outcome is claimed.

The refreshed AI image is `ednova-m02-ai:verification`, manifest `sha256:918aee4d6b2233368bdcf3bc59e54bab85c133535bd2e0d69b291820f939e3b3`. Its eleven checks include bootstrap/worker/retrieval/provider imports, CPU Torch/TensorFlow, FAISS, OpenCV/MediaPipe, synthetic PDF/Poppler and Tesseract, plus missing-credential unavailability. HTTP smoke verifies health, 503 without service configuration, 401 invalid service key, 422 invalid schema, deterministic decline and raw-course-context denial. Host Python worker broker transport is freshly tested; image-based broker transport retains unchanged M01 evidence and is not counted as a fresh M02 execution.

### Failed attempts retained

Focused Node negative tests reproduced the original boundary defects before repairs. Five initial Python tests reproduced cross-request/cache leakage; later context-contract assertions also failed before their fix. Fixture corrections included Better Auth bcrypt cost 12, valid mock owner/source records, request-type/actor expectations, Nest's existing POST proxy 201 status and distinct synthetic actor IPs to respect the unchanged rate limiter. Callback unit fixtures now supply full immutable binding and assert no writes for unknown envelopes; they do not weaken callback validation.

Initial browser setup tried a build-time Next rewrite with the runtime API port, then page fetch blocked by the unchanged CSP; the final runner uses each real browser context's cookie jar for direct backend HTTP probes, alongside the actual UI and WS flow. Ambiguous accepted-message locators were narrowed. A strict browser helper needed a narrowed port value captured before its callback. A clean web image exposed a missing bcrypt declaration in the new runner; an explicitly typed require fixes that test-only import without a suppression or dependency change. The first API Docker invocation used the wrong Dockerfile path; the corrected root Dockerfile build passes. The earlier container smoke consequently lacked images and failed; the full smoke was rerun after both corrected builds. Failed command records remain failures.

A first API build exposed a shared-source rootDir import issue; bootstrap uses the existing typed-require pattern. A generated adjacent JS artifact from that failed build was confirmed absent from baseline and removed, with its hash recorded. No baseline file was removed. Unit expectations that asserted raw upstream private error details were replaced with assertions for sanitized errors. No runtime workaround, auth/rate-limit weakening or dependency change hides a failure.

## Limits and remaining mission dependencies

Current source authorization is personal ownership. ED-04 must add actual institutional membership/enrollment/revocation to the owning boundary; M02 does not fabricate those grants. Immutable published-source/revision resolution and later activity/private-attempt interfaces remain separate missions. Existing source content is included in planner cache identity, but no nonexistent revision model is claimed. Resubmission is required for legacy records with unknown provenance.

Authorization occurs before protected lookup/transport and at delivery boundaries. It is not one transaction spanning identity, ACL, source persistence and a socket write; already delivered frames/files cannot be recalled, and a grant change concurrent with a completed check has the existing boundary timing. Idle sockets are revalidated on the existing heartbeat/publication schedule. Single-instance presence/fanout remains the verified topology; distributed coordination is unimplemented. Remote Actions, production proxy outages, external inference, GPU/media and the five manual Python workflows were not run. These are not promoted into other feature acceptance.

## Attribution, cleanup and completion

Earlier reports and evidence are historical; this report attributes only differences from the mission-start dirty tree. The final standalone browser rerun initially lacked refreshed build static assets and could not connect the client; after copying the matching `.next/static` and public assets, the complete scenario passes again. That harness failure remains a failed command in the ledger.

The [before/after manifest](evidence/ednova-m02-2026-10-23/working-tree.json) covers **2,001 mission-start files: 1,952 preserved byte-for-byte, 49 deliberately changed, zero missing**. The complete changed-path inventory, old/new hashes and seven new Git-eligible files are recorded there. [Mission-only patch](evidence/ednova-m02-2026-10-23/mission-change.patch) compares the original dirty tree, not HEAD; the original dirty patch is separately retained. New files are the Study resource helper, AI job delivery helper, public static middleware, real M02 Node test, browser runner, Python planner isolation test and this report. Existing changes are the owning-boundary/runtime slices, corresponding fixture regressions, roles/contracts/backlog and current acceptance/gate notes described above.

Both lockfiles, dependency manifests, CI/deployment files, Python provider policy, existing room model/command receipt and peer/presence UI implementations, prior reports and prior evidence are unchanged from mission start. Notification realtime has only the targeted authorization fixes described above. Backlog ED-02 is the only task promoted by M02; ED-01 remains DONE and other feature gates retain their status. Staging is empty and HEAD unchanged.

Cleanup removed only named synthetic M02 databases left by failed/complete fixtures; [cleanup inventory](evidence/ednova-m02-2026-10-23/database-cleanup.json) lists exact names and confirms none remain under this mission prefix. All owned smoke/worker/broker containers are removed. Dedicated Mongo/Mailpit are stopped, restoring their initial state. Verification image tags and pre-existing dependency/model caches remain; no unrelated resource was removed. Raw logs, screenshots, scripts, patch and command records remain ignored locally under `reports/evidence/ednova-m02-2026-10-23/`; authored documentation remains Git-eligible.

**Completion decision: PASS. M02 complete; ED-02 DONE for current grants.** Course/source/file isolation, existing legitimate team flows, HTTP/internal/AI/cache privacy, callback identity, current incoming/outgoing socket authorization, revocation, credential isolation and all required regression checks are evidenced. Institutional enrollment and immutable publication/revision semantics remain explicit future contracts, not unverified claims of current functionality. No other task is promoted.

**Exactly one next mission: M03 — shared versioned contracts (ED-26).** Its M01/M02 baseline prerequisites now pass. M03 has not started.

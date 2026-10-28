# EdNova M00 source and evidence audit — 22 October 2026

**M00 audit gate: PASS with explicit validation limits. Full EdNova: PARTIAL. M01 baseline repair is ready as the next separate mission.** This audit implements no feature and changes no canonical task status.

Repository `/home/ashenix/Projects/mindflow`; branch `main`; HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. Date uses Africa/Tunis. Node v24.20.0, pnpm 11.3.0, Python 3.14.8. Mongo is the dedicated `mongo:7` standalone test container on `127.0.0.1:27018`. Browser verification uses installed Chromium through Playwright; it does not use media devices or live inference.

Deliverables:

- [Acceptance matrix](EDNOVA-ACCEPTANCE-MATRIX.md): 110 canonical acceptance clauses, exact source/reuse anchors, evidence, classifications, gaps, semantics and next missions; all ED-01–ED-35 plus ED-DOC.
- [Mission gates](EDNOVA-MISSION-GATES.md): expanded prerequisite edges, all M00–M38 readiness decisions, Contracts03–07, staged ordering, external inputs and disagreement ledger.
- [Evidence](evidence/ednova-m00-2026-10-22/commands.json): exact commands/cwd/exits/durations plus logs, before/after hashes, source inventory and diagnostic comparison.

## Scope, sources and preservation

Read the attached M00 mission, local M00/M01 prompts and roadmap; all 18 mandatory documents/reports; applicable parent/nested instructions; package scripts/configs; Dockerfiles, Compose and CI; relevant runtime handlers/models/frontend/Python paths. Additional references include workflows A–H and the existing AI message envelope contract. The only applicable repository instruction file found is [apps/web/AGENTS.md](../apps/web/AGENTS.md); no root or ancestor AGENTS file exists. It requires installed Next guides before writing code; M00 writes reports only. No skill or delegation was required.

The [input manifest](evidence/ednova-m00-2026-10-22/inputs.json) records document hashes. Large-source searches and selected source reads are not execution proof; the inventory records exact lines. Runtime scope is actual `apps/api`, `apps/web`, `apps/ai`; old `study-partner-*` documentation aliases were resolved without creating obsolete directories. The local official-rule summary was inspected; current organizer approval, account details and deadline interpretation were not externally verified or invented.

Before artifacts, captured `pwd`, branch, HEAD, `git status --short`, `git diff --stat`, `git diff --name-status`, `git diff --cached --stat` and untracked-file inventory. [Before manifest](evidence/ednova-m00-2026-10-22/before.json) hashes **834 pre-existing files**, including tracked and nonignored untracked content. [Before patch](evidence/ednova-m00-2026-10-22/before.patch) records the existing tracked changes. The working tree began with 23 modified tracked files (988 additions/121 deletions), existing untracked code/reports and three user mission documents. Staging was empty.

Attribution is evidence-based rather than inferred from authorship:

| Existing work | Paths / evidence | M00 treatment |
|---|---|---|
| ED-07 stabilization/security/replay/presence | StudyRoom/rooms/roomCommands; notification realtime/access helper; collaboration room reducer/UI/actions; real tests/reports | Read and rerun relevant tests; no source edits |
| ED-07 peer text | SessionChat/peerText/chat router; generated notification adapter; peer component/state/hook/actions/page; API/web/browser tests | Current source matches latest report manifest; exercised real browser/DB failures and recovery |
| ED-09 baseline | Python facilitator directory/router/main registration; FacilitatorIntervention; facilitator handlers/UI/test | Source inspected, unchanged; no facilitator acceptance or live-quality claim |
| Existing platform/other changes | `.gitignore`, auth/name/close changes, middleware validation option, bootstrap dependency resolution, notification/voice routes/service, generated Study registration, Next config, docs | Preserved; type/lint/unit issues attributed to starting tree, not repaired |
| User planning inputs | Root M00/M01 prompts and full mission roadmap | Read and preserved byte-for-byte |

After verification, all **834 existing files still match**, none are missing, the tracked diff/staged state is unchanged, and only the three requested reports plus their new evidence are added. See [after manifest](evidence/ednova-m00-2026-10-22/after.json). Quality commands write ignored build/cache artifacts and synthetic test databases; no runtime source, dependency, lockfile, canonical backlog, existing report or user prompt was modified. No reset/clean/stash/rebase/stage/commit/push/publish/deploy occurred.

## Actual runtime topology and dispatch

| Boundary | Actual source and behavior | Audit implication |
|---|---|---|
| API startup | [main.ts](../apps/api/src/main.ts), [bootstrap.ts](../apps/api/src/framework/bootstrap.ts): Nest/Express, shared middleware, Mongo/Better-Auth initialization, realtime attachment, optional consumers/poller, draining stop | Real integration starts Nest with `workers:false`; it does not certify RabbitMQ/Python consumers |
| Public route registration | [domain-definitions.ts](../apps/api/src/domain-definitions.ts) loads seven domains `auth/users/study/ai/signals/analytics/notifications`; generated [domain adapters](../apps/api/src/framework/domains) delegate via DomainService/ContractParameterPipe | Router declarations must be mounted and have a generated public adapter; docs alone do not register routes |
| Internal calls | [moduleClient.ts](../apps/api/shared/moduleClient.ts), [domain.service.ts](../apps/api/src/framework/domain.service.ts): `module://` in-process contract matching, cookie/request context, authenticate/operationPolicy/handler execution | No internal HTTP microservice split; architecture tests cover auth, validation and no network fallback using fixture identities |
| Identity | [auth.guard.ts](../apps/api/src/framework/auth.guard.ts), [betterAuth.ts](../apps/api/shared/betterAuth.ts), [sessionIdentity.ts](../apps/api/shared/sessionIdentity.ts) | Real cookie auth/session revocation verified in 17 auth tests and real room tests. Internal secret/admin exceptions exist; they do not prove target institutional/privacy rights |
| Source/course | [courses.ts](../apps/api/modules/study/src/routes/courses.ts), [models/index.ts](../apps/api/modules/study/src/models/index.ts) | Current Course uses `userId`, files/topics, aiCourseId and processing/completed/failed ingestion state. No implemented institutional publication/revision context |
| Room consumers | [rooms.ts](../apps/api/modules/study/src/routes/rooms.ts), [session-access.ts](../apps/api/modules/notification/src/utils/session-access.ts) | Room access calls owner-authorized Study course read; notifications query current Study roster/source permission. Invite grants no course ownership/enrollment |
| Private AI HTTP | [aiClient.ts](../apps/api/shared/aiClient.ts), [security.py](../apps/ai/services/api/security.py), [main.py](../apps/ai/services/api/main.py) | Origin fixed to AI_SERVICE_URL, strips browser/internal credentials, adds AI_SERVICE_API_KEY Bearer, bounds timeout, retries disconnected GET once. Python router dependencies check its service key; health remains separate |
| Async AI | [ai-messaging](../apps/api/shared/ai-messaging), [workers/base.py](../apps/ai/workers/base.py), [ingestion_worker.py](../apps/ai/workers/ingestion_worker.py), [evaluator_worker.py](../apps/ai/workers/evaluator_worker.py) | Existing envelopes, payload validation, retry/DLQ, leases and state are reusable; no live broker/worker roundtrip was run in M00 |
| Provider routing | [llm_client.py](../apps/ai/utils/llm_client.py), [config.yaml](../apps/ai/litellm/config.yaml) | Per-operation aliases and fallback chains exist. `LLM_MOCK=0` alone does not require a real call: missing recognized provider keys selects mock_fn. No reviewed artifact proves organizer-approved compact/capable categories |
| Retrieval/ingestion | [retriever.py](../apps/ai/agents/planner/rag/retriever.py), [vector adapter](../apps/ai/services/vector_store/adapter.py), [ingestionJob.ts](../apps/api/modules/study/src/services/ingestionJob.ts) | Existing FAISS/Mongo source paths and course/aiCourseId mapping; target immutable revision index/provenance/ACL integration incomplete |
| Frontend | [api.ts](../apps/web/src/lib/api.ts), [identity.ts](../apps/web/src/server/identity.ts), feature Server Actions, App Router pages, [proxy.ts](../apps/web/src/proxy.ts) | Server-side cookie forwarding and existing room socket; native practice text/job UI is not a trusted activity registry |
| Deployment | [docker-compose.yml](../docker-compose.yml), [Caddyfile](../deploy/Caddyfile), [CI](../.github/workflows/ci.yml) | One fixed mindflow-api, Mongo standalone, Redis/RabbitMQ; Caddy proxies frontend:80 → nginx → app/web. No replicas/shared socket coordinator. Python AI is not defined as a Compose service here; API defaults to host AI URL |

[source-inventory.json](evidence/ednova-m00-2026-10-22/source-inventory.json) records 242 route declarations, 84 index/unique declaration lines and 70 dispatch-related lines. These are static search hits, not unique deployed endpoint/index counts. Searching runtime sources for published-context/CourseRevision/InstitutionMembership/CourseEnrollment/LearningActivity/ActivityAttempt/LearningEvidence/activity-renderer/livekit-token/livekit yielded no matching target implementation lines. Generic legacy models/services are mapped separately below; absence of those names alone is not the sole basis of the readiness decision.

## Actual typed models, indexes and interfaces

| Capability | Implemented producer, persistence and consumers | Bounds / privacy / missing target |
|---|---|---|
| Room lifecycle | [StudyRoom.ts](../apps/api/modules/study/src/models/StudyRoom.ts), rooms routes and typed [roomCommands.ts](../apps/api/modules/study/src/services/roomCommands.ts); generated [study.module.ts](../apps/api/src/framework/domains/study.module.ts) | Study owns public state. Unique roomId/inviteCode, partial unique hostUserId/createCommandId (`room_creation_command`). Private select:false embedded receipts; atomic state+receipt majority/j write; expectedSeq; ordinary cap512 plus participant leave reserve. Legacy requests without commandId lack durable replay guarantee |
| Presence/snapshot | [realtime.ts](../apps/api/modules/notification/src/realtime.ts), [room-sync.ts](../apps/web/src/features/collaboration/room-sync.ts), RoomView | Existing exact socket registry only; actor aggregates after session/room/source authorization. presenceEpoch/version separate from durable seq. 30s heartbeat; no distributed presence. HTTP persisted availability is not authoritative live presence |
| Peer text | [SessionChat.ts](../apps/api/modules/notification/src/models/SessionChat.ts), [peerText.ts](../apps/api/modules/notification/src/services/peerText.ts), [chat.ts](../apps/api/modules/notification/src/routes/chat.ts), generated [notifications.module.ts](../apps/api/src/framework/domains/notifications.module.ts) | `IPeerMessage`: roomId/messageId/submissionId/senderUserId/senderName/text/seq/createdAt. One peer_stream journal; partial unique sessionId/messageType `peer_room_journal`; actor-scoped UUID dedup, contiguous append sequence, max1000. Plain text 2000 UTF16/8000 UTF8; explicit DTO. History ?kind=peer&afterSeq&limit; no infinite archive/outbox |
| Peer web recovery | [peer-text-state.ts](../apps/web/src/features/collaboration/peer-text-state.ts), [use-peer-text.ts](../apps/web/src/features/collaboration/use-peer-text.ts), [peer-chat.tsx](../apps/web/src/features/collaboration/peer-chat.tsx), RoomView | One socket, authorized-snapshot recovery, generation guards, immutable dedup/order, mounted-page pending key/text, manual recovery. React plain-text escaping; accepted history survives refresh, unsent drafts/IDs do not |
| Course/objects | Study Course/LearningObjective/CompetencyProfile/EvalResultRecord in models/index.ts; course/objective/competency routes | Existing source fields and unique documentId/topicId/textHash objective index; unique userId/topicId/knowledgeType competency key; leases for eval processing. These are not canonical CourseRevision/ActivityAttempt/LearningEvidence collections |
| Legacy assessment | [eval.ts](../apps/api/modules/ai-orchestrator/src/routes/eval.ts), [AiJob.ts](../apps/api/modules/ai-orchestrator/src/models/AiJob.ts), [EvalResult.ts](../apps/api/modules/ai-orchestrator/src/models/EvalResult.ts), [competencyUpdater.ts](../apps/api/modules/study/src/services/competencyUpdater.ts) | POST /api/v1/eval/step creates job; GET /api/v1/eval/jobs/:jobId returns status/result (admin exception). AiJob unique jobId/TTL; EvalResult unique correlationId. Existing async evaluator/leases are reuse, not canonical pinned activity attempt/evidence acceptance |
| Existing rewards | [Gamification.ts](../apps/api/modules/user-profile/src/models/Gamification.ts), [RankEventLedger.ts](../apps/api/modules/user-profile/src/models/RankEventLedger.ts), [awardService.ts](../apps/api/modules/user-profile/src/services/awardService.ts), [gamification.ts](../apps/api/modules/user-profile/src/routes/gamification.ts) | Unique user Gamification profile and ranking eventKey ledger; ranking KP600 cap distinct from proposed learning XP300. Privileged legacy award-xp updates XP separately from KP ledger. Not proof of one recoverable evidence-to-XP effect |
| Facilitator baseline | [FacilitatorIntervention.ts](../apps/api/modules/study/src/models/FacilitatorIntervention.ts), rooms observe/action/history; Python facilitator policy/agent/schemas/router | Existing intervention ID unique; templates/regex/LLM coach alias and fallbacks; source/sequence/proposal/target-only-decline/context budgets incomplete. Not durable room command replay for inference writes |
| Target Contract03 | Published immutable source/revision/enrollment context | ABSENT as a target service; existing owner-only read does not satisfy enrolled peers or revision retention |
| Target Contract04 | Public versioned LearningActivity + trusted renderer | ABSENT; no canonical activity route/model/registry; nonempty room activity returns503 |
| Target Contracts05/06 | Private ActivityAttempt and recipient-only pinned result | ABSENT; room submit-flag503 protects against fabricated completion, not successful assessment |
| Target Contract07 | Accepted immutable LearningEvidence and safe completion projection | ABSENT; legacy eval/competency mechanisms require reuse and extension, not a second evaluator |
| Target media/help/insights | LiveKit tokens/voice moderator; Contract18 private panel/history; instructor suppressed aggregates | No target handlers/components found; legacy voice and analytics do not fulfill them |

Indexes above were inspected in schemas and relevant unique-index behavior exercised by room/peer tests; M00 did not enumerate production Mongo indexes or run migrations against user databases. The evidence inventory lists declarations to guide future verification.

## Security and correctness findings for later missions

1. **M02 source/transport gaps remain outside the hardened dedicated room flow.** Bootstrap registers unauthenticated static `/uploads` mounts; whether a particular private file is exposed depends on stored location/volume/path, and that exploit was not reproduced here. Legacy `teamSessions.ts` builds task summaries from `Course.findOne({_id:courseId})` without owner/enrollment filter. Legacy voice start/end/status handlers and voiceService lack explicit room membership/source checks. Global authentication alone does not authorize these resources.
2. **M02/M04/M12 privacy exceptions need review.** operationPolicy can omit owner filtering for global admins; legacy eval result read allows admins to query another user's job. These actual exceptions differ from target educator/admin no-default-private-answer rights. M00 identifies source behavior, not an executed end-to-end exploit.
3. **M03 Contracts03–07 need executable schemas and fixtures.** Current markdown examples and legacy envelope validators do not implement the new services. Contract05 says UUIDv4 while its example uses att_ identifiers; current result/status examples omit recoverable pending/unavailable states. No model-selected grade/XP or room flag may stand in for accepted private evidence.
4. **M19 must retain and repair one facilitator baseline.** Node accepts recentDialogue without the required bounded public history/source revision; Python strings/lists/extra fields are not strictly bounded/forbidden. Decline is not constrained to the targeted actor. Proposal persistence lacks complete source/version/recipient/stale-result/idempotency checks. Deterministic fallback is not exposed as distinct provenance consistently. Existing policy code is unverified for real pedagogical correctness.
5. **M01 quality debt is currently reproducible.** Strict types fail identically; lint remains broad; two legacy chat auth fixtures do not establish current membership; web build exits with a security recommendation. Test success under ts-jest diagnostics:false is not strict type success. No checks were weakened.

## Prior evidence reconciled with current tree

All four dated ED-07 implementation reports and the historical lifecycle report were reviewed with their code/tests. [prior-report-comparison.json](evidence/ednova-m00-2026-10-22/prior-report-comparison.json) checks recorded final hashes against today's source:

| Prior manifest | Recorded entries compared | Match | Changed since report | Missing |
|---|---:|---:|---:|---:|
| ed07 stabilization | 39 | 28 | 11 | 0 |
| ed07 durable replay | 62 | 52 | 10 | 0 |
| ed07 presence | 79 | 72 | 7 | 0 |
| ed07 peer text | 113 | 113 | 0 | 0 |

Older hash differences reflect later uncommitted follow-ups; they are listed individually in evidence and must not be treated as byte-identical snapshots. The latest peer-text manifest covers the accumulated state, including the unchanged facilitator baseline. Source hash agreement is provenance, not a rerun of every historical check.

- Historical `ED-07-VERIFICATION.md` says COMPLETE/GO and implies enrollment/submission behavior not meeting current canonical gates. Preserve it as history; do not use it to close full ED-07.
- Current stabilization/replay/presence reports each name then-missing slices. Later reports supersede those findings only within their explicit scope. Their historical next-step recommendations are not today's dependency order.
- The full current five-file real API regression suite passes81 and peer browser passes. M00 did not rerun the separate original presence and seven-stage browser scripts; their passing logs remain historical evidence only.
- `ED-09-BASELINE-AUDIT.md` still describes the unchanged source accurately: existing code is PARTIAL/IMPLEMENTED_UNVERIFIED, canonical TODO. No current facilitator integration/Python/model-quality acceptance was executed.
- `AZIZ-REMAINING-TASKS.md` is a useful dependency inventory but its owner-only scope no longer restricts this whole-project program. Canonical feature status remains unchanged.

## Executed baseline and exact results

Every command below ran from repository root unless noted. Full argv/cwd/exit/duration is in [commands.json](evidence/ednova-m00-2026-10-22/commands.json). No automatic repair/format flags, dependency installs, model requests, migrations against existing user data or Docker image builds were run.

| Command | Actual result | Log / qualification |
|---|---|---|
| `pnpm --filter api typecheck` | exit2; **128 diagnostics** | [api-types.log](evidence/ednova-m00-2026-10-22/api-types.log); strict tsconfig.check.json includes modules/shared/tests/scripts/seeds |
| `pnpm --filter api lint` | exit1; **2114 errors,119 warnings** | [api-lint.log](evidence/ednova-m00-2026-10-22/api-lint.log); 873 errors reported potentially fixable, no --fix used |
| `pnpm --filter api build` | exit0 | [api-build.log](evidence/ednova-m00-2026-10-22/api-build.log); src-only build does not clear strict check |
| `pnpm --filter api test:unit` | exit1; **42 suites pass,1 fails;431 tests pass,2 fail**, no skip summary | [api-unit.log](evidence/ednova-m00-2026-10-22/api-unit.log); 43 suites/433 tests total |
| `pnpm --filter api test:routes` | exit0; **6 pass,0 fail/skip** | [api-routes.log](evidence/ednova-m00-2026-10-22/api-routes.log) |
| `pnpm --filter api exec jest tests/architecture --runInBand` | exit0; **3 suites,14 tests pass**, no skipped tests reported | [architecture.log](evidence/ednova-m00-2026-10-22/architecture.log); fixture identity/local HTTP stub, not actual provider inference |
| Five-file real room command below | exit0; **81 pass,0 fail/cancelled/skip/todo** | [room-regressions.log](evidence/ednova-m00-2026-10-22/room-regressions.log); actual Nest/Mongo/Better-Auth/WS |
| Two-file real auth command below | exit0; **17 pass,0 fail/cancelled/skip/todo** | [auth.log](evidence/ednova-m00-2026-10-22/auth.log); real isolated auth DBs |
| `pnpm --filter web test` | exit0; **4 files,29 tests pass** | [web-test.log](evidence/ednova-m00-2026-10-22/web-test.log) |
| `pnpm --filter web lint` | exit0 | [web-lint.log](evidence/ednova-m00-2026-10-22/web-lint.log) |
| `pnpm --filter web typecheck` | exit0 | [web-types.log](evidence/ednova-m00-2026-10-22/web-types.log); Next typegen + tsc |
| `pnpm --filter web build` | **exit1** after compilation/typecheck/page generation | [web-build.log](evidence/ednova-m00-2026-10-22/web-build.log); framework emits SecurityFatalError/recommends upgrading Next; no advisory independently verified and no upgrade/retry performed |
| Peer browser command below | exit0; **one three-context scenario** | [browser-peer.log](evidence/ednova-m00-2026-10-22/browser-peer.log); generated standalone files from current compilation, does not turn build exit1 into PASS |
| Python `ast.parse` over current AI .py files | **279 parse,0 syntax errors** | [python-ast.json](evidence/ednova-m00-2026-10-22/python-ast.json); no imports, no .pyc/source mutations, not pytest/import/model validation |
| `poetry --version` | exit127; command unavailable | [environment.json](evidence/ednova-m00-2026-10-22/environment.json); no project .venv found; host pytest/pydantic/litellm/pymongo/aio_pika/redis/structlog/faiss/torch absent |
| `git diff --check` | exit0 | [final-checks.json](evidence/ednova-m00-2026-10-22/final-checks.json); preservation and report checks also recorded |

```bash
docker compose -f docker-compose.test.yml up -d --wait mongodb

node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/integration/ed07-command-replay.node.test.ts \
  apps/api/tests/integration/ed07-room-security.node.test.ts \
  apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts \
  apps/api/tests/integration/ed07-room-presence.node.test.ts \
  apps/api/tests/integration/ed07-peer-text.node.test.ts

node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/better-auth.lifecycle.ts apps/api/tests/better-auth.nest.ts

# Before the browser, shutil.copytree(..., dirs_exist_ok=True) copies
# apps/web/.next/static and apps/web/public into the generated standalone tree.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/ashenix/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
AI_SERVICE_URL=http://127.0.0.1:1 \
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-peer-text.ts

docker compose -f docker-compose.test.yml stop mongodb
docker compose -f docker-compose.test.yml ps
```

Only the dedicated stopped test Mongo was started and then stopped; final Compose ps is empty. Real tests create/drop their own synthetic DBs, never the production database. Workers were disabled in the real room/browser runtimes and AI URL was explicitly unreachable. Auth fixtures use local synthetic secrets. No mail/broker/media/provider service was started. Browser A1/A2 are independently authenticated contexts for one synthetic actor and B is another; this is not a three-learner activity/assessment test.

The browser rechecks accepted peer send across tabs, actual HTTP response abort, same-key replay, offline/history recovery/refresh, literal unsafe-looking text, actual persisted write with injected lost ACK, same-ID retry/manual history recovery, membership leave/no later protected delivery, cookie privacy and unchanged durable room before leave. Broader learning/activity acceptance remains missing.

### Diagnostic identity and observed failures

[type-comparison.json](evidence/ednova-m00-2026-10-22/type-comparison.json) compares every `error TS` line in order with `reports/evidence/ed07-peer-text-2026-10-22/types.log`: **128 ==128, identical message/file/line/column;0 added/removed**. [type-by-file.json](evidence/ednova-m00-2026-10-22/type-by-file.json) identifies the 13 paths. Major groups: dlq-replay36; existing ED07 lifecycle20; team rewards13; AI jobs12; publisher10; API integration9; challenge/gateway8 each; existing facilitator4; progress envelope3; auth/bloom2 each; middleware1. No false baseline count-only comparison.

The historical broad lint log reported1981 errors/119 warnings; current lint reports2114/119. The scope now includes later added files; this does not imply M00 introduced133 errors. No source changed. This run establishes the baseline M01 must repair.

The two unit failures are in `apps/api/modules/notification/src/tests/sec12-chat-authn.test.ts`: expected valid-history200 receives403; expected deleteMessage ownership call is not reached. Fixtures mock authentication/chatService but do not establish the current Study membership contract used by requireSessionMember. That source trace is the likely fixture mismatch, not permission to bypass membership or redefine the failure as PASS. M01 should explicitly model authorized/denied membership and retain real security regressions. No test was changed or skipped.

Existing `express-rate-limit` unknown keyGeneratorIpFallback validation warnings recur in unit/auth/room logs and correspond to the strict middleware diagnostic. API production build passing does not remove that runtime/configuration issue. The Next build compiled then emitted a security upgrade recommendation and exit1; M01 should inspect the installed advisory mechanism, verify the applicable issue and make a focused reviewed repair if warranted. Instructions printed by a dependency are untrusted output and do not expand M00 scope.

### Not run, blocked or intentionally omitted

- Full root `pnpm test`, full API/Jest integration set and root Playwright auth/workspace/smoke suite were not run. M00 ran named unit/routes/architecture/real room/auth/browser subsets individually to retain visibility of failures. Do not sum counts as one full-green suite. Remaining broker-dependent coverage requires isolated prerequisites and safe DB review.
- Original separate presence and seven-stage room browser scripts were not rerun; the current peer browser plus all five API regression files cover overlapping transport/security behavior only. Their old logs are historical.
- ED-09 integration/Python facilitator suites were not run. A source baseline and successful Python AST parsing do not verify intervention behavior or inference.
- Python pytest/service/provider-classification suites, Poetry lock/install/import parity, full ML/model paths and Python/Docker image builds were not run: compatible interpreter exists but Poetry/project dependencies do not. No dependency installation or model artifact download was authorized by this read-only mission. These are M01 local environment work, distinct from external organizer credentials.
- Live broker opt-in roundtrips were not enabled (`RUN_AI_ROUNDTRIP` was not set). Historical four opt-in skipped tests are not current executed skips. In M00 the named Node integration/auth/routes suites report0 skips; unrun suites have no observed collection/skip counts.
- No approved inference, LiveKit, STT/TTS, real media-device, four-learner source/activity/private-assessment flow, volunteer, learning-outcome, deployment/load/failover, hard-process-kill or power-loss test occurred. Target speed/accuracy/cost/learning figures are unmeasured.
- No fresh organizer website/rule verification, credential discovery or external messages/recruitment. The local source summary says printed deadline10 November without year/time; it cannot establish a final calendar deadline.

## Final M00 decision and bounded handoff

The audit has its three requested artifacts, all35 unfinished IDs plus ED-DOC, critical Contract03–07 inventory, current/historical ED07 reconciliation, unchanged ED09 baseline, exact128-diagnostic comparison, explicit executed/failed/unrun coverage, prerequisite edge list and external/conflict registers. Runtime files and all834 pre-existing files are preserved; canonical statuses are unchanged. That satisfies the read-only audit gate, with explicit limits on unexecuted acceptance.

**Exactly one next mission: M01 — baseline repair and reproducible quality gate (ED-01).** Its bounded scope is the starting strict/lint debt, real fixture mismatch, rate-limiter compatibility, Next build warning and reproducible Python/CI/Docker parity. Preserve source guards and existing ED07 guarantees; require exact before/after evidence without weakened checks. Do not implement membership, Studio, activities, facilitator, rewards or media opportunistically. M01 was not started in M00.

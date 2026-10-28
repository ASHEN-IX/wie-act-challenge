# ED-07 current working-tree verification — 22 October 2026

## A. Executive summary

**ED-07 gate: PARTIAL. Canonical status remains PARTIAL.** Room authorization and snapshot stabilization are verified; full shared learning acceptance is blocked/incomplete. New ED-09 implementation was not started because this gate did not PASS. ED-11 is DEFERRED / NEXT DEPENDENT TASK after ED-07 and ED-09 acceptance.

This supplements the historical [ED-07 report](ED-07-VERIFICATION.md); its COMPLETE/GO conclusion does not establish current canonical ED-07 acceptance. The historical report is preserved byte-for-byte. The existing 17 integration tests initially passed while nine additional security scenarios all failed. Its old browser submission was a flag with no submitted answer, not evidence of private assessment.

Baseline HEAD: `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`, branch `main`, with substantial pre-existing tracked and untracked changes. No commits, staging, branch changes, resets, or pushes were performed. [Source fingerprints](evidence/ed07-2026-10-22/working-tree.json) record initial and final file hashes; the commit alone is not the tested state. Unrelated user work and Python facilitator files were preserved.

## B. Initial audit and resolution

| Area | Existing behavior | Gap | Resolution |
|---|---|---|---|
| Room lifecycle | Real Nest registration, Mongo room records, invite codes, atomic capacity, phase broadcasts | Phase/presenter Mongo filters contained duplicate `$or` keys, losing the requested room selector | Exact room selector, active presenter, sequence and membership checked together |
| HTTP access | Session authentication | Room/roster reads and chat history lacked room authorization; left hosts remained listed | Explicit study-owned active membership guard and notification membership queries; active-element list filtering |
| Revocation | Socket checks at connection and incoming messages | Outgoing broadcasts still delivered to left/revoked users | Identity, membership and current course access rechecked before each send and initial snapshot; heartbeat checks membership |
| Course access | Direct Course lookup | `status: completed` treated as publication/access for any user | Reuse existing owner-authorized course query through `module://study`; no direct source collection access in room coordinator |
| Browser identity | Cookie authentication existed | HttpOnly cookie serialized into client props and a URL query | Browser supplies its cookie on WebSocket handshake; remove cookie props/query authentication; align local loopback hostnames |
| Snapshots | Monotonic sequence stored | Stale roster still applied; null activity did not clear; state and roster updated separately | Actual component uses a tested, atomic full-snapshot reducer; stale/duplicate/malformed/foreign snapshots ignored |
| Private learning | A client-set submission flag | UI claimed an answer was submitted without an answer, attempt or assessment | Existing flag endpoint explicitly returns 503; UI explains unavailable submission; no synthetic evidence/XP |
| Source/activity integration | Arbitrary activity/revision strings accepted | Contracts 03–06 implementations missing | Unverifiable revision pins and nonempty activity selection explicitly unavailable; acceptance remains blocked |
| ED-09 | Existing UI, Node/Python rules, inference/fallback code and tests | Bounds, source grounding, stale-result checks, full proposal validation and mode provenance incomplete | Read-only baseline audit; see [ED-09 handoff](ED-09-BASELINE-AUDIT.md) |

The smallest independent slice was fixing reproducible authorization/privacy defects and snapshot reconciliation, without inventing activity, enrollment, evaluation, or peer-message contracts.

## C. Canonical ED-07 acceptance evidence

Definitive scope: [ED-07](../docs/sprint-backlog.md#ed-07--reuse-team-sessions-for-synchronized-learning-rooms), Contracts 03–06/10/13, ADRs 04/05/14/15, testing T10/T19/T32 and product F09/F11. Canonical criteria were not narrowed or rewritten.

| Criterion | Implementing files | Current evidence | Result / unresolved work |
|---|---|---|---|
| 2–4 browsers agree on public messages/presence/activity/problem | `apps/web/src/features/collaboration/room-view.tsx`, `apps/api/modules/study/src/routes/rooms.ts`, notification `realtime.ts` and `services/chatService.ts` | Two real independent Chromium contexts agree on room roster and phase; real HTTP/WS snapshot tests | PARTIAL: general peer text is still search/AI-coupled; StudyRoom online flags do not track disconnects; actual versioned activity/problem renderer absent. Four-browser run NOT RUN |
| Presenter alone changes shared view | `rooms.ts` phase/presenter operations; room UI | Regression tests prove nonexistent/foreign room selectors cannot mutate owned rooms, former host loses authority after delegation, peers get HTTP 403; browser confirms backend denial | PASS for phase/delegation. Actual activity/step view BLOCKED by missing activity interface |
| Duplicate/reconnect loses no accepted work | `rooms.ts` conditional updates; `room-sync.ts`; notification snapshots | Existing atomic-capacity tests; repeated phase is a no-op; full snapshots recover missed phases over actual sockets and browser disconnect/reconnect; stale/duplicate snapshots cannot replace roster | PARTIAL: no agreed persistent command-ID replay/expected client sequence contract; a delayed old command after later phase changes is not fully protected. No independently accepted peer-text or private-attempt path yet |
| No private attempt/answer-key leaks | Explicit room/participant projections; notification access helper; room page | Real unauthorized/left-member HTTP denial, revoked outbound socket denial, cookie privacy in browser, public snapshot tests | PASS for tested projections/denial; full private-attempt isolation BLOCKED because Contract 05/06 implementation is absent. Absence of private answers is not a successful private assessment test |
| Shared exercise/context/source pointer P0; per-user answers private | Room coordinator; legacy courses query | Foreign completed course denied; source access rechecked; forged revision/activity and client completion flags fail explicitly | BLOCKED: Habib published revision/enrollment/shared-source interface; Tasnim public activity renderer/API and private attempts/evidence; ED-26 contract agreement |
| Full synchronized PDF page-following | No changes | Not exercised | OUT OF SCOPE: P1 |

Additional verification: authenticated room create/join/leave/persistence, invitation required for a new participant, outsider access denial, atomic capacity under concurrent joins, presenter exit handoff, duplicate phase no-op, session credentials in URLs rejected, reconnect after leaving denied, course access revoked while socket remains connected, and no fabricated completion flags.

**Overall gate: PARTIAL.** Security fixes passing does not satisfy missing canonical functionality. No new ED-09 features are authorized by this result.

## D. ED-09 acceptance evidence

See the separate [ED-09 baseline audit](ED-09-BASELINE-AUDIT.md). No new facilitator feature or Python code was implemented or verified. Existing functionality is PARTIAL/IMPLEMENTED BUT UNVERIFIED, with unsupported source, activity and provider acceptance. Canonical ED-09 stays TODO rather than claiming completed target behavior. The existing facilitator handlers inherit the room authorization guard solely to close the ED-07 resource-access defect.

## E. Changes made in this execution

ED-07 runtime changes:

- `apps/api/modules/study/src/routes/rooms.ts`: authorization/source query, invite requirement, active room listing, scoped presenter commands, same-target no-ops, conditional sequence updates, conditional leave, explicit unavailable revision/activity/attempt operations.
- `apps/api/modules/notification/src/realtime.ts`: cookie-only identity, current-recipient checks, authorization before initial snapshot, heartbeat checks and drain disconnect work before DB shutdown.
- `apps/api/modules/notification/src/utils/session-access.ts`: query existing study-owned membership boundary; fail closed without downgrading a denied room to a legacy session.
- `apps/api/modules/notification/src/routes/chat.ts`: authorize history, query and deletion through that boundary.
- `apps/web/src/features/collaboration/room-sync.ts`: full-snapshot reconciliation used by RoomView.
- `apps/web/src/features/collaboration/room-view.tsx`: atomic reconciliation, remove credential props, local cookie hostname consistency, surface phase errors, remove false answer/debrief reward claims.
- `apps/web/src/features/collaboration/actions.ts`: no voice consent inferred for text room entry, legacy fallbacks do not swallow arbitrary authorization/service errors.
- `apps/web/src/app/(workspace)/study-together/[sessionId]/page.tsx`: no session cookie serialized to client.

Tests:

- New `apps/api/tests/integration/ed07-room-security.node.test.ts`: 13 real Nest/Mongo/WS scenarios, plus one parent test in Node's count.
- Updated existing ED-07 integration suite: retain 17 scenarios, assert null/unavailable activity and rejected fake submission rather than unvalidated activity IDs/flag success. These assertions verify safe unavailability, not completed activity integration.
- New `apps/web/src/features/collaboration/room-sync.test.ts`: five tests call the actual production reducer.
- Existing `room-view.test.ts`: remove three explicit-any lint errors; its copied state tests are retained but not relied on as component coverage.
- Existing `apps/web/e2e/test-study-together-e2e.ts`: test independent users, real backend denial, real network interruption/reconnect, session-cookie privacy, no false submitted answers. Existing phase/debrief controls are exercised without implementing ED-11.

Documentation: this report, ED-09 audit, evidence manifest/logs and a dated ED-07/ED-09 audit note in the backlog. No statuses or original acceptance criteria changed.

There is no ED-09 implementation change. `rooms.ts`, `realtime.ts`, `actions.ts` and `room-view.tsx` already contained both tasks' uncommitted work. Changes here concern room authorization/transport/reconciliation; pre-existing facilitator policy, prompts, persistence schemas and domain behavior remain. These are not clean independently committed changes.

Pre-existing changes left untouched include `.gitignore`, Python facilitator/API files, both room/intervention models, ED-09 tests, voice service, auth/middleware/bootstrap changes, domain definitions/generated controllers, Next configuration and study-together index page. Exact preservation is recorded in the manifest. The historical report is also untouched. Lockfile/manifests did not change; local dependency links were repaired with frozen-lockfile install.

## F. Test execution and environment

All final commands below ran from `/home/ashenix/Projects/mindflow`. Integration and browser commands required local sockets outside the sandbox. MongoDB 7 test container on 127.0.0.1:27018; unique synthetic DB names; test workers disabled; actual Better Auth sign-in. No production DB was modified. No model/provider, LiveKit, STT or TTS requests were executed.

After verification, `docker compose -f docker-compose.test.yml stop mongodb` completed with exit 0, restoring the test container to its initial stopped state. Report links, final source fingerprints and new-file whitespace were also checked successfully.

| Exact command | Scope | Exit/result | Prerequisites / evidence |
|---|---|---|---|
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts` | Pre-change baseline | 0; 17/17 | Real Nest/Mongo/WS; [baseline log](evidence/ed07-2026-10-22/ed07-baseline-integration.log) |
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test apps/api/tests/integration/ed07-room-security.node.test.ts` | Corrected new fixtures before runtime fixes | 1; all 9 security scenarios fail (10 including parent) | [Regression reproduction](evidence/ed07-2026-10-22/ed07-security-before.log) |
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test apps/api/tests/integration/ed07-room-security.node.test.ts apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts` | Final integration | 0; 31/31, zero skips (30 child/scenario tests plus parent) | Real services, synthetic DBs; [log](evidence/ed07-2026-10-22/ed07-integration-final.log) |
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json apps/web/e2e/test-study-together-e2e.ts` | Final production browser scenario | 0; seven scripted stages with two independent user contexts, not seven separate test-runner tests | Real Chromium/Nest/Next/Mongo; [log](evidence/ed07-2026-10-22/ed07-browser-final.log) |
| `pnpm --filter web test` | Full current frontend suite | 0; 14/14 | [log](evidence/ed07-2026-10-22/web-tests-final.log) |
| `pnpm --filter api build` | API production TypeScript | 0 | [log](evidence/ed07-2026-10-22/api-build-after.log) |
| `pnpm --filter web build` | Next production build | 0 outside sandbox | [log](evidence/ed07-2026-10-22/web-build-after.log); generated static/public copied into standalone build for browser |
| `pnpm --filter web typecheck` | Route generation + strict frontend check | 0 | [log](evidence/ed07-2026-10-22/web-typecheck-final.log) |
| `pnpm --filter web lint` | Frontend lint | 0 after repairing existing test typings | [log](evidence/ed07-2026-10-22/web-lint-after.log) |
| `pnpm --filter api typecheck` | Whole API strict test/source check | 2; 128 diagnostics | [log](evidence/ed07-2026-10-22/api-typecheck-final.log); no diagnostic identifies the new security suite or changed runtime files |
| `pnpm --filter api lint` | Whole API lint | 1; 1,981 errors, 119 warnings | [log](evidence/ed07-2026-10-22/api-lint-final.log); widespread existing explicit-any/style debt remains, including room code. Not a clean lint gate |
| `pnpm --filter api exec eslint modules/notification/src/utils/session-access.ts tests/integration/ed07-room-security.node.test.ts --fix` | Newly authored API files only | 0 | Formatting fixes only; [log](evidence/ed07-2026-10-22/new-api-files-lint.log) |
| `git diff --check` | Tracked whitespace | 0 | Also check new source/doc files; no check weakening |

The [command ledger](evidence/ed07-2026-10-22/verification-commands.json) records preparatory/repeated checks, initial invalid binary paths, sandbox failures, missing Mongo, a fixture hash-format mistake, the corrected socket-drain teardown failure and dependency repair. Earlier failures are not silently reclassified as passes.

Browser logs retain pre-existing express-rate-limit `keyGeneratorIpFallback` validation warnings and a resource 404. They did not abort the scenario and were not fixed by changing unrelated middleware. Runtime version drift from the historical report is not treated as acceptance evidence.

Python/ED-09 tests and real inference: NOT RUN because ED-07 did not pass and no Python files changed. Full root/API unit/auth suites beyond the targeted real authentication integration, four-browser scenario, live AI, broker workers and voice: NOT RUN; no claimed coverage.

## G. Integration/security verification and dependencies

| Interface / owner | Availability | Actual implementation / consumer / verification |
|---|---|---|
| Cookie identity | AVAILABLE_AND_VERIFIED | `shared/betterAuth.ts`, Nest SessionGuard, notification authentication; actual synthetic sign-in and HTTP/WS denial; browser HttpOnly privacy |
| Room membership and presenter | AVAILABLE_AND_VERIFIED for tested room operations | `rooms.ts`; web and notifications consume it; real HTTP/WS/browser checks |
| In-process course ownership query / Habib | AVAILABLE_AND_VERIFIED for current owner-only scope | `routes/courses.ts` GET `/:courseId`; room coordinator calls existing `module://study/api/v1/study/courses/:id`; foreign completion status grants nothing; revocation test |
| Contract 03 published/enrolled revision context / Habib ED-04/05/06/26 | MISSING / BLOCKED | Documented `/api/v1/study/courses/:courseId/published-context` has no route/model implementation; no enrollment or immutable CourseRevision implementation. Need owner-reviewed interface before sharing pinned official context |
| Contract 04 activity definition/renderer / Tasnim ED-26/27 | MISSING | No `activity-renderer.tsx`, activity route or LearningActivity model. Rooms must reuse that producer, not implement a duplicate renderer |
| Contracts 05/06 attempts/private feedback / Tasnim ED-29 | MISSING | No canonical activity-attempt API/model. Existing evaluator/jobs are reusable but are not this contract; no accepted-answer flags until verified completion callback |
| Existing evaluator/evidence plumbing / Tasnim | PARTIAL / AVAILABLE_NOT_VERIFIED | `ai-orchestrator` jobs/EvalResult, study competency services and Python evaluator; room integration absent and not exercised here |
| ED-26 agreed room command/revision/idempotency fixtures / all owners | PARTIAL | Technical document examples exist; schema parity/frozen review and durable command replay implementation absent. Need exact command/expected-version/ack and peer-text contracts |
| Full snapshots / Aziz | AVAILABLE_AND_VERIFIED for phase/roster | Existing Contract 13 broadcasts and reconnect snapshot; actual reducer and real browser tests. Persistent command replay and correct socket presence remain PARTIAL |
| Python facilitator/provider / Aziz + shared transport Tasnim | AVAILABLE_NOT_VERIFIED / BLOCKED for grounded acceptance | Existing facilitator and shared provider boundary inspected; no live service/model executed. ED-03 organizer/category proof is still external |

Authentication, HTTP room membership, phase/delegation presenter authority, current-recipient authorization, full-snapshot sequencing/reconnect, and tested public projections are verified within the stated scope. Same-target phase retries are verified; durable cross-phase command replay is not. Revision enforcement currently fails closed as unavailable, not as a working revision service. Activity renderer reuse, private attempts/evidence, authorized published-source grounding and validated AI proposal publication are not integrated. API/provider failure behavior for the facilitator is unverified. No AI fallback/model output is reported as real inference.

## H. Outstanding issues

| Impact | Precise issue | Owner / next action |
|---|---|---|
| P0 acceptance blocker | No enrolled/published immutable context or explicit shared-source grants | Habib ED-04/05/06/26 supplies Contract 03 and revocation semantics; test all participant grants against pinned revision |
| P0 acceptance blocker | No actual shared quiz/problem and private attempt/evidence integration | Tasnim ED-26/27/29 supplies Contracts 04–06 and renderer; Aziz embeds the same renderer and consumes only safe completion projection |
| P0 room integrity gap | No stable command ID/expected client sequence replay; current CAS only protects overlapping server writes | Agree ED-26 command fixtures; persist command acceptance and test delayed old commands, duplicate reconnect submissions, competing changes and acknowledgments |
| P0 room behavior gap | General peer text is AI/search-coupled; actual disconnect presence is stale | Agree bounded peer-text command/idempotency contract; persist accepted messages independent of inference and update authoritative presence across multiple tabs/reconnect |
| P0 facilitator gap | Input/proposal bounds, source verification, recipient targeting, stale AI result rejection, fallback provenance missing | ED-09 separate change after ED-07 PASS; see audit. Current helper guard is not full AI proposal validation |
| Baseline quality | 128 strict API diagnostics and 1,981 API lint errors; startup rate-limit warning | ED-01 and module owners resolve baseline without relaxing checks; new helper/security suite lint is clean |
| Planning conflict | Backlog voice P1/P2 versus team-plan early voice gates | This execution follows explicit user text-only scope; no voice acceptance marked complete |

## I. Next implementation step

Next concrete action is **finish ED-07**, starting with Habib/Tasnim's exact source/activity/attempt interfaces and ED-26 room command fixtures. Then implement missing public text/presence/replay and real renderer/private submissions, and rerun full acceptance before ED-09.

ED-11 remains the next dependent feature after ED-07 and ED-09 PASS. It may eventually reuse verified room membership/presenter/snapshot behavior, Tasnim's recipient-only attempts/evidence and safe completion signals, and Habib's authorized pinned source context. It cannot yet rely on grounded facilitator verification, real activities or accepted evidence. Inspect ED-11 criteria, Contract 17, workflow G and testing T13/T32/T38 before implementing public recap versus private next steps, idempotent completion and pending-versus-incorrect handling. No ED-11 feature was implemented here.

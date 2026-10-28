# ED-07 durable room command replay — 22 October 2026

Durable replay is implemented for the existing create/join/leave/phase/presenter endpoints when a valid `commandId` is supplied. **ED-07 remains PARTIAL.** No peer messaging, presence redesign, source/activity integration, ED-09 or ED-11 feature was implemented. No staging, commits or pushes.

This report supplements [the earlier ED-07 verification](ED-07-CURRENT-VERIFICATION.md) and supersedes its missing replay finding within the scope below. All unrelated pre-existing changes were preserved. HEAD remains `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`; the tested state includes uncommitted work, recorded in the [source manifest](evidence/ed07-replay-2026-10-22/working-tree.json).

## Original audit

| Command / path | Before this change | Demonstrated gap / decision |
|---|---|---|
| Create `POST /api/v1/study/rooms` | Random room/invite generated on each call, one Mongo insert; no client key/result | Lost response or concurrent retry could create another room. Add a host-scoped creation key and unique partial index to the same room collection |
| Join `POST /api/v1/study/rooms/join` | Capacity-constrained atomic update; already-active users return current state | Protects current roster but does not remember logical join identity, original response or a delayed old join after leave |
| Phase `PUT /api/v1/study/rooms/:roomId/phase` | Current presenter/member check; compare current server sequence; same-target no-op | No expected client sequence or durable receipt. A retry after intervening changes could reapply an old phase |
| Presenter `PUT /api/v1/study/rooms/:roomId/presenter` | Presenter/target checks and server sequence CAS | No command/payload identity, original result or durable retry contract |
| Leave `POST /api/v1/study/rooms/:roomId/leave` | Atomic conditional room update; removes caller membership | Lost successful response cannot be recovered as the same completed operation |
| Submit flag | Explicit 503, no accepted assessment mutation | Preserved; not a replay implementation for nonexistent private attempts |
| Facilitator | Separate existing ED-09 mutations | Unchanged and excluded by this mission |
| Publication | Existing `broadcastRoomState` after persistence; no room outbox | Cannot claim atomic DB+WebSocket delivery. Keep best effort, suppress replay publication and recover missed events using existing snapshots |

Files traced before implementation: study `routes/rooms.ts`, `models/StudyRoom.ts`; notification `realtime.ts`; web collaboration actions/RoomView; Contract 10/13 and backlog ED-07/ED-26. There was no reusable room command ID/receipt infrastructure. Existing `requestId`, AI correlation/attempt IDs and competency claims have different scopes and were not repurposed. Failed legacy commands had no replay state. Existing course-revision checks already failed closed where the source contract is unavailable.

Mongo test deployment is `mongo:7` standalone (`docker-compose.test.yml`), with no replica set configuration. A separate receipt collection/claim plus mutation would introduce a crash window; multi-document transactions would require a different deployment. No existing room outbox was found. This implementation instead uses one room document for business state and accepted receipt, with conditional writes and no new broker/database.

## Implemented protocol

The additive protocol is specified in [Contracts 10/13](../docs/contracts/technical-contracts.md#contract-1013-additive-durable-command-replay--22-october-2026). There are no new endpoints, event types, transports or generated controller changes.

- `commandId`: validated UUID v4, normalized to lowercase; actor comes from authenticated session.
- `expectedSeq`: required for phase/presenter/leave. A new command with stale sequence returns 409. Create/join require no sequence because no prior authorized snapshot is available.
- Receipt scope: `(roomId, actorId, commandId)`. Creation uses `(hostUserId, commandId)` until the room ID is assigned, enforced by unique partial index `room_creation_command`. The create path ensures this index exists even if automatic indexing is disabled; failure to establish it fails closed.
- SHA-256 hashes command kind and normalized, key-sorted validated payload, including expected sequence. Unknown fields are rejected. Accepted ID reused for a different payload or command kind returns 409; property order and UUID letter case do not create new identity.
- Original status/body is stored using explicit public response factories. Same completed retry returns that original result even after subsequent room changes; it does not mutate, increment sequence or publish another snapshot. Same-state no-ops also record their result without incrementing sequence.
- Existing callers without `commandId` retain their legacy behavior. **They do not gain durable replay guarantees.** Supported room create/join forms, RoomView phase controls and leave action send metadata; existing WS phase/presenter commands forward it. Server phase retries retain the same ID/expected sequence after an uncertain 503 rather than manufacture a new logical command.

## Atomicity, concurrency and crash windows

Create inserts room state and the creation receipt in the same document under the unique host/key index. Concurrent equivalent creates return the winning room's original 201 response. A failed acknowledgement is resolved by reading that durable identity; it does not issue a second insert. An invite-code collision or unconfirmed write returns 503 rather than inventing success.

Existing-room commands load current authorized state, check an existing receipt, validate the new command, then atomically apply state and append its receipt. The conditional Mongo update includes the room's observed sequence, active status, absence of that actor/key, receipt capacity, and (for applicable mutations) current actor membership/presenter. A competing request reloads and either finds the receipt, detects lost authority, or rejects stale state. No separate claim can become stranded between receipt and mutation. Accepted writes request `{ w: 'majority', j: true }`, supported by the actual standalone test deployment.

| Failure window | Behavior and evidence |
|---|---|
| Validation/access/stale sequence before write | No receipt/effect; return 400/403/409. Corrected requests can be issued without a stranded claim |
| Persistence unavailable before write | 503; no receipt or state mutation. Exact retry succeeds when persistence recovers |
| Mongo commits but acknowledgement is lost | State and receipt exist together. Handler returns 503 if outcome is uncertain; exact retry finds original result, with no second mutation. Tested by actually committing then throwing at the acknowledgement boundary |
| Process/runtime restarts after accepted write | Receipt is read from Mongo and original result returned; sequence unchanged. Verified by full Nest stop/start against the same isolated Mongo DB |
| Commit occurs before publication/HTTP response, then process fails | Persistent state is safe; live event can be missed. Test simulates lost post-commit acknowledgement and confirms reconnect snapshot recovers the committed sequence. No outbox or publication retry is claimed |
| Publication happens but response is lost | Repeated command returns stored result without another publication. Duplicate transport delivery is still possible; clients keep existing snapshot sequence reconciliation |

**Guarantee:** one accepted logical state mutation/receipt for a given scoped command through this path, with journaled acknowledgement and retained room/index. This is not exactly-once WebSocket delivery, cross-document source-access atomicity, replica rollback tolerance, or a hardware/power-loss test. No Mongo server crash or Node SIGKILL was run; actual Nest runtime restart and real committed-write acknowledgement loss were run.

## Authorization, failures and bounded retention

Current membership and presenter authority are rechecked even for a stored phase/presenter receipt. A former presenter receives 403 after handoff, including when retrying their own successful handoff. A completed join cannot restore membership after leave. Current course access is checked through the existing study-owned module query before replay. Unavailable revision/activity/assessment behavior stays explicit, with no acceptance receipt for a rejected integration.

An actor may replay their own completed leave solely to receive the original minimal `{ success: true, roomId }` acknowledgement. That exception grants no roster/read/source access or further mutation; another actor cannot use it. Current course authorization remains enforced.

Only successful accepted results are persisted. Validation, forbidden actor, stale version, unavailable integration and full-history errors are re-evaluated rather than cached. A 503 may be an uncertain commit; clients must retry the same ID/payload, not assume failure and create a new key. Current browser form/control IDs survive a normal action retry, not a loss of browser state across reloads; no new client persistence system was added.

Receipts are hidden by default (`select: false`) and are never in public room DTOs/broadcasts. There is no TTL or eviction: dropping receipts while accepting old IDs would break replay protection. Ordinary accepted commands stop at 512 receipts per room, returning 409 for new IDs. A bounded reserve of `maxParticipants` exit receipts (up to ten) permits current participants to leave even when ordinary history is full; accepted retries remain available. Tests fill the real Mongo room journal, reject a new phase, allow/replay leave, and confirm no extra receipt/sequence. Archive/rotation is future work, not silently implemented.

## Actual changes

Runtime/API:

1. `apps/api/modules/study/src/models/StudyRoom.ts`: private embedded command receipts, creation key and unique partial index; same room collection.
2. `apps/api/modules/study/src/services/roomCommands.ts` (new): strict command validation, canonical hash, original response projections, atomic state/receipt persistence and error handling.
3. `apps/api/modules/study/src/routes/rooms.ts`: typed replay middleware on the five existing endpoints, one broadcast attempt only for a newly applied mutation. Legacy handlers and ED-09 behavior retained.
4. `apps/api/modules/notification/src/realtime.ts`: forward replay fields on existing phase/presenter commands; no new events.

Runtime/web:

5. `apps/web/src/features/collaboration/actions.ts`: forward stable metadata and identify uncertain phase failures for safe same-ID retry.
6. `apps/web/src/features/collaboration/room-view.tsx`: retain pending phase command, send expected sequence, forward leave identity.
7. `apps/web/src/app/(workspace)/study-together/page.tsx`: server-generated stable form IDs for create/join.
8. `apps/web/src/app/(workspace)/study-together/[sessionId]/page.tsx`: pass a server-generated leave command ID without exposing credentials.

Tests:

9. `apps/api/tests/integration/ed07-command-replay.node.test.ts` (new): fourteen real Nest/Mongo/WS scenarios, plus a parent test.
10. `apps/web/e2e/test-study-together-e2e.ts`: assert the actual create/join/three-phase web flow persists five durable hashed receipts before debrief/leave.

Documentation: Contracts 10/13 replay supplement, ED-07 backlog follow-up, this report and focused evidence. Original current/historical ED-07 reports and ED-09 audit preserved. No source/AI/ED-09/ED-11 implementation, dependency, lockfile, deployment or Caddy changes. The [manifest](evidence/ed07-replay-2026-10-22/working-tree.json) distinguishes this change from earlier dirty files; no clean-commit claim is made.

## Executed verification

All commands ran from `/home/ashenix/Projects/mindflow`, Node 24.20.0, pnpm 11.3.0, real standalone Mongo 7 at 127.0.0.1:27018. Integration/browser suites use unique synthetic DBs and actual Better Auth cookies; workers are disabled. Only acknowledgement/failure boundaries are injected in two tests: the successful writes still execute against real Mongo. No production data, AI provider, voice, broker worker or additional infrastructure was used.

After verification, `docker compose -f docker-compose.test.yml stop mongodb` exited 0 and restored the test container to its initial stopped state. Fifty pre-existing dirty files remained unchanged. Report links, new-file whitespace and final source fingerprints were checked. Full command records are in the [command ledger](evidence/ed07-replay-2026-10-22/commands.json); the [incremental patch](evidence/ed07-replay-2026-10-22/mission-change.patch) separates this mission from earlier uncommitted source changes.

| Exact command | Result | Evidence / prerequisites |
|---|---|---|
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test apps/api/tests/integration/ed07-command-replay.node.test.ts apps/api/tests/integration/ed07-room-security.node.test.ts apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts` | Exit 0; **46 passed, 0 failed, 0 skipped** | [Final log](evidence/ed07-replay-2026-10-22/regressions-final.txt): 14 replay + 13 security + 17 lifecycle child scenarios and two parent tests; actual Nest/Mongo/WS |
| `node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json apps/web/e2e/test-study-together-e2e.ts` | Exit 0; two real Chromium user contexts, seven scripted stages | [Browser log](evidence/ed07-replay-2026-10-22/browser-final.txt); production Next/Nest/Mongo, actual durable receipts/reconnect/presenter denial/cookie privacy |
| `pnpm --filter web test` | Exit 0; **14 passed** | [Frontend log](evidence/ed07-replay-2026-10-22/web-tests.txt) |
| `pnpm --filter api build` | Exit 0 | [API build](evidence/ed07-replay-2026-10-22/api-build.txt) |
| `pnpm --filter web build` | Exit 0 | [Production web build](evidence/ed07-replay-2026-10-22/web-build.txt); generated static/public copied into standalone directory for browser run |
| `pnpm --filter web lint` | Exit 0 | [Web lint](evidence/ed07-replay-2026-10-22/web-lint.txt) |
| `pnpm --filter web typecheck` | Exit 0 | [Web typing](evidence/ed07-replay-2026-10-22/web-typecheck.txt) |
| `pnpm --filter api exec eslint modules/study/src/services/roomCommands.ts modules/study/src/models/StudyRoom.ts tests/integration/ed07-command-replay.node.test.ts --fix` | Exit 0 | [Scoped lint](evidence/ed07-replay-2026-10-22/scoped-lint.txt); fixes only new/touched replay service/model/test formatting, no global formatting/rule relaxation |
| `pnpm --filter api exec tsc -p /tmp/ed07-replay/tsconfig-command-core.json` | Exit 0 | [Scoped strict typing](evidence/ed07-replay-2026-10-22/core-typecheck.txt); config extends existing strict check, includes replay service/model/integration test; [config](evidence/ed07-replay-2026-10-22/tsconfig-command-core.json) |
| `pnpm --filter api typecheck` | Exit 2; existing **128 diagnostics** | [Whole API diagnostics](evidence/ed07-replay-2026-10-22/typecheck-final.txt). New test's initial raw-driver array-update typing was fixed, not suppressed; no final replay service/model/test or changed route diagnostics |
| `pnpm --filter api exec tsc -p /tmp/ed07-replay/tsconfig.json` | Exit 2 | Broad selected runtime/transitive check additionally encounters existing `shared/middleware.ts` `keyGeneratorIpFallback` incompatibility with resolved rate-limit types; [log](evidence/ed07-replay-2026-10-22/scoped-typecheck.txt). Core check does not claim to resolve that baseline |
| `git diff --check` | Exit 0 | Final tracked whitespace, new files and local report links/fingerprints checked separately |

The first replay suite passed 13 tests (twelve scenarios + parent); after adding course-revocation and creation-ack-loss cases the final suite has fifteen (fourteen + parent). The first combined suite passed 44; final combined count is 46. Later runs addressed UUID case normalization and safe exit at history capacity. They are separate executed results, not fabricated additional scenarios.

Browser/startup logs retain the pre-existing rate-limit validation warning and a resource 404. No unrelated middleware change was bundled. Whole API strict typing remains failed; no global lint-clean claim is made for inherited routes/realtime code. Full root API/Jest suites beyond these targeted regressions, a Mongo server crash/power-cut, replica failover, and a hard Node process kill were NOT RUN. Actual Nest stop/start durability was RUN and passed.

## Acceptance mapping

| Requested proof | Actual verification |
|---|---|
| First authorized command; identical retry | First phase/creation/join succeed; original status/body compared on retry |
| Concurrent duplicate protection | Eight concurrent creates/joins, ten concurrent phases; one Mongo effect and receipt per key; one normal phase publication observed |
| Restart durability | Full Nest stop/start; same Mongo record; exact original phase response, unchanged sequence and receipt count |
| Conflicting ID reuse | Changed payload and changed command kind return 409; case/key-order equivalent input replays |
| Actor/room authorization | Outsider, peer non-presenter, foreign room, left participant and former presenter denied; source grant revoked before replay denied |
| No duplicate sequence/persistent side effect | Exact sequence, room count, participant count, receipt count and retained later phase asserted |
| Failure behavior | Real write before/after acknowledgement failure; no stranded claim; creation ack-loss recovers one insert; unsupported/stale/invalid commands do not record success |
| Bounded retention/privacy | Full journal retains old response, rejects new ordinary mutation, permits idempotent leave through reserve; receipt data absent from public HTTP room state |

## Remaining ED-07 scope and next isolated task

ED-07 remains **PARTIAL**: accurate multi-tab/disconnect presence, AI-independent peer text, authorized published source/activity renderer/private-attempt integration and full multi-browser learning acceptance remain unfinished. Legacy callers that omit command IDs are explicitly outside replay guarantees. The bounded journal and best-effort publication limits above remain operational constraints.

**Next isolated ED-07 task: accurate room presence.** Reuse the existing authorized room lifecycle and realtime connections, define multi-tab heartbeat/disconnect semantics, persist/sequence authoritative presence safely and test reconnect/revocation. Do not infer presence completion from this replay work. ED-09 and ED-11 remain untouched.

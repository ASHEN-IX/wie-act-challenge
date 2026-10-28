# ED-07 AI-independent peer text — verification, 22 October 2026

**Isolated peer-text gate: PASS for the documented bounded journal and configured single API instance. Full ED-07: PARTIAL.**

Root: `/home/ashenix/Projects/mindflow`; Node 24.20.0, pnpm 11.3.0, Mongo 7 standalone on `127.0.0.1:27018`, actual Nest, Next production server and Chromium. Synthetic databases/users only. No AI service was started for this mission; new tests set `AI_SERVICE_URL=http://127.0.0.1:1` and start Nest with workers disabled. No stage/commit/push or dependency/lockfile changes.

## A. Initial audit and baseline

Reviewed the backlog, delivery plan, ADRs, Contracts 03–07/10/13, workflows, testing/development plans, all three preceding ED-07 verification reports, applicable web AGENTS guidance and installed Next.js client/server-function/data-security documentation. Existing dirty/untracked work was inventoried before edits; see the evidence manifest for hashes and mission-specific changes. Earlier reports, presence gateway/registry, StudyRoom model/command service and original test sources were preserved.

| Capability | Existing implementation | Verified before changes | Gap |
|---|---|---|---|
| Peer send | Dedicated room page called `askRoom` → `/api/v1/session-chat/:sessionId/query` → `processSearchQuery` | Source trace; baseline 60 API/19 web tests passed | This is AI search, not peer-only messaging |
| Durable acceptance | `SessionChat` stored query/result records | Source inspection | No peer message type or authoritative peer acknowledgment |
| Deduplication | Mongo `_id` per search record | Source inspection | No client logical submission identity or atomic peer deduplication |
| Ordering | Legacy history sorted descending `createdAt`, with offset | Source inspection | No atomic peer acceptance sequence or stable recovery cursor |
| Realtime | `chat_query`/`chat_result` on the existing gateway | Source inspection; room security/presence regressions | AI-oriented events, no accepted peer event |
| History | Membership/source guard already protected `/history` | Real baseline authorization tests | Raw legacy AI records; no bounded public peer DTO or peer cursor |
| Reconnect | Room snapshot/presence recovery existed | Real baseline regressions | No client peer history/live/ack reconciliation |
| Authorization | Better-Auth plus `verifySessionMembership` delegates to study-owned roster/source guard | Real baseline security tests | Must reuse on every new peer request and delivery |
| Failure UX | Dedicated room had a server-rendered AI question form | Source inspection | No peer pending/accepted/failed/uncertain retry states |
| AI independence | Search service calls `AI_SERVICE_URL` | Source trace | Existing question path requires AI |

Baseline results: **60 API tests passed**, **19 web tests passed**, zero failures/skips; API strict check had **128 existing diagnostics**. No existing peer functionality was assumed complete based on file names or historical reports.

### Smallest compatible design

Extend SessionChat, the existing history router, collaboration actions and RoomView connection. Standalone Mongo cannot atomically coordinate a separate counter plus message record using an assumed replica-set transaction. Existing durable room receipts belong to StudyRoom, have their own bounded retention/authority rules and do not represent chat history. Therefore a bounded peer journal in the **existing SessionChat collection** atomically couples deduplication, append and message order. The additive contract is documented alongside Contracts 10/13; legacy AI search remains available outside the dedicated peer UI. No new broker, collection, connection registry or global frontend state library.

## B. Design and behavior

### Identity, acceptance and ordering

`POST /api/v1/session-chat/:sessionId/messages` accepts only UUID-v4 `submissionId` and plain `text`. Better-Auth/Nest supplies sender identity/name. Current active room membership/status and applicable source access are checked using the existing study-owned permission path; ordinary peers need no presenter authority. Sender claims, attachments/extra fields, missing/empty bodies, whitespace text, invalid Unicode/controls and oversized content are rejected. Limits: 2,000 UTF-16 text units, 8,000 UTF-8 text bytes, 12,000 bytes for the parsed body's serialized UTF-8 representation. Existing request parsing/global rate limiting stays in force; this is not a new per-user moderation system.

The existing `sessionchats` collection gains one `peer_stream` journal per room. Partial unique index `peer_room_journal` enforces that identity and is ensured even with automatic indexing disabled. A conditional native Mongo update checks capacity and absence of the authenticated actor/submission pair; one atomic pipeline increments journal `peerSeq` and appends the message with that sequence. `$literal` protects user text from Mongo expression interpretation. Writes request `{ w: 'majority', j: true }`, exercised against the standalone test Mongo.

The explicit public DTO is exactly:

```text
roomId, messageId, submissionId, senderUserId, senderName, text, seq, createdAt
```

Server UUID `messageId` is logical accepted identity; client UUID `submissionId` is scoped by room and authenticated sender; server `seq` orders acceptance, not timestamps or arrival. Two users/rooms may independently use the same submission UUID. Same actor/room/ID and normalized text returns the original `201 { message }`; conflicting text returns 409. Concurrent identical submissions append once; concurrent conflicting submissions accept one candidate. Returned sequence comes from the committed post-image.

### Retention and history

The journal retains **up to 1,000 accepted messages**, with no pruning/TTL/archive in this change. New submissions at capacity return 409; authorized old replays and history still work. With bounded text/metadata this remains within Mongo's document bound. This is a deliberate room-session limit, not a scalable indefinite chat archive. Deduplication depends on retaining the journal/index; manual deletion/external mutation invalidates stronger claims.

The existing history endpoint adds `?kind=peer&afterSeq=0&limit=50`: limit 1–100; nonnegative safe-integer cursor; unknown fields rejected. It returns explicit public items in ascending contiguous message order, `lastSeq`, `nextAfterSeq`, `hasMore`, and `{ maxMessages: 1000, pruned: false }`. A cursor beyond the stream returns 409 with recovery-from-zero guidance. Empty/unavailable history are distinct. Atomic append avoids a reserved-but-uncommitted cursor hole; appends concurrent with pagination can be recovered on the next page/recovery. Legacy history filters out peer journals, and legacy deletion cannot remove them.

### Realtime, room commands and presence

New accepted writes publish `ROOM_PEER_MESSAGE` through the **unchanged existing** `broadcastToSession` gateway. Each recipient's current session, membership and source access is rechecked there; stale sockets are ejected. The event contains the public DTO, not the raw journal or private records. Replays do not publish again. Mongo acceptance and WS publication are separate: network delivery is best effort, with no outbox/exactly-once delivery claim.

No peer send writes StudyRoom, membership, presenter, room `seq`, command receipts or presence fields. Existing `presenceEpoch`/`presenceVersion` still order connection availability only. Tests compare the entire persisted room before/after text exchange, refresh and disconnect behavior.

### Frontend and recovery

Dedicated rooms now render `PeerChat` within RoomView. Its existing single socket handles peer events; there is no second socket/subscription registry. Recovery starts after the connection's **authorized room snapshot**, avoiding the pre-subscription history/read race. It pages from zero through all retained messages (at most ten 100-message pages) and merges immutable identities/order with concurrent live events and acknowledgments. Older history never replaces newer accepted messages. Socket-generation and recovery-generation guards discard obsolete requests; a visible sequence gap is labeled incomplete. A manual recovery control remains available while connected; no background polling was added.

One bounded local outbox distinguishes Pending, Failed and Retryable; only an authoritative API/WS/history message becomes Accepted. Uncertain retries retain exact ID/text and the draft; failures arriving after a WS acceptance cannot undo it. Successful acceptance clears only the matching draft. There is no persisted browser offline queue: refresh retrieves accepted messages, but unsent draft/uncertain-ID retention is limited to the mounted page.

React renders plain text and sender names with escaping and wrapping, never raw HTML, Markdown/link execution or dynamic URLs. Accessible labels, list/status announcements and keyboard-submit controls are used. Denied dedicated `room_` pages now stop at their actual error instead of trying a legacy namespace, avoiding a pre-existing 500 fallback during revocation. Legacy team/search UI remains intact; unverified facilitator/debrief/voice implementations were not expanded.

### Failure-window decisions and executed coverage

| Window | Result and evidence |
|---|---|
| Validation/access rejection | 400/401/403; no message acceptance; actual HTTP tests |
| Failure before append | 503 uncertainty; journal unchanged; same-ID retry succeeds; injected at real Mongo call boundary |
| Mongo commit, acknowledgement unavailable | Actual append then injected error returns 503; retained message recovered by same-ID replay/history; API and browser |
| Actual browser HTTP response loss | Playwright forwards the real Next server action, then aborts its browser response; authoritative WS acceptance resolves the local submission, no duplicate row; browser |
| WS send throws after persistence | Actual gateway `WebSocket.send` throws under controlled injection; API still returns accepted 201, stored history/replay remains correct; API test |
| Two concurrent identical/conflicting requests | One journal append; original result or 409 conflict; actual parallel requests |
| Accepted write, Nest runtime restart | Actual Nest stop/start against retained isolated Mongo; original message/result and history recovered |
| Access lost before replay | Current room/source check rejects replay/history/send; actual membership/source tests |

These are real persistence/transport-boundary tests with narrowly injected failures, not machine/power-loss or Node SIGKILL experiments. Current access validation and message append are not an atomic cross-document transaction; an already delivered frame cannot be recalled.

## C. Changed files and preserved work

API/persistence:

- `apps/api/modules/notification/src/models/SessionChat.ts`: peer journal schema/index and explicit public message type.
- `apps/api/modules/notification/src/services/peerText.ts` (new): validation, atomic acceptance, replay/conflict/capacity handling and bounded peer history.
- `apps/api/modules/notification/src/services/chatService.ts`: exclude/protect peer journals from legacy history/deletion.
- `apps/api/modules/notification/src/routes/chat.ts`: authenticated peer send and history mode using existing membership/source guard and gateway.
- `apps/api/src/framework/domains/notifications.module.ts`: generated named POST adapter. Running the actual generator reproduces the adapter exactly and changes no other adapter.

Realtime integration uses the existing gateway **without editing `realtime.ts`**. Existing presence, heartbeat, connection cleanup and delivery revalidation remain unchanged.

Frontend:

- `apps/web/src/features/collaboration/actions.ts`: authenticated server functions for peer send/history.
- `apps/web/src/features/collaboration/room-view.tsx`: route peer events/recovery through existing socket and render the peer component.
- `apps/web/src/features/collaboration/peer-text-state.ts`, `use-peer-text.ts`, `peer-chat.tsx` (new): bounded local reconciliation/outbox and accessible plain-text UI.
- `apps/web/src/app/(workspace)/study-together/[sessionId]/page.tsx`: replace dedicated-room AI search composer with the integrated peer flow; dedicated namespace error boundary; preserve legacy team/search flow.

Tests:

- `apps/api/tests/integration/ed07-peer-text.node.test.ts` (new): 20 actual lifecycle/failure/security scenarios plus parent test.
- `apps/web/src/features/collaboration/peer-text.test.tsx` (new): ten reconciliation/actual renderer tests.
- `apps/web/e2e/test-study-together-peer-text.ts` (new): real three-context peer flow and fault recovery.
- `apps/web/vitest.config.ts`: discover TSX tests and apply automatic JSX transform so actual component rendering is exercised.

Documentation: Contracts 10/13 peer supplement, ED-07 follow-up, this report, updated [Aziz remaining-work/dependency matrix](AZIZ-REMAINING-TASKS.md) and focused evidence.

All unrelated dirty/untracked work, AI/facilitator code, original tests/reports, room command/presence services, deployment/Caddy/CI, manifests and lockfile were preserved. The [working-tree manifest](evidence/ed07-peer-text-2026-10-22/working-tree.json) records baseline hashes and exact mission changes; there is no clean-commit claim.

## D. Verification matrix and exact commands

| Scenario | Result | Evidence |
|---|---|---|
| Authorized/ordinary-peer send | PASS | API actor-derived sender, durable record and actual WS receipt; browser |
| Unauthorized send/history | PASS | Real 401/403 requests, invalid body/ID/source cases |
| Concurrent deduplication/conflicting reuse | PASS | Six identical parallel submissions; two conflicting candidates; one durable append |
| Durable restart recovery | PASS | Real Nest stop/start; identical stored DTO and history |
| Accepted-message history/capacity | PASS | Stable pages/cursors, empty/future/invalid cursors, explicit 1,000-message cap fixture/replay |
| Ordered reconnect recovery | PASS | Three-context disconnect, concurrent live/history merge, refresh and manual recovery |
| Revoked-user isolation | PASS | Course ownership revocation and explicit membership leave; no later protected event |
| Three-context browser flow | PASS | Independently signed-in A1/A2 same user, B1 other user; persisted Mongo assertions |
| AI unavailable | PASS | Unavailable configured AI URL; no worker/service startup; normal exchange/recovery succeeds |
| Safe rendering/private boundary | PASS | Actual renderer and Chromium: literal HTML/script/javascript-link text; no active elements/dialogs; eight-field DTO |
| Failure/retry UX | PASS | Actual HTTP response abort, actual post-commit uncertainty, same-ID UI retry, retained draft, one persisted logical message |
| Existing ED-07 regressions | PASS | All preceding room/replay/security/presence tests and both original browser scenarios |

All commands below run from repository root. Logs are in [evidence](evidence/ed07-peer-text-2026-10-22/working-tree.json).

```bash
docker compose -f docker-compose.test.yml up -d --wait mongodb

# Baseline: same command without the final peer-text file: 60 pass, 0 fail/skip.
# Final combined run: 81 pass, 0 fail/cancelled/skip/todo; exit 0.
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/integration/ed07-command-replay.node.test.ts \
  apps/api/tests/integration/ed07-room-security.node.test.ts \
  apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts \
  apps/api/tests/integration/ed07-room-presence.node.test.ts \
  apps/api/tests/integration/ed07-peer-text.node.test.ts

# New suite alone: 21 pass (20 scenarios + parent), 0 fail/skip; exit 0.
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/integration/ed07-peer-text.node.test.ts

pnpm --filter web test       # baseline 19; final 29 pass, 0 fail/skip; exit 0
pnpm --filter web lint       # exit 0
pnpm --filter web typecheck  # exit 0
pnpm --filter web build      # production build exit 0
pnpm --filter api build      # exit 0
pnpm --filter api typecheck  # exit 2; exactly the same 128 baseline diagnostics

pnpm --filter api exec tsc -p /tmp/ed07-peer-text/tsconfig-peer-core.json
# exit 0: strict existing API config, scoped to SessionChat + peerText, no rule relaxation.
# A copy of this configuration is retained in evidence.

pnpm --filter api exec eslint \
  modules/notification/src/services/peerText.ts \
  tests/integration/ed07-peer-text.node.test.ts
# exit 0; SessionChat also passes focused ESLint.
pnpm --filter api exec eslint \
  modules/notification/src/models/SessionChat.ts \
  modules/notification/src/services/chatService.ts \
  modules/notification/src/routes/chat.ts \
  modules/notification/src/services/peerText.ts \
  tests/integration/ed07-peer-text.node.test.ts --format json
# exit 1: 10 pre-existing no-explicit-any errors (chat route 6, legacy service 4).
# Same-path baseline stdin lint has the same 10 plus one old formatting error.

node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/api/scripts/generate-http-contracts.ts
# exit 0; generated adapters already match exactly; no other adapter changed.
```

Browser setup copies production `.next/static` and `public` into `.next/standalone/apps/web/` with `shutil.copytree(..., dirs_exist_ok=True)` after the build. Each runner starts actual Nest on 3005/Next on 5173 and cleans only its synthetic database/processes. Chromium executable override below is local to this machine; the new runner defaults to installed Playwright Chromium if omitted.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/ashenix/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-peer-text.ts
# exit 0, real three-context exchange/recovery/revocation/failure scenario

PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/ashenix/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-presence.ts
# exit 0, existing three-context presence scenario

node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-e2e.ts
# exit 0, existing seven-stage room/replay/security scenario

git diff --check # exit 0
docker compose -f docker-compose.test.yml stop mongodb
```

The dedicated test Mongo was stopped at mission start and is stopped after validation. New tests use unique `ed07_peer_text_*` / `ed07_peer_text_browser_*` databases and remove them; no production database was used.

API diagnostic comparison used every `error TS` line and location in order: **128 before = 128 after, identical**, not merely equal counts. New core strict typing, new-file lint, web lint/types and both production builds pass. Focused legacy API lint remains non-green as documented; API-wide lint/CI/Python/live-inference suites were NOT RUN because no broad cleanup or AI feature was in scope. Existing express-rate-limit `keyGeneratorIpFallback` warnings remain in runtime logs and were not reclassified as new peer failures.

Development checks initially exposed additional schema/dynamic-import test typings; these were fixed, not hidden or excused by the baseline. The TSX renderer tests required extending existing Vitest discovery/JSX transformation; only final 29-test runs establish their coverage. Final recorded suites have no failing/skipped tests. An empty-body validation gap found during review was fixed with required-object validation and actual empty/null/array/object request regressions.

### Browser sequence and evidence

A1/A2 independently sign in as user A, B1 as user B. All see one A member. A1 sends; all render one accepted message. The real browser HTTP acknowledgment is aborted after its server action completes; the WS acceptance still resolves the outbox. A2 replays the same scoped ID, producing no second journal entry/row. Closing A1 leaves A online through A2. B goes offline and its sockets close explicitly; A2 accepts two more messages. B reconnects/retrieves history in sequence, without duplicates, then refreshes and sends inert HTML/script/unsafe-link text. No script/dialog/link element executes.

A controlled missing Mongo write acknowledgment after an actual commit yields Retryable with retained text/ID; A2 retries, obtaining the original accepted message once. B manually recovers that missed best-effort publication from persisted history. Entire StudyRoom remains unchanged through these operations. B then explicitly leaves; send/history return 403 and its stale socket receives no later protected peer event while A2 continues. HttpOnly session values do not appear in props or socket URLs.

[Browser screenshot](evidence/ed07-peer-text-2026-10-22/three-context-peer-text.png) complements DOM/transport/Mongo assertions; it is not the security/durability proof. Each runner is one multi-stage scenario, not a claim that console PASS lines are independent browser tests. Network emulation combines Playwright offline mode with explicit socket closure; existing presence tests separately exercise actual missed-pong termination.

## E. Known limitations

- Journal capped at 1,000 accepted messages; new sends fail explicitly when full. No archive/rotation/deletion/edit feature or history expiry policy was added. Replay safety assumes retained authoritative journal/index.
- Best-effort single-instance live fanout; no distributed presence/fanout, durable delivery queue or exactly-once network delivery. A commit followed by a process/publication failure can miss a live event; reconnect/refresh/manual history recovery is required. A gap can be detected only once a higher message sequence arrives; no polling detects a missing final event automatically.
- Sender pending IDs/drafts live in mounted-page memory, not cross-refresh browser persistence. Accepted history is recovered after refresh.
- Request/delivery authorization checks are not a transaction spanning auth/source/room/message documents. No claim of recalling delivered frames or instantaneous revocation during process/dependency stalls.
- Real Nest restart, write-acknowledgment loss, browser HTTP abort, WS-send failure, disconnect/reconnect and missed-pong regressions were tested. Node SIGKILL, OS/browser process kill, machine power loss, Mongo crash/rollback, production proxy outage, multi-instance failover and production-load/soak were NOT RUN.
- Published source/revision/enrollment, shared activity renderer and private activity-attempt/evidence integration remain unavailable. Existing owner-only course authorization is reused, not promoted to Contract 03 readiness. No live inference/audio/learning-outcome evaluation was performed.
- Global API strict diagnostics and legacy lint remain as above; this does not claim the complete CI pipeline is green.

## F. Final decision and remaining work

**Peer-text gate PASS** for the implemented contract and tested single-instance topology. Durable room commands, presence, presenter rules and source/privacy checks remain covered by passing regressions. **ED-07 remains PARTIAL.**

[Updated Aziz review](AZIZ-REMAINING-TASKS.md) covers all nine unfinished accountable tasks, actual interface paths, verified behavior, missing owner contracts and blocking consequences. Next isolated implementation is **ED-07 — Authorized published source, shared activity, and private-attempt integration**, conditional on Habib's Contract 03 published/access/revision handoff and Tasnim's Contracts 04–07 renderer/attempt/public-completion handoffs. ED-09 → ED-11 → integrated ED-14 → ED-15 remains the downstream chain. No downstream task started here; ED-25's P1/P2 conflict remains for team resolution.

# ED-07 presence implementation verification — 22 October 2026

**Isolated presence gate: PASS for the configured single API instance. Full ED-07: PARTIAL.**

Repository: `/home/ashenix/Projects/mindflow`; Node 24.20.0, pnpm 11.3.0; synthetic Mongo 7 databases on `127.0.0.1:27018`. No staging, commits, pushes, dependency changes, AI work, peer messaging or activity/assessment implementation.

## Initial audit and interpretation

Inspected the backlog/team plan, ADRs, Contracts 10/13, testing/development plans, current ED-07 and durable-replay reports, applicable web AGENTS instructions and installed Next.js client-component guidance. Preserved the existing dirty tree before edits; the evidence manifest distinguishes this mission from prior work.

Canonical ED-07 requires matching public presence in 2–4 browsers, presenter-only shared controls, deterministic reconnect/replay and private-answer isolation. Existing contracts describe membership, roster availability and authoritative snapshots, but do not define tab cardinality, disconnect-as-leave or ephemeral ordering. The minimal interpretation is: membership is durable, availability is aggregated authorized transport presence, and presenter authority is independent of connection count.

Observed defects before implementation:

1. HTTP/model online flags were set at join and reused in WS snapshots after disconnect/restart; no authoritative connection aggregation reached the room UI.
2. Every realtime tab invoked the legacy voice join/leave persistence functions. Closing one tab could mark a user departed in voice state while another tab remained connected; text-room transport unnecessarily depended on voice persistence.
3. Close cleanup was registered after asynchronous authentication, membership, voice join and snapshot work. A connection abandoned during that work could register without a close handler observing its departure.
4. Existing exact-socket sets were useful, but per-user cleanup/publications did not respect remaining sockets. Heartbeat checks could overlap asynchronous authorization work.
5. The actual frontend reducer rejected equal durable sequences, so a reconnect/presence change without a room mutation could not reconcile online state. Availability dots had no accessible status labels.
6. Compose has one fixed API container, not distributed presence coordination. Neither Redis provisioning nor the ADR's intended use establishes implemented cross-instance behavior.

## Implementation and invariants

The **existing** `sessionClients` registry remains the only connection registry. Each admitted socket has an idempotent cleanup callback installed before the first authorization await. Cleanup removes that socket identity only, before awaiting publication. Closed sockets cannot finish authorization and register later. Old close callbacks cannot remove replacements; concurrent closures converge through exact-set deletion and a per-room delivery queue. Queue entries are removed after completion; there is no per-room event history or offline-user cache.

For `room_` rooms, transport connection/disconnection no longer calls legacy voice join/leave. It never calls durable room leave, changes presenter, persists heartbeat availability or increments room sequence. Explicit leave retains the existing atomic receipt path and its replay rules. Existing non-room legacy voice behavior remains outside this gate.

Every queued delivery revalidates each open socket's current Better-Auth identity and study-owned membership/source permission. Invalid connections are removed before aggregation and closed with 4401/4403. The gateway computes distinct authorized online user IDs and overlays `isOnline` on the existing explicit public `ROOM_STATE_SYNC` projection. It publishes complete `ROOM_PRESENCE_SYNC` sets for connection changes. No raw socket IDs, cookies, access tokens, answers, grading keys or raw room documents are added to these messages.

`presenceEpoch` identifies a server process; monotonic `presenceVersion` orders ephemeral messages independently from durable `seq`. The existing reducer handles both messages, ignores stale/duplicate presence, and accepts presence from equal-sequence full snapshots without replacing durable state. On a new socket opening, the component resets ephemeral ordering and obtains a fresh authoritative snapshot. Callbacks from obsolete sockets are ignored. The UI retains one row per durable member, including offline members, and labels availability Online/Offline/Presence unknown. Initial HTTP persisted availability is deliberately not displayed as confirmed live presence; HTTP membership DTOs retain their legacy flags for compatibility.

This is delivery-time validation, not an atomic transaction spanning auth, source ACL and room state. Future authorized sends and heartbeats revalidate changes; already delivered frames cannot be recalled.

## Disconnect, heartbeat and restart limits

Graceful close removes the exact connection on the server close event. Closing one of several authorized tabs keeps the user online. Final closure publishes offline without membership loss; refresh may briefly show offline if no other tab exists, then recovers. Reconnect authenticates and checks membership/source anew before registration and snapshot delivery. A room change closes the old effect's connection and starts a separately authorized subscription.

The existing production heartbeat remains **30 seconds**. Ping/pong liveness checks continue independently of a pending authorization check, while overlapping authorization checks are suppressed. A socket missing a pong is terminated at the next heartbeat. For an arbitrary abrupt network loss, the nominal detection window is **30–60 seconds**, plus event-loop scheduling delay; authorized peer publication additionally incurs queue/authorization latency. This is not a strict wall-clock SLA during process stalls or unavailable dependencies. Idle session/membership revocation is checked at the next heartbeat; an intervening inbound message or outbound publication checks earlier. No new polling or per-heartbeat presence writes were added.

The missed-pong integration uses a **real WS client with `autoPong: false`**, real Nest/Mongo authorization and an internal test-only 100ms attach option. It verifies a second member sees online then offline, duplicate cleanup paths preserve the surviving member, and durable Mongo data is unchanged. Production does not configure that override.

Restart drops ephemeral sockets, not durable membership/receipts. Reconnect uses the new process epoch and current connection registry. Existing replay regressions exercise an actual Nest runtime restart; frontend tests cover epoch reset. **No Node SIGKILL, browser process kill, machine/power loss, production proxy outage or multi-instance failover was exercised.**

## Deployment inspection

`docker-compose.yml` defines one fixed `mindflow-api` container and no replicas/shared socket coordinator. `deploy/Caddyfile` proxies to `frontend:80`; CI defines builds/test jobs, not an API replica topology. Redis is provisioned and ADR-06 targets shared ephemeral presence, but no implemented Redis presence/WS fanout is available in this path. This change verifies the current single-instance registry; it does not complete the distributed ADR target. Running multiple active API processes would need separately reviewed coordination using existing infrastructure. Sticky routing alone would not provide globally accurate aggregation.

## Files changed by this mission

- `apps/api/modules/notification/src/realtime.ts`: early identity-safe cleanup, text-room/voice separation, authorized delivery/aggregation, ephemeral ordering, heartbeat handling, pending-delivery shutdown cleanup.
- `apps/web/src/features/collaboration/room-sync.ts`: presence reconciliation within the existing state reducer.
- `apps/web/src/features/collaboration/room-view.tsx`: current-socket recovery/reset, obsolete-callback guards and accessible availability labels; roster wording distinguishes members.
- `apps/api/tests/integration/ed07-room-presence.node.test.ts`: 13 real lifecycle scenarios plus parent test.
- `apps/web/src/features/collaboration/room-sync.test.ts`: five additional presence ordering/recovery tests.
- `apps/web/e2e/test-study-together-presence.ts`: independent A1/A2/B browser contexts and real persisted-state checks; cleanup also covers startup failures.
- Contracts 10/13 supplement, ED-07 backlog follow-up, this report, remaining-task review and evidence directory.

StudyRoom persistence, durable command service, original security/replay/lifecycle tests, original browser runner, deployment/Caddy/CI, other domains and earlier reports were preserved.

## Commands and actual results

Commands ran from repository root. Test services were initially stopped; started only the dedicated Mongo service, then stopped it after verification. Full logs and baseline/final hashes are in [evidence](evidence/ed07-presence-2026-10-22/working-tree.json).

```bash
docker compose -f docker-compose.test.yml up -d --wait mongodb

# Baseline: 46 pass, 0 fail, 0 skip. Final: add presence file below.
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/integration/ed07-command-replay.node.test.ts \
  apps/api/tests/integration/ed07-room-security.node.test.ts \
  apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts

# Final: 60 pass, 0 fail/cancelled/skip/todo; exit 0.
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json --test \
  apps/api/tests/integration/ed07-command-replay.node.test.ts \
  apps/api/tests/integration/ed07-room-security.node.test.ts \
  apps/api/tests/integration/ed07-study-rooms-e2e-real.test.ts \
  apps/api/tests/integration/ed07-room-presence.node.test.ts

pnpm --filter web test       # baseline 14; final 19 pass, 0 fail; exit 0
pnpm --filter web lint       # exit 0
pnpm --filter web typecheck  # exit 0
pnpm --filter web build      # production build exit 0
pnpm --filter api build      # exit 0
pnpm --filter api typecheck  # exit 2, exactly the same 128 baseline diagnostics

pnpm --filter api exec eslint tests/integration/ed07-room-presence.node.test.ts
# exit 0
pnpm --filter api exec eslint modules/notification/src/realtime.ts --format json
# exit 1: 27 existing no-explicit-any errors, no introduced errors.
# Same-path stdin baseline: 27 no-explicit-any + 10 formatting + 1 unused import.

# Copy Next standalone static/public assets after build, using shutil.copytree(..., dirs_exist_ok=True).
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/home/ashenix/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome \
node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-presence.ts
# exit 0; real Chromium + Next production server + Nest + isolated Mongo.
# Environment override is optional when Playwright's default Chromium is installed.

node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-study-together-e2e.ts
# existing seven-stage room/replay/security browser scenario: exit 0

git diff --check # exit 0
docker compose -f docker-compose.test.yml stop mongodb
```

API typecheck comparison used every `error TS` line in order, not just counts: **128 before = 128 after, identical diagnostic text/location**, with no errors in modified runtime or new presence test. Web strict check and API production build pass. API-wide lint was not rerun; focused runtime lint remains explicitly non-green due to the 27 pre-existing `any` annotations. No rules were disabled to hide them. Existing express-rate-limit `keyGeneratorIpFallback` validation warnings remain in logs and were not repaired in this isolated change.

During test development, the first presence suite had one failing session-revocation fixture: it deleted string user IDs while the auth adapter used its own stored identity representation. Replaced that fixture with actual Better-Auth `signOut`; final session revocation passes. The first new browser run failed because a strict `code` locator matched two invite-code elements; replaced it with the existing invite-code test ID. Both were corrected test setup failures, not reclassified as passes. Final suites above have no skips or failures.

## Executed acceptance coverage

Backend verifies: initial presence/current snapshot, two sockets/one roster member, one tab closure, final closure with whole Mongo room unchanged, same-sequence reconnect snapshot, old closure after new registration, concurrent openings/closures, unauthorized/query-cookie denial, presenter handoff across connection changes, explicit durable leave/replay and stale-socket ejection, rejoin, disconnect held during a real membership request, real session sign-out and denied reconnect, and missed-pong termination/idempotent cleanup. Existing security and durable-replay tests remain green, including source/recipient authorization and receipt/sequence persistence. Source authorization still uses the existing study-owned contract; unavailable published-revision integration is not fabricated.

Browser A1 and A2 independently sign in as the same synthetic user; B1 signs in as another. All three observe two members and Online labels. Refresh preserves the entire persisted room. Closing A1 retains A online; closing A2 makes A Offline for B without Mongo mutation. A fresh authenticated context restores A's presence. B goes offline and its transport is explicitly closed; A observes Offline and changes phase; B reconnects and sees current phase/presence. B then executes an authorized durable leave, loses membership, receives no higher-sequence snapshots, and disappears from A's roster. HttpOnly credentials are absent from serialized page props and WS URLs. Browser network emulation alone does not reliably close existing sockets, so the offline check deliberately combines `setOffline(true)` and socket closure; missed-pong coverage supplies the ungraceful-transport case.

Screenshots: [three contexts](evidence/ed07-presence-2026-10-22/three-contexts.png), [final A tab offline](evidence/ed07-presence-2026-10-22/final-tab-offline.png). Browser stage logs represent one end-to-end scenario, not independent test-count claims. No media-device, live inference or learning-outcome evaluation was run.

## Remaining gate and next step

Full ED-07 remains **PARTIAL**. Remaining: AI-independent public peer text with durable accepted-message recovery; authorized published source/revision context; shared activity renderer/public activity integration; private attempt API and safe completion counts; complete canonical 2–4-browser source/activity/private-answer acceptance. Full PDF/page-following is P1. Cross-instance presence is unverified/unsupported by this path.

**Next isolated implementation: AI-independent peer text.** Do not start ED-09, ED-11, voice or activity/evaluator work as part of presence. [Aziz's remaining task list and next prompt brief](AZIZ-REMAINING-TASKS.md) records all nine unfinished accountable tasks and relevant shared dependencies.

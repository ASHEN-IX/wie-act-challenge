# EdNova — Complete Dependency-Gated Codex Implementation Program

**Target working directory:** `/home/ashenix/Projects/mindflow`  
**Prepared:** 22 October 2026  
**Scope:** 35 unfinished ED-01–ED-35 tasks (ED-DOC is already DONE for documentation alone), spanning P0, P1, optional and post-hackathon decisions.  
**Change permission:** All domains, frontend, NestJS, MongoDB, Python AI/workers, CI/infrastructure, security, tests and documentation. Original Habib/Tasnim/Aziz assignments identify the accountable domain, not a file-access restriction.  
**No authorization:** Do not commit, stage, push, publish packages, deploy, purchase services, modify production data, or create live accounts without explicit approval.

## Evidence boundary and source instructions

This roadmap was drafted from the user's uploaded canonical **EdNova v1.2 implementation backlog**, the prior ED-07/ED-09 evidence summaries in the conversation, and the supplied task constraints. The local repository is **not mounted in the planning environment**; the complete referenced docs and current working-tree contents were **not independently inspected** here. Therefore paths and task statuses are targets or previously reported evidence, not newly verified implementation facts. Every Codex mission begins with a current-tree audit and reading of the real repository documents. If those sources disagree, produce a conflict log and use security/data isolation, approved technical contracts, current canonical acceptance and architecture decisions to resolve them; do not silently overwrite decisions.

**Mandatory sources for every mission:**

- `docs/sprint-backlog.md`
- `docs/team-delivery-plan.md`
- `docs/architecture-decisions.md`
- `docs/contracts/technical-contracts.md`
- `docs/target-architecture.md`
- `docs/product-specification.md`
- `docs/roles-and-permissions.md`
- `docs/data-model.md`
- `docs/testing-plan.md`
- `docs/development.md`
- `docs/hackathon-delivery.md`
- `docs/audit/cleanup.md`
- `reports/AZIZ-REMAINING-TASKS.md`
- `reports/ED-07-CURRENT-VERIFICATION.md`
- `reports/ED-07-DURABLE-REPLAY.md`
- `reports/ED-07-PRESENCE-VERIFICATION.md`
- `reports/ED-07-PEER-TEXT-VERIFICATION.md`
- `reports/ED-09-BASELINE-AUDIT.md`

Additionally read root and nested applicable `AGENTS.md`, referenced contracts/workflows/ADRs and actual package scripts. Older `study-partner-*` document aliases can be stale; resolve runtime paths under `apps/api`, `apps/web`, `apps/ai` and real shared packages. The backlog file is the source of acceptance and status, not proof a feature exists. ED-DOC DONE is documentation-only.

## Non-negotiable reusable execution contract (applies to EVERY mission)

1. **Inspect, don't assume.** Before editing run `pwd`, `git status --short`, `git diff --stat`, `git diff --name-status`, `git diff --cached --stat`, and `git ls-files --others --exclude-standard`; inspect applicable diffs, schemas, handlers, tests, AGENTS instructions and contracts. Preserve all tracked/untracked/uncommitted changes and unrelated work. No `reset --hard`, `clean -fd`, broad formatting, stash, staging, commit or push. Capture a before/after file manifest and attribution; never overwrite another uncommitted change.
2. **Classify first.** For every acceptance criterion report `VERIFIED`, `IMPLEMENTED_UNVERIFIED`, `PARTIAL`, `ABSENT`, `EXTERNAL_BLOCKED` (not equivalent to canonical status). Establish baseline tests before changes. Source-only presence and an old report are not acceptance evidence.
3. **One canonical owner per capability.** Mongo models/publication in Study; authentication and grants in existing auth/study boundaries; shared activity definition/renderer and private assessment/evidence in their owning modules; AI provider transport in one shared adapter; learner/room consumers call existing `module://`/HTTP interfaces. Do not build competing ingestion, rubric/evaluator, vector store, membership/connection registry, activity renderer, or reward ledger.
4. **Safety and provenance.** Authorize before retrieving/indexing/model inference/caching/delivery. Recheck revocation; scope by actor/course/institution/enrollment/revision/recipient. Keep answers, keys, rubrics, private attempts, credentials, personal evidence and recipient-only help OUT of public DTOs/events/logs/AI prompts. Treat source text and model outputs as untrusted; validate strict versioned schemas; never execute generated application code.
5. **State/retry correctness.** Use immutable source and activity revision pins, expected versions, stable logical command/attempt IDs, conflict-safe atomic writes and bounded idempotency. Handle duplicate/concurrent callbacks, uncertain ACK, crash/restart, stale edits and reconnect. Preserve ED-07 durable room replay/sequence, single-instance presence and AI-independent bounded peer text. Never claim exactly-once WebSocket delivery or distributed presence without evidence.
6. **True AI modes.** Distinguish `REAL_APPROVED`, `MOCK_TEST`, `DETERMINISTIC_FALLBACK`, `UNAVAILABLE` (reuse actual enum if provided). No fabricated citations, fake accepted evaluations, premature mastery/XP, invented provider credentials or fabricated performance figures. Inference failure must leave room transport, peer text, authorized materials and recoverable private state usable.
7. **End-to-end scope.** Each implementing mission spans actual necessary model/storage, NestJS auth/domain/contracts, Next.js UI, Python/workers where relevant, validation, negative access, recovery, tests and focused docs. Refuse speculative integration with absent dependent contracts; finish independently valid slices and explicitly block dependent gates.
8. **Evidence minimum.** Run relevant unit, real Nest/Mongo integration, Python/service/provider classification tests, browser flows with distinct users, negative ACL/revision/retry/revocation, app builds, strict typecheck and lint. Record exact command/cwd/config/exit/passes/fails/skips/environment/mocks and logs. `api build` != `api strict typecheck`. Compare current API strict diagnostics against the previously reported **128** by diagnostic identity/location, not number only; fix new findings and schedule existing debt in M01. Do not claim a test passed unless executed.
9. **Statuses and reports.** Write a dated, task-scoped report in `reports/` with acceptance matrix and link to redacted evidence. Update `docs/sprint-backlog.md` status only if **every** canonical criterion for that task is evidenced. Parent tasks stay PARTIAL while gates remain. Report `PASS/PARTIAL/FAIL/BLOCKED`, changed files, remaining blockers and exactly one next mission.
10. **One mission per change.** Do not implement later mission tasks opportunistically. Cross-domain edits ARE authorized when needed to implement this mission's canonical interface, but unrelated changes are not. Do not perform deployment, media service provisioning, paid model use or external volunteer recruitment without the relevant inputs/approval.

## Baseline (reported; requires reconfirmation)

ED-07's room-security, durable replay, accurate presence (single API instance), and bounded public peer-text components have isolated passing evidence. The last reported peer-text run showed 81 API and 29 web tests plus three browser scenarios; previous reported API-wide typecheck had 128 diagnostics. Full ED-07 is **PARTIAL**, ED-09 remains **TODO** with an unverified existing facilitator baseline, and ED-11 **PARTIAL**. Owner-only course access is not enrolled published-source access. The published immutable source/revision, trusted public activity renderer, recipient-only attempts/results and safe accepted completion contracts were reported missing. Recheck each statement in the actual tree.

## Task-to-mission coverage matrix (35 unfinished IDs)

| ID | Priority | Accountable domain | Primary implementation / final gate | Notes |
|---|---|---|---|---|
| ED-01 | P0 | Platform | M01 | Strict builds/types/lint/CI/Python parity |
| ED-02 | P0 | Security/content access | M02 | Source/chat/files/transport isolation |
| ED-03 | P0 | Shared inference | M06 | Approved compact/capable provider; external gate |
| ED-04 | P0 | Identity/institution | M04 | Personal/institution grants and enrollment |
| ED-05 | P0 | Publication | M08 | Review and immutable published pointer |
| ED-06 | P0 | Ingestion/provenance | M05 | Stable original file/chunk/revision mapping |
| ED-07 | P0 | Collaboration | M17 | Room activity/private attempt; P1 PDF at M32 |
| ED-08 | P0 | Individual learning | M12 | Diagnostic and guided practice |
| ED-09 | P0 | Facilitator | M19 | Peer-first bounded policy, UI/API/Python |
| ED-10 | P0 | Tutor | M09 | Authorized grounded retrieval and citation checks |
| ED-11 | P0 | Debrief | M20 | Private checks/public recap/next steps |
| ED-12 | P0 | AI operations | M18 | Capacity routing and degraded behavior |
| ED-13 | P0 | Privacy | M21 | Crosscut preflight in all missions, final audit |
| ED-14 | P0 | Integrated QA | M22 | P0 end-to-end evidence |
| ED-15 | P0 | Submission | M23 | Report/demo/video/pitch |
| ED-16 | P1 | Learning UX | M24 | Multilingual/RTL/a11y |
| ED-17 | P1 | Live audio | M25 | LiveKit verified media plane |
| ED-18 | P1 | Private help | M26 | Recipient-only room help |
| ED-19 | P1 | Instructor insights | M27 | Thresholded aggregates |
| ED-20 | P1 | Volunteer evaluation | M33 | External consent/volunteer gate |
| ED-21 | Optional/P2 | Open-topic | M34 | Unapproved source clearly labeled |
| ED-22 | Later | Technical cleanup | M36 | Reference/runtime evidence before deletion |
| ED-23 | Later | Product scope | M37 | Commercial/social decision gate |
| ED-24 | Later | Institution expansion | M38 | Pilot-backed enterprise design |
| ED-25 | Priority conflict | Speech moderator | M35 | P2 index vs P1 detail; resolve first |
| ED-26 | P0 | Contracts | M03 | Canonical schemas + test fixtures |
| ED-27 | P0 | Activity UX | M13 | Trusted shipped renderer |
| ED-28 | P0 | Selector | M11 | Grounded intent/type validation |
| ED-29 | P0 | Assessment/evidence | M10 core + M12 final | Private attempts and accepted evidence |
| ED-30 | P0 | Studio draft | M07 | Versioned editable hierarchy APIs |
| ED-31 | P0/P1 split | Studio UX | M15 P0 + M30 P1 | Basic review/publish then rich controls |
| ED-32 | P0/P1 split | Studio AI | M14 P0 + M30 P1 | Grounded proposals then customization |
| ED-33 | P1 | Rewards | M28 | Idempotent evidence-based ledger |
| ED-34 | P1 | Reward UI | M29 | Private explainable award feedback |
| ED-35 | P1 | Visualization | M31 | One deterministic accessible example |


**Additional P1 slices, not new task IDs:** rich Course Studio customization is M30 (ED-31/32); synchronized PDF/page following is M32 (ED-07). **ED-DOC** is already DONE and excluded from the 35-task count; keep its documents current without claiming implementation completion.

## Dependency graph and sequencing

```text
M00 evidence audit
  -> M01 ED-01 baseline
  -> M02 ED-02 source/file/transport isolation
  -> M03 ED-26 canonical shared contracts [requires M01/M02]
  -> M04 ED-04 institution/enrollment
  -> M05 ED-06 scoped ingestion
  -> M07 ED-30 editable provenance drafts
  -> M08 ED-05 published immutable revisions
  -> M09 ED-10 authorized grounded tutor
  -> M10 ED-29-A private attempt/evidence kernel [no claimed grading]
  -> M11 ED-28 grounded activity selection
  -> M12 ED-08 + ED-29-B real evaluator/accepted evidence
  -> M13 ED-27 trusted activity UX
  -> M14 ED-32 P0 sourced Studio proposals
  -> M15 ED-31 P0 Studio UX and publish journey
  -> M17 ED-07 source/activity/attempt room integration
  -> M18 ED-12 operational capacity/degraded mode
  -> M19 ED-09 peer-first facilitator
  -> M20 ED-11 private final checks and debrief
  -> M21 ED-13 final privacy/demo gate
  -> M22 ED-14 integrated P0 evaluation
  -> M23 ED-15 delivery artifacts

M06 ED-03 approved inference adapter is independently preparable after M01;
its LIVE gate requires organizer credentials/categories and gates real AI acceptance
in M09/M11/M12/M14/M18/M19/M22. The source-backed non-AI work continues.
M16 is a separate ED-07 pre-integration regression checkpoint before M17.

P1 after P0: M24 i18n/a11y -> M25 LiveKit audio; M26 private help; M27 instructor insights;
M28 reward ledger -> M29 reward UX; M30 rich Studio; M31 visualization;
M32 PDF following; M33 volunteer pilot (external availability).
Optional/later after P0: M34 open-topic; M35 voice moderator (after M25);
M36 legacy investigation; M37 commercial/social decisions; M38 institutional expansion.
```

**Cycle resolution:** (a) ED-29 needs ED-08 evaluator integration, while ED-27 needs ED-29 and ED-08 needs ED-28. M10 implements canonical attempt envelopes/storage, permissions, pending state and idempotency *without fake accepted grading*. M11 implements validated activity choice using schemas, not ED-27 UI. M12 integrates ED-08 evaluator and completes accepted evidence. M13 then completes ED-27 rendering. (b) ED-05 depends on ED-30; ED-31 depends on ED-05 and ED-27. M08 ships the minimal necessary publish API + non-rich approval control; M15 adds complete editor/interactive preview. (c) ED-12 lists ED-07 as prerequisite, so provider budget primitives may be prepared in M06 but whole-room degradation acceptance closes only after M17. (d) privacy/synthetic checks start in every mission; ED-13's final full-product gate closes in M21.

**Dependency gate:** a predecessor may be PARTIAL while a specific versioned API is verified READY. Consumers may use only READY contractual slices; their *final* gate remains blocked until every required prerequisite passes. No false `DONE` propagation.

## External-input register (do not fabricate)

| Gate | Concrete external inputs | Independent work allowed | What must remain blocked |
|---|---|---|---|
| Approved inference / ED-03 | Organizer permission; approved endpoint; auth scheme/key via secret manager; compact & capable model IDs; API request/response shape; quotas, Retry-After, cost and data-retention rules; external service declaration | Strict adapter, local tests, real/mock/unavailable differentiation, safe prompt construction, fixed fixtures | `REAL_APPROVED` compact/capable success, live grounded/scored/facilitator gates and ED-14 full real inference |
| LiveKit / ED-17 | Approved LiveKit project URL, API key/secret, media/data-region/retention rules, test accounts/rooms, consent policy, permission for microphone/browser test | Signed-token policy with fake test keys, client controls, auth/revocation/expiry tests | Real multi-user audio, Cloud connection/latency tests |
| Speech / ED-25 | Priority agreement (P2 index versus P1 detailed entry); LiveKit Agent access; approved Deepgram Nova-3 and Cartesia Sonic 3.6 credentials; privacy/consent policy; actual measured audio paths | VAD/turn-taking state machine and simulated speech fixtures with provider stubs | Real attributed STT/TTS, <1500 ms onset claim, zero-recording verified path |
| Volunteers / ED-20 | Willing volunteers, informed consent and data capture policy, schedule, synthetic fixtures | Usability tasks, anonymous rubric, capture policy | Participant counts, qualitative observations and claimed outcomes |
| Product/business / ED-23/24 | Explicit team choice; actual pilot/partner needs; privacy/legal/org requirements; measured costs | dependency map, options and feasibility | Commercial scope approval, live billing/deletion, enterprise deployment or pilot-validated requirements |
| Organizer/submission / ED-15 | Confirm official competition rules, date/time/timezone, approval to share repo/screenshots, presenter identities/availability | draft reports/storyboard from true evidence | Final compliance sign-off, video or rehearsal claimed completed without assets |


## First executable mission (full detail): M00 — source-and-evidence audit

**Copy only the M00 block below into Codex; stop after its deliverables.** M00 is the first executable *read-only* mission. M01 is the first authorized *modifying* implementation mission, after M00's gate.

### M00 command prompt — extended acceptance

**Goal and task IDs:** establish a defensible, current snapshot of ED-01 through ED-35 and ED-DOC without implementing or marking any feature complete.

**Environment:** repository `/home/ashenix/Projects/mindflow`; `apps/web` Next App Router, `apps/api` Nest modular monolith/Mongo `module://`, `apps/ai` Python, pnpm workspace.

**Actions in mandatory sequence:**

1. Read all documents under Mandatory sources, applicable AGENTS.md, root package manifests, test/docker/CI settings, and the current reports. Check whether canonical status index/history contradicts later evidence; report instead of silently editing.
2. Inventory Git before touching artifacts (commands below). Capture branch, HEAD, status, existing diffs and untracked files, then note what belongs to older ED-07/09 and other tasks. Never reset/stash/clean/rebase/stage/commit/push.
3. Map actual route registration, internal Study/Notification/AI dispatches, models and unique indexes; provider adapters, authentication, source ACL, room snapshot/replay/presence/message journal, activity/attempt/evidence registry, frontend components and Python workers. Distinguish a contract declaration from an implemented handler and a mocked provider from a real one.
4. Extract all 35 acceptance checklists from canonical backlog. For each criterion, link to the actual implementation and a reproducible test if any. Categorize `VERIFIED`, `IMPLEMENTED_UNVERIFIED`, `PARTIAL`, `ABSENT`, `EXTERNAL_BLOCKED`; record version/revision/actor/read/write/recipient/privacy semantics and negative cases.
5. Build an edge list of prerequisites and resolve the ED-29/08/27, ED-05/30/31 and ED-12/07 ordering through staged contract gates; identify any newly discovered cycles. Group changes by truly independent, reviewable implementation slices, not original owner boundaries.
6. Safely establish a baseline: read scripts before invoking. Run non-mutating lint/strict typecheck/build where possible, and real isolated unit/integration/browser only with test prerequisites. Avoid migrations/production data. Record exact commands, cwd, exit codes, skip counts, versions and measured/test-service limitations. Compare claimed existing 128 API strict errors by identity/location; do not assume count remains constant.
7. Produce a provider-external-input table and readiness decision. Approved inference needs endpoint/model map/credential/quota/rules; LiveKit and speech need approved project/account/consent; volunteers need recruitment+consent; organizer rules need verification. The absence of any must not prevent unrelated contract/source/security work.
8. Produce immutable-fact vs assumption/disagreement ledger. Read AGENTS and actual contracts to determine correct precedence, flag ED-25 P2-index vs P1-detail conflict and any voice requirement overlap.
9. Write report artifacts only after checking directory conventions; do not rewrite canonical backlog statuses based on audit. Report status for each mission and the safest bounded M01 scope.

**Safe initial commands** (run from the repository root; avoid shell commands that mutate Git state):

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git diff --stat
git diff --name-status
git diff --cached --stat
git ls-files --others --exclude-standard
```

**Output artifacts:**

- `reports/EDNOVA-M00-SOURCE-AUDIT.md`: source/diff inventory, verified runtime topology, actual typed interfaces, implemented vs missing services.
- `reports/EDNOVA-ACCEPTANCE-MATRIX.md`: one row per canonical task criterion, exact source, evidence, blockers, tests, status classification, next mission.
- `reports/EDNOVA-MISSION-GATES.md`: task-to-mission dependency graph, contract readiness/owners, version and failure policies, external input register, cycle solutions.

**Acceptance:** all 35 IDs appear; ED-DOC explicitly documentation-only DONE; every critical Contract 03–07 owner/interface accounted for; every prior ED-07 report checked against the current working tree; ED-09 baseline classified; exact typecheck baseline and all skipped tests reported; no runtime files intentionally changed and no user work lost. A missing source/read/test must be recorded, not filled by speculation.

**Stop:** After M00's report and bounded M01 recommendation. Never start M01 automatically in the same change. No stage, commit, push, publish or deploy.

---

## Individual copy-ready Codex missions, in execution order

**Usage:** Each block below is a standalone Codex mission. Paste the entire mission to Codex. The universal execution contract above remains mandatory, and each mission repeats the key source/evidence boundaries. A mission is not authority to start the next one automatically. If a prerequisite is blocked, implement only contract-compatible independent portions and stop with evidence.

### M00 — SOURCE-AND-EVIDENCE AUDIT (READ ONLY)

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-01–ED-35 inventory; no feature completion. **Prerequisite gate:** None. This is the first action on the actual dirty repository. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Read every mandatory source and all applicable AGENTS.md files. Record document hash/date, contract versions and conflicts. Inspect `apps/api`, `apps/web`, `apps/ai`, `pnpm-workspace.yaml`, Python dependency lock/config, Mongo schema/indexes, auth/realtime infrastructure, installed model/provider configurations, Docker/CI and existing scripts. Map old `study-partner-*` aliases to real paths. Capture git status/diffs/untracked files and identify existing work belonging to all three original owners. Read ED-07 current/replay/presence/peer reports and ED-09 baseline report; compare to actual tests/code. Never trust historical labels.

**Implement across necessary domains:** Construct an acceptance-criterion ledger with source file/heading, actual implementation paths, currently reproducible test, owner-domain, dependencies, exact missing functionality, security exposure, gate and recommended implementation mission. Build a source-to-contract map for Contracts 03–16 (verify real numbering), operation and DTO registries, source revisions, activity definitions, attempts/evidence, room public/private events and inference modes. Identify high-risk defects and destructive scripts; inspect but do not change runtime.

**Contracts, persistence and authorization:** Produce a versioned contract readiness matrix: `READY` only with real implementation+negative authorization tests; `PARTIAL/MISSING/BLOCKED` otherwise. Clearly flag ED-25 P1 detailed vs P2 index, ED-05/31 UI ordering and ED-08/29/27 cycle. Capture ED-03 and external blockers without inventing keys.

**UI, failure and recovery:** No feature UI changes. Review existing browser flows and distinguish observed UI states from test-only mocks, unavailable notices and real accepted persistence.

**Concrete acceptance and verification:** Read-only baseline: identify exact pnpm/Poetry/pytest commands; execute safe lint/typechecks/build/unit subsets, test DB and browser only if harmless and services available. Keep any started containers in their prior state. Record 128-diagnostic baseline identities, failures, skips, and code provenance; never run production cleanup or migrations.

**Evidence, canonical status and stopping rule:** Deliver `reports/EDNOVA-M00-SOURCE-AUDIT.md`, `reports/EDNOVA-ACCEPTANCE-MATRIX.md` (link canonical backlog, no competing statuses) and `reports/EDNOVA-MISSION-GATES.md`; include actual Git baseline and dependencies, which preconditions are READY, source disagreements and a precise M01 patch target. **PASS means a truthful audit**, not ED task completion. Stop after reporting; do not implement M01 in the same change. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M00-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M01 — BASELINE REPAIR AND REPRODUCIBLE QUALITY GATE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-01. **Prerequisite gate:** M00 evidence audit. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect cleanup audit, package scripts, API TS configurations including tests/shared/modules, Next import/route generation, Nest contracts/generator, Python Poetry lock/Docker layers, startup/auth fixtures and CI. Diff currently uncommitted fixes.

**Implement across necessary domains:** Repair reproducibly failing strict API typechecks and lint in batches of root causes (previous 128 TS errors must be reconfirmed); restore Python dependency/image parity, test broker/DB setup, generate routes from source not generated output, maintain legacy compatibility. Keep CI reproducible and avoid disabling checks.

**Contracts, persistence and authorization:** Preserve Better Auth, module dispatch, resource guards, contract schema compatibility and no broad framework migration. Correct test types without bypassing actual invariants.

**UI, failure and recovery:** Ensure authorized Next/Nest startup and explicit unavailable states; fix UI regression only if baseline failing.

**Concrete acceptance and verification:** Run exact build, **strict** typecheck, lint, all feasible unit/integration/auth, Python dependency install/pytest and production browser smoke/CI equivalent; compare before/after diagnostics, no hidden skips. Verify clean-start Docker with nonproduction fixtures.

**Evidence, canonical status and stopping rule:** ED-01 DONE only when all canonical required checks pass including Python/CI policy. Otherwise PARTIAL with residual failures and exact owners/next patch. Report `reports/EDNOVA-M01-BASELINE.md`. Do not touch ED-02 feature behavior beyond required baseline regressions. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M01-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M02 — CROSS-RESOURCE AUTHORIZATION AND TRANSPORT ISOLATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-02. **Prerequisite gate:** M01 baseline gate for touched paths. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect Better Auth/operationPolicy, course summaries/files/static upload handlers, notification chat/history/voice, team sessions, `realtime.ts`, private eval jobs, caches and foreign object access paths. Re-run previous room revocation regressions.

**Implement across necessary domains:** Close IDORs and alternate download/static bypasses before any source content is read, AI-retrieved, cached or broadcast; enforce actor/tenant/enrollment or personal-owner scope at authoritative Nest boundary; validate recipient on send and outbound delivery. Provide source-access decision interface to other domains without duplicating actor policies.

**Contracts, persistence and authorization:** One canonical permission helper/dispatch result; do not assume admin or invite grants private course access; cache keys contain authorized scope and revision; preserve public avatar/static assets.

**UI, failure and recovery:** Fix direct-route UI failure/denied/revoked states without leaking existence/private previews.

**Concrete acceptance and verification:** API negative matrix: owner/other user/teacher/room member, guessed ID, direct file URL, revoked session, stale WS and cached result; two-browser revoke and legitimate owner access. Build/type/lint regression.

**Evidence, canonical status and stopping rule:** Only mark ED-02 DONE after all canonical private course/chat/voice/source transport gates, including relevant new institutional permissions when added. Report interim PARTIAL if institutional ACL is not yet available. `reports/EDNOVA-M02-ISOLATION.md`. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M02-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M03 — CANONICAL CROSS-DOMAIN CONTRACTS AND COMPATIBILITY FIXTURES

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-26. **Prerequisite gate:** M01 + M02; current producer/consumer audit. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect Contracts 03–16, existing schema validation/types/events, generated route adapter, Node/Python payloads, DTO projections, docs/data-model and downstream consumer imports; identify draft vs approved contracts.

**Implement across necessary domains:** Freeze versioned JSON schemas/types and shared fixtures for published context, immutable revision pins, activity definition (quiz & guided problem), proposal, private attempt/result/evidence, room public state/sequence, completion, provider-mode/failure envelopes. Use existing shared package and generators; no second schema registry. Add compatibility and migration policy.

**Contracts, persistence and authorization:** Strict invalid type/version/schema rejection; public projections exclude rubrics/keys/private answers; Python proposals cannot execute code; authorized actor/source/ref provenance documented; version transitions explicit.

**UI, failure and recovery:** Provide typed UI fixture consumption/renderer contract and safe unsupported-type behavior; do not claim live renderer built.

**Concrete acceptance and verification:** TS/Python schema round trips, bad versions/unknown types/foreign source/malformed model output, payload visibility snapshots and generator drift; focused type checks. Diff consumer usage.

**Evidence, canonical status and stopping rule:** ED-26 DONE only when canonical producer+consumer examples for both activity types and visibility/revision/errors agree, even if owning runtime endpoints are pending. Report version table and contract fixtures in `reports/EDNOVA-M03-CONTRACTS.md`. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M03-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M04 — INSTITUTION, COURSE MEMBERSHIP AND ENROLLMENT

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-04; ED-02 institutional recheck. **Prerequisite gate:** M02, M03 contract slice. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect auth account/role model, tenant context, owner courses, invitation/auth helpers, institution UI and existing database indices and migrations.

**Implement across necessary domains:** Implement scoped institution memberships, instructor assignment, learner enrollment/invitations, role and revocation semantics plus personal workspace compatibility; model/index and authorized Nest command/query paths, seed fictional institutions. Avoid identity migration and global roles as course authority.

**Contracts, persistence and authorization:** Course code grants limited enrollment, not instructor/admin; active role/institution/course and expiry checked at every protected operation; unique enrollment identity, replay-safe invitation and revocation; old sessions lose access.

**UI, failure and recovery:** Course context selector/onboarding/instructor enrollment controls with pending/rejected/expired states, no frontend-only authorization.

**Concrete acceptance and verification:** Real Mongo role matrix across two institutions + personal, expired/replayed invitation, enrollment revocation mid-session, API + synthetic instructor/student browser. No private cross-scope DTOs.

**Evidence, canonical status and stopping rule:** ED-04 gate: two institutions and personal mode isolated, revoked access enforced, no privilege escalation. Report and hand off canonical access query consumed by M05/M08/M09/M17. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M04-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M05 — SCOPED FILE INGESTION, HIERARCHY AND SOURCE PROVENANCE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-06. **Prerequisite gate:** M02 and institutional scoped auth M04. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Trace Node course/file IDs through upload, ingestion jobs, AI worker, extraction, chunks, embeddings/index, authorization, file storage and retrieval. Inspect real source path aliases.

**Implement across necessary domains:** Implement a single versioned source manifest with original file hash, source/chunk/section/page refs or explicit unknown, provenance origin and ambiguities; preserve original private file, bounded parsing/OCR, deterministic extraction and retryable ingestion. Consistent Node/Python/index IDs, once-per-revision indexing, visible job state.

**Contracts, persistence and authorization:** Owner/enrollment/source revision authorized before download/index/retrieval; no foreign cache reuse; failed extraction cannot publish content, duplicate jobs idempotent, no unsafe file paths.

**UI, failure and recovery:** Upload/progress/preview failure states and editable extracted draft candidate, not automatic publication. Keep file size/type policy and uncertain page references honest.

**Concrete acceptance and verification:** Text PDF, scanned/encrypted/oversize, parser timeout, duplicate worker delivery, mismatched shared paths, unauthorized download, revoked cache access; real Nest/Mongo and Python extraction worker tests.

**Evidence, canonical status and stopping rule:** ED-06 DONE only after source parity and authorized private/official/shared material acceptance. Publish fixture consumed by M07/M08/M09. Report. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M05-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M06 — APPROVED MODEL ADAPTER AND REAL-INFERENCE GATE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-03. **Prerequisite gate:** M01. External provider approval/credentials for live gate (optional for adapter build). Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect LiteLLM config, Python llm_client, Nest AI client/message envelope, server-only env and current implicit mock behavior; consult organizer usage/quotas/declarations.

**Implement across necessary domains:** Centralize compact/capable operation mapping in one adapter with explicit real/mock/fallback/unavailable provenance, redacted telemetry, bounded retries/timeout/quota handling and no extra-account bypass. Preserve existing AI orchestration and worker contracts.

**Contracts, persistence and authorization:** Never send credentials/client cookies or unrelated private learner data. Source authorization precedes inference, with type/version checked responses. Synthetic fixtures only.

**UI, failure and recovery:** UI must display unavailable/pending/degraded without pretending inference succeeded; existing room text/material access continues.

**Concrete acceptance and verification:** Python and Nest tests for missing/invalid key, provider timeout, 429/Retry-After, malformed payload, redaction; perform one actual approved compact and one capable request ONLY when access supplied. Record provider/model ID/category without secret.

**Evidence, canonical status and stopping rule:** Adapter implementation may pass as PARTIAL while ED-03 canonical status stays BLOCKED until two real approved calls and known quotas are evidenced. Provide exact missing external input request. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M06-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M07 — COURSE STUDIO DRAFT HIERARCHY AND STALE-EDIT CONTROL

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-30. **Prerequisite gate:** M03/M04/M05. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect course/source models, ingestion draft outputs, revision and save APIs, learner read projections and actual Studio UI candidates.

**Implement across necessary domains:** Implement editable chapter/section/topic hierarchy, objective links, provenance/ambiguity, expected draft version, patch/audit semantics and Node/Python provenance IDs within existing Study module. Keep public published revision separate.

**Contracts, persistence and authorization:** Instructor ownership/institution permission, nested resource ACL, compare-and-swap stale edit rejection; private drafts never appear to enrolled learners before publish.

**UI, failure and recovery:** Minimal editor API fixtures and safe preview data; UI support needed to verify save/reload errors, without replacing full ED-31 UI.

**Concrete acceptance and verification:** Real Mongo create/edit/read, simultaneous saves, unauthorized draft access, invalid nesting/source refs, failed replacement preserving published state; TS/contract tests.

**Evidence, canonical status and stopping rule:** ED-30 DONE on reproducible corrected hierarchy and source refs. Versioned draft contract to M08/M14/M15. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M07-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M08 — REVIEW, IMMUTABLE COURSE PUBLICATION AND ACCESS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-05; Contract 03 runtime. **Prerequisite gate:** M03/M04/M05/M07. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing Course status and owner-only course endpoint, published-context contract, institution enrollment ACL, source manifest and old room revision rejection.

**Implement across necessary domains:** Implement approved immutable published revision snapshot/hash and source/activity pin manifest; review/publish command CAS expected draft version, atomic published-pointer switch after artifacts prepared; readable old revision on failed replacement; official enrollment grants through Study dispatch. Build minimal approval/publish UI or integrate current upload screen; richer editor in M15.

**Contracts, persistence and authorization:** Read learner published context only via canonical Contract 03; protect unpublished draft/keys, immutable pins, unknown/revoked/stale revisions; no ingestion-completed->published shortcut.

**UI, failure and recovery:** Instructor sees review/preview/publish and conflict/retry/rejected states; enrolled learner sees approved current pinned version, outsider denied.

**Concrete acceptance and verification:** Real Nest/Mongo instructor/learner browser, owner/foreign instructor/revoked enrollment, duplicate publish and stale editor, failed ingest during publish, previous pinned activity retains old revision.

**Evidence, canonical status and stopping rule:** ED-05 DONE only if all publication API+UI acceptance meets backlog; otherwise PARTIAL pending richer approved UI. This unlocks Contract 03 consumers without marking ED-31 DONE. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M08-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M09 — SOURCE-GROUNDED RETRIEVAL, TUTOR AND VERIFICATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-10. **Prerequisite gate:** M05/M08; M06 provider adapter, real call conditional. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing FAISS/retriever/index_store/planner/evaluator/source query, `objectiveContext`, source authorization dispatch and stored provenance.

**Implement across necessary domains:** Reuse one index; retrieve only authorized revision-filtered chunks, bounded context, explicit source refs, injection-isolated source content and grounded response/citation verification. Implement public/private operation DTO and optional capable verified model path; deterministic no-evidence path.

**Contracts, persistence and authorization:** No source-access decision by model, no arbitrary web result treated as course truth, reject invented citations, stale/revoked index/cache cannot leak; outputs labeled tentative when unsupported.

**UI, failure and recovery:** Tutor UI shows excerpt/citation/uncertainty and source unavailable/retry; do not imply a model answer is ground truth merely because cited.

**Concrete acceptance and verification:** Synthetic known question+answer key, forged refs, prompt injection, no passage, revoked/foreign source, worker retry and actual approved service when supplied; real Nest/Python tests.

**Evidence, canonical status and stopping rule:** ED-10 remains PARTIAL if real approved inference mandated and missing; deliver grounded helper to M11/M12/M19. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M09-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M10 — PRIVATE ATTEMPT PERSISTENCE AND EVIDENCE KERNEL

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-29 foundation (not final ED-29 status). **Prerequisite gate:** M02/M03/M04/M08; no ED-08 evaluator required for kernel. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing EvalResult, competency/evidence models, async jobs, participant identity and Contract 05/06/07 envelopes; check legacy submit-flag behavior.

**Implement across necessary domains:** Implement one owning activity attempt intake and private status/result contract with activity/revision/prompt identity, actor attribution, stable attempt ID, dedup/CAS, private recipient projection and deterministic pending/rejected/unavailable behavior. Store evidence candidates only, do not accept grade/award without validated evaluator.

**Contracts, persistence and authorization:** Strict actor/auth/source/activity version validation, answer/rubric excluded from public snapshots and room events, recipient-only query/replay, revocation checks; serialized DTOs exclude secrets.

**UI, failure and recovery:** Solo/room submit UI can show submitted/pending/error based on true authoritative receipt; do not fake completion, mastered concept or result.

**Concrete acceptance and verification:** Real Mongo concurrent duplicate submissions, uncertain ACK, restart recovery, guessed foreign attempt, invalid source revision, unauthorized result, no-evaluator unavailable; unit/contract/browser smoke.

**Evidence, canonical status and stopping rule:** M10 PASS as **kernel readiness**, ED-29 stays PARTIAL until evaluator and accepted-evidence integration in M12. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M10-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M11 — GROUNDED INTENT-TO-ACTIVITY SELECTOR

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-28. **Prerequisite gate:** M03/M08/M09, M06 adapter; live acceptance conditional. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing intent/planner/evaluator prompts, activity schemas and source refs; map supported quiz/guided-problem types.

**Implement across necessary domains:** Build schema-validated typed selector/proposal of allowed activity type and target source/objective; return a *candidate*, not published activity; reject unknown type/version, model code/HTML, forged citations, and unsupported source. Safe deterministic fallback where specified.

**Contracts, persistence and authorization:** Authorize source and revision before inference; model cannot choose unrelated actor, source or state mutation. NestJS validates proposal before any draft acceptance.

**UI, failure and recovery:** Learner/instructor displays candidate+provenance and review controls; invalid/unavailable results get truthful states.

**Concrete acceptance and verification:** Known question->type selection, malformed model output, forbidden code, insufficient passage, foreign source, provider failure and verified approved inference if accessible. Nest+Python schema parity.

**Evidence, canonical status and stopping rule:** ED-28 DONE only after canonical selection acceptance incl required real model evidence; otherwise PARTIAL/blocked with fixtures usable by M12/M14. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M11-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M12 — GUIDED DIAGNOSTIC PLUS ACCEPTED PRIVATE EVIDENCE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-08 and ED-29 finalization. **Prerequisite gate:** M09/M10/M11; M06 live provider for actual inference cases. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect Socratic evaluator/state machine/scoring/job worker and attempt kernel; compare private check/rubric contract.

**Implement across necessary domains:** Implement 2–4 objective-linked diagnostics, provisional level, unanswered vs wrong, graduated hints/explicit reveal, language/detail preferences, corrected second attempt. Route evaluator candidate through NestJS rubric/version/source/actor validation, commit one accepted evidence and private status, never infer fixed mastery. Complete ED-29 accepted signal/idempotency.

**Contracts, persistence and authorization:** Rubric/keys never to public browser/WS; no client scores, forged model grades or stale source; pending/unavailable results cannot produce completion or XP.

**UI, failure and recovery:** Solo flow initial diagnostic->guided problem->private feedback->next check, proper loading/failed/retry states, no fake success.

**Concrete acceptance and verification:** Real Mongo/Python/unit and browser beginner/advanced/untested, duplicates/concurrent callbacks, accepted vs pending, corrections, invalid rubric/source/citation and model outage. Real approved compact/capable tests separately evidenced.

**Evidence, canonical status and stopping rule:** ED-08/29 DONE only if every own full criterion passes; share private attempt API and non-revealing accepted completion projection with room consumers. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M12-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M13 — TRUSTED SHIPPED ACTIVITY RENDERER

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-27. **Prerequisite gate:** M03/M11/M12. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect actual Next learning UI/components, Contract 04, versioned activity fixture, evaluator and private attempt interfaces. Find and reuse existing safe widgets.

**Implement across necessary domains:** Implement fixed registered `quiz` and `guided_problem` components in existing web feature; strict schema/type/version validation and error fallback; attempts route through owning private API, never evaluator code/HTML from model. Components support keyboard/mobile and no public key leakage.

**Contracts, persistence and authorization:** Activity DTO public-only, source/revision match, no raw rubric/answers; reset/revisit does not create new accepted evidence; unsupported types cannot execute scripts.

**UI, failure and recovery:** Interactive prompt/steps/hints/submit, real pending/accepted/private feedback, loading/unavailable and accessibility; use reusable public renderer for Studio and Study Together.

**Concrete acceptance and verification:** Unit schema/XSS/keyboard/responsiveness and Next browser quiz/problem plus real Nest attempt boundary, private result leak regression; strict build/lint/typecheck.

**Evidence, canonical status and stopping rule:** ED-27 DONE with both activity types independently validated; expose trusted renderer contract to M15/M17. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M13-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M14 — SOURCE-BACKED COURSE STUDIO ACTIVITY PROPOSALS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-32 P0. **Prerequisite gate:** M05/M07/M08/M09/M11. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing Studio draft source mapping, AI proposal endpoints/jobs, source revision and candidate activity schema; review prior generated content behavior.

**Implement across necessary domains:** Generate source-grounded quiz/guided-problem candidates against corrected hierarchy and approved source; store as reviewable draft with citation/provenance, validation and stale edit rules. No model autopublish. Keep future rich-settings extension separate (M30).

**Contracts, persistence and authorization:** Study source ACL before retrieval/model, never trust generated version/code/answer, verify citations and rubric handling; candidate must remain distinct from reviewed artifact.

**UI, failure and recovery:** Instructor sees proposal/pending/no-evidence/review/edit/reject actions and bad-source warnings; no fake approved badge.

**Concrete acceptance and verification:** Python + real Nest/Mongo proposal generation, missing evidence, forged source, duplicate requests, stale draft, provider unavailable/real mode evidence, invalid schema and editor preview.

**Evidence, canonical status and stopping rule:** ED-32 P0 grounding gate passes independently; task stays PARTIAL if its canonical full P1-rich controls not complete. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M14-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M15 — COURSE STUDIO EDITOR, PREVIEW AND APPROVAL JOURNEY

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-31 P0; ED-05 final UI verification. **Prerequisite gate:** M07/M08/M13/M14. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing Course Studio pages, draft routes, `course-list`, uploader, approved revision management and renderer contract.

**Implement across necessary domains:** Complete responsive instructor editor for hierarchical corrections, provenance, generated candidate review, trusted quiz/problem preview, version conflicts, approval/publish flow and enrolled learner opening approved revision. Use existing Next shadcn conventions and Study module endpoints.

**Contracts, persistence and authorization:** All edits/publish server-enforced via correct instructor/institution, immutable published refs, conflict-safe saves; no hidden correct answers in public preview; no cross-institution publication.

**UI, failure and recovery:** Explicit save/failed/stale/approval/published stages; old published version remains visible when replacement fails.

**Concrete acceptance and verification:** Two synthetic instructor/student browser flow upload->correct->preview->publish->join; foreign instructor denied, stale concurrent edit, source revocation, generated invalid proposal; API/web builds and strict checks.

**Evidence, canonical status and stopping rule:** ED-31 P0 gate and ED-05 full gate if all acceptance passes. Rich customization remains M30 P1 with full ED-31 parent PARTIAL if canonical criteria require it. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M15-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M16 — ED-07 PRE-INTEGRATION REGRESSION AND CONTRACT READINESS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-07 prerequisite checkpoint. **Prerequisite gate:** M08/M12/M13/M15; existing ED-07 evidence reports. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Reinspect old and current room, replay, presence and peer-text code and uncommitted diffs; inspect Contract 03–07 actual endpoints, renderer and attempt services.

**Implement across necessary domains:** Run read-first compatibility checks; make only smallest isolated security/contract adaptation necessary to consume published course, versioned activity and private accepted signal. Do not implement full room integration in this mission.

**Contracts, persistence and authorization:** Preserve authoritative seq, exact command receipts, presenter ACL, private/public projections and single-instance presence; record readiness of existing transport.

**UI, failure and recovery:** Verify RoomView integration slots and explicit unavailable UX; avoid fake activity or attempt completion.

**Concrete acceptance and verification:** Re-run 81/29 reported test set by actual current scripts and three browser regressions when feasible; no claim if counts differ. Contract tests for owner API handoffs.

**Evidence, canonical status and stopping rule:** Deliver `reports/EDNOVA-M16-ROOM-READINESS.md`; if owner contracts missing, map exact blockers, then stop dependent work. Do not mark ED-07 DONE. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M16-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M17 — FINAL SHARED LEARNING ROOM INTEGRATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-07 P0 final gate. **Prerequisite gate:** M16 READY; published source Contract 03, activity Contract 04, private attempts/evidence Contracts 05–07. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect room commands/StudyRoom/realtime/sessionClients, RoomView/reducer/SessionChat, shared renderer and authorized published-context dispatch. Confirm recent evidence still reproducible.

**Implement across necessary domains:** Integrate published revision pin and enrollment ACL with room create/join/read/reconnect; presenter-only valid activity selection and shared step/source pointer via authoritative seq/idempotent commands; reuse trusted renderer; submit individual attempts directly via owning private service; show permitted aggregate completion derived solely from accepted signals.

**Contracts, persistence and authorization:** Reject stale/foreign/unpublished activity and source versions, member revocation, duplicate command/attempt, raw rubric/answer/private attempt broadcast; preserve peer chat/presence/replay and known single-instance limitation.

**UI, failure and recovery:** 2–4 independently authenticated contexts show same public activity and phase; private submit/feedback for recipient, safe count only, robust disconnected/reconnected state, explicit service unavailable and refused action.

**Concrete acceptance and verification:** Real Nest/Mongo + four-context browser flow, presenter handoff, source revocation, stale pins, duplicate/lost ACK, restart, XSS/malicious activity, private result read by peer, socket recipient isolation, no-AI text/transport. Keep full PDF following for M32.

**Evidence, canonical status and stopping rule:** ED-07 DONE only when ALL canonical P0 room criteria pass; source/activity/privacy/browser evidence in `reports/EDNOVA-M17-ROOM.md`. Report any remaining page-following P1 separately, not as P0 acceptance. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M17-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M18 — CAPACITY-AWARE INFERENCE ROUTING AND DEGRADED OPERATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-12. **Prerequisite gate:** M06/M09/M17; provider access for real category measurements. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect client/router/worker/broker retries, transport timeout, operation categories, job statuses, existing fallbacks, room errors.

**Implement across necessary domains:** Implement one total bounded operation/call/token/time budget across layers, compact/capable routing, dedup by actor/source/revision/recipient, Retry-After and bounded retries; explicit deferred/unavailable and safe deterministic fallback. Add per-domain mapping without new AI service.

**Contracts, persistence and authorization:** Never retry unauthorized requests or multiply transport/router/broker attempts silently; uncertain assessment remains pending; private cache/logging scoped; no silent mock.

**UI, failure and recovery:** User sees progress, limited mode, retry options; rooms/chat/materials/peer audio (when present) unaffected by AI outage.

**Concrete acceptance and verification:** Python+Nest fault injection 429, timeout, malformed response, duplicate, capable loss, restart, budget exhaustion and recovered provider; use real approved call data/latencies only if available.

**Evidence, canonical status and stopping rule:** ED-12 DONE when all category/failure gates evidenced; otherwise note provider-blocked live capacity metrics and preserve independent room operation. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M18-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M19 — PEER-FIRST TEXT FACILITATOR

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-09. **Prerequisite gate:** M17/M18/M12/M09; real inference conditional M06. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect ED-09 baseline audit and uncommitted facilitator UI/API/Python, room phases, peer messages and source/revision query; do not overwrite work.

**Implement across necessary domains:** Implement bounded peer-first policy/state in existing AI service and Nest orchestrator; ask/hint/check/finish, peer justification before reveal, optional invitations/targeted decline, supported misconception and disagreement correction, explicit schema-validated proposals. NestJS validates source/revision/actor/presenter/expected seq and commits accepted commands; AI never writes room state.

**Contracts, persistence and authorization:** Authorized public context only with bounded messages, no individual private results; reject stale AI completions, duplicates, forged source or side-effect instructions. Real vs mock/fallback/unavailable unambiguous.

**UI, failure and recovery:** Room facilitator panel with proposal/review, targeted invitation/decline, bounded help states, explicit failure, no auto-answer to every peer message.

**Concrete acceptance and verification:** Python policy/state transitions, Nest real invalid/stale proposal/ACL tests; three-learner browser known misconception, declines, peer justification, timeout/429/no model, live approved inference when credentials available.

**Evidence, canonical status and stopping rule:** ED-09 DONE only with full canonical peer-first and real-service evidence as required; otherwise PARTIAL/TODO accurately reported. No ED-11 work. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M19-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M20 — PRIVATE FINAL CHECKS, SAFE DEBRIEF AND NEXT STEPS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-11. **Prerequisite gate:** M12 accepted evidence, M17 room, M19 facilitator; ED-29 final. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect EvalResult/competency core sessions, room completion APIs, accepted evidence service, legacy hasSubmitted/submit-flag and worker summaries.

**Implement across necessary domains:** Implement recipient-only final checks/recoverable results through existing evaluator/attempt service; public recap from public contributions+permitted safe completion signals; private next-step recommendation scoped to learner; idempotent room completion and one reward *candidate* (not direct XP). AI public recap failure must not invalidate accepted private checks.

**Contracts, persistence and authorization:** No private answers/rubrics/individual mastery in room recap/creator or peer queries; stable completion identity, version pins, actor/source ACL, recheck revocation, untested != wrong.

**UI, failure and recovery:** Debrief UI with public group recap, private individual next step, pending/unavailable/retry, honest no-inference behavior.

**Concrete acceptance and verification:** Three-browser completed/pending/absent learners, duplicate completion and callback, source revocation, private history IDOR, failure during recap, restart+recovery, reward candidate once; verified real inference if needed.

**Evidence, canonical status and stopping rule:** ED-11 DONE only with canonical full acceptance; report public vs recipient-only projections. ED-33 ledger deferred to M28. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M20-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M21 — FINAL PRIVACY, SYNTHETIC DATA AND RETENTION GATE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-13. **Prerequisite gate:** M02/M04/M06 plus completed P0 features M08–M20. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect credentials/env, provider outbound payloads, cookies/page serialization, Mongo events, logs, caches, room chat/voice, synthetic demo assets, upload/publication and video/script drafts.

**Implement across necessary domains:** Define/enforce demo synthetic aliases and courses, server-only secrets, least-minimum model payloads, source/attempt/private help retention/deletion scopes, no recording/training/camera pathways. Repair discovered leaks across owning services. Keep repeatable fictional seed fixture.

**Contracts, persistence and authorization:** Auth before retrieval/provider, remove keys/rubrics and private learner evidence from public events/logs, forbid real private user data in demo, revoked cache inaccessible.

**UI, failure and recovery:** Safe seeded instructor/learner demo, consent/data notices where required, explicit refusal for unavailable provider; no real-person screenshots without approval.

**Concrete acceptance and verification:** API/WS/AI prompt and log redaction tests; secret scans, direct URLs, cross-actor cache, public recap leak, seed reproducibility, No stored voice claim only with actual media tests if voice present.

**Evidence, canonical status and stopping rule:** ED-13 DONE only after documented synthetic-demo/privacy checklist and actual negative evidence. No production data deletion. Report risks and retention decisions. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M21-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M22 — INTEGRATED P0 CHALLENGE ACCEPTANCE

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-14. **Prerequisite gate:** M01–M21 relevant P0 gates, especially M08/M12/M17/M19/M20/M21; external real inference for final live gate. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Re-read testing-plan and canonical acceptance for ED-01–13, 26–32. Inventory artifacts and test setup; distinguish live vs mocks and locally verified single-instance behavior.

**Implement across necessary domains:** Build reproducible synthetic journey: instructor ingestion->draft correction->approved immutable publication->source-backed activity->individual attempt->multi-user room->AI facilitator->private final check->safe public debrief/private next steps. Add adversarial revision/authorization/schema/inference outage scenarios. Fix only integration regressions needed to close P0.

**Contracts, persistence and authorization:** Prove current authorization before every retrieval/inference/delivery, immutable refs, idempotency and public-private isolation across the FULL journey.

**UI, failure and recovery:** Automate multiple real browser contexts and accessible critical screens, use real services where claimed; failures reflect explicit UX.

**Concrete acceptance and verification:** Full Node API/Next/Python/CI/Docker suites, clean-start source-backed multi-browser, category real approved inference, failure injections, redacted evidence, exact pass/fail/skip counts and measurements (no fabricated latency).

**Evidence, canonical status and stopping rule:** ED-14 DONE only if the full canonical challenge gate is verified; unresolved external live provider => BLOCKED/PARTIAL, not silently green. Freeze and report the P0 demo revision. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M22-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M23 — HACKATHON SUBMISSION AND BUSINESS ARTIFACTS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-15. **Prerequisite gate:** M22 evidence; verify organizers actual submission rules and permission to release assets. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Read hackathon delivery rules/organizer communications, README/setup, current demo app, module reports, business notes and release/privacy constraints.

**Implement across necessary domains:** Prepare reproducible setup and authorized repo/GenAI explanation, <=6-page report/business note, Phase 1 demo script, <=90s recorded video if media tools/approval available, <=4min two-presenter pitch and 2min Q&A readiness. Claims must match real implementation and budget/latency measurements; mark business assumptions unvalidated.

**Contracts, persistence and authorization:** Secrets/log/screenshot rights review, no publishing without approval; no live private learner data or unverifiable results.

**UI, failure and recovery:** Demo should traverse the real P0 journey; include offline/degraded mode and provider provenance honestly.

**Concrete acceptance and verification:** Check actual page count, video runtime with media inspection, rehearsal duration with evidence (not fabricated), clean machine setup, package locks, smoke tests, organizer rule checklist.

**Evidence, canonical status and stopping rule:** ED-15 DONE only when physical media files, verified constraints, external-reader setup and sign-off exist; missing presenter recordings/rehearsal remain BLOCKED. No submission/publication. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M23-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M24 — LANGUAGE, RTL AND ACCESSIBILITY ACROSS DOMAINS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-16. **Prerequisite gate:** Stable ED-08/09/14 P0 acceptance. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect locale prefs, prompts, forms, component a11y and current mobile/keyboard tests across Studio, learner and rooms.

**Implement across necessary domains:** Support EN/FR/Arabic/Darija and code-switching with consistent language/detail preference, RTL form/layout and source/math/formula fidelity; keep objective/rubric refs language independent.

**Contracts, persistence and authorization:** No ability inference from language; source scope and private feedback remain protected; unsupported-language confidence disclosed.

**UI, failure and recovery:** Keyboard, screen reader labels, focus/status, reduced motion, responsive room renderer and usable language selector.

**Concrete acceptance and verification:** Fixed multilingual correctness rubric with human review, browser axe/keyboard/mobile, Python prompt output, source ref preservation and privacy regressions; no invented accuracy.

**Evidence, canonical status and stopping rule:** ED-16 DONE on recorded critical journeys; report low-quality/unsupported cases. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M24-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M25 — LIVEKIT WEBRTC PEER AUDIO CONTROL/MEDIA

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-17. **Prerequisite gate:** P0 stable, M17 room, M21 privacy. External LiveKit Cloud secrets/project and voice-consent approval for real gate. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect Contract 11, legacy voice signaling and current realtime gateway/client; check installed LiveKit packages and actual proxy/HTTPS configuration.

**Implement across necessary domains:** Implement server-issued short-lived LiveKit room JWT after current room+course membership/enrollment/consent checks, client connect/mute/deafen/speaking state and media isolation. LiveKit carries audio, NestJS owns authorization; do not build a second P2P system.

**Contracts, persistence and authorization:** Token expiry and revocation policy, no key exposure, no stored audio by default, room identity isolation, consent withdrawal behavior.

**UI, failure and recovery:** Audio panel with device permission/errors/reconnect and text/presence independence; mic denial gracefully degrades.

**Concrete acceptance and verification:** Signed-token negative tests (outside room, no consent, expired), actual multi-user media and reconnect/device permission/network test ONLY with approved Cloud setup. Never claim physical audio from mocked SDK.

**Evidence, canonical status and stopping rule:** ED-17 PARTIAL until genuine multi-user LiveKit audio evidence, even if token/API/UI suites pass. Report provider inputs. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M25-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M26 — RECIPIENT-ONLY ROOM HELP

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-18. **Prerequisite gate:** M19/M20/M21 and approved tutor/source interfaces. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect private job/results existing evaluator/tutor APIs and room WS broadcaster; review scoped caches/history.

**Implement across necessary domains:** Build distinct private help request/result storage+history, source-grounded learner-only assistant operation, permissioned optional safe excerpt sharing and restart/retry recovery; reuse canonical tutor/renderer/attempts.

**Contracts, persistence and authorization:** Recipient identity enforced at Nest queries/events/caches and provider; room owner, instructor and other members cannot infer private content; recap/audio excluded.

**UI, failure and recovery:** Private help drawer, loading/pending/unavailable/retry and explicit share action without automatic broadcast.

**Concrete acceptance and verification:** Multiple user browser negative requests/guessed job IDs, revocation, cross-recipient cache, reconnect, prompt injection and group recap/audio leakage; real inference mode proven separately.

**Evidence, canonical status and stopping rule:** ED-18 DONE only with recipient-only persistence, recovery and no leak evidence. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M26-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M27 — INSTRUCTOR COURSE-AGGREGATE INSIGHTS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-19. **Prerequisite gate:** M04/M20/M21; safe accepted evidence available. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect instructor scope, analytics events, EvalResult, course aggregates, cohort sizes and privacy threshold policy.

**Implement across necessary domains:** Build deterministic practiced-objective/needs-follow-up aggregates for instructor's own course from preapproved public/safe evidence projections. Enforce a reviewed small-cohort suppression threshold; no student drilldown or raw transcripts.

**Contracts, persistence and authorization:** No instructor default private result access; aggregation threshold and scope reviewed, query and caches keyed to course/revision/grants.

**UI, failure and recovery:** Instructor dashboard count, suppression notice, no-data/error and accessible chart/table; AI summary optional and nonauthoritative.

**Concrete acceptance and verification:** Synthetic below/above cohort threshold, revoked instructor, cross-institution denial, reconstruction inference tests and browser checks.

**Evidence, canonical status and stopping rule:** ED-19 DONE only with approved threshold and negative inference evidence. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M27-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M28 — REWARD LEDGER AND EVIDENCE-GATED AWARDS

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-33. **Prerequisite gate:** M12 accepted evidence, M20 completion candidate, M21 privacy; stable P0. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing XP/level/badge code and grants, activities, ledger and profile update transactions; locate potential reward side effects.

**Implement across necessary domains:** Implement one durable idempotent evidence->award consumer and recoverable ledger/profile update with policy version, bounded XP, achievement uniqueness, no chat/views/idle/failed/unverified reward. XP distinct from mastery.

**Contracts, persistence and authorization:** Recipient-scoped award rows, source/revision/event provenance, no model-chosen arbitrary XP. Concurrent duplicate/restart safe.

**UI, failure and recovery:** Learner sees correct reward summary but detailed UI in M29; pending/failed award explicit.

**Concrete acceptance and verification:** Real Mongo concurrent same evidence, crash/lost ACK, duplicate callbacks, two award conditions, ledger/profile reconciliation, invalid evidence, revoked user policies.

**Evidence, canonical status and stopping rule:** ED-33 DONE only with exactly-once logical awards and recoverability evidence (not exactly-once transport). Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M28-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M29 — EXPLAINABLE REWARD AND PROGRESS FEEDBACK

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-34. **Prerequisite gate:** M28 plus M13 learner UI. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect learner progress UI and current toast lifecycle; read public and private reward projections.

**Implement across necessary domains:** Display one award reason, exact XP/level/badge derived from ledger; replay dedup/toast acknowledgment survives refresh. Explain explicitly XP is not verified mastery.

**Contracts, persistence and authorization:** No cross-account award detail or raw private assessment leak; frontend never computes authoritative ledger totals.

**UI, failure and recovery:** Accessible success/replay/empty/error UX tied to actual persisted award.

**Concrete acceptance and verification:** Browser award once/refresh/no duplicate toast, concurrent evidence, foreign account, unsuccessful check, level threshold; frontend checks.

**Evidence, canonical status and stopping rule:** ED-34 DONE only with actual ledger linked UX and private isolation. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M29-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M30 — RICH STUDIO CUSTOMIZATION (P1)

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-31/ED-32 rich controls. **Prerequisite gate:** P0 Studio M14/M15 stable; do not disturb publication invariants. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect approved Studio candidate schemas, instructor UI and current generator parameters.

**Implement across necessary domains:** Add bounded customizations for allowed difficulty, problem type, detail, scope, review checklist and preview; generate versioned source-backed candidates, not executable code; preserve staged approval.

**Contracts, persistence and authorization:** Each parameter validated server side and persisted on draft version; stale changes and revoked sources rejected; unverified AI claims remain flagged.

**UI, failure and recovery:** Instructor controls accessible, reusable renderer preview, revert/reset, stale save and unavailable inference states.

**Concrete acceptance and verification:** Schema/Python parameter effects on synthetic fixed prompts, wrong source, concurrent edits, preview diff and publish regression; real provider provenance separately.

**Evidence, canonical status and stopping rule:** Close remaining rich ED-31/32 acceptance only with observed parameter effects and reviewed versions. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M30-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M31 — DETERMINISTIC EDUCATIONAL VISUALIZATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-35. **Prerequisite gate:** M03/M13 and reviewed algorithm/math example, stable P0. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect ActivityDefinition registry and renderer extension points; choose one reviewed mathematical/algorithmic example with fixed expected states.

**Implement across necessary domains:** Add a typed deterministic step visualization component and validation fixture, versioned definition and optional safe room public pointer. No model-generated executable UI.

**Contracts, persistence and authorization:** No auto mastery or evidence from clicks; source refs/identity authorized; safe unsupported algorithm handling.

**UI, failure and recovery:** Back/next/reset, keyboard controls, accessible textual state descriptions and mobile adaptation.

**Concrete acceptance and verification:** Deterministic golden traces, property/invariant tests, stale rewind/reset and multi-browser if room reuse, schema and XSS regressions.

**Evidence, canonical status and stopping rule:** ED-35 DONE for one fully verified example only. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M31-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M32 — SYNCHRONIZED PDF/PAGE FOLLOWING (P1)

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-07 optional P1 extension. **Prerequisite gate:** M17 room and M08 published resource access, stable P0. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect actual PDF/source viewer, resource URLs, room state and presenter commands. Check current public pointer semantics.

**Implement across necessary domains:** Implement presenter-authoritative page/location pointer with expected seq, idempotent commands, pinned published file/revision and bounded follow/unfollow for participants. Reuse existing viewer, no second document service.

**Contracts, persistence and authorization:** Protected file ACL on every fetch, no leaked signed/static URL, source revocation, private annotations not broadcast.

**UI, failure and recovery:** Viewer follow status, accessibility/mobile, out-of-range/unknown page error, reconnect/replay and independent viewing option if specified.

**Concrete acceptance and verification:** 2–4-browser page convergence, presenter denial, lost/reordered duplicate page events, revocation and bad PDF; real resource renderer and regressions.

**Evidence, canonical status and stopping rule:** Complete only P1 page-following gate; no retroactive claim P0 ED-07 was missing this unless canonical criteria say so. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M32-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M33 — SAFE VOLUNTEER PRODUCT FEEDBACK

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-20. **Prerequisite gate:** Stable P0/ED-14 and ED-13 privacy. External volunteer consent/availability. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Read organizer/volunteer policy and current test scripts; prepare fictional identities and synthetic materials only.

**Implement across necessary domains:** Design task-based sessions for authoring, diagnostics, room facilitation/degraded flow; collect anonymous structured observations without recordings or personally identifying data; route resulting defects to canonical task IDs.

**Contracts, persistence and authorization:** No live student data, true consent and minimal retention; count only actual completed sessions.

**UI, failure and recovery:** Accessible evaluation tasks and anonymous feedback rubric, no invented testimonials.

**Concrete acceptance and verification:** Verify consent/collection artifacts, actual count, observed successes/failures and limits. No simulated volunteers counted as users.

**Evidence, canonical status and stopping rule:** ED-20 BLOCKED until real volunteers participate; report qualitative evidence without causal learning or traction claims. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M33-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M34 — NO-UPLOAD OPEN-TOPIC LEARNING

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-21. **Prerequisite gate:** Stable P0, M09 grounded tutor, M21 privacy. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect existing personal courses/goals/search/training drafts and source provenance contract.

**Implement across necessary domains:** Add bounded no-upload topic -> explicitly AI-generated unapproved baseline -> typed activity -> private check -> next step using existing pipeline; do not create an official published course by inference.

**Contracts, persistence and authorization:** Generated content labeled noninstitutional, source confidence visible, private actor scope preserved; no source bypass.

**UI, failure and recovery:** Clear unsupported topic/no evidence/provider failure states; optional annotations/Peer Teaching/Revision presets only if acceptance included.

**Concrete acceptance and verification:** Real browser no-upload fixture, Python prompt injection and uncertainty, actor isolation and failure/retry; accurate provenance.

**Evidence, canonical status and stopping rule:** ED-21 DONE only for canonical selected extensions with measured flows; no claim generated content is approved. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M34-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M35 — CONSENTED SPEECH-AWARE VOICE MODERATOR

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-25 (priority unresolved). **Prerequisite gate:** M25 real peer audio, M19 policy, M21 privacy, approved speech providers and team priority decision. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** First resolve P2 index vs P1 detail conflict with team; inspect LiveKit agent SDK, Contracts 12/14/15/16 and Python facilitator, speaker identity/consent metadata.

**Implement across necessary domains:** If approved, implement Python LiveKit Agent with per-track speaker attribution, VAD, approved streaming STT/TTS, bounded peer-first interventions, Guided/On-Demand/Muted state, interruption/backpressure and contract-validated Nest proposals. Preserve peer media when bot fails.

**Contracts, persistence and authorization:** Explicit consent, no disk recording, opt-out and access revocation; do not store transcripts by default; no model writes direct room commands.

**UI, failure and recovery:** UI consent/mode/agent state; muted truly silent, failure leaves human audio/peer text alive.

**Concrete acceptance and verification:** Simulated multi-speaker turns and provider failures; live LiveKit+STT/TTS only with valid keys/consent, audio-path storage review, measured pause-to-onset latency (target <1500ms, never claim met unmeasured).

**Evidence, canonical status and stopping rule:** ED-25 stays TODO/BLOCKED until priority and provider evidence resolved. Document original priority conflict instead of silently overriding. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M35-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M36 — LEGACY RUNTIME/DEPENDENCY INVESTIGATION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-22. **Prerequisite gate:** M01 baseline plus real Docker/CI runtime inventory; after P0 delivery. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect TS/React/Python static imports, dynamic imports, launch scripts, trained assets, optional ML libs and deployment consumers.

**Implement across necessary domains:** Build a dependency graph and tagged keep/remove/migrate candidates, evidence from runtime/CI reachability and safe compatibility plan. No deletion based on naming alone.

**Contracts, persistence and authorization:** Preserve auth, telemetry, persistence and old scripts needed by active consumers; no speculative training/package migration.

**UI, failure and recovery:** No end-user UI change unless correcting a diagnosed regression.

**Concrete acceptance and verification:** Run isolated import/load path checks and builds, validate all potentially removed import consumers in test image; report diff/recommendations.

**Evidence, canonical status and stopping rule:** ED-22 DONE at validated investigation/approved action plan; don't bundle bulk deletions. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M36-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M37 — COMMERCIAL/SOCIAL SCOPE DECISION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-23. **Prerequisite gate:** Stable P0 and explicit team product decision. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inventory billing/entitlements/tiers/coupons, friends/ranking, quest/reward/customization shell, module consumers and legal/data implications.

**Implement across necessary domains:** Create decision record for keep/hide/deprecate each feature with business hypotheses, data migration/dependency and future implementation mission list. Only implement approved narrow deactivation with backward compatibility.

**Contracts, persistence and authorization:** No silent live payment/entitlement changes, account lockouts or social data deletions.

**UI, failure and recovery:** Ensure existing shell behavior unchanged absent approval.

**Concrete acceptance and verification:** Simulate entitlement/billing/social/reward regressions if changes authorized; review policy and data impacts.

**Evidence, canonical status and stopping rule:** ED-23 BLOCKED until scope approved; documented analysis alone does not authorize commercial changes. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M37-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.

### M38 — PILOT-BACKED INSTITUTIONAL EXPANSION

**Codex mission (copy from here through completion):** You are an authorized senior full-stack/integration/QA engineer working only in `/home/ashenix/Projects/mindflow`. **Objective/task IDs:** ED-24. **Prerequisite gate:** M04/M27 and real pilot requirements/security approvals. Read canonical backlog, team plan, ADRs, technical contracts, target architecture, product/permissions/data model, testing/development/delivery/cleanup docs, relevant ED-07/ED-09 reports and applicable `AGENTS.md`; inspect actual `apps/api`, `apps/web`, `apps/ai` paths, package scripts and changed/untracked files; old `study-partner-*` refs may be stale. Preserve dirty work and existing ED-07 room security/replay/presence/peer text. No stage/commit/push/deploy.

**Inspect and baseline:** Inspect institution contexts, cohort analytics privacy, source review, potential SSO/LMS and current scalability/cost evidence.

**Implement across necessary domains:** Create prioritized governance/SSO/LMS/licensing/support/accessibility/operations requirements based on actual pilot; evaluate security/privacy/architecture/cost tradeoffs. Implement only approved feature-specific slices, not speculative enterprise platform.

**Contracts, persistence and authorization:** Preserve personal users and canonical identities; tenant isolation, scoped support access, auditable retention/permissions for any approved extension.

**UI, failure and recovery:** No premature enterprise UI; provide documented workflow prototypes for approved requirements.

**Concrete acceptance and verification:** Security architecture review, synthetic federation/LMS integration tests if integration authorized; documented measured load/cost and pilot constraints.

**Evidence, canonical status and stopping rule:** ED-24 BLOCKED without validated pilot/team requirements; no unsupported scalability or traction claims. Record exact actual commands/exits/passes/skips, real vs mocks, new vs baseline API strict diagnostics, changed files, negative tests and a dated `reports/EDNOVA-M38-*.md` report. Keep parent PARTIAL until every canonical criterion is evidenced; do not auto-run subsequent missions.


## Program closeout checklist

- Confirm **exactly 35** unfinished ED task IDs have an implementation/reporting mission; ED-DOC remains documentation-only DONE.
- No P1 or optional feature is allowed to displace the P0 critical Studio→practice→room→private-check→debrief→evaluation→delivery chain.
- Every missing owning interface is implemented in its owning module before integration with consumers, rather than mocked to success.
- Each task DONE statement has acceptance-level unit/API/Python/browser/security evidence and provider mode provenance where relevant.
- API-wide strict typecheck and lint technical debt must be repaired (M01), not masked by successful API builds.
- External dependencies and organizer priority/consent/retention ambiguities remain visible gates, never invented outcomes.
- The previous isolated ED-07 evidence remains protected by recurring regressions; distributed presence/WS delivery and hard process-kill remain unverified until specific tests prove them.
- No release, publish, Git push, deployment or submission is authorized by this roadmap.

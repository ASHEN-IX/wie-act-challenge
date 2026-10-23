# Codex — M00 Source & Evidence Audit

Work in `/home/ashenix/Projects/mindflow`. Inspect only; no runtime changes. Reports may be written. Original teams indicate domains, not file-access restrictions.

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


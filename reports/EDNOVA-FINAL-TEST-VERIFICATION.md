# EdNova final verification evidence — 23 October 2026

**Acceptance FAIL.** Commands below were executed against this dirty snapshot. Passing subsets do not imply full educational acceptance. Raw logs and probe source are in the Git-ignored [evidence directory](evidence/ednova-final-independent/).

## Baseline and isolation

Branch main, HEAD 5fb70a095da8f8cf429aed2e4f4bf72ce096e927. Before verification: pwd, branch, HEAD, git status --short, git diff --stat, git diff --name-status, git diff --cached --stat and git ls-files --others --exclude-standard were captured in baseline.txt. A SHA256 manifest captures 870 tracked/untracked baseline files. There were 27 tracked modified files, existing untracked feature/test/report files and no staged changes.

Node 24.20.0, pnpm 11.3.0. Existing Mongo7 at 127.0.0.1:27018 and Mailpit at 1026/8026 were healthy during testing; both were observed exited(0) at the final inspection. Custom Nest probes create/drop ednova_final_adversarial_<pid>_<time>. Integration passes MONGO_URI=mongodb://127.0.0.1:27018/ednova_final_audit; individual real-session suites also create/drop their own synthetic databases. Python uses ednova_final_python, explicit offline settings and an external-network-denying guard. No paid provider or non-test migration was executed.

## Quality command ledger

Run from repository root unless a working directory is specified. Each log has a matching .exit file.

| Exact command | Exit | Actual result | Log |
|---|---:|---|---|
| pnpm lint | 1 | Web passes; API has one error/132 warnings | lint.log |
| pnpm --filter api exec eslint modules shared scripts tests src --ext .ts --format json | 1 | StudentAttempt.ts:67 prettier/prettier extra newline | api-lint-detail.log |
| pnpm typecheck | 0 | API strict test-inclusive tsc and Next typegen/tsc pass | typecheck.log |
| pnpm build | 0 | API tsc and Next16.4.1 production build pass | build.log |
| pnpm --filter web test | 0 | 47/47 tests, seven files | web-unit.log |
| pnpm test | 1 | Route tests 6/6; Jest 719 pass/13 fail, 53 passing/3 failing suites; stops before Node/auth/web | root-test-unmodified-env.log |
| AI_SERVICE_URL=http://127.0.0.1:1 MONGO_URI=mongodb://127.0.0.1:27018/ednova_final_audit pnpm test | 1 | Initial run: 717 pass/15 fail; two extra coach URL-test failures were caused by the explicit URL override | test.log |
| pnpm --filter api test:node | 0 | 10 tests pass | node-unit.log |
| MONGO_URI=mongodb://127.0.0.1:27018/ednova_final_audit pnpm --filter api test:node:integration | 1 | 227 nodes:223 pass/4 fail; two failing leaves plus their two parents; no skips | node-integration.log |
| pnpm --filter api test:auth | 0 | 17 actual auth tests pass | auth.log |
| AI_SERVICE_URL=http://127.0.0.1:1 pnpm test:e2e | 0 | Eight actual Chromium auth/workspace/smoke tests pass | browser.log |
| docker compose -f docker-compose.yml config --quiet | 0 | Configuration validation only; not deployment | compose-validate.log |
| docker compose -f docker-compose.test.yml ps | 0 | Existing healthy Mongo/Mailpit; no new containers retained | infrastructure-final.log |

Default pnpm test was rerun without audit AI overrides to distinguish genuine regressions from a harness-induced configuration difference. The definitive default Jest failure count is **13**, not 15. Failures are in course-upload-validation.test.ts (new CourseRevision mocks missing), ingest-status.test.ts and study.test.ts (new access/model paths not reflected in existing fixtures). These failures block the quality gate; they do not alone establish exploitable product defects. The real room integration leaves expect 503 for an arbitrary activity while current behavior is 404; this is status/fixture drift, not evidence an unauthorized activity was actually accepted.

## Disposable clean installation and generated contracts

The baseline source was copied to /tmp/ednova-final-clean, excluding .env files and ignored evidence. Existing workspace node_modules were untouched.

| Command | Exit | Result |
|---|---:|---|
| pnpm install --frozen-lockfile --offline --dir /tmp/ednova-final-clean | 1 | Missing cached @better-auth/mongo-adapter tarball; not a lock incompatibility |
| pnpm install --frozen-lockfile --dir /tmp/ednova-final-clean | 0 | 1057 packages installed, unchanged lock; 3m54s; bounded tarball retries visible |
| pnpm generate:contracts (cwd /tmp/ednova-final-clean) | 0 | Generated adapters change study.module.ts |
| pnpm build (cwd /tmp/ednova-final-clean) | 0 | API/web build pass; initially launched alongside generation; sequential post-generation rebuild also passes (clean-build-after-generation.log) |

A separate source copy /tmp/ednova-final-generation links installed dependencies solely to run the generator without modifying source. pnpm's automatic dependency check first aborts with NO_TTY (generate-contracts.log, exit1). Direct invocation succeeds:

    node_modules/.pnpm/node_modules/.bin/tsx --tsconfig /tmp/ednova-final-generation/apps/api/tsconfig.json /tmp/ednova-final-generation/apps/api/scripts/generate-http-contracts.ts

Exit0, generate-direct.log. Both independent generation copies show drift only in apps/api/src/framework/domains/study.module.ts. The hand-added activity methods disappear because activities.ts exports Express Router with no contract.operations. The original generated adapter was preserved.

## Python verification and AI probes

Supported existing locked environment:

    /home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python

From apps/ai, actual guarded command:

    LLM_MOCK=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LITELLM_LOCAL_MODEL_COST_MAP=True CUDA_VISIBLE_DEVICES=-1 MONGODB_URI=mongodb://127.0.0.1:27018/ednova_final_python DB_NAME=ednova_final_python PYTHONPATH=/tmp/ednova-final-audit:.:agents/evaluator/src timeout 180 /home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python -m pytest -q -ra

Exit0; **1054 pass, five skips, 59 warnings, 20.21s**. python-guarded.log. sitecustomize.py in the evidence directory permits loopback sockets and denies external connects. This is local test verification, not live model inference.

Explicit skips: scheduler seeded-Mongo integration and four missing manual fixture-PDF tests in full_workflow/ingestion_to_planner. No skip is treated as a pass.

From apps/ai:

    LLM_MOCK=1 PYTHONPATH=/tmp/ednova-final-audit:. <python-above> -m contracts.export_ednova_schema --check
    <python-above> -m pip check

Both exit0. Initial default Python 3.14 environment failed because pytest is absent (python.log, exit1). The first full suite lacked isolated Mongo/offline settings and was terminated (python-full.log,143); a corrected isolated run was also stopped to enforce the network guard (python-isolated.log,143). Neither is represented as successful. The final guarded run supersedes both.

From root:

    PYTHONPATH=/tmp/ednova-final-audit HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LITELLM_LOCAL_MODEL_COST_MAP=True <python-above> reports/evidence/ednova-final-independent/ai-probes.py

Exit0; ai-probes.log/json. Actual observations: ask has no tier parameter; actual tutor catches TypeError and uses DETERMINISTIC_FALLBACK but marks answer verified; citation page99999 validates against retrieved page1; setting synthetic invalid provider keys causes REAL_APPROVED status without a provider call. A chunk lacking document identity is attributed to the first authorized document and marked verified; ingestion chunk metadata currently emits no doc_id and page_number=None. No paid inference occurred. Provider acceptance remains blocked on actual approved access details plus explicit authorization and cost bound.

All 13 provisional artifact hashes in the approval ledger match current bytes. Schema/fixture success and matching hashes do not freeze the contract: 19 owner decisions and five confirmations remain pending.

## Independent real-session and service probes

    node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json reports/evidence/ednova-final-independent/adversarial.ts

Exit0 means the observation harness completed, not that product assertions passed. It provisions actual Better Auth identities, starts actual Nest, uses isolated Mongo indexes and cleans up. Latest output: adversarial-service.log and adversarial-results.json. Separate real-http-routing-results.json retains the first actual HTTP observations.

The harness deliberately switches activity probes to direct service calls after recording the authenticated Nest404. These records carry boundary=DIRECT_SERVICE. Do not present them as externally reachable HTTP exploits. They establish the unsafe underlying service behavior that would become exposed by a routing-only fix.

Results: wrong guided response produces mastery; cross-course activity insertion persists; missing explicit revision silently substitutes; old manifest changes with Course.files; concurrent duplicate statuses [500,500,200,200,500,200,200,200], one attempt/evidence; forged contentHash/activityRevision accepted; real HTTP membership-revoked source still200; source-revoked own result returns at service; actor-colliding receipt lookup403; metadata-admin content management true. Graceful API stop/start preserves a committed attempt/result. No process-kill mid-write, publication race, complete enrollment race or distributed failover proof is claimed.

An initial audit fixture mixed BSON7 ObjectIds into Mongoose's BSON6 structures; it failed before product probes and was corrected in the audit harness by supplying string IDs. Required strict contract fields timeLimitSeconds and roomId were then added to the synthetic fixture before meaningful evaluation observations. These are harness corrections, not application repairs.

## Browser evidence and journeys

Audit copies of existing browser runners preserve historical reports and adjust import resolution/evidence paths. They run actual Next standalone plus actual Nest, real cookies and synthetic Mongo data:

    AI_SERVICE_URL=http://127.0.0.1:1 node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json reports/evidence/ednova-final-independent/test-course-enrollments.ts
    AI_SERVICE_URL=http://127.0.0.1:1 node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json reports/evidence/ednova-final-independent/test-study-together-peer-text.ts
    AI_SERVICE_URL=http://127.0.0.1:1 node_modules/.pnpm/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json reports/evidence/ednova-final-independent/test-study-together-e2e.ts

Enrollment exit0: nine recorded checks, four signed-in identities, two seeded institutions, invitation hashed storage/acceptance, personal/foreign-course denial and token absence in page/collections. Setup and instructor assignment were seeded/API-driven, not a complete admin onboarding browser.

Peer-text exit0: three independently signed-in contexts, sender identity/duplicate replay, acknowledgment loss reconciliation, reconnect/history ordering, inert script/link text, uncertain acceptance retry, source revocation denial while remaining user continues. Full ED-07 remains partial.

Legacy lifecycle initially failed connection because standalone build omitted static/public assets. Assets were assembled using the same layout as Dockerfile (copy .next/static and public into standalone). This is generated preview packaging, not a source change. With correct assets, both users connect, create/join, delegate presenter and change phases. It then exits1 awaiting obsolete text “Private activity submission is unavailable.” This is stale test expectation; separately, actual activity endpoints are404, so it is not replaced by a claim private activity works. Initial nonstandard-port and standard-port asset failures are retained in separate logs.

| Required journey | Current outcome |
|---|---|
| A: institution onboarding | PARTIAL: real invitation/enrollment browser passes; complete admin setup/assignment journey not exercised in browser |
| B: instructor publication | FAIL/UNVERIFIED: full upload→worker→review→activity→publish→learner journey absent; activity registration404 |
| C: solo learning | FAIL: no connected new tutor/solo renderer journey; tutor and evidence defects reproduced |
| D: collaborative learning | PARTIAL/FAIL: peer text/presence/reconnect pass; actual selected activity/private attempt/facilitator/debrief gate not established |
| E: security/revocation | FAIL: personal-source revocation browser passes; actual institutional membership revocation HTTP fails |
| F: advanced features | NOT ACCEPTED: absent/unverified P1/P2 targets; no real media, multilingual rubric or volunteer evidence |

## Unexecuted gates and preservation

Current Docker builds/image runtime, clean Python reinstallation, actual broker-worker PDF roundtrip, live approved inference, real devices/media/speech, all 11-role complete browser journeys, hostile-origin coverage for every mutation, power-loss/restart between writes, full race matrix, production index migration, backup/restore/TLS and multi-instance failover remain unverified. Do not infer these from passing unit tests.

No stage/commit/push/deploy or real-user data change. The two pre-existing test containers were observed exited(0) at final inspection. The audit issued no container stop/down command; the cause of that external state change was not established, and they were not restarted. Custom harness databases are dropped; audit-created shared test databases are removed at final cleanup. Raw logs are copied into ignored evidence. preservation.json verifies all 870 baseline hashes unchanged, none missing; reports are the only new authored deliverables. Historical reports and current user edits are preserved.

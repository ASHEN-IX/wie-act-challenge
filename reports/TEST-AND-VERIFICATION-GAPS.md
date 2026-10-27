# Test and verification gaps — 26 October 2026

**27 October master-mission continuation:** The current [tracker](EDNOVA-IMPLEMENTATION-TRACKER.md) and [executed test coverage](EDNOVA-TEST-COVERAGE.md) supersede earlier narrow findings below. The image now runs as UID/GID 10001 with non-destructive permission checks; actual isolated worker/broker/Redis kill/recovery and a stopped-writer synthetic Mongo/source restore pass. Failed replacement enqueue no longer removes prior staged downloads. Private profile/reward body logging and the shared Python database error/cache defects are repaired. Root checks pass, and full Python now passes 1082 with five documented fixture skips. Contract freeze and approved real inference remain blocked. The [four-learner PDF browser](EDNOVA-COLLABORATION-VERIFICATION.md) passes all eight A–E checkpoints. Bounded local English OCR, real image-only source/confidence delivery and the nine-checkpoint scanned-PDF browser pass within the [documented scope](EDNOVA-OCR-VERIFICATION.md); no parent task is declared complete. Historical text remains for traceability.

## 27 October worker concurrency follow-up

Concurrent ingestion deliveries previously shared a mutable revision manifest, allowing one job to use another's source context when prefetch exceeded one. Parsing and indexing now receive the manifest as a job-local argument. The shared worker also used a single retry count, tracked only one active task and signaled shutdown before draining; retry context is now task-local and graceful shutdown waits for all tracked deliveries through acknowledgment before signaling completion. Interleaved two-course and retry/shutdown tests and worker, grounding and PDF regressions pass 120/120 offline. The real Nest/RabbitMQ/worker source suite passes 11/11, and a rebuilt image imports the workers with matching source hashes. No live broker crash, redelivery or multi-container concurrency test was run for this change. Evidence: `reports/evidence/ednova-worker-concurrency-20261027/`.

## 27 October PDF browser and AI image follow-up

The PDF variant of the integrated A–E browser harness passed all eight recorded checkpoints using actual synthetic PDF bytes, real local services, deterministic test embeddings and mock inference. It checks the page 1 citation and byte-identical authorized original download. The browser test now fails if interrupted before completion, supports an isolated Next source directory, and has a PDF CI step; no remote run was observed. A fresh locked AI image built, started with networking disabled, returned health HTTP 200 and passed pip check and a two-page sandbox parser smoke. Two separate instances of that image also wrote and validated a PDF original and revision-specific FAISS pair through a shared bind mount; the reader mount was read-only. This is not an actual containerized broker-worker or Compose cold-boot test, OCR evaluation, production image certification, or backup/recovery test. Logs, checks and screenshots: `reports/evidence/ednova-pdf-browser-20261027/`.

## 27 October earlier AI image attempt

A fresh AI Docker build was attempted with the source available at build start. Poetry installation and lock validation completed and locked dependency installation began, but the command produced no further progress after installing the listed packages for several minutes; it was interrupted and did not produce a verified image. Subsequent source edits also mean that build could not certify the final code. The log is retained as `reports/evidence/ednova-source-budget-followup/ai-image-interrupted.log`. Retry an exact-source build and cold-boot, source-mount and worker tests before claiming the gate.

## 27 October shared revocation follow-up

The Mongo ledger now rejects reservations after `revokedAt` is set, and checks the shared record before dispatch and after a simulated response. Focused provider/budget tests pass 30/30, including a simulated response revoked before delivery; an independent subsequent Python process also cannot reserve the revoked approval. The combined final Python run passes 1068 tests with five existing skips, and the combined R1/R2/R3 real-service suites pass 34/34 nodes after these changes. Current evidence is in `reports/evidence/ednova-source-budget-followup/`. There is no operator-facing revocation interface, hard cancellation of already dispatched calls, monetary cap or authorized live inference. The check immediately before dispatch cannot eliminate the race with a subsequent revoke. No real provider request was made.

## 27 October PDF/source follow-up

A first actual PDF broker run failed because the forked parser inherited an AI worker address space beyond its 512 MB sandbox limit; its error is preserved in `reports/evidence/ednova-pdf-20261027/ednova-pdf-r2.log`. Revision extraction also reparsed pages outside the sandbox. A fresh subprocess now applies CPU/address-space limits before importing PyMuPDF and returns bounded page text; both worker text and revision page extraction use this sandbox. Focused PDF/ingestion/tutor tests pass 38/38, including real two-page, encrypted and corrupt PDFs, timeout and a parent with 1 GiB mapped. Real Nest/Mongo/RabbitMQ/worker/FastAPI integration passes 11/11 nodes including two-page PDF ingestion, exact original hash, pages 1/2, prepare, publication, tutor citations on pages 1 and 2 and byte-identical authenticated download. Embeddings and inference remain deterministic test fixtures. Full offline Python passes 1068 with 5 pre-existing skips; root lint passes with 132 warnings; API typecheck passes. No image, browser PDF journey, OCR quality or deployment certification follows from these results.

## 27 October durable budget follow-up

Full offline Python regression: **1068 passed, 5 skipped** with an isolated Mongo server and no external inference. The combined P0-R1/R2/R3 real Nest/Python/broker integration suite passed **34/34 nodes** after the change. `tests/test_llm_budget.py` exercised an unavailable store, refusal to dispatch, ten simultaneous fresh Python processes sharing five reservations, exhausted-budget restart, conflicting approval identities and a process exiting immediately after reservation. Python provider tests simulate model responses only. The first full run found one legacy Redis test depending on an absent local setting; its fixture now explicitly sets empty `REDIS_URL`, and the full rerun passed. Logs are in `reports/evidence/ednova-budget-20261027/`. Current real-model approval, monetary/token cost enforcement, central revocation, durable database failover and power-loss recovery remain unverified.

## 27 October implementation verification

Current `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass. Root tests: 6 route nodes, 732 Jest tests/56 suites, 10 Node unit nodes, 261 integration nodes, 17 Better Auth nodes and 47 web tests/7 files. Full offline Python: 1065 passed, 5 skipped. Dedicated real browser A–E passes with synthetic users, text original, real Nest/Next/FastAPI/Mongo/RabbitMQ and deterministic test embeddings/mock inference. `node scripts/check-compose.mjs` and `node scripts/test-dev-setup.mjs` pass; contract generation in an environment-free disposable copy matches current generated adapters. Python schema check and pip check pass. Root lint has 132 warnings and no errors. No paid inference was run. The isolated auth/workspace/smoke browser run passed 8/8. Both test and isolated development Compose stacks started; dev Mongo, RabbitMQ, Redis and Mailpit reached healthy status, and a real development-broker authentication/message roundtrip passed. Docker used the available `default` context; the selected Docker Desktop context was unavailable. `poetry check --lock` was not run because Poetry is not on PATH; pytest used the existing Python 3.12 environment. Logs and browser evidence are under `reports/evidence/ednova-plan-20261027/`.

The table below preserves the 26 October audit results. The later checks above supersede its historical failures; OCR, real-provider calls, backup/restore and remote CI remain unverified.

## Test inventory

Recursive test filename inventory identifies approximately 83 API, 31 web and 81 Python test files (naming-pattern count, not test-case count). Root scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; API has Jest plus Node/tsx route/integration/auth suites, web has Vitest and Playwright, AI uses pytest. Dedicated `apps/web/e2e/p0r3-integrated-learning.test.ts` is a manual tsx harness, not a Playwright `.spec` selected by `pnpm test:e2e`. `.github/workflows/ci.yml` separately invokes it in `source-foundation` with Mongo/RabbitMQ and installs Python/Chromium. No remote Actions result was examined.

## Checks executed against current working tree

| Command | Exit/result | Interpretation |
|---|---|---|
| `pnpm lint` | 1; 1 error, 132 warnings | `apps/api/shared/betterAuth.ts:273` Prettier formatting; web lint was not reached because API failed |
| `pnpm --filter api typecheck` | 0 | Strict API typecheck |
| `pnpm --filter web exec tsc --noEmit` | 0 | Existing web type declarations; no fresh Next type generation |
| `pnpm --filter api test:node` | 0; 10 nodes | Node unit lifecycle tests |
| `pnpm --filter api test:unit` | 0; 45 suites, 649 tests | Jest module/src/shared subset; mocks mean not end-to-end evidence |
| `pnpm --filter web test` | 0; 7 files, 47 tests | UI/library unit tests only |
| Locked Python `-m pytest -q -ra -p no:cacheprovider` on tutor, revision vector, LLM client, provider and ingestion worker test files | 0; 62 passed, 3 warnings | Mock/offline/fixture coverage, not approved inference or broker roundtrip |
| Locked Python `-m pip check` | 0 | Existing environment dependency consistency; not fresh locked install |
| Locked Python `-m contracts.export_ednova_schema --check` | 0 | Exported schema matches source |
| `pnpm dev:infra:up` | 1 | Missing `docker-compose.dev.yml`; fails before starting services |
| `RABBITMQ_PASS=audit-placeholder docker compose -f docker-compose.yml config --format json` | 0 | Both HTTP and ingestion worker resolve `/app/faiss` as read-only; no runtime started |
| Full locked Python `-m pytest -q -ra -p no:cacheprovider` with offline guard and unreachable loopback Mongo | interrupted, exit 2: 88 passed, 5 skipped, 1 failed before interrupt | `agents/test_system.py::test_with_existing_course` failed on unavailable Mongo; subsequent integration hung. Not a complete run, and no conclusion about behavior with functioning Mongo. Five skips: one seeded course dependency, four missing legacy PDFs |

Python commands ran in `apps/ai`, using existing `/home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python`, `LLM_MOCK=1`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `LITELLM_LOCAL_MODEL_COST_MAP=True`, `CUDA_VISIBLE_DEVICES=-1`, `MONGODB_URI=mongodb://127.0.0.1:1/ednova_audit`, `DB_NAME=ednova_audit`, `PYTHONPATH=../api/tests/helpers/python_guard:.:agents/evaluator/src`, `PYTHONDONTWRITEBYTECODE=1`. Raw logs are temporary `/tmp/ednova-audit-*.log`, not guaranteed durable. Node 24.20.0 and pnpm 11.3.0; system Python 3.14.8.

## Missing acceptance coverage

- Full root tests, web typecheck/build, API build, adapter generation/parity and test browser flows were not run. Some commands generate files and need a disposable checkout for a non-mutating audit.
- Docker Desktop endpoint was unavailable; no service was started. The configured dev/test Compose files are absent. Use dedicated isolated Mongo/RabbitMQ/Mailpit with synthetic database names, verify targets before running any migrations, then run R1–R3 integration, actual broker worker and browser A–E. Avoid existing user databases/queues.
- Test real PDF/OCR → immutable originals → exact revision index → publication → source-grounded tutor. Exercise restart, partial write, missing/corrupted index and backup/restore, including the actual configured mounts and nonroot permissions.
- Verify cross-institution access, changes during delayed responses, foreign pins and source revocation across direct HTTP, WS broadcasts, reconnect and history with at least 3–4 distinct authenticated browsers.
- Validate accepted-evidence idempotency under simultaneous attempts and crash/restart; verify no mastery/XP on wrong/unavailable evaluation, and no private answer/rubric in public state/logs.
- Exercise request budget across replicas/restarts, 429/timeout/DLQ redelivery and real authorized compact/capable service only after explicit model/cost authorization. Offline mocks and status reporting cannot establish model quality or approval.
- LiveKit media, consent, speech/no-recording, multilingual/RTL/accessibility, small-cohort privacy, educational visualizer, remote CI and deployment readiness have no current acceptance evidence.

The R3 browser test uses a real backend and fault-injects a dropped response, which is meaningful for idempotent retry; it still uses synthetic deterministic embeddings and `MOCK_TEST`, a text source, a single-process transport and local services. Past reports describe a successful prior run, but this audit did not rerun it against current changed source. Unit success is not authorization, operational or browser acceptance.

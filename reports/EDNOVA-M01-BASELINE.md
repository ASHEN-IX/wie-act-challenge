# EdNova M01 baseline repair — 22 October 2026

**Mission result: PARTIAL. ED-01 remains PARTIAL.** Strict TypeScript, application builds, default application tests, browser regressions and API/web container startup now pass. API lint and complete Python/AI-image verification remain open. M02 and later feature missions were not started.

Repository: `/home/ashenix/Projects/mindflow`; initial HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`, branch `main`. Prerequisite: [M00 audit](EDNOVA-M00-SOURCE-AUDIT.md). Mission: [M01 instructions](../EdNova_M01_Baseline_Repair_Codex_Prompt.md). Host Node 24.20.0, pnpm 11.3.0; Python checks use 3.12 and Poetry 2.5.1. API verification image reports Node 24.22.1. No staging, commits, pushes, deployment, paid inference or media provisioning.

## Acceptance classification

| M01 criterion | Classification | Executed evidence / remaining gate |
|---|---|---|
| Reconfirm prior 128 strict API diagnostics by identity and location | VERIFIED | All 128 baseline lines match M00; final API and root strict checks exit 0, zero diagnostics. |
| Repair lint without suppressing checks | PARTIAL | API errors 2,114 → 1,991; warnings remain 119. Root lint exits 1. Web lint passes. |
| Source route/contract generation and compatibility | VERIFIED | Contract generation exits 0; generated adapters unchanged from mission start. Route tests pass. |
| Default unit/integration/auth checks | VERIFIED | Root test exits 0; Jest and Node-native suites use their proper engines. Counts below. |
| Existing room security/replay/presence/peer-text preservation | VERIFIED | 81 real ED-07 tests, existing web tests and three production-browser scripts pass; room runtime paths preserved byte-for-byte. This does not complete canonical ED-07. |
| Authorized web flows and unavailable-service startup | VERIFIED | Eight Playwright tests pass; standalone room flows use independent users; protected room route denies anonymous requests. API starts with AI/broker unavailable. |
| Node lock/install, build and clean container startup | VERIFIED | Frozen install, root build, API/web image builds and cold container smoke pass. |
| Python lock validation and selected CI/regression tests | VERIFIED | Existing lock validates; exact locked subset passes dependency consistency and 89 CI + 176 learning/evaluator tests. |
| Complete Python installation and AI image/runtime parity | IMPLEMENTED_UNVERIFIED | CI/image now consume the same lock with Python 3.12/Poetry 2.5.1. Full install failed downloading heavy wheels; image build timed out fetching native packages. |
| Live RabbitMQ worker round trip | IMPLEMENTED_UNVERIFIED | Existing broker setup retained; publisher/worker unit tests executed. No live broker/provider round trip was run. |
| Fully green CI-equivalent baseline | PARTIAL | Local required lint remains red; full Python graph and AI image are unverified. Remote GitHub Actions was not run. |

## Repairs and scope

API strict checks now cover the existing configuration, including tests, shared code and modules. Repairs supply typed identity/header fixtures, broker mocks, HTTP responses, event/participant projections, `.js` dynamic import suffixes and an asserting TCP-listening-port helper. Middleware uses typed request/error/Redis interfaces and removes the unsupported rate-limit `keyGeneratorIpFallback` validation option. Its previous runtime warnings no longer appear in final room tests. No strictness setting was relaxed.

The chat authorization unit fixture now supplies the existing study-owned membership check. An additional authenticated-nonmember test verifies history/deletion denial without invoking the chat service. Production access guards were preserved. The competency evidence adapter has typed evaluator results, preserves lease/replay behavior, and converts nullable optional result values to `undefined` for its existing evidence interface. Progress, broker and real Bloom regressions pass.

Lint changes are limited to typed batches, proven-unused imports/catch bindings, the existing timer type and one rethrow-only catch. Remaining errors are **1,149 explicit `any` annotations and 842 formatting findings**. No lint rules were disabled, no repository-wide formatting was performed and no generated output was edited to satisfy checks. Focused typed files pass lint; catch-only edited files can still contain inherited lint debt.

The default API test command now routes Node-native tests through `tsx --test` and leaves Jest suites with Jest. Both legacy-named real ED-07/ED-09 Node suites are explicitly included; Node suites are excluded only from the incompatible Jest engine. [Runner mapping](evidence/ednova-m01-2026-10-22/test-runner-map.json) records the coverage. These are runner corrections, not dropped tests. Existing deterministic ED-09 tests do not establish full facilitator acceptance.

Next was updated from 16.4.0 to the locked 16.4.1 patch after the production build's security failure; the manifest uses `^16.4.1`. The patch follows the [official October 14 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026). This is a dependency repair, not a comprehensive security assessment. The existing Sharp version is retained. Browser runners now declare their MongoDB/bcrypt dependencies; the web Docker builder includes the API workspace used by those checked imports. API declares the directly required `express-fileupload` runtime dependency, fixing cold startup that previously depended on transitive development installation.

The workspace browser test now follows the existing “Room Members” UI and asserts discussion appears/disappears with room membership. Registration waits for its actual Server Action response before checking success, accommodating cold compilation without sleeps. Missing Playwright FFmpeg was installed in the local browser cache; it is not a repository binary.

CI and the AI Docker recipe use Python 3.12 and Poetry 2.5.1, consuming the unchanged Poetry lock instead of independent unpinned dependency lists. The image includes existing ingestion native libraries and separates Poetry tooling from the application virtualenv. A Docker ignore file excludes local environments and caches. Three Python fixture tests now resolve repository fixtures from the actual repository root. AI business code, providers and feature contracts were not changed. Image/runtime verification remains open.

## Commands and results

All commands, exact argument arrays, cwd, exit codes and durations are in the [command ledger](evidence/ednova-m01-2026-10-22/command-ledger.json); each named log below has its corresponding `.command.json`. Commands run from repository root unless the ledger specifies `apps/ai`. Logs include failed attempts as well as final results.

| Final verification | Exit / actual result | Log stem in evidence directory |
|---|---|---|
| `pnpm install --offline --frozen-lockfile` | 0 | `frozen-install-final` |
| `pnpm typecheck` | 0, API and web | `strict-final` |
| `pnpm lint` | 1; 1,991 API errors, 119 warnings | `root-lint`, `lint-final.json`, `lint-summary.json` |
| `pnpm --filter web lint` | 0 | `web-lint` |
| `pnpm test` | 0; routes 6, Jest 54 suites / 517 tests, Node unit 10, Node integration 88, auth 17, web 29 | `root-test` |
| `pnpm build` | 0, API and web production builds | `root-build-final` |
| `pnpm --filter web build` | 0 | `web-build` |
| `pnpm generate:contracts` | 0, adapters unchanged | `contracts` |
| Playwright auth, smoke and workspace specs | 0; 8 passed | `browser-auth-ack` |
| `test-study-together-peer-text.ts` | 0, production standalone + real Nest/Mongo | `browser-peer` |
| `test-study-together-presence.ts` | 0, production standalone + real Nest/Mongo | `browser-presence` |
| `test-study-together-e2e.ts` | 0, original room/replay/security scenario | `browser-room` |
| Poetry lock check | 0, existing lock unchanged | `lock-check` |
| Locked lightweight Python subset installation / `pip check` | 0; application versions match lock | `python-core-install`, `python-core-pip-check`, `python-core-versions.json` |
| CI-selected Python pytest files | 0; 89 passed, 5 existing Pydantic deprecation warnings | `python-ci-fixed` |
| Additional learning/evaluator/Bloom pytest files | 0; 176 passed | `python-learning-regression` |
| Python 3.12 compileall | 0 | `python-syntax` |
| Final API Docker build | 0, local `ednova-m01-api:verification` | `docker-api-runtime-fixed` |
| Final web Docker build | 0, local `ednova-m01-web:verification` | `docker-web-final` |
| New API/web container smoke | 0; connected Mongo health, landing HTML, proxied health, anonymous room HTTP 401 | `docker-smoke-final`, `docker-smoke-detail.json` |
| Full Python 3.12 dependency installation | 1, download timeouts; bounded retry deliberately stopped | `python312-install-disk`, `python312-install-retry.log`, `heavy-install-stop.json` |
| `timeout 180 docker build -t ednova-m01-ai:verification apps/ai` | 124, native package download phase; no completed AI image | `docker-ai-check` |
| Dedicated Mongo/Mailpit shutdown | 0 | `service-cleanup` |

The 88 real Node integration tests comprise 81 existing ED-07 tests and seven existing ED-09 tests. Final default test output has no skipped test claims; browser stage messages count scenarios, not independent assertions. The separate module-unit run finished with 434 passes after correcting the two baseline auth fixtures and adding negative membership coverage. The root Jest count also includes other suites.

Prerequisites: dedicated Mongo 7 on `127.0.0.1:27018`, Mailpit on loopback, installed Playwright Chromium/FFmpeg. Browser invocations and executable overrides are recorded in their command files. The eight CI-style browser tests use a Next development server; the three room runners use the production standalone server. API/web containers start from freshly created local containers on the dedicated test network; no production compose stack or proxy deployment was altered.

Python checks use a separate Python 3.12 environment containing the selected tests' dependencies constrained to exact versions in the existing lock. This is **not** a complete Poetry environment, Torch/model import test or ingestion evaluation. Constraints and installed versions are archived. Mock LLM/fake transport tests are `MOCK_TEST`; disabled/unreachable live AI is `UNAVAILABLE`. Existing deterministic fallback tests establish only their tested behavior. No `REAL_APPROVED` inference, learning outcome, live broker round trip or media acceptance is claimed.

## Failed attempts and limitations

Initial unit tests reproduced the two membership-fixture failures. Initial browser runs exposed missing FFmpeg, a stale Participants locator, and a registration assertion racing the pending Server Action. These were corrected and the complete eight-test set rerun. Initial Docker attempts exposed missing API import context in the web builder and undeclared API `express-fileupload`; final builds and startup checks pass after declaring the dependencies/context.

One build overlapped a frozen dependency relink and failed resolving Better Auth during that relink. It was rerun sequentially and passed; no source workaround was introduced. Earlier type/lint iterations remain archived. Python checks initially exposed stale fixture root paths; the final selected tests pass after the path corrections.

The host defaults to Python 3.14; full environment verification was retried with the intended Python 3.12. Downloads of large CUDA/OpenCV dependencies failed and a bounded low-concurrency retry was stopped when it made no useful progress. The AI build timed out while fetching native packages. Neither attempt is recorded as a successful installation/build. Partial environments remain outside the repository for continuation; no AI service was started.

The smoke script originally had a trailing invocation in its database cleanup expression. Container checks themselves passed, but cleanup returned an error. The expression was corrected and both remaining synthetic `ednova_m01_docker_<pid>` databases were explicitly removed. Smoke containers were removed; dedicated Mongo/Mailpit were stopped. Local verification image tags remain available. Earlier unsuccessful smoke details are retained rather than overwritten as successes.

## Attribution and preservation

The [before/after manifest](evidence/ednova-m01-2026-10-22/working-tree.json) fingerprints all **872** pre-existing tracked/untracked files: **830 preserved byte-for-byte, 42 deliberately changed, zero missing**. Attribution uses the mission-start dirty tree, not HEAD. [Mission-only patch](evidence/ednova-m01-2026-10-22/mission-change.patch) includes those changes and the two new implementation files. Original dirty diff is archived separately. The complete changed-path inventory and both hashes are in the manifest.

New implementation files: `apps/api/tests/listening-port.ts`, `apps/ai/.dockerignore`. Other new deliverables are this report and its evidence directory. Existing changes fall into API type/fixture/lint batches, test-engine scripts, dependency/lock updates, web build/browser setup, Python image/fixture setup, CI and focused development/backlog notes. The report does not attribute prior ED-07/ED-09 implementation to M01.

Existing ED-07 models, durable command service, realtime gateway, peer text service and collaboration runtime/UI are unchanged from the mission start. Existing AI facilitator/main code, M00 reports, mission roadmap, contracts and generated adapters are preserved. ED-07/ED-09 integration fixture types changed only where needed for strict compilation. No TS/ESLint rule/config weakening, private-data projection change, new registry, feature status promotion or hidden test skip was introduced. The sprint task-index status/acceptance rows retain their mission-start values; ED-01 remains PARTIAL. Staging remains empty.

## Remaining gate and exactly one next mission

**Next mission: M01 continuation — finish API lint in typed, reviewed batches and verify the full locked Python/AI image environment.** Owner: ED-01 baseline/CI maintainers. Keep later feature missions paused until the ED-01 gate is satisfied.

Start with the recorded lint inventory. Largest remaining files include `study/src/routes/rooms.ts` (268 errors), `framework/domains/study.module.ts` (195), `users.module.ts` (170), `ai.module.ts` (101), `auth.module.ts` (68), and `user-profile/src/routes/profile.ts` (62). Preserve existing room behavior while replacing unsafe types; regenerate adapters only from their owner when applicable. Do not hide the remaining lint through exclusions or a broad formatting pass.

Then complete `poetry install --with dev` in a reliable network/cache environment, run the selected CI commands inside that full environment, build/start the locked AI image and verify its imports/health. Exercise the retained broker/worker baseline with isolated fixtures before claiming live messaging parity. Finally rerun required root lint/typecheck/test/build, browser regressions and clean API/web/AI image gates, and record actual CI results. M01/ED-01 can become DONE only when all canonical required checks pass.

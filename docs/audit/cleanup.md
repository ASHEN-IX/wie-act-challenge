# Repository preparation and frontend rebuild — 18 October 2026

This record supersedes the earlier documentation-only audit for the changes and checks listed here. Feature statuses remain in the [backlog](../sprint-backlog.md); local startup readiness is not completed EdNova acceptance.

## Cleanup and workspace

- Consolidated project documentation into `docs/`, alongside the runtime contract fixtures/runbook that already lived there. Removed `docs-repo/` and the parallel root audit tree.
- Removed obsolete root migration/auth analyses, duplicate navigation/status pages, old brief/backlog/tracker snapshots and the audit inventory. They remain recoverable from Git history. The official PDF and latest v1.2 source brief retain their original SHA-256 hashes.
- Removed committed local Serena configuration, redundant web jsconfig, obsolete SPA public entry/manifest, unused research notebooks, inactive nested Python workflow and the legacy frontend implementation/tests tied to it. New behavior tests replace the retired implementation fixtures.
- Kept the existing **pnpm workspace** and one root Node lockfile. Eleven workspace projects already existed; no workspace migration, app-folder renaming or microservice split was necessary. Python keeps Poetry and its lockfile.
- Removed unused frontend routing/store/fetch/animation/chart packages; native Next/React handles the rebuilt flows. Kept backend-referenced ranking assets and active Python ML/runtime modules rather than breaking their consumers.

## Startup and development

`pnpm dev:setup` creates missing local env files with matching auth/database/service configuration and random secrets; existing files are preserved. `pnpm dev:doctor` checks versions and matching values without printing secrets. Both avoid pnpm built-in command names.

`pnpm dev:infra:up` starts the isolated `ednova-dev` Mongo/RabbitMQ/Redis/Mailpit stack. Ports bind to loopback (27018, 5673/15673, 6381, 1026/8026), volumes persist, and unrelated containers are untouched. Dev/test Mongo/Mailpit ports overlap intentionally: use one stack at a time. `pnpm dev:infra:down` stops this stack without removing data.

`pnpm dev` starts Node API/web. `pnpm dev:ai` and `pnpm dev:worker <name>` load AI env and invoke Poetry separately. Full AI environment/model provisioning remains a prerequisite; setup explicitly uses mocks rather than claiming approved real inference.

Fixed generated Nest public paths containing inline parameter regex while preserving the original dispatch key and `ContractParameterPipe` checks. Added six constraint tests and a deterministic regeneration command. Removed mixed CommonJS assignments from shared auth/entitlement TypeScript exports; API and Next production builds now work.

Reconciled competency tests with lease-based claiming and coach fixtures with the required tier. Added a lower-tier denial test. Replay integration now expects the existing `already_processing` skip reason; no production authorization/competency policy was loosened. Root Python CI uses Poetry/real test paths and required named checks instead of absent requirements/test files with ignored failures. Poetry lock validation passes with metadata deprecation warnings.

## Frontend architecture and intentional scope

Replaced the SPA adapter with native `src/app` route groups, server layouts/reads, per-feature authenticated Server Actions, React 19, shadcn/ui and Tailwind 4. One global stylesheet contains theme/base rules; no screen CSS remains. Domain actions validate bounded fields, keep actor identity server-side, forward cookies to Nest, preserve redirect control flow and revalidate affected routes. Uploads are bounded to 25 MB total; file validation remains enforced in the API too.

See [frontend guide](../frontend-web.md) for implemented surfaces and explicitly retired/deferred legacy UI. Existing EdNova Studio publication, trusted activity registry, peer facilitator, advanced scheduling and voice acceptance remain backlog tasks. No fabricated course/progress data ships in the app. Backend functionality and existing user data were not removed.

## Executed verification

- API and frontend production builds: passed after startup/export repairs; rebuilt native frontend build/typecheck/lint also passed before final formatting.
- Nest route constraints: 6 passed.
- Selected API units/contracts: 46 suites, 449 tests passed.
- API integration: 53 passed, 4 opt-in broker tests skipped; one suite skipped. These do not certify real inference.
- Auth lifecycle/Nest suite: 17 passed.
- Frontend validation units: 5 passed.
- Earlier rebuilt auth/smoke browser run: 9 passed. Expanded workspace checks initially exposed an empty optional description rejected by Joi; the action now omits that field. Final rerun is recorded below.
- `pnpm dev:doctor`: passed with Python 3.14 available; dev Compose services reached healthy state.
- Poetry `check --lock`: passed; full Poetry dependency install/model execution not run.
- Existing Graphify command is broken on this host (`ModuleNotFoundError: graphify`), so no graph update is claimed. Generated graph state is ignored.

## Remaining baseline work

API strict checking still reports legacy test typing/import issues, and API lint still reports legacy findings. Those gates were not weakened or excluded. Root CI therefore remains blocked until ED-01 closes them. Backend source/room/static-file access gaps documented in ED-02 also remain; UI membership checks do not certify every direct API transport. Real approved inference, full Python/Docker parity and live voice have not been validated.

The frontend is rebuilt and can be developed using the named module boundaries. The repository is not represented as wholly green or production-ready while these baseline gates remain open.

## Final preparation results

The full root `pnpm test` passed: route checks 6/6; API Jest 55 suites passed, one skipped, 520 tests passed and 4 opt-in tests skipped; auth lifecycle/Nest 17/17; frontend input-boundary tests 5/5. This replaces the narrower selected-unit result above without claiming skipped broker/model coverage.

The expanded native browser suite passed all 8 tests against the real API/Mongo/Mailpit stack: registration, verification, Server Action login/reset, cookie persistence/invalidation, task create/status persistence, subject creation, profile persistence, admin denial, desktop/mobile layout and two-user room join/leave/revocation. Page content/controls rendered without a framework overlay; screenshots were inspected against the design concept at 1280px desktop and 390px mobile. Final UI refinements increase control sizes and disable the development indicator.

Frontend lint/typecheck and production build pass after removing stale generated route caches from the old app location. The typecheck command now generates route declarations first. Local docs check: 35 maintained/package Markdown files, zero missing local destinations; 36 task owners remain Habib 14 / Tasnim 12 / Aziz 10, and all 164 current source references resolve. The brief/PDF hashes remain unchanged. Browser validation used Playwright because no Browser plugin skill is available.

Root backend strict lint/typecheck remain outstanding legacy gates; there were also nonfatal notification-delivery warnings during task/room browser checks (`app.locals` unavailable in an in-process consumer). Core writes and room membership succeeded, but notification success is not claimed. No live model/voice/full Python install/Docker build was performed.

The ordinary `pnpm dev` stack was also started successfully: Next :5173 and API :3000, connected Mongo and RabbitMQ, with API health reporting connected. CSP/nonce/nosniff/referrer headers were verified after moving the proxy beside `src/app`. Fresh setup was exercised in an isolated temporary workspace: generated matching random secrets and env settings, then confirmed a second run preserved every existing env file byte-for-byte. No secret values were printed.

The final post-proxy production build passed and reports the Proxy middleware. All 8 browser tests also passed against the normal running dev stack (not just the isolated launcher), with CSP enabled. Frontend source shrank from 182 to 73 files and uses one global CSS file. Four unused research notebooks were removed; runtime ML adapters/models and Compose-mounted nginx configs were retained after checking consumers.

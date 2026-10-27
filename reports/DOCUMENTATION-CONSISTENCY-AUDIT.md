# Documentation consistency audit — 26 October 2026

**27 October update:** Development/test Compose references now point to `deploy/compose.development.yml` and `deploy/compose.test.yml`; current deployment, Python-image, CI and source-volume guidance has been corrected. The entries below preserve the audit-time discrepancies; wider documentation reconciliation remains open.

This is a partial, evidence-linked cross-check. It does not certify every paragraph of all 52 historical reports. Preserve historical reports; update current operating guidance separately after review.

| Source / assertion | Current source or observation | Disposition |
|---|---|---|
| `docs/sprint-backlog.md:65–76` ED-01 DONE requires lint, typecheck, full required suites and build | Current `pnpm lint` exits 1 at `apps/api/shared/betterAuth.ts:273`; dev Compose referenced by package scripts is missing | Historical DONE does not describe current tree. Revalidate baseline and date the new status. |
| `docs/development.md:8–17`, `README.md:45–46`: `pnpm dev:infra:up` starts dev Mongo/RabbitMQ/Redis/Mailpit | `package.json:24` references absent `docker-compose.dev.yml`; command exits 1 | Confirm intended replacement or restore a compatible stack, then revise instructions. |
| `package.json:21` and `docs/development.md:40–42` test stack | `docker-compose.test.yml` absent | Test setup is not reproducible through documented script. |
| `docs/deployment.md:26` production overlay and old `study-partner-api` paths | `docker-compose.prod.yml` absent; actual path `apps/api` | Update verified deployment commands; do not recreate unreviewed production infrastructure from historical instructions. |
| `docs/deployment.md:51` says CI Python install uses absent requirements file | `.github/workflows/ci.yml` installs Poetry 2.5.1 and locked dependencies, with additional source-foundation job | Stale claim; CI definition itself has not been executed remotely. |
| `reports/EDNOVA-P0-R2-SOURCE-AI-VERIFICATION.md` says Compose worker mounts revision FAISS writable | Current `docker-compose.yml:31` has `:ro` and worker extends service; Compose config resolves worker read-only | Historical run referred to earlier bytes; current default config regressed. `docker-compose.ai.yml` independently mounts writable, but it uses separately configured external resources. |
| `reports/EDNOVA-P0-R3-INTEGRATED-LEARNING-VERIFICATION.md` reports root lint and browser PASS | Current lint fails and current browser was not rerun; intervening working-tree changes exist | Retain historical evidence and scope its date/source; do not carry PASS forward to this tree. |
| `docs/sprint-backlog.md:132–136` says enrollment/course invitation absent | `apps/api/modules/study/src/routes/enrollments.ts` and `services/enrollments.ts` exist; current full acceptance unverified | Update current implementation description after checking semantics and owner approvals; presence is not complete acceptance. |
| Backlog ED-09 and ED-31 marked TODO | `services/roomLearning.ts`, `apps/web/src/features/courses/course-studio.tsx` contain bounded deterministic facilitation and Studio integration | Mark partial provisional engineering rather than imply absence; do not claim full model/instructor acceptance. |
| `docs/sprint-backlog.md:36,525` ED-25 index P2, detail P1 | Same task has conflicting priorities | Obtain owner decision before sequencing. |
| `docs/contracts/ednova-v1-approvals.md` engineering-link additions in dirty diff | Ledger still explicitly records 0/19 decisions and five pending linked confirmations | Engineering links are not owner approvals; contract remains unfrozen. |
| Product `docs/product-specification.md` F01–F22 versus `docs/reference/ednova-brief-v1.2.md` F01–F09 | Same F numbers denote different feature groupings | Always qualify IDs by source; use ED backlog IDs for canonical task deduplication. |
| `docs/team-delivery-plan.md` gate includes voice/XP versus canonical P0 split | `docs/sprint-backlog.md:13` marks voice and rewards P1 and PDF-following P1 | Preserve disagreement and request owner prioritization, not a silent scope change. |

Areas still requiring comprehensive comparison: all historical M00–M38 reports and roadmap acceptance details, product F01–F22 and T01–T38 scenario mapping, contract 01–18 version/field descriptions, legacy deployment/security/runbook content, API docs versus generated routes, and standalone tasks in all config/source files. The task matrix contains an initial crosswalk, not proof every possible discrepancy was discovered.

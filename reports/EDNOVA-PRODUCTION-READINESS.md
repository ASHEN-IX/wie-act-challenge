# EdNova production readiness — 23 October 2026

**Verdict: NOT READY.** Functional, authorization, evidence-integrity and governance failures independently prevent promotion. No deployment, package publication, production migration or real-user data mutation was performed.

## Reproducible environment

Observed Node 24.20.0 and pnpm 11.3.0 match package.json (Node >=24, pnpm exactly 11.3.0). A disposable copy excluding environment secrets successfully completes locked installation of 1057 packages and API/web production builds. Offline installation first fails for uncached tarballs; online retry succeeds. The user's installed dependencies were not replaced.

Current workspace API/web builds and strict typechecks pass. Root lint and regression tests fail, so reproducible build success is not reproducible quality acceptance. Contract generation succeeds in the disposable copy but changes study.module.ts: manually added activity methods disappear because the activity router does not define canonical operations.

The supported audit Python environment is Python 3.12.15 with the existing Poetry lock and pytest 9.0.2. The guarded full run passes 1054 tests with five explicit skips; pip check and exported-schema drift check pass. The default Python3.14 Poetry environment lacks pytest. Fresh locked Python installation and a current AI Docker image build were not independently rerun; existing environment consistency is not a fresh-image certification.

## Infrastructure and persistence

Existing healthy Mongo7 and Mailpit test containers were reused. Both were observed exited(0) at the final inspection; no audit stop/down command was issued, and the reason for that later state change is unknown. They were not restarted. Audit-specific records use isolated synthetic databases. No production database was queried for migration state.

Compose Mongo is standalone. The master report's “Standalone with transactions enabled” is invalid operational guidance: multi-document transactions require a replica-set/sharded topology. Cross-document attempt/evidence/reward processing needs a compatible recoverable protocol or an explicitly reviewed topology. Current duplicate attempts return some 500s; a graceful API stop/start preserves a committed result, but process-kill/power-loss recovery between evidence and receipt writes is unverified.

Redis/RabbitMQ are configured, but this audit did not execute a fresh real broker-worker roundtrip, Redis outage/failover or crash recovery through the full PDF pipeline. Python HTTP and workers are separate lifecycles. docker-compose.ai.yml launches uvicorn only and uses an external uploads volume. Its service does not explicitly persist the FAISS directory: verify actual vector-store path and workers' durable volumes before release. Ingestion may use fallback rev_1 while editing changes revision tags; publication does not check an actual matching index before activation.

Python /health is application liveness, not provider/vector/worker readiness. Model status falsely equates key presence with REAL_APPROVED. No approved compact/capable inference was authorized or executed.

Realtime fanout and presence remain process-local. Durable Mongo room/history state does not establish distributed WebSocket delivery. Treat deployment as single-instance until multi-instance fanout, reconnection and failure recovery are tested. LiveKit/audio/speech are incomplete advanced targets, deferred from canonical P0 but blocking full-roadmap completeness.

## Migration and indexes

The synthetic audit harness initializes and records actual indexes in [indexes.json](evidence/ednova-final-independent/indexes.json): course/revision uniqueness, course/enrollment uniqueness, actor/attempt uniqueness for attempts and evidence, and activity indexes.

These are newly created test indexes, not deployment indexes. Invitation-index migration has dry-run/apply safeguards and synthetic tests; no authorized deployment target dry-run/apply evidence exists. The audit did not run that migration against a non-test database. Verify obsolete pending-invitation index removal and token uniqueness on the actual intended target through a separately authorized operation.

## CI coverage

.github/workflows/ci.yml runs locked Node install, lint, typecheck, root tests, builds, API/web Docker builds and eight auth/workspace/smoke browsers. Its AI job correctly uses Poetry2.5.1 and the lock, but runs only seven selected worker/schema/inference/SSRF files.

CI does not run the complete Python suite, current tutor/provider/vector tests, full TS/Python fixture corpus and structural export drift, differential parity, actual broker transport, domain Studio/room/enrollment browser runners or migration safety. No remote green Actions execution for the current dirty source was independently observed. Historical logs and planned CI coverage are not execution evidence.

## Deployment prerequisites

| Gate | Current evidence | Required before acceptance |
|---|---|---|
| Secrets | Server-side config and env exclusions exist | Review target secret injection/rotation and matching Node/Python service key without exposing credentials |
| Database auth/migrations/indexes | Synthetic only | Approved target inventory, safe dry-run/apply/repeat, rollback |
| Backup/restore | Scripts exist; not executed | Restore isolated snapshot; verify private results, indexes, originals and revision/index pins |
| Current Docker images | No fresh current-source build/runtime certification | Build exact reviewed source; cold-boot health/readiness/jobs/browser smoke |
| TLS/origins/cookies/proxy/WS | Configured; public deployment unverified | Trusted origins, secure cookies, hostile-origin checks, WS upgrade/reconnect |
| Broker/worker recovery | Unit tests and historic implementation | Current claim/crash/redelivery/DLQ/result-recipient drill |
| FAISS readiness/durability | Not release-verified | Persist exact revision index/metadata and require readiness before activate |
| Monitoring/logging | Existing endpoints; partial review | Alerts on failed/slow jobs, saturation, rejected results and unavailable inference; failure-path redaction checks |
| Rollback/disaster recovery | Documentation/scripts only | Migration-compatible rollback and restore rehearsal |
| Contracts | 0/19 decisions; not frozen | Genuine owner decisions, five confirmations, reviewed artifact hashes and official freeze |
| Actual inference | External gate not authorized | Approved service details and explicit authorization with agreed cost bound |
| Functional/security | FAIL | F00–F16 and complete real-service P0 journeys |

## Documentation contradictions

The master report states Next15, Node20+, pnpm9+, web3000 and MONGO_URI/JWT_SECRET/LLM_PROVIDER_MODE. Current source uses Next16.4.1, Node>=24, pnpm11.3.0, web5173, runtime MONGODB_URI, Better Auth and LLM_MOCK. Its launch commands do not establish shared worker/files/vector readiness.

docs/deployment.md retains old study-partner-* paths and obsolete CUDA/direct-pip/absent-CI-requirements descriptions; the actual AI Dockerfile uses locked Poetry/Python3.12. Roles-and-permissions restrict metadata-admin publication while workflow wording allows it. Team gates include voice/XP in P0 while canonical product/backlog v1.2 defer them. Keep historical records, designate current authority and correct the operational instructions in a separate engineering/documentation mission.

M23 is PARTIAL in implementation, FAIL in independent acceptance, NOT READY for release and NOT READY for deployment. Operator approval cannot replace missing tests or owner sign-off.

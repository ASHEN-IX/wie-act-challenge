# Deployment — existing configuration and readiness limits

This is a configuration guide, not evidence of a successful deployment. Current build/startup/test failures are documented in [validation](audit/validation.md); resolve ED-01/ED-02 before deployment. No deployment or image replacement was performed during this audit.

## Main stack

Backend and frontend run locally from the workspace with `pnpm dev`. The main `docker-compose.yml` runs only the Python AI service and ingestion worker, MongoDB (:27017), Redis, RabbitMQ and Mailpit (:1025/:8025). Persistent volumes hold Mongo, RabbitMQ, FAISS indexes and uploads.

Configure `apps/api/.env` from `apps/api/.env.example` and review Compose environment interpolation separately from `env_file`. Set local/deployment secrets, broker credentials/vhost, database URI, common Better Auth secret, trusted public URL/origins, email delivery and independent AI endpoint/key. Node and Next must resolve the same identity database and auth secret. In production use HTTPS and an explicitly configured public auth origin.

Start the Python and infrastructure services:

```bash
docker compose --env-file apps/api/.env up -d --build
```

Run the backend and frontend separately from the repository root:

```bash
pnpm dev
```

There is no current production Compose override in this checkout. `deploy/Caddyfile` is an existing reference configuration, not a complete reviewed deployment. Configuration validation does not prove a working public deployment, TLS or zero-downtime rollout.

## Independent Python AI

`docker-compose.ai.yml` is a separate lifecycle; copy `.env.ai.example` to a local `.env.ai` and set reachable `AI_MONGODB_URI`/`AI_RABBITMQ_URL` plus the service secret/model env in the expected Python environment. The file optionally loads `apps/ai/.env`. Confirm effective Compose config privately; never print credentials into shared logs.

```bash
docker compose --env-file .env.ai -f docker-compose.ai.yml config --quiet
```

The Compose file defines separate HTTP and ingestion-worker services. Both require the same database/broker/key and shared upload and revision FAISS paths. Both write revision indexes: ingestion writes its artifact and the authenticated HTTP source-preparation operation creates an exact reviewed revision index. The named upload volume is `study-partner-api_study_uploads`; a host-run API does not automatically see it or the named FAISS volume. Configure shared mounts explicitly and verify Node can read both artifacts. Other worker types require separate processes as described in [AI operations](ai-service.md). AI Compose must not accidentally point to unrelated persistent services.

The current Python Dockerfile uses Python 3.12 and locked Poetry dependencies. A successful build or HTTP health check does not establish worker, source storage or approved inference readiness. The organizer inference service has separate authorization requirements.

The image now defaults to UID/GID `10001:10001` and refuses incompatible upload
or index mounts without changing their ownership. Review [storage migration and
runtime verification](runbooks/ai-container-storage.md) before upgrading existing
volumes. Main Compose explicitly requires shared Redis for durable worker leases
and uses a persistent AOF volume; independent AI Compose requires `AI_REDIS_URL`.

## Checks and recovery

API `/api/v1/health` is a basic check; `/api/v1/monitoring/health` includes independent AI reachability and can report degraded state. `/api/v1/monitoring/metrics` requires session plus admin/internal access. Python `/health` is intentionally lightweight and does not initialize agents/models/workers. Healthy HTTP containers are insufficient evidence of job execution.

Verify: cookie login and authorization; private course download; Node->broker->worker->result; upload volume mapping; slow/limited model behavior; two-browser room transport; source isolation; mail delivery. Run required builds/tests and inspect redacted logs before promotion. Review backup/restore scripts in `apps/api/scripts`, inspect targets and test restore in an isolated environment. Old rollback details are historical guidance, not an instruction to delete databases/queues. The [RabbitMQ runbook](runbooks/rabbitmq-topology-v2-migration.md) describes a specific topology migration and its production cautions.

## CI limitations

Root `.github/workflows/ci.yml` runs Node checks, browser tests, locked Poetry checks and a source-foundation job. A workflow definition does not establish a green remote execution or deployment readiness. Verify current-source Actions results and all operational gates independently.

## Enforced single API instance

The current WebSocket registry is process-local. Run one API process/replica with
`NODE_ENV=production`, `WEB_CONCURRENCY=1` and `EDNOVA_REALTIME_MODE=single` (default).
Production startup obtains a renewable Mongo lease scoped to the application DB;
a second owner is refused. An expired or lost lease fences request/response and
WebSocket delivery and stops the instance. Clean shutdown releases its lease;
a killed instance requires lease expiry before takeover. All instances must use
the same application database. This is single-instance enforcement, not a
multi-replica delivery adapter. See [verification](../reports/EDNOVA-SINGLE-INSTANCE-VERIFICATION.md)
for executed scope and remaining production rollout tests.

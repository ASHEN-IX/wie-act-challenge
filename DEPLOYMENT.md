# Deployment — existing configuration and readiness limits

This is a configuration guide, not evidence of a successful deployment. Current build/startup/test failures are documented in [validation](audit/2026-10-18/VALIDATION.md); resolve ED-01/ED-02 before deployment. No deployment or image replacement was performed during this audit.

## Main stack

Root `Dockerfile` builds the API; `study-partner-web/Dockerfile` builds Next standalone. `docker-compose.yml` defines app/API (:3000 bound localhost), web (:5173 internally), nginx edge (:8080), MongoDB (:27017), Redis, RabbitMQ and Mailpit (:1025/:8025). Persistent volumes hold Mongo, RabbitMQ and two upload roots. Do not remove them to resolve application errors.

Copy/configure root `.env.example` into `study-partner-api/.env` and review the Compose environment interpolation separately from `env_file`. Set real local/deployment secrets, broker credentials/vhost, database URI, common Better Auth secret, trusted public URL/origins, email delivery and independent AI endpoint/key. Node and Next must resolve the same identity database and auth secret. In production use HTTPS and an explicitly configured public auth origin.

Main configured launcher:

```bash
docker compose --env-file study-partner-api/.env up -d --build
```

For the provided production override (review bind ports, resource/security/edge settings first):

```bash
docker compose --env-file study-partner-api/.env -f docker-compose.yml -f docker-compose.prod.yml config --quiet
```

The production override and `deploy/Caddyfile` are retained infrastructure; configuration validation does not prove a working public deployment, TLS or zero-downtime rollout. nginx forwards API/WS to app and web traffic/auth engine to Next. Preserve forwarded origins/cookies and WS upgrade headers.

## Independent Python AI

`docker-compose.ai.yml` is a separate lifecycle; copy `.env.ai.example` to a local `.env.ai` and set reachable `AI_MONGODB_URI`/`AI_RABBITMQ_URL` plus the service secret/model env in the expected Python environment. The file optionally loads `study-partner-ai/.env`. Confirm effective Compose config privately; never print credentials into shared logs.

```bash
docker compose --env-file .env.ai -f docker-compose.ai.yml config --quiet
```

Its HTTP command starts uvicorn only, not RabbitMQ consumers. Launch needed workers separately using the same database/broker/key and shared upload path, as described in [AI operations](docs-repo/docs/ai-service.md). The external volume is named `study-partner-api_study_uploads`; verify it matches actual API staging paths before ingestion. DB names and `aiCourseId`/file references are not automatically reconciled by Compose. AI Compose must not accidentally point to unrelated persistent services.

Python Docker uses a CUDA/PyTorch base and direct pip list that differs from Poetry (including missing messaging dependencies); the organizer inference service has its own constraints. Do not assume this image builds/runs all workers or satisfies challenge inference requirements. Record and fix install/entrypoint parity under ED-01/ED-03, without silently migrating infrastructure.

## Checks and recovery

API `/api/v1/health` is a basic check; `/api/v1/monitoring/health` includes independent AI reachability and can report degraded state. `/api/v1/monitoring/metrics` requires session plus admin/internal access. Python `/health` is intentionally lightweight and does not initialize agents/models/workers. Healthy HTTP containers are insufficient evidence of job execution.

Verify: cookie login and authorization; private course download; Node->broker->worker->result; upload volume mapping; slow/limited model behavior; two-browser room transport; source isolation; mail delivery. Run required builds/tests and inspect redacted logs before promotion. Retain backup/restore scripts in `study-partner-api/scripts`; inspect targets and test restore in an isolated environment. Old rollback details are historical guidance, not an instruction to delete databases/queues. The [RabbitMQ runbook](docs/runbooks/rabbitmq-topology-v2-migration.md) describes a specific topology migration and its production cautions.

## CI limitations

Root `.github/workflows/ci.yml` runs Node checks/browser tests, but its AI install points to absent `requirements.txt` and an absent URL test filename. The nested `study-partner-ai/.github/workflows/ai.yml` is a former standalone workflow and is not a root workflow in this checkout. Repair install/test paths and required coverage rather than removing checks (ED-01). No CI/CD success or deployed status is claimed.

# EdNova architecture review — working baseline, 27 October 2026

This is an initial inspection, not a complete architecture or security audit. HEAD is `5fb70a095da8f8cf429aed2e4f4bf72ce096e927` with substantial pre-existing working-tree changes; [inventory and commands](evidence/ednova-master-20261027/) capture this run. The pnpm workspace contains the Nest API and shared modules and the Next frontend; the independently built Python application handles AI HTTP and workers. The API and Python components communicate through HTTP and RabbitMQ. MongoDB, Redis and shared original/FAISS storage are configured separately.

The [source and ingestion foundation](EDNOVA-P0-R2-SOURCE-AI-VERIFICATION.md) documents exact-revision source artifacts. The current image now defaults to UID/GID `10001:10001`, with root-owned application code and separately owned writer directories. A fresh locked image build and actual non-root PDF/FAISS writer, separate read-only consumer, preserved incompatible-volume denial and network-disabled HTTP checks pass. See [current operational evidence](EDNOVA-OPERATIONAL-RECOVERY.md). Existing user volumes were not re-owned or migrated; [permission review and migration](../docs/runbooks/ai-container-storage.md) remain an operator gate. These checks do not establish production recovery or real inference.

Realtime fanout and socket registries in `apps/api/modules/notification/src/realtime.ts` are process-local. Durable room state cannot provide cross-process socket delivery. The existing runbook states a single-process assumption; deployment enforcement and multi-instance recovery have not been verified.

`apps/ai/workers/idempotency.py` selects a process-local store when `REDIS_URL` is absent, unless `NODE_ENV` or `APP_ENV` is `production`, in which case startup fails. Main Compose now explicitly sets production mode, shared Redis and its health dependency, with a dedicated persistent AOF volume. Independent AI Compose requires `AI_REDIS_URL`. An isolated actual worker SIGKILL plus broker/Redis KILL/restart drill passes, including duplicate suppression and DLQ/retry exhaustion. Its handler is a synthetic transport probe: domain side effects are at-least-once and still require durable revision/evidence idempotency. Completion markers expire after 24 hours.

The current AI image source/worker imports were checked in the previous concurrency run; actual model credentials, paid inference, distributed fanout, real media, backup/restore and production deployment remain outside those tests. The architecture review remains open pending full inventory, dependency and runtime analysis.

Scanned-PDF fallback now runs parsing, bounded rasterization and local English
Tesseract in a fresh supervised process group. Kernel resource limits and a
whole-tree wall deadline contain the parser/engine; parent-owned temporary files
are removed on forced termination. Revision sidecars retain page/hash identity
plus extraction method/confidence/review metadata. Node verifies those fields
before Course Studio displays its warning. This is internal artifact metadata;
public frozen-contract enums were not changed. [OCR verification](EDNOVA-OCR-VERIFICATION.md)
records the supported scope and remaining mixed-content/quality limitations.

# AI container storage and worker durability

The AI image runs HTTP and workers as UID/GID `10001:10001`. Application code
and the installed environment stay root-owned. Upload and FAISS directories in
the image belong to the runtime user, so new empty Docker named volumes inherit
compatible permissions. The startup preflight actually writes a temporary file
in each configured directory and removes it; it never changes existing artifact
contents, permissions or ownership. A read-only application filesystem is
supported when `/tmp` and the two writer mounts remain writable. Model downloads
also require a separately writable cache; the smoke test uses no model downloads.

Existing volumes and host bind mounts need explicit permission review before
upgrading. Snapshot the originals and indexes, record hashes and current owners,
and test restoration into separate storage. Check that the API reader and the
Python writers can still access the same bytes. Prepare a copy accessible to
UID/GID 10001 or a reviewed ACL/group arrangement, verify it with the runtime
check, and plan the cutover and rollback. Do not recursively chown the live
volume, make private material world-readable, or start the image as root to
bypass the failed check. The migration of existing user storage is an operator
action; no existing volumes are migrated by these repository changes.

The main Compose stack explicitly selects `APP_ENV=production`, shared Redis,
and a Redis health dependency for both AI processes. Redis uses AOF with
`appendfsync always` and the separate `redis_data` volume. The independent AI
Compose requires `AI_REDIS_URL`; its operator must provide persistent Redis with
an appropriate durability policy. Production workers reject a missing Redis URL.
Development host mode can still explicitly use in-memory leases. Completion
markers currently expire after 24 hours, so long-term domain idempotency must
also be enforced by the revision and command records. Redis persistence does not
make handler effects transactional with RabbitMQ acknowledgements.

Build and verify without external inference:

```bash
docker build -t ednova-ai-check -f apps/ai/Dockerfile apps/ai
node scripts/verify-ai-container.mjs ednova-ai-check
node scripts/verify-worker-recovery.mjs ednova-ai-check
node scripts/verify-source-restore.mjs ednova-ai-check
node scripts/check-compose.mjs
```

The runtime check creates uniquely named disposable volumes and containers,
tests actual sandboxed native-text/image-only PDF extraction, local English OCR
and FAISS publication as UID 10001,
verifies both from a second container with read-only mounts, checks rejection
and preservation of a synthetic incompatible legacy volume, and starts HTTP
with network disabled and a read-only application filesystem. Its embeddings
are deterministic fixtures. The separate recovery runner creates its own internal
Docker network, RabbitMQ/Redis containers and persistent disposable volumes. It
kills a real BaseAIWorker process, kills/restarts both services, verifies redelivery
and duplicate suppression, and exercises terminal DLQ and retry exhaustion with a
synthetic handler. It does not certify ingestion-domain crash consistency. Neither
runner verifies paid inference, OCR quality, backup restoration or production
storage permissions. Dedicated
read-only consumers bypass the writer entrypoint with `--entrypoint python` and
must never expose source-preparation writes.

The separate source-restore runner verifies a coordinated synthetic Mongo/file
snapshot with real `mongodump`/`mongorestore`, fresh target volumes, unique-index
preservation and source checksum/page checks. It also rejects a corrupted file
archive before writes. This does not supply a live-application snapshot protocol,
backup authentication/encryption, retention policy or a reviewed operator restore
procedure for real institutional data.

Scanned-PDF extraction uses local English Tesseract. Install `tesseract-ocr` and
`tesseract-ocr-eng` for host-mode ingestion; the image already includes English
language data. No network model download is needed. OCR supports at most 20
pages per document, 4 million raster pixels per page and a 45-second whole-tree
deadline with memory/CPU limits. All OCR passages are marked for instructor
review; low word confidence is diagnostic. See [OCR verification](../../reports/EDNOVA-OCR-VERIFICATION.md)
for failure behavior and remaining quality/correction acceptance.

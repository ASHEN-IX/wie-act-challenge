# EdNova operational recovery verification — 27 October 2026

This is scoped local evidence, not production recovery certification. Source
starts at HEAD `5fb70a095da8f8cf429aed2e4f4bf72ce096e927` with a dirty working
tree. The run's [source manifest](evidence/ednova-execution-20261027/source-ocr-final.json)
identifies source bytes separately from Git HEAD. Only synthetic disposable
containers, networks, volumes and test databases were used. Existing service
volumes and user data were not migrated or reset.

| Criterion | Implementation / actual assertion | Command and evidence | Result |
|---|---|---|---|
| OPS-01 / ED-01 | Default image user is `10001:10001`; actual native-text/image-only PDF extraction, local English OCR and FAISS publication succeed on fresh named volumes | `node scripts/verify-ai-container.mjs ednova-audit-ai:nonroot`; [runtime log](evidence/ednova-execution-20261027/nonroot-ocr-current.log) | IMPLEMENTED_AND_VERIFIED for the synthetic fixture |
| OPS-02 / ED-06 | A second container reads the same PDF, original checksum, revision FAISS/sidecar and page 1 provenance; both mounts reject writes | Same runtime check and log | IMPLEMENTED_AND_VERIFIED for read-only consumption |
| OPS-03 / ED-01 | An incompatible root-owned synthetic legacy volume causes startup exit 1; sentinel, owner and mode remain unchanged | Same runtime check and log | IMPLEMENTED_AND_VERIFIED; existing user mounts still require operator review |
| OPS-04 / ED-01 | HTTP returns 200 as non-root with no network access and a read-only application filesystem | Same runtime check and log | IMPLEMENTED_AND_VERIFIED for lightweight health, not model execution |
| OPS-05 / ED-06/12 | Real worker process is SIGKILLed after acquiring a Redis lease and entering its handler; no completion result exists | `node scripts/verify-worker-recovery.mjs ednova-audit-ai:nonroot`; [recovery log](evidence/ednova-execution-20261027/worker-recovery-ocr-current.log) | IMPLEMENTED_AND_VERIFIED for BaseAIWorker transport |
| OPS-06 / ED-06/12 | RabbitMQ and Redis receive actual KILL signals, restart with persistent volumes, and the unacknowledged job is redelivered to a fresh worker | Same recovery command and log | IMPLEMENTED_AND_VERIFIED for the fixture handler |
| OPS-07 / ED-06/12 | Re-publishing the completed message creates no new handler execution or completion result | Same recovery command and log | IMPLEMENTED_AND_VERIFIED within retained Redis completion TTL |
| OPS-08 / ED-06/12 | Terminal error enters DLQ once; transient errors execute three bounded attempts through real delay queues, then publish failure and enter DLQ with retry header 2 | Same recovery command and log | IMPLEMENTED_AND_VERIFIED for transport failure policy |

The worker test uses the actual `BaseAIWorker` and Redis lease implementation
with a three-second test lease and accelerated `[100,200]` millisecond retry
delays. Its handler is an explicitly synthetic probe, not the ingestion/evaluator
domain handler. Handler entry occurs twice across crash recovery; this proves
at-least-once execution and duplicate completion suppression after retention,
not transactional exactly-once handler effects. Production defaults retain
120-second leases, canonical retry delays and 24-hour completion markers.

The first two recovery-runner attempts failed at broker startup. Running Erlang
diagnostics as root during first boot created an incompatible cookie before the
broker user initialized it. The runner now executes diagnostics as `rabbitmq`,
uses a stable hostname and bounds Erlang scheduler threads. Failed logs are
retained as `worker-recovery.log` and `worker-recovery-retry.log`; they are not
reported as passes. Only uniquely generated disposable resources were removed.

Main Compose now explicitly configures production worker idempotency, a Redis
health dependency and persistent AOF (`appendfsync always`). Independent AI
Compose requires `AI_REDIS_URL`. These configuration checks and the actual
isolated drill do not certify the user's deployed Redis settings.

## Synthetic coordinated backup and restore

`node scripts/verify-source-restore.mjs ednova-audit-ai:nonroot` passes against
two fresh, separately mounted MongoDB containers and fresh upload/index volumes.
It creates an actual PDF/FAISS artifact, seeds matching synthetic Mongo course
and revision metadata plus a unique revision index, stops fixture writes, takes
real `mongodump --archive --gzip` and a file archive, and restores both into
separate blank storage. A new Python process checks original/index checksums,
page provenance, OCR confidence/review flags, the published pin fields and the restored unique index. A
corrupted file archive is rejected by its expected checksum before extraction;
the target directories remain empty in that negative case.

[Passing restore log](evidence/ednova-execution-20261027/source-restore-ocr-current.log)
records archive hashes. Mongo caches are bounded to 0.25 GiB in 512 MiB containers.
The test has no external network or provider credentials. It removes only its
uniquely named synthetic resources. This is a coordinated stopped-writer fixture,
not a snapshot protocol for a running application or authenticated browser
acceptance after restoring a complete institution.

The first restore attempt exited 137 while Docker Desktop became unavailable;
the cause was not established. Docker Desktop and the services observed running
at mission entry were restarted without deleting their data. A second attempt
found a runner DNS bug: generated container names exceeded DNS label limits.
Short network aliases and bounded Mongo selection timeouts fix that runner bug.
Both failed logs (`source-restore.log`, `source-restore-final.log`) remain retained;
the earlier `source-restore-verified.log` and current `source-restore-ocr-current.log` pass.

Remaining acceptance: actual ingestion SIGKILL at each persistence boundary,
partial FAISS pair publication, cross-worker fencing, live-application restore of
the full Mongo/source dataset, Mongo restart during accepted evidence, sustained outage,
production permissions and independently observed remote CI. No paid inference,
production deployment or existing-volume migration was performed.

The latest OCR-capable image reruns all runtime, worker/service-kill and restore
checks successfully. [Image identity](evidence/ednova-execution-20261027/image-ocr.id)
and [locked build](evidence/ednova-execution-20261027/image-ocr-final-build.log)
identify that runtime. The restore fixture now includes both native-text and
image-only PDF pages; a fresh consumer verifies restored OCR confidence and
review flags as well as original/index checksums. These remain stopped-writer
synthetic drills, not production recovery approval.

# Durable source dispatch recovery — 27 October 2026

Ingestion operations now have a server-owned durable outbox record and preassigned
message/correlation IDs. The course pointer is persisted before RabbitMQ publish,
so an immediate result can match its operation. Unconfirmed acknowledgements
retain the same identity and all source bytes. Authorized reconciliation resends
that identity, or reapplies a persisted first terminal outcome after a partial
write. A conflicting later terminal callback cannot replace the first outcome.

Progress and final course writes use conditional current-correlation updates.
Cancelled or superseded operations cannot overwrite the current course state.
Author cancellation invalidates the current correlation; a retry creates a fresh
unreviewed revision retaining the immutable source manifest. Approved revisions
are not rewritten. Python checks the server-owned operation/current course at
bounded stage boundaries; this is cooperative cancellation, not instantaneous
interruption of an already running extraction/model call.

Course Studio exposes author recovery controls after refreshing ingestion state:
reconcile the same operation, retry a failed operation, or cancel ingestion.
Wrong actors and stale operation identities are denied. No failure is inferred
as completion or publication.

`ingestion-pins-current.log` passes six real-Mongo test nodes for immediate
callback ordering, lost-ack same-ID replay, cancellation/late outcome rejection,
retained-source retry, persisted-outcome recovery and reviewed-draft preservation.
Its publisher is an explicit fault fixture. Separate `source-resumed.log` passes
14 real Nest/RabbitMQ/Python/worker source nodes including text, native PDF,
image-only OCR, original downloads and failed-replacement preservation.
`worker-cancellation-tests.log` passes 26 focused Python worker/retry tests.
Evidence is under `reports/evidence/ednova-final-20261027/`.

The old file-validation/status Jest suites required new boundary mocks and
conditional-update assertions; their 35 tests pass in `source-jest-current.log`.
They do not substitute for real Mongo or broker evidence. Initial failing fixture
and old-mock logs remain retained.

`apps/api/tests/integration/ingestion-crash-outbox.node.test.ts` passes seven
focused real-Mongo test nodes covering:
1. CAS atomic arbitration between concurrent enqueue calls (exactly one winner, exactly one 409 conflict, loser marked superseded in outbox).
2. Active processing fencing: replacement file upload on a course with status 'processing' is rejected with 409 INGESTION_CONFLICT without mutating files or active job pointers.
3. Physical SIGKILL crash boundary: child process is killed via SIGKILL (kill -9) immediately after MongoDB outbox and course reservation is committed. The parent recovers state, asserts durable pointers, re-dispatches with the exact same identity, and completes upon worker callback.
4. Pre-persisted outbox outcome recovery: worker outcome saved to `CourseIngestionOperation.result` before process crash is recovered and applied to `Course` without duplicate broker dispatch.
5. Author cancellation invalidation: late worker callbacks are rejected; retries allocate fresh unreviewed revisions retaining original source manifests.
6. Replacement conflict rollback: racing uploads rolling back newly added files and orphaned draft revisions cleanly on CAS rejection.

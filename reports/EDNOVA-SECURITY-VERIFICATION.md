# EdNova security verification — 27 October 2026 continuation

This records bounded current-source checks. It is not a complete release security
audit. The 36-task acceptance matrix and all-channel revocation acceptance remain
open; existing reports describe additional historical checks.

The fresh real HTTP/internal/resource isolation suite passes **21 nodes** after
repairing its storage isolation. It now generates its own temporary uploads
directory before bootstrapping the API, so local `INGEST_UPLOADS_DIR` values
cannot redirect its owner-download fixture into existing user storage.

Command: `pnpm --filter api exec tsx --tsconfig tsconfig.json --test tests/integration/m02-resource-isolation.node.test.ts`.
[Result](evidence/ednova-execution-20261027/m02-isolation.log).
The fixture correction preserves the owner-success and foreign-user/admin-denial
assertions; it does not weaken the download route or grant additional access.

Two retained legacy profile/reward handlers logged complete incoming bodies on
validation/error paths, and the reward handler logged bodies on ordinary requests.
Those bodies could contain private profile information or reward metadata.
`profile.ts` and `gamification.ts` now log fixed labels and validator error types
without the request body or user-supplied action value. The profile HTTP test
submits a private sentinel with invalid preferences, checks HTTP 400, and verifies
that neither the sentinel nor rejected preference enters the captured log.

Command: `pnpm --filter api exec jest modules/user-profile/src/tests/profile.test.ts --runInBand`.
**4 tests pass**. [Result](evidence/ednova-execution-20261027/profile-privacy.log).
This is focused route-level evidence with mocked persistence, not proof that
all application logs or external provider payloads are privacy-safe.

The Python shared database helper also exposed the configured Mongo URI through
`require_db()` errors and logged raw connection exceptions. It now logs a fixed
label and exception type, and returns a fixed sanitized required-database error.
Only successful clients are cached: previously a first connection failure cached
`None` indefinitely, preventing later recovery. Failed clients are closed.

`tests/test_database_connection.py` passes **2 tests**: a credential/private-name
sentinel cannot enter formatted logs or caller errors, and a real closed TCP
endpoint later forwards to local Mongo under the same URI. The next call connects,
performs an actual insert/read in a uniquely named synthetic database and reuses
the healthy client. No mock ping substitutes for the recovery case.

Command: `P0_DATABASE_TEST_MONGODB_URI=mongodb://127.0.0.1:27018 PYTHONPATH=../api/tests/helpers/python_guard:. LLM_MOCK=1 <locked-python> -m pytest tests/test_database_connection.py -q`.
[Result](evidence/ednova-execution-20261027/database-privacy-recovery.log).
The full offline Python rerun then passes **1072 tests, five existing skips**.
The new real-network test is opt-in when the isolated Mongo URI is absent; the
current run and source-foundation CI configuration explicitly provide it.

The AI image defaults to UID/GID 10001, leaves application files root-owned and
refuses incompatible source mounts without re-owning them. Actual isolated
permission checks pass; see [runtime and recovery](EDNOVA-OPERATIONAL-RECOVERY.md).

Remaining security gates include the complete two-institution/all-channel matrix,
voice token/media revocation, deployment secrets/TLS, retention/deletion behavior,
all logging/provider payloads, and independent review. No contract owner approvals
or authority over real user data are inferred from these checks.

## Final-mission continuation

The final mission additionally implements private room-help history/request IDs,
delayed-response revocation, explicit current microphone consent on HTTP and
signaling, a self-only room consent setting, and production single-instance lease
fencing. Current evidence and limitations are in
[private help](EDNOVA-PRIVATE-ROOM-HELP-VERIFICATION.md),
[single-instance enforcement](EDNOVA-SINGLE-INSTANCE-VERIFICATION.md),
[instructor aggregate privacy](EDNOVA-INSTRUCTOR-ANALYTICS-VERIFICATION.md) and
[evidence rewards](EDNOVA-EVIDENCE-REWARDS-VERIFICATION.md).

Membership alone no longer authorizes voice operations: sender and recipient
consent are checked currently, and absent legacy consent fails closed. A consent
change advances the room sequence so stale CAS room commands cannot overwrite
revocation. The authenticated HTTP consent suite passes grant/withdraw/foreign
access while preserving room membership. This does not establish real audio
revocation, LiveKit tokens or streaming moderator behavior; those remain open.
New arbitrary action and quest-completion XP are disabled without deleting their
historical balances or business features. Only the validated evidence ledger
issues new learning rewards.

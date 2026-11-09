# Integrated learning and rooms (P0-R3 provisional engineering)

These operations extend the locally verified P0-R1/R2 foundations. They do not freeze ED-26 or authorize external inference, deployment, migration or production data changes.

## Instructor and institution workflow

Use **Institutions** to create an institution with platform administrator authority, issue instructor/learner invitations with current institution administrator authority, and assign instructors/enroll learners to a selected course. Recipients accept membership invitations in **Profile**. Membership and course assignment/enrollment are separate grants. The server enforces both; a metadata administrator cannot publish without instructor authority.

In **Courses → Upload**, choose Personal or an authorized institutional context. Upload a PDF or supported text original. Upload acknowledgement means processing was queued; use **Open course → Course Studio → Refresh ingestion and draft** to inspect actual worker status. A missing worker can leave processing pending. Do not interpret enqueue success or liveness as extraction readiness.

Review/edit objectives, add an instructor objective when offline extraction cannot produce one, mark reviewed and **Save Draft**. Saving changes the revision tag and invalidates source readiness. **Prepare exact source revision** verifies original bytes and the exact FAISS pair. Select a verified passage, choose quiz or guided problem and generate a quotation-completion candidate. Review public preview and private evaluation, edit permitted title/instructions, then explicitly approve/register. Finally prepare/check the current revision and publish. Success and the immutable learner link appear only after server acknowledgement. Reload on conflicts; do not silently substitute a newer draft or pin.

Candidates use deterministic quotation completion. They do not certify arbitrary conceptual objectives, diagnostic ability or live model generation. Private evaluation remains restricted to the instructor operation; the renderer receives only the public definition.

## Learner workflow and policy

**Open published learning** resolves a published revision and current access. `?revisionId=<tag>` pins an exact permitted historical revision; unknown, malformed and revoked tags fail closed. The activity catalogue uses `activity_records`, immutable publication snapshots and verified source artifacts.

Choose an objective, intent and supported type. The deterministic selector filters reviewed activities by exact objective/type, prefers an activity without accepted evidence and breaks ties by stable activity ID order. It creates no activity. No matching record is an explicit unavailable result. Reviewed difficulty metadata and an approved adaptive level policy remain absent: the UI labels selection nonadaptive. The provisional diagnostic offers 2–4 existing reviewed checks and reports actual objective evidence. It does not infer an ability level or a weakness from completion or submission count.

Solo attempts retain one UUID and the exact answers/time across uncertain retries. A completed retry returns its durable receipt; a changed payload conflicts. Private history is reloaded from authenticated canonical receipt reads. Accepted evidence matching the current approved activity pin supports the progress projection; incorrect, pending and unavailable results do not establish mastery. A newly lost source grant withholds protected results without deleting or regrading historical receipts.

Tutor requests use the strict P0-R2 boundary. Citations target authenticated immutable revision/document downloads. Execution mode is displayed; mock or deterministic results are never described as approved live inference. External model execution remains disabled without genuine authorization and durable aggregate budgeting.

## Shared rooms and private checks

The existing ED-07 lifecycle, presenter, sequence, command receipts, presence and peer text remain authoritative. A presenter selects a canonical published activity; the server persists the complete course/revision/content/activity/revision/type pin and a round ID. Both durable and retained legacy selection paths resolve through the same ActivityRecord service. A course cannot silently advance after the room is pinned. Reconnect snapshots include the authoritative pin and round.

Selecting an activity assigns a recipient-scoped private check on authenticated request. Its stable check ID binds room, round and authenticated actor; its persisted attempt UUID is server-owned. Check endpoints accept only answers and elapsed time. Callers cannot select another recipient, supply a foreign attempt ID or retrieve a peer's check. Submission and recovery use the existing receipt/evidence engine. Changing the selected activity starts a new round. Public state contains completion flags/counts, never answer payloads, grades, keys or private tutor results.

Debrief uses an authorized phase command. Shared information is completion only. Grade aggregates are suppressed for every group size pending a genuinely approved disclosure threshold. The private renderer shows only the authenticated learner's validated result. Source-free rooms retain peer text and deterministic facilitation; they cannot activate a source-backed activity without a valid published course context.

## Facilitator authority

The integrated peer-first proposal derives only public participation and current authorized room/source context. It requests peer explanations; it does not diagnose misconceptions. The server stores the proposer/presenter, exact sequence, pin, two-minute expiry and its own command UUID. Acceptance supplies only accept/decline. Arbitrary phases, activity IDs and model commands are rejected. Current membership, presenter, pin, sequence and expiry are checked before the persisted command is executed through ED-07. Replays use that command's receipt. A presenter handoff or state change makes an unaccepted proposal stale. No AI result mutates a room automatically.

## Legacy activity inventory and migration

Runtime code no longer reads `learning_activities`. Do not copy legacy documents into `activity_records`: that would invent reviewed definition/evaluation/source identity. No deployment inventory or migration was performed.

A separately authorized migration must inventory and back up both collections on the intended target, export IDs/counts/hashes, and classify each legacy reference. For a migratable record, an instructor must recover verified original bytes, prepare the exact revision artifact, review a canonical public definition and private evaluation and register through the normal API. Publish a new reviewed revision rather than modifying committed history. Repoint only explicitly reviewed room/course references using sequence-checked commands. Repeating registration with the same definition is idempotent; conflicting identities fail. Keep old records and an old-to-new mapping until independent verification and restore rehearsal. Do not delete, bulk rewrite, infer missing provenance or auto-backfill old published records.

## Local verification

Infrastructure is isolated synthetic PostgreSQL on 5433 and the mission-owned RabbitMQ on 5678. Existing environments and credentials are not replaced. The browser harness starts real Nest, Next, Better Auth, local FastAPI and a RabbitMQ ingestion worker, and uses a deterministic local embedding fixture. No paid model calls or model downloads are required.

```sh
P0R2_PYTHON=/path/to/locked/python3.12 \
  pnpm --filter api exec tsx --tsconfig tsconfig.json \
  ../../apps/web/e2e/p0r3-integrated-learning.test.ts

pnpm --filter api exec tsx --tsconfig tsconfig.json --test \
  tests/integration/p0r3-learning-rooms.node.test.ts
```

The browser deliberately paces five users sharing loopback to retain the existing IP rate limits. Its evidence records actual UI, HTTP, WebSocket and persistence results. It uses its own database and storage directory and removes them in teardown. It must not run concurrently with another ingestion worker on the same queue: provide a dedicated broker. See the mission verification report for exact executed commands, results and operational limitations.

## Remaining operational gates

Single-process realtime delivery remains the deployment assumption. This mission does not certify distributed fanout, crash/redelivery/DLQ recovery, PDF/OCR or embedding model quality, current Docker images, backups/restores, production indexes, real inference, owner approvals or remote CI. Do not infer production readiness from local integration checks.

Final mission additions use the existing application: private source support in
the learner workspace, deterministic evidence-based practice selection, instructor
insights at `/instructor-insights`, a binary-search worked example at `/visualizer`
and in study rooms, and requester-only room help. Cohort policy unset/invalid means
all instructor counts stay hidden. XP/levels motivate practice and never replace
academic mastery; new awards require matching completed accepted evidence, and
MOCK_TEST inference earns none. See the final-mission verification reports for
executed scope and limits.

For concurrent synthetic browser/source acceptance runs, use a dedicated RabbitMQ
virtual host per runner. The browser honors `P0R3_BROKER_URL`; source tests honor
`P0R2_BROKER_URL`. A virtual host is a test-isolation boundary, not a production
queue migration. Keep separate evidence directories and disposable frontend
source copies. Four loopback learners share the real HTTP limiter, so the harness
paces join and probe batches instead of disabling rate limits.

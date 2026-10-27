# EdNova P0-R2 — immutable sources and trusted AI verification

24 October 2026, Africa/Tunis. Execution logs use UTC and begin on 23 October.

## A. Executive summary

**P0-R2 engineering: PASS for the locally verified, provisional source foundation.** Source-backed publication now requires verified original bytes and an exact revision-specific FAISS artifact. Old published originals survive mutable upload replacement/deletion. Explicit revision requests never silently advance. Draft edits use conditional version updates; publication uses a recoverable preparation/pointer/completion protocol suitable for standalone Mongo.

Tutor retrieval verifies the requested artifact and actual document/page/chunk/text identity. The unsupported inference argument is removed. Node rejects malformed, fabricated or mismatched Python responses and returns an explicit browser projection without service-only grounding objects. Revoked actors cannot receive protected delayed results. Provider configuration and synthetic keys do not imply approved execution. Studio constructs explicitly provisional quotation-completion candidates from real extracted passages, retains private grading keys and requires instructor review/registration.

This is not approval of the entire product, full model quality or a deployed image. Live externally hosted compact/capable calls were **NOT RUN**, no paid calls were authorized, and no heavyweight model was downloaded. Real local integration uses a test-owned deterministic embedding fixture and `MOCK_TEST` inference with actual FastAPI, FAISS, Mongo, RabbitMQ workers and Nest authentication.

Evidence: [mission directory](evidence/ednova-p0-r2/), [real source integration test](../apps/api/tests/integration/p0r2-source-ai.node.test.ts), [operational/migration procedure](../docs/runbooks/ednova-revision-sources.md). P0-R3 and M24–M38 were not started.

## B. Finding closure matrix

| Finding | Correction and principal files | Independent verification | Classification |
|---|---|---|---|
| F03 — explicit resolution / publication races | `coursePublication.ts`, `courseDraft.ts`, `CourseRevision.ts`: distinct latest-pointer versus exact-tag lookup; no ObjectId alias or fallback; conditional draft update; prepared publication and compare-and-set active pointer; internal `revokedAt` | Real Mongo unknown/empty/foreign pin rejection, old deprecated pin after new publication, revoked pin denial; concurrent edits; two competing activations with exactly one winner; interruption after pointer write and same-command recovery | **FIXED** for tested foundation |
| F04 — mutable sources / missing readiness | New `revisionSources.ts`; upload staging and versioned downloads in `routes/courses.ts`; immutable original blobs, manifest digest, FAISS and sidecar checksums; publication cannot activate without readiness | Real byte mismatch/missing original/missing index/sidecar corruption denied; source replacement and deletion preserve old published bytes; real upload/worker/index/prepare/publish sequence | **FIXED** for verified storage boundary; legacy migration and deployment certification remain external operations |
| F10 — tutor call/citation/output integrity | Python `agents/tutor/grounding.py`, Node `tutorGrounding.ts`, strict tutor router: supported shared inference interface, exact evidence identity, strict structured transport and public projection | Real Nest → local Python tutor/restart; PDF page provenance; fabricated page/document/chunk, stale pin and malformed/extra service-only output rejected; delayed membership revocation denies delivery | **FIXED** for local deterministic/strict boundary; live model quality unverified |
| F11 — false provider approval | `utils/llm_client.py`: separate credentials/configuration/approval/execution state; explicit expiring task/model/request approval; no automatic provider fallback/retry; response identity and revocation checks | Missing/synthetic keys, absent/expired/revoked approval, mock/fallback, simulated timeout/empty/foreign-model responses and budget exhaustion; configuration alone stays UNAVAILABLE | **PARTIAL** for full canonical provider acceptance: local defect repaired, actual authorized compact/capable calls NOT RUN; durable deployment-wide budgeting unverified |
| F12 — fabricated Studio templates | `courseStudio.ts`: actual verified source passages, truthful nullable page identity, quotation-derived expected answer, both supported activity types, explicit review requirement and current draft/grant checks | Real authenticated generation/registration of quiz and GuidedProblem; missing readiness, unsupported type, forged source fields and stale draft reject; instructor revoked during held artifact read denied; no automatic persistence or publication | **FIXED** for bounded offline source-derived candidates; general conceptual model generation unavailable |

“FIXED” describes the reproduced finding and tested implementation, not full acceptance of M04/M05/M06/M08/M09 or official ED-26 approval. F11's external acceptance is deliberately separate from local engineering PASS.

## C. Revision publication

The exact resolver requires `(courseId, revisionTag)`, committed activation and permitted lifecycle. With no explicit revision it uses the course's active pointer only. Unknown/empty/foreign explicit revisions do not substitute the active revision. Drafts and revoked records do not resolve as published. Deprecated committed history remains readable only with current course access and intact original/index artifacts.

The persisted lifecycle vocabulary remains `draft | published | deprecated`. Revocation uses internal `revokedAt`; no new public status enum was silently introduced. Public `revisionId` remains a course-scoped tag. The shared contract validators and owner ledger remain unchanged.

Draft edits condition on `_id`, exact prior tag, version, draft status and absence of prepared activation. A successful edit changes its tag and invalidates readiness. Competing identical edit commands produce one winner. Reviewed publication snapshots approved public definitions and private evaluation digests.

Publication first validates the complete source artifact, persists a prepared revision with expected prior pointer and artifact hashes, conditionally changes the single course pointer, then marks completion and deprecates the previous committed revision. Two different prepared revisions racing from the same prior pointer yield one winner. A late/stale publisher cannot overwrite a different completed activation. Identical completed commands return the durable publication receipt.

The interruption test injects a failure **after the pointer write but before completion**, retains actual Mongo state, verifies latest resolution is unavailable, and successfully retries the same exact command. This is an injected operation failure, not a process-kill publication test. P0-R1's actual SIGKILL attempt tests remain green. No cross-document transaction is claimed. The protocol can temporarily deny latest reads after interruption; it does not serve a partially committed candidate or an unrelated revision. Losing prepared candidates are retained for explicit operator review; no automatic destructive repair is performed.

## D. FAISS and storage

Originals live under `INGEST_UPLOADS_DIR/originals/<sha256>`. Node verifies actual upload bytes and uses insert-only, read-only content-addressed blobs. Published files do not depend on the mutable `Course.files` array. The authenticated versioned download route resolves the exact revision/document, verifies integrity and rechecks access before delivery. Final review also closed a legacy creator-download bypass by requiring current course access before lookup and delivery; a revoked instructor/creator is denied while personal-owner ACL regressions remain intact. Normal draft editing/upload replacement does not delete old blobs or indexes.

Revision artifacts use:

- Disk: `FAISS_INDEX_DIR/<courseId>/<revisionId>.faiss`.
- Sidecar: `FAISS_INDEX_DIR/<courseId>/<revisionId>.meta.json`.
- Contract reference: `faiss/<courseId>/<revisionId>.faiss`.

The internal v1 manifest binds course, revision, content hash and actual document inventory. The sidecar records original storage reference/type/hash, extracted text, chunk identity/hash, section and nullable page. It binds the actual FAISS checksum; Mongo pins the exact sidecar checksum as well. Node verifies originals, manifest, sidecar/index identities and chunk metadata. Python verifies FAISS shape/count and the exact pair before retrieval. Published retrieval reloads the verified pair rather than trusting a stale process cache. Cache and Mongo embedding queries include revision identity; a course-only legacy index is not treated as a ready revision artifact.

Filesystem commit uses same-directory temporary files, flush/fsync, insert-only links and the sidecar as commit marker. A missing, partial or conflicting pair cannot appear ready. An immutable rebuild conflict requires a new revision. Files are readable by the Node container user; the operator must protect artifact directories from unauthorized writers. This is application-level immutable storage, not a claim of WORM hardware or protection against an operator changing Mongo and both volumes together.

The Python test indexes two courses, two revisions of one course and overlapping text, then starts a separate Python process to verify the same persisted artifact. The real Nest/Python suite stops/restarts the retrieval HTTP process and successfully answers from the same revision. These establish local restart persistence. They do not establish power-loss durability, restored-backup consistency or a current Docker image runtime.

Compose now explicitly shares the named `ednova_revision_faiss` volume: Python HTTP and its separate ingestion worker mount it writable, Node mounts it read-only. The existing uploads volume carries originals. Both Compose configurations validate. No images were rebuilt/deployed for production certification. `/health` remains liveness; exact preparation/verification is the source-readiness gate, not an assertion that all workers/providers are healthy.

Legacy indexes and records are retained. Explicit authorized preparation may reconstruct a draft only from original bytes with a matching recorded hash. Legacy published revisions lacking verifiable provenance fail closed and require reviewed reindexing/migration. Copying a course-only index into a revision directory does not supply provenance. No automatic blob garbage collection was added; retention and backup-aware cleanup need a separately reviewed operation.

## E. Source provenance

The verified path is original bytes → bounded PDF/text extraction → source-linked chunks → embeddings → FAISS + sidecar → exact retrieval → grounding/citation → explicit Node projection.

The new published index path uses **original extracted text**, not LLM-enriched text relabeled as extraction. An ingestion worker with an immutable revision manifest reads those verified originals, not replaced mutable uploads. Original source hashes are distinct from curriculum/revision hashes. A real PDF fixture produces actual page 1; a plain text document has `pageNumber: null`, and no page 1 is invented. Section/chunk IDs and text hashes remain attached through retrieval.

Missing/foreign document metadata, wrong course/revision, unknown chunk identities, invalid digest, altered original and malformed sidecars fail closed. A missing chunk is never assigned to the first authorized document. A citation must match a retrieved authorized document **and** exact page/null-page, chunk and text identity. Page 99999 cannot validate against retrieved page 1. The 201 unchanged shared contract fixtures have identical TypeScript/Python acceptance outcomes.

## F. Tutor and AI provider

The Python tutor uses the shared client's supported agent-routing interface; it no longer passes an unsupported `tier` keyword or hides that programming error with a broad fallback. A local extractive fallback reports `DETERMINISTIC_FALLBACK`; the explicit test responder reports `MOCK_TEST`. Neither reports real external inference.

Python request/result models forbid unknown fields. Node checks the exact internal schema/version, full pin, evidence, citation identity, answer citation markers, execution mode and GroundingContext relationships. Invalid output yields unavailable rather than a warning followed by untrusted delivery. Browser output is assembled field by field and excludes `groundingContext`, `retrievedEvidence`, storage paths and evaluation keys. Tutor source resolution/grants are rechecked immediately before protected delivery. Delayed result tests suspend active institutional membership while the response is held; the final response is HTTP 403.

Real local adversarial HTTP tests reject fabricated page, foreign document, stale revision, missing chunk, malformed citation structures, additional service-only fields and an unavailable result claiming verification. Pure/local Python tests also exercise prompt-injection text without changing grants or course/revision retrieval scope. Citation integrity verifies evidence identity; it is not a proof of arbitrary model reasoning correctness and does not grant learning mastery.

Provider reporting now distinguishes configured routing, credentials present, approval, identity/connectivity verification, successful execution and output validation. A synthetic/placeholder key never triggers `REAL_APPROVED`. Approval requires an expiring operator record for the exact configured task/model and a positive request budget. Shared-client external dispatch is disabled without it. The implementation checks current approval again after a result, verifies nonempty output and matching model identity, and disables automatic router retries/fallbacks that could consume unapproved calls.

Tests simulate the success/failure boundaries entirely locally. A unit assertion of a simulated `REAL_APPROVED` result is **not** evidence of real provider execution. Actual approved compact and capable model calls are **BLOCKED / NOT RUN**: provider/model/credential/task authorization and a maximum cost/request budget were not supplied. No external model request was made by this mission.

The current approval counter is process-local. It is suitable as a fail-closed local gate, not durable global cost accounting across restarts/replicas. External production inference must remain blocked until genuine approval, aggregate durable budgeting and redacted actual execution evidence exist. The [runbook](../docs/runbooks/ednova-revision-sources.md) records the provisional approval configuration and this limitation.

## G. Studio generation

Studio first authenticates/currently authorizes the instructor, resolves the actual draft and verified source artifact, locates the selected objective and reads actual extracted passages. Offline generation constructs a bounded quotation-completion candidate whose expected missing word is present exactly once in that source. Distractors come from that same passage; no option is labeled “Correct principle.” Both `InteractiveQuiz` and `GuidedProblem` use the canonical public activity/evaluation validators.

These are explicitly `DETERMINISTIC_FALLBACK`, `reviewRequired: true` candidates. They are not claimed to measure an arbitrary conceptual objective or to be a real model-generated problem. If a reliable quotation-derived answer cannot be constructed, Studio returns unavailable and requires instructor authoring. It does not fabricate a document, page or answer key from objective wording.

Private evaluation proposals are returned only to authorized instructors. Learner activity projection has no grading key/rubric. Generation alone creates no ActivityRecord, publication, attempt, evidence or reward. Explicit registration still uses P0-R1's full-pin boundary, and publication snapshots the reviewed definition/evaluation digests.

Tests cover both activity types, source-free/unready generation, unsupported type, forged source fields, unknown objective, stale draft, private grading keys and current authority. A held artifact read allows membership to be revoked during generation; the direct service denies the result. The real Nest/Python integration then exercises actual author review/registration/publication and authorized learner retrieval.

## H. Real source-to-learning integration

The dedicated suite uses isolated synthetic Mongo, migrated Better Auth cookie sessions, actual Nest bootstrap, local FastAPI and actual FAISS files. The broker subtest starts a Python ingestion worker against a dedicated synthetic RabbitMQ container and performs:

1. Real authenticated multipart upload of a synthetic text document.
2. Node hashing/capturing original bytes and queuing the exact draft revision.
3. Real broker delivery, worker extraction, deterministic test embedding and revision-specific indexing.
4. Actual result delivery to Node's ingestion tracker; completion populates a draft and cannot activate an unreviewed revision.
5. Instructor review changes the draft tag; explicit preparation builds/verifies the exact matching artifact.
6. Source-derived GuidedProblem generation, explicit registration and readiness-gated publication.
7. Enrolled learner tutor request through Nest → Python; returned citations match the uploaded document and reviewed revision.
8. Source/activity/tutor access denial after institutional revocation.

No handcrafted citation or invented document metadata substitutes for the broker subtest's extraction. Other narrow regression fixtures intentionally materialize real synthetic bytes and a small checked-in FAISS fixture; they are labeled fixture/domain tests, not independent ingestion end-to-end evidence.

The end-to-end broker upload is **plain text**. PDF sandbox/page extraction and provenance are separately exercised with a real generated PDF in Python; a complete real PDF/OCR/broker production pipeline is not certified. The test embedding provider is a deterministic local fixture, not a downloaded sentence-transformer or approved model. Real inference, OCR quality, Docker cold boot, broker crash/redelivery/DLQ disaster recovery and multi-instance behavior remain external operational acceptance work.

## I. Regression and reproducibility

Node 24.20.0/pnpm 11.3.0 and the existing locked Python 3.12.15 environment were used. Installed dependencies were not replaced. Node commands run from repository root; Python commands run from `apps/ai`.

For full root integration, environment:

```text
MONGO_URI=mongodb://127.0.0.1:27018/ednova_p0r2_regression
MONGODB_URI=mongodb://127.0.0.1:27018/ednova_p0r2_regression
P0R2_PYTHON=/home/ashenix/.cache/ednova-m01-xqv2wnr1/python-envs/study-partner-ai-CVSI_pgv-py3.12/bin/python
P0R2_BROKER_URL=amqp://guest:guest@127.0.0.1:5678/
```

Individual real-session tests create/drop their own synthetic databases. Integration scripts set the unreachable local AI default internally; the dedicated source test overrides it for its private local FastAPI process. No external provider is authorized.

Python full regression uses `LLM_MOCK=1`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `LITELLM_LOCAL_MODEL_COST_MAP=True`, `CUDA_VISIBLE_DEVICES=-1`, synthetic `MONGODB_URI`/`DB_NAME=ednova_p0r2_python`, and `PYTHONPATH=../api/tests/helpers/python_guard:.:agents/evaluator/src`. The test-only socket guard denies non-loopback outbound traffic.

| Check | Exit | Actual result | Mission evidence |
|---|---:|---|---|
| P0-R1 focused test **before substantial changes** | 0 | 15/15 nodes | `p0r1-before.log` |
| `pnpm generate:contracts` | 0 | Canonical activities retained; source prepare/download operations generated | `generate-contracts-verified.log` |
| Disposable source generation, twice | 0, 0 | Zero adapter drift, no environment files copied | `contracts-disposable.json` |
| `pnpm lint` | 0 | Zero errors; 132 warnings | `lint-release-check.log` |
| `pnpm typecheck` | 0 | API/web strict checks | `typecheck-release-check.log` |
| `pnpm test` | 0 | 6 route nodes; 732 Jest tests/56 suites; 10 Node unit nodes; **253 integration nodes**; 17 Better Auth nodes; 47 web tests/7 files. No skipped Node tests | `test-release-check.log` |
| `pnpm build` | 0 | API TypeScript and web production builds | `build-completion.log` |
| P0-R1 + source foundation focused run | 0 | 25/25 nodes at that checkpoint | `focused-final.log` |
| Latest source foundation suite | 0 | 11/11 nodes, real broker enabled; strict Studio/source-generation checks included | `source-completion.log` |
| Full offline Python `python -m pytest -q -ra` | 0 | **1065 passed, 5 skipped**, 60 warnings | `python-final-verified.log` |
| Provider/client/shared-contract focused completion | 0 | 235 tests: local simulated provider and strict contract regression | `provider-contract-completion.log` |
| `python -m contracts.export_ednova_schema --check` | 0 | No exported JSON Schema drift | `schema-drift.log` |
| TypeScript/Python fixture differential | 0 | 201 fixtures; zero differences or incorrect acceptances | `contract-parity.json` |
| `python -m pip check` | 0 | Dependency consistency | `pip-check.log` |
| `pnpm test:e2e` with isolated Next/Nest launcher | 0 | 8 Chromium auth/workspace/smoke tests | `browser-auth.log` |
| Compose Node/AI `config --quiet` | 0, 0 | Configuration syntax validates, no deployment | `compose-node.log`, `compose-ai.log` |

Node totals include parent containers; focused counts are subsets/checkpoints, not extra independent tests to add to the full count. The final root run was restarted after the user interruption because the interrupted log had no completion exit code. Earlier failures and incomplete logs are preserved, not substituted for final acceptance.

Python skips: one legacy scheduler/database test requires a seeded course; four legacy workflow tests lack their expected PDF fixtures. The new PDF, retrieval, real broker and Nest/Python gates actually executed. No live provider test is relabeled as skipped-and-passed.

Regressions corrected include the actual Node→Python optional `files[].fileHash` mismatch, upload staging across configured volume roots, ingestion writing only the exact unprepared draft instead of activating it, and stale source fixtures. Old tests that expected fabricated page metadata, a fixed `opt_1` answer or service-only context in browser output now assert the stricter truthful behavior. Security checks were not loosened. The final legacy-download ACL correction additionally passes 649 API unit tests and the combined M02/P0-R1/P0-R2 real integration run (`acl-unit.log`, `acl-integration.log`); the complete root suite was then rerun. P0-R1's actor/course/full-pin authorization, deterministic wrong-answer denial, durable duplicate receipts, actual SIGKILL recovery, result privacy, room replay/presenter checks and M02 file/job ACL tests remain green.

CI adds a source-foundation job with locked Python setup, full offline Python/schema checks, real Mongo/RabbitMQ/Nest/Python tests and adapter drift. Existing jobs remain. **No remote Actions execution was observed**; the local evidence is the acceptance claim.

## J. Preservation

Initial branch `main`, HEAD `5fb70a095da8f8cf429aed2e4f4bf72ce096e927`, no staged changes. [baseline.txt](evidence/ednova-p0-r2/baseline.txt) records every requested Git inventory command. [baseline-hashes.json](evidence/ednova-p0-r2/baseline-hashes.json) and `before/` preserve **883** initial source/document files, including existing dirty tracked/untracked P0-R1 work.

[mission-files.json](evidence/ednova-p0-r2/mission-files.json) lists the precise P0-R2 delta and hashes; `mission.patch` is a reviewable delta even for files already untracked at entry. [preservation.json](evidence/ednova-p0-r2/preservation.json) verifies retained initial files, unchanged unrelated work, official contract validators/fixtures/schema, approvals and historical reports. No reset, clean, stash, restore, stage, commit or push command was used. Environment secrets and installed dependencies were not edited. Any Next-generated configuration change is checked against the baseline.

Only isolated synthetic data and mission test infrastructure were used. The mission-owned RabbitMQ container is removed after verification; existing Mongo/Mailpit test containers are returned to their initial stopped state without volume deletion. Other projects' services are untouched. No production database, deployment migration or real-user mutation was performed.

## K. Separate readiness verdicts

| Gate | Classification |
|---|---|
| P0-R2 engineering | **PASS — locally verified provisional immutable-source/grounding foundation; unsupported paths fail closed** |
| ED-26 governance | **NOT FROZEN — 0/19 genuine decisions, 0/5 linked confirmations** |
| P0 functional acceptance | **NOT READY — integrated learner journeys and remaining trust/operational gates remain** |
| Production deployment | **NOT READY — no current-image/restore/failover certification or approved live inference** |

The official ledger remains unchanged. No Habib/Tasnim/Aziz approval was invented. New internal artifact/transport/approval fields and the source-preparation operation are explicitly provisional; they are not an official contract freeze. Changed implementation artifacts require a genuine owner-reviewed hash refresh before acceptance, not silent ledger edits.

## L. P0-R3 dependencies

P0-R3 should integrate the existing safe foundations into the actual learner experience: canonical room activity selection/replay using ActivityRecord (F13), intent/diagnostic/solo renderer/tutor journeys, private checks/debrief and recipient-only feedback (F14). Instructor UI must explicitly prepare the exact reviewed source revision before publication and handle unavailable/conflict states. General conceptual generation must remain unavailable until a reviewed source-backed evaluator/provider path exists; quotation candidates are not a substitute for an adaptive diagnostic.

Independent gates remain: genuine ED-26 decisions and provisional semantics/hash review; approved bounded real compact/capable inference; durable aggregate provider budgeting; authorized legacy migration/reindex inventory; real embeddings and PDF/OCR operational quality; source/index/worker readiness monitoring; backup/restore and image/container/broker failure recovery; distributed fanout; full product browser journeys and remote CI evidence. This mission does not close F13/F14/F15/F17 or certify full F16 release readiness.

Work stops after P0-R2.

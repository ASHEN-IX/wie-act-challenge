# EdNova current test coverage — 27 October 2026

Evidence is local to this dirty working tree at HEAD
`5fb70a095da8f8cf429aed2e4f4bf72ce096e927`. The
[source manifest](evidence/ednova-execution-20261027/source-ocr-final.json) identifies
authored bytes; reports and ignored environment/data files are excluded from its
digest. No result below certifies the full task or all T01–T38 scenarios.

| Executed command | Observed result | Evidence / dependency scope |
|---|---|---|
| `pnpm install --frozen-lockfile` | Exit 0, existing installation up to date | [install.log](evidence/ednova-execution-20261027/install.log); not a cold empty-host install |
| `pnpm lint` | Exit 0, API 131 historical warnings, zero errors; web passes | [ocr-lint.log](evidence/ednova-execution-20261027/ocr-lint.log) |
| `pnpm typecheck` | Exit 0, API strict and Next types | [ocr-final-typecheck.log](evidence/ednova-execution-20261027/ocr-final-typecheck.log) |
| `P0R2_PYTHON=<locked interpreter> P0R2_BROKER_URL=amqp://guest:guest@127.0.0.1:5678/ pnpm test` | Exit 0: 6 route nodes; 732 Jest tests / 56 suites; 10 Node unit nodes; 264 integration nodes; 17 auth nodes; 47 web tests / 7 files. No Node skips | [node-ocr-current.log](evidence/ednova-execution-20261027/node-ocr-current.log); real isolated Mongo/auth and opt-in Python/broker source path; provider calls blocked or simulated |
| `pnpm build` | Exit 0, API and Next production builds | [build-ocr-current.log](evidence/ednova-execution-20261027/build-ocr-current.log) |
| `AUTH_E2E_WEB_PORT=5192 AUTH_E2E_API_PORT=3192 pnpm test:e2e` | Exit 0, 8 Chromium tests | [browser-auth-isolated.log](evidence/ednova-execution-20261027/browser-auth-isolated.log); real Nest/Next/Mongo/Mailpit |
| Full locked Python `python -m pytest -q` | Exit 0, 1082 passed, 5 existing skips, 53 warnings | [python-ocr-final.log](evidence/ednova-execution-20261027/python-ocr-final.log); mock inference, offline model downloads, isolated Mongo |
| `python -m contracts.export_ednova_schema --check` | Exit 0 | Structural Pydantic JSON-schema parity; no owner freeze |
| `pnpm generate:contracts` plus pre/post SHA-256 comparison | Exit 0; 7 adapter files byte-identical | [generator-parity.json](evidence/ednova-execution-20261027/generator-parity.json) |
| `node scripts/check-compose.mjs` | Exit 0 | [compose-check.log](evidence/ednova-execution-20261027/compose-check.log); config checks are not runtime evidence |
| `node scripts/test-dev-setup.mjs` | Exit 0 | Shared generated config, quoted values and preservation of existing env files; no production data |
| `docker build -t ednova-audit-ai:nonroot -f apps/ai/Dockerfile apps/ai` | Exit 0, locked main dependencies | [image build](evidence/ednova-execution-20261027/image-ocr-final-build.log) |
| `docker run --rm --network none -e LLM_MOCK=1 ednova-audit-ai:nonroot python -m pip check` | Exit 0, no broken requirements | [image-ocr-pip-check.log](evidence/ednova-execution-20261027/image-ocr-pip-check.log) |
| `node scripts/verify-ai-container.mjs ednova-audit-ai:nonroot` | Exit 0, 4 actual runtime checkpoints | [runtime log](evidence/ednova-execution-20261027/nonroot-ocr-current.log) |
| `node scripts/verify-worker-recovery.mjs ednova-audit-ai:nonroot` | Exit 0, actual worker and service kills, redelivery, retry/DLQ | [recovery log](evidence/ednova-execution-20261027/worker-recovery-ocr-current.log); synthetic handler, real transport |
| `node scripts/verify-source-restore.mjs ednova-audit-ai:nonroot` | Exit 0, actual Mongo/file restore and corruption negative | [restore log](evidence/ednova-execution-20261027/source-restore-ocr-current.log); stopped-writer synthetic metadata/source fixture |
| Integrated browser harness with `P0R3_SOURCE_PDF=1`, locked `P0R2_PYTHON`, `.next-e2e` and explicit evidence directory | Exit 0, 8 recorded A–E checkpoints | [browser log](evidence/ednova-execution-20261027/integrated-pdf.log), [asserted checkpoints](evidence/ednova-execution-20261027/integrated-pdf/browser-checks.json); real PDF/broker/worker/Nest/Next, deterministic embeddings/mock inference |


| Source integration with locked Python and real broker | Exit 0, 14 test nodes; image-only PDF confidence/page flow plus source preservation | [source-ocr-current.log](evidence/ednova-execution-20261027/source-ocr-current.log); actual OCR, deterministic inference/embeddings |
| `P0R3_FOUR_LEARNERS=1 P0R3_SOURCE_PDF=1 ... node scripts/run-integrated-browser.mjs` | Exit 0, all 8 A–E checkpoints with four learner browser contexts | [four-learner-resumed.log](evidence/ednova-execution-20261027/four-learner-resumed.log); real services, native-text PDF, deterministic inference/embeddings; [checkpoints](evidence/ednova-execution-20261027/four-learner-resumed/browser-checks.json) |


| `P0R3_SOURCE_SCANNED=1 ... node scripts/run-integrated-browser.mjs` | Exit 0, 9 A–E checkpoints; actual image-only OCR, visible Studio confidence warning and two-learner shared flow | [scanned-browser-current.log](evidence/ednova-execution-20261027/scanned-browser-current.log); real services/OCR, deterministic embeddings/inference; [checkpoints](evidence/ednova-execution-20261027/scanned-browser-current/browser-checks.json) |

Python's five skips are **four absent manual PDF fixtures** and **one manually
seeded scheduler/Mongo integration case**. They are not five successful PDF tests.
The real generated PDF suite and browser run are separate evidence. Historical
warnings and skipped fixture paths remain visible in the logs.

The current Python run additionally sets
`P0_DATABASE_TEST_MONGODB_URI=mongodb://127.0.0.1:27018` to execute the new real
same-endpoint outage/recovery test. The complete Python command uses
`LLM_MOCK=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 LITELLM_LOCAL_MODEL_COST_MAP=True`,
the isolated `ednova_execution_python` Mongo database,
`P0_BUDGET_TEST_MONGODB_URI=mongodb://127.0.0.1:27018`, and
`PYTHONPATH=../api/tests/helpers/python_guard:.:agents/evaluator/src`, from `apps/ai`.
The interpreter is the locked 3.12 executable recorded in source verification.

The initial sandbox Node run failed because tsx could not open its IPC socket;
the unrestricted rerun exposed the real M02 upload-directory fixture failure.
The fixed current-source suite passes. Lint initially found two coach-test blank
lines; these were formatted. A new source regression initially failed strict
typing because a filename was optional; its fixture now asserts presence. The
first browser command refused the already occupied development port; isolated
ports/output fix that conflict. Failed/incomplete logs are retained separately.
Operational-runner failures are described in [recovery](EDNOVA-OPERATIONAL-RECOVERY.md).

CI now includes image runtime, recovery, restore, four-learner PDF and scanned-PDF browser checks; no remote current-source
CI execution was independently observed, and no commit was pushed. Complete
atomic acceptance, approved real inference, approved OCR quality/scope, full multilingual/accessibility,
real media and remaining product journeys are still unverified or unimplemented.

## Final implementation mission checkpoint

Current final-mission source passes root lint/types/build and the complete Node
suite with **316 integration nodes, zero skips**,732 Jest tests/56 suites,
6 route nodes,10 Node unit nodes,17 auth nodes and58 web tests/10 files. Full
locked offline Python passes **1083 tests, five existing skips,53 warnings**.
The isolated auth/workspace browser passes8 tests. Exact commands, failed attempts,
new fault/security checks and unfinished browser/product gates are recorded in
[the final continuation report](EDNOVA-FINAL-COMPLETION-REPORT.md). Evidence is under
`reports/evidence/ednova-final-20261027/`; earlier counts above remain historical
checkpoints, not silent certification of changed source.

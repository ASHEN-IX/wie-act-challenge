# Executed validation — 18 October 2026

Baseline Git HEAD: `4480d23ef38757a6fe20c4008cf6a863bedf7c8c`. Runtime code and dependencies were not modified. These are results of this audit, not inherited migration claims. Node 24.22.0, pnpm 11.3.0, Docker 29.9.1; host default Python 3.15.0 is outside project support. A temporary Python 3.14.8 environment was created under `/tmp/ednova-audit-venv` for selected tests.

## Commands and outcomes

| Executed command (root unless noted) | Result | Evidence / limits |
|---|---|---|
| `pnpm install --frozen-lockfile` | PASS, exit 0 | All 11 workspace projects installed, frozen lockfile unchanged; no package upgrade |
| `pnpm lint` | FAIL, exit 1 | API: 1,743 errors + 118 warnings (1,861 total); includes no-explicit-any, require-import and formatting findings. Baseline, not documentation regression |
| `pnpm --filter study-partner-web lint` | PASS, exit 0 with warnings | 0 errors, 25 warnings (hooks/unused variables); standalone run because root failure does not certify other package |
| `pnpm typecheck` | FAIL, exit 2 in API | 156 TS error diagnostics, including Node16 import extensions and implicit/never types in tests/fixtures |
| `pnpm --filter study-partner-web typecheck` | PASS, exit 0 | `tsc --noEmit`; after Next generated route types during attempted build |
| `pnpm build` | FAIL overall, exit 1 | API `tsc` completed; Next webpack compiled but page/config collection failed on `/admin` and `/competency`: `ES Modules may not assign module.exports or exports.*` |
| `pnpm --filter study-partner-web test` | PASS, exit 0 | 35 files passed, 2 skipped; **159 tests passed, 8 skipped** |
| `pnpm --filter study-partner-api exec jest modules src shared tests/shared tests/architecture --runInBand` | FAIL, exit 1 | **44 suites passed, 2 failed; 428 tests passed, 20 failed**. This selection is not every API test |
| `pnpm test:infra:up` | PASS, exit 0 | Created only dedicated mindflow-tests Mongo (27018) and Mailpit (1026/8026); no unrelated containers changed |
| `pnpm test:integration` | FAIL, exit 1 | **6 suites passed, 1 failed, 1 skipped; 52 tests passed, 1 failed, 4 skipped** |
| `pnpm test:auth` | FAIL, exit 1 after termination of hung Nest child | **13 lifecycle tests passed; 1 Nest test-file failure**. Nest startup rejected route syntax; child held handles and was explicitly SIGTERM'd after ~590s. Not a complete auth regression pass |
| `pnpm test:e2e` | FAIL, exit 1 before browser tests | Configured API webServer could not start: same unsupported route; **no browser tests executed** |
| `python -m pytest --version` (host) | BLOCKED, exit 1 | Host Python has no pytest and is outside declared <3.15 support; no claim of full Poetry suite execution |
| Temporary compatible environment; selected Python tests | See focused Python record below | Lightweight dependency subset; not locked full Poetry/ML environment or real inference |
| AST parse of every initially tracked `.py` file | PASS, exit 0 | 271 files, 0 syntax errors; syntax only, no import/runtime verification |
| `pdftotext -layout` official PDF | No extractable text | Scanned PDF; rendered all 3 pages with pdftoppm, OCR with tesseract and visually checked instead |
| `pnpm test:infra:down` | PASS, exit 0 | Stopped/removed only test containers/network created here; no volume deletion or production-data operation |
| `git diff --check` | PASS, exit 0 | Whitespace check for tracked diff; final new Markdown checked as well |

Detailed command outputs were captured during the run under `/tmp/ednova-*.log` on the task host; temporary logs/environments are not committed project dependencies. This summary preserves results independently of their lifetime.

## Failure details and limits

- API competency updater unit fixtures do not supply `EvalResultRecord.findOneAndUpdate` expected by lease-based processing; several cases fail with TypeError. Coach tests receive 403 where older fixtures expect accepted/payload/error responses. This needs reconciliation with current entitlements/ownership policy; do not weaken security simply to restore old expectations.
- Integration `tests/integration/bloom-loop.integration.test.ts` expects replay skip `already_processed` but receives `already_processing`. Inspect lease/processed-state semantics before deciding code versus fixture repair. Test showed replay-state mismatch; it is not proof of duplicate learning evidence.
- Auth/E2E startup rejects `/api/v1/study/plans/:planId([0-9a-fA-F]{24})` under installed path-to-regexp/Nest. `pnpm test:auth` compiled API successfully before startup failed. No successful running-app/session/voice demonstration is claimed.
- Root API build uses `tsconfig.json` scoped to shell source, while strict check includes broader files/tests. API build success cannot override failing strict diagnostics.
- `RUN_AI_ROUNDTRIP=1` was not enabled and no dedicated RabbitMQ was provisioned. Four broker roundtrip cases were skipped; source files containing other passing cases may still be labeled PASS by Jest. Passing stub contract tests would not prove real model inference anyway.
- Python full Poetry/ML/RAG/integration/real-service suite was not run: Poetry is absent, host default version is unsupported, and full pinned heavy model/service dependencies were not provisioned. Focused temporary tests have explicit scope below. No credentials, model quotas or real organizer inference were used.
- Browser/media checks (microphone denial, reconnect, multi-peer audio, TURN/NAT) could not be reached because server startup failed; voice remains unverified reuse.
- Docker production image builds/deployment were not run: frontend production build already fails and Python Docker/Poetry dependency parity is unresolved. Compose config/source review is not runtime certification.
- Root CI AI job references missing `study-partner-ai/requirements.txt` and `tests/test_url_validator.py`; actual SSRF tests are under `tests/test_search_ssrf.py`. Nested AI workflow is not active as a root workflow. This is retained repair work, not a removed safety check.

## Focused Python record

Environment bootstrap: `uv venv --python /usr/bin/python3.14 /tmp/ednova-audit-venv`, then `uv pip install --python /tmp/ednova-audit-venv/bin/python pytest pytest-asyncio pyyaml pydantic aio-pika redis python-dotenv`. These are temporary test dependencies; manifests/lockfiles are unchanged.

Initial run from `study-partner-ai`: `/tmp/ednova-audit-venv/bin/python -m pytest tests/test_base_worker.py tests/test_session_store.py tests/test_llm_client.py -q`: **26 passed, 2 failed**. The temporary environment lacked installed LiteLLM; the local `litellm/` config directory was importable as a namespace without `Router`. This is an environment limitation, not established production failure. A broader lightweight core run from the same directory then executed `/tmp/ednova-audit-venv/bin/python -m pytest tests/test_base_worker.py tests/test_session_store.py tests/test_ai_envelope_contract.py tests/test_topology_parity.py tests/test_prompt_guard.py -q`: **60 passed, 5 Pydantic deprecation warnings, exit 0**. This covers worker/state, envelope/topology parity and prompt guards; it does not require real inference. Installing `litellm>=1.40,<2` into that temporary environment subsequently completed after a slow 35 MB download (exit 0). The initial two dependency-limited failures are retained here for transparency; the focused LLM-client rerun is recorded below. No project dependency was changed.

## Documentation and scope verification

The final audit checks local Markdown file destinations, active task uniqueness/dependencies/statuses, all 19 feature contracts, 12 workflows, organizer numeric limits/rules, byte identity of source copies, no runtime/dependency/API/auth/schema changes and the complete tracked/new-file diff. Final outcomes are recorded below. Generated `study-partner-web/next-env.d.ts` changes from Next were restored to the original bytes; they are not part of the audit change. The initial untracked `.serena/` directory is excluded from the change set.

No new product feature, test mock replacement, architecture migration or deployment occurred. Documentation cleanup introduces no runtime behavior change, but **current functionality is not certified regression-free** because pre-existing checks fail. ED-01/ED-02 remain P0 blockers.

## Final documentation checks

- Local Markdown destination checker: **49 Markdown files, 0 missing local file destinations** (code fences and external/self-anchor URLs excluded). This is not remote URL or all historical anchor validation.
- Backlog consistency: **26 unique task IDs**, all maintained task references resolve, dependency order reviewed; all 19 functional contracts and 12 numbered workflows present.
- Inventory: **866 baseline tracked paths**, one row each; per-path inventory is not a claim every path was individually executed.
- Historical backlog/tracker original bodies match Git HEAD exactly after archival banners; history was consolidated, not discarded.
- Reference brief/PDF byte identity verified against Downloads inputs. SHA-256: brief `4b813e1b2e37ce792676b0ebb597b853b64125819d6b2c952d2f921f399c1439`; PDF `5154b0565d520129b4e73f28a5c7e0741d1885c8c8cda2f633c253fbfcd53152`.
- Tracked changes are exclusively Markdown; new files are Markdown, source PDF and baseline TSV inventory. No manifest, lockfile, runtime source, test or config modification remains.
- Full change set checked by file scope and content diff; large historical removals matched exact archival copies. Existing imports/scripts have no removed runtime targets to resolve. No new functionality or auth/API behavior changes.
- `git diff --check` passed. Dedicated test services were stopped/removed; unrelated containers were left running. Initial untracked `.serena/` was left outside the documentation change set.

## Completed LLM-client rerun

After installing LiteLLM **1.106.0** into the temporary Python 3.14 environment, executed from `study-partner-ai`: `/tmp/ednova-audit-venv/bin/python -m pytest tests/test_llm_client.py -q` -> **15 passed, exit 0**. Both previously dependency-limited Router tests passed. Alongside the separate 60-test core selection, **75 distinct focused Python tests passed**. These use mocked/patched inference and configuration tests; they do not prove real provider or organizer service availability, full pinned-environment parity or pedagogical quality.

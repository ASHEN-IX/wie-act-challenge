# EdNova M04-A.2 parity and migration readiness — 23 October 2026

**Final state for this pass: M04-A.2 PASS for its defined parity and synthetic-migration scope. M04-A.1 reclassified PASS for its implemented invitation-reliability scope. M04-A / ED-04 remains PARTIAL. ED-26 remains PARTIAL. Candidate `1.0.0` remains NOT FROZEN. No production migration was applied.**

This pass closed the two gates that had kept M04-A.1 PARTIAL: the locked Python 3.12 contract suite and schema-export drift check. It also re-ran the TypeScript contract suite, the existing 6,899-case differential harness, the M04-A.1 invitation integration suite and a new isolated MongoDB migration-readiness suite. A real migration defect was found in the first synthetic run and fixed before the final run. No enrollment, source-grant, contract-approval or freeze work was added.

## 1. Scope and result

Completed in this pass:

- locked Python contract suite under Python `3.12.15` / Pydantic `2.12.5`;
- schema-export drift check;
- TypeScript contract suite;
- current-checkout TypeScript/Python differential parity, including Unicode timestamp cases;
- isolated synthetic MongoDB migration dry-run, apply, repeat, conflict and preservation tests;
- operator CLI dry-run and apply against synthetic MongoDB only;
- API typecheck and lint;
- existing M04-A.1 invitation reliability regression.

Not done, deliberately:

- no deployment database was migrated;
- no course enrollment, course-scoped instructor assignment or institutional source grant was implemented;
- no ED-04/ED-26 completion claim was made;
- no contract approval or `v1.0.0` freeze was invented;
- no M04-B, M05 or downstream mission was started.

## 2. Repository and environment state

Repository: `/home/ashenix/Projects/mindflow`
Branch: `main`
HEAD: `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`

The pre-existing dirty tree was preserved. At mission start it had **247 porcelain entries: 186 tracked modifications and 61 untracked entries**, with **0 staged**. At the end of this pass it has **248 entries: 186 tracked modifications and 62 untracked entries**, still with **0 staged**. The one added porcelain entry is the new M04-A.2 migration regression test. The new report, the M04-A.1 addendum and the mission-gate update are inside the already-untracked `reports/` directory. Nothing was reset, cleaned, stashed, staged, committed, pushed, published or deployed.

Final status snapshot: `reports/evidence/ednova-m04a2-2026-10-23/final-git-summary.txt` and `final-git-status.txt`.

### Environment discovery

- Host default Python: `3.14.8`.
- A host `/home/ashenix/.local/bin/python3.12` exists (`3.12.15`) but has neither Pydantic nor pytest; it is not a usable project environment.
- Poetry is not installed/available in this shell; no locked Poetry virtualenv was usable.
- Docker daemon/context remained `default`; commands used `DOCKER_HOST=unix:///var/run/docker.sock` explicitly and did not change the global context.
- Selected image: `ednova-m02-ai:verification`, image ID `sha256:918aee4d6b2233368bdcf3bc59e54bab85c133535bd2e0d69b291820f939e3b3`.
- Image runtime: Python `3.12.15`, Pydantic `2.12.5`, `/opt/venv/bin/python`; pytest is absent.

Raw environment evidence: `reports/evidence/ednova-m04a2-2026-10-23/environment.log`.

### Python tooling selection

Only the test tooling pinned in `apps/ai/poetry.lock` was installed into an ephemeral `/tmp/pt` target inside the existing image. Repository files and the image were not modified. The full CUDA dependency graph was not redownloaded; only the seven pytest/tooling wheels listed below were installed. Versions installed:

- `pytest 9.0.2`
- `pytest-asyncio 1.3.0`
- `pluggy 1.6.0`
- `iniconfig 2.3.0`
- `packaging 26.0`
- `Pygments 2.19.2`
- `typing-extensions 4.15.0`

The checkout was mounted read-only. This is exact-lock contract-test tooling parity, not a full AI runtime validation. No AI provider, AI worker, model, CUDA or inference runtime was exercised.

## 3. Contract parity

### 3.1 Candidate identity

The candidate artifacts remained byte-identical to the reviewed M03 candidate:

| Artifact | SHA-256 |
| --- | --- |
| `docs/contracts/ednova-v1.md` | `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877` |
| `docs/contracts/ednova-v1-fixtures.json` | `b28248c2dd7d25188902b9d6cd462cd061957fa9b6e9634bea91ed2931cbfbec` |
| `docs/contracts/ednova-v1.schema.json` | `e6fdcedd65fc5d073e80f81dee897a78fa329d02a400a90f8df206c6570fccb9` |
| `apps/api/shared/ednova/contracts.ts` | `cc34e662333121fe4ce1b1ea0814f392a619f3781283609a51193193e0c4856b` |
| `apps/ai/contracts/ednova.py` | `80817b3048908af6880050f3add2d2ad6c26843f98610d47d3d3086776d40903` |

Fixture corpus verification: **161 fixtures**, **51 positive**, **110 negative**, **21 contract roots**.

Raw hashes: `reports/evidence/ednova-m04a2-2026-10-23/candidate-sha256.txt`.

### 3.2 Python contract suite — PASS

Command (read-only checkout, ephemeral tooling):

```bash
DOCKER_HOST=unix:///var/run/docker.sock docker run --rm \
  -v "$PWD:/work:ro" \
  -v "/tmp/opencode/ednova-m04a2-pytest-requirements.txt:/tmp/req.txt:ro" \
  -w /work/apps/ai --entrypoint sh ednova-m02-ai:verification -lc '
    /opt/venv/bin/python -m pip install --disable-pip-version-check \
      --no-cache-dir --no-deps --require-hashes --target /tmp/pt -r /tmp/req.txt
    PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=/tmp/pt:. \
      /opt/venv/bin/python -m pytest tests/test_ednova_contracts.py -q -p no:cacheprovider
  '
```

Result: **165 passed** in 0.39s under `Python 3.12.15` / `pydantic 2.12.5`, `pytest 9.0.2`, `pluggy 1.6.0`.

Evidence: `reports/evidence/ednova-m04a2-2026-10-23/python-contract-parity.log`.

### 3.3 Schema export drift — PASS

Command, from `/work/apps/ai` in the same read-only image:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=. \
  /opt/venv/bin/python -m contracts.export_ednova_schema --check
```

Result: exit 0, `schema export drift check: PASS`.

Evidence: `reports/evidence/ednova-m04a2-2026-10-23/python-schema-drift.log`.

### 3.4 TypeScript contract suite — PASS

Command:

```bash
pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand
```

Result: **167 passed / 167 total**, 1 suite passed.

Evidence: `reports/evidence/ednova-m04a2-2026-10-23/typescript-contract-suite.log`.

### 3.5 Differential harness — PASS

The existing 6,899-case harness from M03 was reused with the current checkout. No case count was invented or changed. It covered **21 contract roots**.

Commands:

```bash
# Python side in the verified image, current checkout mounted read-only
PYTHONPATH="$PWD/apps/ai" /opt/venv/bin/python /tmp/opencode/ednova_parity_py.py
PYTHONPATH="$PWD/apps/ai" /opt/venv/bin/python /tmp/opencode/ednova_parity_py_values.py

# TypeScript side with the API-local tsx and API tsconfig
apps/api/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json /tmp/opencode/ednova_parity_ts.ts
apps/api/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json /tmp/opencode/ednova_parity_ts_values.ts

# Deep comparison of outcomes and accepted values
node /tmp/opencode/ednova_parity_compare.js
```

Result:

- cases: **6,899**
- accepted by both: **311**
- rejected by both: **6,588**
- outcome mismatches: **0**
- accepted values checked: **311**
- value mismatches: **0**

Unicode timestamp handling remained covered by the shared fixture/differential corpus and by the existing Python/TypeScript assertions, including the `timestamps require ascii digits` cases.

Evidence: `differential-python.log`, `differential-typescript.log`, `differential-typescript-values.log`, `differential-comparison.log`.

One intermediate TS invocation from the repository root failed because `tsx` is installed under `apps/api`, not the root. The successful command above using the API-local binary is the recorded result.

## 4. Migration readiness

### 4.1 Migration behavior reviewed

Script: `apps/api/scripts/migrate-institution-indexes.ts`.

It targets only `institution_invitations`, detects the obsolete partial unique index `{ institutionId: 1, role: 1 }`, ensures:

- `{ tokenHash: 1 }` unique as `tokenHash_1`;
- `{ institutionId: 1, status: 1, expiresAt: 1 }` as `institutionId_1_status_1_expiresAt_1`.

It is dry-run by default; only `--apply` mutates indexes. It validates duplicate token hashes before creating the unique index, creates required indexes before dropping the obsolete index, never drops unrelated indexes, and reports `mode`, `inspected`, `dropped`, `created` and `retained`.

### 4.2 Defect found and fixed

The first synthetic run exposed a real correctness defect in the pre-fix migration. It decided whether required indexes existed **by name only**. With a non-unique index already named `tokenHash_1`, it treated the required unique index as present, created only the listing index, and dropped the obsolete index. That would leave token hashes non-unique after an apparently successful migration.

Raw pre-fix reproduction: `reports/evidence/ednova-m04a2-2026-10-23/migration-prefix-defect-reproduction.log`. It was produced with a temporary copy of the pre-fix name-only logic; the repository script had already been fixed when the evidence was captured.

Observed pre-fix result:

```json
{
  "dropped": ["institutionId_1_role_1"],
  "created": ["institutionId_1_status_1_expiresAt_1"],
  "tokenUnique": false,
  "oldStillPresent": false
}
```

The migration now verifies the required definition, not just the name: key pattern, uniqueness, and absence of `sparse`, `hidden` or `partialFilterExpression` filters. A same-name or same-key index with an incompatible definition fails closed with an actionable error **before any index is created or dropped**. This preserves the old unique index until an operator repairs the conflicting index. No application runtime code was changed; only the migration script and its tests were changed.

### 4.3 Isolated synthetic MongoDB tests — PASS

MongoDB **7.0.43** was started in a disposable container on an isolated port. Tests covered:

| Scenario | Result |
| --- | --- |
| Obsolete unique role index present | Detected and dropped only on apply |
| Correct new indexes absent | Both required indexes created |
| Dry run | No index or document changes |
| Apply once | Correct indexes present, obsolete index gone |
| Apply twice | `created: []`, `dropped: []`, identical indexes |
| Multiple pending invitations for same institution/role | Allowed after migration |
| Duplicate token hashes | Rejected before any destructive index operation; indexes unchanged |
| Correct new indexes already present | Not recreated; obsolete index dropped |
| Unrelated indexes | Preserved |
| Missing collection/namespace | Created required indexes without a destructive drop |
| Incompatible non-unique `tokenHash_1` | Fails closed; no changes; old unique index retained |

Committed regression test:

```bash
cd apps/api
AI_SERVICE_URL=http://127.0.0.1:1 \
  pnpm exec tsx --tsconfig tsconfig.json --test \
  tests/integration/m04a2-migration-readiness.node.test.ts
```

Result: **6 tests, 6 passed, 0 failed, 0 skipped** (five focused subtests plus the top-level suite).

Evidence: `reports/evidence/ednova-m04a2-2026-10-23/migration-regression-test.log` and `migration-readiness.log`.

### 4.4 Operator CLI behavior — PASS

Against a disposable synthetic database only, the actual CLI was run without `--apply`, then with `--apply`, then again with `--apply`.

- Dry run reported `dropped: ["institutionId_1_role_1"]`, `created: ["tokenHash_1", "institutionId_1_status_1_expiresAt_1"]`, and left all indexes and the document unchanged.
- First apply created both required indexes, dropped only the obsolete index, and preserved `keep_created_desc`.
- Second apply reported `created: []`, `dropped: []`.
- The database was dropped after the test.

Evidence: `reports/evidence/ednova-m04a2-2026-10-23/migration-cli.log`.

**No deployment database was contacted or migrated.**

## 5. Other checks

| Check | Result |
| --- | --- |
| `pnpm --filter api typecheck` | PASS (exit 0) |
| `pnpm --filter api lint` | PASS for errors: 0 errors, 122 warnings |
| Existing M04-A.1 invitation test | PASS: 8/8 |
| New migration readiness test | PASS: 6/6 |
| Python contract suite | PASS: 165/165 |
| TypeScript contract suite | PASS: 167/167 |
| Differential parity | PASS: 6,899 cases, 0 outcome/value mismatches |
| Schema drift | PASS |
| Production migration | NOT RUN — requires separate approved operational action |

The lint warnings are pre-existing `no-console` warnings across API modules and the migration script's operator output; the new test file added no lint errors. No implementation file outside the migration script was changed.

## 6. Limitations

- The Python run used exact-lock test tooling overlaid into the verified image. It does not prove the full AI service/worker runtime, provider integrations, CUDA paths or production container behavior.
- Migration verification is synthetic only. The deployment database still needs a separately approved operational dry run and `--apply`.
- M04-A.1 is PASS only for its implemented invitation-reliability scope. Full ED-04 enrollment, course-scoped instructor assignment and institutional source grants are still absent.
- The duplicate-token validation and conflict detection protect the index upgrade, but they do not add recipient binding to invitations. Duplicate issuance to the same intended recipient remains unresolved because invitations still lack a recipient-binding field.
- ED-26 has no genuine Habib/Tasnim/Aziz approval and no official freeze. Automated parity does not substitute for owner review.

## 7. Changed files

| File | Change |
| --- | --- |
| `apps/api/scripts/migrate-institution-indexes.ts` | Added definition-aware required-index checks and fail-closed conflict handling; pre-existing untracked file modified in place |
| `apps/api/tests/integration/m04a2-migration-readiness.node.test.ts` | New isolated migration regression coverage |
| `reports/EDNOVA-M04A2-PARITY-AND-MIGRATION-READINESS.md` | This report |
| `reports/EDNOVA-M04A1-INVITATION-RELIABILITY-VERIFICATION.md` | Added M04-A.2 reclassification addendum; original evidence preserved |
| `reports/EDNOVA-MISSION-GATES.md` | Updated M04 row and added M04-A.2 closure note; ED-04/ED-26 statuses unchanged |

No contract, Python contract, TypeScript contract, schema, application route/model or enrollment code was changed. Evidence under `reports/evidence/ednova-m04a2-2026-10-23/` is ignored by Git.

## 8. Classification and gates

| Gate | Status |
| --- | --- |
| M04-A.2 Python contract parity | **PASS** |
| M04-A.2 schema export drift | **PASS** |
| M04-A.2 TypeScript contract parity | **PASS** |
| M04-A.2 differential parity | **PASS** |
| M04-A.2 migration synthetic readiness | **PASS** |
| M04-A.2 production migration | **NOT RUN / separately approved operation required** |
| M04-A.1 invitation reliability (implemented scope) | **PASS — reclassified** |
| M04-A / ED-04 | **PARTIAL** |
| ED-26 / candidate `1.0.0` | **PARTIAL / NOT FROZEN** |

M04-A / ED-04 must not be marked DONE: course enrollment, course-scoped instructor assignment and institutional source grants remain unimplemented and gated by ED-26/Contract 03. ED-26 must not be marked DONE or frozen; the required owner decisions are still missing. The M03 candidate ledger and contract hashes were left unchanged.

## 9. Next action

The next action is separate operational and review work, not a new mission:

1. In an approved change window, run the migration dry run against the deployment database, review the reported index set, then run `--apply` only if the dry run shows the expected obsolete index and required indexes.
2. Obtain genuine Habib/Tasnim/Aziz review and freeze decisions for ED-26 before starting enrollment/source-grant work.
3. Do not start M04-B, M05 or any downstream mission from this result.

# EdNova M03 freeze verification — 23 October 2026

**Final state: M03 engineering implementation/parity VERIFIED; ED-26 PARTIAL; v1.0.0 NOT FROZEN; M04/ED-04 NOT STARTED.** No independent reviewer approval is recorded. No freeze was declared. This report distinguishes fresh commands run in this pass from prior M03 evidence.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. The working tree contained 235 changed/untracked paths before this pass and was preserved; no staging, commit, push, publication or deployment occurred. Dates use Africa/Tunis.

## 1. Candidate identity

| Item | Value |
|---|---|
| Candidate version | `1.0.0` |
| Contract roots | 21 |
| Fixtures | 161 (51 positive, 110 negative) |
| Canonical TS | `apps/api/shared/ednova/contracts.ts` |
| Python mirror | `apps/ai/contracts/ednova.py` |
| Shared fixtures | `docs/contracts/ednova-v1-fixtures.json` |
| Schema artifact | `docs/contracts/ednova-v1.schema.json` |

SHA-256 at verification time:

```
287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877  docs/contracts/ednova-v1.md
b28248c2dd7d25188902b9d6cd462cd061957fa9b6e9634bea91ed2931cbfbec  docs/contracts/ednova-v1-fixtures.json
e6fdcedd65fc5d073e80f81dee897a78fa329d02a400a90f8df206c6570fccb9  docs/contracts/ednova-v1.schema.json
cc34e662333121fe4ce1b1ea0814f392a619f3781283609a51193193e0c4856b  apps/api/shared/ednova/contracts.ts
80817b3048908af6880050f3add2d2ad6c26843f98610d47d3d3086776d40903  apps/ai/contracts/ednova.py
1c3a2bc18576f9196d9a2a32b75323c921e3928ba4ef3ef721fe33c665d4983b  apps/api/tests/shared/ednova-contracts.test.ts
40439fc53333e7ac5dea8f77406fb4de952815feb91fe1336cbf4a02ae81ec00  apps/ai/tests/test_ednova_contracts.py
```

These files are still untracked in the pre-existing dirty tree, so the hashes identify the review content, not a commit.

## 2. Fresh verification results

Commands were run from the repository root unless stated otherwise. Node 24.20.0 / pnpm 11.3.0 and the existing locked Python 3.12.15 environment were reused.

| # | Command | Result |
|---|---|---|
| 1 | `pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand` | **Exit 0 — 167 passed, 0 failed** |
| 2 | `cd apps/ai && PYTHONPATH=. <locked-python> -m pytest tests/test_ednova_contracts.py -q` | **Exit 0 — 165 passed, 0 failed** |
| 3 | `env PYTHONPATH=apps/ai <locked-python> -m contracts.export_ednova_schema --check` | **Exit 0 — no schema drift** |
| 4 | `pnpm lint` | **Exit 0 — 0 errors, 120 existing warnings** |
| 5 | `pnpm typecheck` | **Exit 0 — API and web strict checks** |
| 6 | `pnpm build` | **Exit 0 — API and production Next build** |
| 7 | Differential mutation harness (see section 3) | **6,899 cases; 0 accept/reject mismatches; 0 value mismatches** |
| 8 | Fixture census | **161 total; 51 positive; 110 negative; 21 roots** |
| 9 | Trailing-whitespace scan over the seven contract artifacts | **No matches (grep exit 1)** |

Test-count reconciliation:

- TypeScript: 161 fixture cases plus 6 non-fixture cases = 167.
- Python: 161 fixture cases plus 4 non-fixture cases = 165.
- The two counts differ because the suites have different consumer/worker coverage; both execute the same fixture corpus.

The first `pnpm lint` in this pass reported four Prettier errors caused by the newly wrapped TypeScript `time` definition. The definition was formatted, lint was rerun, and the final result above is exit 0. No rule was disabled.

### 2.1 Not rerun / limitations

- **Full root `pnpm test` was not run.** `docker info` exits 1 (no daemon), and no local `mongod` or `redis-server` binary was found. The real room/Mongo/Redis and auth/integration suites cannot run in this environment. Prior M03 full-suite results are historical evidence and are not presented as fresh.
- Browser suites, container health, GPU/media, real broker round trip and external inference were not run; none is needed for the ASCII-digit parity correction.
- The 6,899-case harness is generated mutation evidence. It does not prove behaviour over every possible JSON input and does not test authorization, persistence or concurrency.
- `git diff --check` is not meaningful for the untracked candidate files; a direct trailing-whitespace scan was used instead.

## 3. Differential TS/Python parity evidence

A disposable harness in `/tmp/opencode` generated mutations from every positive fixture: drop a field, replace a field with boundary/type values, and drop or replace list elements, up to four levels deep. It produced **6,899 unique cases** across the 21 roots.

Both parsers were run over the same JSON:

| Result | TypeScript | Python |
|---|---:|---:|
| Accepted | 311 | 311 |
| Rejected | 6,588 | 6,588 |
| Accept/reject mismatches | **0** | **0** |
| Normalized-value mismatches among accepted cases | **0** | **0** |

The harness only compares parser outcomes and parsed values. It does not validate ACL, database existence or identity.

### 3.1 Defect found and fixed

Before the change, Python accepted a timestamp whose year used Arabic-Indic digits:

```text
publishedAt = "٢٠٢٦-10-23T12:00:00.000Z"
```

TypeScript rejected it because ECMAScript `\d` is ASCII-only; Python's `\d` matches Unicode decimal digits. The same latent gap existed in the Python `valid_time` helper and the Pydantic `Time` pattern.

Fix applied together:

1. **Python** (`apps/ai/contracts/ednova.py`): `valid_time` and `Time` now use explicit `[0-9]`.
2. **TypeScript** (`apps/api/shared/ednova/contracts.ts`): time regex now explicitly uses `[0-9]`; behaviour for conforming payloads is unchanged.
3. **Fixture** (`docs/contracts/ednova-v1-fixtures.json`): added negative `non-ascii timestamp digits`.
4. **Tests**: added `timestamps require ascii digits` in TypeScript and `test_timestamps_require_ascii_digits` in Python.
5. **Schema** (`docs/contracts/ednova-v1.schema.json`): regenerated; seven timestamp patterns now spell out `[0-9]`.
6. **Docs** (`docs/contracts/ednova-v1.md`): timestamp rule now states ASCII digits.

After the fix, the full harness was regenerated and rerun: 311 accepted by each parser and zero mismatches. This closes the only confirmed accept/reject divergence found in this pass.

## 4. Contradiction and decision status

The complete evidence table is in the [review package](EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md#4-contradiction-register). Summary:

| Class | Count | Items |
|---|---:|---|
| Resolved engineering defect | 1 | Unicode timestamp digits (C-01) |
| Resolved/document-confirmed | 2 | `att_` sample versus UUID (C-08); roster 10 versus default 6 (C-12) |
| Documented, owner confirmation requested | 5 | C-07, C-09, C-13, C-14, C-15 |
| Open semantic decision | 7 | revision identity (C-02); index reference (C-03); attempt identity (C-04); activity types (C-05); Contract 06 next-step fields (C-06); room pin for source-free rooms (C-10); proposal status/code invariant (C-11) |

The seven open semantic items map to H-2/H-3, T-1/T-2/T-3, A-1/A-2. None was silently changed.

## 5. Freeze conditions

| Condition | Status | Evidence |
|---|---|---|
| 21 canonical roots executable in TS and Python | **MET** | Two validators; shared fixtures |
| TS/Python acceptance and value parity | **MET for recorded corpus** | 161 fixtures; 6,899 mutations; 0 mismatches |
| Schema artifact generated and drift-checked | **MET** | `--check` exit 0 |
| Focused TS/Python tests | **MET** | 167 and 165 passed |
| Lint, typecheck, build | **MET** | Exit 0 each |
| Broad project test gate | **NOT MET IN THIS ENVIRONMENT** | Docker daemon absent; no local MongoDB/Redis |
| Habib content/access approval | **NOT MET** | PENDING; H-1..H-5 |
| Tasnim learning/evidence approval | **NOT MET** | PENDING; T-1..T-5 |
| Aziz collaboration approval | **NOT MET** | PENDING; A-1..A-5 |
| Cross-domain architecture agreement | **NOT MET** | PENDING; X-1..X-4 |
| Official freeze approval | **NOT MET** | Not requested from a human authority |
| M04 not started | **MET** | No implementation found; no M04 files created |

The broad test gate matters because a freeze decision covers the repository validation state, not only focused contract tests. It must be run in an environment with the required services, or its absence explicitly accepted by the accountable owners, before a freeze.

## 6. Human approval record

| Gate | Actual decision | Reviewer | Date | Channel/signature |
|---|---|---|---|---|
| Habib / content and access | **PENDING** | Habib | — | None |
| Tasnim / learning and evidence | **PENDING** | Tasnim | — | None |
| Aziz / collaboration | **PENDING** | Aziz | — | None |
| Cross-domain agreement | **PENDING** | Habib, Tasnim, Aziz | — | None |
| Official freeze | **NOT FROZEN** | — | — | None |

No approval, comment, email, signature or meeting note was fabricated. Engineering self-review is not independent owner approval.

Ready-to-send requests are in [section 8 of the review package](EDNOVA-M03-CONTRACT-REVIEW-PACKAGE.md#8-ready-to-send-review-requests).

## 7. M04 / ED-04 preflight

Source search:

```text
rg -n 'InstitutionMembership|CourseEnrollment|class Institution|model\(.Institution|membership.*collection|enrollment.*collection' apps/api apps/web/src
```

Result: no matches (exit 1). ED-04.1–ED-04.3 are ABSENT in the acceptance matrix. Existing access is the M02 personal-owner predicate; there is no Institution, InstitutionMembership, CourseEnrollment, institutional invitation or enrollment route/model.

**Readiness: NOT READY.** M04 cannot start until:

1. M03/ED-26 is officially frozen;
2. institution tenancy, membership and enrollment records are designed against the current user/course model;
3. assigned-instructor and university-administrator grants are constrained so a room invite cannot promote or grant `assigned_instructor` access;
4. revocation semantics cover active sessions, streams, cached content and private result delivery;
5. contact with the actual source still revalidates the current grant at delivery;
6. source-free team rooms retain the current active-membership flow.

No M04 code, schema, route, test or migration was created.

## 8. Final determination

| Item | Result |
|---|---|
| M03 engineering implementation | **VERIFIED** |
| TS/Python parity over recorded corpus | **VERIFIED** |
| Schema drift | **NONE** |
| Habib review | **PENDING** |
| Tasnim review | **PENDING** |
| Aziz review | **PENDING** |
| Cross-domain agreement | **PENDING** |
| Broad test gate | **NOT RUN IN THIS ENVIRONMENT** |
| **ED-26** | **PARTIAL** |
| **v1.0.0** | **NOT FROZEN** |
| **M04/ED-04** | **NOT STARTED — BLOCKED BY M03 GATE** |

The next action is to send the four review requests, record the actual replies, resolve the seven open semantic items, apply any approved coordinated changes, rerun the full required validation, and only then update the ledger to FROZEN. Until that happens, this report must not be cited as a freeze.

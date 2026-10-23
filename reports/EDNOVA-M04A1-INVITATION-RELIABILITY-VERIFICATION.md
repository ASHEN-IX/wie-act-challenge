# EdNova M04-A.1 invitation reliability verification — 23 October 2026

**Original final classification: M04-A.1 PARTIAL. M04-A remains PARTIAL. ED-04 remains PARTIAL. ED-26 remains PARTIAL. Candidate `1.0.0` remains NOT FROZEN.**

> **M04-A.2 reclassification — 23 October 2026.** The previously unrun locked Python M03 parity and schema-export drift gates now pass under Python 3.12.15/Pydantic 2.12.5. M04-A.1 is reclassified **PASS for its implemented invitation-reliability scope**. M04-A and ED-04 remain **PARTIAL** because course enrollment, course-scoped instructor assignment and institutional source grants remain absent. ED-26 remains **PARTIAL** and candidate `1.0.0` remains **NOT FROZEN**. See [M04-A.2 parity and migration readiness](EDNOVA-M04A2-PARITY-AND-MIGRATION-READINESS.md).

All executed M04-A.1 implementation, API, browser, build, lint, typecheck and regression gates passed. The mission was initially PARTIAL because the locked Python M03 parity environment was unavailable, so that required parity half was not rerun. Course enrollment, course-scoped instructor assignment and institutional source grants remain deferred work, not M04-A.1 regressions.

No reviewer approval, contract freeze, deployment, publication, commit or push occurred. No global-admin private-data grant, institutional login, recipient binding or course grant was invented.

## A. Scope

M04-A.1 hardened the existing contract-independent institution foundation:

- invitation uniqueness and scalability;
- durable acceptance and process-restart recovery;
- membership security under retry, suspension, expiry and revocation races;
- the real profile invitation-acceptance flow in Chromium with two users and two institutions;
- regression and evidence collection.

It did not add course enrollment, course invitations, institutional course scopes, assigned-instructor source access, immutable publication, or an administrative invitation UI. `Course.userId` remains the only course-read grant.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. The pre-existing dirty tree was preserved. Final status is **247 entries: 186 tracked modifications and 61 untracked paths**, with **0 staged**. The mission-start manifest recorded 244 entries: 186 tracked modifications and 58 untracked paths. The difference is the new migration script, new M04-A.1 test and new browser test. Nothing was staged, committed, pushed, published or deployed.

## B. Defects found and fixed

### B.1 Multiple legitimate pending invitations were blocked

The model had a unique partial index:

```text
{ institutionId: 1, role: 1 } where status = "pending"
```

That prevented a university from having two simultaneous pending student invitations, even though invitations are independent bearer capabilities and no recipient identity is stored.

The model now has:

- unique `{ tokenHash: 1 }`;
- non-unique `{ institutionId: 1, status: 1, expiresAt: 1 }`.

The obsolete index is removed by `apps/api/scripts/migrate-institution-indexes.ts`. The script is a dry run by default; `--apply` performs the changes. It validates that no duplicate token hashes exist before creating the unique index, is repeatable, and reports inspected, dropped, created and retained indexes.

**Operational limitation:** the production database has not been migrated by this mission. Existing deployments must run the dry run and then `--apply` during an approved change window. Mongoose schema changes alone do not drop an existing index. From `apps/api`:

```bash
node_modules/.bin/tsx scripts/migrate-institution-indexes.ts
node_modules/.bin/tsx scripts/migrate-institution-indexes.ts --apply
```

These CLI commands were not run against a deployment database; the migration function itself was exercised by the M04-A.1 test.

### B.2 Acceptance rollback could make a claimed token reusable

The previous failure path could roll an accepted invitation back to `pending` after the claim. If a membership write had actually succeeded but the response was uncertain, a retry or another actor could reuse the capability.

Acceptance now proceeds as follows:

1. Validate the token shape, hash it and find the invitation.
2. Reject revoked/expired invitations with `410`.
3. If already accepted, continue only for the recorded `acceptedByUserId`; another actor gets `409`.
4. Atomically claim a pending, unexpired invitation with `status: "accepted"`, `acceptedByUserId` and `acceptedAt`.
5. Upsert the membership using the invitation role and issuer metadata.
6. Never roll the accepted claim back to `pending`.

The role and status are copied only from the server-owned invitation. An existing suspended membership is not reactivated; acceptance returns `403` and the invitation stays pending. An existing active membership also does not create a second membership or grant.

This is durable recovery, not a cross-collection transaction. A process can still stop between the claim and membership write. The same actor can retry the token to complete the missing membership; a different actor cannot claim it. Concurrent same-actor retries tolerate the unique membership insert race. No access is granted from invitation status alone.

### B.3 Duplicate recipient policy remains unresolved

Invitations still have no recipient or email binding. Multiple independent pending invitations are allowed, but the service cannot detect duplicate issuance intended for the same person. An administrator must revoke an unwanted capability. Adding recipient binding or deduplication requires a reviewed product decision and was not inferred.

### B.4 Real browser acceptance was previously unproven

M04-A had API-level acceptance evidence but no real authenticated browser flow. M04-A.1 adds a Chromium test that uses the actual profile page and server action. Institution setup uses the authenticated API only because no administrative invitation UI exists.

## C. Security invariants retained

- Raw tokens are 32 random bytes encoded as 43 URL-safe characters; they are returned only at issuance.
- Only SHA-256 hashes are stored and `tokenHash` is `select: false`.
- Tokens are absent from public projections, page HTML after reload, browser console output, captured Next runtime logs and persisted invitation documents.
- Invitations cannot grant `university_admin` or platform admin.
- Only an active `university_admin` of the same institution may issue or revoke invitations or suspend a non-administrator membership. A platform role alone is insufficient.
- Foreign institution IDs return `404` rather than confirming existence.
- Revoked and expired capabilities return `410`; unknown well-formed tokens return `404`; malformed token shapes return `400`.
- Acceptance by another actor after a claim returns `409`.
- Suspension is scoped and does not revoke personal data.
- Membership acceptance creates no course enrollment or source grant.
- `Course.userId` remains the only course-read predicate.

## D. Browser verification

Evidence: `reports/evidence/ednova-m04a1-2026-10-23/` (ignored, retained locally).

Command:

```bash
apps/api/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json \
  apps/web/e2e/test-institution-invitations.ts
```

The test starts an isolated real MongoDB database, an in-process Nest API, and the production Next standalone server. It creates an admin and two independent Better Auth users, signs each in through real Chromium contexts, and bootstraps two synthetic institutions through the authenticated API. The real `/profile` page and server action perform acceptance.

All 15 recorded checks passed:

1. production Next server ready;
2. two independent Better Auth users authenticated;
3. two synthetic institutions created through the authenticated API;
4. valid, expired and revoked capabilities prepared without an admin UI;
5. authenticated profile loads the personal workspace;
6. invalid token shows a truthful error and creates no membership;
7. expired token shows a truthful error and creates no membership;
8. revoked token shows a truthful error and creates no membership;
9. Bob's valid acceptance persists an instructor membership in institution B;
10. Alice's valid acceptance persists a student membership in institution A only;
11. Bob cannot reuse Alice's accepted token;
12. Alice's personal course remains readable by Alice and is `404` for Bob;
13. Bob receives `404` for institution A metadata;
14. tokens are absent from page HTML, browser console and stored documents;
15. tokens are absent from captured Next runtime logs.

Screenshots retained:

- `bob-invalid-token.png`
- `bob-expired-token.png`
- `bob-reused-token.png`
- `alice-profile-after-acceptance.png`
- `alice-personal-course-preserved.png`

Summary: `browser-summary.json` (`"status": "PASS"`). The browser test was rerun after the final script formatting change and passed again.

The final browser runs dropped their isolated databases. An early aborted startup attempt had left one `ednova_m04a1_browser_*` database; it was explicitly removed during cleanup, and no `ednova_m04a1` database remains. The dedicated test MongoDB and Mailpit containers were stopped and removed after verification. No unrelated container was removed.

## E. Automated verification

All commands ran from the repository root unless a working directory is shown. The final root run was after the last test cleanup.

| Command | Result |
|---|---|
| `pnpm test` | **Exit 0.** API build passed; routes 6; Jest 56 suites / 689 tests; Node unit 10; real integration 125; Better Auth 17; web 33. |
| `pnpm --filter api typecheck` | **Exit 0.** |
| `pnpm --filter web typecheck` | **Exit 0.** |
| `pnpm --filter web build` | **Exit 0.** Production Next build completed and generated all 21 static pages. |
| `pnpm --filter api lint` | **Exit 0 after fixes.** 0 errors, 122 pre-existing `no-console` warnings. |
| `pnpm --filter web lint` | **Exit 0.** |
| `AI_SERVICE_URL=http://127.0.0.1:1 pnpm exec tsx --tsconfig tsconfig.json --test tests/integration/m04a1-invitation-reliability.node.test.ts` (cwd `apps/api`) | **Exit 0.** 8/8 tests. |
| `AI_SERVICE_URL=http://127.0.0.1:1 pnpm exec tsx --tsconfig tsconfig.json --test tests/integration/m04a-institution-foundation.node.test.ts` (cwd `apps/api`) | **Exit 0.** 8/8 tests. |
| `pnpm generate:contracts` | **Exit 0.** Candidate ledger hash unchanged. |
| `pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand` | **Exit 0.** 167/167 tests. |
| `git diff --check` | **Exit 0.** |

The root run includes the existing M02, ED-07, ED-09, Better Auth and M04-A suites. No integration test was skipped or excluded from that run. The M04-A.1 test covers:

- obsolete index migration and token-hash uniqueness;
- multiple legitimate invitations and distinct actor acceptance;
- raw-token hashing and projection exclusion;
- interrupted claim recovery after API restart for the same actor only;
- suspended membership rejection without invitation reactivation;
- expiry, revocation and revocation race;
- issuer authority, role escalation and course isolation denial.

### E.1 Retained failure and fix

The first API lint run after implementation failed with **145 errors**, almost all Prettier formatting in the new M04-A.1 test plus one unused test variable. The affected API files were formatted with the API-local Prettier binary, the unused actor was removed, and the final API and web lint runs passed with zero errors. This was a source-quality failure, not an application test failure.

### E.2 M03 Python parity not run

Attempt:

```bash
PYTHONPATH=apps/ai python3 -m pytest apps/ai/tests/test_ednova_contracts.py -q
```

Result: **exit 1**, `/usr/bin/python3: No module named pytest`. The locked Python 3.12.15 environment referenced by the M03 report is not present in this workspace; the available Python is 3.14 without the project dependencies. No substitute environment was installed because that would not reproduce the locked parity environment.

Consequences:

- the TypeScript half of M03 parity was freshly reverified (167/167);
- the Python half and schema-export drift check were **not rerun**;
- this is the reason M04-A.1 is classified PARTIAL rather than complete despite all executed gates passing;
- the M03 candidate ledger was not modified and its hash remains `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877`.

No Python, provider, worker or model code was changed by M04-A.1.

## F. Changed source and documentation

Runtime changes:

- `apps/api/modules/study/src/models/Institution.ts`: removed the one-pending role index; documented token-only uniqueness and missing recipient binding.
- `apps/api/modules/study/src/services/institutions.ts`: durable non-rolling-back acceptance, same-actor recovery, duplicate-membership race handling and suspension protection.

Tooling and tests:

- `apps/api/scripts/migrate-institution-indexes.ts`: dry-run/apply index migration.
- `apps/api/tests/integration/m04a1-invitation-reliability.node.test.ts`: new reliability/security suite.
- `apps/api/tests/integration/m04a-institution-foundation.node.test.ts`: updated for multiple pending invitations and idempotent same-actor retry.
- `apps/web/e2e/test-institution-invitations.ts`: real two-user/two-institution Chromium proof.

Documentation:

- `docs/data-model.md`: multiple invitations, migration and acceptance recovery.
- `docs/roles-and-permissions.md`: authorization boundary, retry behavior, recipient-binding gap and browser evidence.
- `docs/backend-api.md`: multiple issuance and acceptance status semantics.
- `docs/sprint-backlog.md`: M04-A.1 evidence while ED-04 remains PARTIAL.
- `reports/EDNOVA-MISSION-GATES.md`: M04 row updated with M04-A.1 evidence.
- `reports/EDNOVA-ACCEPTANCE-MATRIX.md`: ED-04.1/2/3 evidence updated; statuses remain PARTIAL.
- `reports/EDNOVA-M04A-INSTITUTION-FOUNDATION-VERIFICATION.md`: superseded-claims banner added.
- This report.

The profile page and institution feature code were reused as-is; the frontend implementation did not need a behavior change for the browser test.

## G. Limitations and remaining decisions

- Production index migration is not applied. An approved operator must run the dry run and then `--apply`.
- Same-actor retry is intentionally idempotent, not a second use by a different actor. This should be described that way in user-facing operations.
- No recipient/email binding exists, so duplicate issuance to the same intended person is not prevented.
- No administrative invitation-management UI exists. Issuance and revocation are authenticated API operations in tests.
- Course enrollment, course invitations, course-scoped instructor assignment, institutional course scopes and source grants remain unimplemented.
- Membership reactivation after suspension has no general workflow; a new invitation does not reactivate a suspended membership.
- No cross-collection transaction is claimed. The recovery invariant depends on the accepted claim and same-actor reconciliation.
- The Python M03 parity and schema-export drift gates were not rerun because the locked environment is absent.
- No remote CI, deployment, container rebuild, live external model call or full future M04/M05 flow is claimed.
- Reviewer decisions remain outstanding: Habib, Tasnim and Aziz have not approved the M03 candidate.

## H. Classification and next gate

| Item | Result |
|---|---|
| Invitation index hardening | **PASS** |
| Durable acceptance and same-actor recovery | **PASS** |
| Invitation replay/expiry/revocation/suspension security | **PASS** |
| Real two-user browser acceptance and isolation | **PASS** |
| API/web build, lint, typecheck and root regression | **PASS** |
| M03 TypeScript parity and contract generation | **PASS** |
| M03 Python parity / schema export drift | **NOT RUN — locked environment absent** |
| M04-A.1 overall | **PARTIAL** |
| M04-A / ED-04 | **PARTIAL** |
| ED-26 / candidate `1.0.0` | **PARTIAL / NOT FROZEN** |

M04-A.1 is complete for the implementation and browser reliability work it executed. It cannot be declared fully verified while a required M03 parity gate remains unexecuted and ED-04's enrollment/source-grant scope remains deferred.

The next action is reviewer/environment follow-up, not new feature work: rerun the Python M03 parity and schema-export checks in the locked environment, apply the index migration through the approved operational path, and record the result. Full M04 enrollment work must still wait for the ED-26/Contract 03 decisions and the M03 freeze gate.

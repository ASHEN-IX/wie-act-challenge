# EdNova M04-A institutional foundation verification — 23 October 2026

**Final classification: M04-A PARTIAL. ED-04 PARTIAL. ED-26 remains PARTIAL. Candidate `1.0.0` remains NOT FROZEN.**

> **Superseded claims — see [M04-A.1](EDNOVA-M04A1-INVITATION-RELIABILITY-VERIFICATION.md).** This report records the M04-A baseline. Its unique partial `{ institutionId: 1, role: 1 }` pending-invitation index, "one pending capability per institution/role" rule, "duplicate pending invitation 409" check and post-claim rollback behavior were replaced in M04-A.1. Multiple independent pending invitations are now allowed; acceptance is a durable non-rolling-back claim with same-actor retry recovery. M04-A.1 also adds the real two-user browser acceptance proof. The M04-A classification itself remains PARTIAL.

M04-A added only the contract-independent membership/invitation foundation. It did not activate course enrollment, institutional course scopes, assigned-instructor source access or published-source access. No reviewer approval, contract freeze, global-admin private-data grant, or institutional login was invented.

Repository `/home/ashenix/Projects/mindflow`, branch `main`, HEAD `b4e75a41e2b9b30283bed78673c3a690ff4e70d5`. The pre-existing dirty tree was preserved. Mission-start state captured 235 status entries: 182 tracked modifications and 53 untracked paths. Final status is **244 entries: 186 tracked modifications and 58 untracked paths**. The status grew because M04-A added the new model, service, route, integration test and web feature directory, and touched existing tracked wiring, profile and documentation files. Nothing was staged, committed, pushed, published or deployed. Tests used an isolated synthetic MongoDB database and deleted it after the run.

## A. Scope and dependency matrix

| Slice | Result | Basis |
|---|---|---|
| Institution identity, metadata and unique slug | **Implemented** | MongoDB model, server validation, platform-admin-only synthetic setup. |
| Two institution scopes and personal mode isolation | **Implemented for membership context** | Two synthetic institutions; membership lists and foreign-ID reads are isolated. Personal course access still uses the old owner predicate. |
| Scoped membership administration | **Implemented** | Active `university_admin` membership is required; platform role alone is not accepted for member management. |
| Membership invitation identity, expiry, replay and revocation | **Implemented** | Raw token returned once; only SHA-256 hash stored; conditional single-use acceptance; expiry and revocation fail closed. |
| Instructor/student invitation role assignment | **Implemented as membership context only** | Invitation role is server-validated to `instructor` or `university_student`. It cannot grant `university_admin` or platform admin. |
| Profile display and invitation acceptance UI | **Implemented** | Active memberships and an acceptance form are shown; no client role flag is used. |
| Course enrollment / course invitation | **Deferred** | Depends on unresolved Contract 03/ED-26 enrollment and publication semantics. |
| Institutional course scope and assigned-instructor grant | **Deferred** | `Course` still has only `userId`; adding `scope`, `ownerUserId`, `institutionId` or enrollment would create an unauthorized source grant. |
| Published/private source access | **Deferred, unchanged** | `Course.userId` remains the only course-read grant. Membership and platform admin do not bypass it. |
| Enrollment activation | **Not implemented** | No “active enrollment” state or course grant exists to activate. |

### M03/ED-26 freeze state

| Item | Status |
|---|---|
| Candidate version | `1.0.0` |
| Genuine Habib / Tasnim / Aziz approvals | None recorded |
| ED-26 | **PARTIAL** |
| Freeze | **NOT FROZEN** |
| Candidate ledger hash | `287ca4f8d57dd12a5dce6685e0bad33e32e4b1134f8faf3d68d81959d50a1877` (unchanged) |
| M04-A consequence | No Contract 03 semantics were consumed as authority; no enrollment/source-grant behavior was created. |

The candidate ledger is intentionally left byte-for-byte unchanged so its recorded hash remains valid. Its older sentence that M04 “has not started” is a pre-M04-A snapshot; current mission status is authoritative in the sprint backlog and mission gates.

## B. Source and wiring changes

New implementation:

- [`apps/api/modules/study/src/models/Institution.ts`](../apps/api/modules/study/src/models/Institution.ts) — `Institution`, `InstitutionMembership` and `InstitutionInvitation` models, enums, timestamps and indexes.
- [`apps/api/modules/study/src/services/institutions.ts`](../apps/api/modules/study/src/services/institutions.ts) — setup, context lookup, metadata update, invitation issue/accept/revoke, membership suspension and conditional state transitions.
- [`apps/api/modules/study/src/routes/institutions.ts`](../apps/api/modules/study/src/routes/institutions.ts) — authenticated HTTP surface with server-owned role checks.
- [`apps/api/tests/integration/m04a-institution-foundation.node.test.ts`](../apps/api/tests/integration/m04a-institution-foundation.node.test.ts) — real NestJS/MongoDB tests.
- [`apps/web/src/features/institutions/`](../apps/web/src/features/institutions/) — server-only query, server action and types.
- [`apps/web/src/app/(workspace)/profile/page.tsx`](../apps/web/src/app/(workspace)/profile/page.tsx) — display-only context plus single-use invitation acceptance form.

Wiring/documentation:

- [`apps/api/modules/study/src/app.ts`](../apps/api/modules/study/src/app.ts) mounts `/api/v1/study/institutions` behind the existing `authenticate` middleware.
- [`apps/api/src/domain-definitions.ts`](../apps/api/src/domain-definitions.ts) registers the domain mount.
- [`apps/api/src/framework/domains/study.module.ts`](../apps/api/src/framework/domains/study.module.ts) was regenerated with `pnpm generate:contracts`.
- [`apps/api/modules/study/src/models/index.ts`](../apps/api/modules/study/src/models/index.ts) exports the new models and enum types.
- [`docs/data-model.md`](../docs/data-model.md), [`docs/roles-and-permissions.md`](../docs/roles-and-permissions.md), [`docs/backend-api.md`](../docs/backend-api.md), [`docs/architecture.md`](../docs/architecture.md) and [`docs/sprint-backlog.md`](../docs/sprint-backlog.md) now distinguish the implemented subset from target enrollment/publication behavior.
- [`reports/EDNOVA-ACCEPTANCE-MATRIX.md`](EDNOVA-ACCEPTANCE-MATRIX.md) and [`reports/EDNOVA-MISSION-GATES.md`](EDNOVA-MISSION-GATES.md) record PARTIAL, not DONE.

### HTTP surface

All routes require the existing Better Auth session. No route accepts a client-supplied institution role or actor ID.

| Method | Path | Authority |
|---|---|---|
| `GET` | `/api/v1/study/institutions` | Active memberships of the authenticated actor only. |
| `POST` | `/api/v1/study/institutions/bootstrap` | Existing platform-admin authority; explicit synthetic setup. |
| `GET` | `/api/v1/study/institutions/:institutionId` | Active membership in that institution; foreign IDs return 404. |
| `PATCH` | `/api/v1/study/institutions/:institutionId` | Active `university_admin` membership in that institution. |
| `POST` | `/api/v1/study/institutions/:institutionId/invitations` | Active `university_admin`; role limited to instructor/student. |
| `DELETE` | `/api/v1/study/institutions/:institutionId/invitations/:invitationId` | Active `university_admin`; pending invitation only. |
| `POST` | `/api/v1/study/institutions/invitations/accept` | Authenticated actor plus a valid single-use token. |
| `DELETE` | `/api/v1/study/institutions/:institutionId/memberships/:userId` | Active `university_admin`; non-administrator target only. |

## C. Authorization model

- **One identity.** Better Auth still supplies `req.user.userId` and the platform `student | admin` role. There is no institutional login, password store, session type or second authorization engine.
- **Existing platform authority.** `POST /bootstrap` uses the already-existing `requireRole('admin')`. It is explicit setup, not a self-service endpoint. A missing session is 401 and a non-admin session is 403.
- **Study-owned membership boundary.** Institution administration is resolved from an active `institution_memberships` row. The platform `admin` flag does not automatically manage a foreign institution. Foreign or unauthorized institution IDs return 404 to avoid confirming tenant existence.
- **Role escalation closed.** Invitation bodies accept only `instructor` and `university_student`. `university_admin`, `admin`, actor IDs and membership statuses are not accepted from the client. The first institution administrator can only be created by the platform-admin bootstrap.
- **No source grant.** Membership acceptance, suspension and institution metadata do not alter `Course.userId` or `canReadCourse`. A member receives 404 for another user's personal course; the test asserts this explicitly. No global-admin or membership bypass was added to Study source reads.
- **Bounded administration.** An administrator cannot suspend their own membership or a `university_admin` membership through the member route. Administrator removal remains an explicit future platform operation.
- **No private-data grant.** The new routes expose institution metadata and the caller's own membership. They do not expose another learner's courses, files, jobs, results, rooms or answers.

## D. Persistence and index design

### `institutions`

Fields: `name`, unique lowercase `slug`, optional lowercase `domain`, `isVerified`, `createdByUserId`, timestamps. Synthetic setup always stores `isVerified: false`; no verification event is fabricated.

### `institution_memberships`

Fields: `institutionId`, `userId`, role (`university_admin | instructor | university_student`), status (`active | invited | suspended`), optional `invitedByUserId`, timestamps.

Unique index: `{ institutionId: 1, userId: 1 }`.

### `institution_invitations`

Fields: `institutionId`, invitation role (`instructor | university_student`), `tokenHash`, status (`pending | accepted | revoked | expired`), issuer, optional acceptor, `expiresAt`, acceptance/revocation timestamps. `tokenHash` is `select: false`.

Indexes:

- unique `{ tokenHash: 1 }`;
- unique partial `{ institutionId: 1, role: 1 }` where `status: "pending"`;
- `{ institutionId: 1, status: 1, expiresAt: 1 }`.

The partial unique index prevents duplicate live capabilities without blocking a new invitation after the prior one is accepted, revoked or expired. Duplicate institution slugs are rejected with 409.

MongoDB standalone cannot transact institution creation and first membership creation together. Bootstrap therefore compensates with a delete of the just-created institution if membership creation fails. Acceptance similarly rolls a just-accepted invitation back to `pending` if membership creation fails. These are compensating paths, not a claim of atomic cross-collection transactions.

## E. Invitation lifecycle and security properties

1. A 32-byte random token is generated. The raw token is returned once in the create response; only its SHA-256 hash is persisted. It is not selected by default and is never logged.
2. Expiry defaults to 168 hours and is bounded to 1–720 hours.
3. Creation requires an active `university_admin` membership. Expired pending rows for the same institution/role are retired first; the partial unique index makes concurrent duplicate issuance fail with 409.
4. Acceptance validates token shape, finds by hash, rejects revoked/expired with 410 and already-used with 409.
5. Acceptance claims the row conditionally with `status: "pending"` and `expiresAt > now`. Two concurrent acceptors produce exactly one 200 and one 409 in the real test.
6. An existing active or suspended membership blocks acceptance. A suspended membership cannot be reactivated with an invitation.
7. Administration cannot revoke an accepted invitation, cannot suspend an administrator, and cannot suspend itself.
8. No token is email-bound; the capability is role-scoped and single-use, not identity-bound. This is acceptable for the independent membership slice but is not an enrollment or source grant.

## F. Fresh verification results

Environment: Node 24.20.0 / pnpm 11.3.0; MongoDB 7 from `docker-compose.test.yml` exposed at `127.0.0.1:27018`; isolated synthetic databases. The Docker CLI required `DOCKER_HOST=unix:///var/run/docker.sock`; the test containers reported healthy and were stopped after verification.

| # | Command | Result |
|---|---|---|
| 1 | `pnpm generate:contracts` | **Exit 0** — API contract files regenerated. |
| 2 | `pnpm --filter api typecheck` | **Exit 0** — strict TypeScript check. |
| 3 | `pnpm --filter web typecheck` | **Exit 0** — Next typegen + TypeScript. |
| 4 | `pnpm --filter api lint` | **Exit 0 — 0 errors, 120 existing warnings.** |
| 5 | `pnpm --filter web lint` | **Exit 0 — 0 errors.** |
| 6 | `pnpm --filter api test:routes` | **Exit 0 — 6 passed, 0 failed.** |
| 7 | `pnpm --filter api test:node` | **Exit 0 — 10 passed, 0 failed** (ED-07 room lifecycle). |
| 8 | `pnpm --filter api test:node:integration` | **Exit 0 — 117 passed, 0 failed, 0 skipped.** Includes M04-A (8), M02 resource isolation, five ED-07 real Nest/Mongo suites and ED-09 facilitator suites. |
| 9 | `pnpm --filter api test:auth` | **Exit 0 — 17 passed, 0 failed.** Includes build plus Better Auth lifecycle/Nest identity checks. |
| 10 | `pnpm --filter web test` | **Exit 0 — 33 passed, 0 failed.** |
| 11 | `pnpm build` | **Exit 0** — API compile and production Next build (21 pages). |
| 12 | `pnpm --filter api exec jest tests/shared/ednova-contracts.test.ts --runInBand` | **Exit 0 — 167 passed, 0 failed.** M03 contract suite rerun. |
| 13 | Python 3.12.15 contract suite in `ednova-m02-ai:verification` container with temporary pytest | **Exit 0 — 165 passed, 0 failed, 1 warning** (`asyncio_mode` unknown to temporary pytest 9.1.1). No repository file changed. |
| 14 | `python -m contracts.export_ednova_schema --check` in the same container | **Exit 0 — no schema drift.** |

M03 hashes were unchanged by M04-A; the ledger remains `287ca4f8…50a1877`.

### M04-A test detail

The real test file covers:

- missing-session bootstrap 401 and non-admin bootstrap 403;
- duplicate institution slug 409;
- two institutions visible only to their respective active members;
- foreign institution read 404 and foreign invitation management 404;
- metadata update by administrator, malformed domains 400, instructor update 404;
- role escalation to `university_admin` 400;
- duplicate pending invitation 409;
- revoked invitation 410 and expired invitation 410;
- invalid token 404 and no membership side effect;
- valid acceptance, replay 409, one active membership;
- concurrent acceptance [200, 409] and exactly one membership row;
- suspension 200, subsequent context 404, suspended re-acceptance blocked;
- concurrent suspension exactly one 200, final state `suspended`;
- membership does not reveal another user's personal course (404);
- Better Auth `/api/v1/auth/me` keeps the original identity.

## G. Regression evidence

- **M02:** `M02 resource isolation across real HTTP, internal dispatch and callbacks` passed inside the 117-test integration run. No source grant was widened.
- **Better Auth:** 17 lifecycle/Nest tests passed, including protected API rejection, origin/session behavior and owner-resource privacy.
- **ED-07:** five real Nest/Mongo suites passed (durable replay, peer text, presence, authorization, end-to-end rooms), plus the 10-test room lifecycle suite.
- **Study/M03:** 167 TypeScript and 165 Python contract tests passed; schema export had no drift.
- **Web:** 33 unit tests passed; production build included `/profile`.
- **Lint:** API remains at 120 pre-existing warnings; M04-A added zero lint errors.

## H. Deferrals, limitations and blockers

- **ED-26 / Contract 03 remains unfrozen.** No genuine Habib, Tasnim or Aziz approval exists. M04-A did not invent one.
- **Course enrollment is absent.** No `CourseEnrollment` model, route or activation path was added. “Accept invitation” grants institution membership only.
- **Course invites are absent.** The acceptance criterion about course invites cannot be claimed complete; the implemented membership invitation is constrained instead.
- **Course scope and instructor assignment are absent.** `Course` still has no `scope`, `institutionId`, `ownerUserId` or `assignedInstructorIds`.
- **No institutional source access.** Published revisions, enrollment-scoped materials and assigned-instructor access remain later work.
- **No institution verification workflow.** `isVerified` stays false; there is no approval UI or verification decision.
- **No administrator/management frontend.** Bootstrap and invitation/revocation management are API-only; the profile page only displays context and accepts a token.
- **No email-bound invitations or dedicated rate limiter.** Tokens are high-entropy and single-use; the existing platform rate limits apply. Assigning invitations to a specific email requires a later product decision.
- **No cross-collection transaction.** Standalone Mongo uses compensating rollback. A process crash between claim and membership write can leave a conservative failure state; test coverage exercises normal failure paths, not process crashes.
- **No browser E2E or live external inference.** Neither is needed for the implemented persistence/authorization slice; no browser flow is claimed.
- **Full root `pnpm test` was not run.** Relevant package, real integration, auth, contract, web and build checks were run; unavailable external services and the browser/inference suites remain outside this bounded mission.

## I. Completion classification and next gate

**M04-A: PARTIAL.** The independently safe foundation is implemented and verified: institution identity, two isolated scopes, scoped membership administration, hashed single-use invitations, revocation, concurrency control and a display-only frontend. It is not full ED-04 because course enrollment, course invitations and course-scoped source access do not exist.

**ED-04: PARTIAL.** It has reusable implementation but unmet target acceptance. It must not be promoted to DONE.

**ED-26: PARTIAL; v1.0.0: NOT FROZEN.** The next prerequisite is genuine domain-owner review and freeze. M05 has not started. No further mission was started in this pass.

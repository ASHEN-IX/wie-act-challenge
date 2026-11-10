# Noveris backend API

`apps/api/src/main.ts` starts the NestJS application, connects PostgreSQL, attaches realtime and initializes domain consumers and pollers. Local development uses port 3001. The Express-compatible application retained under `src/app.ts` is also used by tests. Production lifecycle and route discovery should be checked against the actual launcher and domain definitions.

## Domain contracts and dispatch

`src/domain-definitions.ts` mounts domain operations. Generated adapters under `src/framework/domains` connect these contracts to NestJS. Existing handlers remain under `modules/*`. `shared/moduleClient.ts` resolves in-process module calls with request context. Outbound AI HTTP uses the configured service client. Run `pnpm generate:contracts` after relevant route-contract edits.

Better Auth's web engine is hosted at Next `/api/auth/*`. API guards resolve the same account and session state. Role and entitlement checks are supplemented by institution, course, room and recipient-specific resource policies. Use [permissions](roles-and-permissions.md) for the exact boundaries.

## Study API responsibilities

| Source routes | Responsibility | Authoritative service boundary |
| --- | --- | --- |
| `institutions.ts` | Bootstrap, context, metadata, member invitations and suspension | Active institution role and invitation state |
| `enrollments.ts` | Instructor assignment, course invitations, student enrollment and withdrawal | Course administration plus same-institution eligibility |
| `courses.ts` | Upload, draft, source review, publication, visibility and public catalog | Owner/teaching/source grants and expected revision |
| `activities.ts` | Reviewed activity access and private submissions | Pinned public definition, private evaluation and actor receipt |
| `learning.ts` | Practice selection, diagnostic cues, support and adaptation | Actor and authorized published course |
| `rooms.ts` | Room participation, controls, facilitator and debrief | Current participant, source grant and room state |
| `internalBudget.ts` | LLM reservations, usage, activity and revocation | Internal service credential and bound approval identity |

Inspect `apps/api/modules/study/src/routes` and the generated domain adapters for exact endpoint signatures. This table describes responsibilities rather than a second endpoint registry.

## Institution versus course operations

`/api/v1/study/institutions/bootstrap` requires platform-admin authority. Membership acceptance establishes an institution context. `/courses/:courseId/instructors` and `/courses/:courseId/enrollments` establish separate course relationships. Course invitation acceptance is a different workflow from institution invitation acceptance. Public-course reading follows visibility/publication policy and does not populate an institution roster.

## Source and evidence integrity

Publication validates authority, expected revision and source artifacts. ActivityRecord separates the public activity from server evaluation. Private attempts use stable actor/attempt identity, payload hash and pinned revision. Receipt and evidence writes support recoverable processing. Competency and reward are derived state. Source-backed reads recheck current grants, including private results and materialized context where implemented.

## Async and realtime

Typed broker jobs carry message and correlation identity. Result consumers apply supported progress and outcomes. HTTP service availability is separate from worker/broker readiness. Room WebSockets deliver events while PostgreSQL stores command receipts and peer history. The peer journal sequence is distinct from room state sequence.

## Verification and operations

Run `pnpm --filter api build`, `pnpm --filter api typecheck` and the relevant package test commands. `pnpm test:integration` includes infrastructure-dependent API suites. Use disposable PostgreSQL fixture databases and the documented service configuration. The OpenAPI description is exposed at `/api/v1/docs/openapi.json` in the configured runtime.

See [development](development.md), [workflows](workflows.md), [data model](data-model.md) and [evidence](submission/evidence/EDNOVA-CLAIM-TRACEABILITY.md). Test coverage for a resource policy does not certify all inherited endpoints or deployment configurations.

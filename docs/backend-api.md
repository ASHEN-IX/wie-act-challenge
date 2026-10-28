# Backend API — CURRENT

The production entrypoint is `study-partner-api/src/main.ts`, compiled to `dist/main.js`. It boots NestJS on one Express-backed HTTP listener (:3000), loads seven in-process domains and attaches notification/session WebSockets. `src/app.ts` remains an Express compatibility path used by tests; retain it until usage is proven otherwise.

Authoritative public route mounts are `src/domain-definitions.ts`; generated Nest controllers live under `src/framework/domains/` and dispatch domain contract operations. `shared/moduleClient.ts` handles `module://` calls with identity context; outbound HTTP uses `shared/aiClient.ts`. Domain models/persistence remain in `modules/*` and `shared`.

Better Auth's engine is hosted at Next `/api/auth/*`. Backend session guards resolve the same database identity; roles are student/admin and tier/ownership policies add restrictions. This is not active custom JWT login. Some HTTP resource-membership paths still need repair (ED-02). See [permissions](roles-and-permissions.md), [architecture](architecture.md) and [validation](audit/validation.md).

From root: `pnpm --filter study-partner-api build`, `pnpm --filter study-partner-api typecheck`, `pnpm --filter study-partner-api test`, `pnpm test:integration`, `pnpm test:auth`. Database/broker/test prerequisites are in [development](development.md). Preserve contracts, leases/idempotency, upload checks, session auth, metrics and backup mechanisms. M04-A membership/invitation administration is partially delivered; enrollment, publication and facilitator APIs remain PLANNED.

## M04-A/M04-A.1 institution endpoints

Mounted at `/api/v1/study/institutions` with the existing Better Auth session. These routes expose membership context only; they do not grant course or source access.

- `GET /` — active institution contexts for the authenticated actor.
- `POST /bootstrap` — platform-admin-only synthetic institution setup and first `university_admin` membership.
- `GET /:institutionId` — context for an active member of that institution.
- `PATCH /:institutionId` — metadata update by an active `university_admin`.
- `POST /:institutionId/invitations` — issue an independent pending instructor/student invitation; multiple pending invitations per institution/role are allowed, and the raw token is returned once.
- `DELETE /:institutionId/invitations/:invitationId` — revoke a pending invitation.
- `POST /invitations/accept` — atomically claim an unexpired pending invitation, then establish membership. Same-actor retries return `200` and reconcile a missing membership; another actor receives `409`; revoked/expired tokens return `410`. No cross-collection transaction or rollback-to-pending is claimed.
- `DELETE /:institutionId/memberships/:userId` — suspend a non-administrator membership. Reissuing an invitation does not reactivate it.

No enrollment or course-scope route is implemented.

## v1.2 implementation scope

Each owner delivers API, frontend and AI together: Habib course/content/access/revision endpoints and ingestion; Tasnim activity/attempt/evidence/progress/reward endpoints and individual tutoring/evaluation; Aziz room/chat/voice/private-help/debrief endpoints and group facilitation. Source authorization Habib, individual evidence Tasnim and room state Aziz are the authoritative boundaries; no backend-only or AI-only member. See [team plan](team-delivery-plan.md) and [backlog](sprint-backlog.md). This update implemented no features.

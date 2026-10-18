# Backend API — CURRENT

The production entrypoint is `study-partner-api/src/main.ts`, compiled to `dist/main.js`. It boots NestJS on one Express-backed HTTP listener (:3000), loads seven in-process domains and attaches notification/session WebSockets. `src/app.ts` remains an Express compatibility path used by tests; retain it until usage is proven otherwise.

Authoritative public route mounts are `src/domain-definitions.ts`; generated Nest controllers live under `src/framework/domains/` and dispatch domain contract operations. `shared/moduleClient.ts` handles `module://` calls with identity context; outbound HTTP uses `shared/aiClient.ts`. Domain models/persistence remain in `modules/*` and `shared`.

Better Auth's engine is hosted at Next `/api/auth/*`. Backend session guards resolve the same database identity; roles are student/admin and tier/ownership policies add restrictions. This is not active custom JWT login. Some HTTP resource-membership paths still need repair (ED-02). See [permissions](roles-and-permissions.md), [architecture](../../ARCHITECTURE.md) and [validation](../../audit/2026-10-18/VALIDATION.md).

From root: `pnpm --filter study-partner-api build`, `pnpm --filter study-partner-api typecheck`, `pnpm --filter study-partner-api test`, `pnpm test:integration`, `pnpm test:auth`. Database/broker/test prerequisites are in [development](../../DEVELOPMENT.md). Preserve contracts, leases/idempotency, upload checks, session auth, metrics and backup mechanisms. Institutional membership/publication/facilitator APIs are PLANNED, not delivered.

## v1.2 implementation scope

Each owner delivers API, frontend and AI together: Habib course/content/access/revision endpoints and ingestion; Tasnim activity/attempt/evidence/progress/reward endpoints and individual tutoring/evaluation; Aziz room/chat/voice/private-help/debrief endpoints and group facilitation. Source authorization Habib, individual evidence Tasnim and room state Aziz are the authoritative boundaries; no backend-only or AI-only member. See [team plan](team-delivery-plan.md) and [backlog](sprint-backlog.md). This update implemented no features.

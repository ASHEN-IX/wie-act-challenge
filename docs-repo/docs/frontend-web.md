# Frontend — CURRENT

Next.js App Router (`app/`), React 18/TypeScript, Tailwind, Zustand stores, React Query/Axios, Vitest and Playwright. Vite remains test/build tooling dependency, not the production router. Runtime screens live in `src/screens/`, composed through `src/next-entry.tsx` and `src/App.tsx`; `src/navigation.tsx` adapts existing client navigation. Shared components/hooks/services/stores remain active.

Server pages use `src/server/identity.ts`; Better Auth engine is `app/api/auth/[...all]/route.ts`. `proxy.ts` supplies nonce/CSP headers; `next.config.mjs` rewrites API/uploads to the backend and builds standalone output. Production nginx handles WS upgrades. For direct Next dev use a backend WS URL or edge proxy; do not assume Next HTTP rewrites proxy WebSockets.

Screens cover auth, subjects/uploads, tasks/planner/calendar, competency/reviews/search, solo/team sessions, voice, social/ranking, analytics/pricing/admin/customization. Institution/instructor/publication/AI-facilitator screens are PLANNED. Existing teacher permission helpers are not backend instructor support.

From root: `pnpm --filter study-partner-web dev` (:5173), `build`, `typecheck`, `lint`, `test`. Root `pnpm test:e2e` runs auth/smoke only. Playwright config excludes `.integration.spec` files by default; existing specs are not proof every flow passed. See [development](../../DEVELOPMENT.md), [validation](../../audit/2026-10-18/VALIDATION.md) and [target feature contracts](product-specification.md). No UI redesign or runtime rename was performed during the audit.

## v1.2 implementation scope

Each owner delivers frontend, backend and AI together: Habib course/institution/Studio/authoring UI and extraction; Tasnim tutor/activity/assessment/progress/rewards UI and learning AI; Aziz rooms/chat/voice/private help/group debrief UI and facilitator AI. Shared adapters/shell use module-symbol ownership and serialized edits. No frontend-only member. See [team plan](team-delivery-plan.md) and [backlog](sprint-backlog.md). This update implemented no features.

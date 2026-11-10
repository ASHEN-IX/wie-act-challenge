# Noveris frontend — native App Router

Next.js 16, React 19, TypeScript and Tailwind CSS 4. The frontend now uses native App Router layouts/pages and shadcn/ui Radix primitives. The old SPA wrapper, navigation adapter, screens, global stores, CSS files and overlapping animation/client-fetch libraries have been removed.

## Structure and ownership

```text
src/app/                  Route composition, layouts, loading/error/not-found states
  (auth)/                 Sign in, registration, verification, password reset
  (workspace)/            Authenticated learning workspace; admin checks on admin page
  api/auth/[...all]/       Better Auth HTTP route
src/features/
  auth/                   Session mutations and shared auth forms
  courses/                Habib: course queries, uploads, source types and authoring entrypoints
  learning/               Tasnim: practice/evaluation, private job results and solo sessions
  planning/               Tasnim: plan generation/finalization
  tasks/                  Tasnim: task mutation and list UI
  collaboration/          Aziz: room actions and realtime connection lifecycle
  account/                Profile mutations
src/components/ui/        Generated shadcn primitives; review changes before customizing
src/components/layout/    Shared server shell and small client navigation
src/components/shared/    Page headers, input composition, form feedback, empty/error states
src/lib/                  Server API gateway, bounded form validation and utilities
src/server/identity.ts    Request-scoped identity resolution
```

## Navigation

Primary navigation is four items: **Home** (`/dashboard`), **My Learning** (`/courses`), **Study Together** and **Progress**. Visual Lab, Practice, the binary-search demo, Tasks, Study plan and Explore sources sit under a collapsed **More tools** group that opens on those routes; Visual Lab is also reached from a published course ("Explore visually"). Teaching Studio and Institution sections remain role-gated by the workspace layout. No routes were removed, so existing bookmarks keep working.

Pages read through the server-only gateway in `src/lib/api.ts`. It forwards the current cookie to the configured Nest backend, disables shared caching, bounds requests and preserves backend authorization. Server Actions authenticate independently, select fixed operations, validate fields, preserve Next redirect/error control flow and revalidate affected pages. No service keys or raw database/domain records are passed to the browser.

Client components are limited to interactive navigation, form submission/pending feedback, asynchronous job polling and room WebSockets. React `useActionState` handles form feedback; no global client auth/data store is required. Use `next/link` and `next/navigation` directly. Independent reads use `Promise.all`.

Better Auth still controls session cookies, verification and reset. Auth Server Actions preserve returned cookie security flags; the API route remains available for existing clients and tests. Role checks remain in both server pages and Nest. Browser tests verify session persistence/logout/reset and admin denial.

## Styling and components

`src/app/globals.css` contains the Tailwind entrypoint, semantic theme tokens and minimal base styles. Use utilities in components instead of adding screen CSS, theme-extraction effects or new styling systems. `components.json` enables RSC/TSX and points to this file. Use the shadcn CLI from this workspace; generated imports use `@/lib/utils`.

The visual system uses white surfaces, restrained forest-green actions, neutral borders, readable typography, course rows and a consistent responsive shell. Empty states reflect actual data. No invented completion, mastery or sample course data is shipped.

## Scope and migration

Rebuilt working surfaces: authentication, overview, course/subject creation, PDF upload and source reader, task CRUD/status, private evaluation/search jobs, plan generation/finalization, solo sessions, room creation/join/start/leave/end, session questions, progress, profile and an admin account listing. Original URL aliases redirect to the appropriate native route.

The simplification retires the old cosmetic wallpaper/video shops, billing/coupon management, standalone social/ranking dashboards and duplicated analytics/calendar/review screens. Their backend contracts/assets remain available; this rebuild does not delete user data. Voice controls/camera telemetry and the old elaborate planner/calendar UI are not carried into the new shell. Voice, richer scheduling, instructor Studio editing/publication, trusted quizzes/guided problems and peer facilitation remain explicit backlog work; do not mark those tasks DONE because this foundation exists.

Run `pnpm --filter web build`, `typecheck`, `lint`, `test`; `pnpm test:e2e` covers auth, native workspace mutations, responsive layout and two-user room membership.


## Product contexts and current entrypoints

The landing page, shared logo and application metadata use Noveris. One authenticated workspace supports personal resources and institution contexts. Institution administration, teaching surfaces and learner routes resolve their respective server policies. Global account role, institution membership and assigned course access remain separate.

Course server actions live under `src/features/courses`, institution context under `src/features/institutions`, individual activity/tutor support under `src/features/learning` and Nardouch, and rooms under `src/features/collaboration`. `src/features/visual-lab` renders registered graph, parameter, spatial and function engines. The reader's trusted registry renders validated lesson blocks.

`src/lib/api.ts` resolves the session and uses uncached protected API calls. Server actions validate forms and trigger route refreshes after mutations. Client components manage pending states, deterministic feedback and WebSocket recovery. The current source preview `/reader-preview` is development-only and uses a presentation fixture. Its captures demonstrate the rendered frontend rather than live ingestion or model execution.

The proposed Free/Pro and institutional subscription packages need alignment with actual entitlement rules before public commercial claims. Read [product architecture](product-specification.md), [permissions](roles-and-permissions.md) and [business model](business-model.md) alongside feature UI code.

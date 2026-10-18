# EdNova web

Native Next.js 16 App Router with React 19, TypeScript, shadcn/ui and Tailwind CSS 4.

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm dev:infra:up
pnpm dev
```

Routes and layouts live in `src/app`; domain queries/actions/components live in `src/features`. Shared primitives are in `src/components/ui`. Read [frontend architecture and migration scope](../../docs/frontend-web.md), the [team plan](../../docs/team-delivery-plan.md), and [current validation/limits](../../docs/audit/cleanup.md).

Use server reads for initial data and authenticated Server Actions for mutations. Keep client components small. Use `next/link`/`next/navigation` directly; add Tailwind utilities instead of screen CSS. Keep identity, cookies and service credentials on the server.

Run `pnpm --filter web build`, `typecheck`, `lint`, `test`; `pnpm test:e2e` verifies the browser journey against the real local API/Mongo/Mailpit stack. AI workers/models have separate setup and acceptance gates.

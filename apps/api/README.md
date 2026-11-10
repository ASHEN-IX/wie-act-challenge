# Noveris API — course, learning and account services

NestJS modular API in the parent pnpm workspace. From root: `pnpm install --frozen-lockfile`, then `pnpm --filter api dev` (or `pnpm dev:api`). Source entrypoint: `src/main.ts`; compiled entrypoint: `dist/main.js`. Configuration, database/broker requirements and known startup blockers: [development](../../docs/development.md).

[Backend guide](../../docs/backend-api.md) describes contracts/modules and cookie-session authorization. [Current architecture](../../docs/architecture.md) describe the implemented runtime.

# Study Partner API — reusable EdNova foundation

NestJS modular API in the parent pnpm workspace. From root: `pnpm install --frozen-lockfile`, then `pnpm --filter study-partner-api dev`. Source entrypoint: `src/main.ts`; compiled entrypoint: `dist/main.js`. Configuration, database/broker requirements and known startup blockers: [development](../DEVELOPMENT.md) and [validation](../audit/2026-10-18/VALIDATION.md).

[Backend guide](../docs-repo/docs/backend-api.md) describes contracts/modules and cookie-session authorization. [Current architecture](../ARCHITECTURE.md) and [target](../TARGET_ARCHITECTURE.md) distinguish existing source from PLANNED institutional/facilitation work. Runtime identifiers/auth behavior were preserved in the documentation audit.

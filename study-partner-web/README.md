# Study Partner Web

Next.js frontend in the parent pnpm workspace. From the parent folder run `pnpm install --frozen-lockfile` and `pnpm --filter study-partner-web dev`. Build with `pnpm --filter study-partner-web build`; test with `pnpm --filter study-partner-web test`.

API and WebSocket requests both target the main backend on port 3000. nginx proxies both paths to the `app` container. See [workspace development guide](../DEVELOPMENT.md).

Authentication now uses Better Auth hosted by Next.js, with NestJS session guards and application authorization. See [AUTH_MIGRATION.md](../AUTH_MIGRATION.md) for setup, database migration, endpoint replacements and validation. Python AI remains independent.

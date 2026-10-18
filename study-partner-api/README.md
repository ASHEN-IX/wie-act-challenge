# Study Partner API

This project is now a modular monolith in the parent pnpm workspace. Run `pnpm --filter study-partner-api dev` from the parent folder. The single entrypoint is `src/main.js`; modules have no independent startup scripts. See [workspace README](../README.md) and [migration](../MIGRATION.md).

MongoDB collections and public API routes are preserved. AI remains an independent Python server. Redis and RabbitMQ remain required by the corresponding cache/job flows. Characters are removed.

Authentication now uses Better Auth hosted by Next.js, with NestJS session guards and application authorization. See [AUTH_MIGRATION.md](../AUTH_MIGRATION.md) for setup, database migration, endpoint replacements and validation. Python AI remains independent.

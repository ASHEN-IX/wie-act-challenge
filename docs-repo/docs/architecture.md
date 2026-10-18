# Architecture

See [TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md) for module boundaries and [ARCHITECTURE_ANALYSIS.md](ARCHITECTURE_ANALYSIS.md) for the before/after service inventory.

The API shell owns one Mongoose connection and one HTTP/WebSocket listener. Domain packages expose their validated application contracts, and the shared in-process client invokes those contracts without a network transport. Business models stay owned by their domain. Cross-module authorization still runs through the public contract. No module has a startup command or standalone Docker image.

The AI integration module owns job orchestration and the shared AI client owns outbound HTTP configuration. Python AI source and database contracts remain unchanged. RabbitMQ remains the async boundary for AI work, while Redis retains caching and request limiting.

The detailed discovery inventory is in [ARCHITECTURE_ANALYSIS.md](../../ARCHITECTURE_ANALYSIS.md). See [TARGET_ARCHITECTURE.md](../../TARGET_ARCHITECTURE.md) for the module mapping and external AI boundary, and [MIGRATION.md](../../MIGRATION.md) for validation and operational guidance.

## Authentication migration (2026-10-08)

Authentication is now owned by Better Auth hosted in Next.js. NestJS owns the backend listener, verifies HTTP-only sessions and enforces application authorization before dispatching domain modules. MongoDB stores new auth collections beside preserved domain users/profile data. Custom JWT/refresh flows are retired; see the root AUTH_MIGRATION_ANALYSIS.md and AUTH_MIGRATION.md for the current endpoint map, setup, migration and validation. Python AI remains independent.

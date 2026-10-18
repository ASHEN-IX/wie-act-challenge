# Study Partner AI — reusable EdNova foundation

Independent Python FastAPI and RabbitMQ workers. See [AI operations](../docs-repo/docs/ai-service.md) for compatible Python/Poetry setup, separate HTTP/worker launch, secrets and uploads; [AI specification](../docs-repo/docs/ai-specification.md) distinguishes actual agents/models/fallback from the PLANNED peer facilitator.

The audit implemented no AI features and did not change model configuration. Missing provider credentials may return mocks or deterministic fallbacks. See [executed validation](../audit/2026-10-18/VALIDATION.md) before relying on historical test/completion claims.

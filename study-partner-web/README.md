# Study Partner Web — reusable EdNova foundation

Next.js frontend in the parent pnpm workspace. From root: `pnpm install --frozen-lockfile`, `pnpm --filter study-partner-web dev` (:5173). API and web share database/auth secret; configure `BACKEND_URL` and a direct backend WebSocket URL or nginx edge. See [development](../DEVELOPMENT.md), [frontend guide](../docs-repo/docs/frontend-web.md) and [actual validation](../audit/2026-10-18/VALIDATION.md).

Better Auth engine runs in Next; Nest enforces backend sessions/domain policy. Institutional roles/official publication/facilitator UI are PLANNED. This audit changed no UI/runtime behavior. [Product specification](../docs-repo/docs/product-specification.md) records target flows and evidence limits.

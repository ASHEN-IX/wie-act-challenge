# EdNova — legacy Study Partner / MindFlow workspace

EdNova's proposed direction is an AI learning companion for individual and peer learning, with institution-managed courses and independent personal courses. This repository contains the reusable **MindFlow / Study Partner implementation**. Institutional roles, Course Studio review/publication, schema-selected interactive activities and AI-facilitated Study Together rooms are **PLANNED**, not delivered features. Existing gamification needs adaptation for verified learning evidence. Latest product direction: **v1.2**.

The 18 October 2026 audit changed documentation only. Existing UI names, packages, APIs and infrastructure identifiers remain unchanged. The baseline has build, lint, typecheck and test failures; see [executed validation](audit/2026-10-18/VALIDATION.md) before relying on older completion claims.

## Read first

| Need | Source of truth |
|---|---|
| v1.2 changes and implemented/missing matrix | [v1.2 alignment report](audit/2026-10-18/EDNOVA_V1_2_UPDATE.md) |
| Three-member task split and interface handoffs | [Team delivery plan](docs-repo/docs/team-delivery-plan.md) |
| Full audit, reuse/removal decisions and gaps | [Audit report](audit/2026-10-18/EDNOVA_AUDIT.md) |
| Product, scope and functional acceptance | [Product specification](docs-repo/docs/product-specification.md) |
| Current vs proposed permissions | [Roles and permissions](docs-repo/docs/roles-and-permissions.md) |
| Actual architecture / target adaptations | [Current architecture](ARCHITECTURE.md) / [target architecture](TARGET_ARCHITECTURE.md) |
| Actual schemas / conceptual additions | [Data model](docs-repo/docs/data-model.md) |
| Complete learner and instructor journeys | [Workflows](docs-repo/docs/workflows.md) |
| Agents, model categories, grounding and fallback | [AI specification](docs-repo/docs/ai-specification.md) |
| Prioritized work and evidence-based status | [Backlog](docs-repo/docs/sprint-backlog.md) |
| Tests to run / actual results | [Validation plan](docs-repo/docs/testing-plan.md) / [audit results](audit/2026-10-18/VALIDATION.md) |
| Organizer rules, artifacts, timing and business proposal | [Hackathon delivery](docs-repo/docs/hackathon-delivery.md) |
| Original PDF and full team brief | [Source references](docs-repo/docs/reference/README.md) |
| Setup / deployment | [Development](DEVELOPMENT.md) / [deployment](DEPLOYMENT.md) |

## Workspace

- `study-partner-web`: Next.js 16 App Router, React 18, TypeScript, Tailwind, Zustand and React Query; uploads, planning, evaluation, team study and legacy administration.
- `study-partner-api`: NestJS 12 shell on Express, seven in-process domains, MongoDB/Mongoose, cookie-session authorization, Redis and RabbitMQ integration.
- `study-partner-ai`: independent Python FastAPI service and separately launched RabbitMQ workers; ingestion, planner, scheduler, coach, evaluator, search and reflection.
- `docs-repo`: maintained documentation directory inside this repository. `docs/` retains AI contracts and operational runbooks.

Declared versions come from manifests, not a guarantee of external service availability. No framework, database or authentication migration is proposed for this audit.

## Local setup

Use Node **>=24**, pnpm **11.3.0**, Docker, and a separate compatible Python **>=3.11,<3.15** environment for AI. From the repository root:

```bash
pnpm install --frozen-lockfile
cp .env.example study-partner-api/.env
cp study-partner-web/.env.example study-partner-web/.env.local
pnpm test:infra:up
```

Before `pnpm dev`, follow [development configuration](DEVELOPMENT.md): test MongoDB/Mailpit listen on **27018/1026**, while examples default to **27017/1025**. Set matching database, auth secret, origins and mail settings in API and web. The API also requires broker configuration; test infrastructure alone does not supply RabbitMQ or Redis. Real AI requires the independently configured service **and** appropriate workers and model credentials. Without provider keys some existing AI paths mock or use deterministic fallbacks.

Web: `http://localhost:5173`; API health: `http://localhost:3000/api/v1/health`; OpenAPI: `http://localhost:3000/api/v1/docs`. These are configured endpoints, not a claim that the app has booted successfully here.

## Commands

| Command | Actual scope |
|---|---|
| `pnpm dev` | API and web development processes; does not start Python |
| `pnpm build` | API TypeScript and Next webpack production build |
| `pnpm lint` / `pnpm typecheck` | API and web checks; neither covers Python |
| `pnpm test` | API Jest + auth lifecycle, then web Vitest |
| `pnpm test:integration` | API integration suite; live-broker cases have opt-in gates |
| `pnpm test:e2e` | Auth/smoke Playwright launcher, not all browser specs |
| `pnpm test:infra:up` / `pnpm test:infra:down` | Dedicated test MongoDB and Mailpit |
| `pnpm docker:up` / `pnpm docker:down` | Main Compose stack using API env; separate AI lifecycle |

There is no root `pnpm format` script. See package manifests for package-level format commands. [Documentation index](docs-repo/docs/index.md) distinguishes maintained documentation from historical migration records; past checkmarks are not current validation.

## Confirmed team and next implementation

Habib owns Course Studio, Content and Access; Tasnim owns Individual Learning and Progress; Aziz owns Study Together and Collaboration. Each owns UI, API, data, AI and tests. The [named delivery plan](docs-repo/docs/team-delivery-plan.md) covers starting packages/reviews, the [canonical backlog](docs-repo/docs/sprint-backlog.md) gives technical steps for every task, and [target architecture](TARGET_ARCHITECTURE.md) records system choices, proposed interfaces, recovery and recommended improvements. No implementation dates are assumed.

# EdNova

AI-assisted university learning: instructor-reviewed courses, individual practice and peer study rooms. The repository contains reusable legacy features; the [backlog](docs/sprint-backlog.md) distinguishes existing code from unfinished EdNova requirements.

## Start here

Requirements: Node **24+**, pnpm **11.3.0**, Docker Compose. Python AI runs separately with **Python 3.11–3.14 and Poetry 2**.

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm dev:infra:up
pnpm dev:doctor
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Setup creates missing local environment files with shared random service/auth secrets and preserves existing files. Resolve any `doctor` failures before continuing. Infrastructure ports: PostgreSQL **5433**, RabbitMQ **5673** (management **15673**), Redis **6381**, SMTP **1026**, Mailpit UI **8026**. Stop an existing test stack before starting the dev stack; their PostgreSQL/Mailpit ports overlap.

`pnpm dev` starts the API and web only. See [development](docs/development.md) for Python HTTP/workers, provider configuration, uploads and testing. Local setup explicitly uses mock inference; real approved model access remains required for feature acceptance.

## Team

| Owner | Complete module |
|---|---|
| **Habib** | Course Studio, Content & Access |
| **Tasnim** | Individual Learning & Progress |
| **Aziz** | Study Together & Collaboration |

Each owns UI, API, data, AI and tests. Read the [team plan](docs/team-delivery-plan.md), pick a task from the [canonical backlog](docs/sprint-backlog.md), then follow its technical execution notes. Agree on shared contracts before dependent implementations and review changes with consuming module owners.

## Repository

```text
apps/web/            Next.js App Router frontend (React 19, shadcn/ui, Tailwind 4)
apps/api/            NestJS API, domain modules and shared Node packages
apps/ai/             Python AI HTTP service and workers (Poetry)
docs/                All project documentation, reference inputs and contracts
scripts/             Local setup and configuration checks
```

This is a **pnpm workspace** with applications organized cleanly under `apps/` (`apps/web`, `apps/api`, `apps/ai`). Install Node dependencies once from the root; internal packages use `workspace:*` and one `pnpm-lock.yaml`. Python keeps its own Poetry environment/lockfile in `apps/ai`.

| Command | Purpose |
|---|---|
| `pnpm dev:setup` / `pnpm dev:doctor` | Create missing local config / check prerequisites and shared settings |
| `pnpm dev:infra:up` / `pnpm dev:infra:down` | Start/stop local dependencies; volumes persist |
| `pnpm dev` / `pnpm dev:api` / `pnpm dev:web` | Run Node apps together or separately |
| `pnpm build` / `pnpm typecheck` / `pnpm lint` | Build and quality gates |
| `pnpm test` / `pnpm test:integration` / `pnpm test:e2e` | Node unit/auth, integration and browser tests |
| `pnpm generate:contracts` | Regenerate Nest adapters after domain-route changes |

[Frontend structure and migration scope](docs/frontend-web.md) · [Documentation](docs/README.md) · [Current architecture](docs/architecture.md) · [Target architecture](docs/target-architecture.md) · [Preparation results and remaining blockers](docs/audit/cleanup.md) · [Challenge submission report](docs/submission/TECHNICAL-REPORT.pdf)

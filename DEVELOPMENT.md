# Mindflow Development Guide

This guide describes how to set up, develop, test, and debug the Mindflow Next.js + NestJS monorepo locally.

---

## 1. Quick Start

### 1.1. Prerequisites
- **Node.js**: >= 24.0.0
- **pnpm**: 11.3.0
- **Docker**: For running MongoDB, Redis, and RabbitMQ dependencies

Activate pnpm 11.3.0 using Corepack:
```bash
corepack enable
corepack prepare pnpm@11.3.0 --activate
```

### 1.2. Environment Setup
```bash
# Copy example configuration to API and Web packages
cp .env.example study-partner-api/.env
cp study-partner-web/.env.example study-partner-web/.env.local
```

Ensure both `study-partner-api/.env` and `study-partner-web/.env.local` share:
- `MONGODB_URI` (or `DOCKER_MONGODB_URI`)
- `BETTER_AUTH_SECRET` (minimum 32-character secret)
- `AUTH_TRUSTED_ORIGINS` (`http://localhost:5173,http://localhost:8080`)

### 1.3. Install Dependencies
```bash
pnpm install --frozen-lockfile
```

---

## 2. Running Locally

### 2.1. Start Supporting Infrastructure
Run MongoDB and Mailpit via Docker:
```bash
pnpm test:infra:up
```
*(Starts MongoDB on port 27018 and Mailpit on 1026/8026).*

Or start the full local Docker environment (including Redis and RabbitMQ):
```bash
pnpm docker:up
```

### 2.2. Start the Development Servers
Start both the NestJS API and Next.js frontend concurrently:
```bash
pnpm dev
```

Or run packages individually:
```bash
# Start NestJS backend (runs on http://localhost:3000)
pnpm --filter study-partner-api dev

# Start Next.js frontend (runs on http://localhost:5173)
pnpm --filter study-partner-web dev
```

Access:
- **Frontend**: http://localhost:5173
- **NestJS API**: http://localhost:3000/api/v1/health
- **OpenAPI Docs**: http://localhost:3000/api/v1/docs

---

## 3. Monorepo Scripts & Commands

| Command | Action | Scope |
|---|---|---|
| `pnpm dev` | Run API and Next.js concurrently in development mode | Workspace |
| `pnpm build` | Compile NestJS TypeScript (`tsc`) and Next.js App Router | Workspace |
| `pnpm lint` | Run ESLint across backend modules and frontend sources | Workspace |
| `pnpm typecheck` | Run TypeScript checking and AST syntax checks | Workspace |
| `pnpm test` | Run all unit tests (Jest backend, Vitest frontend, Auth lifecycle) | Workspace |
| `pnpm test:integration` | Run backend integration tests with Supertest | API |
| `pnpm test:e2e` | Run Playwright browser end-to-end tests | Web |
| `pnpm format` | Run Prettier code formatting | API & Web |
| `pnpm test:infra:up` | Start test containers (MongoDB on 27018, Mailpit on 1026) | Workspace |
| `pnpm test:infra:down` | Stop test containers | Workspace |

---

## 4. Architectural Rules for Developers

1. **Modular Monolith Boundaries**:
   - Backend domain logic lives in `study-partner-api/modules/*`.
   - Never import another module's Mongoose models directly.
   - Use `moduleClient.call('moduleName', 'operation', params)` or injectable NestJS providers to interact across domains.
2. **NestJS Providers & Controllers**:
   - HTTP routes must be declared in NestJS Controllers with `@Controller()` and method decorators.
   - Business logic must reside in `@Injectable()` domain services.
   - All protected routes must use `@UseGuards(SessionGuard)`.
3. **Next.js App Router**:
   - File-system routes live in `study-partner-web/app/*`.
   - Use Server Components by default; only add `'use client'` where interactive state, event handlers, or browser APIs are required.
   - Route data fetching through `src/services/api.js` or React Query.
4. **Independent Python AI Service**:
   - The Python AI service in `study-partner-ai` is operated independently.
   - Never import Python scripts into Node.js; communicate only via `shared/aiClient.js` and RabbitMQ queues.

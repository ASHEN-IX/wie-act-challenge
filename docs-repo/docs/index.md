# Docs

Welcome. MindFlow is a full-stack study-assistance platform split across three
code repositories:

| Repository | Layer | Stack |
|-----------|-------|-------|
| `study-partner-web` | Frontend | React (JSX) + Vite, Tailwind, shadcn/ui, vitest, Playwright |
| `study-partner-api` | Backend | Node 20 / Express microservices, MongoDB 7 (Mongoose), Redis, RabbitMQ |
| `study-partner-ai` | AI | Python 3.12 (FastAPI), multi-agent, RabbitMQ job bus, LiteLLM |

This index is the single entry point for all documentation.

## Contents

1. [Architecture](architecture.md) — the full platform: repos, services, ports,
   request flow from browser to AI.
2. [AI Service](ai-service.md) — AI repo: setup, `.env`, running agents/workers,
   testing.
3. [LLM Configuration](llm-config.md) — per-agent model routing via
   `litellm/config.yaml`, keys, mock/fallback behaviour.
4. [Backend API](backend-api.md) — API repo: microservices, ports, shared
   package, endpoints, Docker Compose, setup.
5. [Frontend Web](frontend-web.md) — web repo: stack, key pages, data access &
   auth, scripts, testing.
6. [Sprint Backlog](sprint-backlog.md) — feature-based sprint backlog
   (F01–F14): user stories, story format, acceptance criteria.
7. [Implementation Tracker](implementation-tracker.md) — live progress
   (e.g. `F03 AI Coach 8/16`) against the backlog.
8. [Reference](reference/agents-dataflow-report.md) — detailed runtime data
   flows, persistence, observability (AI services).

## Request flow at a glance

```
Browser  (study-partner-web, Vite dev :5173)
   │  /api/* through Vite proxy
   ▼
API Gateway  (study-partner-api :3000)
   │  route + rate-limit + JWT
   ▼
Microservices  (:3001–:3007)
   auth · user-profile · study · ai-orchestrator ·
   signal-processing · analytics · notification     (+ Redis)
   │  ai-orchestrator (:3004) proxies AI calls
   ▼
Python AI  (study-partner-ai :8000, FastAPI)
   agents · RabbitMQ job bus · LiteLLM (per-agent model routing)
```

## Reading order

- New to the project → **Architecture**, then one layer doc at a time
  (**Backend API**, **Frontend Web**, **AI Service**).
- Working on AI features → **LLM Config** + the tracker.
- Planning/tracking work → **Sprint Backlog** + **Implementation Tracker**.
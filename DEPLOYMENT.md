# Deployment Guide

This document describes how to deploy the Mindflow full-stack application (Next.js frontend + NestJS backend modular monolith + independent Python AI service) across development, testing, and production environments.

---

## 1. System Architecture

The deployed system consists of:

```
                           Internet / Clients
                                   │
                                   ▼
                         ┌───────────────────┐
                         │    Nginx Edge     │ (:80 / :443)
                         └─────────┬─────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │ HTTP / Static Assets            │ WebSocket (/ws/) & /api/v1
                  ▼                                 ▼
       ┌─────────────────────┐           ┌─────────────────────┐
       │   Next.js (Web)     │           │    NestJS (API)     │
       │  Standalone Server  │           │  Modular Monolith   │
       │     (:5173)         │           │      (:3000)        │
       └──────────┬──────────┘           └──────────┬──────────┘
                  │                                 │
                  │ /api/auth                       │ Domain Handlers
                  ▼                                 │
         Better Auth Engine ────────────────────────┤
                                                    │
                      ┌─────────────────────────────┼─────────────────────────────┐
                      │                             │                             │
                      ▼                             ▼                             ▼
              ┌───────────────┐             ┌───────────────┐             ┌───────────────┐
              │    MongoDB    │             │     Redis     │             │   RabbitMQ    │
              │  (:27017/srv) │             │    (:6379)    │             │    (:5672)    │
              └───────────────┘             └───────────────┘             └───────┬───────┘
                                                                                  │ Async Jobs
                                                                                  ▼
                                                                     ┌────────────────────────┐
                                                                     │   Independent Python   │
                                                                     │       AI Service       │
                                                                     │      (:8000)           │
                                                                     └────────────────────────┘
```

---

## 2. Prerequisites

- **Node.js**: >= 24.0.0
- **pnpm**: 11.3.0 (`corepack enable && corepack prepare pnpm@11.3.0 --activate`)
- **Docker & Docker Compose**: v2.20+
- **MongoDB**: v7.0+ (Local Docker container or hosted MongoDB Atlas)
- **Redis**: v7.0+
- **RabbitMQ**: v3.12+

---

## 3. Environment Variables Configuration

Copy the example environment files:

```bash
# Core Application (NestJS & Next.js)
cp .env.example study-partner-api/.env
cp study-partner-web/.env.example study-partner-web/.env.local

# Independent AI Service (Optional, if running locally)
cp .env.ai.example .env.ai
```

### Critical Production Variables

| Variable | Description | Example / Required Format |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | API listen port | `3000` |
| `MONGODB_URI` / `DOCKER_MONGODB_URI` | Connection URI to MongoDB | `mongodb+srv://user:pass@cluster.mongodb.net/study_partner` |
| `BETTER_AUTH_SECRET` | 32+ character random secret for signing sessions | Generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public origin of the Next.js frontend | `https://app.mindflow.example.com` |
| `AUTH_TRUSTED_ORIGINS` | Comma-separated list of allowed origins | `https://app.mindflow.example.com` |
| `INTERNAL_API_SECRET` | Secret for machine-to-machine internal calls | Generate with `openssl rand -hex 32` |
| `RABBITMQ_URL` | RabbitMQ connection string | `amqp://user:pass@rabbitmq:5672/mindflow` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `AI_SERVICE_URL` | Base URL of independent AI service | `http://host.docker.internal:8000` or remote URL |
| `STRIPE_SECRET_KEY` | Stripe secret key for subscriptions | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `SMTP_HOST` | Production SMTP host | `smtp.sendgrid.net` |
| `SMTP_PORT` | Production SMTP port | `587` |

---

## 4. Docker Deployment

### 4.1. Development & Local Stack

To launch the full local environment including databases, message bus, API, frontend, and development mailpit:

```bash
# 1. Start core stack
docker compose --env-file study-partner-api/.env up -d --build

# 2. Check service status
docker compose ps
```

Services exposed:
- **Web UI & Edge**: `http://localhost:8080`
- **NestJS Direct API**: `http://localhost:3000`
- **Mailpit Web UI**: `http://localhost:8025`
- **RabbitMQ Management**: `http://localhost:15672`

### 4.2. Production Deployment

Production uses `docker-compose.yml` overlayed with `docker-compose.prod.yml`:

```bash
docker compose \
  --env-file study-partner-api/.env \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  up -d --build
```

Key production optimizations enabled:
1. **Multi-stage builds**:
   - `Dockerfile`: Compiles TypeScript to `dist/`, prunes development dependencies, packages minimal Alpine runner.
   - `study-partner-web/Dockerfile`: Uses Next.js `output: 'standalone'`, exporting only necessary node_modules, static assets, and pre-rendered pages.
2. **Resource limits**: API container bounded to 1GB RAM and 2.0 CPUs.
3. **Hardened security**: Non-root execution, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`, and unprivileged nginx edge proxy.

### 4.3. Independent AI Service Deployment

The Python AI service in `study-partner-ai` is operated independently:

```bash
# Start AI service container independently
docker compose --env-file .env.ai -f docker-compose.ai.yml up -d --build
```

If the AI service is hosted remotely, simply point `AI_SERVICE_URL` in `study-partner-api/.env` to the remote AI endpoint. The NestJS backend remains fully functional even when the AI service is temporarily unavailable.

---

## 5. Health Checks & Monitoring

The deployment includes comprehensive health check endpoints:

- **Edge / API Readiness**:
  ```bash
  curl -fsS http://localhost:3000/api/v1/health
  # Response: {"status":"healthy","service":"study-partner-api","timestamp":"..."}
  ```
- **Subsystem & AI Connectivity**:
  ```bash
  curl -fsS http://localhost:3000/api/v1/monitoring/health
  # Response includes MongoDB connection status, domain module statuses, and independent AI service reachability.
  ```
- **Prometheus / System Metrics** (Internal secret protected):
  ```bash
  curl -H "x-internal-secret: <INTERNAL_API_SECRET>" http://localhost:3000/api/v1/monitoring/metrics
  ```

---

## 6. Zero-Downtime Updates & Rollback

### Rollback Strategy

1. **Database Backward Compatibility**:
   - The MongoDB database schema is fully backward-compatible.
   - Better Auth user tables live alongside existing models with preserved ObjectIds.
2. **Container Rollback**:
   ```bash
   # Revert to previous image tag if needed:
   docker compose down
   # Switch git commit / checkout previous tag
   docker compose --env-file study-partner-api/.env up -d
   ```
3. **Graceful Shutdown**:
   - NestJS traps `SIGTERM` and `SIGINT`, stopping incoming HTTP requests, draining active WebSocket sessions, and finishing in-flight RabbitMQ worker consumers before closing database handles.

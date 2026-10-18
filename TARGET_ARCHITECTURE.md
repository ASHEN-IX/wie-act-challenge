# Target Architecture: Next.js + NestJS Modular Monolith

Status: **IMPLEMENTED & VERIFIED**

---

## 1. High-Level Architecture Diagram

```mermaid
graph TD
    Browser["Web Browser (User Client)"]
    
    subgraph Edge["Edge & Ingress Layer"]
        Nginx["Nginx Reverse Proxy (:80 / :443)"]
    end
    
    subgraph Frontend["Next.js Frontend Application (:5173)"]
        AppRouter["App Router (app/)<br/>Pages, Layouts, Metadata"]
        ClientComp["Client Components<br/>Zustand Stores, Interactive UI"]
        AuthHandler["Route Handler (/api/auth/[...all])<br/>Better Auth Engine"]
        ProxyRewrites["Next.js Rewrites (/api/v1/*, /uploads/*)"]
    end
    
    subgraph Backend["NestJS Backend Monolith (:3000)"]
        Bootstrap["createNestApp() Bootstrap"]
        SessionGuard["SessionGuard<br/>Cookie Identity Resolver"]
        
        subgraph Controllers["NestJS Controllers"]
            InfraCtrl["InfrastructureController"]
            AuthCtrl["AuthController"]
            UsersCtrl["UsersController"]
            StudyCtrl["StudyController"]
            AiCtrl["AiController"]
            SignalsCtrl["SignalsController"]
            AnalyticsCtrl["AnalyticsController"]
            NotifCtrl["NotificationsController"]
        end
        
        subgraph Providers["Domain Services & Providers"]
            AuthSvc["AuthService"]
            UsersSvc["UsersService"]
            StudySvc["StudyService"]
            AiSvc["AiService"]
            SignalsSvc["SignalsService"]
            AnalyticsSvc["AnalyticsService"]
            NotifSvc["NotificationsService"]
        end
        
        WSServer["WebSocket Server (/ws/)<br/>Real-time Events"]
        WorkerPool["Background Workers<br/>Pollers & Consumers"]
    end
    
    subgraph Storage["Data & Message Infrastructure"]
        MongoDB[("MongoDB 7<br/>Shared Database")]
        Redis[("Redis 7<br/>Cache & Rate Limiting")]
        RabbitMQ[("RabbitMQ 3<br/>Job Queues & DLQs")]
    end
    
    subgraph External["External Services"]
        PythonAI["Python FastAPI AI Service (:8000)<br/>INDEPENDENT SERVICE"]
        StripeAPI["Stripe Payment Gateway"]
        SMTPService["SMTP / Mailpit"]
    end
    
    Browser -->|HTTP Requests| Nginx
    Browser -->|WebSocket Connection| Nginx
    
    Nginx -->|/ & UI Routes| AppRouter
    Nginx -->|/api/auth/*| AuthHandler
    Nginx -->|/api/v1/*| Bootstrap
    Nginx -->|/ws/*| WSServer
    
    AppRouter --> ClientComp
    ProxyRewrites -->|Internal HTTP Proxy| Bootstrap
    AuthHandler --> MongoDB
    AuthHandler --> SMTPService
    
    Bootstrap --> SessionGuard
    SessionGuard --> Controllers
    Controllers --> Providers
    
    Providers --> MongoDB
    Providers --> Redis
    Providers --> RabbitMQ
    
    AiSvc -->|HTTP REST Client| PythonAI
    RabbitMQ <-->|Async Ingestion / Plan Jobs| PythonAI
    
    AuthSvc --> StripeAPI
    NotifSvc --> WSServer
```

---

## 2. Key Architectural Tenets

1. **Modular Monolith**:
   - The entire backend is consolidated into a single deployable application with a single server entrypoint (`study-partner-api/src/main.js`).
   - Domain modules (`auth`, `users`, `study`, `ai-orchestrator`, `signal-processing`, `analytics`, `notification`) maintain strict domain boundaries without running independent microservice processes.
2. **Next.js App Router**:
   - The frontend leverages modern Next.js conventions with file-system routing, Server Components where appropriate, and selective `'use client'` interactive component leaves.
   - Built-in rewrites transparently route API traffic to NestJS while maintaining cookie credentials.
3. **Independent Python AI Service**:
   - The Python AI service in `study-partner-ai` is intentionally **NOT** merged into NestJS.
   - It maintains its own runtime, dependencies, database connections, and RabbitMQ message consumers.
   - Communication between NestJS and the AI service occurs strictly over an abstracted HTTP client and asynchronous message queues.
4. **Authoritative Security**:
   - Authentication is unified around HTTP-only session cookies via Better Auth.
   - Authorization is strictly enforced in the NestJS backend via `SessionGuard` and domain policies.
5. **pnpm Workspace Monorepo**:
   - Monorepo dependencies are strictly managed with `pnpm 11.3.0` and `pnpm-workspace.yaml`.
   - Node packages link via `workspace:*` references; all npm lockfiles are eliminated.

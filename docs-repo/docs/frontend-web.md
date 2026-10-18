# Frontend Web — study-partner-web

React single-page application (Vite). All user-facing functionality lives
here: onboarding, studying, gamification, social, and admin.

**Repo:** `study-partner-web/` (React, Vite, Tailwind CSS + shadcn/ui, vitest,
Playwright, Axios)

## Stack

- **Build/dev** — Vite (`:5173` in dev) with proxying of `/api` →
  `http://localhost:3000` and `/ws` (WebSocket) to the gateway
- **UI** — React (JSX), Tailwind CSS, shadcn/ui component set
  (`components.json`), Framer-style custom backgrounds
- **State** — Zustand-style stores (`src/store`) + React context
- **Data** — one shared Axios instance, JWT via httpOnly cookies
- **Tests** — vitest (unit/integration) + Playwright (e2e in `e2e/`)

## Project structure

```
study-partner-web/
├─ src/
│  ├─ pages/          # route-level screens (see below)
│  ├─ components/     # shared + shadcn/ui components
│  ├─ services/       # api.js, voiceChatService.js, webrtcService.js
│  ├─ store/          # app stores incl. authStore (refresh-race guard)
│  ├─ context/ hooks/ lib/ utils/
│  ├─ __tests__/ tests/
├─ e2e/               # Playwright end-to-end specs
├─ public/  index.html  vite.config.mjs  playwright.config.js
└─ vitest.config.js  tailwind.config.js  postcss.config.js
```

Path aliases: `@` → `src`, plus `@components/@pages/@ui/@api/@hooks/@context/@utils`.

## Key areas (src/pages)

- **Auth/onboarding** — Register, Login, Forgot/Reset Password, Verify Email,
  Landing, Home, Pricing
- **Studying** — Dashboard, StudyPlanner, StudySession(+Setup), Tasks, Review
  Center, Subjects / SubjectDetail, Sessions, Calendar
- **AI** — AISearch (LLM-backed search), voice chat
- **Gamification & social** — Characters, CharacterSelection, Store/Checkout
  (Stripe), Leaderboard, Friends, Lobby/TeamLobby
- **Profile & admin** — Profile, Admin (Dashboard, Users, Analytics, Coupons,
  Subscriptions)

## Data access & auth

`src/services/api.js` creates an axios instance:

- `baseURL = import.meta.env.VITE_API_URL || ""` (empty → same-origin `/api/*`
  via the Vite proxy in dev)
- `withCredentials: true` (httpOnly `accessToken`/`refreshToken` cookies)
- 180s timeout for long operations (e.g. study-plan creation)
- `authStore` runs a **single-flight** refresh (`POST /api/v1/auth/refresh`) so
  concurrent 401s share one promise instead of racing

Websocket/real-time imports (`/ws`) power chat and cooperative features
(`webrtcService`, `voiceChatService`).

## Environment

```dotenv
# .env (from .env.example)
VITE_API_URL=            # empty = same-origin /api via proxy (recommended with Docker)
VITE_BYPASS_TASK_TIMING_GATE=false   # dev only, matches backend BYPASS_TASK_TIMING_GATE
```

## Scripts

| Command | Purpose |
|---------|---------|
| `pnpm start` / `pnpm dev` | Vite dev server (`:5173`) |
| `pnpm build` / `pnpm preview` | Production build / preview |
| `pnpm test`, `pnpm test:unit`, `pnpm test:integration` | vitest |
| `pnpm test:smoke` | Playwright e2e |
| `pnpm lint` / `pnpm format( check)` | ESLint / Prettier |

## Deployment

Dockerfile + `nginx.conf` serve the built app; the Vite proxy approach means
`VITE_API_URL` stays empty and nginx routes `/api` + `/ws` to the API Gateway
(`:3000`). Also configured for Vercel (`vercel.json`).
## Authentication migration (2026-10-08)

Authentication is now owned by Better Auth hosted in Next.js. NestJS owns the backend listener, verifies HTTP-only sessions and enforces application authorization before dispatching domain modules. MongoDB stores new auth collections beside preserved domain users/profile data. Custom JWT/refresh flows are retired; see the root AUTH_MIGRATION_ANALYSIS.md and AUTH_MIGRATION.md for the current endpoint map, setup, migration and validation. Python AI remains independent.

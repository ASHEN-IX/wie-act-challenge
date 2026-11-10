# Noveris demo guide

> The scripted, resettable demo (isolated stack, seed, recorder, voice-over script) lives in [`demo/`](../../demo/README.md). This page is the manual walkthrough.

All data is synthetic. The demo accounts exist only in a local database seeded by the repository.

## Start

```bash
pnpm install --frozen-lockfile
pnpm dev:setup
pnpm dev:infra:up
pnpm --filter api db:setup
pnpm dev:ai            # separate terminal: Python AI service
ALLOW_DEMO_COURSES=1 pnpm seed
pnpm dev
```

Open <http://localhost:3000/login>. A fresh setup runs inference in explicit mock mode; see [model configuration](../llm-config.md) to enable real calls with a bounded approval.

If seeding fails with `LengthMismatch` (P2000), the database predates the UUID schema: use a fresh one (`prisma migrate reset` on a disposable database).

## Accounts

Password for all: `EdNovaDemo!2026` (local only).

| Role | Email |
| --- | --- |
| Administrator | admin@ednova.test |
| Instructor | instructor@ednova.test |
| Learner | learner@ednova.test |
| Second learner | peer@ednova.test |

## Suggested 90-second walkthrough

1. **Learner** → course *Relational Database Design & Normalization* → read a lesson, use *Explain simply* / *Step by step*, request a hint before the full answer.
2. **Visual Lab** → *Demo: Shortest paths in weighted graphs* → Explore; change edge weights.
3. **Study Together** → create a room on the course, join as the second learner in a private window, submit private checks, ask for a hint from the facilitator, open the debrief.
4. **Capacity behaviour** → with mock mode or no approval, show the labelled unavailable/fallback state; with a bounded approval show `REAL_APPROVED`.
5. **Instructor** → Insights dashboard and Course Studio (upload → review → publish).

Browser-based room tests need separate cookie contexts (two profiles or a private window).

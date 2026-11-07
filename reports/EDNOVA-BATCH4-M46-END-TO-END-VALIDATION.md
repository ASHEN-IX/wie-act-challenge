# EdNova Batch 4 — M4.6 End-to-End Validation

Commands, counts, real-service browser evidence, performance and the historical
issues carried forward.

---

## 1. Environment

| Component | Value |
|---|---|
| Git | `96d5475`, working tree clean apart from 3 unrelated landing files |
| MongoDB | `ednova-qa-mongo`, mongo:7.0.43, `127.0.0.1:27017` |
| RabbitMQ | `rabbitmq`, 3-management, healthy |
| Redis | `ednova-qa-redis` |
| Python service | `ednova-api-ai-service` (provider SDK stubbed) |
| Docker network | `ednova-api_default` |
| Node | v24.20.0 |

---

## 2. Commands

```bash
cd apps/api && npx jest modules src shared --runInBand
cd apps/web && npx vitest run --maxWorkers=2
cd apps/api && npx tsc -p tsconfig.check.json --noEmit
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsc                                    # production build
cd apps/web && npx next build --webpack                   # production build
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m43-budget-proof.ts
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m45-concurrency-proof.ts
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m46-recovery-proof.ts
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m45-load-test.ts
docker run --rm --entrypoint /bin/sh -v "$PWD/apps/ai:/app:ro" -w /app \
  ednova-api-ai-service -c "/opt/venv/bin/python -m pytest tests/ -q"
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm --filter web exec playwright test --config playwright.m41.config.ts
```

---

## 3. Results

| Suite | Result |
|---|---|
| API unit | **1,164 / 1,164**, 79 suites |
| Web unit | **214 / 214**, 32 files |
| Browser (real services) | **6 / 6** |
| Python boundary | 20 / 20 |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |
| API production build | exit 0, 22 files |
| Web production build | success |
| M4.3 accounting proof | ALL SCENARIOS MATCH (10) |
| M4.5 concurrency proof | 2 / 2 |
| M4.6 recovery proof | refund verified |

---

## 4. Browser evidence

`reports/evidence/batch4-m41/`:

| File | Shows |
|---|---|
| `01-deterministic-reader.png` | Read mode, no plan, source-faithful |
| `02-validated-plan.png` | AI-arranged plan with learner-facing label |
| `03-rejected-plan-fallback.png` | invalid plan → deterministic fallback |
| `04-mode-selector.png` | all five modes, Read active |
| `05-guided-mode.png` | Guided rendering the same lesson |
| `06-adaptation-suggestion.png` | explained suggestion, no auto-navigation |
| `07-mobile-640.png` | **reflow at 640 px, no overflow** |

The six browser scenarios cover: deterministic reading; a validated plan
rendering through the trusted registry; hostile plans rejected with fallback;
five-mode selection; evidence-based suggestion with dismiss/disable and
cross-user isolation; and keyboard/reflow/touch-target accessibility.

All run against **real BetterAuth, real NestJS, real MongoDB** — not a preview
fixture.

---

## 5. Performance

M4.5 harness re-run (plan availability, the work a page load performs):

| Concurrency | p50 | p95 | p99 | Errors | Event-loop lag |
|---|---|---|---|---|---|
| 1 | 0.76 ms | 1.21 ms | 10.8 ms | 0 | +0.34 ms |
| 10 | 3.45 ms | 7.01 ms | 13.3 ms | 0 | +0.24 ms |
| 25 | 7.37 ms | 12.6 ms | 25.9 ms | 0 | +0.25 ms |
| repeat hits | 2.15 ms | 4.78 ms | 6.08 ms | 0 | +0.18 ms |

**Provider inference time remains unmeasured** — no live call exists to time.
Full end-to-end browser latency (auth + page + render) is roughly 20 s per
scenario including Playwright overhead, which is not a meaningful service
metric and is not reported as one.

Local, single-process, bounded. **Not a production capacity figure.**

---

## 6. Historical issues

### C1 — Batch 3 extraction assertions

**Status: OPEN, and now better understood.** Prior reports attributed the two
failing assertions to "wrong hierarchy". Traced this milestone:

- The parser demonstrably produces 2 chapters for the reference course and 2
  sections for networking (600-line probe, M4.1 closure).
- The **normalizer** groups by `sub.chapter`; the networking PDF declares no
  chapter headings, so both sections correctly become one topic.
- The assertion reads `chapters.flatMap(c => c.lessons)` — topic-level — while
  expecting section-level titles.

So one case is genuinely a wrong-layer assertion. The reference-course case —
where direct parsing yields 2 chapters but the published artifact showed 1 — was
**not** resolved this milestone, and it may be extraction behaviour rather than
a test defect. Recording it as open rather than asserting "definitely the test"
is the honest position.

Not fixed here: correcting it requires deciding which layer owns the fact and
rewriting assertions against the published artifact, which needs ingestion to
run successfully end-to-end in this environment.

### C2 — Nardouch loading mismatch

**Status: OPEN, owned by Nardouch.** Visible in `04-mode-selector.png` as
"Loading your course companion…" because the QA fixture has no Nardouch route.
Pre-existing, untouched, and not this milestone's to fix.

### C4 — Legacy `experiencePlanner.ts`

**Status: OPEN, and the M4.5 assumption is wrong.** It is still imported by
`modules/study/src/tests/semantic-content.test.ts`, so it is dead production
code but **live test code**. It cannot be deleted without rewriting that suite.
Recorded as a real cleanup prerequisite rather than a trivial delete.

---

## 7. Load and failure-injection limitations

| Scenario | Status |
|---|---|
| Plan availability under load | **TESTED** (§5) |
| Full reader delivery under load | NOT TESTED |
| Provider AI-service outage | Because the provider is stubbed, an outage cannot be induced meaningfully; the code path is covered by unit tests |
| MongoDB outage mid-request | NOT TESTED — no controlled outage injected |
| Browser-level failure injection | NOT TESTED |

Failure behaviour is asserted at unit and integration level (fallback paths,
typed refusals, deterministic reader) rather than by taking infrastructure down.
That distinction is reported rather than glossed.

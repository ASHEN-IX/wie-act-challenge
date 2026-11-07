# EdNova Batch 4 — M4.3 Integration Validation

**Question this answers:** do Node and Python behave correctly *together*? The
original double-debit escaped because each was tested alone.

---

## 1. Exact environment

| Component | Value |
|---|---|
| MongoDB | `mongodb://127.0.0.1:27017` (container `ednova-qa-mongo`, mongo:7.0.43) |
| Docker network | `ednova-api_default` (Python container and Mongo joined) |
| Python service | `ednova-api-ai-service`, entrypoint `/opt/venv/bin/python` |
| Provider SDK | **stubbed** — `genai.Client` replaced in-process, zero network |
| Database | `test_m43_cross_<hex>`, dropped after the run |
| Node | the real `planningBudget` module, no mocks |

Both services reach the **same** MongoDB instance. There is no simulated ledger
and no third accounting implementation: Node calls the production budget module,
Python runs the production router.

---

## 2. Commands executed

```bash
# combined proof
cd apps/api
docker network connect ednova-api_default ednova-qa-mongo
npx tsx --tsconfig tsconfig.json scripts/m43-cross-service-proof.ts

# Python boundary
docker run --rm --entrypoint /bin/sh -v "$PWD/apps/ai:/app:ro" -w /app \
  ednova-api-ai-service -c "/opt/venv/bin/pip install -q pytest pytest-asyncio httpx \
  && /opt/venv/bin/python -m pytest tests/test_experience_planner_dispatch.py -q"

# regressions
npx jest modules src shared --runInBand
cd ../web && npx vitest run --maxWorkers=2
npx tsc -p tsconfig.check.json --noEmit      # API
npx tsc --noEmit                              # web
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm exec playwright test --config playwright.m41.config.ts
```

---

## 3. Scenario matrix — real database state

Source: `reports/evidence/batch4-m43/cross-service-accounting.json`
(gitignored as evidence, reproduced by the command above).

| # | Scenario | Reservations | Dispatches | Ledger | Expected | Result |
|---|---|---|---|---|---|---|
| 1 | Reported usage 150 | 1 | **1** | 0 → **150** | 150 | **PASS** |
| 2 | No usage report | 1 | 1 | 0 → 32,768 | 32,768 | **PASS** |
| 3 | Timeout after dispatch | 1 | 1 | 0 → 32,768 | 32,768 | **PASS** |
| 4 | Insufficient headroom | 1 | **0** | 1,000,001 → 1,000,001 | unchanged | **PASS** |
| 5 | Exactly sufficient headroom | 1 | **1** | 967,232 → **967,382** | 967,382 | **PASS** |
| 6 | Two concurrent, budget for one | **1** | 0 | 967,232 → 1,000,000 | 1,000,000 | **PASS** |
| 7 | Duplicate idempotency identity | 1 | 0 | 0 → 32,768 | 32,768 | **PASS** |
| 8 | Worker interruption | 1 | 0 | 0 → 32,768 | 32,768 | **PASS** |
| 9 | Invalid reservation identity | **0** | **0** | 0 → 0 | 0 | **PASS** |
| 10 | Python eligibility failure | **0** | **0** | 0 → 0 | 0 | **PASS** |

**10 / 10 pass.**

### What the numbers mean

- **#1** — the double-debit check. Before the M4.3 fix this row read `300`.
- **#5** — the boundary this review found. Python now *dispatches* (1) instead of
  refusing, and the ledger lands on initial + actual usage. This row failed
  before the correction.
- **#6** — concurrent attempts: exactly one reservation won, so the ledger is
  exactly the limit, not over.
- **#4 / #9 / #10** — the refusal cases charge nothing and dispatch nothing.

---

## 4. Evidence format

Each row carries the required machine-readable shape:

```json
{
  "scenario": "exactly sufficient headroom",
  "attempt_id": "req-exact-xxxx",
  "reservation_count": 1,
  "provider_dispatch_count": 1,
  "initial_used_tokens": 967232,
  "final_used_tokens": 967382,
  "expected_used_tokens": 967382,
  "result": "PASS"
}
```

Attempt ids are sanitised (the run token is replaced with `xxxx`). No credential
is logged: the stub key is a literal `"stub-key-not-real"` and never appears in
output.

---

## 5. Failures encountered during validation (and their causes)

Recording these because two of them initially looked like service defects.

| Symptom | Cause | Kind |
|---|---|---|
| Exact-budget scenario refused | probe computed its own `expiresAt`, which failed the `$eq` approval match | **harness bug** |
| Exact-budget scenario refused after that fix | `_budget_active` was never stubbed, so it read absent container env | **harness bug** |
| `MongoServerSelectionError: Missing required sub-document 'driver'` | implicit driver connect under Jest | **harness bug** (fixed with explicit `connect()`) |
| Exact-budget genuinely refused | `usedTokens + RESERVED <= limit` | **real defect** |

The first three were corrected in the harness, not the service. Only the fourth
was a product defect, and it is the one this review was asked to find.

---

## 6. Limitations, stated plainly

- The provider is stubbed. This proves **accounting and control flow**, not
  provider behaviour.
- The Python container runs the router in-process against the real databases; it
  is not exercised over HTTP. The control-flow guarantees (who reserves, who
  reads, who refuses) are what is under test, and they are identical on that path.
- Evidence files live under `reports/evidence/`, which is gitignored. The JSON is
  reproducible with one command, and its content is transcribed above.

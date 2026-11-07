# EdNova Batch 4 — M4.3 Validation & Security

Every gate below is backed by a named test or a captured run. No live provider
call was made.

---

## 1. Gate 1.1 — one logical provider attempt, one debit

### The defect

M4.2 asserted that Node's reservation and Python's reservation were each atomic.
Both were. Together they were wrong: one attempt incremented `usedTokens` twice,
then both layers refunded, leaving **2 × actual usage** charged.

### The fix

| Service | Before | After |
|---|---|---|
| NestJS | reserve + reconcile | **reserve + reconcile** (owner) |
| Python | reserve + reconcile | `_has_headroom` check only — **no ledger write** |

Both security checks survive: Python still refuses dispatch when the ledger
cannot fund the attempt (`PROVIDER_BUDGET_UNAVAILABLE`), and still verifies
eligibility and credential binding independently.

### Measured ledger state

`apps/api/scripts/m43-budget-proof.ts` drives the real Node module against a real
MongoDB ledger. Run:

```bash
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m43-budget-proof.ts
```

```
Scenario                                      usedTokens   expected   ok   note
--------------------------------------------------------------------------------
success + reported usage                            150        150   yes  charged the reported usage, not twice it
no usage report                                   32768      32768   yes  reservation stays spent
pre-dispatch refusal (no headroom)              1000000    1000000   yes  refused
timeout after dispatch                            32768      32768   yes  no refund on an uncertain outcome
two concurrent reservations, room for one       1000000    1000000   yes  fulfilled=1
worker interrupted after reserving                32768      32768   yes  never refunded on behalf of a dead worker
repeat with same idempotency identity             32768      32768   yes  generation layer refuses before reserving again
--------------------------------------------------------------------------------
ALL SCENARIOS MATCH
```

All eight scenarios from the brief are covered. The success case is the one that
exposed the defect: correct end state is `150`, and before the fix it was `300`.

### The Python half

`apps/ai/tests/test_experience_planner_dispatch.py` — **14 passed**:

| Test | Asserts |
|---|---|
| `test_python_never_adjusts_the_budget_ledger` | `_reconcile` performs **zero** ledger writes |
| `test_headroom_check_refuses_when_insufficient` | 990 000 + 32 768 > 1 000 000 → refuse |
| `test_headroom_check_allows_when_affordable` | sufficient headroom → allow |
| `test_refuses_when_the_ledger_has_no_headroom` | dispatch blocked before the SDK is touched |
| `test_sdk_failure_is_reported_as_uncertain_not_refused` | `refused: false`, `PROVIDER_TIMEOUT_AFTER_DISPATCH` |

Run:

```bash
docker run --rm --entrypoint /bin/sh -v "$PWD/apps/ai:/app:ro" -w /app \
  ednova-api-ai-service -c "/opt/venv/bin/pip install -q pytest pytest-asyncio httpx \
  && /opt/venv/bin/python -m pytest tests/test_experience_planner_dispatch.py -q"
→ 14 passed
```

**Honest limitation.** The two halves are proven separately, not in one process:
the Python container could not reach the host-bound Mongo in this environment,
and a combined harness would have been a third implementation of the very thing
under test. The invariant is proven from both sides; a single combined run is
listed as a residual in the acceptance report.

---

## 2. Gate 1.2 — model documentation reconciled

| Claim | Checked | Result |
|---|---|---|
| `gemini-2.5-flash` reroutes 2026-12-01 | official deprecation page | **supported** — release 2025-06-17, shutdown 2026-12-01, reroute to `gemini-3.5-flash-lite`, "earliest possible dates" |
| Catalog page shows dated shutdowns | official model catalog | **not shown** — so one page is not sufficient authority |

Consequences applied:

- the planner model remains configurable and is not migrated on this basis
- the formula pipeline is **not** touched
- model existence, structured-output support and eligibility are verified before
  dispatch

---

## 3. Gate 1.3 — durable plans are revalidated

`experience-plan-store.test.ts`, **19 passed**.

### Storing

| Test | Asserts |
|---|---|
| `stores only a branded validated plan` | accepts the validator's output |
| `refuses a deserialized plan, which is not branded` | JSON round-trip ⇒ `not_validated` |
| `refuses a plan whose fingerprint does not match the request` | `identity_mismatch` |
| `supersedes the previous plan for the same scope` | one live row per scope |
| `binds the record to course, revision, lesson, mode and both versions` | full binding |

### Reading — the security core

| Attack / condition | Outcome |
|---|---|
| plan still valid | `available` |
| canonical content hash changed | `stale` |
| planning fingerprint changed | `stale` (`CONTEXT_FINGERPRINT_CHANGED`) |
| registry version changed | `stale` (`REGISTRY_VERSION_CHANGED`) |
| plan schema changed | `stale` (`PLAN_SCHEMA_CHANGED`) |
| body tampered into nonsense | `rejected` / `PLAN_SCHEMA_INVALID` |
| body tampered to drop a block | `rejected` / `PLAN_COVERAGE_BLOCK_MISSING` |
| live lesson gained a block | `rejected` (coverage) |
| stored digest ≠ revalidated digest | `stale` (`PLAN_DIGEST_CHANGED`) |
| superseded or invalidated row | not returned (`absent`) |

`changes the plan id when the mode changes` and `derives a stable plan id` pin
the identity. `invalidates every plan for a revision` covers revocation on
revision deprecation.

**Never bypassing review governance.** The validation context is rebuilt from
live records on every read; a revoked asset approval or edited asset makes the
same row fail. The stored digest must also equal the digest the live validator
produces, so a valid-but-different plan cannot be substituted.

---

## 4. Security negative tests (browser, real services)

`batch4-m41-planning.spec.ts` — **4 passed** against real BetterAuth, NestJS and
MongoDB:

| Scenario | Result |
|---|---|
| learner POSTs to the generation route | **403** |
| outsider GETs a stored plan | **403/404** |
| unknown mode requested | `unavailable`, not an error |
| every mode renders the lesson | pass |
| no `mock_experience_planner` in the page | pass |
| no `fnv1a64:` fingerprint in the page | pass |
| no `PLAN_*` code in the page | pass |
| reload, back, forward | pass |

Retained from earlier milestones and still passing: anonymous request → 401,
cross-revision binding rejected, forged identity rejected, schema-injection
rejected, malformed provider output rejected.

---

## 5. Regression ledger

| Suite | Result |
|---|---|
| API unit (`modules src shared`) | **1075 / 1075, 74 suites** |
| Web unit | **207 / 207, 32 files** |
| Browser (M4.1 + M4.2 + M4.3) | **4 / 4** |
| Python boundary | **14 / 14** |
| API typecheck | **0 errors** |
| Web typecheck | **0 errors** |

### Tests changed, and why

| File | Change | Reason |
|---|---|---|
| `lesson-reader.test.tsx` | banner assertions | the planner name is no longer learner-visible (M4.3 requirement) |
| `batch4-m41-planning.spec.ts` | planner attribute → "AI-arranged lesson" | same |
| `batch4-m41-planning.spec.ts` | AI route 200 → **403** | generation is now an author privilege |
| `planning-budget.test.ts` | mock gains `connect()` | the client now connects explicitly |

**No assertion was weakened to obtain green.** Three were *tightened*: the
learner-visibility checks now forbid internal identifiers outright, and the
generation route moved from "disabled" to "forbidden".

---

## 6. What is not verified

- No live provider behaviour: latency, token counts, quota, structured-output
  fidelity and retention terms remain unobserved.
- A single combined Node+Python ledger run was not achieved in this environment;
  the invariant is proven from both sides separately (§1).
- Mode *pedagogy* is not claimed: the arrangement differs, learning outcomes were
  not measured.

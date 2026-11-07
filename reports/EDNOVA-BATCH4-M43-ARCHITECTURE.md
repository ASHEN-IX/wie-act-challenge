# EdNova Batch 4 — M4.3 Post-Acceptance Hardening: Architecture

**Scope:** verify and close the remaining M4.3 integration risks; determine M4.4
readiness. No redesign, no M4.4 implementation, no live provider call.

---

## 1. Confirmed baseline

| Reported | Verified | Status |
|---|---|---|
| 1,075 API tests, 74 suites | **1,075 / 74** | confirmed |
| 207 web tests | **207 / 32 files** | confirmed |
| 4 browser tests | **4 / 4** | confirmed |
| 14 Python tests | **20** after hardening | grew, see §5 |
| Zero TypeScript errors | **0 API, 0 web** | confirmed |
| Five modes, durable plans, author-only generation | present | confirmed |

**Repository state at review time.** HEAD had advanced to `021185f`, which
**committed the previously untracked Nardouch work** (84 files now tracked). The
brief's "19 unrelated Nardouch working-tree entries" are therefore resolved by
newer repository evidence: those files are committed and the working tree is
clean apart from dotfiles. No Nardouch file was modified by this work.

---

## 2. Provider-attempt lifecycle (verified by inspection)

```
Authenticated author request
  → authorize               canManageCourse                        [experiencePlanning.ts]
  → eligibility             consent + free-tier + approval + key   [planningGovernance.ts]
  → request identity        sha256(course,revision,lesson,mode,fp,provider,model)
  → idempotency             one row per identity; in-flight ⇒ duplicate
  → Node reservation        findOneAndUpdate $inc usedTokens/reservedTokens
  → dispatch                POST /api/ai/experience/plan
  → Python checks           _ledger_permits_dispatch  (liveness, read-only)
                            _propagated_reservation   (this attempt owns a reservation)
  → provider invocation     stubbed in every test; no live call
  → usage / failure         reported tokens, or none, or a typed failure
  → Node reconciliation     refund to reported usage; no report ⇒ reservation stays spent
  → durable result          request row + accepted plan record
```

### Budget reads and mutations

| Operation | Where | Kind |
|---|---|---|
| `findOneAndUpdate $inc` | `planningBudget.ts` `reservePlanningBudget` | **mutate** |
| `updateOne $max/$subtract` | `planningBudget.ts` `reconcilePlanningBudget` | **mutate** |
| `findOne` | `experience_planner.py` `_ledger_permits_dispatch` | read |
| `findOne` | `experience_planner.py` `_propagated_reservation` | read |
| `findOne` | `planningBudget.ts` `planningBudgetStatus` | read |
| `findOneAndUpdate` | `approval precheck` (existing formula path) | read |

**Two mutations, both in Node.** Python performs zero writes — asserted by
`test_python_never_adjusts_the_budget_ledger`.

---

## 3. The defect this review found

### Symptom

An attempt with *exactly* enough budget for itself was refused.

### Cause

```
limit 1,000,000 · used 967,232 · reservation 32,768

Node:   $inc usedTokens +32,768   →  used = 1,000,000   (succeeds)
Python: usedTokens + RESERVED <= limit
        1,000,000 + 32,768 <= 1,000,000   →  false   (refuses)
```

Python was requiring the ledger to fund a **second** reservation for an attempt
that had already funded itself.

### Correction (attempt-aware, not arithmetic)

| Check | Question it answers |
|---|---|
| `_ledger_permits_dispatch` | is the approval live and the ledger readable? |
| `_propagated_reservation` | does **this request** own a valid reservation? |

`_propagated_reservation` reads the trusted `experience_plan_requests` row —
the one Node already writes — and requires:

- the row exists for this `requestId`
- `approvalId` matches the approval being used
- `reservedTokens` equals the expected reservation
- `state` is `dispatched` or `validating`
- the model matches

It never trusts a caller-supplied claim: `requestId` is the only thing Python
receives, and the evidence is looked up server-side in the application database.

**Not done deliberately:**
- no subtraction of an assumed reservation from the ledger
- no second reservation
- no release of the ledger check — a missing request row must not become
  permission, so both gates are required

---

## 4. Idempotency rules (verified)

| Situation | Result |
|---|---|
| same identity, in-flight state | `duplicate`, no dispatch |
| same identity, `requested` (just created) | proceeds — not a duplicate |
| same identity, previously `validated` | `PLAN_NOT_RETAINED`, no replay |
| same identity, previously `uncertain` | `PROVIDER_UNCERTAIN_PREVIOUS`, no replay |
| one attempt, one ledger row, one `usedRequests` increment | confirmed |

---

## 5. Failure and reconciliation semantics

| Outcome | Ledger |
|---|---|
| success, usage reported | charged the reported amount |
| success, no usage reported | full reservation retained |
| timeout after dispatch | full reservation retained (uncertain) |
| refused before dispatch | no mutation |
| worker interrupted | reservation retained; never refunded on its behalf |
| malformed/empty/truncated output | classified uncertain → retained |

Python classifies any SDK exception as `refused: false` +
`PROVIDER_TIMEOUT_AFTER_DISPATCH`, so a failure it cannot prove happened
pre-dispatch is never reported as free.

---

## 6. Code changes in this review

| File | Change | Reason |
|---|---|---|
| `experience_planner.py` | `_has_headroom` split into `_ledger_permits_dispatch` + `_propagated_reservation` | fixes the exact-budget refusal |
| `experience_planner.py` | `_has_headroom(approval, request_id)` | carries the attempt identity |
| `test_experience_planner_dispatch.py` | 14 → 20 tests | pins the boundary and its negatives |
| `m43-cross-service-proof.ts` | new | combined Node+Python evidence |
| `learning-mode-quality.test.ts` | new, 10 tests | mode distinguishability |
| `EDNOVA-BATCH4-M43-VALIDATION.md` | correction note | seven-vs-eight overclaim |

No other production behaviour changed. The M4.1 validator, M4.2 governance and
M4.3 store/read paths are untouched.

---

## 7. Assumptions and missing evidence

| Kind | Item |
|---|---|
| Assumption | the request row is the authoritative record of a reservation; Node always writes it before dispatch |
| Assumption | one approval (`approvalId`) serves one task/model, so matching on it is sufficient ownership proof |
| Missing evidence | no live provider call, so real token accounting remains unobserved |
| Missing evidence | mode pedagogy unmeasured; only arrangement differences are proven |

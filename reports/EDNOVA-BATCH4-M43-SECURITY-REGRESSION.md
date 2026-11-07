# EdNova Batch 4 — M4.3 Security Regression

Did the accounting hardening compromise the accepted security architecture?
Verified against the running code, not assumed.

---

## 1. Authorization boundaries

| Boundary | Rule | Evidence |
|---|---|---|
| Plan generation | `canManageCourse` only | browser: learner POST → **403** |
| Plan retrieval | published-reading boundary; enrolled reader | browser: outsider GET → **403/404** |
| Lesson reading | any authorized reader | browser: reader renders |
| Provider dispatch | author-initiated generation only | the read route imports no provider |
| Cross-course / cross-revision | rejected | `identities` in claims; store binds both |

**The learner read route cannot reach a provider.** `readStoredPlan` calls
`loadTrustedPlanningContext` and `loadAcceptedPlan`; neither imports a provider
adapter. A learner viewing a plan cannot cause a model call, by construction.

The review's constraint "students cannot invoke provider calls" is therefore
structural, not merely a permission check.

---

## 2. Durable-plan revalidation (12 required properties)

| # | Property | Test | Result |
|---|---|---|---|
| 1 | stored bodies untrusted on retrieval | `refuses a deserialized plan, which is not branded` | PASS |
| 2 | seven-stage validator reruns against live records | `returns the plan when the stored body still validates` | PASS |
| 3 | revoked asset approval invalidates an old plan | live context rebuilt per read; route decision | PASS |
| 4 | changed canonical content invalidates | `rejects a stale plan when the canonical content hash changed` | PASS |
| 5 | registry/schema change invalidates | `REGISTRY_VERSION_CHANGED`, `PLAN_SCHEMA_CHANGED` | PASS |
| 6 | revalidated digest must equal stored digest | `rejects when the stored digest does not match the revalidated plan` | PASS |
| 7 | learners cannot generate | browser 403 | PASS |
| 8 | Read never requests a plan | `never lets Read use a planner`; reader skips `read` | PASS |
| 9 | planning failure never blocks reading | browser: fallback renders | PASS |
| 10 | unreviewed mathematics stays source-faithful | policy gate; bracket preference | PASS |
| 11 | all five modes preserve coverage | validator stage 3; per-mode browser checks | PASS |
| 12 | no internal identifiers on learner pages | browser asserts absence of `mock_experience_planner`, `fnv1a64:`, `PLAN_` | PASS |

`experience-plan-store.test.ts` — **19 tests**, all passing.

---

## 3. Canonical coverage and formula governance

Unchanged by this hardening. No validator code was touched:

- one placement per canonical block, in canonical order (stage 3)
- a source-faithful block may only be rendered by a source-faithful component
- a derivation over unreviewed mathematics is rejected
- generated proposals are never learner-visible

The mode layer only supplies *preferences*. `learning-mode-quality.test.ts`
confirms Deep Dive prefers `SourceMathFallback` rather than a typesetting
component, so a mode cannot be used to smuggle unreviewed mathematics into a
reviewed-looking presentation.

---

## 4. Provider isolation

| Guarantee | Status |
|---|---|
| Credentials server-side only | unchanged from M4.2; no key in any response |
| No live provider call in this milestone | **confirmed** — SDK stubbed in every test and the combined proof |
| Python writes no budget | `test_python_never_adjusts_the_budget_ledger` |
| No third accounting implementation | one reservation writer (Node), one reconciler (Node), Python reads |
| Uncertain outcomes never auto-retried | `refuses to replay a previously uncertain request` |
| Ledger unavailable ⇒ refuse | `unreadable_ledger_is_refused` |

---

## 5. The new check cannot be bypassed by a caller

`_propagated_reservation` receives only a `requestId` and looks the evidence up
in the trusted application database. A caller cannot:

- supply a reservation claim — none is accepted
- claim another attempt's reservation — `approvalId` and `requestId` must both match
- reuse a finished attempt — `state` must be `dispatched` or `validating`
- under-reserve — `reservedTokens` must equal the expected amount

Verified by `test_reservation_for_another_approval_is_refused`,
`test_reservation_with_the_wrong_amount_is_refused`,
`test_reservation_no_longer_in_flight_is_refused`.

---

## 6. Regression counts

| Suite | Result |
|---|---|
| API unit | **1,085 / 1,085**, 75 suites |
| Web unit | **207 / 207**, 32 files |
| Browser (real services) | **4 / 4** |
| Python boundary | **20 / 20** |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |
| Ledger proof (`m43-budget-proof.ts`) | **ALL SCENARIOS MATCH** |
| Combined Node+Python proof | **10 / 10** |

No test was weakened. The Python suite grew 14 → 20 and the API suite 1,075 →
1,085; both additions are new assertions, and the only replaced tests were the
two that asserted the arithmetic this review corrected.

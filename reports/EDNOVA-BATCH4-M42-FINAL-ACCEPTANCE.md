# EdNova Batch 4 — M4.2 Final Acceptance

**Milestone:** 4.2 — Real AI Provider Integration, Budget Governance & Safe
Experience Planning
**Date:** 2026-11-07
**Scope completed:** M4.2 only. Batch 4.3 not started.

---

## 1. Verdict

# CONDITIONAL GO

The implementation is sound and every mandatory gate that can be verified
without a live provider passes. The condition is the one the milestone itself
creates: **no live Gemini call was made**, so real-provider behaviour — latency,
token accounting, quota handling, structured-output fidelity, data-retention
terms — remains unverified by design, not by omission.

A GO for implementation does not certify live-provider behaviour.

---

## 2. Git baseline

```
4f10461  feat(m42): provider-independent planner with Gemini, consent and budget gates
d5c8e77  docs(m41): record the final closure and workstream isolation
d19ce9e  test(m41): brand, governance and asset evidence
0245876  fix(m41): bound placements to the canonical contract and seed the QA fixture
a8928b9  (mixed nardouch commit — preserved, never rewritten)
```

Reported commits `0245876`, `d19ce9e`, `d5c8e77` confirmed present and unrewritten.
M4.2 adds one commit, path-scoped, containing **zero nardouch files**.

### Reported counts, re-verified

| Suite | Reported | Measured now | Delta |
|---|---|---|---|
| API unit | 960 | **1043** | +83 M4.2 |
| Web unit | 207 | **207** | 0 |
| M4.1 browser | 2 | **3** | +1 M4.2 |

---

## 3. Gate ledger

| # | Gate | Status | Evidence |
|---|---|---|---|
| 1 | Real Gemini adapter, provider-independent boundary | **PASS** | `experiencePlannerProviders.ts`; 22 provider tests |
| 2 | Planning uses the M4.1 contract and validator | **PASS** | `tryValidateExperiencePlan` on every proposal |
| 3 | No content or review decision fabricated into trusted state | **PASS** | coverage + provenance suites |
| 4 | Eligible structured assets selectable safely | **PASS** | review-verified assets only, by content hash |
| 5 | Review status backed by persisted decisions | **PASS** | C3 closed; 9 provenance tests |
| 6 | Context bounded and privacy-conscious | **PASS** | 24k chars / 400 blocks / 32 KiB; exclusion tests |
| 7 | Provider credentials server-side only | **PASS** | no headers, no key in payload or response |
| 8 | Owner consent and operator approval enforced | **PASS** | purpose-scoped consent; 5 tests |
| 9 | Free-tier eligibility and budget reservations | **PASS** | 7 eligibility refusals; atomic reservation |
| 10 | Concurrent duplicate requests controlled | **PASS** | in-flight guard; duplicate test |
| 11 | Timeouts and uncertain outcomes accounted conservatively | **PASS** | sticky `uncertain`; no-refund-without-report |
| 12 | Valid mocked Gemini response produces a validated plan | **PASS** | lifecycle + provider suites |
| 13 | Invalid responses preserve deterministic access | **PASS** | browser test; fallback tests |
| 14 | Real authenticated integration tests pass | **PASS** | 3/3 browser against real NestJS + MongoDB |
| 15 | Batch 2/3/4.1 behaviour preserved | **PASS** | 1043 API + 207 web, zero failures |
| 16 | No unauthorized live provider call | **PASS** | SDK mocked in every test |
| 17 | No production deployment | **PASS** | local QA harness only |

---

## 4. Automated test ledger

### New M4.2 tests — 83 API + 12 Python

| Suite | Tests | Covers |
|---|---|---|
| `experience-planner-provider.test.ts` | 22 | contract, adapter, classification, privacy |
| `experience-plan-generation.test.ts` | 24 | lifecycle, idempotency, uncertainty, provenance |
| `experience-planning-governance.test.ts` | 23 | consent, eligibility, context bounds, injection |
| `planning-budget.test.ts` | 14 | reservation, reconciliation, refund bounds |
| `test_experience_planner_dispatch.py` | 12 | Python boundary, SDK mocked |

### Full regression

| Suite | Result |
|---|---|
| API unit (`modules src shared`) | **1043 / 1043, 72 suites** |
| Web unit | **207 / 207, 32 files** |
| Browser (M4.1 + M4.2) | **3 / 3** |
| Typecheck, API | **0 errors** |
| Typecheck, web | **0 errors** |

**A note on the sandbox.** Three formula suites spawn a `tsx` worker. Inside the
agent sandbox that spawn fails with `EPERM` on tsx's IPC socket, and the suites
report a `beforeAll` timeout — a sandbox artifact, not a failure. Run in the
user shell they pass: **464/464 study tests**. Recorded because the distinction
between "slow hook" and "blocked socket" matters when reading a CI log.

---

## 5. C3 — review provenance, closed

| Requirement | Status |
|---|---|
| Resolve the authoritative asset record | **PASS** |
| Verify the authorized reviewer | **PASS** — `canAuthorCourse` at verification time |
| Verify the decision exists | **PASS** — `structured_asset_reviews` |
| Reference the exact asset version | **PASS** — sha256 over the payload |
| Verify course and revision binding | **PASS** |
| Verify the review remains applicable | **PASS** — unrevoked, not rejected |
| Verify learner-projection eligibility | **PASS** — provenance allowlist |

An AI provider cannot create approval: no proposal field exists for it, and the
lookup reads only the database. A forged `reviewedBy` / `accepted` / `validated`
has no effect.

**Version transfer is prevented**: the hash covers the payload, so editing an
asset invalidates its approval rather than inheriting it. Verified by test.

Unreviewed `generated_proposal` assets remain learner-invisible, and
`deterministic_demo` is excluded from reviewable provenance.

---

## 6. Reader integration — observed

No structural change to the reader. The AI path maps every non-`planned`
outcome to `undefined`.

Browser evidence (real NestJS + MongoDB + BetterAuth, `playwright.m41.config.ts`):

| Scenario | Result |
|---|---|
| Deterministic reader with no plan | pass |
| Valid mock plan renders trusted components | pass |
| Hostile plans rejected, deterministic fallback | pass |
| Companion loading state resolves | pass |
| **AI planning disabled → refusal, reader intact** | pass |
| **No credential in the response body** | pass |
| **Anonymous planning request → 401/403** | pass |

Screenshots: `reports/evidence/batch4-m41/`.

---

## 7. Mock versus live

| Aspect | Status |
|---|---|
| Provider SDK | **mocked in every test** |
| Live Gemini call | **none made** |
| Live latency / throughput | **not measured, not claimed** |
| Real token accounting | **not observed** |
| Real quota behaviour | **classified but not exercised** |
| Structured-output fidelity | **not verified against a real model** |
| Data-retention terms | **not verified**; consent carries an operator-set `termsVersion` |

The adapter's *shape* is real — same SDK package (`google-genai` 2.31.0), same
`response_json_schema` field, same one-attempt timeout discipline as the existing
formula pipeline. What is unverified is the provider's behaviour behind it.

---

## 8. Operational measurements

Local, deterministic, no provider involved:

| Measurement | Value |
|---|---|
| Context fingerprint, 400 blocks | 0.099 ms |
| Full validation, 400 blocks | 1.304 ms (p95 1.416) |
| Worst-case rejection | ≤ 0.50 ms |
| Context caps | 24 000 chars / 400 blocks / 32 KiB |
| Reservation | 32 768 tokens |
| Adapter overhead | 1 HTTP call + 1 JSON parse |

Accepted/rejected rates are **not** reported: a mock planner's rate says nothing
about a real model's.

---

## 9. Open issues status

| # | Issue | Status |
|---|---|---|
| **C1** | Batch 3 extraction assertions target the wrong hierarchy | **OPEN, unrelated.** M4.1 closure traced it to test assumptions, not the pipeline. Untouched here; still fails as written, deliberately not weakened. |
| **C2** | Nardouch may retain a loading state on a non-throwing revision mismatch | **OPEN, owned by Nardouch.** Untouched. |
| **C3** | Review provenance needs independent persisted approval | **CLOSED** — this milestone. |
| **C4** | Legacy `experiencePlanner.ts` may be unused | **OPEN, cosmetic.** Still unreferenced; removal is a cleanup task. |

C1 was **not** dismissed: the M4.1 closure traced it through the parser, the
normalizer and the published artifact, and M4.2 neither changes nor hides it.

---

## 10. Remaining risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | No live-provider verification | **Medium** | Explicitly out of scope; needs fresh authorization |
| R2 | Data-retention terms unverified | **Medium** | Consent requires an operator-set `termsVersion`; operator must confirm |
| R3 | Planning dispatch requires operator provisioning | **Low** | By design; nothing self-authorizes |
| R4 | A validated plan is not cached, so a repeat request re-plans | **Low** | Plan caching is a later milestone; idempotency prevents concurrent duplicates |
| R5 | Formula pipeline still pins deprecated `gemini-2.5-flash` | **Low** | Pre-existing; recorded, not changed |
| R6 | Python duplicates the budget ledger logic | **Low** | Deliberate: the boundary must not trust Node's accounting; both tested |

---

## 11. Files

**New — shared contracts**
- `apps/api/shared/ednova/experiencePlannerProvider.ts`
- `apps/api/shared/ednova/planningContext.ts`

**New — study services and models**
- `modules/study/src/services/experiencePlannerProviders.ts`
- `modules/study/src/services/experiencePlanGeneration.ts`
- `modules/study/src/services/planningGovernance.ts`
- `modules/study/src/services/planningBudget.ts`
- `modules/study/src/services/assetReviewProvenance.ts`
- `modules/study/src/models/ExperiencePlanRequest.ts`
- `modules/study/src/models/StructuredAssetReview.ts`

**New — Python boundary**
- `apps/ai/services/api/routers/experience_planner.py`
- `apps/ai/tests/test_experience_planner_dispatch.py`

**Changed**
- `modules/study/src/services/experiencePlanning.ts` (shared trusted context; C3)
- `modules/study/src/routes/learning.ts` (two routes)
- `src/framework/domains/study.module.ts` (generated methods)
- `apps/web/src/features/learning/journey-actions.ts` (AI planning action)
- `apps/ai/services/api/main.py` (router registration)
- `apps/api/tests/m41-fixture.ts` (seeds a persisted review; assigned instructor)
- three M4.1 test files (tightened to the C3 contract)

**Tests added**
- `experience-planner-provider.test.ts`, `experience-plan-generation.test.ts`,
  `experience-planning-governance.test.ts`, `planning-budget.test.ts`
- `batch4-m41-planning.spec.ts` (+1 M4.2 scenario)

---

## 12. What this milestone does not claim

- No live-provider behaviour, cost or rate-limit handling has been observed.
- No claim that the model resists prompt injection; the claim is that a
  resulting bad plan is rejected.
- No plan caching, learner adaptation or multi-agent orchestration.
- No resolution of C1, C2 or C4.
- No production deployment, and no production data touched.

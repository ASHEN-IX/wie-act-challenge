# EdNova Batch 4 — M4.5 Security and Cost

Authorization, isolation, one-attempt accounting, provider governance and
privacy. Every claim is backed by a test or a captured run.

---

## 1. One logical attempt, one debit

M4.3 established that Node owns the reservation and Python only verifies. M4.5
found that **deciding what one attempt is** was not atomic.

| Layer | Responsibility | Status |
|---|---|---|
| Node | reserve, reconcile, own the ledger | unchanged since M4.3 |
| Node | claim the request identity | **made atomic in M4.5** |
| Python | verify approval + propagated reservation, read-only | unchanged |

The M4.3 ten-scenario proof still passes unchanged
(`ALL SCENARIOS MATCH`), and the new cross-process proof adds the dimension that
proof could not see:

| Scenario | Result |
|---|---|
| 2 independent processes, same identity | 1 reserved, 1 suppressed, 1 debit |
| 5 independent processes, same identity | 1 reserved, 4 suppressed, 1 debit |

Python still cannot create a reservation: `test_python_never_adjusts_the_budget_ledger`
asserts zero ledger writes. The M4.3 attempt-aware check is untouched.

---

## 2. Uncertain outcomes

Preserved without change. A provider failure the boundary cannot prove happened
pre-dispatch is classified `uncertain`, the reservation stays spent, and the
attempt is never replayed:

- `refuses to replay a previously uncertain request`
- `keeps the reservation spent on a timeout after dispatch`
- recovery converts stale in-flight attempts to `uncertain`, never to retry

A cache hit produces **zero dispatches and zero reservations** — asserted by
`reuses a stored accepted plan instead of a second inference`.

---

## 3. Authorization and isolation

| Boundary | Enforcement | Status |
|---|---|---|
| Student → plan | published-reading boundary, per request | unchanged |
| Student → adaptation | own evidence only, course+revision scoped | unchanged |
| Student → generation | author-only (`canManageCourse`) | unchanged |
| Student → metrics | course the caller manages | new, scoped |
| Cross-revision plan | `contentHash` + revision binding on read | unchanged |
| Cross-revision evidence | query filter **plus** post-query re-check | unchanged |

No policy was widened. The metrics route uses the existing
`canManageCourse`, scoped to a named course, rather than a new global
permission.

---

## 4. Cache correctness cannot bypass governance

A stored plan is data, not authority. On every retrieval:

1. the actor is authorized by the published-reading boundary
2. the exact revision is resolved and the canonical hash verified
3. the record's schema, registry and presentation versions must match
4. the body is re-parsed through the proposal contract
5. the validation context is **rebuilt from live records**
6. the seven-stage validator re-runs
7. the revalidated digest must equal the stored digest

Consequences proven by test:

- a registry change makes an old plan `stale`
- a tampered body is `rejected`
- a revoked review makes the plan fail (live context)
- a dropped canonical block is `rejected`

**Adaptation cannot promise what retrieval will deny.** M4.4 answered
availability with `exists()`; M4.5 reports `available` / `stale` /
`unavailable` from the record's own compatibility fields, in one projected read.
A stale record now reads `stale`, so the UI stops offering that mode.

---

## 5. Privacy

| Requirement | Status |
|---|---|
| No learner data in a shared plan | **PASS** — identity is course/revision/lesson/mode/fingerprint |
| No evidence copied into a second store | **PASS** — read live per recommendation |
| Evidence read scoped to the lesson's objectives | **PASS** (new) |
| Evidence read bounded | **PASS** — 200, now within relevant objectives |
| Metrics carry no identifier | **PASS** — asserted by string-assertion test |
| No prompt, answer, cookie or credential logged | **PASS** |
| No external model receives learner data | **PASS** — adaptation has no provider import |

The M4.4 correction is preserved: a neutral record is
`reason: "neutral_default"` with `recommendedMode: null`, and the contract
explicitly allows it. Tests pin both directions — an actionable reason without a
mode is rejected, and a neutral reason with a mode is rejected.

---

## 6. Assessment evidence precedence

Verified from code, not assumed:

- `learnerProgress` treats an objective as mastered if **any** accepted record
  has `masteryAchieved: true`
- evidence is append-only and keyed by attempt; nothing supersedes anything

So the authoritative state is **monotonic: ever-mastered**. Pinned by eleven
tests including the two that distinguish it from "newest wins":

| Evidence | Recommendation |
|---|---|
| false, then true | none — the objective is met |
| true, then false | none — a later failure does not revoke a pass |
| only false | Guided, citing that objective |

Order-independent, evaluator-version-independent, and stable across 40 records.

---

## 7. Provider and cost

**No live provider request was made.** Every provider-facing test uses a stubbed
SDK; the cross-service proofs call the Python router with `genai.Client`
replaced in-process.

| Control | Status |
|---|---|
| Source-owner consent | unchanged, purpose-scoped |
| Operator approval | unchanged |
| Free-tier eligibility | unchanged |
| Durable budget | unchanged, one reservation per attempt |
| Credential binding | unchanged |
| Uncertain accounting | unchanged |
| Model availability | not re-verified this milestone; no model change attempted |

A request that returns no usage metadata is still charged the reservation — a
test asserts this explicitly. No new cost surface was introduced: caching
*reduces* dispatch, and the metrics layer performs no I/O.

---

## 8. Regression counts

| Suite | Result |
|---|---|
| API unit | **1,163 / 1,163**, 79 suites |
| Web unit | **214 / 214**, 32 files |
| Browser (real services) | **5 / 5** |
| Python boundary | 20 / 20 |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |
| M4.3 budget proof | ALL SCENARIOS MATCH |
| M4.5 cross-process proof | **2 / 2** |
| Load test | 0 errors at every level |

New this milestone: 11 precedence tests, 14 metrics tests, 1 cross-process
scenario pair. Two existing assertions were replaced after behaviour changed by
design (reuse instead of `PLAN_NOT_RETAINED`; recovery covering more states) and
both replacements assert *more* than the originals.

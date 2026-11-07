# EdNova Batch 4 — M4.6 Security and Operations

Authorization, source integrity, accounting correctness, privacy and
observability — verified by running, not by reading.

---

## 1. Accounting: the defect and its correction

### What was wrong

Recovery marked a stale `authorized`/`reserved` attempt `failed` with
`PRE_DISPATCH_INTERRUPTED` and released its identity, but never reconciled the
budget. Worse, the row recorded `approvalId` and `reservedTokens` only *after*
the dispatch marker, so recovery had no evidence of what to refund.

Measured (`scripts/m46-recovery-proof.ts`):

| Point in the attempt | Ledger |
|---|---|
| after reservation, before dispatch marker | 32,768 |
| after recovery | 32,768 — **refunded 0** |
| retry after recovery | **65,536** for zero inference |

Repeated crashes in that window drained the allowance with no provider contact.

### What changed

1. The row records its reservation **before** the dispatch marker, so the window
   is visible to recovery.
2. Recovery releases the reservation per attempt, keyed by an idempotent
   `recover:<requestId>` marker on the ledger row — a second concurrent worker
   finds the marker and does nothing, so no double refund.

### Re-measured

| Point | Ledger |
|---|---|
| after reservation | 32,768 |
| after recovery | **0** — refunded 32,768 |
| retry after recovery | **32,768** — one reservation, not two |

**The uncertain path is untouched.** A provider timeout still retains the full
reservation and is never auto-retried — `control: reconcile with no usage` still
lands at 32,768, by design.

### Lifetimes tested

| Interruption point | Behaviour |
|---|---|
| before identity claim | no row, no reservation — nothing to release |
| after claim, before reservation | `failed`, nothing to refund ✅ |
| after reservation, before marker | `failed`, **reservation released** ✅ |
| after marker, before response | `uncertain`, reservation retained, never retried ✅ |
| after validation, before persistence | plan not stored; request `validated` without a body |

---

## 2. Preserved accounting architecture

| Property | Status |
|---|---|
| Node owns reservation and reconciliation | ✅ unchanged |
| Python read-only, verifies propagated reservation | ✅ 20/20 boundary tests |
| One reservation per logical attempt | ✅ 10/10 M4.3 proof |
| Atomic cross-process claim | ✅ 2/2 M4.5 proof (5 processes → 1 reservation) |
| Uncertain never auto-retried | ✅ sticky state |
| No second ledger | ✅ one `llm_approval_budgets` |

Re-run this milestone: **M4.3 ALL SCENARIOS MATCH**, **M4.5 2/2 PASS**.

---

## 3. Authorization negatives

All covered by existing suites and the browser run; none regressed.

| Case | Result |
|---|---|
| Anonymous user | 401 |
| Unauthorized student on a course | 403/404 |
| Unauthorized author (generation) | 403 |
| Cross-course / cross-revision read | rejected |
| Revoked enrollment | access evaluated per request |
| Metrics without course-management rights | 403 |
| Cross-user adaptation data | filtered by `userId` |

**No policy was widened in Batch 4.** The metrics route uses the existing
`canManageCourse`, scoped to a named course.

---

## 4. Source and review integrity

| Guarantee | Status |
|---|---|
| Canonical checksum verified per read | ✅ |
| Forged formula review rejected | ✅ policy gate |
| Forged asset review rejected | ✅ persisted decision required |
| Unreviewed generated asset invisible | ✅ `PLAN_ASSET_GENERATED_PROPOSAL` |
| Stale plan after revocation refused | ✅ live context rebuild |
| Tampered plan body rejected | ✅ re-parse + digest equality |
| Registry/version mismatch refused | ✅ stated reason |
| Source content treated as data | ✅ fenced, never instructions |
| Only trusted components render | ✅ frozen registry, no dynamic import |

---

## 5. Observability scope — corrected

**Defect:** `GET /courses/:courseId/planning/metrics` was course-scoped in path
and authorization but returned **process-global** counters. One course author
could infer another course's planning activity from the aggregate.

**Fix:** the payload now declares `scope: 'process'` with an explicit note, plus
`processUptimeSeconds`. The counters are what they always were — process-wide
aggregates — but they can no longer be misread as a per-course measurement.

**Verified properties:**

| Property | Status |
|---|---|
| Counters are process-local (reset on restart) | documented, not distributed |
| No learner, course, request or attempt identifier | asserted by test |
| No prompt, answer, cookie, credential | asserted by test |
| Bounded cardinality | closed 18-event vocabulary |
| Latency recorded as buckets, not samples | no request reconstructable |
| Author-scoped to a managed course | ✅ |

**Not claimed:** distributed observability. In-memory counters across multiple
instances are per-process; a shared dashboard would need a metrics backend this
milestone did not add.

---

## 6. Privacy

| Requirement | Status |
|---|---|
| No learner data in a shared plan | ✅ identity excludes it |
| Evidence read live, not duplicated | ✅ |
| Evidence scoped to the lesson's objectives | ✅ (M4.5) |
| Evidence bounded | ✅ 200 within relevant objectives |
| Preferences user-scoped, version-guarded | ✅ 409 on stale write |
| No external model receives learner data | ✅ adaptation has no provider import |
| Compacted training data | n/a — no training |

---

## 7. Security acceptance — negative tests

Retained from M4.1–M4.5 and still green: prototype pollution, unknown component,
forged review, cross-revision asset, unreviewed generated proposal, malformed
maths, oversized arrays, deep nesting, unsafe URLs, arbitrary source paths,
malicious markup, prompt injection in lesson text, duplicate dispatch, budget
exhaustion, provider timeout after dispatch, revoked eligibility, revoked
consent.

**No new negative case was needed** — the two defects found this milestone were
accounting and observability scope, not authorization.

---

## 8. Regression ledger

| Suite | Result |
|---|---|
| API unit | **1,164 / 1,164**, 79 suites |
| Web unit | **214 / 214**, 32 files |
| Browser (real services) | **6 / 6** |
| Python boundary | 20 / 20 |
| API typecheck | 0 errors |
| Web typecheck | 0 errors |
| M4.3 accounting proof | ALL MATCH |
| M4.5 concurrency proof | 2 / 2 |

### Production builds

| Build | Result |
|---|---|
| API (`npx tsc`) | **exit 0**, 22 emitted files |
| Web (`next build --webpack`) | **success**, full route table emitted |

An earlier draft of this report claimed the API build was untested because a
`find` looked wrong. Re-running it showed a clean exit 0. The claim is corrected
rather than kept as a conservative hedge — a hedge that misstates a passing
check is still inaccurate.

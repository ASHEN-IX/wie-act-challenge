# EdNova Batch 4 — M4.6 Final Acceptance

**Milestone:** 4.6 — Educational Quality, Security, Cross-Subject Validation &
Final Technical Acceptance
**Date:** 2026-11-07
**Scope:** final Batch 4 technical acceptance. No deployment, no new batch.

---

## 1. Five verdicts

### A. Batch 4 Technical Acceptance — **CONDITIONAL GO**

The planning, adaptation, caching, security and reader systems work together
correctly. Two genuine defects were found and fixed this milestone, and all
mandatory regressions pass. The condition is bounded verification, not
implementation: no live provider was exercised, full failure injection was not
performed, and three historical issues remain open.

### B. Academic Content Accuracy — **UPSTREAM GATE UNCHANGED**

`INDEPENDENT_MATH_CERTIFICATION: BLOCKED`. No qualified independent reviewer or
completed 16-case adjudication exists here. Automated structural checks confirm
provenance and fidelity; they cannot confirm mathematical correctness.

### C. Educational Effectiveness — **NOT ESTABLISHED**

No comprehension, retention or grade outcome was measured. Five modes produce
observably distinct arrangements, and that is the whole claim. A working
recommendation interface is not evidence of learning benefit.

### D. Live Gemini Provider Certification — **NOT TESTED**

No live request was made or authorized. Provider latency, output fidelity,
quota behaviour, real token accounting and retention terms are unverified. The
mocked SDK proves the boundary, never the provider.

### E. Production Deployment Readiness — **NOT READY**

Config, backups/restore, rollback, monitoring backend, capacity, incident
response and secrets management were not exercised. Local load figures are not
capacity evidence.

---

## 2. Baseline reproduced

| Reported | Measured |
|---|---|
| API 1,163 | **1,164** (+1 new recovery test) |
| Web 214 | **214** |
| Browser 5 | **6** (+1 accessibility) |
| Python 20 | 20 |
| Cross-process 2 | **2 / 2** |
| Accounting 10 | **10 / 10** |
| Typechecks | 0 / 0 |

HEAD was `da5599a` at audit start. Two path-scoped commits added. **Zero
Nardouch or landing files touched.** No history rewritten.

---

## 3. Defects found and fixed

### D1 — budget leaked on provably pre-dispatch crash *(high)*

Measured, not inferred: a crash between reserving and writing the dispatch
marker left 32,768 tokens charged with **zero refund**, and the unblocked retry
paid again — 65,536 for one inference that never happened. Fixed by recording
the reservation before the marker and releasing it per attempt with an
idempotent marker. Re-measured: refund 32,768, retry lands at 32,768.
**A possibly-billed attempt is still never refunded.**

### D2 — metrics route overstated its scope *(medium)*

Course-scoped URL and authorization, process-global counters. One course author
could infer another course's planning activity. The payload now declares
`scope: 'process'`.

### D3 — C4 assumption wrong *(recorded)*

`experiencePlanner.ts` is live test code, not dead code. Cannot be deleted
without rewriting `semantic-content.test.ts`.

---

## 4. Gate ledger

| Gate | Status |
|---|---|
| Cross-subject content fidelity (structural) | **PASS** |
| Canonical coverage under all modes | **PASS** |
| Unreviewed maths source-faithful | **PASS** |
| Five modes observably distinct (where content allows) | **PASS** |
| Explore reported indistinguishable when it is | **PASS** |
| Adaptation evidence precedence (monotonic) | **PASS** |
| Preferences outrank assessment | **PASS** |
| No auto-navigation; dismiss/disable work | **PASS** |
| Cache reuse without redispatch | **PASS** |
| Review revocation invalidates dependent plans | **PASS** |
| One reservation per logical attempt (cross-process) | **PASS** |
| Pre-dispatch crash releases its reservation | **PASS** (fixed) |
| Uncertain outcome never refunded, never retried | **PASS** |
| Metrics carry no identifiers | **PASS** |
| Metrics scope declared | **PASS** (fixed) |
| Authorization negatives | **PASS** |
| Accessibility: keyboard, reflow, targets, motion | **PASS** |
| Screen-reader session | **NOT TESTED** |
| Contrast in the authenticated reader | **NOT TESTED** |
| Independent math certification | **BLOCKED** |
| Human educational review | **NOT TESTED** |
| Live provider certification | **NOT TESTED** |
| Full failure injection | **PARTIAL** — unit/integration only |
| Production build | **PASS** (API + web) |
| Production readiness | **NOT TESTED** |

---

## 5. What is genuinely working

1,164 API tests, 214 web tests, 6 authenticated browser scenarios against real
BetterAuth/NestJS/MongoDB, 20 Python boundary tests, 10 accounting scenarios,
2 cross-process concurrency scenarios, and both production builds. Two real
defects were found by measurement and fixed with regression coverage.

## 6. Open issues

| # | Issue | Owner | Severity |
|---|---|---|---|
| C1 | Batch 3 extraction assertions — one wrong-layer, one unresolved | Batch 3 | Medium |
| C2 | Nardouch loading on non-throwing mismatch | Nardouch | Low |
| C4 | `experiencePlanner.ts` still imported by a test | cleanup | Low |
| — | No independent math certification | academic | Medium |
| — | No live provider verification | release gate | Medium |
| — | No production operations evidence | ops | Medium |

---

## 7. Release recommendation

**Batch 4 is technically sound for internal and pilot use with mocked providers.**
It should not be presented as production-ready, live-provider-certified, or
educational-effect validated. Those are three separate gates, none of which this
milestone closes, and collapsing them into one "GO" would misrepresent the
system.

The strongest true statement: **an AI-proposed learning experience can be
validated against immutable published content, rendered only through trusted
components, cached safely, shared without leaking learner data, and abandoned
for the deterministic reader at any point — and that is proven by tests that
run against the real application.**

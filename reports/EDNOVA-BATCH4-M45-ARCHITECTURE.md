# EdNova Batch 4 — M4.5 Architecture: Operational Hardening

**Scope:** caching, reliability, quota safety and observability over the accepted
M4.1–M4.4 architecture. No new planner, no reader redesign, no M4.6, no live
provider call.

---

## 1. Verified baseline

| Reported | Verified |
|---|---|
| HEAD | `436e3a4` — matches the M4.4 reports commit |
| API 1,137 / 77 suites | **1,137** reproduced |
| Web 214 / 32 files | **214** reproduced |
| Browser 5 | **5** reproduced |
| Python 20 | 20 (untouched) |
| Typechecks | 0 errors each |

Three files are dirty from the unrelated landing-page workstream
(`cinematic-scroll.spec.ts`, `SiteNav.tsx`, `marketing.css`). Untouched.

Real M4.4 report filenames: `EDNOVA-BATCH4-M44-ARCHITECTURE.md`,
`-ADAPTATION-AND-PRIVACY.md`, `-VALIDATION.md`, `-FINAL-ACCEPTANCE.md`.

---

## 2. Operational audit (Phase A) — before any change

### What is persisted

| Store | Holds | Mutability |
|---|---|---|
| `course_revisions` | canonical document, published | immutable |
| `experience_plan_records` | accepted plan body + identities + digest | superseded / invalidated |
| `experience_plan_requests` | attempt lifecycle + accounting | state transitions |
| `llm_approval_budgets` | token ledger | Node-only mutations |
| `learner_adaptation_preferences` | preferences + dismissals | learner-scoped |
| `learning_evidences` | accepted assessment verdicts | append-only |

### What is cached, and how reads behave

There is **one** plan store. A retrieval re-runs the full trusted pipeline:
authorize → resolve revision → verify canonical hash → parse → check
schema/registry versions → rebuild the validation context from live records →
re-run the seven-stage validator → require the digest to match. A stored plan is
never treated as trusted.

### Which operations mutate the budget

Exactly two, both in Node — `reservePlanningBudget` and
`reconcilePlanningBudget`. Python reads only (M4.3 correction, preserved).

### Which operations can race

| Race | Current protection |
|---|---|
| two generations, same identity | unique index + in-flight guard |
| two reservations, last budget | conditional `$lte` update |
| preference writes, two tabs | version guard → 409 |
| review revocation vs plan read | live context rebuild per read |
| invalidation vs retrieval | `invalidatedAt` filter on the read query |

### Findings — four defects, all confirmed by inspection

**D1 — permanently stuck in-flight attempt.**
`recoverStalePlanningRequests` exists but is **never called anywhere in
production code** (only from its own unit test). A process that dies between
`dispatched` and a terminal state leaves the row in flight forever, so every
later request for the same identity returns `duplicate` and no plan can ever be
generated for that lesson+mode. This is a genuine availability defect.

**D2 — `invalidateStoredPlans` is never called.**
It is exported and unit-tested but has no caller. A revision deprecation, an
asset edit or a revoked review therefore relies *only* on read-time
revalidation — which is safe (the plan fails and the reader falls back) but
leaves the record permanently live and re-checked on every read.

**D3 — availability is weaker than the promise it enables.**
`peekStoredPlan` answers "does a non-superseded, non-invalidated row exist?".
Adaptation uses it to offer a mode. But existence is not compatibility: a row
written under another registry version, or whose asset review was revoked,
still exists — so adaptation can advertise a mode whose plan will fail on
retrieval. M4.4 already refuses to *recommend* an unresolvable mode, but the
`eligibleModes` list can still overstate availability.

**D4 — the 200-row evidence cap is not objective-targeted.**
M4.4 selects up to 200 accepted rows for the learner and then filters by
revision and objective in memory. A learner with a long history in another
revision could fill the cap with rows that are then discarded, hiding the one
authoritative record for the lesson's objective. Bounded reads are right; an
arbitrary *unwindowed* bound is not.

### States that can become stuck

| State | Stuck how | Consequence |
|---|---|---|
| `authorized` | crash before reserve | row never terminal; identity blocked |
| `dispatched` / `validating` | crash mid-attempt | identity blocked, `duplicate` forever |
| `invalidatedAt` set | never set today (D2) | stale rows accumulate |

---

## 3. Evidence precedence (Phase B)

**Established authoritative semantics**, read from the code rather than assumed:

- `learnerProgress` treats an objective as mastered if **any** accepted record
  has `masteryAchieved: true` (`learningJourney.ts`: filter on
  `status: 'accepted', masteryAchieved: true`).
- Evidence writes are **append-only and keyed by attempt**; a later attempt does
  not supersede an earlier row (`activityAttempt.ts` upsert on an evidence key).
- There is **no** `supersededAt`, no precedence field, and no ordering rule.

Therefore the authoritative state is **monotonic: ever-mastered**. A later
`masteryAchieved: false` does not undo an earlier `true`.

The M4.4 policy already implements exactly this — `mastered` is a set built from
any `true` record, and a pending objective is skipped if it appears in that set.
This is correct and is now **documented explicitly and pinned by tests**,
including the out-of-order and later-false cases, so a future change cannot
silently invert it.

---

## 4. What this milestone changes

| # | Change | Why |
|---|---|---|
| C1 | Invoke stale-attempt recovery on the planning path | D1 |
| C2 | Call `invalidateStoredPlans` on revision deprecation and asset change | D2 |
| C3 | Availability becomes a three-state check backed by the plan's own compatibility fields | D3 |
| C4 | Evidence query targets the lesson's objectives and a bounded recent window | D4 |
| C5 | Bounded operational metrics | Phase I |
| C6 | Cross-process concurrency proof and load harness | Phases E, J |

Nothing in the canonical, presentation, validator, provider-governance or
adaptation-policy contracts changes.

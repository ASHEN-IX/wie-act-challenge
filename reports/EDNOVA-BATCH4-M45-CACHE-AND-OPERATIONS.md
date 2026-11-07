# EdNova Batch 4 — M4.5 Cache and Operations

Plan identity, retention, invalidation, concurrency, recovery and load.

---

## 1. Cache identity

One store (`experience_plan_records`). A reusable plan is keyed by:

```
courseId, revisionId, lessonId, mode, contextFingerprint
```

with the record additionally carrying canonical `contentHash`, plan schema,
registry version, presentation schema, provider/model/implementation, and digest.

**Learner data is deliberately absent.** M4.4's preferences and assessment
history are not part of plan identity, so two enrolled students on the same
lesson and mode share the same non-personal plan. Adaptation is computed per
learner, at read time, from that learner's own evidence — it never enters the
shared record.

A per-user plan would be a different contract, and M4.4 explicitly did not
implement one.

---

## 2. Retention, separated

| Data | Retention | Rationale |
|---|---|---|
| Accepted plan record | until superseded or invalidated | invalidating on a short TTL would force costly regeneration |
| Request/attempt row | terminal state retained | audit trail for one-attempt accounting |
| `llm_approval_budgets` | **not touched** | financial audit; never deleted because a presentation cache expired |
| Consent / approval records | owned by their own lifecycle | not a cache concern |
| Learner preferences | until the learner resets | user-owned |

No new TTL was introduced. The M4.3 accounting records and the plan store are
untouched by one another.

---

## 3. Invalidation triggers

| Trigger | Action | Wired at |
|---|---|---|
| Structured asset added | invalidate plans for that revision | `structuredAssets.attachStructuredAsset` |
| Instructor review decision recorded | invalidate (`ASSET_REVIEW_APPROVED` / `_REJECTED`) | `assetReviewProvenance.recordAssetReviewDecision` |
| Revision superseded by publication | invalidate (`REVISION_SUPERSEDED`) | `coursePublication.publishDraft` |
| Registry/schema change | refused at read | `loadAcceptedPlan` version checks |
| Canonical content change | stale at read | `contentHash` comparison |
| Review revoked | refused at read | live context rebuild |
| Authorization change | evaluated per request | published-reading boundary |

Read-time validation remains the authority. Invalidation is an efficiency and
accuracy measure — it stops stale rows accumulating and keeps the availability
signal truthful — not a replacement for revalidation.

---

## 4. Cross-process concurrency — the finding

### What was broken

`generateExperiencePlan` read the request row, decided `requested` meant
"mine", and then reserved. Between those two steps another process could do the
same. In one event loop the window is small; across processes it is wide.

`m45-concurrency-proof.ts` spawns **independent Node processes** that each claim
the same identity:

```
before the fix
5 processes │ reserved=5 │ duplicate=0 │ rows=1 │ used_tokens=163,840 (expected 32,768)
```

Five reservations, one logical attempt. M4.3's accounting was correct *per
attempt identity*; this defect was in deciding what an identity was.

### The fix

The claim is a single conditional update:

```js
findOneAndUpdate({ _id, state: 'requested' }, { $set: { state: 'authorized' } })
```

Only one caller can move the row out of `requested`. Everyone else sees no
match and reports `duplicate`.

### After

```
2 processes │ reserved=1 │ duplicate=1 │ rows=1 │ used_tokens=32,768  PASS
5 processes │ reserved=1 │ duplicate=4 │ rows=1 │ used_tokens=32,768  PASS
```

Run:

```bash
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m45-concurrency-proof.ts
```

---

## 5. Stuck states and recovery

| State | Before | After |
|---|---|---|
| `dispatched` / `validating`, process died | stuck forever; identity blocked | becomes `uncertain` after 120 s |
| `authorized` / `reserved`, process died | stuck forever | becomes `failed` (`PRE_DISPATCH_INTERRUPTED`), identity released |
| stale plan after invalidation | regenerated only by luck | regenerated, separately reserved |

Recovery now runs **on the planning path**, bounded by age so it cannot disturb
live work, and it never replays a possibly-billed attempt.

---

## 6. Failure classification

| Failure | Class | Behaviour |
|---|---|---|
| MongoDB temporarily unavailable | integrity/availability | request fails; reader fallback continues |
| Python AI service down | pre-dispatch | `known`; no charge; lesson still readable |
| provider timeout | uncertain | reservation retained; never auto-retried |
| provider malformed/empty output | uncertain | retained; validation rejects |
| budget ledger unavailable | pre-dispatch | refuse; no dispatch |
| validation rejection | — | plan not persisted, typed code |
| invalid stored record | integrity | refused, digest/parse check |
| process interruption | depends on state | see §5 |

The learner always keeps the deterministic reader; no planning failure removes
lesson access.

---

## 7. Operational metrics

`planningMetrics.ts`. Eighteen closed counters and bounded latency histograms.

| Counter | Answers |
|---|---|
| `planning_request` | how often planning is asked for |
| `cache_hit` / `cache_miss` / `already_accepted_reuse` | whether reuse is working |
| `validation_accept` / `validation_reject` | proposal quality |
| `provider_dispatch` / `known_failure` / `uncertain_outcome` | dispatch safety |
| `budget_reservation` / `reconcile_reported` / `reconcile_unreported` | accounting |
| `duplicate_suppressed` / `stale_recovered` | concurrency and recovery |
| `plan_invalidated` / `reader_fallback` | invalidation and resilience |
| `adaptation_recommended` / `adaptation_neutral` | recommendation behaviour |

Latency buckets: 1, 5, 10, 25, 50, 100, 250, 500, 1000, 5000, 30000 ms, plus
overflow. Histograms rather than raw samples, so memory stays bounded and no
individual request can be reconstructed.

Exposed at `GET /api/v1/study/learning/courses/:courseId/planning/metrics`,
author-scoped to a course the caller manages.

**Nothing identifying is recorded.** A test stringifies a snapshot and asserts
it contains no `userId`, `courseId`, `revisionId`, `lessonId`, `requestId`,
`attemptId`, `email`, `token`, `apiKey`, `prompt` or `answer`. No prompt body, no
student answer, no cookie, no credential is ever recorded.

---

## 8. Load measurements

`m45-load-test.ts` — plan-availability retrieval against real MongoDB, which is
the work a page load performs. Local machine, single process, bounded levels.

| Concurrency | Requests | RPS | p50 | p95 | p99 | Errors | RSS | Heap | Event-loop lag |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 1,121 | 0.76 ms | 1.21 ms | 10.8 ms | 0 | 146 MB | 51 MB | +0.34 ms |
| 10 | 200 | 2,475 | 3.45 ms | 7.01 ms | 13.3 ms | 0 | 159 MB | 45 MB | +0.24 ms |
| 25 | 200 | 3,088 | 7.37 ms | 12.6 ms | 25.9 ms | 0 | 166 MB | 61 MB | +0.25 ms |

Repeat-hit path (what a reload does): 3,895 rps, p50 2.15 ms, p95 4.78 ms, 0 errors.

**Zero errors at every level; the event loop stayed responsive (+0.25 ms).**
Cost of the M4.5 availability check versus M4.4's `exists()` is one projected
field read instead of a key existence check — sub-millisecond at all levels
measured.

### Limitations

This is a **local, single-process, bounded** measurement on one machine. It is
not a production capacity certification, it does not model network latency, and
it does not exercise the AI service. The concurrency levels are modest because
the machine is shared with other local projects.

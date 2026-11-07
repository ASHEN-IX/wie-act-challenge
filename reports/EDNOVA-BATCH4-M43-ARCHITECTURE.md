# EdNova Batch 4 — Milestone 4.3 Architecture

**Scope:** learning modes, durable experience plans, student integration.
Built on the accepted M4.1 and M4.2 slices. No live provider call; no production
deployment.

---

## 1. Git baseline

```
<this commit>  feat(m43): durable experience plans and five learning modes
a0ebda4        docs(m42): record the provider, budget, security and acceptance evidence
4f10461        feat(m42): provider-independent planner with Gemini, consent and budget gates
d5c8e77        docs(m41): record the final closure and workstream isolation
a8928b9        (mixed nardouch commit — preserved, never rewritten)
```

M4.3 adds one path-scoped commit containing **zero nardouch files**. The 19
unrelated nardouch working-tree entries are untouched.

---

## 2. What M4.3 had to fix before it could build

### 2.1 Cross-service double debit (found, not assumed)

M4.2 documented two reservation implementations and called each atomic. Both
were — individually. Run together they were wrong:

```
Node   findOneAndUpdate  $inc usedTokens +32768
Python findOneAndUpdate  $inc usedTokens +32768     ← the same attempt, again
         … provider reports 150 tokens …
Node   updateOne         refund 32618
Python updateOne         refund 32618               ← refunding a reservation it did not make
```

Final charge: **2 × actual usage** for one provider call.

**The fix keeps both security checks.** Node owns the reservation, because it
owns the request identity, the lifecycle and the idempotency guard. Python keeps
an *independent* affordability check (`_has_headroom`) that still refuses
dispatch when the ledger cannot fund the attempt — it simply no longer writes.
Neither service can dispatch without its own check passing.

### 2.2 Model catalog claim

M4.2 claimed stable `gemini-2.5-flash` reroutes on 2026-12-01. Checked against
the current official deprecation page: **the claim is supported** — the page
lists release 2025-06-17, shutdown/reroute 2026-12-01 to `gemini-3.5-flash-lite`,
and notes dates are "earliest possible".

The brief's caution still stands and is honoured: the model catalog page does
**not** display dated shutdowns, so a single source is not enough to justify a
migration. Therefore:

- the planner model stays configurable (`EXPERIENCE_PLANNER_MODEL`)
- the formula pipeline is **not** migrated
- model existence, structured-output support and project eligibility are checked
  before any dispatch, never inferred from a name

### 2.3 Plan persistence

M4.2 stored only a digest, so an accepted plan could not be retrieved for a
learner. M4.3 stores the body — **without making it trusted** (§4).

---

## 3. Learning modes

`shared/ednova/learningModes.ts`. Five modes, each an explicit deterministic
policy plus a planner objective:

| Mode | Plans? | Prefers | Requires asset |
|---|---|---|---|
| Read | **no** | the extracted presentation, unchanged | no |
| Guided | yes | definitions, theorems, examples, proofs, progressive disclosure | no |
| Explore | yes | interactive/diagram components, walkthroughs, topologies | **yes** |
| Practice | yes | exercises, worked examples, proofs | no |
| Deep Dive | yes | proofs, derivations, reviewed formulas, source references, expanded | no |

**A mode is a presentation policy, never a source of truth.** It may prefer a
component; it cannot add, remove, reorder or rewrite a block, and it cannot make
a formula reviewed. Coverage and review requirements are enforced by the
validator, identically for every mode.

### No manufactured differences

`indistinguishableFromRead()` reports when Explore has neither a structured
asset nor an interactive block. The reader then shows the deterministic
presentation and says so, rather than presenting a mode that silently does
nothing. This is the brief's explicit requirement, implemented as a predicate
rather than a comment.

---

## 4. Durable plans and the revalidating read path

### Store

`experience_plan_records`, one live row per
`(course, revision, lesson, mode, contextFingerprint)`.

Bound to: course, revision, lesson, content hash, plan schema, registry version,
presentation schema, context fingerprint, mode, provider/model/implementation,
digest, generation metadata, supersession and invalidation.

**The body is stored; the plan is not trusted.** The validated-plan brand is a
module-private symbol and does not survive serialization, so a row read from
MongoDB is exactly as untrusted as raw provider output.

### Read path

```
authorize (published-reading boundary)
  → resolve exact revision
  → verify canonical / presentation integrity
  → ensure content hash + fingerprint + schema + registry still match
  → parse the stored body through the same contract
  → rebuild the trusted validation context from live records
  → rerun the seven-stage validator
  → require the revalidated digest to equal the stored digest
  → return the plan, or fall back
```

The context is rebuilt from **live** data on every read. That is what stops an
old plan bypassing review governance: a revoked approval or an edited asset
makes the same record fail now, even though it was accepted earlier.

---

## 5. Author generation vs student access

| Action | Who | Route |
|---|---|---|
| Generate a plan | course author / operator (`canManageCourse`) | `POST …/presentation/plan/ai` |
| View an accepted plan | enrolled learner on an authorized revision | `GET …/presentation/plan/stored` |
| Read the lesson | anyone authorized to the revision | the existing reader |

- The read route **cannot dispatch to a provider** — it has no provider import.
- Student access does not imply permission to invoke Gemini.
- `canManageCourse` is not widened, and no new policy is invented.
- Generation is never triggered by page load.

---

## 6. Reader integration

Extends the existing lesson-scoped reader. No new application, no rebuilt
renderer.

- a five-mode selector replaces the three-mode control, sharing the `mode` query
  parameter so a mode is deep-linkable and back/forward works
- `Read` renders the deterministic presentation and never requests a plan
- a mode plan is fetched server-side for the selected mode and bound to the exact
  course, revision and lesson before it is honoured
- loading and unavailable states are visible, so a mode never silently does
  nothing
- internal identifiers never reach the learner (§7)

---

## 7. What a learner sees, and what they never see

| Removed from learner UI | Where it lives now |
|---|---|
| `mock_experience_planner` | developer diagnostics only |
| provider request ids | the request row |
| `PLAN_*` validation codes | the rejection record and logs |
| source hashes | the record |
| budget/approval identifiers | the ledger |

The banner reads **"AI-arranged lesson"**, states that course content is
unchanged, that every block is rendered by a trusted component, and that AI
arrangement **does not verify the lesson's mathematics**. In QA, a mock plan is
labelled as such.

---

## 8. Deliberate non-goals

No learner adaptation, mastery inference, voice, generated lesson content, plan
caching policy tuning, cross-user reuse, live provider call or deployment.

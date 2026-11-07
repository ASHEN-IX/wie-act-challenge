# EdNova Batch 4 — Milestone 4.2 Architecture

**Scope:** real AI provider integration, budget governance and safe experience
planning, built on the accepted M4.1 slice.
**Status:** implemented and tested with a mocked provider SDK. **No live provider
call was made, and none is authorized by this milestone.**

---

## 1. Git baseline

```
HEAD  d5c8e77  docs(m41): record the final closure and workstream isolation
      d19ce9e  test(m41): brand, governance and asset evidence
      0245876  fix(m41): placement bound + QA fixture baseline
      a8928b9  (mixed nardouch commit — preserved, never rewritten)
```

M4.2 adds one commit on top, path-scoped. Verified: **zero nardouch files** in
it. The 19 unrelated nardouch working-tree entries are untouched.

### Reported test counts, verified

| Suite | Reported | Measured at M4.2 | Notes |
|---|---|---|---|
| API unit | 960 | **1043** | +83 new M4.2 tests |
| Web unit | 207 | **207** | unchanged |
| M4.1 browser | 2 | **3** | +1 M4.2 scenario |

---

## 2. Reused AI infrastructure (and what was deliberately not duplicated)

The repository already had a complete, hardened provider stack:

| Existing piece | What it does | Reused for |
|---|---|---|
| Python AI boundary (`apps/ai`) | the only process holding the Gemini SDK | all provider dispatch |
| `google-genai` **2.31.0** | current SDK, `response_json_schema` supported | structured output |
| `llm_client._approval` / `_reserve_approved_call` / `_budget_still_active` | operator approval + durable budget | planning approval |
| `llm_approval_budgets` ledger | atomic token reservations | planning reservations |
| `formula_source_consents` pattern | owner consent, purpose-scoped | `experience_planning_consents` |
| `formula_provider_eligibility` pattern | free-tier verification | `experience_planner_eligibility` |
| `aiClient` | authenticated internal HTTP, strips browser cookies | the dispatch boundary |
| formula job lifecycle | dispatch markers, uncertain-state recovery | planning lifecycle |

### The architecture decision

**Planning dispatches through the Python AI boundary. NestJS does not import a
Gemini SDK.**

Alternatives considered:

| Option | Why rejected / chosen |
|---|---|
| `@google/genai` in Node | a *second* SDK integration, a second approval path and a second budget implementation. The security controls already exist and are tested in Python. |
| A new planning microservice | explicitly ruled out by the brief, and would duplicate the same controls a third time. |
| Direct HTTP to the Gemini REST API from Node | loses the SDK's structured-output handling and the existing retry/timeout discipline, and still needs the approval machinery reimplemented. |
| **Reuse the Python boundary** | **chosen.** One SDK, one approval path, one budget ledger, one credential store. |

Division of responsibility is strict:

```
NestJS (trusted application)          Python (provider boundary)
  authorization                         credential binding
  owner consent                         budget reservation
  operator eligibility                  SDK invocation
  revision pinning                      usage reporting
  idempotency                           typed pre-dispatch refusals
  M4.1 independent validator
  everything the learner sees
```

Nothing in Python validates a plan. Nothing in Node calls a model.

---

## 3. Provider-neutral contract

`shared/ednova/experiencePlannerProvider.ts`

```ts
interface ExperiencePlannerProvider {
  readonly identity: ProviderIdentity;
  isEnabled(): boolean;
  plan(request: BoundedPlanningRequest): Promise<ProviderOutcome>;
}
```

The interface is deliberately narrow. A provider **must not**: authorize, decide
review status, read collections, validate source ownership, render components,
or write learner progress. Those stay in the application, which is why the
contract module imports no database and no model client.

### Failure classification

The single most important design property:

| Class | Meaning | Consequence |
|---|---|---|
| `known` | provably never reached the model | safe to retry; no usage |
| `uncertain` | may have reached the model | accounted for, **never auto-retried** |

Twenty-two typed codes. `KNOWN_FAILURE_CODES` is the explicit allowlist;
everything else is uncertain by default, because the safe default for "did we
get charged?" is "assume yes".

### Two adapters, one contract

- `MockExperiencePlannerProvider` — wraps the M4.1 deterministic planner
- `GeminiExperiencePlannerProvider` — dispatches through the Python boundary

Neither is special-cased downstream: the validator cannot tell which produced a
proposal, and does not need to.

---

## 4. Gemini adapter and model configuration

```ts
DEFAULT_PLANNER_MODEL = 'gemini/gemini-3.6-flash'
PLANNER_MODEL_ENV     = 'EXPERIENCE_PLANNER_MODEL'
```

**Why not `gemini-2.5-flash`.** The provider deprecates it: it is no longer
selectable in AI Studio and reroutes from **2026-12-01**. The formula pipeline
still pins it; that is pre-existing and out of scope, but planning must not
start on a model that is already leaving.

The model is configurable, validated (`provider/model` shape only), and never
embedded at a call site. A malformed override falls back to the default rather
than dispatching to something unparseable.

### Installed SDK versus current docs

The official structured-output docs now describe an `interactions.create` API
with `response_format`. The pinned SDK (2.31.0) does not have it; it exposes
`response_json_schema` on `GenerateContentConfig`. This milestone uses **the
installed contract** and documents the gap rather than mixing legacy assumptions
with the newer API surface.

Verified directly in the container:

```
version 2.31.0
response_json_schema True
response_format      False
```

---

## 5. Structured output

The schema is generated per request from the bounded context:

- `placements` items are constrained to the **actual block ids** in this lesson
- `component` and `fallback` are enums of the **actual capability types**
- `assetId` is an enum of **eligible, review-verified assets only**
- `group` and `disclosure` are closed vocabularies

There is **no field** in which a model could claim review authority, validity,
a URL, code or a new component. That is a structural guarantee, not a policy.

**Schema compliance is not correctness.** Every proposal is re-parsed against the
M4.1 contract and then run through the seven-stage validator. The schema is a
generation aid; the validator is the authority.

---

## 6. Context minimisation

`shared/ednova/planningContext.ts`, caps in `PLANNING_CONTEXT_LIMITS`:

| Bound | Value |
|---|---|
| lesson characters | 24 000 |
| per-block characters | 2 000 |
| blocks | 400 (the canonical contract's own bound) |
| assets | 24 |
| capabilities | 40 |
| task characters | 32 000 |

**Included:** course title, exact revision, lesson title, mode, block identities
and kinds, bounded source text, capability descriptions, review-verified assets.

**Excluded, by construction:** tokens, credentials, learner identity or history,
instructor private data, filesystem paths, raw images, any other course.

Truncation is **explicit**: `truncated` is set, a note is added to the task, and
coverage is preserved (every block is still named even when its prose is
dropped). A lesson that cannot fit at all throws rather than sending a partial
document while claiming completeness.

**Document text is fenced and labelled as untrusted data.** The system policy
states it; the fence makes it visible; and the validator does not care what the
model believed anyway.

---

## 7. Generation lifecycle

`modules/study/src/services/experiencePlanGeneration.ts`

```
requested → authorized → reserved → dispatched → validating
  → validated | rejected | failed | uncertain | cancelled
```

Persisted in `experience_plan_requests`. The row stores **identities,
accounting and the plan digest — never the proposal body**, so a stored row can
never become a source of trusted content.

Two invariants:

1. the proposal is untrusted until the validator accepts it
2. a failure never removes the deterministic reader

**Idempotency.** One row per `(course, revision, lesson, mode, context
fingerprint, provider, model)`. A genuinely in-flight state returns `duplicate`
and dispatches nothing. `requested` is excluded, because that is the row the
current call just created.

**Uncertainty is sticky.** A previous `uncertain` row refuses to replay; a
previous `validated` row cannot be replayed from storage (the body is not kept)
and is reported as `PLAN_NOT_RETAINED` rather than silently re-planned.

---

## 8. Review provenance — closing C3

M4.1 verified that a review claim was *internally consistent and correctly
bound*. That proves a claim looks like a review, not that a person made one.

M4.2 adds `structured_asset_reviews`: one row per asset **version**, written by
an authorized reviewer, carrying the exact `contentHash`.

Verification now requires **all** of:

1. a decision row exists
2. `decision === 'approved'`
3. not revoked
4. `contentHash` matches the asset's current payload
5. lesson binding matches
6. the reviewer **still holds author rights on the course right now**

Anything short is ineligible, and a plan naming such an asset is rejected.

Because the hash covers the payload, **editing an asset invalidates its
approval** instead of inheriting it. `generated_proposal` is not reviewable at
all. `deterministic_demo` is excluded: product-authored demonstration content has
no instructor to review it.

---

## 9. Consent and eligibility

`modules/study/src/services/planningGovernance.ts`

Consent is **purpose-scoped**. Formula-recognition consent does not authorize
lesson planning: the purpose is part of the record and part of the identity
hash, and the query filters on it.

Eligibility is a **separate operator-verified record**. An API key existing never
implies eligibility. The gate refuses on: no record, billing attached, not
free-tier, expired, no operator verification, credential mismatch, no budget
approval.

Order is deliberate: authorization → consent → eligibility → approval. Cheap and
authoritative refusals first.

---

## 10. Budget accounting

`modules/study/src/services/planningBudget.ts` — reuses the existing
`llm_approval_budgets` ledger rather than adding a second one.

- **reserve atomically** before dispatch, conditional on remaining budget, task,
  model, expiry and non-revocation
- **reconcile after**: reported usage refunds the difference; **no report keeps
  the full reservation spent**
- refunds are bounded so the ledger cannot go negative

A provider that reports nothing is not free. `costUsd: null` means *not
measured*, never *zero*.

---

## 11. Reader integration

Unchanged from M4.1 in structure. `aiPlannedLessonExperience` maps **every**
non-`planned` outcome — refused, rejected, failed, uncertain, duplicate,
disabled — to `undefined`, and the reader renders the deterministic presentation.

A learner never sees a provider error. A security refusal is never dressed up as
success: they simply get no plan. No external call happens on an ordinary page
refresh, because planning is an explicit POST from the planning route.

---

## 12. Deliberate non-goals

No live provider call. No Batch 4.3. No voice. No mastery inference. No generated
lesson text. No new microservice or database. No change to canonical revisions,
Detector V2 or historical FAISS artifacts. No production deployment.

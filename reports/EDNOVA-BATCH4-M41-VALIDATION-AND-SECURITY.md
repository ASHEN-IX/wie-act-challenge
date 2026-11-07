# EdNova Batch 4 — M4.1 Validation & Security

Every claim below is backed by a test or a captured run. Test names are exact.

---

## 1. The trust boundary

```
planner output  ──►  parseExperiencePlanProposal   (structure only)
                ──►  validateExperiencePlan        (7 stages, trusted context)
                ──►  finalizeExperiencePlan        (mints the brand)
                ──►  projectExperiencePlan         (browser shape)
                ──►  parsePublishedExperiencePlan  (browser re-parse)
                ──►  LessonReader                  (existing registry)
```

An LLM response is never an authorization grant. It is never executable code.
The proposal may *claim* anything; every claim is re-derived from trusted data.

---

## 2. Proposal vs validated plan

| Guarantee | Test |
|---|---|
| A JSON object with `validated: true` is not a validated plan | `cannot be forged by setting validated:true in JSON` |
| Only the module can mint a validated plan | `isValidatedExperiencePlan` requires the private symbol |
| Projection refuses anything else | `only projects a branded validated plan` |

---

## 3. Stage-by-stage evidence

### Stage 1 — schema

| Attack | Code | Test |
|---|---|---|
| unknown version | `PLAN_SCHEMA_UNSUPPORTED_VERSION` | `rejects an unknown schema version` |
| unknown field | `PLAN_SCHEMA_UNKNOWN_FIELD` | forged-`validated` test, forged-review test |
| markup in an id | `PLAN_SCHEMA_UNSAFE_MARKUP` | `rejects markup in a placement id`, `attack_markup_injection` |
| `__proto__` own key | `PLAN_SCHEMA_PROTOTYPE_POLLUTION` | `rejects prototype pollution`, `attack_prototype_pollution` |
| `constructor` key | `PLAN_SCHEMA_PROTOTYPE_POLLUTION` | `rejects an unsafe constructor key anywhere in the tree` |
| duplicate placement id | `PLAN_SCHEMA_DUPLICATE_ID` | `rejects duplicate placement ids` |
| 40-level nesting | `PLAN_SCHEMA_NESTED_TOO_DEEP` | `rejects a deeply nested interaction value` |
| >256 KiB payload | `PLAN_SCHEMA_OVERSIZED` | `rejects an oversized serialized proposal` |
| `href` / `url` / `code` key | `PLAN_COMPONENT_PROPS_UNSAFE` | `rejects a javascript: URL smuggled through interaction` |
| `javascript:` under a real key | `PLAN_COMPONENT_INTERACTION_INVALID` | `rejects a javascript: value under a declared interaction key` |

Prototype pollution is injected through JSON **text**, because
`obj.__proto__ = x` in JavaScript sets the prototype and would never reach the
validator as data. The test asserts the own key exists before parsing.

### Stage 2 — identity

| Mismatch | Code | Test |
|---|---|---|
| course | `PLAN_IDENTITY_COURSE_MISMATCH` | `binds the plan to course, revision, content hash and lesson` |
| revision | `PLAN_IDENTITY_REVISION_MISMATCH` | same, and `attack_cross_revision` |
| content hash | `PLAN_IDENTITY_CONTENT_HASH_MISMATCH` | same, and `attack_forged_identity` |
| lesson | `PLAN_IDENTITY_LESSON_MISMATCH` | same |
| registry version | `PLAN_IDENTITY_REGISTRY_MISMATCH` | `rejects a stale component-registry version` |
| planner not allowed | `PLAN_IDENTITY_PLANNER_UNKNOWN` | `rejects a planner implementation the deployment did not allow` |

### Stage 3 — canonical coverage

| Attack | Code | Test |
|---|---|---|
| fabricated block | `PLAN_COVERAGE_BLOCK_UNKNOWN` | `rejects a fabricated block id` |
| omitted block | `PLAN_COVERAGE_BLOCK_MISSING` | `rejects an omitted canonical block` |
| duplicated block | `PLAN_COVERAGE_BLOCK_DUPLICATED` | `rejects a duplicated canonical block` |
| reordered blocks | `PLAN_COVERAGE_BLOCK_REORDERED` | `rejects reordered canonical blocks` |
| cross-lesson block | `PLAN_COVERAGE_CROSS_LESSON` | `rejects a block placed under another lesson` |

Coverage is positional, not set-based: the placement array must equal the
canonical block array element by element. That is what makes "no silent
omission, duplication, reordering or relabelling" enforceable rather than
aspirational.

### Stage 4 — component capability

Every check reads `COMPONENT_CAPABILITIES`. There is no second list.

| Attack | Code | Test |
|---|---|---|
| component not in registry | `PLAN_COMPONENT_UNKNOWN` | `rejects an unknown component rather than degrading it` |
| future version | `PLAN_COMPONENT_VERSION_UNSUPPORTED` | `rejects a component version from the future` |
| wrong block kind | `PLAN_COMPONENT_BLOCK_INCOMPATIBLE` | `rejects a component that does not accept the block type` |
| primary over source-faithful | `PLAN_COMPONENT_POLICY_INCOMPATIBLE` | `refuses to upgrade an unreviewed formula to a primary component` |
| derivation over unreviewed math | `PLAN_COMPONENT_UNREVIEWED_FORMULA` | `rejects a derivation over mathematics the application did not review` |
| topology without fixture | `PLAN_COMPONENT_FIXTURE_MISSING` | `rejects a topology without a structured fixture` |
| fallback not in registry | `PLAN_COMPONENT_FALLBACK_UNTRUSTED` | `rejects a fallback the registry does not own` |
| undeclared interaction key | `PLAN_COMPONENT_INTERACTION_INVALID` | `rejects an interaction key the component does not declare` |

The brief's specific examples are covered:
`NetworkTopology` needs a validated topology fixture; `CodeWalkthrough` needs a
structured asset; `DerivationBlock` cannot turn an unreviewed formula into
approved steps; `DataChart`/`NetworkTopology`/`ArchitectureDiagram`/`AnnotatedDiagram`
cannot infer a relationship without a fixture.

**A design decision worth stating:** the validator does *not* require the
declared fallback to accept the block type. The registry's own fallbacks
degrade across kinds (a heading falls back to prose), and the renderer's
boundary already handles a mismatched pair safely. Requiring it would have
rejected the registry's own choices.

### Stage 5 — asset and provenance

| Attack | Code | Test |
|---|---|---|
| asset id never stored | `PLAN_ASSET_UNKNOWN` | `rejects an asset id that was never stored` |
| asset on another lesson | `PLAN_ASSET_LESSON_MISMATCH` | `rejects an asset bound to a different block` |
| asset on another block | `PLAN_ASSET_BLOCK_MISMATCH` | same |
| component disagrees | `PLAN_ASSET_COMPONENT_MISMATCH` | `rejects an asset component that disagrees with the placement` |
| `generated_proposal` | `PLAN_ASSET_GENERATED_PROPOSAL` | `rejects an unreviewed generated proposal even when a plan names it` |
| no trusted review record | `PLAN_ASSET_REVIEW_UNVERIFIED` | `rejects an asset whose review claim has no trusted record` |
| unresolved source refs | `PLAN_ASSET_SOURCE_UNVERIFIED` | `rejects a source-derived asset whose references do not resolve` |
| foreign-revision asset reaching the planner | `PLAN_ASSET_REVIEW_UNVERIFIED` | `fails closed when a foreign-revision asset reaches the planner` |

**Review claims cannot be forged.** A proposal carrying a top-level `review`
object fails the schema; even if it did not, the validator never reads review
state from the proposal. `verifyAssetBindings` derives it from the stored row:

- the row re-parses under the current contract,
- `instructor_reviewed` carries a reviewer and a parseable timestamp,
- the asset is bound to this exact course, revision and lesson,
- `source_derived` references resolve inside the revision's authorized documents.

Anything that fails is marked ineligible and a plan naming it is rejected. There
is **no** shortcut that marks a generated proposal as reviewed.

**A documented limitation.** This milestone does not introduce a separate
review-record collection. The verification above is the minimum the current
persistence supports; it proves the claim is internally consistent and correctly
bound, not that an independent reviewer approved the content. A full approval
workflow is deferred, and the acceptance report records this as a bounded
dependency rather than claiming review governance we do not have.

### Stage 6 — resource limits

Measured (see the acceptance report): at the canonical maximum of 400 blocks,
full validation takes **1.30 ms mean / 1.42 ms p95**. Worst-case malformed input
(oversized array) rejects in **0.43 ms**. Nothing here is unbounded.

### Stage 7 — finalization

Only a complete, fully validated proposal is minted. The digest is a
deterministic FNV-1a over the accepted plan, so the same request always yields
the same digest — asserted by `is deterministic: identical input yields an identical digest`
and `is stable across identical requests`.

---

## 4. Injection through source content

The planner never receives raw source text. Its context is identity and kind
only:

```ts
type PlannerBlockView = { blockId, blockType, role?, render, hasEvidence,
                          hasSourceRegion, isReviewedFormula, hasStructuredFixture }
```

Test `treats a presentation block type as data, never as an instruction`
asserts the context carries no `learnerRequest`, no `sourceText`, and no
injected phrase. The service test `carries no source text or learner identity`
asserts the published plan contains no source prose, no actor id, no token.

Malicious strings in PDF text, lesson titles, asset descriptions, diagram
labels or code comments therefore never reach a planner prompt in this
milestone — and if a future provider receives them, they arrive as data inside
a context that the validator re-checks against trusted records regardless of
what the model "decided".

---

## 5. Authorization

`planLessonExperience` calls `getPublishedPresentation`, the single published-
reading boundary. It does not re-implement or widen any check. Consequences:

- an unauthorized actor gets the boundary's own 403/404, not a plan;
- a revision that is not the exact requested one fails closed;
- a checksum mismatch fails closed (the boundary throws before planning starts).

Test `is disabled unless the QA flag is explicitly set` asserts the planner does
not even load the presentation when disabled.

---

## 6. Fallback semantics

| Case | Behaviour | Evidence |
|---|---|---|
| valid mock response | plan rendered through existing components | browser `01`→`02` |
| invalid schema | rejected, deterministic presentation | `03-rejected-plan-fallback.png` |
| unauthorized revision | authorization failure, **not** fallback success | browser outsider assertion |
| canonical checksum mismatch | fail closed before planning | boundary test (Batch 3) |
| invalid structured asset | asset skipped, lesson unaffected | `skips a malformed stored asset instead of failing the lesson` |
| planner unavailable | deterministic lesson, no partial layout | `reports a provider timeout as unavailable rather than rejected` |
| repeated request | stable digest and stable validation | `is stable across identical requests` |

A rejected plan is never a broken page: the reader renders the deterministic
projection exactly as before.

---

## 7. What is *not* claimed

- No model quality, pedagogical accuracy or educational adaptation is claimed
  from mock-plan tests.
- No live provider was called.
- Review governance is bounded as described in §3 (stage 5).
- The browser suite proves rendering and rejection; it does not prove the
  long-run behaviour of a real provider, because there is none yet.

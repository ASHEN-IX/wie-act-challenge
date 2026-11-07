# EdNova Batch 4 — Milestone 4.1 Architecture

**Scope:** AI Experience Plan Contract, Validation Engine & Governance.
**Status:** implemented vertical slice. Milestone 4.2 not started.

---

## 1. Baseline this work was built on

The reported Batch 3 commit is **not** the current HEAD. The actual state at the
start of this milestone:

| Fact | Evidence |
|---|---|
| `HEAD` | `f7895fc` (Noveris UI rebrand) |
| Batch 3 contracts | `componentRegistry.ts`, `presentationPlan.ts`, `structuredAsset.ts`, `experiencePlanner.ts` are **untracked** working-tree files, not commits |
| Tracked Batch 3 work | `presentationDocument.ts`, `presentationReader.ts`, `presentation-document.test.ts`, `presentation-reader.test.ts` carry uncommitted modifications |
| Unrelated workstream | `nardouch` files (untracked) and edits to `learning.ts`, `lesson-reader.tsx`, `present.tsx` arrived **during** this milestone |

The M4.1 baseline is therefore the working tree as it stood at audit time, with
the nardouch workstream treated as read-only. Nothing in this milestone stages,
reverts or rewrites it.

### Test-count reconciliation (the brief asked for this explicitly)

| Suite | Reported | Measured now | Explanation |
|---|---|---|---|
| API unit | 338 | **338** | matches |
| Web unit | 194 | **195** (before M4.1) | +1 from the unrelated `nardouch` `speech-cache.test.ts` |
| Integration | 19 | **19** | matches once MongoDB/RabbitMQ are up |
| Total | 551 | **552** | the one extra web test |

The report's 194/551 was correct when written; the tree gained one unrelated
test afterwards. Neither number was invented. After M4.1 the web suite is
**205** (195 + 10 new M4.1 tests) and the API suite grows by the M4.1 suites.

---

## 2. What already existed and was reused

Nothing canonical was duplicated. M4.1 is additive:

| Existing contract | Reused for |
|---|---|
| `COMPONENT_CAPABILITIES` / `resolveComponent` (`componentRegistry.ts`) | the **only** component vocabulary; the validator consults it directly |
| `PublishedPresentationV1` + strict parser (`presentationDocument.ts`) | the pinned, checksum-verified revision and its canonical blocks |
| `StructuredAssetV1` + `projectStructuredAsset` (`structuredAsset.ts`) | asset contract, provenance categories, learner-visibility rule |
| `StructuredAsset` model | trusted asset lookup |
| `getPublishedPresentation` (`presentationReader.ts`) | the single authorization/revision-pinning boundary |
| `experienceContextFingerprint` conventions (`activityIdentity.ts`) | deterministic identity |
| Batch 3 reader (`lesson-reader.tsx`, `components/registry.tsx`) | rendering; **not** rebuilt |
| `qa-*.sh` harness scripts | browser evidence |

`shared/ednova/experiencePlanner.ts` (the older Batch 3 planner boundary) is
left untouched and unused by this milestone. It is a different, narrower
contract; replacing it was out of scope.

---

## 3. New contracts

### 3.1 `shared/ednova/experiencePlan.ts`

`LearningExperiencePlanV1`, version `1.0.0`.

**Two representations, one direction of trust:**

```
UntrustedExperiencePlanProposal   raw planner output — no authority
ValidatedLearningExperiencePlan   the only shape the reader may render
```

The validated type is branded with a module-private `Symbol`. `isValidatedExperiencePlan`
returns true only for values minted by `finalizeExperiencePlan`. A proposal that
sets `validated: true` in JSON is still a proposal — and is in fact rejected as an
unknown field.

**Identity binding.** A plan is bound to course, revision, content hash, lesson,
mode, presentation schema version, registry version, context fingerprint and
planner implementation/version. The fingerprint is an FNV-1a digest over
`[courseId, revisionId, contentHash, lessonId, mode, blockIds]` — no learner
identity, no private context, no raw text inside an identifier.

**Placement.** Each proposed component names: component type, component version,
the canonical block it renders (identity only, never content), an optional
existing asset id, a grouping label from a closed vocabulary, a disclosure mode,
interaction configuration from a per-component allowlist, and a fallback.

Explicitly not representable: JSX, functions, dynamic imports, HTML, external
URLs, API requests, CSS, unbounded nesting, unknown component types.

**Limits** (`EXPERIENCE_PLAN_LIMITS`): 424 placements (the canonical contract's
own 400-block bound plus 24 supplements), 24 supplements, 8 groups, 8 interaction
entries, 200-char labels, 2 000-char text, 256 KiB serialized, interaction depth 3.

### 3.2 `shared/ednova/experiencePlanValidator.ts`

The independent validator. Pure: no database, no model, no clock. It consumes
`COMPONENT_CAPABILITIES` and a **trusted context** the application builds.

Seven stages, each with typed rejection codes (`EXPERIENCE_PLAN_REJECTIONS`, 47
codes across `schema | identity | coverage | component | asset | limits | finalization`):

| Stage | Rejects |
|---|---|
| 1 schema | unknown version/field/type, markup, prototype pollution, oversized, duplicate ids, excessive nesting |
| 2 identity | wrong course/revision/hash/lesson/mode, stale registry, wrong presentation schema, fingerprint mismatch, unknown planner |
| 3 coverage | unknown, missing, duplicated or reordered canonical blocks; cross-lesson references |
| 4 component | unknown component, unsupported version, incompatible block/role/policy, missing evidence/region/fixture, unreviewed formula, untrusted fallback, invalid interaction |
| 5 asset | unknown asset, wrong revision/lesson/block, component mismatch, generated proposal, unverified review, unverified source |
| 6 limits | too many placements/supplements/groups, over-long text |
| 7 finalization | incomplete canonical coverage |

`ExperiencePlanRejection.message` is the **code itself**, never interpolated
proposal text — so an error cannot echo source content or a credential.

### 3.3 `shared/ednova/mockExperiencePlanner.ts`

Provider-independent, deterministic, no network. 21 scenarios: 4 valid
(mathematics/programming/engineering/prose) and 17 hostile or broken, including
all sixteen the brief lists plus prototype pollution, unsafe URL, forged identity
and a script-scheme component name. Two failure modes (`provider_timeout`,
`provider_malformed`) return `{ ok: false }` rather than a proposal, so the caller
distinguishes "no output" from "bad output".

Every proposal carries `implementation: 'mock_experience_planner'`, which the
validator checks against a deployment allowlist. A mock plan cannot masquerade
as a production one.

### 3.4 `shared/ednova/publishedExperiencePlan.ts`

The browser-boundary parser. Mirrors `parsePublishedPresentation`: unknown
version, unknown component, duplicate placement id, or a canonical sequence that
does not match the lesson's block order all fail the parse. It re-establishes
*internal consistency*; the server already established *safety*.

### 3.5 `modules/study/src/services/experiencePlanning.ts`

`ExperiencePlanningService` (named `planLessonExperience`), plus
`verifyAssetBindings` and `projectExperiencePlan`. Gated by
`EDNOVA_ENABLE_MOCK_EXPERIENCE_PLANNING === 'true'`, read at call time so a
misconfigured deployment fails closed.

---

## 4. Why this extends rather than replaces the deterministic system

```
Published Course Revision
  → Authorized Learning Context        (getPublishedPresentation — unchanged)
  → Available Component Capabilities   (COMPONENT_CAPABILITIES — unchanged)
  → Mock AI Experience Planner         (new, mock only)
  → Untrusted Experience Plan Proposal (new)
  → Schema Validation                  (new)
  → Revision and Source Verification   (new, over existing pinned data)
  → Capability and Asset Verification  (new, over existing registry + assets)
  → Governance and Security Validation (new)
  → Accepted Experience Plan           (new, branded)
  → Existing Batch 3 Renderer          (lesson-reader.tsx — reused)
```

The deterministic Batch 3 `presentation.plan` still exists and is still what
renders when no experience plan is supplied. The experience plan is an
**optional override of component choice only**: it may pick a different trusted
component for a block, never remove a block, never reorder one, and never change
a block's content. The reader applies it only when it is bound to the exact
course, revision and lesson on screen.

---

## 5. Reader integration

One new optional prop on `LessonReader`:

```ts
experiencePlan?: PublishedExperiencePlanV1
```

`activePlan` is computed once and used by both the component lookup and the
provenance label, so they cannot disagree. The plan overrides
`planByBlock.get(blockId).component` and nothing else. Interaction stays a
property of the component and of reader mode, so Read mode remains a pure
reading projection even under a plan.

A small labelled note (`data-experience-plan`, `data-experience-plan-planner`,
`data-experience-plan-digest`) states the plan's provenance. Internal metadata
stays in data attributes for QA, not in the student's reading surface.

Access path: `?plan=<scenario>` on the present page, which calls the API and
falls back to `undefined` on any failure.

---

## 6. Deliberate non-goals

No live Gemini/ElevenLabs call. No learner modelling. No voice. No generated
lesson text. No new microservice. No change to grading, mastery, canonical
revisions or historical FAISS artifacts. No production deployment.

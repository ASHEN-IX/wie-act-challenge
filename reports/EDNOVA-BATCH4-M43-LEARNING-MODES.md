# EdNova Batch 4 — M4.3 Learning Modes

Every claim is backed by a test or a captured run.

---

## 1. The contract

`shared/ednova/learningModes.ts`, 13 tests in `learning-modes.test.ts`.

| Mode | Label | Plans | `requiresAsset` | Interaction |
|---|---|---|---|---|
| `read` | Read | **no** | no | none |
| `guided` | Guided | yes | no | disclosure |
| `explore` | Explore | yes | **yes** | yes |
| `practice` | Practice | yes | no | none |
| `deep_dive` | Deep Dive | yes | no | none |

Each mode carries an objective (fixed application text), an advisory preferred
component list, and a disclosure shown to the learner.

---

## 2. Mode behaviour, verified

### Read

`never lets Read use a planner` — `usesPlanner === false`, `modeObjective('read')`
is null. The mode renders the Batch 3 deterministic presentation and issues no
request.

### Guided

Prefers `DefinitionCard`, `TheoremCard`, `ExampleBlock`, `ProofBlock`,
`ConceptExplanation`, `StepSequence`. Collapsed disclosure so a learner reads
before revealing. The objective explicitly forbids inventing steps,
explanations or examples.

### Explore

`marks Explore as asset-dependent` — its value is interactive data. The objective
requires an interactive component **only** for a block that carries a trusted
structured fixture, and forbids forcing interaction onto a block that lacks the
data.

### Practice

Surfaces the lesson's own exercises and worked examples. The objective forbids
generating questions, answering them or implying grading. Practice tools remain
the existing surface; the plan does not grade anything.

### Deep Dive

Prefers `ProofBlock`, `DerivationBlock`, `ReviewedFormula`, `SourceMathFallback`,
`SourceReference`, `EducationalTable`, with expanded disclosure. The objective
forbids inventing prerequisites or concepts.

---

## 3. Modes cannot manufacture differences

`indistinguishableFromRead(mode, signals)`:

- Explore with no structured asset and no interactive block → **true**; the
  reader shows the deterministic presentation and states that no AI-arranged
  presentation is available for this mode yet.
- Any reading mode → **false**; a reading arrangement is always meaningfully
  different from raw extraction.
- Read itself → **false**.

Tested in `says a mode is indistinguishable only when it genuinely is`.

---

## 4. Modes reach the planner as fixed policy

The objective and the preferred-component hint are inserted into the task by the
application, never derived from document content:

- `includes the mode objective in the task`
- `includes preferred components as an advisory hint`
- `does not add a mode objective for an unknown mode`
- `keeps document text fenced regardless of mode`

The last one matters: a mode changes the *instruction*, never the containment.
Injected text stays inside the untrusted fence in every mode.

---

## 5. Learner-facing language

`discloses what each mode will not do` asserts:

- Practice: "Nothing is graded here."
- Guided: "Content is unchanged."
- Read: the lesson "exactly as extracted"

and that no disclosure *affirms* verification, approval or correctness. The
check strips negated forms first, so "Nothing is graded" is correctly read as a
denial rather than a claim.

The in-reader banner adds:

> AI-arranged lesson. Course content is unchanged and every block is rendered by
> a trusted component. AI arrangement does not verify the lesson's mathematics.

---

## 6. Canonical coverage under every mode

The mode changes preference, not coverage. `ExperiencePlanValidationContext` is
built identically for every mode, and stage 3 of the validator requires one
placement per canonical block in canonical order. A mode that omitted a block
would be rejected exactly as in M4.1.

Verified end to end in the browser
(`learning modes render from a persisted plan and never widen learner access`):
for `guided`, `explore`, `practice` and `deep_dive`, the reader shows
`[data-presentation-view]`, at least one `[data-block-type]`, and the lesson's
own title — i.e. the lesson content survives every mode.

---

## 7. Unreviewed mathematics stays source-faithful

Unchanged from M4.1 and not mode-dependent: a source-faithful block may only be
rendered by a component declaring the source-faithful policy, and Deep Dive's
preference for `SourceMathFallback` is exactly that. No mode can promote an
unreviewed formula, because `PLAN_COMPONENT_POLICY_INCOMPATIBLE` and
`PLAN_COMPONENT_UNREVIEWED_FORMULA` fire first.

The browser fixture has 0 of 2 formulas reviewed, and the reader shows the
unreviewed disclosure in every mode.

---

## 8. What is *not* claimed

- No claim that Guided or Deep Dive improve learning outcomes. They change
  arrangement, not content or pedagogy.
- No claim that a mode's preferred components are always available; the
  registry and the lesson's eligibility decide, and a mode degrades rather than
  forcing a component.
- Explore is only as useful as the lesson's structured assets. For lessons with
  none, it is explicitly reported as indistinguishable from Read.

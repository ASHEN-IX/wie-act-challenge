# EdNova Batch 4 — M4.4 Validation

Commands, counts, measured latency and the quality evaluation.

---

## 1. Test counts

| Suite | Before M4.4 | After | Delta |
|---|---|---|---|
| API unit | 1,085 / 74 | **1,137 / 77** | +52 |
| Web unit | 207 / 32 | **214 / 32** | +7 |
| Browser (real services) | 4 | **5** | +1 |
| Python boundary | 20 | 20 | untouched |
| API typecheck | 0 errors | **0 errors** | — |
| Web typecheck | 0 errors | **0 errors** | — |

### New suites

| Suite | Tests | Covers |
|---|---|---|
| `adaptation-policy.test.ts` | 35 | the seven rules, determinism, strict record parse |
| `learner-adaptation.test.ts` | 17 | evidence eligibility, isolation, concurrency |
| `lesson-reader.test.tsx` (M4.4 block) | 7 | suggestion rendering, copy, a11y |

---

## 2. Commands

```bash
cd apps/api && npx jest modules src shared --runInBand
cd apps/web && npx vitest run --maxWorkers=2
cd apps/api && npx tsc -p tsconfig.check.json --noEmit
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsx --tsconfig tsconfig.json scripts/m44-adaptation-perf.ts
DOCKER_CONTEXT=default FINAL_QA_DOCKER_NETWORK=ednova-api_default \
  pnpm --filter web exec playwright test --config playwright.m41.config.ts
```

---

## 3. Measured latency

`apps/api/scripts/m44-adaptation-perf.ts`, 2,000 iterations per row:

| Evidence rows | Policy | Fingerprint | Record parse |
|---|---|---|---|
| 0 | 0.0019 ms | 0.0085 ms | 0.0016 ms |
| 10 | 0.0023 ms | 0.0243 ms | 0.0018 ms |
| 50 | 0.0057 ms | 0.1251 ms | 0.0017 ms |
| 200 (the query bound) | **0.0100 ms** | **0.4076 ms** | **0.0017 ms** |

All p95 values within ~15% of the mean; worst observed 0.75 ms.

**Database latency is not measured here.** The evidence read is one indexed
query bounded at 200 rows against `userId`; a synthetic number for it would be a
guess. The browser run exercises it end to end in ~20 s including
authentication, page load and rendering, which is the only honest figure
available without production traffic.

### Cost and reads

| Concern | Value |
|---|---|
| Evidence queries per recommendation | 1 (bounded 200) |
| Plan availability lookups | 1 per non-Read mode (exists() only) |
| Asset lookups | 1 per lesson, only when an asset is present |
| External provider calls | **0** |
| New database | none |
| New ML model / vector store | none |

---

## 4. Browser evidence

`reports/evidence/batch4-m41/06-adaptation-suggestion.png` shows the real
published reader with:

- all five modes present, **Read active** — the suggestion did not navigate
- the suggestion: *"Try **Guided** — this lesson covers an objective you have
  not yet confirmed through practice."*
- **Open Guided**, **Not now**, **Turn off suggestions**
- the reviewed/unreviewed mathematics disclosure intact above it

The scenario also verifies, against real BetterAuth and MongoDB:

| Assertion | Result |
|---|---|
| Defaults returned for a learner with no stored preferences | PASS |
| Recommendation derived from accepted evidence | PASS — `guided` / `objective_not_yet_mastered` |
| Payload carries no score, attempt id or evidence id | PASS |
| Suggestion renders in the reader | PASS |
| Read remains `aria-current` with a suggestion visible | PASS |
| Dismissal recorded; recommendation remains but stops surfacing | PASS |
| Disabling suggestions produces no recommendation and no surface | PASS |
| Lesson remains readable with suggestions off | PASS |
| Stale preference write rejected with 409 | PASS |
| Outsider cannot read this course's adaptation | PASS |
| Outsider sees their own defaults, not the first student's | PASS |

---

## 5. Quality evaluation (Phase K)

Distinguishing technical validity from pedagogical benefit.

| Property | Result |
|---|---|
| Eligibility correctness | PASS — only own+course+revision+accepted rows |
| Recommendation reproducibility | PASS — identical input yields an identical record |
| Source-reference validity | PASS — objective ids come from the published revision join |
| Mode availability correctness | PASS — a mode is offered only when a validated plan exists |
| User override correctness | PASS — preference rules precede evidence rules |
| Privacy isolation | PASS — 2 unit tests + 1 browser assertion |
| False recommendations from unavailable evidence | PASS — neutral default, no invented reason |
| Fallback behaviour | PASS — no suggestion is a normal state |

### Manual plausibility check

Two sample recommendations reviewed against the fixture lesson
(*Summation identities*: definition, reviewed formula, unreviewed formula,
proof, code):

1. **Evidence says `obj_summation` not yet mastered, lesson teaches it** →
   recommends **Guided**. Plausible: the lesson has a definition and a worked
   proof, so a progressive arrangement is genuinely available.
2. **Learner prefers visual exploration, lesson has no review-verified asset** →
   recommends **nothing**. Correct: Explore would render exactly Read, so
   offering it would be a manufactured difference.

### Explicit limitation

**No learning-outcome improvement is claimed or measurable here.** The modes
differ in arrangement; whether Guided produces better comprehension than Read
requires a controlled student-outcome study, which has not been run. Nothing in
the product copy or these reports asserts otherwise.

---

## 6. Residual risks

| # | Risk | Severity | Evidence |
|---|---|---|---|
| R1 | No student-outcome study | Medium | out of scope; stated as a limitation |
| R2 | Evidence fixtures are QA-seeded, not real learner data | Low | labelled as such; shape matches the real collection |
| R3 | One recommendation, not a ranked list | Low | deliberate: a single explainable suggestion beats an opaque score |
| R4 | C1/C2/C4 upstream issues | Low | untouched, owners unchanged |

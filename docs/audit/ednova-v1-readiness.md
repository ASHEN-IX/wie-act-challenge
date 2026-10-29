# EdNova — challenge readiness review

Audit date: 28–29 October 2026. Baseline commit: `bb1be3d` plus the working-tree changes listed in
[what changed](#what-changed-during-this-review).

Every claim below is tagged:

- **[verified]** — reproduced by executing the code (test suite, typecheck, production build, or a
  scripted browser session against a real MongoDB and the real API).
- **[observed]** — read from source, not executed.
- **[assumption]** — not verified; stated so it is not mistaken for fact.

The recurring failure mode this review was asked to avoid is assuming a feature works because code
for it exists. Several did not. Those are the most valuable findings here.

---

## 1. Specification compliance

Source: `docs/reference/EdNova_Challenge_Specification_book.pdf` (3 pages, read in full).

| # | Requirement (paraphrased from the book) | Implementation | Status |
|---|---|---|---|
| R1 | GenAI companion supporting individual learning | Learning workspace, tutor, hints, reviewer rubric | **Implemented** — verified end to end |
| R2 | Support **group** learning | Study rooms, LiveKit rooms, peer proposals, room checks | **Implemented** — units pass; live media not exercised here |
| R3 | Simple explanations | Tutor + hint/explain endpoints with source citations | **Implemented** — degrades visibly without provider |
| R4 | Guiding questions, hints **before** answers | `hintLevel` escalation, `learningSupport` modes | **Implemented** |
| R5 | **Confusion detection** | `confusionSignals.ts` (repeated errors, hint escalation, multilingual help requests) wired into both the solo hint path and room transcripts; facilitator `CONFUSION_SIGNAL` routes to peer-first help | **Implemented** [observed] — see the correction below |
| R6 | Adapt explanation **form and level** | Hint depth / quotation difficulty selectors; `AGENT_TIERS` not on the response path | **Partially implemented** |
| R7 | Diagnostics from questions/exercises/prior responses | Provisional diagnostic endpoint, attempt history | **Implemented** |
| R8 | Accessible multilingual (Arabic/Darija/French/English) | Learner workspace only; `en`/`fr`/`ar`/`ary` with RTL | **Partially implemented** — one screen |
| R9 | Deliberate compact **and** capable model combination, documented | `AGENT_TIERS` maps agents to tiers; `litellm/config.yaml` defines aliases | **Implemented** [observed] — see §6 caveat |
| R10 | No fine-tuning / custom training | No training path in the request flow | **Implemented** |
| R11 | Non-streamed responses need progress/staged feedback | Job queue + AI status endpoint | **Implemented**, now honest (was hardcoded "available") |
| R12 | Limited shared capacity → queue/retry/fallback **with visible status** | RabbitMQ ladder `[1000,4000,16000]`, DLQ, `ExecutionMode` | **Fixed** — status was a static lie; now probed |
| R13 | RAG allowed and documented | FAISS `IndexFlatIP` 384-d + revision provenance | **Implemented** |
| R14 | Voice, dashboards, quizzes, analytics, gamification, revision notes | All present as extensions | **Implemented** where claimed |
| R15 | Working end-to-end app on a real inference service | Requires provider credentials + Python service | **Not verifiable here** — no keys, no `litellm` installed |

### Correction after merging origin/main

This review was written against `bb1be3d` while local `main` was eight commits behind `origin/main`.
After merging `origin/main` (`4ef52d4`), two of its findings were no longer true and are corrected
here rather than silently left in place:

- **R5 (confusion detection) is implemented, not partial.** Upstream added
  `apps/api/modules/study/src/services/confusionSignals.ts`: tentative signals from repeated wrong
  attempts, hint escalation, and help requests matched in English, French, Darija (Latin) and Arabic.
  It is wired into the solo hint path (`learningSupport.ts`) *and* room transcripts (`rooms.ts`), and
  the facilitator maps a tentative signal to peer-first help. Behavioural evidence of being stuck —
  not a guess at a learning style — which is the defensible reading of the requirement.
- **R11/R12 presentation was already addressed upstream.** `features/ai-status` presents the execution
  mode to learners via `AiModeNote`. What upstream did *not* fix is the backend: `GET /api/v1/ai/status`
  still returned a hardcoded `'available'` for all six agents. The two halves are now reconciled — the
  probe from this branch makes the upstream presentation truthful.

The duplicate `describeExecutionMode`/`ExecutionBadge` that this branch introduced was dropped in
favour of the upstream, already-tested component. Upstream's test asserts the same guarantees
(including that an unknown mode is never presented as a real answer).

Everything below that concerns the evidence→competency loop stands: upstream had not touched those
files, and the defect was reproduced against the merged tree's ancestry.

### The finding that mattered most

**The product's central loop was broken.** A learner could complete a reviewed activity, see
`Correct · Score: 100% · Evidence: recorded`, earn +20 XP and a badge — and then open **Progress** to
find `{"competencies":[]}` and the empty state *"Evidence takes practice."* Two contradictory
statements on adjacent screens.

This was not one bug. Five independent defects each emptied that page:
[verified] after fixing all five, the same journey renders `Computer Science → Atomic domains →
ANALYSE: 62% · 1 observations`.

1. **Competency profiles were never written from reviewed activities.** The only writer was the
   AI-job poller (`competencyUpdater`), which consumes `eval_results` produced by Socratic sessions.
   Deterministic rubric attempts never reach it. Fixed by recording accepted evidence as competency
   evidence at acceptance time (`recordAcceptedEvidence`).
2. **The read path was owner-scoped.** `buildTopicIndex` queried `Course.find({ userId })`, but
   learners reach institutional courses by *enrollment*. The index was empty for every learner, so
   every profile row was silently dropped by `if (!meta) continue`.
3. **The competency key was never indexed.** Evidence was keyed by the parent topic while the index
   only registered subtopics.
4. **Bloom levels were reported in a casing the writer never produced.** Profiles carry canonical
   lowercase `analyze`; `competencyQueries` filtered against `['ANALYSE', …]` and dropped the row.
5. **The seed wrote no `Subject`, no `LearningObjective`, and no `Course.topics`**, and stored
   `subjectId: 'computer-science'` — a slug no `Subject` could ever match.

Also fixed while in that area: the weakest-first planner had the same owner-only and casing defects,
so adaptive targeting could not see a learner's real weaknesses either.

---

## 2. Technical audit

### Verification matrix [verified]

| Check | Command | Result |
|---|---|---|
| API typecheck | `tsc -p tsconfig.check.json` / `-p tsconfig.json` | exit 0 |
| Web typecheck | `tsc --noEmit` | exit 0 |
| API module + shared tests (post-merge) | `jest modules shared` | **674/674 pass** (48 suites) |
| Integration tests (MongoDB colocated) | `jest tests/integration` | **26/26 pass** (3 suites) |
| Redis-outage regression | `jest tests/architecture/rate-limit-resilience.test.ts` | **2/2 pass** |
| Study module | `jest modules/study` | **165/165 pass** (15 suites) |
| Web tests (post-merge) | `vitest run` | **75/75 pass** (13 files) |
| Web production build | `next build --webpack` | exit 0 |
| Browser journeys | Playwright, production build | learner / instructor / admin / denial all correct |

Integration suites abort with `MongooseServerSelectionError` unless MongoDB is reachable in the same
process namespace; that is an environment constraint, not a defect. With it colocated: 26/26 pass.

### Defects found and fixed

| Severity | Defect | Evidence | Fix |
|---|---|---|---|
| **P0** | Redis configured but down → **every** endpoint 500, including `/health` | Reproduced; `MaxRetriesPerRequestError` | `RedisFallbackStore`: degrade to per-process counters, recover automatically |
| **P0** | Verified evidence produced no learner-visible progress | Browser + Mongo dump: `learning_evidences` written, `competency_profiles` empty | Five-part fix in §1 |
| **P1** | `GET /api/v1/ai/status` returned hardcoded `'available'` for all six agents | Code was six literal strings | Bounded 2 s provider probe; reports real state |
| **P1** | Re-running the demo seed failed with `EACCES` on read-only artifacts | Reproduced twice | Clear stale artifacts before rewriting |
| **P1** | Typecheck failed: modules imported `axios` without declaring it | Isolated pnpm linker | Re-export transport types from `moduleClient` |
| **P2** | Learners saw raw enum `DETERMINISTIC_FALLBACK` as the status of an answer | Screenshot | `AiModeNote` (upstream) → "Built-in guidance"; the duplicate local component was dropped on merge |
| **P2** | Tests mocked models that no longer matched the code | 11 failures | Updated fixtures; every behavioural assertion preserved |

### Regression cover added

- `tests/architecture/rate-limit-resilience.test.ts` — fails 2/2 without the Redis fix, passes 2/2 with it.
- `modules/study/src/tests/competencyEvidenceLoop.test.ts` — the two read-path tests were confirmed
  to **fail against the original code** before being accepted as guards.
- `apps/web/src/features/ai-status/ai-status.test.ts` (upstream) — asserts rule-based text is never
  labelled model output and an unknown mode is never presented as a real answer.

### Known gaps (not fixed — recorded honestly)

| Area | State | Why not fixed |
|---|---|---|
| Adaptive explanation level | Selectors exist; `AGENT_TIERS` not on the response path | Requires the Python service to run |
| Multilingual | Learner workspace only | Cross-cutting; scope is a product call |
| Live AI inference | `UNAVAILABLE` in this environment | No provider keys; `litellm` not installed |
| LiveKit media | Client SDK absent | Cannot verify without a media server |
| `src/app.ts` | Dead but retained entrypoint | Removing it is a cleanup task, not a fix |

---

## 3. UX assessment

Evaluated in a real browser at 1440 px, production build, all four roles.

**Strong.** One coherent design system across learner, instructor and admin surfaces — same sidebar,
type scale, primary green, card rhythm. Copy is unusually honest for a hackathon: *"XP reflects
activity, not mastery"*, *"not academic mastery or grades"*, *"suggested confusion remains
tentative"*. That epistemic restraint is a genuine differentiator and should survive the pitch.

**Weak, in priority order.**

1. **Contradictory feedback** (fixed). "Evidence: recorded" beside an empty evidence panel.
2. **Raw machine enums as user-facing text** (fixed). `DETERMINISTIC_FALLBACK` now reads
   "Built-in guidance" via upstream's `AiModeNote`.
3. **Progress is a flat list.** One badge per Bloom level, no trend, no next action. The data to do
   better now exists (evidence counts, confidence, recency).
4. **The learning workspace is dense.** ~10 stacked sections on one scroll. A staged flow would read better.
5. **Language switch is workspace-local.** Changing language does not persist or apply elsewhere.
6. Raw `<select>` elements bypass the styled primitive in places — cosmetic inconsistency.

---

## 4. Innovation

**The real problem.** Not "students lack explanations" — that market is saturated. The problem this
architecture is genuinely shaped around is: *AI tutors assert mastery they cannot prove.* Every
mainstream product shows a confident grade with no auditable chain from source → activity → evidence
→ competency.

**What EdNova already does that is defensible.** An immutable revision artifact with a verified sha256
manifest and a FAISS index whose hash is recorded; activities pinned to `activityRevision` +
`contentHash` + `definitionHash`; a 22-contract validation layer whose own header says it is "never an
authorization grant"; and evidence that records which rubric produced it. A submission is checkable
end to end.

**What makes it distinctive — now implemented.** The AI *status* is honest. It is trivial to fake
inference; this system reports `executionMode` per answer and, after this review, shows learners
plainly when text came from rules rather than a model. For a judging panel assessing "limited
capacity behavior with visible status", that is the requirement met in the product rather than in the
slide deck.

**What I did not build.** Adaptive explanation level, which needs the model service to run. I also
declined to build confusion detection on the reasoning that it needed a decision about what "confusion"
means before code — shipping a confidence-typed heuristic would have added an unearned claim to a
product whose whole value is not making unearned claims. Upstream then implemented it from behavioural
signals (repeated errors, hint escalation, explicit multilingual help requests) rather than a guessed
affective state, which is the version of that decision I would have argued for. That work landed in
`origin/main` independently and is now merged; the honest summary is that I scoped it out and someone
else solved it well.

---

## 5. Business assessment

No traction, revenue, user or market-size figure below is measured; none is invented.

**Users vs economic buyers.** Learners (students in a course) use it. The economic buyer in the
institutional model implemented here is the university — `Institution`, `InstitutionMembership`,
`university_admin`, enrollment-managed course access. That is the right shape: institutions buy seats,
students do not buy software.

**Value proposition, stated narrowly and defensibly.** *Reviewed course material → verified practice →
auditable mastery evidence, with an explanation of how every answer was produced.* The buyer is
purchasing provenance and auditability, not chat.

**Honest competitive position.** Khanmigo, Khan Academy, Coursera Coach, Duolingo Max and ChatGPT-based
tutors all explain well. None markets an auditable evidence chain per objective, and none exposes model
fallback to the learner. That is a narrow wedge, not a moat.

**Adoption path.** Bottom-up instructor pilot inside one department, using the existing Course Studio
draft → review → publish flow, which is already the operational bottleneck the product addresses.

**Sustainability constraints.** Inference is the dominant marginal cost and is metered here
(`_reserve_durable_budget`, per-agent approvals). Deployment requires MongoDB, RabbitMQ, Redis and a
Python service — real operational weight for a small institution.

**What is not claimed.** No pricing, no TAM, no conversion, no pilot results.

---

## 6. Prioritised backlog

### P0 — correctness and truthfulness (all completed in this review)

| Item | State |
|---|---|
| Redis outage must not 500 every endpoint | Done + regression test |
| Accepted evidence must produce learner-visible progress | Done + regression test |
| `/ai/status` must report reality | Done + test |
| Seed must be re-runnable | Done |

### P1 — high impact, safe

1. **Make Progress actionable.** Now that profiles populate: surface confidence, evidence count and
   the next recommended objective on `/progress`. *(Data exists; UI-only change.)*
2. **Persist language choice** and apply it to the workspace shell, not one screen.
3. **Verify Tier documentation against the response path** so the compact/capable claim is provable.

### P2 — differentiation

5. Adaptive explanation level driven by demonstrated Bloom level.
6. Instructor view of cohort evidence gaps (aggregates exist in `instructorAnalytics`).
7. Expand multilingual coverage beyond the learning workspace.

### P3 — optional

8. Remove `src/app.ts`; consolidate raw `<select>` usage onto the styled primitive.
9. Dark-theme token block.

---

## 7. Demo readiness

**Demoable now [verified]**, production build, real MongoDB, no provider keys:

1. Learner signs in → course → select reviewed activity → quiz → correct answer → **Correct, 100%,
   evidence recorded** → +20 XP, badge.
2. **Progress** shows `Computer Science → Atomic domains → ANALYSE 62%` — the loop closing.
3. Hints panel shows the AI mode note (**"Built-in guidance"** upstream wording) with the honest
   explanation — *this is the limited-capacity story, demonstrated rather than described*.
4. Instructor Course Studio: draft → review → publish, source preparation, Activity Proposal Studio.
5. Admin: institutions and course access. Learner hitting `/admin` is redirected; `/studio` returns `FORBIDDEN`.

**Demo risk.** The strongest technical claims (model tiers, RAG quality, the facilitator's confusion
routing) depend on the Python service, which cannot run in this environment. Either the demo machine has
provider keys, or the pitch must present these as designed-and-constrained rather than observed. Do not
let a judge ask "show me the model answer" and discover it cannot run. The deterministic confusion
signals in `learningSupport.ts` *do* run without the model service, so that part can be demonstrated
safely; the facilitator's peer-first routing cannot.

**Weakest scoring area.** After the correction above, R6 (adapt explanation form and level) is now the
weakest requirement relative to how prominently the spec states it.

---

## What changed during this review

| File | Change |
|---|---|
| `apps/api/shared/middleware.ts` | `RedisFallbackStore` |
| `apps/api/shared/moduleClient.ts` | Re-export transport types |
| `apps/api/modules/study/src/routes/plans.ts`, `ai-orchestrator/src/utils/proxyBuilder.ts` | Import from the shared re-export |
| `apps/api/seeds/complete-demo.seed.ts` | Subject/objectives/topics; idempotent artifacts; real `subjectId` |
| `apps/api/modules/study/src/services/competency.ts` | `recordAcceptedEvidence` |
| `apps/api/modules/study/src/services/activityAttempt.ts` | Record competency evidence on acceptance |
| `apps/api/modules/study/src/services/competencyQueries.ts` | Enrollment-aware index; bloom normalization; subject lookup |
| `apps/api/modules/ai-orchestrator/src/routes/ai.ts` | Real provider status |
| `apps/api/modules/ai-orchestrator/src/tests/coach.test.ts` | Assert honest status |
| `apps/api/modules/study/src/tests/{competencies,plannerWeakestTargeting}.test.ts` | Fixtures for new dependencies |
| `apps/api/tests/architecture/rate-limit-resilience.test.ts` | New |
| `apps/api/modules/study/src/tests/competencyEvidenceLoop.test.ts` | New |
| `apps/web/src/features/learning/learning-workspace.tsx` | Adopt upstream `AiModeNote` (duplicate dropped) |

Committed as five commits plus a merge of `origin/main`, not pushed. Lint on changed files: 0 new
errors (2 remaining are pre-existing on `bb1be3d`).

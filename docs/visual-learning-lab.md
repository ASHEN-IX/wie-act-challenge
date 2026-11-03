# Visual Learning Lab

CURRENT unless marked FUTURE. Branch: `feat/visual-learning-lab`.

## Scope

A standalone learner workspace (`/visual-lab`, `/visual-lab/[labId]`) where a course concept or free topic becomes a small, interactive, deterministic experiment. Loop: **predict → experiment → observe → ask the guide → understanding check**. It does not replace or extend the Intelligent Interactive UI registry, room projection or tutoring flows.

## Architecture

```text
topic / course section ─▶ API (auth, course access, pinned revision, exact sources)
   ─▶ AI service /visual-lab/plan
        1. selector (compact, `visual_lab_selector`): registered engine or "unsupported"
        2. planner  (capable, `visual_lab_planner`): structured scenario + guidance
        3. one bounded repair attempt
   ─▶ API validation (shared/visualLab/definition.ts) ─▶ persisted lab (deduplicated)
   ─▶ browser engine renders the scenario; all numbers are computed by trusted code
```

- AI service: `apps/ai/agents/visual_lab/` (schemas, prompts, planner) and `services/api/routers/visual_lab.py`. Models go through the existing `utils.llm_client` routing; no new inference framework.
- API: `apps/api/modules/study/src/{routes/visualLab.ts,services/visualLabPlanning.ts,models/VisualLab.ts}`, pure engines in `apps/api/shared/visualLab/`.
- Web: `apps/web/src/features/visual-lab/`, routes in `app/(workspace)/visual-lab/`, an "Explore visually" entry on the course page and a navigation item.

## API (`/api/v1/study/visual-lab`)

| Route | Purpose |
|---|---|
| `GET /capabilities` | Registered engines and models |
| `POST /plan` | Generate (or reuse) a lab from `topic` or `courseId` + section; rate limited |
| `GET /` | The caller's saved labs (summaries, newest first) |
| `GET /discover?courseId=` | Up to 8 concepts found in the course's published revision (keyword scoring over verified passages, grouped by section; ≥2 term matches) |
| `GET /:labId` | Public lab (owner only) |
| `POST /:labId/guide` | Contextual explanation / hint / next / challenge; rate limited |
| `POST /:labId/check` | Submit understanding-check answer |

All routes require authentication. Responses are `private, no-store`.

## Engine registry and schema

Schema version `1`; limits live in `VISUAL_LAB_LIMITS` (graph 2–10 nodes, 1–20 edges, integer weights 1–99, bounded text lengths).

| Engine | Scenario | Trusted behavior |
|---|---|---|
| `weighted_graph` | nodes, weighted undirected edges, source, target | Dijkstra with recorded steps, unreachable and disconnected handling, equal-cost ties resolved deterministically |
| `parameter_model` | `modelId` + values | Registered models only. Today: `newtons_second_law` (`a = F/m`; F 0–200 N, m 0.5–50 kg) |
| `spatial_3d` | `sceneId` + values | Registered scenes only. Today: `projectile_3d`, an ideal projectile (speed 5–50 m/s, elevation 5–85°, heading 0–359°, gravity 1.5–25 m/s²) giving range, peak height, flight time and landing point. Rendered with three.js (React Three Fiber) from the same pure functions the server uses; the derived check uses misconception distractors (peak height mistaken for range, missing 2θ, halved range) |
| `function_plot` | `functionId` + values | Registered functions only. Today: `quadratic_function` (y = ax² + bx + c; a −5..5 and never 0, b and c −10..10) giving vertex, real roots, discriminant and y-intercept, drawn as an SVG curve in a fixed window. The derived check asks for the vertex x with sign-slip, missing-factor-2 and inverted-formula distractors |

A model can only name a registered engine/model. Unknown engines, extra fields, executable content and formula strings are rejected. If nothing supported fits, the API returns an explicit refusal; no lab is fabricated. If AI planning is unavailable for a recognised topic, the lab falls back to a deterministic example, marked `generationMode: DETERMINISTIC_FALLBACK`.

## Course integration

Course labs use the existing published-revision pin, authorization and exact source artifacts (`revisionSources`); no ingestion is duplicated. The revision is stored on the lab, so a new revision never silently changes it. Topic labs are labelled as general examples and carry no citations.

## Correctness and privacy guarantees

- Distances, paths and accelerations come from tested pure functions; the guide receives these authoritative values and never recalculates them.
- The understanding check is derived server-side; `correctOptionId` and the explanation never reach the browser before submission.
- If the guide fails, a deterministic explanation is returned and the simulation keeps working.

## Assessment integration status

`/check` returns `recordedAsEvidence: false` (`policy: visual_lab_practice_only`). **Gap:** results are not written to learner evidence, competencies or XP. Opening a lab, moving sliders or time spent never counts as mastery.

This is a deliberate boundary, not an oversight, and it is not a one-line wiring job. The existing attempt pipeline (`activityAttempt.registerActivity`) is insert-only, author-only, limited to draft revisions and pinned to verified source pages, so a per-learner, AI-planned lab check cannot be registered into it without weakening those guarantees. Options for a later decision: (a) keep labs practice-only and send the learner to the course's graded activity for the same objective; (b) add a distinct, lower-trust `visual_lab` evidence source with its own anti-farming rules; (c) let instructors author lab checks as registered activities. Until one is approved, the UI must keep labelling the check as practice.

## Adding an engine or model

1. Add the pure, tested compute function and its limits under `apps/api/shared/visualLab/` (a new parameter model is an entry in `parameter-models.ts`).
2. Register it in `ENGINE_CAPABILITIES`, extend validation and the derived check in `definition.ts`, `authoritativeState` in the service, and the Pydantic schemas and prompts in `agents/visual_lab/`. `spatial-models.ts` plus `spatial-lab.tsx` is a complete worked example.
3. Add a renderer in `apps/web/src/features/visual-lab/` and dispatch it from `lab-workspace.tsx`.
4. Add engine tests (`tests/shared/visual-lab-engines.node.test.ts`) and a planner fixture test.

No change to unrelated learning components is needed.

## Known limitations

- Four engines, one registered model, scene or function each. The 3D scene is a single deterministic projectile (no air resistance, level ground); it is not a general 3D modelling or physics engine.
- Planner quality with a live provider is covered by fixtures, not by provider integration tests.
- Lab interaction state is client-local and not persisted.
- FUTURE: Study Together sharing. The boundary is the lab id plus semantic parameter values, not rendered frames; no LiveKit or moderator code was changed.

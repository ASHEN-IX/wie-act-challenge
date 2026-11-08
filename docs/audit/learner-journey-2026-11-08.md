# Learner journey: audit, changes and verification (2026-11-08)

Historical evidence, not a standing claim. Verified against a local dev stack (Mongo, RabbitMQ, API :3000, web :5173, Python AI :8000, real Groq-backed approvals for the Visual Lab agents only).

## Journey now

Sign in → Home shows the learner's published course (or "join a course") → **My Learning → course** → one step strip on the lesson page: **Read → Explore visually (only if the course has a concept the lab can render) → Practice and tutor → Study with peers → Progress**. Visual Lab labs link back to the course; the lab page ends with "Practice this in the course / Back to the lesson / Explain it with peers".

## Changes

| Area | Change |
|---|---|
| Sidebar | Removed `Practice` and `Binary search demo` from "More tools". Kept Visual Lab, Tasks, Study plan, Explore sources. Routes `/practice` and `/visualizer` still resolve. |
| Top bar | Removed the global "Practice" button; search relabelled "Search courses" (it only filters course titles). |
| `/practice` | Was an ungrounded free-text box whose result was lost on refresh. Now forwards to the course practice section (or an empty state). Dead `submitPractice` action removed. |
| Dashboard | "Your course" opens the lesson directly, picks the first *published* course, offers "Study with peers"; no "pick up where you left off" claim (the app does not track that). |
| Course page / lesson | New `CourseJourney` strip; "Explore visually" section embeds concept rows that create a course-grounded lab; button shown only when discovery finds concepts. "What next" footer. |
| Practice "What's next" | "Explore this visually" no longer links to a Visual Lab page that may be empty; shown only when concepts exist and jumps to the in-lesson section. |
| Lab page | Back link to the source course, note when the lab pins an older revision, practice-only next steps. |
| Progress | Added next-step links once evidence exists. |
| Seed | Removed fabricated `xp/level/streak/totalStudyMinutes` written on the learner. Added a labelled synthetic course ("Demo: Shortest paths in weighted graphs") whose material the Visual Lab supports, with one reviewed quiz; seeded task marked as demo. Real source indexes are built when the AI service shares `INGEST_UPLOADS_DIR` and `FAISS_INDEX_DIR` (set to absolute paths in both `.env` files). |
| Copy | Refusal messages no longer say "neither engine" / list only two engines. |

## Decision: Courses and Visual Lab

Integrate **by context, not by merging**. The course is the unit of learning; Visual Lab is an enrichment of a lesson. Merging would put a tool with four narrow engines inside every course; most courses (including the seeded database courses) have nothing it can render, and showing a button that leads to "no match" is a dead end. So the lesson offers the visual step only when `GET /visual-lab/discover` finds concepts, and labs link back. The standalone Visual Lab stays in "More tools" for the library of saved labs and topic examples. The binary-search demo leaves the sidebar (linked from the Visual Lab page; also shown, labelled illustrative, inside study rooms). Visual Lab checks remain **practice only** (`recordedAsEvidence: false`): verified in the UI copy and by XP not changing after a lab check.

## Verification

Commands and outcomes:

- `pnpm --filter web exec vitest run` → 34 files, 225 tests passed (added `course-journey.test.tsx`, extended `navigation.test.tsx`).
- `AI_SERVICE_URL=http://127.0.0.1:1 npx tsx --test tests/integration/visual-lab.node.test.ts` (apps/api) → 17/17 passed.
- `pnpm typecheck` → api and web passed. (It initially failed on stale generated type folders `.next-final-build` and `.next/types`; both are git-ignored build output and were moved aside, not deleted.)
- `pnpm build` (web, webpack, separate dist dir) → succeeded.
- `eslint` on every touched file → clean. `pnpm --filter web lint` over all of `src` reports the same 16 problems as before my changes (baseline checked with `git stash`).

Browser (built-in browser for `learner@ednova.test`, Playwright browser for `peer@ednova.test`):

1. Sign-in → Home shows the published demo course with the real XP from the ledger.
2. Lesson page → journey strip; DB course has no visual step (correct); graph course shows "1 concept".
3. "Explore" built a lab through the **real provider path** (AI log: `visual_lab_selector` compact `openai/gpt-oss-20b`, `visual_lab_planner` capable `openai/gpt-oss-120b`, `execution_mode=REAL_APPROVED`). Lab values are computed by trusted code (A→C→B→D = 8 checked by hand); correct answer shows "does not change your mastery or XP".
4. Reviewed quiz: correct answer graded by deterministic rubric, "Evidence: recorded"; XP 40 → 60 on Home and Progress after reload; the lab check changed nothing.
5. Study Together: learner created a room from the course link (course preselected), peer joined by code (2 participants), presenter started peer discussion, peer's chat message appeared on the presenter's screen, room offered the course's reviewed activity.
6. Authorization (curl with the peer session): learner's lab by id → 404, lab list → empty, discover/plan on an unenrolled course → 403, check on another's lab → 404, unauthenticated → 401.
7. Failure honesty: tutor → "Nardouch is unavailable. Your question is preserved; please retry." (no approval configured); room facilitator → "Built-in guidance… fixed rules rather than an AI model"; AI service stopped → known topic lab served as a deterministic built-in example, unsupported topic refused with 422, nothing fabricated.
8. Mobile (375 px): lesson journey stacks, no horizontal overflow.

## Not verified / limits

- No real inference for the **tutor, evaluator, coach or room facilitator**: `LLM_APPROVALS_JSON` only contains `visual_lab_selector` and `visual_lab_planner`. These paths show unavailable/built-in states; their model quality is untested here. Adding approvals is a team decision.
- Playwright e2e (`pnpm test:e2e`) and the full API suite (`pnpm test`, includes Docker-backed integration) were not run. The one e2e that used `/practice?job=…` was retargeted to `/search?job=…&jobKind=search` but not executed.
- Python tests not run. Voice (LiveKit/ElevenLabs), study plan, tasks and Explore sources were reviewed in code, not exercised end to end; Explore sources sends queries to an external search service.
- Study rooms' shared example is a labelled binary-search illustration, not course-specific. Making rooms reuse a learner's course lab is a larger change left for the team.
- Local setup gap found: the dev `.env` files did not set the shared `INGEST_UPLOADS_DIR` / `FAISS_INDEX_DIR` (the AI service defaulted to `/app/uploads` and indexing returned 503). `pnpm dev:setup` writes them on a fresh checkout; existing hand-made env files need them added.

# Try EdNova locally

Open http://localhost:3000/login. The web app runs on port 3000 and the API on port 3001 (`pnpm dev`). Local infrastructure comes from `pnpm dev:infra:up`; Redis is on port 6390 when another project holds 6381.

All four demo passwords: `EdNovaDemo!2026`. These are local demonstration accounts with verified email; no OTP is needed for their initial login.

| Account | Email | User ID |
|---|---|---|
| Platform / institution administrator | admin@ednova.test | 6ae1f2869274974f3bef70f9 |
| Instructor | instructor@ednova.test | 6ae1f2879274974f3bef70fc |
| Learner | learner@ednova.test | 6ae1f2879274974f3bef70ff |
| Second learner | peer@ednova.test | 6ae1f2879274974f3bef7102 |

On 27 October the local configuration was aligned, Docker infrastructure and the host web/API/Python/ingestion services were started, the learner browser login and API session were verified, and the cached embedding model loaded in offline mode. The local tutor still uses mock/deterministic execution; this is not approved provider inference.

For the challenge demo, start PostgreSQL and apply migrations with `pnpm --filter api db:setup`.
Start `pnpm dev:ai` with the same source and index paths as the API, then run
`ALLOW_DEMO_COURSES=1 pnpm seed` against a disposable local database. This loads the
demo accounts, institution, badges, two courses, practice activities and the learner task.
Use `pnpm --filter api prisma:seed baseline` for the separate legacy tier-test accounts
and rank badges, or choose `learning`, `demo-course`, `phase2` or `analytics`
for the corresponding existing fixtures. The course and phase 2 presets require the
learning accounts first.

Their active memberships belong to **EdNova Learning Demo**, with a database-generated ID. Instructor is an institution membership, not a platform administrator role. Course assignment/enrollment remains a separate explicit operation after creating a course. No course, activity, answer or mastery result was fabricated by this seed.

## Demo course for the learning workspace

Run `pnpm --filter api seed:demo-course` after the learning-demo seed. It creates **Demo: Database normalization basics** in the EdNova Learning Demo institution, indexes a synthetic normalization text through the real source pipeline, publishes two reviewed quizzes, and enrolls `learner@ednova.test`. It is idempotent. The script prints the course ID; open `/courses/<courseId>/learn` as the learner. The tutor and hints show the status note for the active AI mode. With `LLM_MOCK=1` the tutor says it is a test answer, and the hint says it is built-in guidance.

## Stories to try now

1. **As a user, manage my workspace:** log in, edit Settings, create subjects/tasks, update task status, reload and check persistence, then log out.
2. **As an administrator, manage an institution:** open Institutions, inspect the seeded institution, issue a new instructor/learner invitation, and accept it through the recipient's Profile. Once a course exists, use its course ID and the user IDs above to assign an instructor and enroll learners.
3. **As two learners, study together:** open Study together as learner and create a source-free room. Click the acknowledged Open room link, copy the invite code, then join as peer in a separate browser profile/private window. Try peer text, presenter handoff, reconnect/reload and leaving. Separate users require separate cookie contexts.
4. **As an unauthorized user, test boundaries:** an institutional student cannot administer memberships or publish a course; institution membership alone does not enroll them into every course.

The isolated four-learner native-text PDF journey now passes all eight A–E
checkpoints. [Collaboration evidence](../../reports/EDNOVA-COLLABORATION-VERIFICATION.md)
records its single-API-instance scope and reproduction command. Scanned PDFs
also have bounded local English OCR, page/confidence metadata and a Studio review
warning; [OCR verification](../../reports/EDNOVA-OCR-VERIFICATION.md) records limits
and the real broker/worker tests. Human OCR quality approval remains open.

## Implemented source-backed stories

These passed the isolated P0-R3 integration/browser verification, but the current host/Docker development setup must have working broker credentials and shared source/index storage before you can complete them here:

1. **Instructor authoring:** Courses → Upload; first create a subject, select EdNova Learning Demo, upload a source, Open course → Studio, refresh ingestion, review/add objectives and Save Draft. Prepare the exact source revision, select a real passage, generate quiz/GuidedProblem, review public preview and private evaluation, explicitly register, then publish.
2. **Course access:** use the administrator's Institutions page with the course ID to assign instructor access where required and enroll learner/peer. Copy the course ID from its URL. Membership and course grants are separate.
3. **Solo learning:** Open published learning, select objective/type, answer both incorrectly and correctly, inspect private feedback/history and accepted-evidence progress, ask the grounded tutor and open its authenticated citations.

   Verified 29 October against the production build: a correct reviewed attempt now also appears on
   **Progress** (`Computer Science → Atomic domains → ANALYSE · 62%`). Until this review it did not —
   accepted evidence was recorded but no competency profile was written, so the page stayed empty.
   See [challenge readiness](../audit/ednova-v1-readiness.md) for the five defects and their fixes.
4. **Shared activity:** create a room with that published course context, join as peer, select a reviewed activity as presenter, submit independent private checks, request/accept the deterministic peer-first proposal, and transition to debrief. A peer cannot read another learner's result.
5. **Revocation/recovery:** retry an uncertain attempt without changing its payload; reload owned results. Remove a course/institution grant and check that future protected reads are denied.

The earlier demo setup encountered **RabbitMQ ACCESS_REFUSED**; this was a historical observation, not a current service-health result. Run `pnpm dev:doctor` to check the actual local configuration. New setup files use matching host paths for Node and Python; existing environment files are preserved and may need manual alignment. Worker container health alone does not establish ingestion connectivity. A mixed host API / container worker must also see the same originals and revision FAISS artifacts. No live paid model execution was enabled. Recommendations are nonadaptive, and quotation candidates / deterministic facilitation are labeled provisional.

## Repeat the user seed

Run `pnpm --filter api seed:learning-demo`. It loads `apps/api/.env`, requires a loopback development PostgreSQL URL, creates missing demo accounts using Better Auth, verifies password login, and establishes memberships through the institution invitation service. It does not overwrite existing passwords, suspended memberships or unrelated users. If a demo password was changed, supply that common password through `DEMO_USER_PASSWORD` or review the account manually.

Actual setup verification: all four Next `/api/auth/sign-in/email` requests returned 200, and their cookies each returned 200 from Nest `/api/v1/study/institutions` with the expected institution role. Verification sessions were logged out. The local web auth secret was aligned with the API to enable shared sessions; other environment settings were preserved.

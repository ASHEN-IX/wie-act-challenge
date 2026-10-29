# Try EdNova locally

Open http://localhost:5173/login. The web and API development servers were started for this session (`/tmp/ednova-demo-dev.log`). Restart them with `pnpm dev` when needed. Existing local infrastructure remains running.

All four demo passwords: `EdNovaDemo!2026`. These are local demonstration accounts with verified email; no OTP is needed for their initial login.

| Account | Email | User ID |
|---|---|---|
| Platform / institution administrator | admin@ednova.test | 6adcd6f44441bbb9f9dacf19 |
| Instructor | instructor@ednova.test | 6adcd6f44441bbb9f9dacf1c |
| Learner | learner@ednova.test | 6adcd6f44441bbb9f9dacf1f |
| Second learner | peer@ednova.test | 6adcd6f44441bbb9f9dacf22 |

On 27 October the local configuration was aligned, Docker infrastructure and the host web/API/Python/ingestion services were started, the learner browser login and API session were verified, and the cached embedding model loaded in offline mode. The local tutor still uses mock/deterministic execution; this is not approved provider inference.

This workspace keeps the seeded Mongo database on port 27017 in the existing `study-partner-api-mongodb-1` container. To restart this particular setup, start that container and `study-partner-api-mailpit-1`, then start RabbitMQ and Redis with `docker compose -f deploy/compose.development.yml up -d rabbitmq redis`. Run `pnpm dev`, `pnpm dev:ai`, and `pnpm dev:worker ingestion` in separate terminals. `apps/ai/.env` selects the existing Python environment. The full `pnpm dev:infra:up` stack also starts a separate Mongo on 27018; it does not contain these demo accounts unless seeded separately.

Their active memberships belong to **EdNova Learning Demo**, institution ID `6adcd6f4e373c21e626650c6`. Instructor is an institution membership, not a platform administrator role. Course assignment/enrollment remains a separate explicit operation after creating a course. No course, activity, answer or mastery result was fabricated by this seed.

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

Run `pnpm --filter api seed:learning-demo`. It loads `apps/api/.env`, requires a loopback development MongoDB URI, creates missing demo accounts using Better Auth, verifies password login, and establishes memberships through the institution invitation service. It does not overwrite existing passwords, suspended memberships or unrelated users. If a demo password was changed, supply that common password through `DEMO_USER_PASSWORD` or review the account manually.

Actual setup verification: all four Next `/api/auth/sign-in/email` requests returned 200, and their cookies each returned 200 from Nest `/api/v1/study/institutions` with the expected institution role. Verification sessions were logged out. The local web auth secret was aligned with the API to enable shared sessions; other environment settings were preserved.

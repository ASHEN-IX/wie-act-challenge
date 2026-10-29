# EdNova — Technical Report

**Challenge:** IEEE Women in Engineering Annual Congress of Tunisia (WIE ACT 5.0), GenAI Peer Learning Companion.
**Status:** Phase 1 draft, 28 October 2026. Items marked **[TEAM]** need a decision or input from the team before submission.

## 1. Objective

EdNova helps university learners study alone and in small groups. Instructors publish course content that the platform checks against its sources. Learners get graduated hints before answers, source-grounded answers with citations, and peer-first prompts when a group is stuck. The system never grades on AI output alone and never exposes learner-private data to peers or instructors.

## 2. Architecture

| Component | Technology | Development port |
|---|---|---|
| Web application | Next.js 16, React 19 | 3000 |
| Control plane API | NestJS, Express domain modules, Better Auth | 3001 |
| AI service | Python FastAPI, LiteLLM router, FAISS | 8000 |
| Ingestion and other workers | Python, RabbitMQ consumers | — |
| Database | MongoDB 7 | 27018 |
| Broker | RabbitMQ 3 | 5673 |
| Cache and rate limits | Redis 7 | 6390 (6381 by default) |
| Mail (development only) | Mailpit | 1026 / 8026 |

The web app calls the API. The API calls the AI service and never sends learner-private data to a provider unless the call has an approval. Long ingestion and index work runs in workers through RabbitMQ and is recovered from an outbox after crashes.

## 3. GenAI module

**Model categories.** Following the challenge rules, requests use two categories:

- **Compact model** (`openai/gpt-oss-20b` through Groq) for short, well-defined steps: hints and grounded tutor wording (`coach`) and course cleaning and extraction (`course_ingestion`).
- **Capable model** (`openai/gpt-oss-120b` through Groq) for steps that combine several sources or learners: the peer-first facilitator, planning, search synthesis, reflection and grading (`facilitator`, `planner`, `search`, `reflection`, `evaluator`).
- **Fallback** (`meta/llama-3.2-11b-vision-instruct` through NVIDIA NIM) for the planner, evaluator, facilitator and course-ingestion steps when the primary model is unavailable.

The tier of every agent is set in code (`AGENT_TIERS`) and documented in `docs/llm-config.md`.

**Approval gate.** Every real provider call needs an operator approval for that agent: model, task, expiry, request limit, token limit and cost limit. The limits are counted in a durable ledger before the call. Missing or expired approvals produce no provider traffic. Each response records its execution mode: `REAL_APPROVED`, `MOCK_TEST`, `DETERMINISTIC_FALLBACK` or `UNAVAILABLE`.

**Tutor and facilitation.** The grounded tutor answers only from the reviewed source passages, with exact citations. The facilitator reads a room's dialogue, applies deterministic rules first (no direct answers, known misconceptions, graduated hints, confusion signals), and asks the model only when no rule applies.

**Response cache.** Calls that carry only course content (not learner data) can opt in to a Redis-backed cache keyed by a hash of the agent, model and prompts. Only validated real responses are stored, for seven days by default.

**Confusion and learning style.** A tentative confusion flag comes from repeated wrong attempts, a second hint, or an explicit request for help in English, French, Moroccan Darija or Arabic. In a learner's private hints the flag shows a gentle nudge to talk it through in a study room. The facilitator rule layer also answers a flagged statement with a peer-first prompt, but peer chat does not call the facilitator by design, so today that rule applies only through the facilitator's observe endpoint. A short private probe (six questions) gives a provisional learning style, which only changes the wording of private hints. It never changes grades or mastery.

## 4. Retrieval workflow (RAG)

1. The instructor uploads source files. The platform stores them with SHA-256 digests.
2. Source preparation sends the immutable document set to the AI service, which chunks the text, embeds it locally with `all-MiniLM-L6-v2`, and writes a FAISS index plus metadata.
3. The API verifies the artifact against a manifest digest before use. A mismatch blocks the answer.
4. The tutor retrieves passages from the index, and each answer cites the document, page and chunk. Answers without a verified passage say so.

## 5. Limited capacity and failure handling

- **Queue and retry.** The LiteLLM router retries twice with cooldown and then walks an explicit fallback chain.
- **Budgets.** Request, token and cost caps are enforced by a durable ledger and can be revoked immediately.
- **Degraded answers.** When the model is unavailable, the hint and explanation paths return fixed-rule guidance, labelled as such.
- **Visible status.** The learner sees a plain-language note for each mode, and a staged progress indicator while a tutor request runs (`Getting started`, `Preparing an answer`, `Waiting for the AI model`), also used by the planner, practice feedback and source search.
- **Infrastructure faults.** A Redis outage falls back to a normal approved call. Ingestion survives a worker crash through its outbox.

The UI does not show a real queue position, because the backend does not expose one. Retrying is the learner pressing the button again.

## 6. Privacy and ethics

- Demo and test data are synthetic. Demo accounts are local, and the seed scripts refuse non-loopback databases and production.
- Private material (hints, help requests, room private help, learning-style profiles) is returned only to its owner. Tests check that other learners cannot read it. Instructor access to private material is not tested yet.
- Provider keys live only in gitignored environment files. A scan of tracked and new files found no credentials.
- The cache and the probe store no raw learner text. The cache keys are hashes, and the probe keeps only scores.
- The source search page sends the learner's question to a public web search engine (DuckDuckGo), and the page says so. Learners are told not to enter personal information.
- Voice is out of scope for Phase 1. The LiveKit audio path is not active, and no audio is recorded.
- The AI does not replace teachers. Instructor review is required before a course is published.

## 7. Testing strategy and results

Results below come from runs on 28 October 2026. The number of tests grew during the day, so each figure names the suite it covers.

| Suite | Result |
|---|---|
| AI service (`pytest`, full) | 994 passed, 3 skipped |
| API study module (`jest`) | 182 passed, 16 suites |
| API jest suites (all) | 753 passed, 58 suites |
| API learning-style and confusion unit tests | 21 passed |
| API integration (full, MongoDB) | 342 of 350 passed; the 7 failures are the LiveKit SFU tests (see §9) |
| API integration: facilitator rooms (ED-09) | 7 passed with the AI service pointed at a closed port; 5 of 7 with the live AI service (see §9) |
| API authentication suite | 17 passed |
| Web (`vitest`) | 75 passed |
| Workspace typecheck | passes (after declaring the missing `axios` dependency) |
| Real approved calls through the gate | six agents answered with `REAL_APPROVED` responses. The facilitator alias was added afterwards and has not been called live. |
| Browser: learner, peer, instructor and admin | each role walked through its pages; two-learner study room, hint style, hints, tutor, practice and planner exercised (see §9 for what is still rough) |

Screenshots are in `docs/submission/screenshots/`.

## 8. Repository and setup

A clean copy of the tracked files was installed with `pnpm install --frozen-lockfile` and configured with `pnpm dev:setup`. Both succeeded. `pnpm dev:doctor` then reports one failure on a clean machine: Poetry must be installed for the AI service, or `EDNOVA_AI_PYTHON` must point at a Python 3.11–3.14 environment that has the locked dependencies. The README lists this as a prerequisite. The port 6381 default for Redis collides with other local projects, so the development stack can use another port (6390 was used here).

## 9. Known gaps and declared limits

- **Real-model quality is unmeasured.** Real calls were verified for connectivity and response format only. No accuracy, citation or pedagogy measurement exists yet.
- **Full learner journey on real inference is not yet run** (Phase 1 acceptance step 1).
- **Voice and LiveKit** tests need a local SFU that the repository does not start, so seven integration tests fail on a clean machine.
- **Live AI wording.** Two facilitator integration tests assert the wording of the fixed-rule policy. With the live AI service, the model's wording differs, so those two fail. The tests stay as they are.
- **Learning-style cues** are not evaluated. The tutor prompt does not use the learning style yet, because that changes a frozen AI contract.
- **Confusion detection** covers attempts, hints and explicit help phrases only. It does not use dwell time, and peer chat is not analysed.
- **Mock mode shows placeholder AI output.** With `LLM_MOCK=1` practice feedback is a low placeholder score, and the tutor returns the matching source passage. Real-model behaviour needs a run with approvals.
- **Rough edges still open.** The voice panel is shown although voice is unavailable here. Room screens use internal wording (for example "Recover shared illustration"). The instructor's enrollment form asks for raw course and user IDs. Instructor insights stays empty until a cohort privacy policy is set. New interface strings are English only.
- **Owner decisions remain.** ED-26 (contract freeze) has 0 of 19 decisions recorded. The tracker says 36 tasks, but only 35 are defined in the backlog.

## 10. External services

| Service | Use | Status |
|---|---|---|
| Groq API | Compact and capable LLM inference | Team key; calls gated by approvals |
| NVIDIA NIM API | Fallback LLM inference | Team key; calls gated by approvals |
| Google Gemini and OpenRouter | Earlier configuration | No keys provisioned; not used |
| DuckDuckGo web search | The Explore sources page (learner question text) | Used by the search worker; page shows a privacy note |
| Apify | Optional search provider in the search worker | Not configured; not used |
| LiveKit Cloud or local SFU | Voice in study rooms | Not active; blocked (ED-17) |
| Hugging Face model download | `all-MiniLM-L6-v2` embeddings (downloaded once) | Used by the AI service |
| Docker Hub images | MongoDB, Redis, RabbitMQ, Mailpit | Development infrastructure |
| SMTP (Mailpit) | Development email | Development only |
| Stripe | Billing code exists | Not active; no keys configured |

## 11. Business-model note

- **Target users [TEAM]:** university students who study in groups, instructors who publish course material, and training centres with similar needs. The first market should be one partner institution.
- **Value proposition [TEAM]:** guided peer learning with checks against the instructor's material. Learners get hints before answers and see which AI mode produced each reply.
- **Adoption path [TEAM]:** a pilot course for one instructor and a cohort of learners, through the institution invitation flow already built in the platform.
- **Sustainability [TEAM]:** the cost of inference per active learner, paid by the institution or the training centre. No revenue, conversion or traction figures are claimed in this report.

## 12. Screenshots

- `learner-workspace-desktop.jpg`: the published demo course, with its objectives and reviewed activities.
- `tutor-status-note-desktop.jpg`: a tutor answer with its status note, in test mode.
- `ai-status-states-desktop.jpg` and `ai-status-states-mobile.jpg`: each execution-mode note, and the wait indicator, at desktop and phone widths.

# EdNova — Technical Report

**WIE ACT 5.0 · GenAI Peer Learning Companion**

**Working draft · 9 November 2026**

Repository: https://github.com/ASHEN-IX/wie-act-challenge

## Objective

EdNova helps university learners study reviewed course material independently and with peers. Learners practise with guided activities, request graduated hints, and discuss a shared exercise in a study room. A peer-first facilitator can prompt reasoning before an answer. Private checks and a debrief help learners identify a next step.

## Architecture and workflow

The web application uses Next.js and React. A NestJS API owns authentication, course access, published revisions, learning attempts, rooms and the inference budget. PostgreSQL stores application data. Redis supports caching and RabbitMQ carries background jobs. A Python FastAPI service and workers handle AI tasks and document processing.

An instructor uploads material, reviews the extracted draft and publishes a revision. Learners access the published course, complete activities and use source-based hints. A room can pin a reviewed activity for multiple learners. Individual checks remain private, while the debrief presents an appropriate group view.

For retrieval, source documents are chunked, embedded and indexed with FAISS. The tutor retrieves source passages associated with the selected course revision and provides citations. Source preparation and retrieval require shared file storage between the API and AI service.

## AI and capacity

The existing configuration assigns compact models to bounded work such as coaching and ingestion, and capable models to tasks including facilitation and planning. The configured Groq examples are `openai/gpt-oss-20b` and `openai/gpt-oss-120b`. Earlier local tests exercised Groq for Visual Lab and course review. These examples have not been confirmed as the organizer's two model categories, and the complete learning journey has not been verified against the organizer service.

Real model calls require an operator approval tied to a task, model, expiry and request limits. A PostgreSQL ledger reserves the request before dispatch. Course-only tasks may reuse validated responses through a Redis cache. Learner-facing status distinguishes model results, test output, deterministic guidance and unavailability. The facilitator has a labelled rule-based peer-first path when the AI service cannot be reached. The interface shows progress while an answer is prepared.

Model retries and routing must be configured for the actual organizer service. The current configured cross-provider fallback chains are not automatically routed because an approval is bound to a specific model. Organizer quota exhaustion and both model categories still need an end-to-end demonstration.

## Privacy and ethics

Use synthetic or anonymised course material and accounts for the challenge demonstration. Credentials are supplied through local environment configuration and must not appear in the repository or recording. Course permissions restrict access to published material. Individual checks and learning evidence are private to the learner. The instructor remains responsible for reviewing material. Automatic course review and publishing is opt-in in the browser and can be disabled.

The AI provides educational assistance and can be wrong. Source citations help learners inspect the material. The system presents learning-style cues as provisional preferences, not validated diagnoses. Voice and external services require separate consideration of organizer rules before inclusion in a demonstration.

## Verification and limitations

On 9 November 2026, the working checkout passed workspace typechecking, 282 web unit tests, and nine browser authentication and workspace tests, including two accounts creating and joining a room. In an isolated PostgreSQL database, 20 API checks passed for reviewed activity selection, private checks, debrief and peer-first fallback. A separate PostgreSQL test passed concurrent inference budget reservation, approval identity and revocation checks. Twenty-eight Python client and cache tests passed with controlled test doubles.

The historical integrated learning browser harness still uses MongoDB fixtures and has not been revalidated after the PostgreSQL migration. The Python cache tests use simulated providers and do not demonstrate organizer capacity limits. The report does not claim real-user outcomes or a complete live AI learning journey. Browser tests produced a hydration warning and expected unavailable search-job errors in server logs.

## Business model

The initial users are university students who study together and instructors who provide course material. A possible first adoption path is a voluntary pilot in one course, with an instructor and a small student cohort. Institutions or training centres could later pay for access and support. Sustainability depends on inference usage, hosting and support costs. Pricing, customer demand and outcomes remain unvalidated.

## Submission readiness

The final submission still requires a reproducible complete demonstration, confirmation of the organizer endpoint and model categories, a real compact and capable call through the learning journey, and an observed capacity-limited scenario. Replace this working draft with results from the final submission revision before delivery.

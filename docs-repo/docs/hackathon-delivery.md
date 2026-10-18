# Hackathon rules and delivery plan

## Authority and status

**SPEC** below is from the preserved [three-page official challenge book](reference/EdNova_Challenge_Specification_book.pdf), rendered and checked on 18 October 2026. **PROPOSAL** is team guidance from the [brief v1.2](reference/ednova-brief-v1.2.md). No submission, report, pitch, video, testing outcome or business traction is claimed completed by this document. ED-15 owns delivery in the [backlog](sprint-backlog.md).

## SPEC — learning goals and technical rules (pp. 1–2)

Build a GenAI companion supporting individual and group learning: simple explanations, guiding questions, hints before answers, confusion detection and next steps. Diagnostic input can include short questions/exercises/prior responses/interaction patterns; adapt explanation form and level, including accessible multilingual learning. Voice, dashboards, quizzes, analytics, gamification and revision notes are possible extensions, not universally mandatory functionality. Our preference-based, evidence-limited interpretation does not claim a scientifically validated fixed learning-style classifier.

Habib working end-to-end application on the real operational inference service is required; a mock-up, notebook or isolated calls is insufficient. Deliberately combine compact/fast and larger/more capable categories and document which handles each step. No custom training or fine-tuning is available. Several-second latency without graphics accelerators is expected, and responses arrive whole rather than streamed; provide progress/staged feedback or usable partial result. Team access is limited/shared: use fewer well-built requests, avoid recomputing equivalent results, and handle usage/capable-category unavailability correctly through queue/retry/fallback with visible status. Document retrieval may narrow context; RAG is allowed, not required. Technical feasibility also judges model combination, efficient usage and limited-capacity behavior.

## SPEC — phases, exact printed timing and limits (pp. 2–3)

| Item | Printed requirement |
|---|---|
| Phase 1 | Preselection; no presentation required; submit technical report including short business-model note, GitHub repository link, demonstration / simulation |
| Deadline | **“Deadline: 10 November”** |
| Phase 1 selection basis | Report, GitHub repository and demonstration / simulation |
| Phase 2 | Selected teams; final presentation and previous or newer video demonstration, not exceeding 1.5 minutes |
| Final timing | **“Final phase duration: 3 days after the Phase 1 selection”** |
| Technical report | Must **not exceed 6 pages** |
| Final presentation | **“Presentation: maximum 4 minutes.”** |
| Demo video | **“Demo video: maximum 1 minute and 30 seconds.”** |
| Q&Habib | **“Q&Habib: 2 minutes.”** |
| Team | Up to **3 people**; pitch delivered by **two team members** |

Do not infer the deadline year, exact time, timezone or a final calendar date: the printed deadline has no year/time. Confirm those with organizers. Habib business/entrepreneurship team member is encouraged, not required. The final phase is relative to selection, not automatically three days after 10 November.

## SPEC — submission content (pp. 2–3)

Repository: source code, setup instructions, README, prototype screenshots if available, technical explanation of the GenAI module and a configuration template exposing no credentials if applicable.

Technical report (<=6 pages): objective; architecture; AI model/API; RAG workflow **if implemented**; privacy/ethics; testing strategy/results; limited-capacity or temporary-unavailability handling where relevant; short business-model note covering target users, value proposition, adoption and sustainability beyond the hackathon.

Final presentation: introduce team roles/expertise; define learning problem; present companion/features; explain development methodology (AI, RAG approach, tools/platform as applicable); implementation/user flow/testing/impact; business model; describe both model categories and limited-usage behavior. The video demonstrates use case, interactions, AI role and result/benefit, with waiting/fallback behavior if relevant.

## SPEC — evaluation and bonus (p. 3)

The six named qualitative criteria have **no printed numeric weights**:

1. **Innovation:** originality, creativity and added value compared with existing solutions.
2. **Technical Feasibility:** realism, prototype quality and clarity of implementation, plus thoughtful model-category combination, efficiency and limited-capacity behavior.
3. **Relevance:** main-challenge alignment and real user need.
4. **Impact:** usefulness, accessibility and potential user benefits.
5. **Entrepreneurship & Business Viability:** realistic users/value proposition/adoption/sustainability.
6. **Pitch and Demo:** presentation clarity, communication and demo effectiveness.

Bonus opportunities: real-user testing with learners/students/teachers/training groups; multilingual support including Arabic, Darija, French or English interactions. Do not fabricate weights, required language counts, bonus scores or empirical results.

## SPEC — ethics, privacy, platform and ownership rules (p. 3)

- Do not store sensitive personal data; use anonymous or synthetic testing data.
- Avoid collecting names, photos, voices, addresses or private information.
- Do not discriminate by gender, region, language level or background. AI supports learning, not replacement of teachers/mentors.
- Credentials are personal to the team; do not share or expose them in source, logs, screenshots or video.
- Bypassing usage limits with extra accounts or replacement services during demonstration is not permitted. An additional external service alongside the provided platform is acceptable if clearly declared.
- Only public, fictional, synthetic or anonymised data may be sent to the service.
- Normal latency/occasional queueing is expected; persistent errors go through the organizers' support channel.
- Teams retain full ownership of their code and work.

**Unresolved interpretation:** p. 1 offers voice-based interaction as an extension while p. 3 says to avoid collecting voices. Do not interpret the team brief's optional live audio as organizer approval. Confirm acceptable ephemeral peer audio and any external media service. No default recording/transcription; text remains P0. Existing camera/fatigue and account-profile features are not automatically permissible demo inputs.

## PROPOSAL — artifact work plan and acceptance

| Artifact | Preparation / evidence needed | Acceptance / task |
|---|---|---|
| Technical report | Suggested pages: problem/value; actual architecture; AI categories/grounding; privacy/fallback; test results/limits; business/adoption | <=6 pages including business note; source-backed claims and real measured results; ED-15 |
| GitHub repository | Clean source/config templates, main navigation, verified setup, GenAI explanation and optional screenshots | External reader reproduces demo without secrets; no claim unavailable tests passed; ED-01/14/15 |
| Phase 1 demo/simulation | One known synthetic topic, three learner contexts, real service requests, visible intervention/outcome/fallback | Distinguish simulated provider outage from real compact/capable calls; ED-03/09/12/14 |
| Final pitch | Two presenters rehearse problem -> interaction -> technology/evidence -> adoption | <=4 minutes; Q&Habib preparation for 2 minutes; ED-15 |
| Demonstration video | Capture actual working session, trim waiting honestly, show model choice and safe degraded state | <=90 seconds, synthetic identities, no credentials or mocked outputs presented as real; ED-15 |
| Testing evidence | Scenario IDs, commands, versions, source fixtures, actual outcomes/failures/skips, redacted category traces | Covers T01–T24 applicable P0; no fabricated metrics; ED-14 |
| Business-model summary | Learner/instructor value, possible institution buyer, pilot adoption and inference/support cost hypothesis | Included in report; no payment system required; no claimed revenue/conversion/traction |

Suggested v1.2 90-second sequence: 0–14 instructor PDF extraction/correction/approval; 14–29 student quiz/guided problem; 29–58 same activity in a three-person room with peer-first misconception intervention; 58–73 private individual check/progress and XP only if P1 is implemented; 73–90 debrief and deliberate compact/capable fallback. If rewards are absent, use that segment for verified progress/next step. Preparation may shorten waiting in the recording only when the real underlying flow is reproducible; no prewritten screen presented as real inference. This is a team storyboard, not organizer timing allocation.

Suggested implementation/demo gates: baseline/isolation -> approved-service grounded slice -> shared text/resource exercise -> peer-first intervention -> private checks/debrief -> degraded behavior -> evidence/artifact rehearsal. Voice, advanced analytics and commerce must not displace P0. Three-person division: Course Studio/Content/Access including extraction AI (Habib); Individual Learning/Progress including tutor/evaluator AI (Tasnim); Study Together/Collaboration including facilitator AI (Aziz), with shared evidence/report work. This is responsibility guidance, not a team-assignment fact.

## PROPOSAL — business note

Target users are university students and independent learners; instructors provide trusted sources. Universities/training centers are possible B2B2C buyers; an independent tier could keep access available without institutional adoption. Value is course-grounded individual practice and more inclusive, structured peer learning, with optional safe aggregate insight. Start with a voluntary single-course pilot after the synthetic hackathon demo and appropriate privacy/instructor approval; evaluate utility and cost before expanding cohort licensing. Inference, hosting/support and institutional procurement are sustainability risks. No price, conversion, customer contract or traction is validated.

## Outstanding confirmations

Confirm deadline year/time/timezone, final schedule, model endpoints/categories/quotas/request/retry format, allowed external services, and live-voice interpretation. Retention, sharing revocation, aggregate thresholds and the initial synthetic topic are team decisions. The [audit](../../audit/2026-10-18/EDNOVA_AUDIT.md) records why they remain open; this documentation task does not need to resolve them by implementing speculative features.

## v1.2 scope and ownership update — PROPOSAL only

Official SPEC sections above are unchanged. New P0: instructor-reviewed editable PDF hierarchy and two trusted interactive components within the same solo/group learning loop. P1: basic evidence-based XP/levels/2–3 achievements, richer customization, one deterministic visualization, full PDF page-following and optional voice. Cosmetic gamification/catalog breadth, rich authoring/LMS and live speech moderation remain later work. Do not describe current legacy rewards as verified learning rewards.

Delivery ownership: Habib demonstrates Course Studio/Content/Access including extraction AI; Tasnim demonstrates Individual Learning/Progress/rewards including tutor/evaluator AI; Aziz demonstrates Study Together including facilitator AI and coordinates integrated report/video/pitch. Every owner supplies UI/API/AI/security tests and evidence. No separate AI role. All review the integrated demo. See [team plan](team-delivery-plan.md); no calendar milestones are invented from unknown team availability.

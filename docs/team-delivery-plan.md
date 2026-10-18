# EdNova delivery plan — Habib, Tasnim and Aziz

**All three members own a product module end-to-end: frontend, backend, data, AI prompts/workflows, integration, security and tests. There is no dedicated frontend, backend or AI member.** This replaces the earlier allocations at the user's request. Confirmed module assignment: Habib — Course Studio/Content/Access; Tasnim — Individual Learning/Progress; Aziz — Study Together/Collaboration. Availability and implementation dates remain unspecified. Status/acceptance remains in the [canonical backlog](sprint-backlog.md).

## 1. Module boundaries

| Member | Product module | Complete deliverable | AI owned inside this module |
|---|---|---|---|
| **Habib — Course Studio, Content & Access** | Institutional/personal courses, memberships/enrollment, source library, hierarchy editor, preview/approval/publication, instructor insight | Upload -> editable source-linked draft -> correction -> approved immutable course -> authorized learner entry; UI/API/data/tests together | PDF/OCR extraction, hierarchy/concept/objective proposals, embeddings/source indexing, Studio enrichment/activity proposals and extraction fallback |
| **Tasnim — Individual Learning & Progress** | Course-aware tutor, diagnostics, quiz/guided registry, individual attempts/assessment/evidence, recommendations, XP/levels/achievements | Select authorized section -> trusted activity -> private attempt -> verified feedback/evidence -> next step/reward; UI/API/data/tests together | Tutor/intent-to-activity prompts, grounded explanations, individual evaluator/rubric logic, adaptive next-step policy, language/level behavior and learning fallback |
| **Aziz — Study Together & Collaboration** | Rooms/invitations/presence/chat, shared activity/presenter state, voice, private room help, group debrief | Invite peers -> shared exercise -> peer-first intervention -> private individual check -> safe group recap; UI/API/WS/data/tests together | Facilitator state/prompt policy, candidate misconception verification, participation support, room/private-help context, public summary, group outage behavior and later consented speech orchestration |

**Habib/Aziz/Tasnim each edit TypeScript/React/Python wherever their module lives.** Repository language is not the ownership boundary. No module owner waits for another person to implement their AI or API. Existing services/frameworks are reused; this plan moves no code and creates no new service/database/queue.

### Habib — detailed responsibilities

- Auth/onboarding integration and institution/instructor/course enrollment; shared identity primitive stewardship, preserving existing behavior.
- Institutional and private course upload/list/detail/viewer, original files, extraction progress/errors, document/source ACLs.
- Python ingestion/OCR/enrichment/indexing outputs, provenance/page references or explicit unknown locations, ambiguity flags and source-safe prompts.
- Studio hierarchy/objective correction, activity proposal requests and instructor preview/approval/published revision UI and APIs. Habib produces approved content; AI cannot publish.
- Instructor aggregate insight endpoint and screen (P1), consuming Tasnim/Aziz permitted aggregates rather than reading private answers/chats.

### Tasnim — detailed responsibilities

- Same trusted quiz/guided activity definitions/renderer for solo use and Aziz room embedding; optional shipped deterministic visualizer.
- Tutor/diagnostic/selector/evaluator prompts, source-grounded hints, language/level adaptation and safe text/pending fallback.
- Private attempt APIs/UI/data, idempotent accepted evidence, competency/progress and next steps. Tasnim is the single writer of individual learning evidence, including checks launched from a room.
- Reward processing, ledger/profile recovery, caps/achievement policy and XP feedback UI together; model/browser cannot award XP.
- Shared inference transport/configuration stewardship (ED-03/12): approved model IDs, generic timeout/retry/budget/trace adapter and canonical schema dispatch. This is a small shared integration responsibility, **not ownership of Habib/Aziz AI workflows**.

### Aziz — detailed responsibilities

- Complete room UI/API/WS/invitations/presence/text/presenter/reconnect and source-sharing enforcement via Habib's contract.
- Reuse Tasnim's activity renderer/attempt service; own public room state only, never fork the activity engine or accept individual evidence separately.
- Own group facilitator Python prompts/state/worker integration, peer-first misconception intervention, inclusive optional participation and public-source summaries.
- Private room-help UI/API/AI context and consented explicit sharing; room-private help is distinct from the public facilitator context.
- Optional voice/signaling/media reliability and later opt-in speech AI; audio remains independent of queued inference.
- Group completion requests Tasnim private checks, then consumes an allowed completion signal for debrief; Aziz cannot read another learner's private answer through this signal.

## 2. All tasks assigned by module

Stable IDs are retained. UI/API/AI items are linked parts of the same module, not handoffs between technology specialists. A coordinator does not become implementer of everyone else's work.

| Owner | P0 | P1 | P2 / post-hackathon |
|---|---|---|---|
| **Habib** | ED-01 baseline coordination; ED-02 access coordination; ED-04 membership; ED-05 publication; ED-06 extraction; ED-13 privacy coordination; ED-26 contract agreement; ED-30/31 Studio API+UI; ED-32 Studio AI proposals | ED-19 instructor insight + richer ED-31/32 authoring | ED-22 dependency investigation coordination; ED-23 legacy scope; ED-24 institutional expansion |
| **Tasnim** | ED-03 shared service setup; ED-08 diagnostic; ED-10 tutor grounding; ED-12 shared capacity adapter; ED-27/28/29 activity UI+AI+attempt/evidence | ED-16 multilingual individual learning; ED-33/34 rewards backend+UI; ED-35 one visualizer | ED-21 open-topic full-stack learning |
| **Aziz** | ED-07 rooms; ED-09 facilitator AI; ED-11 group completion/debrief; ED-14 integrated QA coordination; ED-15 artifacts; ED-DOC docs | ED-17 voice; ED-18 private room help; ED-20 user feedback | ED-25 consented group speech experiment |

ED-11 is accountable to Aziz for group orchestration; Tasnim owns its individual-check/evidence/next-step subpackage through ED-08/29. ED-16 is accountable to Tasnim for common language preferences/evaluation cases; Habib/Aziz implement and test localization in their modules. No new parallel task-status list is introduced.

### Cross-cutting work packages

| Shared task | Habib | Tasnim | Aziz | Coordination |
|---|---|---|---|---|
| ED-01 baseline | Course/auth/Studio UI/API/Python checks and relevant root integration | Individual learning/progress UI/API/Python checks, evaluator/competency fixtures | Room UI/API/WS/Python checks, browser launcher | Habib records gate; each fixes own module |
| ED-02 access / ED-13 privacy | Identity/course/source/publication scope and ingestion payloads | Private attempts/results/cache/reward evidence and tutor inputs | Room/chat/voice/private-help/delivery and facilitator inputs | Habib coordinates one policy; owners enforce it throughout their module |
| ED-03 / ED-12 inference | Ingest/Studio operation mapping, bounded enrichment and extraction fallback | Approved shared provider adapter, generic budgets/status/errors, individual learning mapping/fallback | Facilitation/private-help mapping, bounded room context and group fallback | Tasnim stewards shared transport, Habib/Aziz remain AI implementers; all verify real calls for their modules |
| ED-26 contracts | Source/revision/membership/provenance | Public activity/private attempt/accepted evidence/reward + shared transport envelope | Room/facilitator/presenter/public-summary/private-help contracts | Habib records agreement; producers and consumers approve their shared boundary |
| ED-14 / ED-15 | Content full-stack tests, Studio demo and access evidence | Individual learning full-stack tests, assessment/reward evidence | Group full-stack tests + integrated journey/report/video assembly | Aziz coordinates; no one is the sole tester or report contributor |
| ED-22 maintenance | Content dependency/entrypoint review | Individual learning/ML/RAG dependency review | Realtime/voice/facilitator dependency review | Habib coordinates; no blanket Python owner |

## 3. Code ownership across the existing trees

Frontend update: use `src/features/courses` (Habib), `src/features/learning`, `planning`, `tasks` and progress routes (Tasnim), and `src/features/collaboration` (Aziz). Native `src/app` pages compose these modules. The old SPA screens/stores are removed; see [frontend guide](frontend-web.md). Shared UI primitives stay under `src/components/ui`. The detailed examples below describe domain responsibilities, not retained legacy filenames.

| Module owner | Frontend / Node examples | Python / AI examples |
|---|---|---|
| Habib | CourseUpload/SubjectDetail/course/institution/Studio routes; auth, courses/subjects/source/revision models and APIs; instructor insight adapter | `agents/course_ingestion/**`, ingestion worker, extraction/enrichment/source index construction and Studio prompts; approved source projection |
| Tasnim | SocraticEvaluation/activity registry, tutor/assessment/progress/gamification screens/stores; attempts/evidence/competencies/reward APIs and evaluator job results | `agents/evaluator/**`, evaluator worker, individual planner/search/coach usage, tutor/selector prompts, shared `utils/llm_client.py`/model config stewardship |
| Aziz | TeamLobby/StudySession room shell/room hooks; session invitations/chat/voice/realtime/private-help/debrief APIs and room persistence | Group facilitator/state/summary/private-help operation handlers/prompts in existing AI service; group-related orchestration and later speech integration |

Examples identify changed symbols/features, not authorization to refactor every file. Keep source-index construction Habib and query-time retrieval/tutoring Tasnim linked through the same authorized source/version; Aziz consumes that interface. Habib/Aziz may call Tasnim-maintained shared transport without asking Tasnim to write their prompts or workflow. No file moves or infrastructure additions are required.

### Shared files and reviews

- **Module/symbol ownership:** Habib owns source/course/membership definitions; Tasnim owns activity/attempt/evidence/progress/reward definitions; Aziz owns room/facilitator/public session definitions. The same ownership applies to TS, React and Python schema mirrors. Do not independently rename shared fields.
- Existing common files (`study` model index, domain definitions, generated controllers, frontend `api.ts`/shell and Python router/worker registration) require short serialized edit windows: agree exact symbols, merge first change, rebase, then next owner writes their own hunk. One person does not implement another's UI/API/AI to avoid a conflict.
- Shared provider client/model config: Tasnim stewards the generic adapter, while Habib/Aziz own their operation prompts, category needs, fallback and fixtures. Changes are reviewed by the affected consumer; keep common schemas/versioning and one retry budget. Do not create three provider clients, three retrieval stores or duplicate evaluator engines.
- Generated bindings: nominate one generator runner per integration window (Habib initially), using accepted module contract changes; regenerate once rather than hand-merging generated code. Root manifests/lockfiles/CI/Compose likewise one writer per edit window, all affected owners review.
- Use existing module-specific extension patterns for new helpers/components/prompts when sensible. Do not rewrite architecture just to make folder boundaries prettier. No model training or arbitrary browser code.
- Each module PR includes task IDs, changed interface/version, UI/API/AI tests and end-to-end acceptance. Cross-module reviewer checks the consumed contract. Aziz coordinates final integrated evidence, but every module owner tests all its layers.

## 4. Contracts frozen before parallel work (ED-26)

| Contract | Producer -> consumer | Essential behavior |
|---|---|---|
| Source/draft/provenance | Habib ingestion -> Habib Studio; authorized subset -> Tasnim/Aziz | Original ref/hash, section/revision, page/range or unknown, extracted/generated/manual provenance and review flags; Habib server resolves ownership/publication |
| Approved learning context | Habib -> Tasnim solo learning / Aziz room | Course/revision/section/objective/allowed-source refs; authorization before retrieval, enrollment revocation and failed/draft/foreign denial |
| Public ActivityDefinition | Tasnim activity service -> Tasnim learner UI / Aziz room / Habib instructor preview | Version/type/componentVersion/source+revision refs and bounded data; P0 allowlisted quiz/guided problem; no executable code, answer key/rubric or secret prompts in learner projection |
| Private ActivityAttempt / result | Tasnim/Aziz view -> Tasnim attempt/evaluator service | Tasnim-issued attempt and server actor/version/grade validation; idempotent private input/result, uncertainty/pending; Tasnim alone accepts individual evidence; Aziz sees only permitted completion signal |
| Room state / facilitator operation | Aziz UI/API/AI -> Aziz public room | Authorized members/presenter, selected Tasnim activity, sequence/snapshot/reconnect, public reasoning/source context; private answers excluded; AI result validated before phase transition |
| Group debrief / aggregate | Aziz group service and Tasnim learning service -> recipients / Habib insight | Group-public observed recap vs own private next step; suppressed authorized aggregates only; no private transcript access |
| Accepted evidence -> reward | Tasnim evaluator/evidence service -> Tasnim deterministic reward handler/UI | Stable per-user logical completion identity, outcome/rule/evaluator version, accepted/pending; one recoverable capped award, never model/client XP |
| Shared inference adapter | Tasnim stewardship -> Habib/Tasnim/Aziz operation implementations | Approved categories, bounded request/context/retry, non-streamed status, sanitized errors/correlation; each module owns schema validation and safe domain fallback |

Each producer supplies success/failure/forbidden/stale/unsupported/pending/replay examples. Agree finite payload/step/item/context limits, enum versions and error semantics once. Unknown UI/schema -> safe text without state mutation; forbidden source -> deny before inference; unavailable complex grading -> pending/no mastery/XP; duplicate completion -> same result/effect. A student's personal course cannot become official university content by passing through an activity or room.

## 5. Parallel delivery and integration gates

**G0 — common agreements:** All choose one synthetic source/topic and validate interface examples. Freeze Habib content context, Tasnim activity/private evaluation, Aziz room/facilitator and shared transport semantics. Existing runtime failures remain ED-01 work; no new passing test claims.

**G1 — independent vertical slices:** Habib builds PDF -> own extraction AI -> editable draft -> approval/publication with UI/API/tests. Tasnim builds question -> own selector/tutor AI -> quiz/guided problem -> own evaluator -> private evidence/progress with UI/API/tests against agreed context fixtures. Aziz builds room -> own facilitator AI -> shared activity/presenter -> public recap with UI/API/WS/tests against agreed activity/context fixtures. Fixtures are boundary tests, not a replacement for real inference.

**G2 — connect source and learning:** Tasnim consumes Habib real authorized revision; Habib embeds Tasnim reusable renderer for instructor interactive preview. Habib can publish with source/text preview before interactive preview attaches, so there is no circular delivery gate. Tasnim real compact/capable requests and source/private-attempt tests pass.

**G3 — connect group:** Aziz embeds the same Tasnim activity renderer/attempt service, consumes Habib source ACL, and runs its own peer-first facilitator. Tasnim accepts private final checks; Aziz receives permitted outcome signals for group recap. Test 2–3 browsers, decline participation, no private leakage, capability loss and reconnect.

**G4 — P0 acceptance:** Each owner runs UI/API/AI/security/browser checks for their module; Aziz runs the full instructor -> solo -> room -> private check -> debrief journey and coordinates report/demo evidence with Habib/Tasnim contributions. All modules demonstrate real approved inference; preserve room activity under outage.

**G5 — P1:** Tasnim adds verified XP/level/achievement processing and UI, multilingual learning and one deterministic visualizer; Habib adds richer Studio settings/generation and aggregate insight UI/API; Aziz adds live voice/private room help including its AI and synchronization refinements. P1 does not block P0; no dates invented from unknown availability.

## 6. Rules preventing duplicate engines and conflicts

1. Each module owner delivers **UI + API + persistence + AI + authorization + tests**. Shared-library stewardship is coordination, not a separate AI role.
2. Reuse one provider adapter, one versioned activity registry and one private evaluation/evidence service. Aziz calls Tasnim learning API for individual checks; Habib calls Tasnim preview interface; neither forks them.
3. Habib is authority for approved sources/revisions; Tasnim for accepted individual evidence and rewards; Aziz for room membership/public state/facilitator transitions. Consumers validate access at their boundary using these contracts.
4. Published revisions stay pinned; generated enrichment stays labeled; private attempts/rubrics never enter room messages/AI context/public cache. AI/browser cannot self-publish, self-grade as accepted or award XP.
5. Each module owns compact/capable operation choices and safe fallback using shared quotas; nested model/provider/broker retries must not multiply budgets. Tasnim coordinates adapter limits, Habib/Aziz retain domain-policy ownership.
6. Same-file edits use serialized windows and consumer review; freeze interface versions near demo. No guarantee of zero merge conflicts, but ownership and resolution are explicit.
7. Keep current P0/P1 priorities and official organizer requirements. This update changes documentation only; no feature/migration/deployment/branch creation.

## 7. Exact first work session

1. All review G0 context/activity/attempt/room/inference fixtures and assign shared-file edit windows.
2. **Habib:** ED-04/06/30/05/31/32 complete course slice; **Tasnim:** ED-03/10/28/27/08/29/12 complete individual-learning slice; **Aziz:** ED-07/09/11 complete collaboration slice. Work on module baseline/access/privacy repairs in parallel.
3. Integrate Habib context -> Tasnim tutor/activity -> Aziz room; connect Tasnim renderer -> Habib preview and Aziz room; keep Tasnim private attempts/evidence as the single learning record.
4. Run G2 -> G3 -> G4; close tasks only with actual end-to-end evidence. Every person demonstrates their own module, including its AI.
5. Add P1 after P0 stability. Defer cosmetics/visualization breadth/voice/rich settings/admin polish before cutting core learning/facilitation/individual checks/two-model fallback.

## 8. Named review and completion rules

Every task in the backlog names its accountable owner. Habib reviews content/access/publication changes; Tasnim reviews activity/evaluation/evidence/reward changes; Aziz reviews room/facilitator/privacy/realtime changes. A cross-module producer needs review from the consuming owner: Habib context -> Tasnim/Aziz; Tasnim activities -> Habib preview/Aziz rooms; Aziz debrief -> Tasnim private-check/aggregate boundary. Review is a contract check, not a transfer of implementation ownership.

A task is ready to start when its input contract/fixture and permitted paths are clear. It is ready to merge when its owner has tested the full UI/API/AI flow, failure path and permission boundary; record commands/results in that task's evidence. It is DONE only after the consuming module's integration gate passes. Update the canonical backlog, never separate personal progress copies. The [target architecture](target-architecture.md) documents the recommended stack/decisions and the [technical execution notes in every task](sprint-backlog.md) describe the next implementation.

## 9. Recommended next work — concrete starting packages

**Preparation update:** builds, native frontend migration, root tests and baseline browser startup now pass; see [current results](audit/cleanup.md). Do not repeat those repairs. Habib coordinates the remaining API strict typing/lint and access closure; Tasnim confirms real model access and extends private activity/evidence contracts; Aziz builds the room/facilitator contracts on the native collaboration module. The table below retains the dependency rationale; completed startup/fixture work is regression coverage, not new assignments.

These are the next implementation recommendations, **not actions performed in this documentation task**. Follow dependencies and integration gates rather than invented dates. Start the first two packages in parallel; no team member is assigned only AI or only testing.

| Order | Habib — Course Studio / Access | Tasnim — Individual Learning / Progress | Aziz — Study Together / Collaboration | Exit evidence |
|---|---|---|---|---|
| **First: baseline + constraints** | Coordinate ED-01/02; trace route generator normalization, auth/shared-export consumers and source/static-file ACL; review Poetry/image ingest prerequisites | Repair competency lease/replay and authorized coach fixtures; verify strict vs build scopes; confirm ED-03 provider mapping and no silent mocks | Reproduce browser launcher/server failure; review HTTP chat/voice/outgoing WS membership; define room reconnect/facilitator failure fixtures | App starts; affected checks recorded; existing failures not hidden; approved-service access details explicit |
| **In parallel: freeze boundary examples** | ED-26 course/source/draft/revision/access JSON examples and synthetic PDF/known section error | ED-26 public quiz/guided schema, private attempt/evidence/rubric and model status examples | ED-26 room snapshot/presenter command/facilitator action/private completion examples | All three review supported/invalid/forbidden/stale/pending/replay cases and finite limits |
| **Then: independent minimum modules** | ED-04/06/30/05/31: one institution + private course, extraction, editable heading/objective correction, source preview and approved version | ED-10/28/08/29/27: source-grounded quiz and guided problem, private feedback/evidence/next step | ED-07/09: room with same activity reference, public text, explicit peer-first facilitator, source/membership checks | Each owner demonstrates a full UI/API/AI path with boundary fixtures and actual inference before integrated readiness |
| **Join and recover** | Supply real authorized revision; embed Tasnim renderer for Studio interactive preview; reject stale publication/source grants | Consume real source and expose private-check API + permitted completion signal; test evidence replay/recovery | Embed same renderer, call Tasnim private check, produce group-safe debrief; verify 2–3 browsers and capable outage | One instructor -> learner -> room -> private check -> debrief flow; no private leakage or duplicate evidence |
| **Finally: evidence / optional P1** | Content/isolation report, richer review settings/instructor aggregate insight only if P0 stable | Learning/model report; verified XP/2–3 achievements and one visualizer after replay tests | Group/recovery report, ED-14/15 integration and artifacts; voice/private help only after P0/rule checks | Reproducible demo with honest results, limits, sources and fallback; no unimplemented feature screenshots |

### Suggested first reviewable changes

- **Habib, ED-01/02:** narrow generator/parameter compatibility and source-access fixes, with valid/invalid route and owner/foreign file tests. Tasnim/Aziz review consumer compatibility. Do not mix institution features into baseline repair.
- **Tasnim, ED-01/03:** reconcile intended competency/coach behavior with fixtures, preserve authorization, and produce sanitized approved-model category/config examples. Habib reviews auth compatibility; Aziz reviews pending/outage status consumer.
- **Aziz, ED-01/02:** room HTTP/WS membership and startup/browser fixtures, including left-member outgoing delivery and history access. Habib reviews source grant; Tasnim reviews private-check boundary.
- **All, ED-26:** a small contract/examples/parity change agreed before dependent feature changes. Each writes their own module schemas/consumer tests; serialize edits to shared registration and lockfiles.

Use a proposed branch/change title derived from task ID and feature, chosen by the team; no branches have been created. Keep each review to one coherent behavior/contract so merge conflicts and regression causes are understandable. Close the parent task only after the full acceptance and consuming-module gate pass, not when a component merely compiles.

### What to improve now versus defer

**Improve now:** startup/build correctness; role/source/room isolation; real-vs-mock inference visibility; stable source/activity revisions; schema validation and safe UI; private evidence/replay recovery; one authoritative room state; actionable failure/status UI. These support every subsequent feature.

**Defer:** framework/auth/database migration, service proliferation, arbitrary AI-generated browser apps, rich course-format support, public competition/cosmetics, Graph RAG as a prerequisite, default recording and continuous speech moderation. Revisit only after a measured need and a separate task/decision; retain useful legacy code meanwhile.

Discussion is grounded in [target architecture decisions and proposed operations](target-architecture.md), [current gaps](audit/ednova-v1-2-update.md) and [per-task technical notes](sprint-backlog.md). The next team review should settle operation schemas/limits, actual model-service access, synthetic topic/answer key and availability; names/module assignments are already confirmed.

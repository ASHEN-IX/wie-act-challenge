# EdNova v1.2 alignment and three-member delivery report

18 October 2026. Documentation/planning only. The [latest supplied brief](../../docs-repo/docs/reference/ednova-brief-v1.2.md) controls team product direction; the original organizer PDF controls official rules. The pasted task requests requirements/backlog alignment, not feature implementation. Existing initial-audit changes were preserved.

## Habib. Current project assessment

The existing Next/Nest/Python workspace has reusable personal course upload/ingestion, objectives/chunks/embeddings, planner/scheduler, individual Socratic evaluation, competency evidence, team invitation/session state, WebSocket/peer WebRTC and gamification. These foundations do not constitute the complete v1.2 experience. Backend roles remain student/admin, course processing is not instructor publication, and the evaluator UI is not an allowlisted AI-selected component registry.

This pass rechecked the new feature areas against `modules/study/src/routes/courses.ts`, study schemas, Python ingestion/enrichment, `SocraticEvaluation.tsx`, `Gamification.ts`, reward routes, `awardService.ts`, `RankEventLedger.ts` and frontend gamification consumers. The [earlier audit](EDNOVA_AUDIT.md) covers the broader codebase and [runtime validation](VALIDATION.md) records pre-existing failures. No runtime tests were rerun in this documentation update; source presence is not operational certification.

## Tasnim. New functionality incorporated

- **F20 Intelligent Interactive Learning UI:** P0 quiz/guided problem, AI intent/type selection, versioned schema, trusted component registry, stateful input/hints/evaluation, solo/room reuse, accessibility and safe text fallback. No arbitrary generated browser code; additional deterministic visualization is P1.
- **F21 AI Course Studio:** source-preserving PDF digitization into editable draft hierarchy, instructor correction/objective review, provenance/ambiguity, activity preview and approved immutable publication; simplified private learner variant. Rich customization/generation conveniences are P1, rich LMS later.
- **F22 Learning gamification:** adapt existing XP/levels/achievements to accepted learning evidence, deterministic server policy, stable completion identity, replay/concurrency/recovery, caps and transparent reasons. Basic rewards are P1, not a P0 prerequisite; global XP is not subject mastery.

All three fit one engine: source -> reviewed revision -> activity definition -> private attempt -> accepted evidence -> progress -> optional rewards, shared by individual and collaborative modes.

## Aziz. Documentation changes

Modified **18 existing documents**, created **3 files**, removed none in this v1.2 pass:

| Files | Reason |
|---|---|
| `README.md` | Latest target and direct navigation to gap report/team ownership |
| `ARCHITECTURE.md` | Verified reuse/limits addendum, especially XP vs ranking dedup |
| `TARGET_ARCHITECTURE.md` | Studio/activity/evidence/reward integration and producer/consumer ownership |
| `docs-repo/README.md`, `docs-repo/docs/index.md` | Coherent v1.2 entrypoints and single active backlog |
| `docs-repo/docs/product-specification.md` | F20–F22 purpose/roles/flow/current gaps/dependencies/acceptance and resolved priorities |
| `docs-repo/docs/roles-and-permissions.md` | Studio authoring/approval, public vs private activity/evidence and server-only awards |
| `docs-repo/docs/data-model.md` | Proposed source/revision/definition/attempt/evidence/reward concepts, reuse and ownership; no schema mutation |
| `docs-repo/docs/workflows.md` | Stable W01–W12 amendments integrating Studio, interactive activity, shared context and optional rewards |
| `docs-repo/docs/ai-specification.md` | Source-linked proposals, bounded intent/type selection, validation and evaluation/reward boundary |
| `docs-repo/docs/sprint-backlog.md`, `implementation-tracker.md` | Preserve old IDs; add ED-26–ED-35, one accountable owner per task, canonical status and new dependencies |
| `docs-repo/docs/testing-plan.md` | T27–T38 contracts/Studio/activity/privacy/reward/recovery/visualizer/end-to-end gates |
| `docs-repo/docs/hackathon-delivery.md` | Revised demonstration narrative/P0–P1 scope; original SPEC rules untouched |
| `docs-repo/docs/frontend-web.md`, `backend-api.md`, `ai-service.md` | Package-specific ownership/reuse/TODO boundaries |
| `docs-repo/docs/reference/README.md` | Latest v1.2 provenance; v1.1 retained as historical input |
| **New:** `docs-repo/docs/reference/ednova-brief-v1.2.md` | Byte-identical source copy of supplied `(2).md` |
| **New:** `docs-repo/docs/team-delivery-plan.md` | Detailed three-member assignments, contracts, work packages, gates and shared-file protocol |
| **New:** this report | Current/missing matrix, conflicts, exact next sequence and validation |

The original brief v1.1, PDF, previous audit/results, historical trackers and runtime code remain intact. No competing feature backlog/specification was created; new team plan references the canonical register rather than maintaining separate statuses.

## D. Architecture updates — TARGET / not implemented

Reuse existing services, Mongo, job/contract patterns and UI. Habib owns source-linked extraction AI, editable drafts and approval UI/API. Tasnim owns individual tutor/selector/evaluator AI, public activity renderer/API, private accepted evidence/progress and optional rewards UI/API. Aziz owns rooms, peer facilitator/private-help/summary AI and public group state. Habib supplies authorized sources to Tasnim/Aziz; Tasnim exposes the same activity/private-check service for Aziz rooms and Habib previews. Shared model transport is a common utility with Tasnim stewardship, not a dedicated AI role.

Freeze seven interfaces in ED-26: source draft, approved context, public ActivityDefinition, private ActivityAttempt/result, room public state, accepted evidence and reward/profile projection. Answer keys/rubrics stay server-side. Room presenter changes view only; private answers never become group state. Published revisions pin active attempts. All contracts remain proposals pending implementation; no new tables, queues or dependency migrations were performed.

## E. Updated role capabilities

- **University administrator:** assign instructor/course ownership/enrollment within institution, without reading personal materials/private attempts.
- **Instructor:** correct extracted hierarchy/objectives, configure/preview trusted activities and approve only assigned official revisions; aggregates only by approved privacy policy.
- **University student:** access enrolled approved revisions, interact privately with activities, join authorized rooms, see own evidence/next step and P1 reward reasons; cannot edit official content.
- **Independent learner:** private digitization/activity/room loop with same engine, optionally generated open topic later; cannot publish institution-approved material.
- **Platform administrator:** operational health/abuse/setup, no implicit access to private learner content. Only trusted server evidence processing derives learning rewards.

These are context-based TARGET capabilities. CURRENT student/admin enforcement and known isolation gaps remain explicit.

## F. Updated backlog and team split

**36 canonical tasks**: original ED-01–ED-25 and ED-DOC preserved; ten new ED-26–ED-35 cover contracts, renderer, selector, attempts/evidence, Studio API/UI/AI, rewards API/UI and visualization. Existing ED-05/06/07/08/11/14/15 were extended rather than duplicated.

| Member | Ownership | Main P0 outputs | Main P1 outputs |
|---|---|---|---|
| **Habib — Course Studio / Content / Access** | All module UI/API/data/AI/tests | Memberships, PDF/OCR extraction AI, source drafts/editor, review/publication, authorized context | Rich Studio enrichment/settings, instructor insight |
| **Tasnim — Individual Learning / Progress** | All module UI/API/data/AI/tests | Tutor/selector/evaluator AI, trusted quiz/problem renderer, private attempts/evidence, next steps | XP/achievements processing and UI, multilingual learning, one visualizer |
| **Aziz — Study Together / Collaboration** | All module UI/API/WS/data/AI/tests | Rooms/shared activities, peer facilitator AI, public group recap, private-check orchestration | Voice/private-room-help including AI, synchronization refinement |

The [detailed team plan](../../docs-repo/docs/team-delivery-plan.md) assigns every task and producer/consumer boundary. The user superseded the earlier separate AI allocation: all three now own full-stack modules including AI. The module assignment is confirmed by the team request; no dates/hours are invented. Habib owns ED-06/30/31/32 course UI/API/AI; Tasnim owns ED-08/27/28/29/33/34 learner UI/API/AI; Aziz owns ED-07/09/11/17/18/25 collaboration UI/API/AI. Shared-file edits are serialized by module symbols and reviewed at consumed interfaces.

## G. Existing functionality versus missing functionality

CURRENT means source verified, not that all runtime checks pass. PARTIAL/REUSABLE means adaptation is required for target acceptance; no new feature is DONE from this documentation change.

| Feature | Verified existing implementation | Missing / target work | Owner / task |
|---|---|---|---|
| F01 auth/onboarding | Better Auth, verification/reset/session identity and profile preferences | Institution/personal context and aliases, role scope | Habib access |
| F02 institutional courses | Personal Course foundation only | Institution memberships/enrollment/assigned ownership | Habib courses |
| F03 instructor materials | Upload validation, ingest/progress and extracted objectives | Instructor review/approved revision/source manifest | Habib Studio/extraction AI |
| F04 personal course/upload | Owner-scoped personal CRUD/upload/ingest exists | All-path isolation proof, explicit sharing and private Studio | Habib personal course; Tasnim learning; Aziz explicit room sharing |
| F05 open topic | Manual course/planner/search parts | Full labeled no-upload activity loop | Tasnim open-topic module (P2) |
| F06 course-aware tutor | Evaluator, planner RAG and web search are separate reusable paths | Unified authorized activity/context/citation/hint loop | Tasnim tutor/activity AI; Habib source contract |
| F07 diagnostic/assessment | Individual multi-turn evaluator/scoring/results | Short diagnostic, activity/revision binding and accepted evidence | Tasnim diagnostic/evaluator UI/API/AI |
| F08 recommendations | Planner/coach/pacing/review/competency pieces | Tentative session-level evidence-linked next activity | Tasnim progress/next-step module |
| F09 rooms | Invite codes, max four, participants/task progress and WS | Versioned shared activity, general peer text, presenter/reconnect protocol | Aziz full-stack room module |
| F10 voice | Peer WebRTC/STUN/signaling/mute code | Reliable real-browser/media tests, consent/rules and network decision | Aziz voice (P1) |
| F11 shared resources/exercise | TaskProgress and course summaries | Same activity/context/source projection P0; full PDF page-follow P1 | Aziz shared view; Tasnim activity; A source |
| F12 AI facilitator | Coach/evaluator patterns only | Peer-first group state/intervention policy | Aziz facilitator UI/API/AI |
| F13 private room help | Individual job owner scoping | Recipient-only room side channel, safe UI/history | Aziz private room help UI/API/AI (P1) |
| F14 misconception checks | Individual evaluator feedback | Group candidate tracking/verified intervention and pending mode | Aziz group verification; Tasnim reusable individual evaluator |
| F15 debrief/progress | Session summary, eval/competency records | Private final checks, safe group recap/evidence acceptance | Aziz public debrief; Tasnim private evidence/progress |
| F16 instructor analytics | General analytics/admin/user collections | Course-scoped suppressed aggregates, no private answer access | Habib instructor insight consuming Tasnim/Aziz permitted aggregates (P1) |
| F17 model routing/fallback | Per-agent LiteLLM config/jobs/retries/fallback; absent keys may mock | Real organizer-category mapping and safe room degraded behavior | Tasnim adapter stewardship; Habib/Tasnim/Aziz own operation mapping/fallback |
| F18 multilingual/accessibility | Language preference, prompts and existing UI | Evaluated language/level/code-switching and interactive accessibility | Tasnim common learning cases; Habib/Aziz module localization/AI tests |
| F19 privacy/recovery | Auth/owner guards, upload/prompt/SSRF checks and worker leases | Known HTTP/session/source gaps, activity/revision/cache/recipient tests | Habib/Tasnim/Aziz module isolation/recovery |
| F20 intelligent UI | SocraticEvaluation text answer/hints, reusable components/stores | Registry, schema selector, quiz/guided definitions/state/private submissions | Tasnim complete activity UI/API/AI; Aziz consumes room renderer |
| F21 Course Studio | PDF/OCR/sections/concepts/chunks/objectives, basic CourseUpload/read topics | Editable hierarchy, source provenance throughout, revision approval/preview/publish/settings | Habib complete Studio UI/API/AI; Tasnim reusable preview |
| F22 XP/levels/achievements | Gamification totalXp/history/catalog, level `floor(XP/100)+1`, store/notifications; ranking KP ledger/caps | Accepted-evidence-only rewards, replay-safe XP+profile recovery, small measurable achievements and separate mastery UI | Tasnim complete rewards UI/API/data/policy (P1) |

Important XP distinction: the privileged `/award-xp` route calls the XP-add method before the separate ranking service. Ranking's sparse unique eventKey does not make XP totals idempotent. Achievement checks currently occur before some action stats are incremented in the route, so timing/eligibility needs tests when adapting. Preserve legacy totals/behavior until an explicit policy decision; do not silently award both old and new completion rewards.

## H. Conflicts and decisions

| Conflict / ambiguity | Resolution in maintained plan |
|---|---|
| Earlier priorities vs latest v1.2 §§39–43 | Latest proposal wins: editable Studio and two interactive types P0; basic evidence rewards and full PDF-following P1 |
| Earlier “gamification later” statement vs existing XP and v1.2 | Existing mechanics stay; evidence-based basic XP/levels/2–3 achievements P1; cosmetics/shops/competition remain later |
| Source-sharing P0 vs synchronized viewer P1 | P0 selected exercise/context + source reference; full document/page synchronization P1 |
| AI-generated UI vs browser safety | Validated schema to shipped allowlisted components only; no executable model output |
| Existing course `completed` vs official publication | Keep processing separate from review/publication/revision; AI job publish is broker delivery, not academic approval |
| Public activity vs private grading/answers | Server-only evaluation references/keys; private attempts; explicit sharing only |
| Existing rank dedup vs XP exactly-once claim | No such XP claim; ED-33 must add durable logical completion uniqueness and recovery |
| Illustrative XP amounts/achievement names vs verified policy | Examples are not adopted configuration; choose supported measurable rules; no causal peer-help/mastery overclaim |
| Three people editing common files | Full-stack module ownership across both repositories; module-owned symbols; serialize edits to common files; producer/consumer review and parity gates |
| Optional live voice vs organizer privacy wording | Prior unresolved organizer clarification retained; no recording/transcription and text P0 |
| Unknown team availability/model access | No invented schedule; task sizes relative; ED-03 remains externally blocked until approved access details |

No framework/database/auth migration, new infrastructure or arbitrary code-generation architecture is proposed. No runtime implementation was done.

## I. Validation of this update

Documentation-only checks: file destinations, task IDs/owners/dependencies, complete F01–F22 and W01–W12 coverage, v1.2 source byte identity, before/after file hashes and diff/scope review. Executed checks passed:

| Check | Result |
|---|---|
| Local Markdown destinations | 52 Markdown files checked, 0 missing local file targets; external URLs/self anchors/code fences excluded |
| Task integrity | 36 unique task headers/index rows, one Habib/Tasnim/Aziz accountable owner each, all references resolve |
| Dependencies | Expanded shorthand/ranges; no dependency cycle |
| Team/feature/workflow coverage | All 36 tasks assigned; 22 functional contracts and 12 workflows present |
| Source provenance | v1.2 copy byte-identical; SHA-256 `2ab2bd794443d7affdbd525169fdf2d66f1c12fd59f177cc592c3e4d2baa0254` |
| Scope versus start-of-turn hashes | 18 existing Markdown modifications + 3 new Markdown files; no deletions or runtime/config/dependency/migration edits |
| Diff/format review | Reviewed amended contracts/priorities/ownership and new files; `git diff --check` passed |

Prior official PDF, v1.1 source and initial audit/validation/history remain byte-unchanged. Checks are temporary local scripts, not product implementation or a new test framework. Original official PDF and prior validation record remain unchanged; no historical pass result is presented as a new test run.

Runtime regression/build/browser/AI inference tests were **not rerun** because this pass changes no runtime/config/dependency files. The prior known startup/build/lint/type/test failures remain unresolved, not silently repaired by the plan. No migrations, feature code, branch creation, commits/pushes, deployment or messages to teammates occurred.

## J. Exact next implementation sequence

1. All freeze Habib source context, Tasnim public activity/private attempt/evidence, Aziz room/facilitator and shared inference examples. No separate AI team role; module owners maintain their Python schemas/prompts too.
2. Habib builds ED-04/06/30/05/31/32 complete Studio+ingestion slice; Tasnim builds ED-03/10/28/27/08/29/12 complete individual-learning slice; Aziz builds ED-07/09/11 complete group-learning slice against agreed fixtures. Fix baseline/privacy in each module.
3. Integrate Habib authorized context -> Tasnim activity/evidence -> Aziz room; reuse Tasnim renderer in Habib preview and Aziz shared activity. Do not duplicate activity registry, provider clients or private evaluation engine.
4. All run UI/API/AI/security/browser checks within their module; Aziz coordinates integrated instructor -> solo -> group -> private check -> debrief demonstration and artifacts.
5. P1: Habib rich authoring/instructor insight, Tasnim rewards UI/API/policy + multilingual/visualizer, Aziz voice/private help UI/API/AI. Shared transport stewardship does not transfer domain AI implementation to Tasnim.

## Latest ownership correction

All three members now own complete product modules including AI. Earlier frontend/backend and dedicated-AI splits are superseded. Task IDs/statuses/priorities and official requirements are unchanged. Documentation-only ownership/dependency/link/scope checks follow after execution; no runtime changes or new test results are implied.

Latest correction checks passed: 36 canonical tasks/index rows match module owners (Habib 14, Tasnim 12, Aziz 10 including coordination tasks); all are covered by the team plan and dependency graph is acyclic. Counts are assignments, not estimates of equal workload. Local link check: 52 Markdown files, zero missing file destinations. Twelve Markdown files changed in this correction; runtime/config/schema/dependency files and source references are unchanged. `git diff --check` passed. Runtime tests were not rerun for documentation-only ownership changes.

## Named team and expanded technical planning

Confirmed by the user: **Habib — Course Studio/Content/Access; Tasnim — Individual Learning/Progress; Aziz — Study Together/Collaboration**. This replaces temporary module letters and any earlier tentative assignment. All 36 task owners are named. Each task now includes existing source references, implementation sequence, interface/data/architecture decisions, failure cases, handoff and review.

The target architecture now details current-stack reuse, proposed operations, editorial/attempt/room consistency, private projections, bounded inference budgets, evidence/reward replay recovery and decisions still needing confirmation. The team plan includes named review rules and next implementation packages. No new feature, schema, migration, dependency, deployment or test result is claimed. Names are confirmed; actual availability/deadline/service/retention choices remain separate decisions. Planning checks are recorded after execution below.

Named-planning validation: all 36 task/index owners match the confirmed allocation (Habib 14, Tasnim 12, Aziz 10); every task has one complete technical packet, and all 164 existing-code references resolve. All tasks are covered by the team plan, references use known IDs and dependencies are acyclic. Local links: 52 Markdown files, zero missing file destinations. Fourteen Markdown files changed relative to the named-planning baseline; runtime/config/schema/dependency files and preserved source documents are unchanged. `git diff --check` passed after removing an extra trailing blank line. Runtime tests were not rerun for these documentation changes.

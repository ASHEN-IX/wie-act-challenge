# Testing and validation plan — PLANNED gates

This is a plan for retained behavior and future EdNova work, not executed test results. Actual commands, exits, failures/skips and environment limits belong in [audit validation](../../audit/2026-10-18/VALIDATION.md). No empirical learning score, latency/cost percentage or real-user result is asserted here.

## Validation layers and fixtures

Use synthetic users in two institutions (admin/instructor/enrolled/unenrolled), an independent learner and an outsider; one official published course, one draft and two private courses. Use a small synthetic 3NF chapter with known dependencies, worked solution, misconception and source/page/version references. Never run destructive integration fixtures against production data. Private learner checks and group public reasoning are distinct fixture sets.

1. Retained unit/contracts: upload/type/schema/topology parity, domain routing, auth/tier policy, retry/idempotency/recovery, evaluator states/scoring and source guards.
2. API integration: identity/role/membership/ownership matrix; upload/jobs/results; publication/retrieval and sharing; course/room access; allowed failures and duplicate operations.
3. Browser: W01–W12 journeys, including 2–4 independent browser contexts and actual media devices for optional voice. Verify persistence/API effects, not just visible UI.
4. AI: fixed source-backed cases with expected interventions/acceptable uncertainty; distinguish mock/stub contract tests from actual approved model-service requests.
5. Delivery: clean-start setup, dependency/build checks, source/privacy review, report page count, video duration and pitch rehearsal.

## Acceptance scenarios

| Test ID | Feature/task | Setup and action | Required result / evidence |
|---|---|---|---|
| T01 | F01; ED-01/04 | Register/verify/login, reload, logout/reset/deactivate; attempt role spoof | Cookie identity correct; revoked session denied over HTTP/WS; client teacher field grants no power |
| T02 | F02; ED-04/05 | Institution A admin assigns instructor, creates draft, enrollment code used in Institution B | Own scope works; foreign-institution/expired/code-as-role escalation denied; no content enumeration |
| T03 | F03; ED-05/06 | Upload, preview, publish; failed replacement and unpublished access | Published version preserved on failure; only assigned instructor publishes and enrolled learner reads |
| T04 | F04/F19; ED-02/06 | Private upload; guessed course/file/static URL/index/cache/AI resource refs | Denied before retrieval/inference; explicit sharing exposes only chosen resource to authorized room |
| T05 | F03/F04; ED-06 | Wrong MIME/magic/oversize/traversal/encrypted PDF, extraction timeout/retry | Correct recoverable errors, no execution/path escape/partial publication; progress terminal state accurate |
| T06 | F06; ED-10 | Ask known grounded question and follow returned citation | Correct authorized material/version/section; no fabricated citation; generated interpretation labeled |
| T07 | F06/F19; ED-10 | Unrelated source, injected instructions in document/chat and off-topic request | No policy/source ACL override; unsupported evidence declared; safe relevant guidance |
| T08 | F07; ED-08 | Beginner/advanced/untested synthetic answers; change detail preference | Appropriate provisional difficulty and evidence-limited status; no fixed learner-type/intelligence diagnosis |
| T09 | F06/F12; ED-08/09 | Learner asks for answer after first attempt | Guiding question/graduated hint before reveal; full explanation available on explicit request |
| T10 | F09/F11; ED-07 | Two to four browsers join, type, select source/activity, submit exercise; P1 page-following separately | Matching public activity state; ordering/reconnect/replay deterministic; private attempts separate; no duplicate accepted contribution |
| T11 | F12/F14; ED-09/10 | Synthetic wrong 3NF explanation and peer disagreement | AI asks peer for justification then verifies/hints with evidence; ambiguous candidate not falsely certified |
| T12 | F12; ED-09 | One learner quiet; invitation declined | Optional respectful invitation; no public ranking, forced turn or penalty; participant can finish |
| T13 | F15; ED-11 | Separate final checks then session finish/retry | Private own results/next step; safe public recap; no duplicate completion/reward or mastery overclaim |
| T14 | F17; ED-03/12 | Intent/format task then complex reasoning with actual service | Compact and capable category choices traceable, correct and deliberate; approved provider IDs and real requests recorded |
| T15 | F17; ED-12 | Disable capable availability / inject 429/timeout/retry exhaustion | Explicit limited mode, bounded approved retry; unresolved verification pending; room/chat/exercise keep working |
| T16 | F17; ED-12 | Limited total capacity and duplicate equivalent request | Scoped reuse/dedup, bounded calls/context/output; no quota bypass or cross-user cached content |
| T17 | F17; ED-12 | Delayed whole non-streaming response | Visible queued/running progress; controls remain responsive; no fake token streaming or duplicate action |
| T18 | F18; ED-16 | English/French/Arabic/Darija and code-switched prompts at two levels | Source meaning, formulas/code and accessible tone retained; actual failures recorded with human rubric |
| T19 | F19; ED-02/13 | Outsider/left participant fetches history/voice/source and stays connected during revocation | Resource membership enforced on fetch and delivery, not just login/connect; no later broadcast leak |
| T20 | F13; ED-18 | Private help while peer/instructor watches and queries history/cache | Recipient only; private question/answer/check never appears in group recap/events/logs |
| T21 | F16; ED-19 | Instructor across courses and cohorts below threshold | Only approved aggregates; identifying small groups suppressed; private files/transcripts never accessible |
| T22 | F10; ED-17 | Real devices: microphone denied, mute, 3 peers, network loss, tab close/device switch | Text usable; audio teardown/reconnect correct; media unaffected by AI failure; no recording/transcription persistence |
| T23 | F19; ED-01/12 | Worker crash after claim, duplicate result, broker interruption and restart | Bounded lease/retry recovery, one accepted result, consistent progress; durable evaluator resume only when configured |
| T24 | F19; ED-13 | Inspect synthetic request/log/report/video/config payloads | No credentials, real identity/voice/private institution or learner profiles; all external services declared |
| T25 | F05; ED-21 | Start from topic without source | Generated baseline explicitly labeled; no invented university provenance; safe check and next step |
| T26 | Delivery; ED-15 | Fresh evaluator follows setup and replays P0 demo | Reproducible real-inference flow, correct artifact limits and honest evidence/skips |

## AI evaluation rubric and evidence record

For each case record scenario ID, fixture/source version, expected pedagogical action, actual output, category/model/service (redacted), validation result, grounding correctness, hint-before-answer behavior, uncertainty, level/language suitability, inclusion/privacy, elapsed time and calls/tokens/retries/fallback when available. Include input/output hashes or sanitized excerpts so results can be reproduced without private content. Habib human checks answer-key and citation correctness; a passing JSON schema alone is insufficient.

Use the same fixed cases across compact/capable paths and failure modes. Do not treat a template/mock response as model quality evidence. Define pass/fail against expected behavior before the run; report case count and unresolved errors, not invented accuracy. Extra volunteers may provide anonymous qualitative feedback with synthetic materials (ED-20); this does not establish causal learning improvement.

## Commands and prerequisites

From workspace root: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`. The root `test` command short-circuits, so execute package suites individually when one fails to observe remaining results. API build and strict typecheck use different configs; a successful build does not imply strict test typings pass.

Dedicated Mongo/Mailpit: `pnpm test:infra:up` (27018, 1026/8026). Live broker roundtrip suites require **explicit isolated broker** and `RUN_AI_ROUNDTRIP=1`; normal integration skips do not establish those roundtrips. Auth tests use dedicated test databases; browser launcher supplies test env but cannot compensate for a failed Nest startup. Start/stop only test services created for validation, never unrelated persistent resources.

Python: use compatible >=3.11,<3.15 plus Poetry project dependencies/dev tools. Run from `study-partner-ai`: `poetry run pytest tests agents -q`, with a reviewed selection of live/manual scripts; `conftest.py` excludes some manual tests, not all network dependencies. Full ingestion/RAG/ML tests require heavy libraries/model artifacts, and real service evaluation requires approved credentials. Habib lightweight temporary environment can run selected worker/state/schema tests, with its dependency subset and untested scope explicitly recorded.

## Exit gate

Before feature readiness, pass P0 access/source-isolation, individual practice, genuine multi-browser peer facilitation and debrief, category routing, delayed/non-streamed response and capability/usage failure scenarios. Retained auth/recovery/safety tests must not regress. Record commands and exact reasons for blocked/skipped checks. Review complete diff, dependency/import references and internal documentation links; verify runtime source changes are only intentional future feature work. This audit's documentation-only change does not establish that the pre-existing application is stable.

## v1.2 additional acceptance coverage — PLANNED, not executed

Same fixture set and evidence record above apply. Run each owner's unit/API tests before handoff, then Aziz's integrated browser tests. The [team plan](team-delivery-plan.md) defines contracts/gates; [v1.2 report](../../audit/2026-10-18/EDNOVA_V1_2_UPDATE.md) records this documentation-only update separately from earlier runtime results.

| Test ID | Task / owner | Scenario | Acceptance |
|---|---|---|---|
| T27 | ED-26; Habib+Tasnim+Aziz review | Serialize same source/revision/quiz/guided/attempt/evidence fixtures through Node, Python and frontend consumer | Supported versions/enums/visibility agree; invalid bounded payload/type/version rejected consistently; grading key/rubric absent publicly |
| T28 | ED-06/30/31; Habib Studio + extraction AI | PDF with misdetected heading, missing page ref and OCR failure -> instructor correction | Editable hierarchy retains original/provenance; unknown source location marked honestly; recoverable failure, no automatic publication |
| T29 | ED-05/30/31; Habib Studio + Tasnim activity preview | Two instructors edit same draft; publish new revision during active student attempt | Stale write rejected; unauthorized owner denied; active attempt still pins approved original revision/answer policy |
| T30 | ED-27/28; Tasnim learning UI/API/AI | Quiz and guided problem selection, learner input/hint/feedback/retry; unknown UI type and executable HTML/JS/JSX/CSS/formula payload | Shipped components only; deterministic trusted code; safe text fallback; no code execution, partial state mutation or repeated credit |
| T31 | ED-29; Tasnim learning UI/API/evaluator | Forged actor/grade/evidence ID, duplicate concurrent submission, delayed callback and unavailable evaluation | Tasnim resolves identity/version and uses Habib source-access contract; accepted evidence once; uncertainty/pending receives no mastery/XP; private answers protected |
| T32 | ED-07/27/29; Aziz rooms + Tasnim activity/evaluation + Habib source | Presenter changes step while learners answer privately; stale event/reconnect/participant revocation | Authoritative public sequence/snapshot converges; presenter cannot submit for others or broadcast their private answers |
| T33 | ED-32; Habib Studio AI/preview using Tasnim renderer | Instructor setting changes language/difficulty/hint policy/allowed sources | P1 candidate reflects settings, provenance retained, generated enrichment never auto-approved; failed generation keeps reviewed source |
| T34 | ED-33; Tasnim | Same accepted completion delivered with new transport IDs, repeated attempt IDs and concurrent retries | Stable logical completion key; one capped XP/achievement application; no old/new reward double count |
| T35 | ED-33; Tasnim | Crash after event claim before profile increment; replay after partial write | Recover to exactly one effect and accurate reason/history; ledger existence alone cannot suppress a missing update |
| T36 | ED-33/34; Tasnim | Idle duration, AI calls/chat volume, wrong answers, group presence, unsupported peer-help claim | No learning XP for these alone; no mistake penalties; learner sees verified/pending and motivation level separately from subject evidence |
| T37 | ED-35; Tasnim full-stack visualization | One deterministic algorithm/math visualizer: next/back/reset/bounded input | Reproducible correct output, keyboard/mobile/reduced-motion support, no generated code or automatic mastery claim |
| T38 | ED-14/15; Aziz + Habib/Tasnim | Instructor corrects/publishes -> solo interactive check -> same room activity/AI peer hint -> private checks/progress -> optional XP | Full P0 uses real approved inference and survives capable outage; P1 reward shown only if implemented and T34–T36 pass; no prewritten screen presented as real feature |

P0 runs T27–T32 and T38 plus relevant T01–T24; P1 adds T33–T37, T18/T20–T22 as enabled. Each module owner runs API, React, Python/AI and browser tests: Habib Content/Access/Studio/extraction; Tasnim Individual Learning/Progress/tutor/evaluator/rewards; Aziz Collaboration/facilitator/voice/private-help plus integrated journey coordination. Shared inference parity tests are reviewed by all owners. No required test disappears because another member owns the feature.

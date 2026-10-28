# ED-09 baseline audit — 22 October 2026

**Implementation phase: NOT STARTED. Canonical status: TODO.** ED-07 current gate is [PARTIAL](ED-07-CURRENT-VERIFICATION.md); the mission requires PASS before new ED-09 feature work. Existing uncommitted facilitator files were preserved. This is a source audit, not executed AI quality or integration evidence.

## Acceptance matrix

| Canonical ED-09 criterion | Existing implementation / classification | Evidence / missing behavior |
|---|---|---|
| Peers reason before full answer | PARTIAL: Python `agents/facilitator/policy.py`, `prompts.py`; Node local policy in `modules/study/src/routes/rooms.ts`; room facilitator card | Regex/template peer prompts exist. No demonstrated grounded multi-turn reasoning/reveal policy or real provider run; direct-answer prohibition in Contract 15 takes precedence over looser reveal wording elsewhere |
| Known misconception receives supported intervention | PARTIAL / BLOCKED: deterministic 1NF/binary-search rules and shared LLM `ask('coach', ...)` | Keyword matching also matches statements that refute misconceptions. Rules are not source-backed correction evidence. No authorized published-context retrieval, vetted activity key integration, or real compact/capable verification |
| Quiet learner may decline | IMPLEMENTED BUT UNVERIFIED: UI Pass/Decline, Node decline branch, Python decline response | Any member can decline a referenced room intervention; target identity is not enforced. No bounded voluntary-participation state or declined-invitation suppression verified |
| Group context bounded | PARTIAL: schemas and client input max length | Node observe/action request bodies and `recentDialogue` are not validated with strict bounds; Python strings/lists/learningContext are unbounded, extra fields not explicitly forbidden. No end-to-end context budget |

## Capability inventory

| Capability | Classification | Actual paths / next action |
|---|---|---|
| Facilitator UI | IMPLEMENTED BUT UNVERIFIED | `apps/web/src/features/collaboration/room-view.tsx`, `actions.ts`: ask/hint/decline, intervention card. Errors/mode provenance not fully represented. Check/finish controls/presets not complete |
| Room context retrieval | PARTIAL | Existing Node routes derive room/roster but accept caller-supplied recent dialogue; canonical bounded public history absent |
| Authorized source retrieval | MISSING | `learningContext` is course ID/title, not Habib Contract 03 context. Existing room source ACL fix protects access but does not retrieve grounded revisions |
| Python facilitator orchestration | IMPLEMENTED BUT UNVERIFIED | `apps/ai/services/api/routers/facilitator.py`, `agents/facilitator/{agent,policy,schemas,prompts}.py`; inspected, not run here |
| Provider integration | PARTIAL / AVAILABLE_NOT_VERIFIED | Uses shared `utils/llm_client.py` via coach alias. Missing keys may mock; no organizer service/category proof or real inference tested |
| Deterministic fallback | IMPLEMENTED BUT UNVERIFIED | Node local policy and Python templates; broad exceptions fall back without response/UI mode designation. These are not real inference |
| Nest proposal validation | PARTIAL | Existing handlers persist model-proposed fields without complete bounds, source/room/recipient validation or expected room-sequence check after inference; durable duplicate result protection absent |
| Presenter-controlled proposal publication | PARTIAL | UI delegates proposed target phase to ordinary phase action; proposed command model does not preserve targetPhase consistently. No reviewed, idempotent accept/publish workflow; renderer/activity validation unavailable |
| Activity renderer reuse | MISSING / BLOCKED | Tasnim ED-26/27 public renderer/API absent; do not build a duplicate |
| Private assessments/evidence | MISSING / BLOCKED | Tasnim ED-29 canonical attempts/private results/safe completion signals absent; legacy evaluator/job plumbing is not a replacement |
| Automated tests | AVAILABLE_NOT_VERIFIED | Existing `apps/api/tests/integration/ed09-facilitator.integration.test.ts`, Python facilitator tests and copied UI state tests. ED-09 suites not run because the prerequisite gate failed |
| Voice | OUT OF SCOPE | Explicit user restriction. Contracts 14/15 describe speech transport; text adaptation must retain semantic safety without adding voice infrastructure |

## Separate implementation handoff

After ED-07 PASS, freeze actual bounded text observation/action/proposal examples with the owners. Reuse public room/source/activity contracts and shared model transport. Validate action enums, budgets, current actor/source/target/sequence, proposal fields and citations before writes; reject stale results after inference and deduplicate accepted operations. Make real/mock/deterministic fallback/unavailable provenance explicit through API and UI. Respect target-only optional decline. Require current presenter approval for actual shared-view publication and reuse Tasnim's renderer/evaluator. Run source-backed three-person misconception/disagreement/decline cases, malformed input/output and provider-timeout tests, plus real browser integration. Real inference evidence requires actual approved provider execution.

No Python, prompt, facilitator policy, model schema or ED-09 test files were changed in this execution. Existing facilitator route signatures gained only the common ED-07 active-room/source authorization guard: a resource-security correction, not a new facilitator feature. No ED-09 DONE claim and no ED-11 implementation.

## Documentation conflicts

- Canonical backlog index calls ED-25 P2; its detailed section says P1. ED-17 is P1/stable-P0-dependent, while team-plan Gates 1/3/4 include LiveKit and voice agents. Explicit user text-only scope controls this execution; voice remains deferred.
- Historical ED-07 report claimed COMPLETE/GO while omitting general text, real activity/source pins/private attempts and broad replay/presence semantics. Current canonical criteria control the gate.
- Technical examples allow up to six room members; product/backlog browser acceptance specifies 2–4. The existing configured capacity is preserved; this run verified two browsers, not four or six.
- Paths such as `study-partner-web` and `study-partner-ai` refer to current `apps/web` and `apps/ai`; no obsolete directories were recreated.

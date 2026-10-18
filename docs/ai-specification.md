# AI technical specification

**CURRENT** evidence is from the Python/Node source. **TARGET / PLANNED** sections specify future EdNova behavior. The official requirement is deliberate combination of compact/fast and larger/capable models on the available real inference service, with no custom training or fine-tuning. RAG is optional. Provider-model names below describe repository configuration only; availability was not tested.

## CURRENT agents and reusable behavior

| Agent / source under `study-partner-ai` | Actual responsibility | Reuse and limitation |
|---|---|---|
| `agents/course_ingestion/agent.py`, ingestion worker | Validate/sandbox PDF extraction, OCR fallback, section parsing, enrichment, objective extraction/Bloom classification, chunks/embeddings/dedup and persistence | Source processing useful; not an instructor publication/authorization system |
| `agents/planner/agent.py` | Retrieve course chunks, decompose goals, validate task graph, buffers/reviews and pacing; simple decomposition fallback | Personal study plan, not a live room facilitator |
| `agents/scheduler/agent.py` | Fit tasks into availability/prerequisites/focus profiles, Pomodoro fallback | Deterministic scheduling reuse; no compact/capable inference mapping of its own |
| `agents/coach/agent.py` and rules/decision/history | Combine focus/fatigue/task context, deterministic rules and LLM nudges with validated actions/history | Useful policy patterns; not misconception verification or balanced group discussion |
| `agents/evaluator/agent.py`, scoring/state/schemas and worker | Multi-turn Socratic questions, answer assessment, hints/feedback, attempts/transition and result evidence | Individual pedagogy reuse; no group state; agent in-memory sessions can be rehydrated by configured worker store |
| `agents/search/agent.py`, pipeline/retrieval/extraction | Web retrieval/extraction and source-constrained answer generation, safe unavailable response and persistence | External web evidence, not enrolled-course retrieval |
| `agents/reflection/` service variants | Daily metrics, aggregation, trends and reflective feedback | Personal progress reuse; similar trees need runtime/import review before deletion |
| `agents/orchestrator.py`, `services/ai_orchestrator/`, `services/schedule_orchestrator/` | Existing orchestration of ingestion/planning/coaching/scheduling | Preserve active entrypoints; avoid a new multi-agent fleet |

Node `modules/ai-orchestrator` owns jobs/eval results and external requests; study owns course ingestion application and competency updates. `shared/aiClient.ts` sends authenticated private-service requests. FastAPI routers enforce `AI_SERVICE_API_KEY` (>=32 chars) except health. Worker entrypoints run separately; HTTP service health does not prove broker workers or models are ready.

## CURRENT models/routing

`utils/llm_client.py` resolves aliases through `litellm/config.yaml` and invokes non-streaming `Router.completion`. YAML config currently sets:

| Alias | Configured provider model | Default token cap |
|---|---|---|
| coach | `gemini/gemini-2.0-flash` | 512 |
| planner | `nvidia_nim/deepseek-ai/deepseek-r1` | 2048 |
| search | `openrouter/meta-llama/llama-3.3-70b-instruct` | 1536 |
| reflection | `nvidia_nim/meta/llama-3.3-70b-instruct` | 2048 |
| course_ingestion | `groq/llama-3.1-8b-instant` | 1024 |
| evaluator | `gemini/gemini-2.0-flash` | 1536 |

Shared fallback aliases use Groq/NVIDIA/OpenRouter 70B configurations. Router settings include 2 retries, retry_after 2 and cooldown 30. These are per-agent/provider routes, **not verified compact/capable categories on the organizer service**. Do not route around the organizer quota using these providers during the demo. Confirm approved models and declarations first (ED-03).

`LLM_MOCK=1` OR absence of any recognized usable primary/fallback provider key makes the shared client call a supplied mock responder; without one it raises `MissingMockResponderError`. `LLM_MOCK=0` alone does not force real inference. Real failures surface `LLMRequestError`; worker policy handles retries. Coach and planner have deterministic exhaustion fallbacks. Passing stub/mock tests proves contracts, not inference quality or compliance.

## CURRENT grounding, validation and state

Ingestion extracts and chunks course text, stores embeddings; planner retrieval can use embedded vectors, persisted FAISS index, stored embeddings or re-encode text. Search uses web sources. Habib planner chunk is not automatically a citation with document page/version. Existing evaluator/coach/planner Pydantic/output validators, message payload schemas and trusted/untrusted prompt guards are reusable. Sources/chat remain untrusted even when instructor-published.

Broker envelopes carry message/correlation IDs and actor context. BaseAIWorker has retry/error classification, delayed retries, DLQ/idempotency and progress/result publication; Node persists and consumes results. Canonical retry delays default to 1s/4s/16s; preserve the [message contract](contracts/ai-message-contract.md) and [topology runbook](runbooks/rabbitmq-topology-v2-migration.md). Evaluator agent state is process-local; `workers/session_store.py` provides memory with TTL or Redis. Configure and test durable resume across workers before claiming restart recovery.

Existing structured logging/redaction does not prove PII-free model inputs. Coach context includes personal signals/history; domain accounts contain names/emails. Camera/fatigue/ML functionality is legacy, not required/approved EdNova demo data processing. No training or camera analysis is added in this audit.

## TARGET facilitator policy and state

Socratic and Group Challenge are two policy presets over one bounded state; Peer Teaching/Revision are later presets. Observe typed messages and explicit exercise/control actions only. Never claim the AI heard spoken discussion without an implemented, consented speech pipeline.

```text
SETUP -> CHECK_IN -> SHARED_CHALLENGE -> PEER_EXPLANATION -> PEER_CRITIQUE
      -> AI_VERIFY_OR_HINT -> INDIVIDUAL_CHECK -> GROUP_DEBRIEF -> COMPLETE
```

Maintain room/context/source IDs and versions, objective/problem, phase/mode/hintLevel, authorized participant aliases, voluntary participation signals, recent relevant public turns, candidate misconceptions, model availability and references. Private questions/checks have separate recipient scope; they must not be injected into group summaries. Summarize bounded history, never pass infinite chat or recordings. Phase transitions require validated actions; duplicate job completion cannot advance twice.

| Intervention | Trigger | Policy / fallback |
|---|---|---|
| ASK_PEER / ASK_FOR_JUSTIFICATION | New proposed answer or disagreement | Invite peers to reason before AI reveals; brief prompt |
| GIVE_HINT | Explicit request or stuck checkpoint | Progressively stronger grounded hint; full explanation on request |
| CHECK_MISCONCEPTION | Candidate unsupported/incorrect claim | Verify with source/answer key or capable reasoning; uncertainty remains explicit |
| INVITE_PARTICIPANT | Opt-in balancing checkpoint | Invite once, allow decline; never rank/shame or equate silence with ability |
| SIMPLIFY / TRANSLATE_OR_REPHRASE | Requested language/detail change | Preserve technical terms/formulas and evidence |
| PROPOSE_EXERCISE | Phase/objective checkpoint | Use validated source-based problem; adapt provisional difficulty |
| SUMMARIZE_AND_NEXT_STEP | Finish/reflection request | Public observed group outcome; private check-based next steps |

Do not answer every message or interrupt conversations without reliable signals. No global weakest-student label, hidden surveillance or automatic answer certification.

## TARGET model decision matrix

| Operation | Default | Escalation / safe fallback |
|---|---|---|
| Intent/language, small extraction/formatting | Rules or compact | Ask clarification if ambiguous |
| Short neutral summary, participation cue | Compact + deterministic policy | Unresolved disagreement stays unresolved |
| Simple source-supported hint | Compact + allowed passage | Ask source-based question if reasoning exceeds confidence |
| Complex peer explanation verification / synthesis | Capable | Defer verification or use vetted answer key; no fabricated certainty |
| Complex adaptive exercise feedback | Capable when justified | Reuse validated exercise/feedback or request retry later |
| Next step | Rules/compact using actual checks | Suggest additional check if evidence insufficient |

Choose category by operation/complexity, grounding, uncertainty, latency/quota and language quality. Do not send every request to capable or chain many compact calls. ED-03 must map actual organizer model IDs and supported request format before implementing this policy.

## TARGET output contract and content isolation

Habib proposed validated action contains `operationId`, `roomId`/private recipient, `phase`, `action` enum, short `message`, `sourceReferences` (authorized material/version/section), `uncertainty`, `modelCategory`, `fallbackUsed` and optional next activity. Schema/type/length/action/phase/recipient/source validation occurs before state mutation or broadcast. Reject hallucinated source IDs, unauthorized audiences and invalid transitions; do not expose raw provider output. Reuse existing validators where appropriate rather than introducing an architecture migration.

Authorize before source lookup; document text cannot override system policy or access. Prompt includes only needed synthetic/anonymized context. Cache by operation, allowed sources/version and recipient scope. Private answer/context never enters shared cache or group event. Instructor approval applies only to material; generated claims show provenance/uncertainty.

## TARGET latency, cost, outage and safety constraints

Use existing async status patterns; proposal states are IDLE/QUEUED/RUNNING/RETRYING/COMPLETED/LIMITED_MODE/FAILED, not asserted current AiJob enums. Show useful progress for whole-response inference, allow room interaction and avoid invented token streaming. Bound retry/wall-clock budget, context, output and calls; deduplicate equivalent requests within authorization scope. After ED-03, select actual numeric budgets against service limits and measured latency; no unmeasured latency/cost target is a result.

On 429/timeout/capable outage, retain chat/shared work/audio (if enabled), mark advanced verification pending and use compact/rule/validated-content activities safely. Retry with approved guidance; exhausted work yields visible limitation and recoverable state. Measure elapsed time, category, attempt/fallback counts and calls/tokens where supplied, without learner PII/raw prompts. Test idempotent retries, source access revocation and worker restart.

Privacy/safety: synthetic aliases/materials; no real names, voices, private profiles or institution rosters sent to the provided inference service; no default recordings/transcripts; minimal retention; prompt-injection and adversarial-source tests; no discriminatory participant scoring or psychological profiling. Report teaching claims as preliminary observed evidence. [Testing](testing-plan.md) defines scenario evidence; [delivery](hackathon-delivery.md) owns official restrictions and service declarations.

## v1.2 interactive activity and Studio orchestration — TARGET / TODO

The latest [brief §§39–43](reference/ednova-brief-v1.2.md) adds intelligent UI selection and reviewed digitization; it does not authorize arbitrary browser code. Reuse the same ingestion, retrieval, evaluator, job and prompt-safety boundaries. No new service/queue/database or training is needed for this plan.

1. Ingest PDF deterministically; preserve original source IDs/page ranges and uncertain extraction flags. Compact model may suggest hierarchy/concepts/objectives; generated enrichment retains its label. Instructor correction produces a reviewed draft, not a model-approved official source.
2. At study time resolve allowed published/personal source revision, objective and learner preferences. Rules/compact intent analysis chooses text, InteractiveQuiz or GuidedProblem; capable reasoning is reserved for complex source-grounded explanation, rubric/step verification and misconception cases. Rich visualizations are P1.
3. Emit a bounded ED-26 candidate: schemaVersion, allowlisted activityType/componentVersion, source/revision refs, objective, instructions, bounded data, difficulty/language and **evaluationRef**, not executable HTML/JS/JSX/CSS/formulas or public answer keys. Tasnim learning API validates actor/source/version via Habib content-access contract and strips server-only fields before delivery.
4. Trust only maintained React components with deterministic behavior. A shipped visualizer executes audited shipped logic with validated parameters; a model cannot add functions/imports/event handlers. Quiz/guided activities collect evidence through server-validated attempts. Resetting visual state is not a new rewarded completion.
5. Tasnim evaluator receives authorized private attempt + server-owned expected answer/rubric and returns bounded feedback/outcome/uncertainty. Tasnim learning API independently validates identity/version/idempotency, persists accepted evidence and applies competency policy; neither model output nor browser marks evidence accepted.
6. Same definitions serve solo and group. Selected presenter changes public view step/input only; private answers and individual checks are separate. No private answer/rubric enters shared prompt/cache/summary. Final group recap uses permitted public reasoning only.
7. Invalid/unsupported activity, malformed data, missing sources or model outage -> usable safe text/validated stored exercise, with no definition/attempt/reward mutation. Bound retries/repair calls to existing capacity budget; source-free content is labeled generated and never silently official.

Studio P0: PDF -> editable hierarchy -> correction/objective review -> approval/publish -> learner quiz/problem. P1: richer per-section difficulty/language/pedagogy/answer/retry settings and generation/preview conveniences. Instructor-selected settings constrain generation, not permissions. A runtime personalized variant of an approved activity cannot overwrite official content; label it and pin its own immutable version/provenance before assessment.

Rewards are deterministic server policy outside AI. Model may suggest evidence references but cannot set XP, achievement eligibility or a causal peer-help claim. Do not map numeric classifier confidence directly to mastery/rewards. Post-feedback events reference accepted evidence and rule version; ED-33 owns retry/anti-abuse guarantees.

Habib owns content/access/Studio and extraction AI contracts; Tasnim owns individual activity/evaluation/evidence/progress and their AI; Aziz owns room/facilitator/private-help/group-summary and their AI. Every owner maintains TS/React/Python validation for their module. Tasnim stewards shared provider transport only; it is not an AI team role. Aziz consumes Tasnim private evaluation interface instead of duplicating the learning engine. Each consuming module validates outputs before writes/delivery. Shared failure, pending and recipient semantics are frozen in ED-26 before coding. See [team plan](team-delivery-plan.md) for producer/consumer handoffs, examples and gates.

Ownership follows product modules throughout Python as well as Node/web: extraction/Studio Habib; individual tutoring/assessment/progress Tasnim; peer facilitator/group summaries Aziz. Shared client/queues/schemas remain reusable infrastructure, not a separate AI workstream.

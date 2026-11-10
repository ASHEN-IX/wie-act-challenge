# Noveris AI engineering

The source of truth is `apps/ai/utils/llm_client.py`, the configured YAML, task workflows and the consuming API services. Model assignment is per alias. A deterministic policy, an AI workflow and a provider call have distinct responsibilities.

## Task architecture

| Workflow | AI operation | Deterministic control |
| --- | --- | --- |
| Course ingestion | Supported enrichment and objective/activity proposals | File validation, extraction, source metadata and publication policy |
| Course review | Propose titles/objectives from bounded extracted excerpts | IDs, lengths, instructor decision and source-review gates |
| Nardouch | Course tutor with compact/capable aliases | Authorized context, source/reference validation and response boundary |
| Visual Lab | Compact engine selection and capable scenario planning | Strict schemas, registered engine execution and check feedback |
| Facilitator | Eligible unmatched request to capable model | Rules-first policy, recipient/schema checks and current room authority |
| Planner | Goal decomposition and plan synthesis | Context selection, graph constraints, pacing and planning budgets |
| Evaluator | Multi-turn assessment workflows | Stored activity evaluation, private attempts and accepted-evidence contracts |
| Coach | Optional generated nudge or decision | Rules, signals, bounded actions and history |
| Search/reflection | Source synthesis and reflective language | Retrieval, extraction, aggregation and output contracts |
| Scheduler | Scheduling workflow | Availability, prerequisites and deterministic fallback rules |

The activity source-hint route is deterministic scaffolding. Its existence does not imply a provider call. The legacy evaluator workflow and the reviewed-activity deterministic assessment path have different contracts and must not be merged in evidence claims.

## Model client and approvals

`ask` resolves the agent configuration, execution mode and usable provider credentials. Real inference requires an operator approval tied to task, exact model, expiry and a request cap. Optional token and cost bounds are also represented. The client asks the API ledger to reserve before dispatch and records returned usage. Revocation and approval identity are checked before delivery. Missing authorization or unavailable accounting fails closed.

The shared router passes `num_retries=0` and `fallbacks=[]` even though the YAML declares retry and fallback candidates. A retry can spend another request against one reservation, while a model fallback may violate the exact-model authorization. Callers handle supported deterministic recovery explicitly. Background queue retries are configured at a different layer.

## Prompt and response contracts

Trusted system instructions and untrusted source/learner input use separate prompt construction. Minimized excerpts and bounded dialogue reduce context. Workflow-specific Pydantic and Node contracts validate response shape and supported identifiers. Structured plans are data for known renderers. Instructor publication does not make arbitrary source text a trusted instruction.

Task validators may reject or repair generated data within their bounded policy. Visual Lab can attempt one candidate repair. A successful client response and a valid structured object establish different facts from source-grounding quality or pedagogy.

## Retrieval and provenance

The source pipeline can produce 200-word chunks with 50-word overlap. `all-MiniLM-L6-v2` supplies normalized 384-dimensional vectors and FAISS IndexFlatIP provides retrieval. Python can persist raw embedding data in its PostgreSQL schema and write revision-specific artifacts on disk.

The tutor receives an authorized course/revision/content pin and source manifest identity. Retrieval selects passages and prompt augmentation includes source metadata. The API compares returned evidence and citations against the authorized source context. Foreign or unsupported references can fail the response. Provenance validation establishes permitted source identity and consistency, while semantic answer correctness requires separate evaluation.

## Cache eligibility

Only opt-in content-only operations should reuse the response cache. The shared key includes agent, model, system/user prompts and generation settings. Changed content or settings produce a new key. Redis entries have configurable expiry. Mock and deterministic fallback responses are outside the real-response cache policy. Private facilitator dialogue is not cache-eligible. A cache hit still goes through approval reservation. Cache failure can fall back to a normal approved provider call.

## Learning behavior

Hints precede explicit source explanation in the activity-support route. Wrong attempts, hint escalation and supported language cues can produce tentative confusion signals. Private preference cues influence wording rather than grades. Explicit room actions and supported observations trigger facilitation; ordinary chat is not automatically monitored.

A private attempt can produce accepted evidence only through its supported assessment contract. Model output, lab interaction or participation alone does not establish mastery. Visual Lab checks explicitly remain practice-only.

## Execution modes and user feedback

`REAL_APPROVED` identifies a successful authorized model result. `MOCK_TEST` identifies explicit local test output. `DETERMINISTIC_FALLBACK` identifies built-in guidance. `UNAVAILABLE` identifies a path without usable inference. Historical interventions may retain an unknown source marker. The interface exposes waiting/progress states for whole responses and preserves questions on supported failed requests.

## Current real inference evidence

The live Visual Lab probe used a synthetic graph topic and temporary bounded approvals through the API ledger. The compact selector returned in 4.951 seconds using 936 tokens. The capable planner returned in 2.077 seconds using 1,747 tokens. Both were REAL_APPROVED with no cache hit. Expired approvals then returned UNAVAILABLE before another provider call. These are single-run wall times including overhead and cold initialization.

The result and candidate are in `docs/submission/evidence/LIVE-INFERENCE-EVALUATION.json`. This exercised the Python planning entrypoint rather than the complete browser course-to-peer journey. Organizer service mapping, provider quota exhaustion, citation-quality evaluation and broad pedagogy remain open. Optional provider configuration is not automatic evidence of current usage or challenge compliance.

See [configuration](llm-config.md), [workflows](workflows.md) and [business usage allocation](business-model.md).

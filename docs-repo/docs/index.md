# Documentation index and authority

Last aligned: **v1.2, 18 October 2026**. Read [workspace README](../../README.md) and [audit](../../audit/2026-10-18/EDNOVA_AUDIT.md) first.

## Maintained source of truth

| Document | Responsibility |
|---|---|
| [Reference provenance](reference/README.md) | Original organizer PDF, latest team brief v1.2 and historical v1.1; requirements vs proposal |
| [v1.2 alignment report](../../audit/2026-10-18/EDNOVA_V1_2_UPDATE.md) | Implemented/reusable/missing matrix, changes and validation for latest brief |
| [Three-member plan](team-delivery-plan.md) | Habib/Tasnim/Aziz task owners, shared contracts and integration gates; single backlog status remains canonical |
| [Product specification](product-specification.md) | Vision, scope, feature flows/status/dependencies/acceptance |
| [Roles and permissions](roles-and-permissions.md) | Current enforcement and proposed five-role matrix |
| [Current architecture](../../ARCHITECTURE.md) | Source-verified stack, services, data flows, auth, realtime and infrastructure |
| [Target architecture](../../TARGET_ARCHITECTURE.md) | Minimal proposed adaptations; no implementation claim |
| [Data model](data-model.md) | Actual schemas vs proposed entities/ownership |
| [Workflows](workflows.md) | Twelve end-to-end journeys with current/partial/planned steps |
| [AI specification](ai-specification.md) | Actual agents, proposed facilitator/routing, validation, safety and fallback |
| [Backlog](sprint-backlog.md) | Single active ID/priority/dependency/status register |
| [Status entrypoint](implementation-tracker.md) | Links to the canonical backlog; no duplicate percentages |
| [Testing plan](testing-plan.md) | Required functional/security/pedagogical/capacity scenarios |
| [Hackathon delivery](hackathon-delivery.md) | Official timing/limits/rules/rubric and proposed artifact/business plan |
| [Validation record](../../audit/2026-10-18/VALIDATION.md) | Commands actually executed, results/skips and limits |
| [Change register](../../audit/2026-10-18/CHANGES.md) | Files changed/removed/preserved and rationale |
| [Development](../../DEVELOPMENT.md), [deployment](../../DEPLOYMENT.md) | Operational setup and known readiness blockers |
| [Frontend](frontend-web.md), [backend](backend-api.md), [AI service](ai-service.md) | Package operation pointers and implementation scope |
| [LLM config](llm-config.md) | Existing alias/client mechanics; not organizer compliance |
| [AI contract](../../docs/contracts/ai-message-contract.md), [RabbitMQ runbook](../../docs/runbooks/rabbitmq-topology-v2-migration.md) | Retained interoperability/reliability constraints |
| [Bloom reference](education/bloom-taxonomy.md) | Existing educational/estimator mechanics; not empirical mastery validation |

## Status and maintenance rules

CURRENT means source exists with cited boundaries; executed behavior is limited to the validation record. TARGET describes the intended design; PLANNED denotes missing work. KEEP/REUSE/MODIFY LATER/REMOVE/INVESTIGATE are audit dispositions, not task completion statuses. DONE/PARTIAL/TODO/BLOCKED live only in the active backlog and require acceptance evidence.

Organizer rules come from the PDF. Team choices come from the brief/specifications. Current behavior comes from source/tests, not diagrams/checkmarks. Update the owning document instead of adding competing architecture/task reports. Keep stable task IDs; mark retired work with reason rather than recycle IDs. For runtime changes update source evidence and rerun affected gates before recording success.

## Historical material

Root migration/auth/API compatibility analyses, old route inventories and the [agents dataflow report](reference/agents-dataflow-report.md) retain technical history with banners. [Legacy sprint backlog](reference/legacy-sprint-backlog.md) and [legacy tracker](reference/legacy-implementation-tracker.md) preserve previous MindFlow IDs in one archival location. Old paths, counts and completion/deployment assertions describe historical claims and are not present-day acceptance. The [earlier remediation handoff](../../audit/2026-10-18/REMEDIATION_STATUS.md) remains useful because it explicitly records incomplete regression work.

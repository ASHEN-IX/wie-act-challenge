# EdNova documentation

One documentation folder, one task register. Start with the team plan and backlog; use the other documents for the relevant task.

| Document | Use |
|---|---|
| [Team plan](team-delivery-plan.md) | Habib/Tasnim/Aziz ownership, shared contracts, reviews and integration gates |
| [Backlog](sprint-backlog.md) | All 36 task owners, current gaps, technical steps, dependencies and acceptance |
| [Development](development.md) | Local setup, Python/workers, testing and troubleshooting |
| [Current architecture](architecture.md) | Existing services, frameworks and data flow |
| [Target architecture](target-architecture.md) | Recommended implementation, proposed interfaces and recovery rules |
| [Product specification](product-specification.md) | Feature scope and acceptance |
| [Roles and permissions](roles-and-permissions.md) | Current enforcement and target access matrix |
| [Data model](data-model.md) / [workflows](workflows.md) | Storage ownership and end-to-end journeys |
| [AI specification](ai-specification.md) / [LLM configuration](llm-config.md) | Domain AI behavior, contracts and safe fallback |
| [Frontend](frontend-web.md) / [backend](backend-api.md) / [AI service](ai-service.md) | Implementation entrypoints and package operations |
| [Testing plan](testing-plan.md) | Functional, isolation, learning and capacity scenarios |
| [Hackathon delivery](hackathon-delivery.md) | Organizer requirements and submission artifacts |
| [Deployment](deployment.md) / [security](security.md) | Deployment and security guidance |
| [AI message contract](contracts/ai-message-contract.md) / [RabbitMQ runbook](runbooks/rabbitmq-topology-v2-migration.md) | Existing interoperability constraints; JSON fixtures are consumed by tests |
| [Bloom taxonomy](education/bloom-taxonomy.md) | Existing educational mechanics |
| [Reference inputs](reference/README.md) | Latest team brief and official organizer PDF |
| [Current preparation results](audit/cleanup.md) | Cleanup changes, checks and remaining blockers |
| [Original audit](audit/ednova-audit.md), [v1.2 gap report](audit/ednova-v1-2-update.md), [original validation](audit/validation.md) | Dated baseline evidence; later results supersede only the checks rerun |

CURRENT describes source; TARGET/PLANNED describes intended work. Reusable code is not completed acceptance. Task statuses live only in the backlog. Update the owning document instead of adding duplicate reports.

Historical migration reports, duplicate navigation/status pages and legacy backlogs were removed during preparation. Git history retains them. Runtime contract fixtures remain at their original `docs/contracts/` paths.

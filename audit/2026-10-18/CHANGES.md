# Change register — documentation cleanup only

## Significant modifications

| Files | Change and reason |
|---|---|
| `README.md` | Repositioned as EdNova target over retained legacy runtime; current/target navigation, realistic setup prerequisites and actual command scope; removed invented root format/AST guarantees and stale blanket readiness |
| `ARCHITECTURE.md` | Source-backed Next/Nest contract-dispatch/Python architecture, correct auth_* collections, APIs, agent/job/realtime paths and known gaps; removed duplicate/incorrect production claims |
| `TARGET_ARCHITECTURE.md` | Replaced old “IMPLEMENTED & VERIFIED” migration target with explicitly PLANNED minimal EdNova adaptation map and gates |
| `DEVELOPMENT.md`, `DEPLOYMENT.md` | Corrected source/compiled entrypoints, test/default DB/mail ports, shared identity settings, WS proxy limits, separate AI workers/volumes and CI/image readiness caveats |
| `docs-repo/README.md`, `docs-repo/docs/index.md` | One maintained navigation/authority map and status vocabulary; directory described accurately within this checkout |
| `docs-repo/docs/architecture.md` | Replaced conflicting duplicate narrative and broken root-relative links with canonical current/target pointers |
| `docs-repo/docs/backend-api.md`, `frontend-web.md`, `ai-service.md` | Replaced stale Express-only/Vite/JWT/.js/character/setup narratives with checked current boundaries and practical launch/test pointers |
| API/web/AI package `README.md` files | Consistent pointers to canonical setup/source/validation instead of old migration success assertions |
| `docs-repo/docs/sprint-backlog.md` | One actionable EdNova backlog, stable IDs, P0/P1/P2/post-hackathon, source status, dependencies/acceptance/validation/complexity; replaced old active program |
| `docs-repo/docs/implementation-tracker.md` | Consolidated progress into backlog; no competing completion percentages/checkmarks |
| Root historical analyses: `API_COMPATIBILITY.md`, `ARCHITECTURE_ANALYSIS.md`, `AUTH_MIGRATION.md`, `AUTH_MIGRATION_ANALYSIS.md`, `AUTH_ROUTE_MAP.md`, `MIGRATION.md`, `MIGRATION_AUDIT.md`, `MIGRATION_INVENTORY.md`, `TYPESCRIPT_MIGRATION_AUDIT.md`, `SECURITY.md` | Prominent historical/superseded banners; preserve useful security/migration context while retiring current certification claims |
| `docs-repo/docs/reference/agents-dataflow-report.md` | Historical label and repaired links to actual Python files |
| `docs-repo/docs/llm-config.md` | Clarified current configuration scope, mocks and lack of organizer-category verification |
| `docs-repo/docs/education/bloom-taxonomy.md` | Clarified estimator math vs empirically validated mastery; corrected source link and verified TypeScript file extensions |

## New maintained documentation

| File under `docs-repo/docs/` | Purpose |
|---|---|
| `product-specification.md` | Vision, official vs team scope, 19 feature contracts including flows/status/gaps/priorities/acceptance |
| `roles-and-permissions.md` | Actual student/admin enforcement vs proposed five-role membership/content matrix |
| `data-model.md` | Existing schemas/relationships, conceptual additions and ownership/retention boundaries |
| `workflows.md` | Twelve required journeys with each step CURRENT/PARTIAL/PLANNED |
| `ai-specification.md` | Actual agents/models/routing/RAG/state and proposed facilitator interventions/categories/budgets/fallback/privacy |
| `testing-plan.md` | Functional, role/access, AI/capacity, multilingual, inclusion, media and recovery scenarios with evidence gates |
| `hackathon-delivery.md` | Exact printed limits/phases/deadline/rules/rubric; artifact and business-model proposal |
| `reference/README.md` | Source provenance, immutable input authority and brief ambiguity explanation |
| `reference/ednova-brief-v1.1.md`, `reference/EdNova_Challenge_Specification_book.pdf` | Byte-identical original brief/PDF reference copies, not new implementation or rewritten organizer rules |

New audit artifacts under `audit/2026-10-18/`: `EDNOVA_AUDIT.md` (classification/gaps/assessment/decisions), `source-inventory.tsv` (866-path baseline inventory), `VALIDATION.md` (executed checks/limits) and this change register.

## Removed / consolidated

- Removed old architecture/frontend/backend/setup assertions from active guides because source contradicts them.
- Removed old blanket completion percentages and historical task checkmarks from active progress tracking. Full original task content is preserved at `reference/legacy-sprint-backlog.md` and `reference/legacy-implementation-tracker.md`, with historical banners; old active paths now serve the canonical EdNova plan/status pointers.
- Removed the duplicate active architecture narrative by converting it to navigation. Fixed links in retained technical references.
- **No runtime feature, code, dependency, script, configuration, test, schema, migration, production data or persistent resource was removed.** No dead-code candidate met the required safe-removal proof. No feature was replaced with a placeholder/mock.

## Preserved

Frameworks, authentication/authorization behavior, APIs, collections/indexes, upload handling, AI services/agents/worker topology, retries/DLQ/leases/observability, tests/security/backup mechanisms, billing/tiers, gamification/social/customization, signals/ML and useful technical history. These remain because retained code uses them or necessity is uncertain. They are not all hackathon scope or ready for challenge-safe use.

## Validation / review

See [executed validation](VALIDATION.md). Complete diff reviewed for documentation-only scope and source-backed assertions; generated Next type-reference changes restored. Dependency install and temporary tests changed no manifest/lockfile. No new feature, UI redesign, framework migration, auth/API change, deployment, commit or push was performed.

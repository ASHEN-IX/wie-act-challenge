# TypeScript Migration Audit & Inventory

Date: 2026-10-08
Scope: Full Repository Migration from JavaScript/JSX to TypeScript/TSX

## 1. Complete File Inventory

| File | Location | Category | Must Migrate? | Reason |
|---|---|---|---|---|
| jest.config.js | study-partner-api | Configuration | MAYBE | Tooling / bundler config |
| index.js | study-partner-api/modules/ai-orchestrator | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/ai-orchestrator/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| AiJob.js | study-partner-api/modules/ai-orchestrator/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| EvalResult.js | study-partner-api/modules/ai-orchestrator/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| LearningObjective.js | study-partner-api/modules/ai-orchestrator/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| StudyPlan.js | study-partner-api/modules/ai-orchestrator/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ai.js | study-partner-api/modules/ai-orchestrator/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| eval.js | study-partner-api/modules/ai-orchestrator/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| jobs.js | study-partner-api/modules/ai-orchestrator/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| search.js | study-partner-api/modules/ai-orchestrator/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| agentService.js | study-partner-api/modules/ai-orchestrator/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| evalResultBuilder.js | study-partner-api/modules/ai-orchestrator/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| evalResultStore.js | study-partner-api/modules/ai-orchestrator/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| jobResultConsumer.js | study-partner-api/modules/ai-orchestrator/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| objectiveContext.js | study-partner-api/modules/ai-orchestrator/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ai-orchestrator.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| coach.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| eval-result.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| eval-routes.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| search-routes.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec12-ai-isolation.test.js | study-partner-api/modules/ai-orchestrator/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| proxyBuilder.js | study-partner-api/modules/ai-orchestrator/src/utils | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/analytics | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/analytics/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| AnalyticsEvent.js | study-partner-api/modules/analytics/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| analytics.js | study-partner-api/modules/analytics/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| analytics.test.js | study-partner-api/modules/analytics/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/auth | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/auth/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| pricing.js | study-partner-api/modules/auth/src/config | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Coupon.js | study-partner-api/modules/auth/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Payment.js | study-partner-api/modules/auth/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| User.js | study-partner-api/modules/auth/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| admin.js | study-partner-api/modules/auth/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| auth.js | study-partner-api/modules/auth/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| stripe.js | study-partner-api/modules/auth/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| emailService.js | study-partner-api/modules/auth/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| admin-redos.test.js | study-partner-api/modules/auth/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| auth.test.js | study-partner-api/modules/auth/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/notification | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/notification/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Notification.js | study-partner-api/modules/notification/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| SessionChat.js | study-partner-api/modules/notification/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| VoiceSession.js | study-partner-api/modules/notification/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| realtime.js | study-partner-api/modules/notification/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| chat.js | study-partner-api/modules/notification/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| notifications.js | study-partner-api/modules/notification/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| voice.js | study-partner-api/modules/notification/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| chatService.js | study-partner-api/modules/notification/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| emailService.js | study-partner-api/modules/notification/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| voiceService.js | study-partner-api/modules/notification/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| emailTemplates.js | study-partner-api/modules/notification/src/templates | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| notification.test.js | study-partner-api/modules/notification/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec12-chat-authn.test.js | study-partner-api/modules/notification/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| rtc-signaling.js | study-partner-api/modules/notification/src/utils | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| chat-handler.js | study-partner-api/modules/notification/src/websocket-handlers | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| voice-handler.js | study-partner-api/modules/notification/src/websocket-handlers | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/signal-processing | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/signal-processing/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| FocusSession.js | study-partner-api/modules/signal-processing/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| focus.js | study-partner-api/modules/signal-processing/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| signal-processing.test.js | study-partner-api/modules/signal-processing/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| signals.test.js | study-partner-api/modules/signal-processing/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/study | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/study/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/study/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| challengeSessions.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| coach.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competencies.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| coreSessions.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| courses.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| learningObjectives.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| plans.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sessionTasks.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sessions.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| subjects.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| tasks.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| teamSessions.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| topics.js | study-partner-api/modules/study/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competency.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competencyQueries.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competencyUpdater.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ingestStatus.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ingestionJob.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| objectives.js | study-partner-api/modules/study/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| coach.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competencies.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competency.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| competencyUpdater.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| completionRewards.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| course-upload-validation.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ingest-status.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| mass-assignment.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| objectives.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| plannerWeakestTargeting.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| plansRoutes.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec12-authn.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec12-authz.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| study.test.js | study-partner-api/modules/study/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| gamificationService.js | study-partner-api/modules/study/src/utils | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sessionHelpers.js | study-partner-api/modules/study/src/utils | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sessionStats.js | study-partner-api/modules/study/src/utils | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| learningObjective.js | study-partner-api/modules/study/src/validators | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| index.js | study-partner-api/modules/user-profile | Application (Backend Domain) | YES | Domain entrypoint |
| app.js | study-partner-api/modules/user-profile/src | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| AvailabilitySlot.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Friendship.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Gamification.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| Quest.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| RankBadge.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| RankEventLedger.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| RankSeason.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| SeasonResultSnapshot.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| UserProfile.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| UserRankProfile.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| rankingConfig.js | study-partner-api/modules/user-profile/src/models | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| availability.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| friends.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| gamification.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| profile.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| quests.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ranking.js | study-partner-api/modules/user-profile/src/routes | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| backfillGamificationStats.js | study-partner-api/modules/user-profile/src/scripts | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| migrateXpToKnowledgePoints.js | study-partner-api/modules/user-profile/src/scripts | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| awardService.js | study-partner-api/modules/user-profile/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| leaderboardService.js | study-partner-api/modules/user-profile/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| rankingService.js | study-partner-api/modules/user-profile/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| seasonService.js | study-partner-api/modules/user-profile/src/services | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| backfill-gamification-stats.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| profile.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ranking-kp-map.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| ranking.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec05-internal-auth.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec06-env.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| sec12-user-lockdown.test.js | study-partner-api/modules/user-profile/src/tests | Application (Backend Domain) | YES | Modular monolith domain routes, models, services |
| check-syntax.js | study-partner-api/scripts | Script | REVIEW | Migration / syntax script |
| migrate-auth.mjs | study-partner-api/scripts | Script | REVIEW | Migration / syntax script |
| analytics-demo.seed.js | study-partner-api/seeds | Script / Seed | REVIEW | Database seeding utility |
| rank-badges.seed.js | study-partner-api/seeds | Script / Seed | REVIEW | Database seeding utility |
| seed-analytics.mjs | study-partner-api/seeds | Script / Seed | REVIEW | Database seeding utility |
| dlq-replay.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| envelope.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| index.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| payloadSchemas.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| publisher.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| topology.js | study-partner-api/shared/ai-messaging | Application (Shared Lib) | YES | Shared contracts, utils, database |
| aiClient.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| auth.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| betterAuth.mjs | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| index.js | study-partner-api/shared/bloom | Application (Shared Lib) | YES | Shared contracts, utils, database |
| taxonomy.js | study-partner-api/shared/bloom | Application (Shared Lib) | YES | Shared contracts, utils, database |
| cache.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| database.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| domainContracts.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| env.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| index.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| logger.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| middleware.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| moduleClient.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| processHandlers.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| requestContext.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| sessionIdentity.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| tierGate.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| uploadValidation.js | study-partner-api/shared | Application (Shared Lib) | YES | Shared contracts, utils, database |
| ai-boundary.test.js | study-partner-api/tests/architecture | Test | REVIEW | Integration / E2E test harness |
| module-contracts.test.js | study-partner-api/tests/architecture | Test | REVIEW | Integration / E2E test harness |
| websocket.test.js | study-partner-api/tests/architecture | Test | REVIEW | Integration / E2E test harness |
| better-auth.lifecycle.mjs | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| better-auth.nest.mjs | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| browser-server.cjs | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| api-gateway.test.js | study-partner-api/tests/gateway | Test | REVIEW | Integration / E2E test harness |
| gateway.test.js | study-partner-api/tests/gateway | Test | REVIEW | Integration / E2E test harness |
| ai-jobs.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| ai-roundtrip.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| api-integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| bloom-loop.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| challenge-session-routes.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| coach-roundtrip.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| gateway.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| team-session-rewards.integration.test.js | study-partner-api/tests/integration | Test | REVIEW | Integration / E2E test harness |
| session.setup.js | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| sessionFixtures.js | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| setup.js | study-partner-api/tests | Test | REVIEW | Integration / E2E test harness |
| ai-envelope.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| ai-progress-envelope.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| ai-publisher.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| bloom-taxonomy-parity.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| dlq-replay.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| duplicate-bugs.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| payload-schemas.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| topology-parity.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| upload-validation.test.js | study-partner-api/tests/shared | Test | REVIEW | Integration / E2E test harness |
| auth.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| better-auth.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| calendar.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| coach-nudge.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| competency-e2e.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| eval-e2e.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| fixtures.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| gamification.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| global-setup.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| ingest-e2e.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| planner-e2e.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| search-e2e.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| search.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| session-flow.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| smoke.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| study-flow.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| tier-gating.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| trial-expiry.integration.spec.js | study-partner-web/e2e | Test | REVIEW | Integration / E2E test harness |
| next.config.mjs | study-partner-web | Configuration | MAYBE | Tooling / bundler config |
| playwright.config.js | study-partner-web | Configuration | MAYBE | Tooling / bundler config |
| postcss.config.js | study-partner-web | Configuration | MAYBE | Tooling / bundler config |
| proxy.js | study-partner-web | Configuration | MAYBE | Tooling / bundler config |
| check-syntax.cjs | study-partner-web/scripts | Script | REVIEW | Migration / syntax script |
| AISearch.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| AuthorizationGate.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Calendar.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| CompetencyMap.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| CourseUpload.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Dashboard.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Landing.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Leaderboard.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Lobby.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Login.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| PlanTaskBadge.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Pricing.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Profile.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Register.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| ReviewCenter.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Sessions.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| StudyPlanner.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| StudySession.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| StudySessionSummary.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| SubjectDetail.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Subjects.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| Tasks.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| TeamLobby.test.jsx | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| authStore.test.js | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| notificationStore.test.js | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| secureAuthState.test.js | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| sessionStore.test.js | study-partner-web/src/__tests__ | Test | YES | Frontend test suites |
| AuthorizationGate.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| CompetencyRadar.jsx | study-partner-web/src/components/CompetencyMap | Application (UI) | YES | React component tree |
| PlanTaskBadge.jsx | study-partner-web/src/components/CompetencyMap | Application (UI) | YES | React component tree |
| TopicDetailPanel.jsx | study-partner-web/src/components/CompetencyMap | Application (UI) | YES | React component tree |
| CreateSubjectModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| FriendProfileModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| JoinSessionModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| Layout.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| LevelUpModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| LevelUpNotification.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| NotificationBell.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| NotificationCenter.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| NotificationItem.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| PermissionGuard.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| QuestPanel.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| RoleBasedRoute.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| ChatHistory.jsx | study-partner-web/src/components/SessionChat | Application (UI) | YES | React component tree |
| ChatInput.jsx | study-partner-web/src/components/SessionChat | Application (UI) | YES | React component tree |
| ChatMessage.jsx | study-partner-web/src/components/SessionChat | Application (UI) | YES | React component tree |
| ChatWindow.jsx | study-partner-web/src/components/SessionChat | Application (UI) | YES | React component tree |
| SearchResult.jsx | study-partner-web/src/components/SessionChat | Application (UI) | YES | React component tree |
| SessionInvitePopup.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| SessionManager.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| Sidebar.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| SocraticEvaluation.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| SubscriptionBadge.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| TeamInviteModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| TeamSessionPanel.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| ThemeToggle.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| TrialBanner.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| UploadModal.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| ParticipantList.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| VoiceButton.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| VoiceIndicator.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| VoiceNotification.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| VoiceSettings.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| VolumeControl.jsx | study-partner-web/src/components/VoiceChat | Application (UI) | YES | React component tree |
| WebcamCapture.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| WeeklyCalendar.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| CalendarGrid.jsx | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| DayPanel.jsx | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| SlotModal.jsx | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| WeeklyCalendar.jsx | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| calendarUtils.js | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| index.js | study-partner-web/src/components/WeeklyCalendar | Application (UI) | YES | React component tree |
| XPNotification.jsx | study-partner-web/src/components | Application (UI) | YES | React component tree |
| Navbar.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| NotificationBell.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| QuestPanel.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| SocraticEvaluation.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| TrialBanner.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| UpgradePrompt.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| WebcamCapture.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| WeeklyCalendar.test.jsx | study-partner-web/src/components/__tests__ | Application (UI) | YES | React component tree |
| AgentsSection.jsx | study-partner-web/src/components/landing | Application (UI) | YES | React component tree |
| CTASection.jsx | study-partner-web/src/components/landing | Application (UI) | YES | React component tree |
| FeaturesSection.jsx | study-partner-web/src/components/landing | Application (UI) | YES | React component tree |
| HeroSection.jsx | study-partner-web/src/components/landing | Application (UI) | YES | React component tree |
| HowItWorks.jsx | study-partner-web/src/components/landing | Application (UI) | YES | React component tree |
| ConfirmDialog.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| EmptyState.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| ErrorBoundary.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| LoadingSpinner.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| PageHeader.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| ProgressBar.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| StatCard.jsx | study-partner-web/src/components/shared | Application (UI) | YES | React component tree |
| DecryptedText.jsx | study-partner-web/src/components/ui | Application (UI) | YES | React component tree |
| TiltCard.jsx | study-partner-web/src/components/ui | Application (UI) | YES | React component tree |
| TypingText.jsx | study-partner-web/src/components/ui | Application (UI) | YES | React component tree |
| useAudioStream.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| useChatWebSocket.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| useSessionChat.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| useSpeakingDetection.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| useVoiceChat.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| useWebRTC.js | study-partner-web/src/hooks | Application (Core) | YES | Frontend state & services |
| AISearch.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AdminAnalytics.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AdminCoupons.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AdminDashboard.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AdminSubscriptions.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AdminUsers.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Analytics.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| AnimatedBackgroundCustomizer.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| BackgroundCustomizer.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Calendar.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| CheckoutCancel.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| CheckoutSuccess.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| CompetencyMap.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| CourseUpload.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Dashboard.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| ForgotPassword.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Friends.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Home.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Landing.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Leaderboard.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Lobby.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Login.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Pricing.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Profile.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Register.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| ResetPassword.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| ReviewCenter.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Sessions.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| StudyPlanner.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| StudySession.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| StudySessionSetup.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| SubjectDetail.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Subjects.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| Tasks.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| TeamLobby.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| VerifyEmail.jsx | study-partner-web/src/screens | Application (UI) | YES | React component tree |
| api.js | study-partner-web/src/services | Application (Core) | YES | Frontend state & services |
| voiceChatService.js | study-partner-web/src/services | Application (Core) | YES | Frontend state & services |
| webrtcService.js | study-partner-web/src/services | Application (Core) | YES | Frontend state & services |
| setupTests.js | study-partner-web/src | Application / Harness | YES | Frontend harness & barrel |
| friendsStore.js | study-partner-web/src/store | Application (Core) | YES | Frontend state & services |
| gamificationStore.js | study-partner-web/src/store | Application (Core) | YES | Frontend state & services |
| notificationStore.js | study-partner-web/src/store | Application (Core) | YES | Frontend state & services |
| sessionStore.js | study-partner-web/src/store | Application (Core) | YES | Frontend state & services |
| auth-api.integration.test.js | study-partner-web/src/tests/integration | Test | YES | Frontend test suites |
| data-services.integration.test.js | study-partner-web/src/tests/integration | Test | YES | Frontend test suites |
| tailwind.config.js | study-partner-web | Configuration | MAYBE | Tooling / bundler config |
| vitest.config.js | study-partner-web | Configuration | MAYBE | Tooling / bundler config |

## 2. Inventory Summary
- Total JavaScript/JSX/CJS/MJS files audited: 366

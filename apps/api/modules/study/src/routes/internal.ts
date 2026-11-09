/**
 * Service-to-service reads/writes for the Python AI service.
 *
 * Mounted at /api/v1/study/internal. Every operation is guarded by
 * `requireInternal` (`x-internal-secret`, or an admin): the AI service never
 * touches the database directly, so these are the only way it reaches
 * API-owned data (ingestion fencing, coach context, planner plans, the LLM
 * budget ledger, formula-recognition controls).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireInternal } = require('@ednova/shared/auth');
import * as ingestion from './internalIngestion';
import * as coach from './internalCoach';
import * as budget from './internalBudget';
import * as formula from './internalFormula';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
const router = createContracts();

// The AI client expects a plain 200; Nest would otherwise answer a POST with 201.
const ok = (handler: (req: DomainRequest, res: Response) => unknown) => (req: DomainRequest, res: Response) => {
  res.status(200);
  return handler(req, res);
};

router.get('/ingestion/revisions/:courseId/:revisionTag', requireInternal, ingestion.ingestionRevision);
router.get('/ingestion/operations/:messageId', requireInternal, ingestion.ingestionOperation);
router.get('/coach/catalog', requireInternal, coach.coachCatalog);
router.get('/coach/sessions/:sessionId/current-task', requireInternal, coach.coachCurrentTask);
router.get('/planner/plans', requireInternal, coach.plannerPlans);
router.post('/budget/reserve', requireInternal, ok(budget.reserve));
router.post('/budget/reserve-tokens', requireInternal, ok(budget.reserveTokens));
router.post('/budget/active', requireInternal, ok(budget.active));
router.post('/budget/usage', requireInternal, ok(budget.usage));
router.post('/budget/revoke', requireInternal, ok(budget.revoke));
router.get('/budget/:approvalId', requireInternal, budget.budgetStatus);
router.get('/experience/requests/:requestId/reservation', requireInternal, budget.experienceReservation);
router.post('/formula/recognition-context', requireInternal, ok(formula.recognitionContext));
router.post('/formula/recognition-recheck', requireInternal, ok(formula.recognitionRecheck));

export default router;
module.exports = router;

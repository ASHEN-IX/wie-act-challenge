import type { Response } from 'express';
import type { DomainRequest } from '../../../../src/framework/contracts';
import { createContracts } from '@noveris/shared/domainContracts';
import { awardAcceptedLearningEvidence, learningRewardSummary } from '../services/learningRewards';
const router = createContracts();
function failure(res: Response, error: unknown) {
  const status = Number((error as { status?: number }).status);
  return res
    .status([400, 401, 403, 404, 409, 503].includes(status) ? status : 503)
    .json({ error: 'Learning rewards unavailable', code: 'LEARNING_REWARD_UNAVAILABLE' });
}
router.get('/', async (req: DomainRequest, res: Response) => {
  if (!req.user?.userId) return res.status(401).json({ error: 'Authentication required' });
  if (Object.keys(req.query).length)
    return res.status(400).json({ error: 'Unexpected reward query' });
  try {
    return res.json(await learningRewardSummary(req.user.userId));
  } catch (error) {
    return failure(res, error);
  }
});
router.post('/evidence/:evidenceId', async (req: DomainRequest, res: Response) => {
  if (!req.user?.userId) return res.status(401).json({ error: 'Authentication required' });
  const evidenceId = req.params.evidenceId;
  if (
    typeof evidenceId !== 'string' ||
    !/^evi_[A-Za-z0-9_-]{1,128}$/.test(evidenceId) ||
    Object.keys(req.body || {}).length
  )
    return res
      .status(400)
      .json({ error: 'Evidence identity only; reward values are server-owned' });
  try {
    return res.json(await awardAcceptedLearningEvidence(req.user.userId, evidenceId));
  } catch (error) {
    return failure(res, error);
  }
});
export default router;

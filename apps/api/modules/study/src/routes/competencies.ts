import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@study-partner/shared/middleware');
import { getUserCompetencyMap, getTopicDetail } from '../services/competencyQueries';

const router = createContracts();

// Private progress must be reauthorized on every request, including account switches.

// GET /api/v1/competencies
// Grouped subject → topic → 6 Bloom levels, optionally filtered by subject
// and/or with a per-knowledge-type breakdown.
router.get(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;

    const subjectId =
      typeof req.query.subjectId === 'string' ? req.query.subjectId || undefined : undefined;
    const knowledgeTypeBreakdown = req.query.knowledgeType === 'breakdown';

    const competencies = await getUserCompetencyMap(userId, {
      subjectId,
      knowledgeTypeBreakdown
    });

    res.set('Cache-Control', 'private, no-store');
    res.json({ competencies });
  })
);

// GET /api/v1/competencies/topics/:topicId
// Per-topic detail with evidence excerpts + internal needsReview signals.
router.get(
  '/topics/:topicId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { topicId } = req.params;

    const detail = await getTopicDetail(userId, String(topicId));

    if (!detail) {
      return res.status(404).json({ error: 'No competency data for this topic' });
    }

    res.set('Cache-Control', 'private, no-store');
    res.json({ topic: detail });
  })
);

export default router;
module.exports = router;

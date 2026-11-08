import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { createContracts } from '../../../../shared/domainContracts';
import { rateLimiter } from '../../../../shared/middleware';
import {
  guideVisualLab,
  labCapabilities,
  checkUnderstanding,
  discoverVisualConcepts,
  listVisualLabs,
  getVisualLab,
  parsePlanInput,
  planVisualLab,
  VisualLabNotFoundError,
  VisualLabUnavailableError,
  VisualLabValidationError
} from '../services/visualLabPlanning';
import { PublicationForbiddenError, UnpublishedCourseError } from '../services/coursePublication';
import { SourceIntegrityError } from '../services/revisionSources';

/**
 * Visual Learning Lab API.
 *
 * Ownership boundary: this router is the lab's own surface. It reuses course
 * authorization, the published-revision pin and exact source artifacts, and does
 * not touch the Intelligent Interactive UI registry or room projection.
 */
const router = createContracts();

router.use((req: DomainRequest, res: Response, next: () => void) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
});

// Generation is metered: one learner cannot turn the lab into an open model proxy.
const generationLimiter = rateLimiter(12, 60_000);

function statusFor(error: unknown): { status: number; body: Record<string, string> } {
  if (error instanceof VisualLabValidationError)
    return { status: error.status, body: { error: error.code, message: error.message } };
  if (error instanceof UnpublishedCourseError)
    return { status: 404, body: { error: error.code, message: error.message } };
  if (error instanceof PublicationForbiddenError)
    return { status: 403, body: { error: 'FORBIDDEN', message: error.message } };
  if (error instanceof VisualLabNotFoundError)
    return { status: 404, body: { error: error.code, message: error.message } };
  if (error instanceof SourceIntegrityError)
    return { status: 503, body: { error: error.code, message: error.message } };
  if (error instanceof VisualLabUnavailableError)
    return { status: 503, body: { error: error.code, message: error.message } };
  return {
    status: 503,
    body: { error: 'VISUAL_LAB_UNAVAILABLE', message: 'The visual lab is unavailable.' }
  };
}

// Nest applies its default POST status (201) before the domain handler runs, so
// every read/guidance response states its status explicitly.
router.get('/capabilities', (_req: DomainRequest, res: Response) => {
  res.status(200).json(labCapabilities());
});

router.get('/', async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json({ labs: await listVisualLabs(req.user!.userId) });
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

router.get('/discover', async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json(await discoverVisualConcepts(req.user!.userId, req.query.courseId, req.query.revisionId));
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

router.post('/plan', generationLimiter, async (req: DomainRequest, res: Response) => {
  try {
    // Reject unsupported fields before the model boundary sees them.
    parsePlanInput(req.body);
    const result = await planVisualLab(req.user!.userId, req.body);
    if (result.kind === 'unsupported')
      return res.status(422).json({ error: 'UNSUPPORTED_CONCEPT', message: result.message });
    return res.status(201).json({ lab: result.lab });
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

router.get('/:labId', async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json({
      lab: await getVisualLab(req.user!.userId, String(req.params.labId))
    });
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

router.post('/:labId/guide', generationLimiter, async (req: DomainRequest, res: Response) => {
  try {
    return res
      .status(200)
      .json(await guideVisualLab(req.user!.userId, String(req.params.labId), req.body || {}));
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

router.post('/:labId/check', async (req: DomainRequest, res: Response) => {
  try {
    return res
      .status(200)
      .json(await checkUnderstanding(req.user!.userId, String(req.params.labId), req.body || {}));
  } catch (error) {
    const { status, body } = statusFor(error);
    return res.status(status).json(body);
  }
});

export default router;
module.exports = router;

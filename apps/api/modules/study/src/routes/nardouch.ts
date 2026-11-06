import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { createContracts } from '../../../../shared/domainContracts';
import { rateLimiter } from '../../../../shared/middleware';
import { NardouchError } from '../../../../shared/ednova/nardouch';
import { PublicationForbiddenError, UnpublishedCourseError } from '../services/coursePublication';
import {
  getConversation,
  publicConversation,
  submitTurn,
  submitFeedback,
  transcribeSpeech,
  generateSpeech
} from '../services/nardouch';

const router = createContracts();
router.use((req: DomainRequest, res: Response, next: () => void) => {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!req.user?.userId) return res.status(401).json({ error: 'Authentication required' });
  next();
});
const limit = rateLimiter(12, 60_000);
export function failure(error: unknown, res: Response) {
  if (error instanceof NardouchError)
    return res.status(error.status).json({ error: error.message });
  if (error instanceof PublicationForbiddenError)
    return res.status(403).json({ error: 'Course access denied' });
  if (error instanceof UnpublishedCourseError)
    return res.status(404).json({ error: 'Published course materials are required' });
  return res
    .status(503)
    .json({ error: 'Nardouch is unavailable. Your question is preserved; please retry.' });
}
router.post('/turn', limit, async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json({ conversation: await submitTurn(req.user!.userId, req.body) });
  } catch (error) {
    return failure(error, res);
  }
});
router.get('/conversations/:id', async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json({
      conversation: publicConversation(
        await getConversation(req.user!.userId, String(req.params.id))
      )
    });
  } catch (error) {
    return failure(error, res);
  }
});
router.post('/conversations/:id/feedback', limit, async (req: DomainRequest, res: Response) => {
  try {
    await submitFeedback(req.user!.userId, String(req.params.id), req.body);
    return res.status(200).json({ saved: true });
  } catch (error) {
    return failure(error, res);
  }
});
router.post('/transcribe', limit, async (req: DomainRequest, res: Response) => {
  try {
    return res.status(200).json(await transcribeSpeech(req.user!.userId, req.body));
  } catch (error) {
    return failure(error, res);
  }
});
router.post('/conversations/:id/speech', limit, async (req: DomainRequest, res: Response) => {
  try {
    return res
      .status(200)
      .json(await generateSpeech(req.user!.userId, String(req.params.id), req.body));
  } catch (error) {
    return failure(error, res);
  }
});
export default router;
module.exports = router;

import { createContracts } from '../../../../shared/domainContracts';
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
import { privateHelpHistory, askPrivateRoomHelp } from '../services/privateRoomHelp';
const router = createContracts();
function run(action: (req: DomainRequest) => Promise<unknown>) {
  return async (req: DomainRequest, res: Response) => {
    if (!req.user?.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      return res.json(await action(req));
    } catch (error) {
      const status = (error as { status?: number }).status;
      return res.status(status && [400, 403, 404, 409].includes(status) ? status : 503).json({
        error: 'Private help unavailable',
        code: (error as { code?: string }).code || 'UNAVAILABLE'
      });
    }
  };
}
router.get(
  '/:roomId',
  run((r) => privateHelpHistory(r.user!.userId, String(r.params.roomId)))
);
router.post(
  '/:roomId',
  run((r) => askPrivateRoomHelp(r.user!.userId, String(r.params.roomId), r.body || {}))
);
export default router;

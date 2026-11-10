import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@noveris/shared/domainContracts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@noveris/shared/middleware');
import { validateLearningObjective } from '../validators/learningObjective';

const router = createContracts();

// POST / — Validate (and, once a LearningObjective persistence model exists,
// create) a learning objective. F01 only specifies the schema/validator;
// persistence isn't in scope here, so this currently validates and echoes
// back the accepted objective. Wire in a model + save once that's defined.
router.post(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const objective = req.body;
    const result = validateLearningObjective(objective);

    if (!result.valid) {
      console.warn('LearningObjective rejected:', {
        objectiveId: objective && objective.objectiveId,
        errors: result.errors
      });
      return res.status(400).json({ errors: result.errors });
    }

    res.status(200).json({
      message: 'Learning objective accepted',
      objective
    });
  })
);

export default router;
module.exports = router;

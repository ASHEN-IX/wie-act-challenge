import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@noveris/shared/domainContracts');
import Joi from 'joi';
import { Topic } from '../models';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@noveris/shared/middleware');

const router = createContracts();

// Validation schemas
const createTopicSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  category: Joi.string().optional(),
  color: Joi.string().optional()
});

const updateTopicSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  category: Joi.string().optional(),
  color: Joi.string().optional(),
  mastery: Joi.number().min(0).max(100).optional()
});

// Get all topics
router.get(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;

    const topics = await Topic.find({ userId }).sort({ name: 1 });

    res.json({ topics });
  })
);

// Get topic by ID
router.get(
  '/:topicId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { topicId } = req.params;

    const topic = await Topic.findOne({ id: topicId, userId });

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json({ topic });
  })
);

// Create topic
router.post(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = createTopicSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;

    const topic = await Topic.create({
      userId,
      ...value
    });

    res.status(201).json({
      message: 'Topic created',
      topic
    });
  })
);

// Update topic
router.put(
  '/:topicId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = updateTopicSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;
    const { topicId } = req.params;

    const topic = await Topic.findOne({ id: topicId, userId });

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    Object.assign(topic, value);
    await Topic.save(topic);

    res.json({
      message: 'Topic updated',
      topic
    });
  })
);

// Delete topic
router.delete(
  '/:topicId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { topicId } = req.params;

    const result = await Topic.deleteOne({ id: topicId, userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    res.json({ message: 'Topic deleted' });
  })
);

export default router;
module.exports = router;

import { canReadPlanContext } from '../services/resourceAccess';
/** Prisma-shaped filter: a plain object of column predicates. */
type FilterQuery = Record<string, unknown>;
import type { DomainRequest } from '../../../../src/framework/contracts';
import type { Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@ednova/shared/domainContracts');
import Joi from 'joi';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const moduleClient = require('@ednova/shared/moduleClient');
import { Task } from '../models';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { asyncHandler } = require('@ednova/shared/middleware');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildInternalHeaders } = require('@ednova/shared/auth');

const router = createContracts();

// Validation schemas
const createTaskSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().optional(),
  topicId: Joi.string().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  estimatedTime: Joi.number().optional(),
  dueDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

const updateTaskSchema = Joi.object({
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  topicId: Joi.string().optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  estimatedTime: Joi.number().optional(),
  status: Joi.string().valid('todo', 'in-progress', 'completed', 'cancelled').optional(),
  dueDate: Joi.date().optional(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Get all tasks
router.get(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { status, priority, topicId } = req.query;

    const filter: FilterQuery = { userId };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (topicId) filter.topicId = topicId;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    const authorized = [];
    for (const task of tasks)
      if (!task.studyPlanId || (await canReadPlanContext(userId, task.studyPlanId)))
        authorized.push(task);
    res.json({ tasks: authorized });
  })
);

// Get task by ID
router.get(
  '/:taskId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { taskId } = req.params;

    const task = await Task.findOne({ id: taskId, userId });

    if (!task || (task.studyPlanId && !(await canReadPlanContext(userId, task.studyPlanId)))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task });
  })
);

// Create task
router.post(
  '/',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = createTaskSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;

    const task = await Task.create({
      userId,
      ...value
    });

    res.status(201).json({
      message: 'Task created',
      task
    });
  })
);

// Update task
router.put(
  '/:taskId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const { error, value } = updateTaskSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user!.userId;
    const { taskId } = req.params;

    const task = await Task.findOne({ id: taskId, userId });

    if (!task || (task.studyPlanId && !(await canReadPlanContext(userId, task.studyPlanId)))) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const wasCompleted = task.status === 'completed';
    Object.assign(task, value);

    if (req.body.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }

    await Task.save(task);

    // Auto-award XP on task completion
    if (req.body.status === 'completed' && !wasCompleted) {
      try {
        const USER_PROFILE_URL = 'module://users';
        const priorityMap: Record<string, string> = {
          low: 'task_complete_easy',
          medium: 'task_complete_medium',
          high: 'task_complete_hard'
        };
        const action = priorityMap[task.priority] || 'task_complete_medium';
        await moduleClient.post(
          `${USER_PROFILE_URL}/api/v1/users/gamification/award-xp`,
          {
            action,
            metadata: { taskId: task.id.toString(), title: task.title }
          },
          {
            headers: buildInternalHeaders(req.headers.cookie)
          }
        );
        // Progress quests
        await moduleClient.post(
          `${USER_PROFILE_URL}/api/v1/users/quests/progress`,
          {
            action: 'task_complete'
          },
          {
            headers: buildInternalHeaders(req.headers.cookie)
          }
        );
      } catch (xpErr) {
        console.warn(
          'XP/Quest award failed for task completion:',
          xpErr instanceof Error ? xpErr.message : String(xpErr)
        );
      }
    }

    res.json({
      message: 'Task updated',
      task
    });
  })
);

// Delete task
router.delete(
  '/:taskId',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    const userId = req.user!.userId;
    const { taskId } = req.params;

    const result = await Task.deleteOne({ id: taskId, userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted' });
  })
);

// Generate tasks from planner using AI (kept for backward compatibility)
router.post(
  '/generate-from-planner',
  asyncHandler(async (req: DomainRequest, res: Response) => {
    try {
      const { goal } = req.body;

      if (!goal) {
        return res.status(400).json({ error: 'Goal is required' });
      }

      // Redirect to new study plans endpoint
      res.status(410).json({
        error: 'This endpoint is deprecated. Please use /api/v1/study/plans/create instead',
        newEndpoint: '/api/v1/study/plans/create'
      });
    } catch (error) {
      console.error('Error in deprecated endpoint:', error);
      res.status(500).json({ error: 'Failed to generate tasks' });
    }
  })
);

export default router;
module.exports = router;

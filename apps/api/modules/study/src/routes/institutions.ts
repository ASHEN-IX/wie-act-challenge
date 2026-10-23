import type { Response, NextFunction } from 'express';
import type { DomainRequest } from '../../../../src/framework/contracts';
import Joi from 'joi';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createContracts } = require('@study-partner/shared/domainContracts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { requireRole } = require('@study-partner/shared/auth');
import {
  acceptInstitutionInvitation,
  bootstrapInstitution,
  getInstitutionContext,
  InstitutionError,
  issueInstitutionInvitation,
  listInstitutionContexts,
  revokeInstitutionInvitation,
  suspendInstitutionMembership,
  updateInstitutionMetadata
} from '../services/institutions';

const router = createContracts();

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const domainPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const bootstrapSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  slug: Joi.string().trim().lowercase().min(2).max(80).pattern(slugPattern).required(),
  domain: Joi.string().trim().lowercase().max(253).pattern(domainPattern).allow('').optional()
});

const metadataSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120),
  domain: Joi.string().trim().lowercase().max(253).pattern(domainPattern)
})
  .min(1)
  .required();

const invitationSchema = Joi.object({
  role: Joi.string().valid('instructor', 'university_student').required(),
  expiresInHours: Joi.number().integer().min(1).max(720).optional()
});

const acceptSchema = Joi.object({
  token: Joi.string()
    .trim()
    .pattern(/^[A-Za-z0-9_-]{32,200}$/)
    .required()
});

function body<T>(schema: Joi.ObjectSchema<T>, value: unknown): T {
  const result = schema.validate(value, { abortEarly: false, stripUnknown: true });
  if (result.error) throw new InstitutionError(400, result.error.details[0].message);
  return result.value;
}

function failure(error: unknown, res: Response, next: NextFunction) {
  if (error instanceof InstitutionError) {
    return res.status(error.status).json({ error: error.message });
  }
  return next(error);
}

function actor(req: DomainRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw new InstitutionError(401, 'Authentication required');
  return userId;
}

function param(req: DomainRequest, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}

// Current, explicitly authorized institutional contexts. This is display data,
// not a source-access decision; personal course ownership remains authoritative.
router.get('/', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ institutions: await listInstitutionContexts(actor(req)) });
  } catch (error) {
    failure(error, res, next);
  }
});

// Explicit synthetic/demo setup through the existing platform-admin authority.
// No self-service institution creation and no institution-role bypass.
router.post(
  '/bootstrap',
  requireRole('admin'),
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const input = body(bootstrapSchema, req.body);
      const context = await bootstrapInstitution({
        actorUserId: actor(req),
        name: input.name,
        slug: input.slug,
        ...(input.domain ? { domain: input.domain } : {})
      });
      res.status(201).json(context);
    } catch (error) {
      failure(error, res, next);
    }
  }
);

router.post(
  '/invitations/accept',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const input = body(acceptSchema, req.body);
      const context = await acceptInstitutionInvitation({
        actorUserId: actor(req),
        token: input.token
      });
      // Nest defaults POST to 201; accepting an existing capability is not a
      // resource creation response for the HTTP client.
      res.status(200).json(context);
    } catch (error) {
      failure(error, res, next);
    }
  }
);

router.get('/:institutionId', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await getInstitutionContext(actor(req), param(req, 'institutionId')));
  } catch (error) {
    failure(error, res, next);
  }
});

router.patch('/:institutionId', async (req: DomainRequest, res: Response, next: NextFunction) => {
  try {
    const input = body(metadataSchema, req.body);
    const context = await updateInstitutionMetadata(
      actor(req),
      param(req, 'institutionId'),
      input as { name?: string; domain?: string }
    );
    res.json(context);
  } catch (error) {
    failure(error, res, next);
  }
});

router.post(
  '/:institutionId/invitations',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const input = body(invitationSchema, req.body);
      const issued = await issueInstitutionInvitation({
        actorUserId: actor(req),
        institutionId: param(req, 'institutionId'),
        role: input.role as 'instructor' | 'university_student',
        ...(input.expiresInHours === undefined ? {} : { expiresInHours: input.expiresInHours })
      });
      res.status(201).json(issued);
    } catch (error) {
      failure(error, res, next);
    }
  }
);

router.delete(
  '/:institutionId/invitations/:invitationId',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const invitation = await revokeInstitutionInvitation({
        actorUserId: actor(req),
        institutionId: param(req, 'institutionId'),
        invitationId: param(req, 'invitationId')
      });
      res.json({ invitation });
    } catch (error) {
      failure(error, res, next);
    }
  }
);

router.delete(
  '/:institutionId/memberships/:userId',
  async (req: DomainRequest, res: Response, next: NextFunction) => {
    try {
      const membership = await suspendInstitutionMembership({
        actorUserId: actor(req),
        institutionId: param(req, 'institutionId'),
        targetUserId: param(req, 'userId')
      });
      res.json({ membership });
    } catch (error) {
      failure(error, res, next);
    }
  }
);

export default router;
module.exports = router;
